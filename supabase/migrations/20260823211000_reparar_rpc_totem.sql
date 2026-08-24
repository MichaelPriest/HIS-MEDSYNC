begin;

grant usage on schema public to anon, authenticated;

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
    prefixo = excluded.prefixo,
    permite_totem = true,
    ativo = true,
    ordem = excluded.ordem;

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
  select u.* into v_unidade
  from public.unidades u
  where u.id = p_unidade_id
    and u.ativo
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'TOTEM_UNIDADE_INDISPONIVEL';
  end if;

  begin
    v_prioridade := coalesce(nullif(trim(p_prioridade),''),'normal')::public.prioridade_senha;
  exception when invalid_text_representation then
    raise exception using errcode = 'P0001', message = 'TOTEM_PRIORIDADE_INVALIDA';
  end;

  select sc.* into v_setor
  from public.setores_chamada sc
  where sc.unidade_id = p_unidade_id
    and sc.codigo = coalesce(nullif(trim(p_setor_codigo),''),'recepcao')
    and sc.ativo
    and sc.permite_totem
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'TOTEM_SETOR_INDISPONIVEL';
  end if;

  if coalesce(trim(p_cpf),'') <> '' then
    if length(v_cpf) <> 11 then
      raise exception using errcode = 'P0001', message = 'TOTEM_CPF_INVALIDO';
    end if;

    select p.id into v_paciente_id
    from public.pacientes p
    where p.empresa_id = v_unidade.empresa_id
      and p.cpf = v_cpf
      and p.ativo
    limit 1;

    if v_paciente_id is null then
      raise exception using errcode = 'P0001', message = 'TOTEM_CPF_NAO_LOCALIZADO';
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_unidade_id::text || ':' || v_data::text || ':' || v_setor.id::text, 0)
  );

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

create or replace function public.emitir_senha_totem(
  p_unidade_id uuid,
  p_setor_codigo text,
  p_prioridade public.prioridade_senha default 'normal'
)
returns table(
  id uuid,
  senha text,
  emitida_em timestamptz,
  setor_nome text
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select r.id, r.senha, r.emitida_em, r.setor_nome
  from public.emitir_senha_totem_v2(
    p_unidade_id,
    p_setor_codigo,
    p_prioridade::text,
    null
  ) r
$$;

revoke all on function public.emitir_senha_totem(uuid,text,public.prioridade_senha) from public;
grant execute on function public.emitir_senha_totem(uuid,text,public.prioridade_senha) to anon, authenticated;

comment on function public.emitir_senha_totem_v2(uuid,text,text,text) is
'RPC publica do Totem. Emite senha somente para unidade ativa e setor habilitado; identificacao por CPF e opcional e nao expoe dados do paciente.';

notify pgrst, 'reload schema';

commit;
