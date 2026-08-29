alter table public.estoque_requisicoes_setoriais
  add column if not exists atendimento_id uuid,
  add column if not exists cirurgia_id uuid;

alter table public.estoque_movimentos
  add column if not exists cirurgia_id uuid,
  add column if not exists cirurgia_opme_id uuid,
  add column if not exists movimento_origem_id uuid,
  add column if not exists requisicao_setorial_id uuid,
  add column if not exists requisicao_setorial_item_id uuid;

alter table public.cirurgia_opme
  add column if not exists item_assistencial_id uuid,
  add column if not exists produto_id uuid,
  add column if not exists estoque_lote_id uuid,
  add column if not exists estoque_movimento_id uuid,
  add column if not exists estoque_estorno_movimento_id uuid;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='estoque_requisicoes_setoriais_atendimento_id_fkey' and conrelid='public.estoque_requisicoes_setoriais'::regclass) then
    alter table public.estoque_requisicoes_setoriais add constraint estoque_requisicoes_setoriais_atendimento_id_fkey foreign key(atendimento_id) references public.atendimentos(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='estoque_requisicoes_setoriais_cirurgia_id_fkey' and conrelid='public.estoque_requisicoes_setoriais'::regclass) then
    alter table public.estoque_requisicoes_setoriais add constraint estoque_requisicoes_setoriais_cirurgia_id_fkey foreign key(cirurgia_id) references public.cirurgias(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='estoque_movimentos_cirurgia_id_fkey' and conrelid='public.estoque_movimentos'::regclass) then
    alter table public.estoque_movimentos add constraint estoque_movimentos_cirurgia_id_fkey foreign key(cirurgia_id) references public.cirurgias(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='estoque_movimentos_cirurgia_opme_id_fkey' and conrelid='public.estoque_movimentos'::regclass) then
    alter table public.estoque_movimentos add constraint estoque_movimentos_cirurgia_opme_id_fkey foreign key(cirurgia_opme_id) references public.cirurgia_opme(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='estoque_movimentos_movimento_origem_id_fkey' and conrelid='public.estoque_movimentos'::regclass) then
    alter table public.estoque_movimentos add constraint estoque_movimentos_movimento_origem_id_fkey foreign key(movimento_origem_id) references public.estoque_movimentos(id) on delete restrict;
  end if;
  if not exists(select 1 from pg_constraint where conname='estoque_movimentos_requisicao_setorial_id_fkey' and conrelid='public.estoque_movimentos'::regclass) then
    alter table public.estoque_movimentos add constraint estoque_movimentos_requisicao_setorial_id_fkey foreign key(requisicao_setorial_id) references public.estoque_requisicoes_setoriais(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='estoque_movimentos_requisicao_setorial_item_id_fkey' and conrelid='public.estoque_movimentos'::regclass) then
    alter table public.estoque_movimentos add constraint estoque_movimentos_requisicao_setorial_item_id_fkey foreign key(requisicao_setorial_item_id) references public.estoque_requisicao_setorial_itens(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='cirurgia_opme_item_assistencial_id_fkey' and conrelid='public.cirurgia_opme'::regclass) then
    alter table public.cirurgia_opme add constraint cirurgia_opme_item_assistencial_id_fkey foreign key(item_assistencial_id) references public.itens_assistenciais(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='cirurgia_opme_produto_id_fkey' and conrelid='public.cirurgia_opme'::regclass) then
    alter table public.cirurgia_opme add constraint cirurgia_opme_produto_id_fkey foreign key(produto_id) references public.estoque_produtos(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='cirurgia_opme_estoque_lote_id_fkey' and conrelid='public.cirurgia_opme'::regclass) then
    alter table public.cirurgia_opme add constraint cirurgia_opme_estoque_lote_id_fkey foreign key(estoque_lote_id) references public.estoque_lotes(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='cirurgia_opme_estoque_movimento_id_fkey' and conrelid='public.cirurgia_opme'::regclass) then
    alter table public.cirurgia_opme add constraint cirurgia_opme_estoque_movimento_id_fkey foreign key(estoque_movimento_id) references public.estoque_movimentos(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='cirurgia_opme_estoque_estorno_movimento_id_fkey' and conrelid='public.cirurgia_opme'::regclass) then
    alter table public.cirurgia_opme add constraint cirurgia_opme_estoque_estorno_movimento_id_fkey foreign key(estoque_estorno_movimento_id) references public.estoque_movimentos(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='cirurgia_opme_status_check' and conrelid='public.cirurgia_opme'::regclass) then
    alter table public.cirurgia_opme add constraint cirurgia_opme_status_check check(status in ('previsto','utilizado','nao_utilizado','cancelado'));
  end if;
  if not exists(select 1 from pg_constraint where conname='cirurgia_opme_utilizado_estoque_check' and conrelid='public.cirurgia_opme'::regclass) then
    alter table public.cirurgia_opme add constraint cirurgia_opme_utilizado_estoque_check check(status<>'utilizado' or (produto_id is not null and estoque_lote_id is not null and estoque_movimento_id is not null));
  end if;
  if not exists(select 1 from pg_constraint where conname='estoque_movimentos_cirurgia_opme_consistencia_check' and conrelid='public.estoque_movimentos'::regclass) then
    alter table public.estoque_movimentos add constraint estoque_movimentos_cirurgia_opme_consistencia_check check(cirurgia_opme_id is null or cirurgia_id is not null);
  end if;
end $$;

create index if not exists idx_estoque_requisicoes_cirurgia on public.estoque_requisicoes_setoriais(cirurgia_id,status,created_at desc) where cirurgia_id is not null;
create index if not exists idx_estoque_requisicoes_atendimento on public.estoque_requisicoes_setoriais(atendimento_id,status,created_at desc) where atendimento_id is not null;
create index if not exists idx_estoque_movimentos_cirurgia on public.estoque_movimentos(cirurgia_id,tipo,created_at desc) where cirurgia_id is not null;
create index if not exists idx_estoque_movimentos_cirurgia_opme on public.estoque_movimentos(cirurgia_opme_id,created_at desc) where cirurgia_opme_id is not null;
create index if not exists idx_estoque_movimentos_origem on public.estoque_movimentos(movimento_origem_id,created_at desc) where movimento_origem_id is not null;
create index if not exists idx_estoque_movimentos_requisicao on public.estoque_movimentos(requisicao_setorial_id,requisicao_setorial_item_id,created_at desc) where requisicao_setorial_id is not null;
create index if not exists idx_cirurgia_opme_estoque on public.cirurgia_opme(cirurgia_id,produto_id,estoque_lote_id,status);
create unique index if not exists ux_cirurgia_opme_produto_serie_utilizada on public.cirurgia_opme(empresa_id,produto_id,serie) where status='utilizado' and produto_id is not null and serie is not null and btrim(serie)<>'';

