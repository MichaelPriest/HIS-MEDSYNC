alter table public.contrato_producao_mapeamentos
  add column if not exists status_motivo text,
  add column if not exists status_alterado_em timestamptz,
  add column if not exists status_alterado_por uuid;

create or replace function public.audit_contrato_producao_mapeamento()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else null end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else null end;
  v_ref jsonb := coalesce(v_new, v_old);
  v_contrato public.credenciamento_contratos%rowtype;
begin
  select c.* into v_contrato
    from public.credenciamento_contratos c
   where c.id = (v_ref->>'contrato_id')::uuid;

  if v_contrato.id is not null then
    insert into public.comercial_eventos(
      empresa_id, unidade_id, entidade_tipo, entidade_id, acao,
      antes, depois, usuario_id, contexto_contrato_id, contexto_edicao_id
    ) values (
      v_contrato.empresa_id,
      coalesce(nullif(v_ref->>'unidade_id','')::uuid, v_contrato.unidade_id),
      'contrato_producao_mapeamentos',
      (v_ref->>'id')::uuid,
      lower(tg_op),
      v_old,
      v_new,
      auth.uid(),
      v_contrato.id,
      null
    );
  end if;
  return coalesce(new, old);
end
$function$;

revoke all on function public.audit_contrato_producao_mapeamento() from public, anon, authenticated;

drop trigger if exists trg_audit_contrato_producao_mapeamento on public.contrato_producao_mapeamentos;
create trigger trg_audit_contrato_producao_mapeamento
after insert or update or delete on public.contrato_producao_mapeamentos
for each row execute function public.audit_contrato_producao_mapeamento();

