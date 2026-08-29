insert into public.permissoes(codigo,descricao,ativo)
values('financeiro.pagar','Registrar pagamentos de contas a pagar',true)
on conflict (codigo) do update set descricao=excluded.descricao,ativo=true,updated_at=now();

create table if not exists public.financeiro_contas_financeiras(
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete restrict,
  unidade_id uuid not null references public.unidades(id) on delete restrict,
  nome text not null,
  tipo text not null default 'conta_corrente',
  banco_codigo text null,
  banco_nome text null,
  agencia text null,
  conta text null,
  chave_pix text null,
  observacoes text null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  constraint financeiro_contas_financeiras_tipo_check check(tipo in ('conta_corrente','poupanca','caixa','carteira_digital','outro')),
  constraint financeiro_contas_financeiras_nome_check check(length(btrim(nome))>0)
);
create index if not exists idx_financeiro_contas_financeiras_escopo on public.financeiro_contas_financeiras(empresa_id,unidade_id,ativo,nome);

alter table public.financeiro_contas_pagar
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid null references auth.users(id);
alter table public.financeiro_contas_pagar drop constraint if exists financeiro_contas_pagar_valores_check;
alter table public.financeiro_contas_pagar add constraint financeiro_contas_pagar_valores_check check(valor_bruto>=0 and descontos>=0 and acrescimos>=0 and valor_pago>=0);

create table if not exists public.financeiro_pagamentos(
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete restrict,
  unidade_id uuid not null references public.unidades(id) on delete restrict,
  conta_pagar_id uuid not null references public.financeiro_contas_pagar(id) on delete restrict,
  conta_financeira_id uuid not null references public.financeiro_contas_financeiras(id) on delete restrict,
  data_pagamento date not null,
  valor_pago numeric not null,
  valor_desconto numeric not null default 0,
  valor_acrescimo numeric not null default 0,
  forma_pagamento text not null default 'pix',
  referencia_bancaria text null,
  documento_pagamento text null,
  observacoes text null,
  status text not null default 'registrado',
  conciliado_em timestamptz null,
  conciliado_por uuid null references auth.users(id),
  estornado_em timestamptz null,
  estornado_por uuid null references auth.users(id),
  motivo_estorno text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  constraint financeiro_pagamentos_valores_check check(valor_pago>=0 and valor_desconto>=0 and valor_acrescimo>=0 and (valor_pago+valor_desconto)>0),
  constraint financeiro_pagamentos_forma_check check(forma_pagamento in ('pix','ted','boleto','debito_conta','cheque','dinheiro','cartao','outro')),
  constraint financeiro_pagamentos_status_check check(status in ('registrado','conciliado','estornado'))
);
create index if not exists idx_financeiro_pagamentos_conta on public.financeiro_pagamentos(conta_pagar_id,status,data_pagamento);
create index if not exists idx_financeiro_pagamentos_conta_financeira on public.financeiro_pagamentos(conta_financeira_id,status,data_pagamento);

alter table public.financeiro_recebimentos add column if not exists conta_financeira_id uuid null references public.financeiro_contas_financeiras(id) on delete restrict;
create index if not exists idx_financeiro_recebimentos_conta_financeira on public.financeiro_recebimentos(conta_financeira_id,status,data_recebimento) where conta_financeira_id is not null;

alter table public.financeiro_contas_financeiras enable row level security;
alter table public.financeiro_contas_financeiras force row level security;
drop policy if exists financeiro_contas_financeiras_select on public.financeiro_contas_financeiras;
create policy financeiro_contas_financeiras_select on public.financeiro_contas_financeiras for select to authenticated using(
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'financeiro.visualizar') or public.tem_permissao(empresa_id,unidade_id,'financeiro.gerenciar') or
    public.tem_permissao(empresa_id,unidade_id,'financeiro.receber') or public.tem_permissao(empresa_id,unidade_id,'financeiro.pagar') or public.tem_permissao(empresa_id,unidade_id,'financeiro.conciliar')
  )
);
grant select on public.financeiro_contas_financeiras to authenticated;
revoke insert,update,delete on public.financeiro_contas_financeiras from anon,authenticated;