create or replace function public.centro_cirurgico_registrar_opme_operacional(
  p_cirurgia_id uuid,
  p_item text,
  p_codigo text default null,
  p_fabricante text default null,
  p_lote text default null,
  p_serie text default null,
  p_registro_anvisa text default null,
  p_quantidade numeric default 1,
  p_status text default 'previsto',
  p_observacoes text default null
) returns uuid
language plpgsql security definer
set search_path='public','pg_catalog','extensions'
as $$
declare v_c public.cirurgias%rowtype; v_id uuid; v_prof uuid; v_status text:=lower(coalesce(btrim(p_status),'previsto'));
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_c from public.cirurgias where id=p_cirurgia_id for update;
  if not found then raise exception 'CC_CIRURGIA_NAO_LOCALIZADA'; end if;
  if not public.tem_unidade(v_c.empresa_id,v_c.unidade_id) then raise exception 'CC_UNIDADE_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.operar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar')) then raise exception 'CC_SEM_PERMISSAO_OPERAR' using errcode='42501'; end if;
  if v_c.status in ('concluida','cancelada') then raise exception 'CC_CIRURGIA_ENCERRADA'; end if;
  if coalesce(btrim(p_item),'')='' then raise exception 'CC_OPME_ITEM_OBRIGATORIO'; end if;
  if coalesce(p_quantidade,0)<=0 then raise exception 'CC_OPME_QUANTIDADE_INVALIDA'; end if;
  if v_status not in ('previsto','utilizado','nao_utilizado','cancelado') then raise exception 'CC_OPME_STATUS_INVALIDO'; end if;
  if v_status='utilizado' then raise exception 'CC_OPME_UTILIZADA_EXIGE_ESTOQUE'; end if;
  v_prof:=public.profissional_logado(v_c.empresa_id);
  insert into public.cirurgia_opme(empresa_id,unidade_id,cirurgia_id,atendimento_id,item,codigo,fabricante,lote,serie,registro_anvisa,quantidade,status,utilizado_em,observacoes,created_by,updated_by)
  values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,btrim(p_item),nullif(btrim(p_codigo),''),nullif(btrim(p_fabricante),''),nullif(btrim(p_lote),''),nullif(btrim(p_serie),''),nullif(btrim(p_registro_anvisa),''),p_quantidade,v_status,null,nullif(btrim(p_observacoes),''),auth.uid(),auth.uid()) returning id into v_id;
  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by)
  values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,'opme_planejada',jsonb_build_object('opme_id',v_id,'item',btrim(p_item),'codigo',p_codigo,'lote',p_lote,'serie',p_serie,'status',v_status,'quantidade',p_quantidade),v_prof,auth.uid());
  return v_id;
end $$;

create or replace function public.centro_cirurgico_requisitar_suprimentos_operacional(
  p_cirurgia_id uuid,
  p_local_destino_id uuid,
  p_prioridade text default 'normal',
  p_justificativa text default null,
  p_itens jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer
set search_path='public','pg_catalog','extensions'
as $$
declare
  v_c public.cirurgias%rowtype;
  v_local public.estoque_locais%rowtype;
  v_req uuid;
  v_numero text;
  v_prof uuid;
  v_item jsonb;
  v_prod public.estoque_produtos%rowtype;
  v_qtd numeric;
  v_count integer:=0;
  v_prioridade text:=lower(coalesce(nullif(btrim(p_prioridade),''),'normal'));
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_c from public.cirurgias where id=p_cirurgia_id for update;
  if not found then raise exception 'CC_CIRURGIA_NAO_LOCALIZADA'; end if;
  if not public.tem_unidade(v_c.empresa_id,v_c.unidade_id) then raise exception 'CC_UNIDADE_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.operar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar')) then raise exception 'CC_SEM_PERMISSAO_OPERAR' using errcode='42501'; end if;
  if v_c.status not in ('agendada','em_preparo','em_andamento') then raise exception 'CC_SUPRIMENTO_CIRURGIA_FORA_FLUXO'; end if;
  if v_prioridade not in ('normal','alta','urgente') then raise exception 'CC_SUPRIMENTO_PRIORIDADE_INVALIDA'; end if;
  select * into v_local from public.estoque_locais where id=p_local_destino_id and empresa_id=v_c.empresa_id and unidade_id=v_c.unidade_id and ativo=true;
  if not found then raise exception 'CC_SUPRIMENTO_LOCAL_DESTINO_INVALIDO'; end if;
  if p_itens is null or jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)=0 then raise exception 'CC_SUPRIMENTO_SEM_ITENS'; end if;
  v_prof:=public.profissional_logado(v_c.empresa_id);
  v_numero:='CC-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(extensions.gen_random_uuid()::text,'-',''),1,4));
  insert into public.estoque_requisicoes_setoriais(empresa_id,unidade_id,numero,setor_id,local_destino_id,solicitante_id,prioridade,justificativa,status,atendimento_id,cirurgia_id,created_by,updated_by)
  values(v_c.empresa_id,v_c.unidade_id,v_numero,v_local.setor_id,v_local.id,v_prof,v_prioridade,nullif(btrim(p_justificativa),''),'solicitada',v_c.atendimento_id,v_c.id,auth.uid(),auth.uid()) returning id into v_req;
  for v_item in select value from jsonb_array_elements(p_itens) loop
    if nullif(v_item->>'produto_id','') is null then continue; end if;
    begin v_qtd:=(v_item->>'quantidade')::numeric; exception when others then v_qtd:=null; end;
    if coalesce(v_qtd,0)<=0 then continue; end if;
    select * into v_prod from public.estoque_produtos where id=(v_item->>'produto_id')::uuid and empresa_id=v_c.empresa_id and ativo=true;
    if not found then raise exception 'CC_SUPRIMENTO_PRODUTO_INVALIDO'; end if;
    if v_prod.tipo not in ('material','opme','medicamento','gas_medicinal') then raise exception 'CC_SUPRIMENTO_TIPO_NAO_ASSISTENCIAL'; end if;
    insert into public.estoque_requisicao_setorial_itens(requisicao_id,produto_id,quantidade_solicitada,unidade_medida,observacoes,created_by,updated_by)
    values(v_req,v_prod.id,v_qtd,v_prod.unidade_medida,nullif(btrim(v_item->>'observacoes'),''),auth.uid(),auth.uid());
    v_count:=v_count+1;
  end loop;
  if v_count=0 then delete from public.estoque_requisicoes_setoriais where id=v_req; raise exception 'CC_SUPRIMENTO_SEM_ITENS_VALIDOS'; end if;
  insert into public.estoque_requisicao_setorial_eventos(requisicao_id,evento,detalhe,profissional_id,usuario_id)
  values(v_req,'solicitada',jsonb_build_object('cirurgia_id',v_c.id,'atendimento_id',v_c.atendimento_id,'prioridade',v_prioridade,'local_destino_id',v_local.id),v_prof,auth.uid());
  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by)
  values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,'suprimentos_requisitados',jsonb_build_object('requisicao_id',v_req,'numero',v_numero,'local_destino_id',v_local.id,'itens',v_count),v_prof,auth.uid());
  return v_req;
