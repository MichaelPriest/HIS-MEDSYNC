alter table public.cirurgias
  add column if not exists contrato_id uuid references public.credenciamento_contratos(id) on delete set null,
  add column if not exists tabela_item_id uuid references public.tabelas_comerciais_itens(id) on delete set null,
  add column if not exists codigo_contratado text,
  add column if not exists tabela_referencia text,
  add column if not exists porte_anestesico text;

create index if not exists idx_cirurgias_contrato on public.cirurgias(contrato_id) where contrato_id is not null;
create index if not exists idx_cirurgias_tabela_item on public.cirurgias(tabela_item_id) where tabela_item_id is not null;

drop index if exists public.ux_cirurgia_agendamento_operacional;
create unique index ux_cirurgia_agendamento_operacional
  on public.cirurgias(atendimento_id,coalesce(codigo_tuss,codigo_contratado,''),inicio_previsto)
  where status <> 'cancelada' and inicio_previsto is not null;

create or replace function public.centro_cirurgico_agendar_operacional(
  p_atendimento_id uuid,
  p_cirurgia_id uuid default null,
  p_procedimento text default null,
  p_codigo_tuss text default null,
  p_cirurgia text default null,
  p_lateralidade text default null,
  p_sala text default null,
  p_classificacao text default null,
  p_porte text default null,
  p_inicio_previsto timestamptz default null,
  p_cirurgiao_id uuid default null,
  p_anestesista_id uuid default null,
  p_diagnostico_pre text default null
) returns uuid
language plpgsql
security definer
set search_path = public,pg_catalog,extensions
as $$
declare
  v_at public.atendimentos%rowtype;
  v_c public.cirurgias%rowtype;
  v_id uuid;
  v_prof uuid;
  v_sala_id uuid;
  v_item record;
  v_proc text := nullif(btrim(p_procedimento),'');
  v_codigo_tuss text := nullif(btrim(p_codigo_tuss),'');
  v_porte text := nullif(btrim(p_porte),'');
  v_porte_anestesico text;
  v_contrato_id uuid;
  v_tabela_item_id uuid;
  v_codigo_contratado text;
  v_tabela_referencia text;
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_at from public.atendimentos where id=p_atendimento_id for update;
  if not found or v_at.paciente_id is null then raise exception 'CC_ATENDIMENTO_NAO_LOCALIZADO'; end if;
  if not public.tem_permissao(v_at.empresa_id,v_at.unidade_id,'centro_cirurgico.gerenciar') then raise exception 'CC_AGENDAMENTO_EXIGE_GERENCIA' using errcode='42501'; end if;
  if v_proc is null then raise exception 'CC_PROCEDIMENTO_OBRIGATORIO'; end if;
  if p_inicio_previsto is null then raise exception 'CC_INICIO_PREVISTO_OBRIGATORIO'; end if;

  if v_at.cobertura::text='convenio' and v_at.convenio_id is not null then
    select x.* into v_item
    from public.buscar_procedimentos_cirurgicos_contrato(v_at.id,coalesce(v_codigo_tuss,v_proc),80) x
    where (v_codigo_tuss is not null and (x.codigo_tuss=v_codigo_tuss or x.codigo=v_codigo_tuss))
       or lower(x.descricao)=lower(v_proc)
    order by case when v_codigo_tuss is not null and x.codigo_tuss=v_codigo_tuss then 0 when v_codigo_tuss is not null and x.codigo=v_codigo_tuss then 1 else 2 end,x.prioridade
    limit 1;
    if not found then raise exception 'CC_PROCEDIMENTO_FORA_CONTRATO'; end if;

    v_proc:=v_item.descricao;
    v_codigo_tuss:=v_item.codigo_tuss;
    v_porte:=v_item.porte;
    v_porte_anestesico:=v_item.porte_anestesico;
    v_contrato_id:=v_item.contrato_id;
    v_tabela_item_id:=v_item.tabela_item_id;
    v_codigo_contratado:=v_item.codigo;
    v_tabela_referencia:=concat_ws(' · ',v_item.fonte_codigo,v_item.edicao_nome);
  end if;

  if p_cirurgiao_id is not null and not exists(select 1 from public.profissionais p where p.id=p_cirurgiao_id and p.empresa_id=v_at.empresa_id and p.ativo) then raise exception 'CC_CIRURGIAO_INVALIDO'; end if;
  if p_anestesista_id is not null and not exists(select 1 from public.profissionais p where p.id=p_anestesista_id and p.empresa_id=v_at.empresa_id and p.ativo) then raise exception 'CC_ANESTESISTA_INVALIDO'; end if;
  if coalesce(btrim(p_sala),'')<>'' then
    select s.id into v_sala_id from public.salas_cirurgicas s where s.empresa_id=v_at.empresa_id and s.unidade_id=v_at.unidade_id and s.ativo and (lower(s.codigo)=lower(btrim(p_sala)) or lower(s.nome)=lower(btrim(p_sala))) limit 1;
  end if;
  v_prof:=public.profissional_logado(v_at.empresa_id);

  if p_cirurgia_id is not null then
    select * into v_c from public.cirurgias where id=p_cirurgia_id for update;
    if not found or v_c.atendimento_id<>v_at.id or v_c.empresa_id<>v_at.empresa_id or v_c.unidade_id<>v_at.unidade_id then raise exception 'CC_CIRURGIA_NAO_LOCALIZADA'; end if;
    if v_c.status not in ('agendada','em_preparo') then raise exception 'CC_AGENDAMENTO_NAO_EDITAVEL'; end if;
    update public.cirurgias set
      procedimento=v_proc,codigo_tuss=v_codigo_tuss,cirurgia=nullif(btrim(p_cirurgia),''),lateralidade=nullif(btrim(p_lateralidade),''),sala=nullif(btrim(p_sala),''),sala_id=v_sala_id,classificacao=nullif(btrim(p_classificacao),''),porte=v_porte,porte_anestesico=v_porte_anestesico,contrato_id=v_contrato_id,tabela_item_id=v_tabela_item_id,codigo_contratado=v_codigo_contratado,tabela_referencia=v_tabela_referencia,inicio_previsto=p_inicio_previsto,cirurgiao_id=p_cirurgiao_id,anestesista_id=p_anestesista_id,diagnostico_pre=nullif(btrim(p_diagnostico_pre),''),updated_at=now(),updated_by=auth.uid()
    where id=v_c.id returning id into v_id;
    insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by)
    values(v_at.empresa_id,v_at.unidade_id,v_id,v_at.id,'agendamento_atualizado',jsonb_build_object('inicio_previsto',p_inicio_previsto,'sala',p_sala,'procedimento',v_proc,'codigo_tuss',v_codigo_tuss,'codigo_contratado',v_codigo_contratado,'porte',v_porte,'porte_anestesico',v_porte_anestesico,'contrato_id',v_contrato_id,'tabela_item_id',v_tabela_item_id,'tabela_referencia',v_tabela_referencia),v_prof,auth.uid());
    return v_id;
  end if;

  select c.id into v_id from public.cirurgias c
  where c.atendimento_id=v_at.id
    and coalesce(c.codigo_tuss,c.codigo_contratado,'')=coalesce(v_codigo_tuss,v_codigo_contratado,'')
    and c.inicio_previsto is not distinct from p_inicio_previsto
    and c.status<>'cancelada'
  limit 1 for update;
  if v_id is not null then return v_id; end if;

  insert into public.cirurgias(empresa_id,unidade_id,atendimento_id,paciente_id,procedimento,codigo_tuss,cirurgia,lateralidade,sala,sala_id,classificacao,porte,porte_anestesico,contrato_id,tabela_item_id,codigo_contratado,tabela_referencia,status,inicio_previsto,cirurgiao_id,anestesista_id,diagnostico_pre,created_by,updated_by)
  values(v_at.empresa_id,v_at.unidade_id,v_at.id,v_at.paciente_id,v_proc,v_codigo_tuss,nullif(btrim(p_cirurgia),''),nullif(btrim(p_lateralidade),''),nullif(btrim(p_sala),''),v_sala_id,nullif(btrim(p_classificacao),''),v_porte,v_porte_anestesico,v_contrato_id,v_tabela_item_id,v_codigo_contratado,v_tabela_referencia,'agendada',p_inicio_previsto,p_cirurgiao_id,p_anestesista_id,nullif(btrim(p_diagnostico_pre),''),auth.uid(),auth.uid()) returning id into v_id;

  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,status_novo,detalhes,profissional_id,created_by)
  values(v_at.empresa_id,v_at.unidade_id,v_id,v_at.id,'cirurgia_agendada','agendada',jsonb_build_object('inicio_previsto',p_inicio_previsto,'sala',p_sala,'procedimento',v_proc,'codigo_tuss',v_codigo_tuss,'codigo_contratado',v_codigo_contratado,'porte',v_porte,'porte_anestesico',v_porte_anestesico,'contrato_id',v_contrato_id,'tabela_item_id',v_tabela_item_id,'tabela_referencia',v_tabela_referencia),v_prof,auth.uid());
  return v_id;
exception when unique_violation then
  select c.id into v_id from public.cirurgias c
  where c.atendimento_id=v_at.id
    and coalesce(c.codigo_tuss,c.codigo_contratado,'')=coalesce(v_codigo_tuss,v_codigo_contratado,'')
    and c.inicio_previsto is not distinct from p_inicio_previsto
    and c.status<>'cancelada'
  limit 1;
  if v_id is not null then return v_id; end if;
  raise;
end;
$$;

revoke all on function public.centro_cirurgico_agendar_operacional(uuid,uuid,text,text,text,text,text,text,text,timestamptz,uuid,uuid,text) from public,anon;
grant execute on function public.centro_cirurgico_agendar_operacional(uuid,uuid,text,text,text,text,text,text,text,timestamptz,uuid,uuid,text) to authenticated;
