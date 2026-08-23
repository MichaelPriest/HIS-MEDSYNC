begin;

-- Garante o setor de recepção habilitado no totem para todas as unidades existentes.
insert into public.setores_chamada(
  empresa_id,
  unidade_id,
  codigo,
  nome,
  prefixo,
  permite_totem,
  ativo,
  ordem
)
select
  u.empresa_id,
  u.id,
  'recepcao',
  'Recepção',
  'R',
  true,
  true,
  10
from public.unidades u
where u.ativo
on conflict (unidade_id,codigo) do update
set nome = excluded.nome,
    permite_totem = true,
    ativo = true;

-- RPC exclusiva do quiosque público. Não depende de RLS para consultar paciente
-- nem para inserir/vincular a senha, mas restringe estritamente a uma unidade ativa
-- e a um setor explicitamente habilitado para totem.
create or replace function public.emitir_senha_totem_v2(
  p_unidade_id uuid,
  p_setor_codigo text default 'recepcao',
  p_prioridade text default 'normal',
  p_cpf text default null
)
returns table(
  id uuid,
  senha text,
  emitida_em timestamptz,
  setor_nome text,
  identificado boolean
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_unidade public.unidades%rowtype;
  v_setor public.setores_chamada%rowtype;
  v_seq integer;
  v_data date := (now() at time zone 'America/Sao_Paulo')::date;
  v_id uuid;
  v_senha text;
  v_paciente_id uuid := null;
  v_cpf text := regexp_replace(coalesce(p_cpf,''), '\D', '', 'g');
  v_prioridade public.prioridade_senha;
begin
  select * into v_unidade
  from public.unidades
  where id = p_unidade_id
    and ativo
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'TOTEM_UNIDADE_INDISPONIVEL';
  end if;

  begin
    v_prioridade := coalesce(nullif(trim(p_prioridade),''),'normal')::public.prioridade_senha;
  exception when invalid_text_representation then
    raise exception using errcode = 'P0001', message = 'TOTEM_PRIORIDADE_INVALIDA';
  end;

  select * into v_setor
  from public.setores_chamada
  where unidade_id = p_unidade_id
    and codigo = coalesce(nullif(trim(p_setor_codigo),''),'recepcao')
    and ativo
    and permite_totem
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'TOTEM_SETOR_INDISPONIVEL';
  end if;

  -- A identificação é opcional e só informa booleano ao chamador.
  if length(v_cpf) = 11 then
    select p.id into v_paciente_id
    from public.pacientes p
    where p.empresa_id = v_unidade.empresa_id
      and p.cpf = v_cpf
      and p.ativo
    limit 1;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_unidade_id::text || v_data::text || v_setor.id::text));

  select coalesce(max(s.sequencial),0) + 1
    into v_seq
  from public.senhas_atendimento s
  where s.unidade_id = p_unidade_id
    and s.setor_id = v_setor.id
    and s.data_referencia = v_data;

  v_senha := upper(v_setor.prefixo) || lpad(v_seq::text,3,'0');

  insert into public.senhas_atendimento(
    empresa_id,
    unidade_id,
    setor_id,
    data_referencia,
    sequencial,
    senha,
    prioridade,
    paciente_id
  ) values (
    v_unidade.empresa_id,
    p_unidade_id,
    v_setor.id,
    v_data,
    v_seq,
    v_senha,
    v_prioridade,
    v_paciente_id
  )
  returning senhas_atendimento.id into v_id;

  return query
  select v_id, v_senha, now(), v_setor.nome, (v_paciente_id is not null);
end;
$$;

revoke all on function public.emitir_senha_totem_v2(uuid,text,text,text) from public;
grant execute on function public.emitir_senha_totem_v2(uuid,text,text,text) to anon, authenticated;

comment on function public.emitir_senha_totem_v2(uuid,text,text,text) is
'Emite senha no totem público para setor habilitado, com identificação opcional por CPF sem expor dados do paciente.';

commit;