end $$;

create or replace function public.atender_requisicao_setorial_item(p_item_id uuid,p_estoque_lote_id uuid,p_quantidade numeric)
returns uuid
language plpgsql security definer
set search_path='public','pg_catalog'
as $$
declare
  v_item record;
  v_req record;
  v_lote record;
  v_dest_lote uuid;
  v_dest_quantidade numeric;
  v_dest_custo numeric;
  v_mov uuid;
  v_prof uuid;
  v_restante numeric;
begin
  if auth.uid() is null then raise exception 'USUARIO_NAO_AUTENTICADO' using errcode='42501'; end if;
  if p_quantidade is null or p_quantidade<=0 then raise exception 'QUANTIDADE_INVALIDA'; end if;
  select i.* into v_item from public.estoque_requisicao_setorial_itens i where i.id=p_item_id for update;
  if not found then raise exception 'ITEM_REQUISICAO_NAO_LOCALIZADO'; end if;
  select r.* into v_req from public.estoque_requisicoes_setoriais r where r.id=v_item.requisicao_id for update;
  if not public.tem_permissao(v_req.empresa_id,v_req.unidade_id,'almoxarifado.atender') then raise exception 'SEM_PERMISSAO_ATENDER_ALMOXARIFADO' using errcode='42501'; end if;
  if v_req.status in ('cancelada','atendida','recebida') then raise exception 'REQUISICAO_NAO_PODE_SER_ATENDIDA'; end if;
  select l.* into v_lote from public.estoque_lotes l where l.id=p_estoque_lote_id for update;
  if not found then raise exception 'LOTE_NAO_LOCALIZADO'; end if;
  if v_lote.empresa_id<>v_req.empresa_id or v_lote.unidade_id<>v_req.unidade_id then raise exception 'LOTE_FORA_ESCOPO'; end if;
  if v_lote.produto_id<>v_item.produto_id then raise exception 'PRODUTO_DIVERGENTE'; end if;
  if v_lote.local_id=v_req.local_destino_id then raise exception 'ORIGEM_IGUAL_DESTINO'; end if;
  if v_lote.status<>'disponivel' then raise exception 'LOTE_NAO_DISPONIVEL'; end if;
  if v_lote.validade is not null and v_lote.validade<current_date then raise exception 'LOTE_VENCIDO_NAO_MOVIMENTAVEL'; end if;
  v_restante:=greatest(coalesce(v_item.quantidade_aprovada,v_item.quantidade_solicitada)-coalesce(v_item.quantidade_atendida,0),0);
  if p_quantidade>v_restante then raise exception 'QUANTIDADE_SUPERA_PENDENCIA'; end if;
  if v_lote.quantidade<p_quantidade then raise exception 'ESTOQUE_INSUFICIENTE'; end if;
  update public.estoque_lotes set quantidade=quantidade-p_quantidade,updated_at=now() where id=v_lote.id;
  select id,quantidade,custo_unitario into v_dest_lote,v_dest_quantidade,v_dest_custo
  from public.estoque_lotes
  where empresa_id=v_req.empresa_id and unidade_id=v_req.unidade_id and local_id=v_req.local_destino_id and produto_id=v_lote.produto_id
    and coalesce(numero_lote,'')=coalesce(v_lote.numero_lote,'') and validade is not distinct from v_lote.validade
  limit 1 for update;
  if v_dest_lote is null then
    insert into public.estoque_lotes(empresa_id,unidade_id,local_id,produto_id,fornecedor_id,numero_lote,validade,quantidade,custo_unitario,status,created_at,updated_at)
    values(v_req.empresa_id,v_req.unidade_id,v_req.local_destino_id,v_lote.produto_id,v_lote.fornecedor_id,v_lote.numero_lote,v_lote.validade,p_quantidade,v_lote.custo_unitario,'disponivel',now(),now()) returning id into v_dest_lote;
  else
    update public.estoque_lotes
    set quantidade=quantidade+p_quantidade,
        custo_unitario=case when quantidade+p_quantidade>0 then ((quantidade*coalesce(custo_unitario,0))+(p_quantidade*coalesce(v_lote.custo_unitario,0)))/(quantidade+p_quantidade) else coalesce(v_lote.custo_unitario,0) end,
        fornecedor_id=coalesce(fornecedor_id,v_lote.fornecedor_id),updated_at=now()
    where id=v_dest_lote;
  end if;
  insert into public.estoque_movimentos(empresa_id,unidade_id,produto_id,lote_id,local_origem_id,local_destino_id,atendimento_id,tipo,quantidade,custo_unitario,motivo,created_at,created_by,cirurgia_id,requisicao_setorial_id,requisicao_setorial_item_id)
  values(v_req.empresa_id,v_req.unidade_id,v_lote.produto_id,v_lote.id,v_lote.local_id,v_req.local_destino_id,v_req.atendimento_id,'transferencia',p_quantidade,v_lote.custo_unitario,'Atendimento da requisição '||v_req.numero,now(),auth.uid(),v_req.cirurgia_id,v_req.id,v_item.id)
  returning id into v_mov;
  update public.estoque_requisicao_setorial_itens
  set quantidade_atendida=quantidade_atendida+p_quantidade,status=case when quantidade_atendida+p_quantidade>=coalesce(quantidade_aprovada,quantidade_solicitada) then 'atendido' else 'parcial' end,updated_at=now(),updated_by=auth.uid()
  where id=v_item.id;
  update public.estoque_requisicoes_setoriais r
  set local_origem_id=coalesce(r.local_origem_id,v_lote.local_id),iniciado_em=coalesce(r.iniciado_em,now()),
      status=case when not exists(select 1 from public.estoque_requisicao_setorial_itens x where x.requisicao_id=r.id and x.status not in ('atendido','cancelado')) then 'atendida' when exists(select 1 from public.estoque_requisicao_setorial_itens x where x.requisicao_id=r.id and x.quantidade_atendida>0) then 'parcial' else 'em_separacao' end,
      atendido_em=case when not exists(select 1 from public.estoque_requisicao_setorial_itens x where x.requisicao_id=r.id and x.status not in ('atendido','cancelado')) then now() else r.atendido_em end,updated_at=now(),updated_by=auth.uid()
  where r.id=v_req.id;
  v_prof:=public.profissional_logado(v_req.empresa_id);
  insert into public.estoque_requisicao_setorial_eventos(requisicao_id,evento,detalhe,profissional_id,usuario_id)
  values(v_req.id,'item_atendido',jsonb_build_object('item_id',v_item.id,'lote_origem_id',v_lote.id,'lote_destino_id',v_dest_lote,'quantidade',p_quantidade,'movimento_id',v_mov,'cirurgia_id',v_req.cirurgia_id,'atendimento_id',v_req.atendimento_id),v_prof,auth.uid());
  return v_mov;