alter table public.financeiro_contas_pagar enable row level security;
alter table public.financeiro_contas_pagar force row level security;
drop policy if exists financeiro_contas_pagar_all on public.financeiro_contas_pagar;
drop policy if exists financeiro_contas_pagar_select on public.financeiro_contas_pagar;
create policy financeiro_contas_pagar_select on public.financeiro_contas_pagar for select to authenticated using(
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'financeiro.visualizar') or public.tem_permissao(empresa_id,unidade_id,'financeiro.gerenciar') or
    public.tem_permissao(empresa_id,unidade_id,'financeiro.pagar') or public.tem_permissao(empresa_id,unidade_id,'financeiro.conciliar')
  )
);
grant select on public.financeiro_contas_pagar to authenticated;
revoke insert,update,delete on public.financeiro_contas_pagar from anon,authenticated;

alter table public.financeiro_pagamentos enable row level security;
alter table public.financeiro_pagamentos force row level security;
drop policy if exists financeiro_pagamentos_select on public.financeiro_pagamentos;
create policy financeiro_pagamentos_select on public.financeiro_pagamentos for select to authenticated using(
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'financeiro.visualizar') or public.tem_permissao(empresa_id,unidade_id,'financeiro.gerenciar') or
    public.tem_permissao(empresa_id,unidade_id,'financeiro.pagar') or public.tem_permissao(empresa_id,unidade_id,'financeiro.conciliar')
  )
);
grant select on public.financeiro_pagamentos to authenticated;
revoke insert,update,delete on public.financeiro_pagamentos from anon,authenticated;

