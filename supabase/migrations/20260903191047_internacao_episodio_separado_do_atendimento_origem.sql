alter table public.atendimentos
  add column if not exists atendimento_origem_id uuid,
  add column if not exists transicao_origem text,
  add column if not exists motivo_encerramento_operacional text;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='atendimentos_atendimento_origem_id_fkey') then
    alter table public.atendimentos add constraint atendimentos_atendimento_origem_id_fkey
      foreign key(atendimento_origem_id) references public.atendimentos(id) on delete set null;
  end if;
end $$;

create index if not exists idx_atendimentos_origem on public.atendimentos(atendimento_origem_id) where atendimento_origem_id is not null;

drop trigger if exists trg_faturamento_reclassificar_conta_na_alta on public.atendimentos;

create or replace function public.admitir_internacao_operacional(
  p_atendimento_id uuid,
  p_setor text,
  p_profissional_responsavel_id uuid default null,
  p_leito_id uuid default null,
  p_acomodacao text default null,
  p_acomodacao_tuss49_codigo text default null,
  p_motivo text default null,
  p_previsao_alta date default null,
  p_observacoes text default null
)
returns uuid
language plpgsql
security definer
set search_path='public','pg_catalog'
as $$
declare
  v_at public.atendimentos%rowtype;
  v_at_internacao public.atendimentos%rowtype;
  v_dom record;
  v_internacao uuid;
  v_novo_atendimento uuid;
  v_reutiliza boolean:=false;