end $$;

create or replace function public.centro_cirurgico_receber_suprimentos_operacional(p_requisicao_id uuid)
returns void
language plpgsql security definer
set search_path='public','pg_catalog'
as $$
declare v_req public.estoque_requisicoes_setoriais%rowtype; v_c public.cirurgias%rowtype; v_prof uuid;
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_req from public.estoque_requisicoes_setoriais where id=p_requisicao_id for update;
  if not found or v_req.cirurgia_id is null then raise exception 'CC_REQUISICAO_CIRURGICA_NAO_LOCALIZADA'; end if;
  select * into v_c from public.cirurgias where id=v_req.cirurgia_id;
  if not found then raise exception 'CC_CIRURGIA_NAO_LOCALIZADA'; end if;
  if not public.tem_unidade(v_c.empresa_id,v_c.unidade_id) then raise exception 'CC_UNIDADE_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.operar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar')) then raise exception 'CC_SEM_PERMISSAO_OPERAR' using errcode='42501'; end if;
  if v_req.status='recebida' then return; end if;
  if v_req.status<>'atendida' then raise exception 'CC_REQUISICAO_AINDA_NAO_ATENDIDA'; end if;
  if exists(select 1 from public.estoque_requisicao_setorial_itens where requisicao_id=v_req.id and status not in ('atendido','cancelado')) then raise exception 'CC_REQUISICAO_POSSUI_ITENS_PENDENTES'; end if;
  update public.estoque_requisicoes_setoriais set status='recebida',recebido_em=now(),updated_at=now(),updated_by=auth.uid() where id=v_req.id;
  v_prof:=public.profissional_logado(v_c.empresa_id);
  insert into public.estoque_requisicao_setorial_eventos(requisicao_id,evento,detalhe,profissional_id,usuario_id)
  values(v_req.id,'recebida',jsonb_build_object('cirurgia_id',v_c.id,'atendimento_id',v_c.atendimento_id),v_prof,auth.uid());
  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by)
  values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,'suprimentos_recebidos',jsonb_build_object('requisicao_id',v_req.id,'numero',v_req.numero,'local_destino_id',v_req.local_destino_id),v_prof,auth.uid());
end $$;

