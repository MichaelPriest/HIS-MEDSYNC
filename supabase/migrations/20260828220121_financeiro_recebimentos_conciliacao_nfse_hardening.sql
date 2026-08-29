alter table public.integracao_eventos drop constraint if exists integracao_eventos_tipo_check;
alter table public.integracao_eventos add constraint integracao_eventos_tipo_check check (tipo_evento = any (array[
  'exame.liberado','imagem.executada','laudo.liberado','cirurgia.iniciada','cirurgia.concluida','opme.utilizada','producao.registrada',
  'prescricao.assinada','farmacia.validada','medicamento.dispensado','medicamento.administrado','medicamento.devolvido','estoque.consumo_paciente',
  'internacao.admitida','leito.alocado','leito.transferido','internacao.alta','leito.higienizacao_concluida',
  'conta.auditada','tiss.guia_criada','tiss.guia_pronta','tiss.lote_criado','tiss.lote_protocolado','glosa.registrada','glosa.recurso_criado','financeiro.recebivel_criado',
  'financeiro.recebimento_registrado','financeiro.recebimento_conciliado','financeiro.recebimento_estornado','nfse.rascunho_criado','nfse.emitida'
]::text[]));

create table if not exists public.financeiro_recebimentos (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  recebivel_id uuid not null references public.financeiro_recebiveis(id),
  lote_id uuid references public.tiss_lotes(id),
  data_recebimento date not null,
  valor_baixado numeric not null,
  valor_retencoes numeric not null default 0,
  valor_tarifas numeric not null default 0,
  valor_creditado numeric not null,
  forma_recebimento text not null default 'credito_bancario',
  referencia_bancaria text,
  documento_operadora text,
  observacoes text,
  status text not null default 'registrado',
  conciliado_em timestamptz,
  conciliado_por uuid references auth.users(id),
  estornado_em timestamptz,
  estornado_por uuid references auth.users(id),
  motivo_estorno text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint financeiro_recebimentos_valor_baixado_check check (valor_baixado > 0),
  constraint financeiro_recebimentos_valores_check check (valor_retencoes >= 0 and valor_tarifas >= 0 and valor_creditado >= 0 and abs(valor_baixado - (valor_creditado + valor_retencoes + valor_tarifas)) <= 0.01),
  constraint financeiro_recebimentos_forma_check check (forma_recebimento in ('credito_bancario','pix','ted','boleto','cheque','dinheiro','outro')),
  constraint financeiro_recebimentos_status_check check (status in ('registrado','conciliado','estornado'))
);
create index if not exists financeiro_recebimentos_recebivel_idx on public.financeiro_recebimentos(recebivel_id,created_at desc);
create index if not exists financeiro_recebimentos_lote_idx on public.financeiro_recebimentos(lote_id) where lote_id is not null;
create unique index if not exists financeiro_recebimentos_referencia_unique on public.financeiro_recebimentos(recebivel_id,referencia_bancaria) where nullif(btrim(referencia_bancaria),'') is not null and status <> 'estornado';
alter table public.financeiro_recebimentos enable row level security;
alter table public.financeiro_recebimentos force row level security;
drop policy if exists financeiro_recebimentos_select on public.financeiro_recebimentos;
create policy financeiro_recebimentos_select on public.financeiro_recebimentos for select to authenticated using (
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'financeiro.visualizar') or
    public.tem_permissao(empresa_id,unidade_id,'financeiro.receber') or
    public.tem_permissao(empresa_id,unidade_id,'financeiro.conciliar') or
    public.tem_permissao(empresa_id,unidade_id,'financeiro.gerenciar')
  )
);
revoke all on public.financeiro_recebimentos from public,anon,authenticated;
grant select on public.financeiro_recebimentos to authenticated;