begin
  if auth.uid() is null then raise exception 'INTERNACAO_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  if coalesce(btrim(p_setor),'')='' then raise exception 'INTERNACAO_SETOR_OBRIGATORIO'; end if;

  select * into v_at from public.atendimentos where id=p_atendimento_id for update;
  if not found then raise exception 'INTERNACAO_ATENDIMENTO_NAO_LOCALIZADO'; end if;
  if not public.tem_unidade(v_at.empresa_id,v_at.unidade_id) then raise exception 'INTERNACAO_UNIDADE_FORA_ESCOPO' using errcode='42501'; end if;
  if v_at.status in ('alta','cancelado') then raise exception 'INTERNACAO_ATENDIMENTO_ENCERRADO'; end if;
  if not(
    public.tem_permissao(v_at.empresa_id,v_at.unidade_id,'internacao.admitir')
    or public.tem_permissao(v_at.empresa_id,v_at.unidade_id,'internacao.criar')
    or public.tem_permissao(v_at.empresa_id,v_at.unidade_id,'internacao.gerenciar')
  ) then raise exception 'INTERNACAO_SEM_PERMISSAO_ADMITIR' using errcode='42501'; end if;
  if p_profissional_responsavel_id is not null and not exists(
    select 1 from public.profissionais p where p.id=p_profissional_responsavel_id and p.empresa_id=v_at.empresa_id and p.ativo
  ) then raise exception 'INTERNACAO_RESPONSAVEL_INVALIDO'; end if;
  if v_at.cobertura::text='convenio' and coalesce(btrim(p_acomodacao_tuss49_codigo),'')='' then raise exception 'INTERNACAO_ACOMODACAO_ANS_OBRIGATORIA'; end if;

  if coalesce(btrim(p_acomodacao_tuss49_codigo),'')<>'' then
    select conceito_id,codigo,display,versao,canonical into v_dom
      from public.ans_fhir_dominios_ativos where tabela=49 and codigo=btrim(p_acomodacao_tuss49_codigo) limit 1;
    if v_dom.codigo is null then raise exception 'INTERNACAO_ACOMODACAO_ANS_INVALIDA'; end if;
  end if;

  v_reutiliza := lower(coalesce(v_at.regime_atendimento,''))='internacao'
    or lower(coalesce(v_at.tipo_atendimento,'')) like '%interna%';

  if v_reutiliza then
    if exists(select 1 from public.internacoes i where i.atendimento_id=v_at.id and i.status in ('aguardando_leito','internado','transferido')) then
      raise exception 'INTERNACAO_ATIVA_JA_EXISTE';
    end if;
    v_novo_atendimento:=v_at.id;
    update public.atendimentos
       set regime_atendimento='internacao',tipo_atendimento_tiss='internacao',
           tipo_atendimento_tuss50_codigo='07',setor_atual=btrim(p_setor),
           ultima_movimentacao_em=now(),updated_at=now(),updated_by=auth.uid()
     where id=v_novo_atendimento;
  else
    select conceito_id,codigo,display,versao,canonical into v_dom
      from public.ans_fhir_dominios_ativos where tabela=50 and codigo='07' limit 1;
    if v_dom.codigo is null then raise exception 'INTERNACAO_TIPO_ATENDIMENTO_ANS_INDISPONIVEL'; end if;

    insert into public.atendimentos(
      empresa_id,unidade_id,paciente_id,profissional_id,tipo_atendimento,origem,status,cobertura,
      convenio_id,plano_id,numero_carteirinha,validade_carteirinha,
      paciente_nome,paciente_nome_social,paciente_cpf,paciente_rg,paciente_cns,paciente_data_nascimento,
      paciente_nacionalidade,paciente_estado_civil,paciente_sexo,paciente_telefone,paciente_email,
      paciente_cep,paciente_endereco,paciente_numero,paciente_complemento,paciente_bairro,paciente_cidade,paciente_estado,
      setor_atual,ultima_movimentacao_em,observacoes,atendimento_rn,
      regime_atendimento,tipo_atendimento_tiss,indicacao_clinica,
      tipo_atendimento_tuss50_conceito_id,tipo_atendimento_tuss50_codigo,tipo_atendimento_tuss50_descricao,
      tipo_atendimento_tuss50_versao,tipo_atendimento_tuss50_canonical,
      atendimento_origem_id,transicao_origem,created_by,updated_by
    ) values(
      v_at.empresa_id,v_at.unidade_id,v_at.paciente_id,coalesce(p_profissional_responsavel_id,v_at.profissional_id),
      'internacao','internacao_pos_atendimento','em_atendimento',v_at.cobertura,
      v_at.convenio_id,v_at.plano_id,v_at.numero_carteirinha,v_at.validade_carteirinha,
      v_at.paciente_nome,v_at.paciente_nome_social,v_at.paciente_cpf,v_at.paciente_rg,v_at.paciente_cns,v_at.paciente_data_nascimento,
      v_at.paciente_nacionalidade,v_at.paciente_estado_civil,v_at.paciente_sexo,v_at.paciente_telefone,v_at.paciente_email,
      v_at.paciente_cep,v_at.paciente_endereco,v_at.paciente_numero,v_at.paciente_complemento,v_at.paciente_bairro,v_at.paciente_cidade,v_at.paciente_estado,
      btrim(p_setor),now(),nullif(btrim(coalesce(p_observacoes,'')),''),coalesce(v_at.atendimento_rn,false),
      'internacao','internacao',nullif(btrim(coalesce(p_motivo,'')),''),
      v_dom.conceito_id,v_dom.codigo,v_dom.display,v_dom.versao,v_dom.canonical,
      v_at.id,'internacao_pos_atendimento',auth.uid(),auth.uid()
    ) returning id into v_novo_atendimento;

    update public.atendimentos
       set status='alta',data_fechamento=coalesce(data_fechamento,now()),
           motivo_encerramento_operacional='internacao',
           ultima_movimentacao_em=now(),updated_at=now(),updated_by=auth.uid()
     where id=v_at.id;
  end if;

  select * into v_at_internacao from public.atendimentos where id=v_novo_atendimento;

  insert into public.internacoes(
    empresa_id,unidade_id,atendimento_id,profissional_responsavel_id,setor,acomodacao,
    acomodacao_tuss49_conceito_id,acomodacao_tuss49_codigo,acomodacao_tuss49_descricao,
    acomodacao_tuss49_versao,acomodacao_tuss49_canonical,motivo,previsao_alta,observacoes,status,created_by,updated_by
  ) values(
    v_at_internacao.empresa_id,v_at_internacao.unidade_id,v_novo_atendimento,
    coalesce(p_profissional_responsavel_id,v_at_internacao.profissional_id),btrim(p_setor),nullif(btrim(coalesce(p_acomodacao,'')),''),
    case when p_acomodacao_tuss49_codigo is not null then v_dom.conceito_id else null end,
    nullif(btrim(coalesce(p_acomodacao_tuss49_codigo,'')),''),
    case when p_acomodacao_tuss49_codigo is not null then v_dom.display else null end,
    case when p_acomodacao_tuss49_codigo is not null then v_dom.versao else null end,
    case when p_acomodacao_tuss49_codigo is not null then v_dom.canonical else null end,
    nullif(btrim(coalesce(p_motivo,'')),''),p_previsao_alta,nullif(btrim(coalesce(p_observacoes,'')),''),
    'aguardando_leito',auth.uid(),auth.uid()
  ) returning id into v_internacao;

  if p_leito_id is not null then perform public.movimentar_internacao_leito_internal(v_internacao,p_leito_id,'Admissão'); end if;
  return v_internacao;
end $$;

grant execute on function public.admitir_internacao_operacional(uuid,text,uuid,uuid,text,text,text,date,text) to authenticated;
revoke execute on function public.admitir_internacao_operacional(uuid,text,uuid,uuid,text,text,text,date,text) from anon,public;