create or replace function public.centro_cirurgico_consumir_suprimento_operacional(
  p_cirurgia_id uuid,
  p_estoque_lote_id uuid,
  p_quantidade numeric,
  p_opme_id uuid default null,
  p_requisicao_item_id uuid default null,
  p_serie text default null,
  p_observacoes text default null
) returns jsonb
language plpgsql security definer
set search_path='public','pg_catalog','extensions'
as $$
declare
  v_c public.cirurgias%rowtype;
  v_lote public.estoque_lotes%rowtype;
  v_prod public.estoque_produtos%rowtype;
  v_item public.itens_assistenciais%rowtype;
  v_opme public.cirurgia_opme%rowtype;
  v_req_item record;
  v_mov uuid;
  v_opme_id uuid;
  v_prof uuid;
  v_codigo text;
  v_nome text;
  v_serie text:=nullif(btrim(p_serie),'');
  v_req_disponivel numeric;
  v_req_consumido numeric;
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  if coalesce(p_quantidade,0)<=0 then raise exception 'CC_SUPRIMENTO_QUANTIDADE_INVALIDA'; end if;
  select * into v_c from public.cirurgias where id=p_cirurgia_id for update;
  if not found then raise exception 'CC_CIRURGIA_NAO_LOCALIZADA'; end if;
  if not public.tem_unidade(v_c.empresa_id,v_c.unidade_id) then raise exception 'CC_UNIDADE_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.operar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar')) then raise exception 'CC_SEM_PERMISSAO_OPERAR' using errcode='42501'; end if;
  if v_c.status<>'em_andamento' then raise exception 'CC_CONSUMO_EXIGE_CIRURGIA_EM_ANDAMENTO'; end if;
  select * into v_lote from public.estoque_lotes where id=p_estoque_lote_id for update;
  if not found then raise exception 'CC_SUPRIMENTO_LOTE_NAO_LOCALIZADO'; end if;
  if v_lote.empresa_id<>v_c.empresa_id or v_lote.unidade_id<>v_c.unidade_id then raise exception 'CC_SUPRIMENTO_LOTE_FORA_ESCOPO'; end if;
  if v_lote.status<>'disponivel' then raise exception 'CC_SUPRIMENTO_LOTE_NAO_DISPONIVEL'; end if;
  if v_lote.validade is not null and v_lote.validade<current_date then raise exception 'CC_SUPRIMENTO_LOTE_VENCIDO'; end if;
  if v_lote.quantidade<p_quantidade then raise exception 'CC_SUPRIMENTO_ESTOQUE_INSUFICIENTE'; end if;
  if not exists(select 1 from public.estoque_locais l where l.id=v_lote.local_id and l.empresa_id=v_c.empresa_id and l.unidade_id=v_c.unidade_id and l.ativo=true) then raise exception 'CC_SUPRIMENTO_LOCAL_INATIVO'; end if;
  select * into v_prod from public.estoque_produtos where id=v_lote.produto_id and empresa_id=v_c.empresa_id and ativo=true;
  if not found then raise exception 'CC_SUPRIMENTO_PRODUTO_INVALIDO'; end if;
  if v_prod.tipo='medicamento' then raise exception 'CC_MEDICAMENTO_EXIGE_FLUXO_FARMACIA_PRESCRICAO'; end if;
  if v_prod.tipo not in ('material','opme','gas_medicinal') then raise exception 'CC_SUPRIMENTO_TIPO_NAO_CONSUMIVEL'; end if;
  if v_prod.item_assistencial_id is not null then
    select * into v_item from public.itens_assistenciais where id=v_prod.item_assistencial_id and empresa_id=v_c.empresa_id and ativo=true;
    if not found then raise exception 'CC_SUPRIMENTO_ITEM_ASSISTENCIAL_INVALIDO'; end if;
    if v_prod.tipo='opme' and v_item.categoria<>'opme' then raise exception 'CC_OPME_CATALOGO_INCONSISTENTE'; end if;
  end if;
  if p_opme_id is not null and v_prod.tipo<>'opme' then raise exception 'CC_OPME_VINCULO_EM_PRODUTO_NAO_OPME'; end if;
  if p_requisicao_item_id is not null then
    select i.*,r.id as req_id,r.cirurgia_id as req_cirurgia_id,r.local_destino_id as req_local_destino_id,r.status as req_status
    into v_req_item
    from public.estoque_requisicao_setorial_itens i join public.estoque_requisicoes_setoriais r on r.id=i.requisicao_id
    where i.id=p_requisicao_item_id for update of i;
    if not found or v_req_item.req_cirurgia_id is distinct from v_c.id then raise exception 'CC_REQUISICAO_ITEM_FORA_CIRURGIA'; end if;
    if v_req_item.produto_id<>v_prod.id then raise exception 'CC_REQUISICAO_ITEM_PRODUTO_DIVERGENTE'; end if;
    if v_req_item.req_local_destino_id<>v_lote.local_id then raise exception 'CC_REQUISICAO_ITEM_LOCAL_DIVERGENTE'; end if;
    if v_req_item.req_status not in ('atendida','recebida') then raise exception 'CC_REQUISICAO_ITEM_NAO_DISPONIVEL'; end if;
    select coalesce(sum(greatest(m.quantidade-coalesce((select sum(d.quantidade) from public.estoque_movimentos d where d.movimento_origem_id=m.id and d.tipo='devolucao'),0),0)),0)
      into v_req_consumido
    from public.estoque_movimentos m
    where m.requisicao_setorial_item_id=p_requisicao_item_id and m.tipo='consumo_paciente';
    v_req_disponivel:=greatest(coalesce(v_req_item.quantidade_atendida,0)-coalesce(v_req_consumido,0),0);
    if p_quantidade>v_req_disponivel then raise exception 'CC_CONSUMO_SUPERA_REQUISICAO_ATENDIDA'; end if;
  end if;
  v_codigo:=coalesce(nullif(btrim(v_item.codigo_tuss),''),nullif(btrim(v_item.codigo_tabela_propria),''),nullif(btrim(v_prod.codigo_tuss),''),nullif(btrim(v_prod.codigo),''));
  v_nome:=coalesce(nullif(btrim(v_item.descricao),''),v_prod.descricao);
  v_prof:=public.profissional_logado(v_c.empresa_id);
  if v_prod.tipo='opme' then
    if v_serie is not null and exists(select 1 from public.cirurgia_opme o where o.empresa_id=v_c.empresa_id and o.produto_id=v_prod.id and o.serie=v_serie and o.status='utilizado' and (p_opme_id is null or o.id<>p_opme_id)) then raise exception 'CC_OPME_SERIE_JA_UTILIZADA'; end if;
    if p_opme_id is not null then
      select * into v_opme from public.cirurgia_opme where id=p_opme_id and cirurgia_id=v_c.id for update;
      if not found then raise exception 'CC_OPME_PLANEJADA_NAO_LOCALIZADA'; end if;
      if v_opme.status<>'previsto' then raise exception 'CC_OPME_PLANEJADA_JA_PROCESSADA'; end if;
      v_opme_id:=v_opme.id;
      update public.cirurgia_opme set item_assistencial_id=v_prod.item_assistencial_id,produto_id=v_prod.id,estoque_lote_id=v_lote.id,item=v_nome,codigo=v_codigo,
        fabricante=coalesce(nullif(btrim(v_item.fabricante),''),fabricante),lote=v_lote.numero_lote,serie=coalesce(v_serie,serie),registro_anvisa=coalesce(nullif(btrim(v_item.codigo_anvisa),''),nullif(btrim(v_prod.codigo_anvisa),''),registro_anvisa),
        quantidade=p_quantidade,observacoes=coalesce(nullif(btrim(p_observacoes),''),observacoes),updated_at=now(),updated_by=auth.uid()
      where id=v_opme_id;
    else
      insert into public.cirurgia_opme(empresa_id,unidade_id,cirurgia_id,atendimento_id,item,codigo,fabricante,lote,serie,registro_anvisa,quantidade,status,observacoes,item_assistencial_id,produto_id,estoque_lote_id,created_by,updated_by)
      values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,v_nome,v_codigo,nullif(btrim(v_item.fabricante),''),v_lote.numero_lote,v_serie,coalesce(nullif(btrim(v_item.codigo_anvisa),''),nullif(btrim(v_prod.codigo_anvisa),'')),p_quantidade,'previsto',nullif(btrim(p_observacoes),''),v_prod.item_assistencial_id,v_prod.id,v_lote.id,auth.uid(),auth.uid())
      returning id into v_opme_id;
    end if;
  end if;
  update public.estoque_lotes set quantidade=quantidade-p_quantidade,updated_at=now() where id=v_lote.id;
  insert into public.estoque_movimentos(empresa_id,unidade_id,produto_id,lote_id,local_origem_id,atendimento_id,tipo,quantidade,custo_unitario,motivo,created_at,created_by,cirurgia_id,cirurgia_opme_id,requisicao_setorial_id,requisicao_setorial_item_id)
  values(v_c.empresa_id,v_c.unidade_id,v_prod.id,v_lote.id,v_lote.local_id,v_c.atendimento_id,'consumo_paciente',p_quantidade,v_lote.custo_unitario,
    concat('Consumo cirúrgico ',coalesce(v_c.cirurgia,v_c.procedimento),case when nullif(btrim(p_observacoes),'') is not null then ': '||btrim(p_observacoes) else '' end),now(),auth.uid(),v_c.id,v_opme_id,
    case when p_requisicao_item_id is not null then v_req_item.req_id else null end,p_requisicao_item_id)
  returning id into v_mov;
  if v_opme_id is not null then
    update public.cirurgia_opme set status='utilizado',utilizado_em=now(),estoque_movimento_id=v_mov,updated_at=now(),updated_by=auth.uid() where id=v_opme_id;
  end if;
  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by)
  values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,case when v_prod.tipo='opme' then 'opme_utilizada_estoque' else 'suprimento_consumido' end,
    jsonb_build_object('produto_id',v_prod.id,'item_assistencial_id',v_prod.item_assistencial_id,'tipo',v_prod.tipo,'lote_id',v_lote.id,'lote',v_lote.numero_lote,'quantidade',p_quantidade,'movimento_id',v_mov,'opme_id',v_opme_id,'requisicao_item_id',p_requisicao_item_id),v_prof,auth.uid());
  return jsonb_build_object('movimento_id',v_mov,'opme_id',v_opme_id,'produto_id',v_prod.id,'lote_id',v_lote.id,'quantidade',p_quantidade,'saldo_lote',v_lote.quantidade-p_quantidade,'tipo',v_prod.tipo);