create or replace function public.comercial_salvar_mapeamento_producao(
  p_contrato_id uuid,
  p_tipo_evento text,
  p_codigo_tabela text,
  p_codigo text,
  p_mapeamento_id uuid default null,
  p_unidade_id uuid default null,
  p_acomodacao text default null,
  p_setor text default null,
  p_item_assistencial_id uuid default null,
  p_prioridade integer default 100,
  p_vigencia_inicio date default null,
  p_vigencia_fim date default null,
  p_ativo boolean default true,
  p_status_motivo text default null,
  p_observacoes text default null,
  p_exige_autorizacao boolean default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_contrato public.credenciamento_contratos%rowtype;
  v_atual public.contrato_producao_mapeamentos%rowtype;
  v_id uuid;
  v_tipo text := lower(nullif(btrim(p_tipo_evento),''));
  v_tabela text := nullif(btrim(p_codigo_tabela),'');
  v_codigo text := nullif(btrim(p_codigo),'');
  v_status_changed boolean := false;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;

  select c.* into v_contrato from public.credenciamento_contratos c where c.id=p_contrato_id;
  if not found then raise exception 'CONTRATO_NAO_ENCONTRADO'; end if;
  if not public.comercial_pode_editar(v_contrato.empresa_id,v_contrato.unidade_id) then
    raise exception 'SEM_PERMISSAO_COMERCIAL' using errcode='42501';
  end if;

  if v_tipo is null or v_tipo <> all(array[
    'consulta_ambulatorial','consulta_pronto_atendimento','visita_medica','procedimento',
    'laboratorio','imagem','exame','sessao_tea_aba','diaria','taxa','medicamento',
    'material','opme','gas_medicinal','honorario','outro'
  ]) then raise exception 'TIPO_EVENTO_INVALIDO'; end if;
  if v_tabela is null then raise exception 'CODIGO_TABELA_OBRIGATORIO'; end if;
  if v_codigo is null then raise exception 'CODIGO_COBRANCA_OBRIGATORIO'; end if;
  if coalesce(p_prioridade,0) < 0 then raise exception 'PRIORIDADE_INVALIDA'; end if;
  if p_vigencia_inicio is not null and p_vigencia_fim is not null and p_vigencia_fim < p_vigencia_inicio then raise exception 'VIGENCIA_INVALIDA'; end if;

  if p_unidade_id is not null then
    if not exists(select 1 from public.unidades u where u.id=p_unidade_id and u.empresa_id=v_contrato.empresa_id and u.ativo) then raise exception 'UNIDADE_INVALIDA'; end if;
    if v_contrato.unidade_id is not null and v_contrato.unidade_id <> p_unidade_id then raise exception 'UNIDADE_FORA_DO_CONTRATO'; end if;
    if not public.comercial_pode_editar(v_contrato.empresa_id,p_unidade_id) then raise exception 'SEM_PERMISSAO_UNIDADE' using errcode='42501'; end if;
  end if;

  if p_item_assistencial_id is not null and not exists(
    select 1 from public.itens_assistenciais i where i.id=p_item_assistencial_id and i.empresa_id=v_contrato.empresa_id and i.ativo
  ) then raise exception 'ITEM_ASSISTENCIAL_INVALIDO'; end if;

  if p_mapeamento_id is not null then
    select m.* into v_atual from public.contrato_producao_mapeamentos m where m.id=p_mapeamento_id for update;
    if not found then raise exception 'MAPEAMENTO_NAO_ENCONTRADO'; end if;
    if v_atual.contrato_id <> p_contrato_id then raise exception 'MAPEAMENTO_FORA_DO_CONTRATO'; end if;
    v_status_changed := v_atual.ativo is distinct from coalesce(p_ativo,true);
    if v_status_changed and nullif(btrim(p_status_motivo),'') is null then raise exception 'MOTIVO_STATUS_OBRIGATORIO'; end if;

    update public.contrato_producao_mapeamentos set
      unidade_id=p_unidade_id,
      tipo_evento=v_tipo,
      acomodacao=nullif(btrim(p_acomodacao),''),
      setor=nullif(btrim(p_setor),''),
      codigo_tabela=v_tabela,
      codigo=v_codigo,
      item_assistencial_id=p_item_assistencial_id,
      prioridade=coalesce(p_prioridade,100),
      vigencia_inicio=p_vigencia_inicio,
      vigencia_fim=p_vigencia_fim,
      ativo=coalesce(p_ativo,true),
      observacoes=nullif(btrim(p_observacoes),''),
      exige_autorizacao=p_exige_autorizacao,
      status_motivo=case when v_status_changed then btrim(p_status_motivo) else status_motivo end,
      status_alterado_em=case when v_status_changed then now() else status_alterado_em end,
      status_alterado_por=case when v_status_changed then auth.uid() else status_alterado_por end,
      updated_at=now(), updated_by=auth.uid()
    where id=p_mapeamento_id returning id into v_id;
  else
    insert into public.contrato_producao_mapeamentos(
      empresa_id,unidade_id,contrato_id,tipo_evento,acomodacao,setor,codigo_tabela,codigo,
      item_assistencial_id,prioridade,vigencia_inicio,vigencia_fim,ativo,observacoes,
      created_by,updated_by,exige_autorizacao,status_motivo,status_alterado_em,status_alterado_por
    ) values (
      v_contrato.empresa_id,p_unidade_id,p_contrato_id,v_tipo,nullif(btrim(p_acomodacao),''),
      nullif(btrim(p_setor),''),v_tabela,v_codigo,p_item_assistencial_id,coalesce(p_prioridade,100),
      p_vigencia_inicio,p_vigencia_fim,coalesce(p_ativo,true),nullif(btrim(p_observacoes),''),
      auth.uid(),auth.uid(),p_exige_autorizacao,
      case when coalesce(p_ativo,true)=false then coalesce(nullif(btrim(p_status_motivo),''),'Criado inativo') else null end,
      case when coalesce(p_ativo,true)=false then now() else null end,
      case when coalesce(p_ativo,true)=false then auth.uid() else null end
    ) returning id into v_id;
  end if;

  return v_id;
end
$function$;

revoke all on function public.comercial_salvar_mapeamento_producao(uuid,text,text,text,uuid,uuid,text,text,uuid,integer,date,date,boolean,text,text,boolean) from public, anon;
grant execute on function public.comercial_salvar_mapeamento_producao(uuid,text,text,text,uuid,uuid,text,text,uuid,integer,date,date,boolean,text,text,boolean) to authenticated;