create or replace function public.recalcular_recebivel_financeiro_internal(p_recebivel_id uuid,p_user uuid default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_r public.financeiro_recebiveis%rowtype; v_total numeric:=0; v_data date; v_status text;
begin
  select * into v_r from public.financeiro_recebiveis where id=p_recebivel_id for update;
  if not found then raise exception 'FIN_RECEBIVEL_NAO_LOCALIZADO'; end if;
  select coalesce(sum(valor_baixado),0),max(data_recebimento) into v_total,v_data from public.financeiro_recebimentos where recebivel_id=v_r.id and status<>'estornado';
  if v_r.status='cancelado' then v_status:='cancelado';
  elsif v_total >= greatest(coalesce(v_r.valor_liquido_previsto,0)-0.01,0) and coalesce(v_r.valor_liquido_previsto,0)>0 then v_status:='recebido';
  elsif v_total>0 then v_status:='parcial';
  elsif v_r.previsao_pagamento is not null and v_r.previsao_pagamento<current_date then v_status:='vencido';
  elsif v_r.status='faturado' then v_status:='faturado';
  else v_status:='aguardando_pagamento'; end if;
  update public.financeiro_recebiveis set valor_recebido=v_total,data_pagamento=case when v_total>0 then v_data else null end,status=v_status,updated_at=now(),updated_by=coalesce(p_user,auth.uid(),updated_by) where id=v_r.id;
  return jsonb_build_object('recebivel_id',v_r.id,'valor_recebido',v_total,'status',v_status,'data_pagamento',v_data);
end $$;
revoke execute on function public.recalcular_recebivel_financeiro_internal(uuid,uuid) from public,anon,authenticated;

create or replace function public.registrar_recebimento_financeiro_operacional(
  p_recebivel_id uuid,p_data_recebimento date,p_valor_baixado numeric,p_valor_retencoes numeric default 0,p_valor_tarifas numeric default 0,p_valor_creditado numeric default null,p_forma_recebimento text default 'credito_bancario',p_referencia_bancaria text default null,p_documento_operadora text default null,p_observacoes text default null
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_r public.financeiro_recebiveis%rowtype; v_id uuid; v_pago numeric:=0; v_saldo numeric; v_creditado numeric;
begin
  if v_user is null then raise exception 'FIN_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_r from public.financeiro_recebiveis where id=p_recebivel_id for update;
  if not found then raise exception 'FIN_RECEBIVEL_NAO_LOCALIZADO'; end if;
  if not public.tem_unidade(v_r.empresa_id,v_r.unidade_id) or not (public.tem_permissao(v_r.empresa_id,v_r.unidade_id,'financeiro.receber') or public.tem_permissao(v_r.empresa_id,v_r.unidade_id,'financeiro.gerenciar')) then raise exception 'FIN_RECEBIMENTO_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_r.status='cancelado' then raise exception 'FIN_RECEBIVEL_CANCELADO'; end if;
  if p_data_recebimento is null or coalesce(p_valor_baixado,0)<=0 or coalesce(p_valor_retencoes,0)<0 or coalesce(p_valor_tarifas,0)<0 then raise exception 'FIN_RECEBIMENTO_DADOS_INVALIDOS'; end if;
  if coalesce(p_forma_recebimento,'') not in ('credito_bancario','pix','ted','boleto','cheque','dinheiro','outro') then raise exception 'FIN_RECEBIMENTO_FORMA_INVALIDA'; end if;
  v_creditado:=coalesce(p_valor_creditado,p_valor_baixado-coalesce(p_valor_retencoes,0)-coalesce(p_valor_tarifas,0));
  if v_creditado<0 or abs(p_valor_baixado-(v_creditado+coalesce(p_valor_retencoes,0)+coalesce(p_valor_tarifas,0)))>0.01 then raise exception 'FIN_RECEBIMENTO_COMPOSICAO_INVALIDA'; end if;
  select coalesce(sum(valor_baixado),0) into v_pago from public.financeiro_recebimentos where recebivel_id=v_r.id and status<>'estornado';
  v_saldo:=greatest(coalesce(v_r.valor_liquido_previsto,0)-v_pago,0);
  if p_valor_baixado>v_saldo+0.01 then raise exception 'FIN_RECEBIMENTO_EXCEDE_SALDO'; end if;
  insert into public.financeiro_recebimentos(empresa_id,unidade_id,recebivel_id,lote_id,data_recebimento,valor_baixado,valor_retencoes,valor_tarifas,valor_creditado,forma_recebimento,referencia_bancaria,documento_operadora,observacoes,status,created_by,updated_by)
  values(v_r.empresa_id,v_r.unidade_id,v_r.id,v_r.lote_id,p_data_recebimento,p_valor_baixado,coalesce(p_valor_retencoes,0),coalesce(p_valor_tarifas,0),v_creditado,p_forma_recebimento,nullif(btrim(p_referencia_bancaria),''),nullif(btrim(p_documento_operadora),''),nullif(btrim(p_observacoes),''),'registrado',v_user,v_user) returning id into v_id;
  perform public.recalcular_recebivel_financeiro_internal(v_r.id,v_user);
  perform public.registrar_integracao_evento_internal(v_r.empresa_id,v_r.unidade_id,null,null,'financeiro.recebimento_registrado','financeiro_recebimentos',v_id,now(),jsonb_build_object('recebivel_id',v_r.id,'lote_id',v_r.lote_id,'valor_baixado',p_valor_baixado,'valor_creditado',v_creditado,'valor_retencoes',coalesce(p_valor_retencoes,0),'valor_tarifas',coalesce(p_valor_tarifas,0)));
  return v_id;
end $$;
revoke execute on function public.registrar_recebimento_financeiro_operacional(uuid,date,numeric,numeric,numeric,numeric,text,text,text,text) from public,anon;
grant execute on function public.registrar_recebimento_financeiro_operacional(uuid,date,numeric,numeric,numeric,numeric,text,text,text,text) to authenticated;

create or replace function public.conciliar_recebimento_financeiro_operacional(p_recebimento_id uuid,p_referencia_bancaria text default null,p_observacoes text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_p public.financeiro_recebimentos%rowtype;
begin
  if v_user is null then raise exception 'FIN_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_p from public.financeiro_recebimentos where id=p_recebimento_id for update;
  if not found then raise exception 'FIN_RECEBIMENTO_NAO_LOCALIZADO'; end if;
  if not public.tem_unidade(v_p.empresa_id,v_p.unidade_id) or not (public.tem_permissao(v_p.empresa_id,v_p.unidade_id,'financeiro.conciliar') or public.tem_permissao(v_p.empresa_id,v_p.unidade_id,'financeiro.gerenciar')) then raise exception 'FIN_CONCILIACAO_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_p.status='estornado' then raise exception 'FIN_RECEBIMENTO_ESTORNADO'; end if;
  if v_p.status='conciliado' then return v_p.id; end if;
  update public.financeiro_recebimentos set status='conciliado',referencia_bancaria=coalesce(nullif(btrim(p_referencia_bancaria),''),referencia_bancaria),observacoes=coalesce(nullif(btrim(p_observacoes),''),observacoes),conciliado_em=now(),conciliado_por=v_user,updated_at=now(),updated_by=v_user where id=v_p.id;
  perform public.registrar_integracao_evento_internal(v_p.empresa_id,v_p.unidade_id,null,null,'financeiro.recebimento_conciliado','financeiro_recebimentos',v_p.id,now(),jsonb_build_object('recebivel_id',v_p.recebivel_id,'lote_id',v_p.lote_id,'valor_baixado',v_p.valor_baixado));
  return v_p.id;
end $$;
revoke execute on function public.conciliar_recebimento_financeiro_operacional(uuid,text,text) from public,anon;
grant execute on function public.conciliar_recebimento_financeiro_operacional(uuid,text,text) to authenticated;

create or replace function public.estornar_recebimento_financeiro_operacional(p_recebimento_id uuid,p_motivo text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_p public.financeiro_recebimentos%rowtype;
begin
  if v_user is null then raise exception 'FIN_NAO_AUTENTICADO' using errcode='42501'; end if;
  if coalesce(btrim(p_motivo),'')='' then raise exception 'FIN_ESTORNO_MOTIVO_OBRIGATORIO'; end if;
  select * into v_p from public.financeiro_recebimentos where id=p_recebimento_id for update;
  if not found then raise exception 'FIN_RECEBIMENTO_NAO_LOCALIZADO'; end if;
  if not public.tem_unidade(v_p.empresa_id,v_p.unidade_id) or not public.tem_permissao(v_p.empresa_id,v_p.unidade_id,'financeiro.gerenciar') then raise exception 'FIN_ESTORNO_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_p.status='estornado' then return v_p.id; end if;
  update public.financeiro_recebimentos set status='estornado',estornado_em=now(),estornado_por=v_user,motivo_estorno=btrim(p_motivo),updated_at=now(),updated_by=v_user where id=v_p.id;
  perform public.recalcular_recebivel_financeiro_internal(v_p.recebivel_id,v_user);
  perform public.registrar_integracao_evento_internal(v_p.empresa_id,v_p.unidade_id,null,null,'financeiro.recebimento_estornado','financeiro_recebimentos',v_p.id,now(),jsonb_build_object('recebivel_id',v_p.recebivel_id,'lote_id',v_p.lote_id,'valor_baixado',v_p.valor_baixado,'motivo',btrim(p_motivo)));
  return v_p.id;
end $$;
revoke execute on function public.estornar_recebimento_financeiro_operacional(uuid,text) from public,anon;
grant execute on function public.estornar_recebimento_financeiro_operacional(uuid,text) to authenticated;

create or replace function public.salvar_configuracao_nfse_operacional(
  p_unidade_id uuid,p_municipio_ibge text,p_municipio_nome text,p_uf text,p_provedor text,p_modo text,p_ambiente text,p_endpoint_url text,p_wsdl_url text,p_versao text,p_codigo_servico_municipal text,p_item_lista_servico text,p_codigo_tributacao_municipio text,p_inscricao_municipal text,p_auth_tipo text,p_auth_usuario_ref text,p_auth_segredo_ref text,p_certificado_ref text
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_empresa uuid; v_id uuid;
begin
  if v_user is null then raise exception 'NFSE_NAO_AUTENTICADO' using errcode='42501'; end if;
  select empresa_id into v_empresa from public.unidades where id=p_unidade_id and ativo;
  if v_empresa is null or not public.tem_unidade(v_empresa,p_unidade_id) or not (public.tem_permissao(v_empresa,p_unidade_id,'nfse.configurar') or public.tem_permissao(v_empresa,p_unidade_id,'nfse.gerenciar')) then raise exception 'NFSE_CONFIG_SEM_PERMISSAO' using errcode='42501'; end if;
  if coalesce(btrim(p_municipio_ibge),'')='' or coalesce(btrim(p_municipio_nome),'')='' or length(btrim(coalesce(p_uf,'')))<>2 then raise exception 'NFSE_CONFIG_DADOS_INVALIDOS'; end if;
  if coalesce(p_modo,'manual') not in ('manual','webservice','api') or coalesce(p_ambiente,'homologacao') not in ('homologacao','producao') or coalesce(p_auth_tipo,'nenhuma') not in ('nenhuma','basic','bearer','header','mtls') then raise exception 'NFSE_CONFIG_DOMINIO_INVALIDO'; end if;
  select id into v_id from public.nfse_configuracoes where empresa_id=v_empresa and coalesce(unidade_id,'00000000-0000-0000-0000-000000000000'::uuid)=coalesce(p_unidade_id,'00000000-0000-0000-0000-000000000000'::uuid) and municipio_ibge=btrim(p_municipio_ibge) and ambiente=p_ambiente limit 1 for update;
  if v_id is null then
    insert into public.nfse_configuracoes(empresa_id,unidade_id,municipio_ibge,municipio_nome,uf,provedor,modo,ambiente,endpoint_url,wsdl_url,versao,codigo_servico_municipal,item_lista_servico,codigo_tributacao_municipio,inscricao_municipal,auth_tipo,auth_usuario_ref,auth_segredo_ref,certificado_ref,ativo,created_by,updated_by)
    values(v_empresa,p_unidade_id,btrim(p_municipio_ibge),btrim(p_municipio_nome),upper(btrim(p_uf)),nullif(btrim(p_provedor),''),coalesce(nullif(btrim(p_modo),''),'manual'),coalesce(nullif(btrim(p_ambiente),''),'homologacao'),nullif(btrim(p_endpoint_url),''),nullif(btrim(p_wsdl_url),''),nullif(btrim(p_versao),''),nullif(btrim(p_codigo_servico_municipal),''),nullif(btrim(p_item_lista_servico),''),nullif(btrim(p_codigo_tributacao_municipio),''),nullif(btrim(p_inscricao_municipal),''),coalesce(nullif(btrim(p_auth_tipo),''),'nenhuma'),nullif(btrim(p_auth_usuario_ref),''),nullif(btrim(p_auth_segredo_ref),''),nullif(btrim(p_certificado_ref),''),true,v_user,v_user) returning id into v_id;
  else
    update public.nfse_configuracoes set municipio_nome=btrim(p_municipio_nome),uf=upper(btrim(p_uf)),provedor=nullif(btrim(p_provedor),''),modo=coalesce(nullif(btrim(p_modo),''),'manual'),endpoint_url=nullif(btrim(p_endpoint_url),''),wsdl_url=nullif(btrim(p_wsdl_url),''),versao=nullif(btrim(p_versao),''),codigo_servico_municipal=nullif(btrim(p_codigo_servico_municipal),''),item_lista_servico=nullif(btrim(p_item_lista_servico),''),codigo_tributacao_municipio=nullif(btrim(p_codigo_tributacao_municipio),''),inscricao_municipal=nullif(btrim(p_inscricao_municipal),''),auth_tipo=coalesce(nullif(btrim(p_auth_tipo),''),'nenhuma'),auth_usuario_ref=nullif(btrim(p_auth_usuario_ref),''),auth_segredo_ref=nullif(btrim(p_auth_segredo_ref),''),certificado_ref=nullif(btrim(p_certificado_ref),''),ativo=true,updated_at=now(),updated_by=v_user where id=v_id;
  end if;
  return v_id;
end $$;
revoke execute on function public.salvar_configuracao_nfse_operacional(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.salvar_configuracao_nfse_operacional(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;

create or replace function public.criar_nfse_lote_operacional(p_lote_id uuid,p_numero_rps text default null,p_serie_rps text default null,p_aliquota_iss numeric default null,p_valor_iss numeric default 0,p_valor_deducoes numeric default 0)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_l public.tiss_lotes%rowtype; v_conv public.convenios%rowtype; v_cfg uuid; v_id uuid; v_valor numeric;
begin
  if v_user is null then raise exception 'NFSE_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_l from public.tiss_lotes where id=p_lote_id for update;
  if not found then raise exception 'NFSE_LOTE_NAO_LOCALIZADO'; end if;
  if not public.tem_unidade(v_l.empresa_id,v_l.unidade_id) or not (public.tem_permissao(v_l.empresa_id,v_l.unidade_id,'nfse.emitir') or public.tem_permissao(v_l.empresa_id,v_l.unidade_id,'nfse.gerenciar')) then raise exception 'NFSE_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_l.status not in ('enviado','protocolado','aceito') then raise exception 'NFSE_LOTE_NAO_ELEGIVEL'; end if;
  if coalesce(p_valor_iss,0)<0 or coalesce(p_valor_deducoes,0)<0 or coalesce(p_valor_iss,0)+coalesce(p_valor_deducoes,0)>coalesce(v_l.valor_total,0)+0.01 then raise exception 'NFSE_VALORES_INVALIDOS'; end if;
  select id into v_id from public.notas_fiscais_servico where lote_id=v_l.id and status<>'cancelada' order by created_at desc limit 1 for update;
  if v_id is not null then return v_id; end if;
  select * into v_conv from public.convenios where id=v_l.convenio_id;
  select id into v_cfg from public.nfse_configuracoes where empresa_id=v_l.empresa_id and coalesce(unidade_id,v_l.unidade_id)=v_l.unidade_id and ativo order by (unidade_id is not null) desc,created_at desc limit 1;
  v_valor:=coalesce(v_l.valor_total,0);
  insert into public.notas_fiscais_servico(empresa_id,unidade_id,lote_id,convenio_id,configuracao_id,competencia,tomador_cnpj,tomador_razao_social,valor_servicos,valor_deducoes,valor_iss,aliquota_iss,valor_liquido,numero_rps,serie_rps,status,created_by,updated_by)
  values(v_l.empresa_id,v_l.unidade_id,v_l.id,v_l.convenio_id,v_cfg,v_l.competencia,v_conv.cnpj,coalesce(v_conv.razao_social,v_conv.nome_fantasia),v_valor,coalesce(p_valor_deducoes,0),coalesce(p_valor_iss,0),p_aliquota_iss,greatest(v_valor-coalesce(p_valor_deducoes,0)-coalesce(p_valor_iss,0),0),nullif(btrim(p_numero_rps),''),nullif(btrim(p_serie_rps),''),'rascunho',v_user,v_user) returning id into v_id;
  perform public.registrar_integracao_evento_internal(v_l.empresa_id,v_l.unidade_id,null,null,'nfse.rascunho_criado','notas_fiscais_servico',v_id,now(),jsonb_build_object('lote_id',v_l.id,'competencia',v_l.competencia,'valor_servicos',v_valor));
  return v_id;
end $$;
revoke execute on function public.criar_nfse_lote_operacional(uuid,text,text,numeric,numeric,numeric) from public,anon;
grant execute on function public.criar_nfse_lote_operacional(uuid,text,text,numeric,numeric,numeric) to authenticated;

create or replace function public.registrar_estado_nfse_operacional(p_nota_id uuid,p_status text,p_numero_nfse text default null,p_codigo_verificacao text default null,p_protocolo_prefeitura text default null,p_xml_retorno text default null,p_data_emissao timestamptz default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_n public.notas_fiscais_servico%rowtype;
begin
  if v_user is null then raise exception 'NFSE_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_n from public.notas_fiscais_servico where id=p_nota_id for update;
  if not found then raise exception 'NFSE_NOTA_NAO_LOCALIZADA'; end if;
  if not public.tem_unidade(v_n.empresa_id,v_n.unidade_id) or not (public.tem_permissao(v_n.empresa_id,v_n.unidade_id,'nfse.emitir') or public.tem_permissao(v_n.empresa_id,v_n.unidade_id,'nfse.gerenciar')) then raise exception 'NFSE_SEM_PERMISSAO' using errcode='42501'; end if;
  if p_status not in ('rascunho','pronta','enviando','emitida','rejeitada','cancelada','erro') then raise exception 'NFSE_STATUS_INVALIDO'; end if;
  if p_status='emitida' and coalesce(btrim(p_numero_nfse),'')='' and coalesce(btrim(v_n.numero_nfse),'')='' then raise exception 'NFSE_NUMERO_OBRIGATORIO'; end if;
  update public.notas_fiscais_servico set status=p_status,numero_nfse=coalesce(nullif(btrim(p_numero_nfse),''),numero_nfse),codigo_verificacao=coalesce(nullif(btrim(p_codigo_verificacao),''),codigo_verificacao),protocolo_prefeitura=coalesce(nullif(btrim(p_protocolo_prefeitura),''),protocolo_prefeitura),xml_retorno=coalesce(p_xml_retorno,xml_retorno),data_emissao=case when p_status='emitida' then coalesce(p_data_emissao,data_emissao,now()) else data_emissao end,updated_at=now(),updated_by=v_user where id=v_n.id;
  if p_status='emitida' and v_n.lote_id is not null then
    update public.financeiro_recebiveis set status=case when status in ('recebido','parcial','cancelado') then status else 'aguardando_pagamento' end,updated_at=now(),updated_by=v_user where lote_id=v_n.lote_id;
    if v_n.status is distinct from 'emitida' then perform public.registrar_integracao_evento_internal(v_n.empresa_id,v_n.unidade_id,null,null,'nfse.emitida','notas_fiscais_servico',v_n.id,now(),jsonb_build_object('lote_id',v_n.lote_id,'numero_nfse',coalesce(nullif(btrim(p_numero_nfse),''),v_n.numero_nfse),'valor_liquido',v_n.valor_liquido)); end if;
  end if;
  return v_n.id;
end $$;
revoke execute on function public.registrar_estado_nfse_operacional(uuid,text,text,text,text,text,timestamptz) from public,anon;
grant execute on function public.registrar_estado_nfse_operacional(uuid,text,text,text,text,text,timestamptz) to authenticated;

create or replace function public.registrar_transacao_nfse_operacional(p_nota_id uuid,p_tipo_operacao text,p_status text,p_http_status integer default null,p_protocolo text default null,p_mensagem_erro text default null,p_request_payload text default null,p_response_payload text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_n public.notas_fiscais_servico%rowtype; v_id uuid;
begin
  if v_user is null then raise exception 'NFSE_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_n from public.notas_fiscais_servico where id=p_nota_id;
  if not found then raise exception 'NFSE_NOTA_NAO_LOCALIZADA'; end if;
  if not public.tem_unidade(v_n.empresa_id,v_n.unidade_id) or not (public.tem_permissao(v_n.empresa_id,v_n.unidade_id,'nfse.emitir') or public.tem_permissao(v_n.empresa_id,v_n.unidade_id,'nfse.gerenciar')) then raise exception 'NFSE_SEM_PERMISSAO' using errcode='42501'; end if;
  insert into public.nfse_transacoes(nota_id,configuracao_id,tipo_operacao,status,http_status,protocolo,mensagem_erro,request_payload,response_payload)
  values(v_n.id,v_n.configuracao_id,btrim(p_tipo_operacao),btrim(p_status),p_http_status,nullif(btrim(p_protocolo),''),nullif(p_mensagem_erro,''),p_request_payload,p_response_payload) returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.registrar_transacao_nfse_operacional(uuid,text,text,integer,text,text,text,text) from public,anon;
grant execute on function public.registrar_transacao_nfse_operacional(uuid,text,text,integer,text,text,text,text) to authenticated;

-- Endurece as tabelas existentes: leitura por RBAC, escrita somente via RPCs operacionais.
drop policy if exists financeiro_recebiveis_all on public.financeiro_recebiveis;
drop policy if exists financeiro_recebiveis_select on public.financeiro_recebiveis;
create policy financeiro_recebiveis_select on public.financeiro_recebiveis for select to authenticated using (public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'financeiro.visualizar') or public.tem_permissao(empresa_id,unidade_id,'financeiro.receber') or public.tem_permissao(empresa_id,unidade_id,'financeiro.conciliar') or public.tem_permissao(empresa_id,unidade_id,'financeiro.gerenciar') or public.tem_permissao(empresa_id,unidade_id,'nfse.emitir') or public.tem_permissao(empresa_id,unidade_id,'nfse.gerenciar')));
revoke insert,update,delete on public.financeiro_recebiveis from authenticated;
grant select on public.financeiro_recebiveis to authenticated;

drop policy if exists notas_fiscais_servico_all on public.notas_fiscais_servico;
drop policy if exists notas_fiscais_servico_select on public.notas_fiscais_servico;
create policy notas_fiscais_servico_select on public.notas_fiscais_servico for select to authenticated using (public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'nfse.visualizar') or public.tem_permissao(empresa_id,unidade_id,'nfse.emitir') or public.tem_permissao(empresa_id,unidade_id,'nfse.gerenciar') or public.tem_permissao(empresa_id,unidade_id,'financeiro.visualizar') or public.tem_permissao(empresa_id,unidade_id,'financeiro.gerenciar')));
revoke insert,update,delete on public.notas_fiscais_servico from authenticated;
grant select on public.notas_fiscais_servico to authenticated;

drop policy if exists nfse_transacoes_all on public.nfse_transacoes;
drop policy if exists nfse_transacoes_select on public.nfse_transacoes;
create policy nfse_transacoes_select on public.nfse_transacoes for select to authenticated using (exists(select 1 from public.notas_fiscais_servico n where n.id=nfse_transacoes.nota_id and public.tem_unidade(n.empresa_id,n.unidade_id) and (public.tem_permissao(n.empresa_id,n.unidade_id,'nfse.visualizar') or public.tem_permissao(n.empresa_id,n.unidade_id,'nfse.emitir') or public.tem_permissao(n.empresa_id,n.unidade_id,'nfse.gerenciar'))));
revoke insert,update,delete on public.nfse_transacoes from authenticated;
grant select on public.nfse_transacoes to authenticated;

drop policy if exists nfse_configuracoes_all on public.nfse_configuracoes;
drop policy if exists nfse_configuracoes_select on public.nfse_configuracoes;
create policy nfse_configuracoes_select on public.nfse_configuracoes for select to authenticated using (public.tem_empresa(empresa_id) and (unidade_id is null or public.tem_unidade(empresa_id,unidade_id)) and (unidade_id is null or public.tem_permissao(empresa_id,unidade_id,'nfse.visualizar') or public.tem_permissao(empresa_id,unidade_id,'nfse.configurar') or public.tem_permissao(empresa_id,unidade_id,'nfse.emitir') or public.tem_permissao(empresa_id,unidade_id,'nfse.gerenciar')));
revoke insert,update,delete on public.nfse_configuracoes from authenticated;
grant select on public.nfse_configuracoes to authenticated;

create or replace function public.reconciliar_pendencias_financeiro_recebimentos_internal(p_empresa_id uuid,p_unidade_id uuid,p_resolvida_por uuid default null)
returns jsonb language plpgsql security definer set search_path=''
as $$declare v_resolvidas integer:=0; v_abertas integer:=0; begin
  insert into public.integracao_pendencias(empresa_id,unidade_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select r.empresa_id,r.unidade_id,'recebivel_valor_recebido_divergente','financeiro_recebiveis',r.id,'financeiro','financeiro','critica','Valor recebido diverge do ledger de baixas','O agregado do recebível diverge da soma dos recebimentos não estornados.',jsonb_build_object('recebivel_id',r.id,'valor_recebido',r.valor_recebido,'soma_ledger',coalesce(p.total,0))
  from public.financeiro_recebiveis r left join lateral (select sum(x.valor_baixado) total from public.financeiro_recebimentos x where x.recebivel_id=r.id and x.status<>'estornado') p on true
  where r.empresa_id=p_empresa_id and r.unidade_id=p_unidade_id and abs(coalesce(r.valor_recebido,0)-coalesce(p.total,0))>0.01 on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select r.empresa_id,r.unidade_id,'recebivel_vencido_em_aberto','financeiro_recebiveis',r.id,'financeiro','financeiro','alta','Recebível vencido em aberto','A previsão de pagamento já passou e o valor baixado ainda é inferior ao líquido previsto.',jsonb_build_object('recebivel_id',r.id,'previsao_pagamento',r.previsao_pagamento,'valor_liquido_previsto',r.valor_liquido_previsto,'valor_recebido',r.valor_recebido)
  from public.financeiro_recebiveis r where r.empresa_id=p_empresa_id and r.unidade_id=p_unidade_id and r.previsao_pagamento<current_date and r.status not in ('recebido','cancelado') and coalesce(r.valor_recebido,0)<coalesce(r.valor_liquido_previsto,0)-0.01 on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select r.empresa_id,r.unidade_id,'recebivel_recebido_sem_conciliacao','financeiro_recebiveis',r.id,'financeiro','financeiro','media','Recebimento concluído com baixa ainda não conciliada','O recebível está integralmente baixado, mas existe recebimento ainda não conciliado.',jsonb_build_object('recebivel_id',r.id,'valor_recebido',r.valor_recebido)
  from public.financeiro_recebiveis r where r.empresa_id=p_empresa_id and r.unidade_id=p_unidade_id and r.status='recebido' and exists(select 1 from public.financeiro_recebimentos p where p.recebivel_id=r.id and p.status='registrado') on conflict do nothing;

  update public.integracao_pendencias x set status='resolvida',resolvida_em=now(),resolvida_por=p_resolvida_por,updated_at=now()
  where x.empresa_id=p_empresa_id and x.unidade_id=p_unidade_id and x.status='aberta' and (
    (x.regra_chave='recebivel_valor_recebido_divergente' and not exists(select 1 from public.financeiro_recebiveis r left join lateral (select sum(p.valor_baixado) total from public.financeiro_recebimentos p where p.recebivel_id=r.id and p.status<>'estornado') q on true where r.id=x.origem_id and abs(coalesce(r.valor_recebido,0)-coalesce(q.total,0))>0.01)) or
    (x.regra_chave='recebivel_vencido_em_aberto' and not exists(select 1 from public.financeiro_recebiveis r where r.id=x.origem_id and r.previsao_pagamento<current_date and r.status not in ('recebido','cancelado') and coalesce(r.valor_recebido,0)<coalesce(r.valor_liquido_previsto,0)-0.01)) or
    (x.regra_chave='recebivel_recebido_sem_conciliacao' and not exists(select 1 from public.financeiro_recebiveis r where r.id=x.origem_id and r.status='recebido' and exists(select 1 from public.financeiro_recebimentos p where p.recebivel_id=r.id and p.status='registrado')))
  );
  get diagnostics v_resolvidas=row_count;
  select count(*) into v_abertas from public.integracao_pendencias where empresa_id=p_empresa_id and unidade_id=p_unidade_id and status='aberta' and regra_chave in ('recebivel_valor_recebido_divergente','recebivel_vencido_em_aberto','recebivel_recebido_sem_conciliacao');
  return jsonb_build_object('abertas_financeiro_recebimentos',v_abertas,'resolvidas_nesta_execucao',v_resolvidas);
end $$;
revoke execute on function public.reconciliar_pendencias_financeiro_recebimentos_internal(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.reconciliar_pendencias_integracao(p_empresa_id uuid,p_unidade_id uuid,p_atendimento_id uuid default null)
returns jsonb language plpgsql security definer set search_path='public','pg_catalog'
as $$declare v_cir jsonb; v_med jsonb; v_int jsonb; v_fat jsonb; v_fin jsonb; v_base jsonb; v_resolvidas integer; begin
  if auth.uid() is null then raise exception 'INTEGRACAO_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  if not public.tem_unidade(p_empresa_id,p_unidade_id) then raise exception 'INTEGRACAO_UNIDADE_FORA_ESCOPO' using errcode='42501'; end if;
  if not public.tem_permissao(p_empresa_id,p_unidade_id,'integracao.reconciliar') then raise exception 'INTEGRACAO_SEM_PERMISSAO' using errcode='42501'; end if;
  if p_atendimento_id is not null and not exists(select 1 from public.atendimentos a where a.id=p_atendimento_id and a.empresa_id=p_empresa_id and a.unidade_id=p_unidade_id) then raise exception 'INTEGRACAO_ATENDIMENTO_FORA_ESCOPO' using errcode='42501'; end if;
  v_cir:=public.reconciliar_pendencias_cirurgia_estoque_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_med:=public.reconciliar_pendencias_medicamentos_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_int:=public.reconciliar_pendencias_internacao_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_fat:=public.reconciliar_pendencias_faturamento_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_fin:=case when p_atendimento_id is null then public.reconciliar_pendencias_financeiro_recebimentos_internal(p_empresa_id,p_unidade_id,auth.uid()) else jsonb_build_object('abertas_financeiro_recebimentos',0,'resolvidas_nesta_execucao',0) end;
  v_base:=public.reconciliar_pendencias_integracao_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_resolvidas:=coalesce((v_cir->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_med->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_int->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_fat->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_fin->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_base->>'resolvidas_nesta_execucao')::integer,0);
  return jsonb_build_object('abertas',coalesce((v_base->>'abertas')::integer,0),'resolvidas_nesta_execucao',v_resolvidas,'abertas_medicamentos',coalesce((v_med->>'abertas_medicamentos')::integer,0),'abertas_cirurgia_estoque',coalesce((v_cir->>'abertas_cirurgia_estoque')::integer,0),'abertas_internacao',coalesce((v_int->>'abertas_internacao')::integer,0),'abertas_faturamento',coalesce((v_fat->>'abertas_faturamento')::integer,0),'abertas_financeiro_recebimentos',coalesce((v_fin->>'abertas_financeiro_recebimentos')::integer,0));
end $$;