end $$;

create or replace function public.centro_cirurgico_estornar_consumo_operacional(
  p_movimento_id uuid,
  p_quantidade numeric default null,
  p_motivo text default null
) returns uuid
language plpgsql security definer
set search_path='public','pg_catalog'
as $$
declare
  v_mov public.estoque_movimentos%rowtype;
  v_c public.cirurgias%rowtype;
  v_lote public.estoque_lotes%rowtype;
  v_opme public.cirurgia_opme%rowtype;
  v_devolvido numeric;
  v_restante numeric;
  v_qtd numeric;
  v_estorno uuid;
  v_prof uuid;
begin
  if auth.uid() is null then raise exception 'CC_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  if coalesce(btrim(p_motivo),'')='' then raise exception 'CC_ESTORNO_EXIGE_MOTIVO'; end if;
  select * into v_mov from public.estoque_movimentos where id=p_movimento_id for update;
  if not found or v_mov.tipo<>'consumo_paciente' or v_mov.cirurgia_id is null then raise exception 'CC_MOVIMENTO_CONSUMO_NAO_LOCALIZADO'; end if;
  select * into v_c from public.cirurgias where id=v_mov.cirurgia_id for update;
  if not found then raise exception 'CC_CIRURGIA_NAO_LOCALIZADA'; end if;
  if not public.tem_unidade(v_c.empresa_id,v_c.unidade_id) then raise exception 'CC_UNIDADE_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.operar') or public.tem_permissao(v_c.empresa_id,v_c.unidade_id,'centro_cirurgico.gerenciar')) then raise exception 'CC_SEM_PERMISSAO_OPERAR' using errcode='42501'; end if;
  if v_c.status in ('concluida','cancelada') then raise exception 'CC_ESTORNO_POS_CONCLUSAO_EXIGE_AUDITORIA'; end if;
  select coalesce(sum(quantidade),0) into v_devolvido from public.estoque_movimentos where movimento_origem_id=v_mov.id and tipo='devolucao';
  v_restante:=greatest(v_mov.quantidade-v_devolvido,0);
  if v_restante<=0 then raise exception 'CC_CONSUMO_JA_ESTORNADO'; end if;
  v_qtd:=coalesce(p_quantidade,v_restante);
  if v_qtd<=0 or v_qtd>v_restante then raise exception 'CC_ESTORNO_QUANTIDADE_INVALIDA'; end if;
  select * into v_lote from public.estoque_lotes where id=v_mov.lote_id for update;
  if not found then raise exception 'CC_ESTORNO_LOTE_NAO_LOCALIZADO'; end if;
  if v_mov.cirurgia_opme_id is not null then
    if v_qtd<>v_restante or v_restante<>v_mov.quantidade then raise exception 'CC_OPME_ESTORNO_DEVE_SER_INTEGRAL'; end if;
    select * into v_opme from public.cirurgia_opme where id=v_mov.cirurgia_opme_id for update;
    if not found or v_opme.status<>'utilizado' then raise exception 'CC_OPME_NAO_ELEGIVEL_ESTORNO'; end if;
  end if;
  update public.estoque_lotes set quantidade=quantidade+v_qtd,updated_at=now() where id=v_lote.id;
  insert into public.estoque_movimentos(empresa_id,unidade_id,produto_id,lote_id,local_destino_id,atendimento_id,tipo,quantidade,custo_unitario,motivo,created_at,created_by,cirurgia_id,cirurgia_opme_id,movimento_origem_id,requisicao_setorial_id,requisicao_setorial_item_id)
  values(v_mov.empresa_id,v_mov.unidade_id,v_mov.produto_id,v_mov.lote_id,v_lote.local_id,v_mov.atendimento_id,'devolucao',v_qtd,v_mov.custo_unitario,btrim(p_motivo),now(),auth.uid(),v_mov.cirurgia_id,v_mov.cirurgia_opme_id,v_mov.id,v_mov.requisicao_setorial_id,v_mov.requisicao_setorial_item_id)
  returning id into v_estorno;
  if v_mov.cirurgia_opme_id is not null then
    update public.cirurgia_opme set status='nao_utilizado',utilizado_em=null,estoque_estorno_movimento_id=v_estorno,updated_at=now(),updated_by=auth.uid() where id=v_mov.cirurgia_opme_id;
  end if;
  v_prof:=public.profissional_logado(v_c.empresa_id);
  insert into public.cirurgia_eventos(empresa_id,unidade_id,cirurgia_id,atendimento_id,tipo_evento,detalhes,profissional_id,created_by)
  values(v_c.empresa_id,v_c.unidade_id,v_c.id,v_c.atendimento_id,'consumo_estoque_estornado',jsonb_build_object('movimento_origem_id',v_mov.id,'movimento_estorno_id',v_estorno,'quantidade',v_qtd,'motivo',btrim(p_motivo),'opme_id',v_mov.cirurgia_opme_id),v_prof,auth.uid());
  return v_estorno;
end $$;