create or replace function public.salvar_conta_financeira_operacional(
  p_id uuid,
  p_empresa_id uuid,
  p_unidade_id uuid,
  p_nome text,
  p_tipo text default 'conta_corrente',
  p_banco_codigo text default null,
  p_banco_nome text default null,
  p_agencia text default null,
  p_conta text default null,
  p_chave_pix text default null,
  p_observacoes text default null,
  p_ativo boolean default true
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_id uuid; v_atual public.financeiro_contas_financeiras%rowtype;
begin
  if v_user is null then raise exception 'FIN_NAO_AUTENTICADO' using errcode='42501'; end if;
  if p_empresa_id is null or p_unidade_id is null or coalesce(btrim(p_nome),'')='' then raise exception 'FIN_CONTA_DADOS_INVALIDOS'; end if;
  if not public.tem_unidade(p_empresa_id,p_unidade_id) or not public.tem_permissao(p_empresa_id,p_unidade_id,'financeiro.gerenciar') then raise exception 'FIN_CONTA_SEM_PERMISSAO' using errcode='42501'; end if;
  if coalesce(p_tipo,'') not in ('conta_corrente','poupanca','caixa','carteira_digital','outro') then raise exception 'FIN_CONTA_TIPO_INVALIDO'; end if;
  if p_id is null then
    insert into public.financeiro_contas_financeiras(empresa_id,unidade_id,nome,tipo,banco_codigo,banco_nome,agencia,conta,chave_pix,observacoes,ativo,created_by,updated_by)
    values(p_empresa_id,p_unidade_id,btrim(p_nome),p_tipo,nullif(btrim(p_banco_codigo),''),nullif(btrim(p_banco_nome),''),nullif(btrim(p_agencia),''),nullif(btrim(p_conta),''),nullif(btrim(p_chave_pix),''),nullif(btrim(p_observacoes),''),coalesce(p_ativo,true),v_user,v_user)
    returning id into v_id;
  else
    select * into v_atual from public.financeiro_contas_financeiras where id=p_id for update;
    if not found then raise exception 'FIN_CONTA_NAO_LOCALIZADA'; end if;
    if v_atual.empresa_id<>p_empresa_id or v_atual.unidade_id<>p_unidade_id then raise exception 'FIN_CONTA_ESCOPO_IMUTAVEL'; end if;
    update public.financeiro_contas_financeiras set nome=btrim(p_nome),tipo=p_tipo,banco_codigo=nullif(btrim(p_banco_codigo),''),banco_nome=nullif(btrim(p_banco_nome),''),agencia=nullif(btrim(p_agencia),''),conta=nullif(btrim(p_conta),''),chave_pix=nullif(btrim(p_chave_pix),''),observacoes=nullif(btrim(p_observacoes),''),ativo=coalesce(p_ativo,true),updated_at=now(),updated_by=v_user where id=p_id;
    v_id:=p_id;
  end if;
  return v_id;
end $function$;

create or replace function public.recalcular_conta_pagar_internal(p_conta_pagar_id uuid,p_user uuid default null)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_c public.financeiro_contas_pagar%rowtype; v_pago numeric:=0; v_desc numeric:=0; v_acr numeric:=0; v_total numeric:=0; v_data date;
begin
  select * into v_c from public.financeiro_contas_pagar where id=p_conta_pagar_id for update;
  if not found then return; end if;
  select coalesce(sum(valor_pago),0),coalesce(sum(valor_desconto),0),coalesce(sum(valor_acrescimo),0),max(data_pagamento)
    into v_pago,v_desc,v_acr,v_data from public.financeiro_pagamentos where conta_pagar_id=v_c.id and status<>'estornado';
  v_total:=greatest(v_c.valor_bruto-v_desc+v_acr,0);
  update public.financeiro_contas_pagar set descontos=v_desc,acrescimos=v_acr,valor_pago=v_pago,
    status=case when status='cancelado' then 'cancelado' when v_total<=0.01 or v_pago>=v_total-0.01 then 'pago' when (v_pago>0 or v_desc>0 or v_acr>0) then 'parcial' else 'aberto' end,
    pago_em=case when (v_total<=0.01 or v_pago>=v_total-0.01) and v_data is not null then (v_data::timestamp at time zone 'America/Sao_Paulo') else null end,
    updated_at=now(),updated_by=p_user
  where id=v_c.id;
end $function$;

create or replace function public.criar_conta_pagar_operacional(
  p_empresa_id uuid,p_unidade_id uuid,p_fornecedor_id uuid,p_documento text,p_competencia text,p_vencimento date,p_valor_bruto numeric,p_observacoes text default null
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'FIN_NAO_AUTENTICADO' using errcode='42501'; end if;
  if not public.tem_unidade(p_empresa_id,p_unidade_id) or not public.tem_permissao(p_empresa_id,p_unidade_id,'financeiro.gerenciar') then raise exception 'FIN_CONTA_PAGAR_SEM_PERMISSAO' using errcode='42501'; end if;
  if coalesce(p_valor_bruto,0)<=0 then raise exception 'FIN_CONTA_PAGAR_VALOR_INVALIDO'; end if;
  if p_fornecedor_id is not null and not exists(select 1 from public.fornecedores f where f.id=p_fornecedor_id and f.empresa_id=p_empresa_id) then raise exception 'FIN_FORNECEDOR_FORA_ESCOPO'; end if;
  insert into public.financeiro_contas_pagar(empresa_id,unidade_id,fornecedor_id,documento,competencia,vencimento,valor_bruto,status,observacoes,created_by,updated_by)
  values(p_empresa_id,p_unidade_id,p_fornecedor_id,nullif(btrim(p_documento),''),nullif(btrim(p_competencia),''),p_vencimento,p_valor_bruto,'aberto',nullif(btrim(p_observacoes),''),v_user,v_user) returning id into v_id;
  perform public.registrar_integracao_evento_internal(p_empresa_id,p_unidade_id,null,null,'financeiro.conta_pagar_criada','financeiro_contas_pagar',v_id,now(),jsonb_build_object('valor_bruto',p_valor_bruto,'vencimento',p_vencimento,'fornecedor_id',p_fornecedor_id));
  return v_id;
end $function$;

create or replace function public.registrar_pagamento_conta_pagar_operacional(
  p_conta_pagar_id uuid,p_conta_financeira_id uuid,p_data_pagamento date,p_valor_pago numeric,p_valor_desconto numeric default 0,p_valor_acrescimo numeric default 0,p_forma_pagamento text default 'pix',p_referencia_bancaria text default null,p_documento_pagamento text default null,p_observacoes text default null
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_c public.financeiro_contas_pagar%rowtype; v_f public.financeiro_contas_financeiras%rowtype; v_id uuid; v_pago numeric:=0; v_desc numeric:=0; v_acr numeric:=0; v_saldo_novo numeric;
begin
  if v_user is null then raise exception 'FIN_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_c from public.financeiro_contas_pagar where id=p_conta_pagar_id for update;
  if not found then raise exception 'FIN_CONTA_PAGAR_NAO_LOCALIZADA'; end if;
  if not public.tem_unidade(v_c.empresa_id,v_c.unidade_id) or not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'financeiro.pagar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'financeiro.gerenciar')) then raise exception 'FIN_PAGAMENTO_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_c.status='cancelado' then raise exception 'FIN_CONTA_PAGAR_CANCELADA'; end if;
  if p_data_pagamento is null or coalesce(p_valor_pago,0)<0 or coalesce(p_valor_desconto,0)<0 or coalesce(p_valor_acrescimo,0)<0 or coalesce(p_valor_pago,0)+coalesce(p_valor_desconto,0)<=0 then raise exception 'FIN_PAGAMENTO_DADOS_INVALIDOS'; end if;
  if coalesce(p_forma_pagamento,'') not in ('pix','ted','boleto','debito_conta','cheque','dinheiro','cartao','outro') then raise exception 'FIN_PAGAMENTO_FORMA_INVALIDA'; end if;
  select * into v_f from public.financeiro_contas_financeiras where id=p_conta_financeira_id for update;
  if not found or not v_f.ativo or v_f.empresa_id<>v_c.empresa_id or v_f.unidade_id<>v_c.unidade_id then raise exception 'FIN_CONTA_FINANCEIRA_INVALIDA'; end if;
  select coalesce(sum(valor_pago),0),coalesce(sum(valor_desconto),0),coalesce(sum(valor_acrescimo),0) into v_pago,v_desc,v_acr from public.financeiro_pagamentos where conta_pagar_id=v_c.id and status<>'estornado';
  v_saldo_novo:=v_c.valor_bruto-(v_desc+coalesce(p_valor_desconto,0))+(v_acr+coalesce(p_valor_acrescimo,0))-(v_pago+coalesce(p_valor_pago,0));
  if v_saldo_novo < -0.01 then raise exception 'FIN_PAGAMENTO_EXCEDE_SALDO'; end if;
  insert into public.financeiro_pagamentos(empresa_id,unidade_id,conta_pagar_id,conta_financeira_id,data_pagamento,valor_pago,valor_desconto,valor_acrescimo,forma_pagamento,referencia_bancaria,documento_pagamento,observacoes,status,created_by,updated_by)
  values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_f.id,p_data_pagamento,coalesce(p_valor_pago,0),coalesce(p_valor_desconto,0),coalesce(p_valor_acrescimo,0),p_forma_pagamento,nullif(btrim(p_referencia_bancaria),''),nullif(btrim(p_documento_pagamento),''),nullif(btrim(p_observacoes),''),'registrado',v_user,v_user) returning id into v_id;
  perform public.recalcular_conta_pagar_internal(v_c.id,v_user);
  perform public.registrar_integracao_evento_internal(v_c.empresa_id,v_c.unidade_id,null,null,'financeiro.pagamento_registrado','financeiro_pagamentos',v_id,now(),jsonb_build_object('conta_pagar_id',v_c.id,'conta_financeira_id',v_f.id,'valor_pago',p_valor_pago,'valor_desconto',coalesce(p_valor_desconto,0),'valor_acrescimo',coalesce(p_valor_acrescimo,0)));
  return v_id;
end $function$;

create or replace function public.conciliar_pagamento_conta_pagar_operacional(p_pagamento_id uuid,p_referencia_bancaria text default null,p_observacoes text default null)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_p public.financeiro_pagamentos%rowtype;
begin
  if v_user is null then raise exception 'FIN_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_p from public.financeiro_pagamentos where id=p_pagamento_id for update;
  if not found then raise exception 'FIN_PAGAMENTO_NAO_LOCALIZADO'; end if;
  if not public.tem_unidade(v_p.empresa_id,v_p.unidade_id) or not (public.tem_permissao(v_p.empresa_id,v_p.unidade_id,'financeiro.conciliar') or public.tem_permissao(v_p.empresa_id,v_p.unidade_id,'financeiro.gerenciar')) then raise exception 'FIN_CONCILIACAO_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_p.status='estornado' then raise exception 'FIN_PAGAMENTO_ESTORNADO'; end if;
  if v_p.status='conciliado' then return v_p.id; end if;
  update public.financeiro_pagamentos set status='conciliado',referencia_bancaria=coalesce(nullif(btrim(p_referencia_bancaria),''),referencia_bancaria),observacoes=coalesce(nullif(btrim(p_observacoes),''),observacoes),conciliado_em=now(),conciliado_por=v_user,updated_at=now(),updated_by=v_user where id=v_p.id;
  perform public.registrar_integracao_evento_internal(v_p.empresa_id,v_p.unidade_id,null,null,'financeiro.pagamento_conciliado','financeiro_pagamentos',v_p.id,now(),jsonb_build_object('conta_pagar_id',v_p.conta_pagar_id,'conta_financeira_id',v_p.conta_financeira_id,'valor_pago',v_p.valor_pago));
  return v_p.id;
end $function$;

create or replace function public.estornar_pagamento_conta_pagar_operacional(p_pagamento_id uuid,p_motivo text)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_p public.financeiro_pagamentos%rowtype;
begin
  if v_user is null then raise exception 'FIN_NAO_AUTENTICADO' using errcode='42501'; end if;
  if coalesce(btrim(p_motivo),'')='' then raise exception 'FIN_ESTORNO_MOTIVO_OBRIGATORIO'; end if;
  select * into v_p from public.financeiro_pagamentos where id=p_pagamento_id for update;
  if not found then raise exception 'FIN_PAGAMENTO_NAO_LOCALIZADO'; end if;
  if not public.tem_unidade(v_p.empresa_id,v_p.unidade_id) or not public.tem_permissao(v_p.empresa_id,v_p.unidade_id,'financeiro.gerenciar') then raise exception 'FIN_ESTORNO_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_p.status='estornado' then return v_p.id; end if;
  update public.financeiro_pagamentos set status='estornado',estornado_em=now(),estornado_por=v_user,motivo_estorno=btrim(p_motivo),updated_at=now(),updated_by=v_user where id=v_p.id;
  perform public.recalcular_conta_pagar_internal(v_p.conta_pagar_id,v_user);
  perform public.registrar_integracao_evento_internal(v_p.empresa_id,v_p.unidade_id,null,null,'financeiro.pagamento_estornado','financeiro_pagamentos',v_p.id,now(),jsonb_build_object('conta_pagar_id',v_p.conta_pagar_id,'conta_financeira_id',v_p.conta_financeira_id,'valor_pago',v_p.valor_pago,'motivo',btrim(p_motivo)));
  return v_p.id;
end $function$;

create or replace function public.cancelar_conta_pagar_operacional(p_conta_pagar_id uuid,p_motivo text)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_c public.financeiro_contas_pagar%rowtype;
begin
  if v_user is null then raise exception 'FIN_NAO_AUTENTICADO' using errcode='42501'; end if;
  if coalesce(btrim(p_motivo),'')='' then raise exception 'FIN_CANCELAMENTO_MOTIVO_OBRIGATORIO'; end if;
  select * into v_c from public.financeiro_contas_pagar where id=p_conta_pagar_id for update;
  if not found then raise exception 'FIN_CONTA_PAGAR_NAO_LOCALIZADA'; end if;
  if not public.tem_unidade(v_c.empresa_id,v_c.unidade_id) or not public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'financeiro.gerenciar') then raise exception 'FIN_CANCELAMENTO_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_c.status='cancelado' then return v_c.id; end if;
  if exists(select 1 from public.financeiro_pagamentos p where p.conta_pagar_id=v_c.id and p.status<>'estornado') then raise exception 'FIN_CONTA_PAGAR_COM_PAGAMENTO_ATIVO'; end if;
  update public.financeiro_contas_pagar set status='cancelado',observacoes=concat_ws(E'\n',nullif(observacoes,''),'Cancelada: '||btrim(p_motivo)),updated_at=now(),updated_by=v_user where id=v_c.id;
  return v_c.id;
end $function$;

drop function if exists public.conciliar_recebimento_financeiro_operacional(uuid,text,text);
create function public.conciliar_recebimento_financeiro_operacional(p_recebimento_id uuid,p_referencia_bancaria text default null,p_observacoes text default null,p_conta_financeira_id uuid default null)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_p public.financeiro_recebimentos%rowtype; v_f public.financeiro_contas_financeiras%rowtype;
begin
  if v_user is null then raise exception 'FIN_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_p from public.financeiro_recebimentos where id=p_recebimento_id for update;
  if not found then raise exception 'FIN_RECEBIMENTO_NAO_LOCALIZADO'; end if;
  if not public.tem_unidade(v_p.empresa_id,v_p.unidade_id) or not (public.tem_permissao(v_p.empresa_id,v_p.unidade_id,'financeiro.conciliar') or public.tem_permissao(v_p.empresa_id,v_p.unidade_id,'financeiro.gerenciar')) then raise exception 'FIN_CONCILIACAO_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_p.status='estornado' then raise exception 'FIN_RECEBIMENTO_ESTORNADO'; end if;
  if p_conta_financeira_id is not null then
    select * into v_f from public.financeiro_contas_financeiras where id=p_conta_financeira_id;
    if not found or not v_f.ativo or v_f.empresa_id<>v_p.empresa_id or v_f.unidade_id<>v_p.unidade_id then raise exception 'FIN_CONTA_FINANCEIRA_INVALIDA'; end if;
  end if;
  if v_p.status='conciliado' and (p_conta_financeira_id is null or v_p.conta_financeira_id=p_conta_financeira_id) then return v_p.id; end if;
  update public.financeiro_recebimentos set status='conciliado',conta_financeira_id=coalesce(p_conta_financeira_id,conta_financeira_id),referencia_bancaria=coalesce(nullif(btrim(p_referencia_bancaria),''),referencia_bancaria),observacoes=coalesce(nullif(btrim(p_observacoes),''),observacoes),conciliado_em=coalesce(conciliado_em,now()),conciliado_por=coalesce(conciliado_por,v_user),updated_at=now(),updated_by=v_user where id=v_p.id;
  perform public.registrar_integracao_evento_internal(v_p.empresa_id,v_p.unidade_id,null,null,'financeiro.recebimento_conciliado','financeiro_recebimentos',v_p.id,now(),jsonb_build_object('recebivel_id',v_p.recebivel_id,'lote_id',v_p.lote_id,'valor_baixado',v_p.valor_baixado,'conta_financeira_id',coalesce(p_conta_financeira_id,v_p.conta_financeira_id)));
  return v_p.id;
end $function$;

create or replace function public.reconciliar_pendencias_financeiro_pagamentos_internal(p_empresa_id uuid,p_unidade_id uuid,p_resolvida_por uuid default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_abertas integer:=0; v_resolvidas integer:=0;
begin
  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select p.empresa_id,p.unidade_id,null,null,'pagamento_financeiro_nao_conciliado','financeiro_pagamentos',p.id,'financeiro','financeiro','media','Pagamento registrado ainda não conciliado','Existe uma baixa de conta a pagar registrada, mas ainda não conciliada com a conta financeira.',jsonb_build_object('conta_pagar_id',p.conta_pagar_id,'conta_financeira_id',p.conta_financeira_id,'valor_pago',p.valor_pago,'data_pagamento',p.data_pagamento)
  from public.financeiro_pagamentos p where p.empresa_id=p_empresa_id and p.unidade_id=p_unidade_id and p.status='registrado'
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select c.empresa_id,c.unidade_id,null,null,'conta_pagar_saldo_divergente','financeiro_contas_pagar',c.id,'financeiro','financeiro','alta','Conta a pagar com saldo agregado divergente','Os totais agregados do título não coincidem com o ledger de pagamentos. O título não será reescrito pela Central.',jsonb_build_object('valor_bruto',c.valor_bruto,'valor_pago_agregado',c.valor_pago,'descontos_agregados',c.descontos,'acrescimos_agregados',c.acrescimos)
  from public.financeiro_contas_pagar c
  cross join lateral (select coalesce(sum(p.valor_pago),0) pago,coalesce(sum(p.valor_desconto),0) desconto,coalesce(sum(p.valor_acrescimo),0) acrescimo from public.financeiro_pagamentos p where p.conta_pagar_id=c.id and p.status<>'estornado') x
  where c.empresa_id=p_empresa_id and c.unidade_id=p_unidade_id and (abs(c.valor_pago-x.pago)>0.01 or abs(c.descontos-x.desconto)>0.01 or abs(c.acrescimos-x.acrescimo)>0.01)
  on conflict do nothing;

  update public.integracao_pendencias x set status='resolvida',resolvida_em=now(),resolvida_por=p_resolvida_por,updated_at=now()
  where x.empresa_id=p_empresa_id and x.unidade_id=p_unidade_id and x.status='aberta' and (
    (x.regra_chave='pagamento_financeiro_nao_conciliado' and not exists(select 1 from public.financeiro_pagamentos p where p.id=x.origem_id and p.status='registrado')) or
    (x.regra_chave='conta_pagar_saldo_divergente' and not exists(select 1 from public.financeiro_contas_pagar c cross join lateral (select coalesce(sum(p.valor_pago),0) pago,coalesce(sum(p.valor_desconto),0) desconto,coalesce(sum(p.valor_acrescimo),0) acrescimo from public.financeiro_pagamentos p where p.conta_pagar_id=c.id and p.status<>'estornado') z where c.id=x.origem_id and (abs(c.valor_pago-z.pago)>0.01 or abs(c.descontos-z.desconto)>0.01 or abs(c.acrescimos-z.acrescimo)>0.01)))
  );
  get diagnostics v_resolvidas=row_count;
  select count(*) into v_abertas from public.integracao_pendencias where empresa_id=p_empresa_id and unidade_id=p_unidade_id and status='aberta' and regra_chave in ('pagamento_financeiro_nao_conciliado','conta_pagar_saldo_divergente');
  return jsonb_build_object('abertas_financeiro_pagamentos',v_abertas,'resolvidas_nesta_execucao',v_resolvidas);
end $function$;

alter table public.integracao_eventos drop constraint if exists integracao_eventos_tipo_check;
alter table public.integracao_eventos add constraint integracao_eventos_tipo_check check(tipo_evento in (
'exame.liberado','imagem.executada','laudo.liberado','cirurgia.iniciada','cirurgia.concluida','opme.utilizada','producao.registrada','prescricao.assinada','farmacia.validada','medicamento.dispensado','medicamento.administrado','medicamento.devolvido','estoque.consumo_paciente','internacao.admitida','leito.alocado','leito.transferido','internacao.alta','leito.higienizacao_concluida','conta.auditada','tiss.guia_criada','tiss.guia_pronta','tiss.lote_criado','tiss.lote_protocolado','glosa.registrada','glosa.recurso_criado','financeiro.recebivel_criado','financeiro.recebimento_registrado','financeiro.recebimento_conciliado','financeiro.recebimento_estornado','nfse.rascunho_criado','nfse.emitida','financeiro.conta_pagar_criada','financeiro.pagamento_registrado','financeiro.pagamento_conciliado','financeiro.pagamento_estornado'));

create or replace function public.reconciliar_pendencias_integracao(p_empresa_id uuid,p_unidade_id uuid,p_atendimento_id uuid default null)
returns jsonb language plpgsql security definer set search_path='public','pg_catalog'
as $function$declare v_cir jsonb; v_med jsonb; v_int jsonb; v_fat jsonb; v_fin jsonb; v_pag jsonb; v_base jsonb; v_resolvidas integer; begin
  if auth.uid() is null then raise exception 'INTEGRACAO_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  if not public.tem_unidade(p_empresa_id,p_unidade_id) then raise exception 'INTEGRACAO_UNIDADE_FORA_ESCOPO' using errcode='42501'; end if;
  if not public.tem_permissao(p_empresa_id,p_unidade_id,'integracao.reconciliar') then raise exception 'INTEGRACAO_SEM_PERMISSAO' using errcode='42501'; end if;
  if p_atendimento_id is not null and not exists(select 1 from public.atendimentos a where a.id=p_atendimento_id and a.empresa_id=p_empresa_id and a.unidade_id=p_unidade_id) then raise exception 'INTEGRACAO_ATENDIMENTO_FORA_ESCOPO' using errcode='42501'; end if;
  v_cir:=public.reconciliar_pendencias_cirurgia_estoque_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_med:=public.reconciliar_pendencias_medicamentos_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_int:=public.reconciliar_pendencias_internacao_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_fat:=public.reconciliar_pendencias_faturamento_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_fin:=case when p_atendimento_id is null then public.reconciliar_pendencias_financeiro_recebimentos_internal(p_empresa_id,p_unidade_id,auth.uid()) else jsonb_build_object('abertas_financeiro_recebimentos',0,'resolvidas_nesta_execucao',0) end;
  v_pag:=case when p_atendimento_id is null then public.reconciliar_pendencias_financeiro_pagamentos_internal(p_empresa_id,p_unidade_id,auth.uid()) else jsonb_build_object('abertas_financeiro_pagamentos',0,'resolvidas_nesta_execucao',0) end;
  v_base:=public.reconciliar_pendencias_integracao_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_resolvidas:=coalesce((v_cir->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_med->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_int->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_fat->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_fin->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_pag->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_base->>'resolvidas_nesta_execucao')::integer,0);
  return jsonb_build_object('abertas',coalesce((v_base->>'abertas')::integer,0),'resolvidas_nesta_execucao',v_resolvidas,'abertas_medicamentos',coalesce((v_med->>'abertas_medicamentos')::integer,0),'abertas_cirurgia_estoque',coalesce((v_cir->>'abertas_cirurgia_estoque')::integer,0),'abertas_internacao',coalesce((v_int->>'abertas_internacao')::integer,0),'abertas_faturamento',coalesce((v_fat->>'abertas_faturamento')::integer,0),'abertas_financeiro_recebimentos',coalesce((v_fin->>'abertas_financeiro_recebimentos')::integer,0),'abertas_financeiro_pagamentos',coalesce((v_pag->>'abertas_financeiro_pagamentos')::integer,0));
end $function$;

drop view if exists public.financeiro_fluxo_caixa;
create view public.financeiro_fluxo_caixa with(security_invoker=true) as
select r.empresa_id,r.unidade_id,r.conta_financeira_id,r.data_recebimento as data_movimento,'entrada'::text as natureza,'recebimento'::text as origem_tipo,r.id as origem_id,r.referencia_bancaria as referencia,r.valor_creditado as valor_entrada,0::numeric as valor_saida,r.status
from public.financeiro_recebimentos r where r.status='conciliado' and r.conta_financeira_id is not null
union all
select p.empresa_id,p.unidade_id,p.conta_financeira_id,p.data_pagamento,'saida','pagamento',p.id,p.referencia_bancaria,0::numeric,p.valor_pago,p.status
from public.financeiro_pagamentos p where p.status='conciliado';
grant select on public.financeiro_fluxo_caixa to authenticated;
revoke all on public.financeiro_fluxo_caixa from anon;

revoke execute on function public.salvar_conta_financeira_operacional(uuid,uuid,uuid,text,text,text,text,text,text,text,text,boolean) from public,anon,authenticated;
revoke execute on function public.criar_conta_pagar_operacional(uuid,uuid,uuid,text,text,date,numeric,text) from public,anon,authenticated;
revoke execute on function public.registrar_pagamento_conta_pagar_operacional(uuid,uuid,date,numeric,numeric,numeric,text,text,text,text) from public,anon,authenticated;
revoke execute on function public.conciliar_pagamento_conta_pagar_operacional(uuid,text,text) from public,anon,authenticated;
revoke execute on function public.estornar_pagamento_conta_pagar_operacional(uuid,text) from public,anon,authenticated;
revoke execute on function public.cancelar_conta_pagar_operacional(uuid,text) from public,anon,authenticated;
revoke execute on function public.recalcular_conta_pagar_internal(uuid,uuid) from public,anon,authenticated;
revoke execute on function public.reconciliar_pendencias_financeiro_pagamentos_internal(uuid,uuid,uuid) from public,anon,authenticated;
revoke execute on function public.conciliar_recebimento_financeiro_operacional(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.salvar_conta_financeira_operacional(uuid,uuid,uuid,text,text,text,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.criar_conta_pagar_operacional(uuid,uuid,uuid,text,text,date,numeric,text) to authenticated;
grant execute on function public.registrar_pagamento_conta_pagar_operacional(uuid,uuid,date,numeric,numeric,numeric,text,text,text,text) to authenticated;
grant execute on function public.conciliar_pagamento_conta_pagar_operacional(uuid,text,text) to authenticated;
grant execute on function public.estornar_pagamento_conta_pagar_operacional(uuid,text) to authenticated;
grant execute on function public.cancelar_conta_pagar_operacional(uuid,text) to authenticated;
grant execute on function public.conciliar_recebimento_financeiro_operacional(uuid,text,text,uuid) to authenticated;