create or replace function public.registrar_producao_consumos_estoque_cirurgia()
returns trigger
language plpgsql security definer
set search_path='public','pg_catalog','extensions'
as $$
declare r record; v_net numeric; v_categoria text; v_codigo text; v_prof uuid;
begin
  if new.status='concluida' and old.status is distinct from new.status then
    v_prof:=coalesce(new.cirurgiao_id,public.profissional_logado(new.empresa_id));
    for r in
      select m.*,p.tipo as produto_tipo,p.codigo as produto_codigo,p.codigo_tuss as produto_codigo_tuss,p.item_assistencial_id,
             p.descricao as produto_descricao,i.codigo_tuss as item_codigo_tuss,i.codigo_tabela_propria,i.descricao as item_descricao,
             l.numero_lote,l.local_id
      from public.estoque_movimentos m
      join public.estoque_produtos p on p.id=m.produto_id
      left join public.itens_assistenciais i on i.id=p.item_assistencial_id
      left join public.estoque_lotes l on l.id=m.lote_id
      where m.cirurgia_id=new.id and m.tipo='consumo_paciente' and m.cirurgia_opme_id is null and p.tipo in ('material','gas_medicinal')
    loop
      select greatest(r.quantidade-coalesce(sum(d.quantidade),0),0) into v_net
      from public.estoque_movimentos d where d.movimento_origem_id=r.id and d.tipo='devolucao';
      if coalesce(v_net,0)>0 then
        v_categoria:=case when r.produto_tipo='material' then 'materiais' when r.produto_tipo='gas_medicinal' then 'gases_medicinais' else r.produto_tipo end;
        v_codigo:=coalesce(nullif(btrim(r.item_codigo_tuss),''),nullif(btrim(r.codigo_tabela_propria),''),nullif(btrim(r.produto_codigo_tuss),''),nullif(btrim(r.produto_codigo),''));
        perform public.registrar_evento_producao_assistencial_internal(new.atendimento_id,'consumo_estoque_cirurgico','estoque_movimento_cirurgia',r.id,coalesce(new.fim_em,r.created_at,now()),v_net,v_categoria,v_prof,'centro_cirurgico',null,r.item_assistencial_id,v_codigo,true,
          jsonb_build_object('cirurgia_id',new.id,'produto_id',r.produto_id,'tipo_produto',r.produto_tipo,'descricao',coalesce(r.item_descricao,r.produto_descricao),'estoque_lote_id',r.lote_id,'numero_lote',r.numero_lote,'local_origem_id',r.local_origem_id,'movimento_id',r.id,'quantidade_consumida',r.quantidade,'quantidade_liquida',v_net,'requisicao_setorial_id',r.requisicao_setorial_id,'requisicao_setorial_item_id',r.requisicao_setorial_item_id));
      end if;
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists trg_registrar_producao_consumos_estoque_cirurgia on public.cirurgias;
create trigger trg_registrar_producao_consumos_estoque_cirurgia after update of status on public.cirurgias for each row execute function public.registrar_producao_consumos_estoque_cirurgia();

create or replace function public.reconciliar_pendencias_cirurgia_estoque_internal(p_empresa_id uuid,p_unidade_id uuid,p_atendimento_id uuid default null,p_resolvida_por uuid default null)
returns jsonb
language plpgsql security definer
set search_path='public','pg_catalog'
as $$
declare v_resolvidas integer; v_abertas integer;
begin
  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select o.empresa_id,o.unidade_id,o.atendimento_id,c.paciente_id,'opme_utilizada_sem_movimento_estoque','cirurgia_opme',o.id,'centro_cirurgico','almoxarifado','critica',
         'OPME utilizada sem baixa física compatível','A OPME está marcada como utilizada, mas o movimento de estoque vinculado não comprova o mesmo produto, lote, cirurgia e quantidade.',
         jsonb_build_object('cirurgia_id',o.cirurgia_id,'item',o.item,'produto_id',o.produto_id,'estoque_lote_id',o.estoque_lote_id,'estoque_movimento_id',o.estoque_movimento_id,'quantidade',o.quantidade)
  from public.cirurgia_opme o join public.cirurgias c on c.id=o.cirurgia_id
  where o.empresa_id=p_empresa_id and o.unidade_id=p_unidade_id and o.status='utilizado'
    and (p_atendimento_id is null or o.atendimento_id=p_atendimento_id)
    and not exists(select 1 from public.estoque_movimentos m where m.id=o.estoque_movimento_id and m.cirurgia_id=o.cirurgia_id and m.cirurgia_opme_id=o.id and m.atendimento_id=o.atendimento_id and m.produto_id=o.produto_id and m.lote_id=o.estoque_lote_id and m.tipo='consumo_paciente' and m.quantidade>=o.quantidade)
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select m.empresa_id,m.unidade_id,m.atendimento_id,c.paciente_id,'consumo_cirurgico_sem_producao','estoque_movimentos',m.id,'centro_cirurgico','faturamento','critica',
         'Consumo cirúrgico sem produção correspondente','Há baixa física de material/gás em cirurgia concluída, mas não existe evento ativo correspondente no Livro de Produção.',
         jsonb_build_object('cirurgia_id',m.cirurgia_id,'produto_id',m.produto_id,'lote_id',m.lote_id,'quantidade',m.quantidade,'tipo_produto',p.tipo)
  from public.estoque_movimentos m
  join public.cirurgias c on c.id=m.cirurgia_id
  join public.estoque_produtos p on p.id=m.produto_id
  where m.empresa_id=p_empresa_id and m.unidade_id=p_unidade_id and m.tipo='consumo_paciente' and m.cirurgia_opme_id is null and c.status='concluida' and p.tipo in ('material','gas_medicinal')
    and (p_atendimento_id is null or m.atendimento_id=p_atendimento_id)
    and greatest(m.quantidade-coalesce((select sum(d.quantidade) from public.estoque_movimentos d where d.movimento_origem_id=m.id and d.tipo='devolucao'),0),0)>0
    and not exists(select 1 from public.producao_assistencial_eventos e where e.origem_tipo='estoque_movimento_cirurgia' and e.origem_id=m.id and e.status in ('registrado','consolidado'))
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select r.empresa_id,r.unidade_id,r.atendimento_id,c.paciente_id,'requisicao_cirurgica_pendente_apos_conclusao','estoque_requisicoes_setoriais',r.id,'centro_cirurgico','almoxarifado','alta',
         'Requisição cirúrgica pendente após conclusão','A cirurgia terminou e a requisição de suprimentos ainda não foi recebida nem cancelada.',
         jsonb_build_object('cirurgia_id',r.cirurgia_id,'numero',r.numero,'status',r.status,'local_destino_id',r.local_destino_id)
  from public.estoque_requisicoes_setoriais r join public.cirurgias c on c.id=r.cirurgia_id
  where r.empresa_id=p_empresa_id and r.unidade_id=p_unidade_id and c.status='concluida' and r.status not in ('recebida','cancelada')
    and (p_atendimento_id is null or r.atendimento_id=p_atendimento_id)
  on conflict do nothing;

  update public.integracao_pendencias x
  set status='resolvida',resolvida_em=now(),resolvida_por=p_resolvida_por,updated_at=now()
  where x.empresa_id=p_empresa_id and x.unidade_id=p_unidade_id and x.status='aberta'
    and (p_atendimento_id is null or x.atendimento_id=p_atendimento_id)
    and (
      (x.regra_chave='opme_utilizada_sem_movimento_estoque' and not exists(
        select 1 from public.cirurgia_opme o where o.id=x.origem_id and o.status='utilizado'
          and not exists(select 1 from public.estoque_movimentos m where m.id=o.estoque_movimento_id and m.cirurgia_id=o.cirurgia_id and m.cirurgia_opme_id=o.id and m.atendimento_id=o.atendimento_id and m.produto_id=o.produto_id and m.lote_id=o.estoque_lote_id and m.tipo='consumo_paciente' and m.quantidade>=o.quantidade)
      ))
      or (x.regra_chave='consumo_cirurgico_sem_producao' and not exists(
        select 1 from public.estoque_movimentos m join public.cirurgias c on c.id=m.cirurgia_id join public.estoque_produtos p on p.id=m.produto_id
        where m.id=x.origem_id and m.tipo='consumo_paciente' and m.cirurgia_opme_id is null and c.status='concluida' and p.tipo in ('material','gas_medicinal')
          and greatest(m.quantidade-coalesce((select sum(d.quantidade) from public.estoque_movimentos d where d.movimento_origem_id=m.id and d.tipo='devolucao'),0),0)>0
          and not exists(select 1 from public.producao_assistencial_eventos e where e.origem_tipo='estoque_movimento_cirurgia' and e.origem_id=m.id and e.status in ('registrado','consolidado'))
      ))
      or (x.regra_chave='requisicao_cirurgica_pendente_apos_conclusao' and not exists(
        select 1 from public.estoque_requisicoes_setoriais r join public.cirurgias c on c.id=r.cirurgia_id where r.id=x.origem_id and c.status='concluida' and r.status not in ('recebida','cancelada')
      ))
    );
  get diagnostics v_resolvidas=row_count;
  select count(*) into v_abertas from public.integracao_pendencias where empresa_id=p_empresa_id and unidade_id=p_unidade_id and status='aberta' and regra_chave in ('opme_utilizada_sem_movimento_estoque','consumo_cirurgico_sem_producao','requisicao_cirurgica_pendente_apos_conclusao') and (p_atendimento_id is null or atendimento_id=p_atendimento_id);
  return jsonb_build_object('abertas_cirurgia_estoque',v_abertas,'resolvidas_nesta_execucao',v_resolvidas);
end $$;

create or replace function public.reconciliar_pendencias_integracao(p_empresa_id uuid,p_unidade_id uuid,p_atendimento_id uuid default null)
returns jsonb
language plpgsql security definer
set search_path='public','pg_catalog'
as $$
declare v_cir jsonb; v_med jsonb; v_base jsonb; v_resolvidas integer;
begin
  if auth.uid() is null then raise exception 'INTEGRACAO_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  if not public.tem_unidade(p_empresa_id,p_unidade_id) then raise exception 'INTEGRACAO_UNIDADE_FORA_ESCOPO' using errcode='42501'; end if;
  if not public.tem_permissao(p_empresa_id,p_unidade_id,'integracao.reconciliar') then raise exception 'INTEGRACAO_SEM_PERMISSAO' using errcode='42501'; end if;
  if p_atendimento_id is not null and not exists(select 1 from public.atendimentos a where a.id=p_atendimento_id and a.empresa_id=p_empresa_id and a.unidade_id=p_unidade_id) then raise exception 'INTEGRACAO_ATENDIMENTO_FORA_ESCOPO' using errcode='42501'; end if;
  v_cir:=public.reconciliar_pendencias_cirurgia_estoque_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_med:=public.reconciliar_pendencias_medicamentos_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_base:=public.reconciliar_pendencias_integracao_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
  v_resolvidas:=coalesce((v_cir->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_med->>'resolvidas_nesta_execucao')::integer,0)+coalesce((v_base->>'resolvidas_nesta_execucao')::integer,0);
  return jsonb_build_object('abertas',coalesce((v_base->>'abertas')::integer,0),'resolvidas_nesta_execucao',v_resolvidas,'abertas_medicamentos',coalesce((v_med->>'abertas_medicamentos')::integer,0),'abertas_cirurgia_estoque',coalesce((v_cir->>'abertas_cirurgia_estoque')::integer,0));
end $$;

revoke all on function public.centro_cirurgico_requisitar_suprimentos_operacional(uuid,uuid,text,text,jsonb) from public;
revoke all on function public.centro_cirurgico_requisitar_suprimentos_operacional(uuid,uuid,text,text,jsonb) from anon;
grant execute on function public.centro_cirurgico_requisitar_suprimentos_operacional(uuid,uuid,text,text,jsonb) to authenticated;
revoke all on function public.centro_cirurgico_receber_suprimentos_operacional(uuid) from public;
revoke all on function public.centro_cirurgico_receber_suprimentos_operacional(uuid) from anon;
grant execute on function public.centro_cirurgico_receber_suprimentos_operacional(uuid) to authenticated;
revoke all on function public.centro_cirurgico_consumir_suprimento_operacional(uuid,uuid,numeric,uuid,uuid,text,text) from public;
revoke all on function public.centro_cirurgico_consumir_suprimento_operacional(uuid,uuid,numeric,uuid,uuid,text,text) from anon;
grant execute on function public.centro_cirurgico_consumir_suprimento_operacional(uuid,uuid,numeric,uuid,uuid,text,text) to authenticated;
revoke all on function public.centro_cirurgico_estornar_consumo_operacional(uuid,numeric,text) from public;
revoke all on function public.centro_cirurgico_estornar_consumo_operacional(uuid,numeric,text) from anon;
grant execute on function public.centro_cirurgico_estornar_consumo_operacional(uuid,numeric,text) to authenticated;
revoke all on function public.reconciliar_pendencias_cirurgia_estoque_internal(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.registrar_producao_consumos_estoque_cirurgia() from public,anon,authenticated;
revoke all on function public.centro_cirurgico_registrar_opme_operacional(uuid,text,text,text,text,text,text,numeric,text,text) from public;
revoke all on function public.centro_cirurgico_registrar_opme_operacional(uuid,text,text,text,text,text,text,numeric,text,text) from anon;
grant execute on function public.centro_cirurgico_registrar_opme_operacional(uuid,text,text,text,text,text,text,numeric,text,text) to authenticated;
revoke all on function public.atender_requisicao_setorial_item(uuid,uuid,numeric) from public;
revoke all on function public.atender_requisicao_setorial_item(uuid,uuid,numeric) from anon;
grant execute on function public.atender_requisicao_setorial_item(uuid,uuid,numeric) to authenticated;
revoke all on function public.reconciliar_pendencias_integracao(uuid,uuid,uuid) from public;
revoke all on function public.reconciliar_pendencias_integracao(uuid,uuid,uuid) from anon;
grant execute on function public.reconciliar_pendencias_integracao(uuid,uuid,uuid) to authenticated;