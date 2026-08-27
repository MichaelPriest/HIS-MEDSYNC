alter table public.estoque_lotes add column if not exists status text;
update public.estoque_lotes set status='disponivel' where status is null;
alter table public.estoque_lotes alter column status set default 'disponivel';
alter table public.estoque_lotes alter column status set not null;
alter table public.estoque_lotes add column if not exists bloqueio_motivo text;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.estoque_lotes'::regclass and conname='estoque_lotes_status_check') then
    alter table public.estoque_lotes add constraint estoque_lotes_status_check check (status in ('disponivel','bloqueado','quarentena'));
  end if;
end $$;

create index if not exists idx_estoque_lotes_fefo
  on public.estoque_lotes (empresa_id,unidade_id,produto_id,local_id,status,validade,id)
  where quantidade > 0;

alter table public.dispensacoes_medicamentos add column if not exists quantidade_devolvida numeric not null default 0;
alter table public.dispensacoes_medicamentos add column if not exists selecao_lote text not null default 'manual';
alter table public.dispensacoes_medicamentos add column if not exists fefo_sequencia integer;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.dispensacoes_medicamentos'::regclass and conname='dispensacoes_quantidade_devolvida_check') then
    alter table public.dispensacoes_medicamentos add constraint dispensacoes_quantidade_devolvida_check
      check (quantidade_devolvida >= 0 and quantidade_devolvida <= quantidade);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.dispensacoes_medicamentos'::regclass and conname='dispensacoes_selecao_lote_check') then
    alter table public.dispensacoes_medicamentos add constraint dispensacoes_selecao_lote_check
      check (selecao_lote in ('manual','fefo'));
  end if;
end $$;

update public.dispensacoes_medicamentos d
set farmacia_local_id=l.local_id
from public.estoque_lotes l
where d.estoque_lote_id=l.id and d.farmacia_local_id is null;

create index if not exists idx_dispensacoes_prescricao_status
  on public.dispensacoes_medicamentos (prescricao_id,status,dispensado_em desc);

create or replace function public.dispensar_medicamento_prescricao_fefo(
  p_prescricao_id uuid,
  p_quantidade numeric,
  p_farmacia_local_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_p record;
  v_prof uuid;
  v_local uuid;
  v_l record;
  v_remaining numeric := p_quantidade;
  v_take numeric;
  v_disp uuid;
  v_seq integer := 0;
  v_alocacoes jsonb := '[]'::jsonb;
  v_val text;
begin
  if p_quantidade is null or p_quantidade<=0 then raise exception 'FARMACIA_QUANTIDADE_INVALIDA'; end if;

  select p.*,a.paciente_id into v_p
  from public.prescricoes p join public.atendimentos a on a.id=p.atendimento_id
  where p.id=p_prescricao_id;
  if not found then raise exception 'FARMACIA_PRESCRICAO_NAO_LOCALIZADA'; end if;
  if v_p.assinado_em is null or v_p.status<>'ativa' then raise exception 'FARMACIA_PRESCRICAO_NAO_ASSINADA_ATIVA'; end if;
  if v_p.produto_id is null then raise exception 'FARMACIA_PRESCRICAO_SEM_PRODUTO_ESTOQUE'; end if;
  if not public.tem_permissao(v_p.empresa_id,v_p.unidade_id,'farmacia.dispensar') then
    raise exception 'FARMACIA_SEM_PERMISSAO' using errcode='42501';
  end if;
  if v_p.requer_validacao_farmaceutica then
    select status into v_val from public.validacoes_farmaceuticas where prescricao_id=v_p.id;
    if coalesce(v_val,'pendente') not in ('validada','validada_com_ressalva') then
      raise exception 'FARMACIA_VALIDACAO_FARMACEUTICA_PENDENTE';
    end if;
  end if;

  v_prof:=public.profissional_logado(v_p.empresa_id);
  if v_prof is null then raise exception 'FARMACIA_USUARIO_SEM_PROFISSIONAL'; end if;

  select fcl.local_id into v_local
  from public.farmacia_catalogo_local fcl
  join public.estoque_locais el on el.id=fcl.local_id
  where fcl.empresa_id=v_p.empresa_id and fcl.unidade_id=v_p.unidade_id
    and fcl.produto_id=v_p.produto_id and fcl.ativo and fcl.permite_dispensacao
    and el.empresa_id=v_p.empresa_id and el.unidade_id=v_p.unidade_id and el.ativo and el.eh_farmacia
    and (p_farmacia_local_id is null or fcl.local_id=p_farmacia_local_id)
  order by case when p_farmacia_local_id is not null and fcl.local_id=p_farmacia_local_id then 0 else 1 end,
           fcl.padrao desc,el.prioridade_atendimento asc,fcl.local_id
  limit 1;
  if v_local is null then raise exception 'FARMACIA_PRODUTO_SEM_LOCAL_DISPENSACAO'; end if;

  for v_l in
    select l.*,ep.descricao,ep.unidade_medida
    from public.estoque_lotes l
    join public.estoque_produtos ep on ep.id=l.produto_id
    where l.empresa_id=v_p.empresa_id and l.unidade_id=v_p.unidade_id
      and l.local_id=v_local and l.produto_id=v_p.produto_id
      and l.status='disponivel' and l.quantidade>0
      and l.validade is not null and l.validade>=current_date
    order by l.validade asc,l.created_at asc,l.id
    for update of l
  loop
    exit when v_remaining<=0;
    v_take:=least(v_remaining,v_l.quantidade);
    if v_take<=0 then continue; end if;
    v_seq:=v_seq+1;

    update public.estoque_lotes set quantidade=quantidade-v_take,updated_at=now() where id=v_l.id;

    insert into public.dispensacoes_medicamentos(
      empresa_id,unidade_id,atendimento_id,prescricao_id,paciente_id,item,lote,validade,quantidade,
      unidade_medida,dispensado_por,dispensado_em,status,produto_id,estoque_lote_id,quantidade_atendida,
      farmacia_local_id,selecao_lote,fefo_sequencia,created_by,updated_by
    ) values (
      v_p.empresa_id,v_p.unidade_id,v_p.atendimento_id,v_p.id,v_p.paciente_id,coalesce(v_p.item,v_l.descricao),
      v_l.numero_lote,v_l.validade,v_take,v_l.unidade_medida,v_prof,now(),'dispensado',v_l.produto_id,v_l.id,v_take,
      v_local,'fefo',v_seq,auth.uid(),auth.uid()
    ) returning id into v_disp;

    insert into public.estoque_movimentos(
      empresa_id,unidade_id,produto_id,lote_id,local_origem_id,atendimento_id,prescricao_id,tipo,
      quantidade,custo_unitario,motivo,created_by
    ) values (
      v_p.empresa_id,v_p.unidade_id,v_l.produto_id,v_l.id,v_local,v_p.atendimento_id,v_p.id,'consumo_paciente',
      v_take,v_l.custo_unitario,'Dispensação FEFO para prescrição',auth.uid()
    );

    v_alocacoes:=v_alocacoes || jsonb_build_array(jsonb_build_object(
      'dispensacao_id',v_disp,'estoque_lote_id',v_l.id,'lote',v_l.numero_lote,'validade',v_l.validade,
      'quantidade',v_take,'sequencia',v_seq
    ));
    v_remaining:=v_remaining-v_take;
  end loop;

  if v_remaining>0 then raise exception 'FARMACIA_ESTOQUE_FEFO_INSUFICIENTE'; end if;

  insert into public.prescricao_eventos(
    empresa_id,unidade_id,prescricao_id,atendimento_id,evento,detalhe,profissional_id,usuario_id
  ) values (
    v_p.empresa_id,v_p.unidade_id,v_p.id,v_p.atendimento_id,'dispensacao_fefo',
    jsonb_build_object('quantidade_total',p_quantidade,'farmacia_local_id',v_local,'alocacoes',v_alocacoes),v_prof,auth.uid()
  );

  return jsonb_build_object('prescricao_id',v_p.id,'farmacia_local_id',v_local,'quantidade_total',p_quantidade,'alocacoes',v_alocacoes);
end;
$$;

create or replace function public.dispensar_componente_prescricao_fefo(
  p_prescricao_componente_id uuid,
  p_quantidade numeric,
  p_farmacia_local_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_c record;
  v_p record;
  v_prod record;
  v_prof uuid;
  v_local uuid;
  v_l record;
  v_remaining numeric := p_quantidade;
  v_take numeric;
  v_disp uuid;
  v_seq integer := 0;
  v_alocacoes jsonb := '[]'::jsonb;
  v_val text;
begin
  if p_quantidade is null or p_quantidade<=0 then raise exception 'FARMACIA_QUANTIDADE_INVALIDA'; end if;

  select c.*,ia.descricao as item_descricao into v_c
  from public.prescricao_componentes c
  join public.itens_assistenciais ia on ia.id=c.item_assistencial_id
  where c.id=p_prescricao_componente_id;
  if not found then raise exception 'FARMACIA_COMPONENTE_NAO_LOCALIZADO'; end if;

  select p.*,a.paciente_id into v_p
  from public.prescricoes p join public.atendimentos a on a.id=p.atendimento_id
  where p.id=v_c.prescricao_id;
  if not found then raise exception 'FARMACIA_PRESCRICAO_NAO_LOCALIZADA'; end if;
  if v_p.assinado_em is null or v_p.status<>'ativa' then raise exception 'FARMACIA_PRESCRICAO_NAO_ASSINADA_ATIVA'; end if;
  if v_c.empresa_id<>v_p.empresa_id or v_c.unidade_id<>v_p.unidade_id or v_c.atendimento_id<>v_p.atendimento_id then
    raise exception 'FARMACIA_COMPONENTE_FORA_ESCOPO';
  end if;
  if not public.tem_permissao(v_p.empresa_id,v_p.unidade_id,'farmacia.dispensar') then
    raise exception 'FARMACIA_SEM_PERMISSAO' using errcode='42501';
  end if;
  if v_p.requer_validacao_farmaceutica then
    select status into v_val from public.validacoes_farmaceuticas where prescricao_id=v_p.id;
    if coalesce(v_val,'pendente') not in ('validada','validada_com_ressalva') then
      raise exception 'FARMACIA_VALIDACAO_FARMACEUTICA_PENDENTE';
    end if;
  end if;

  v_prof:=public.profissional_logado(v_p.empresa_id);
  if v_prof is null then raise exception 'FARMACIA_USUARIO_SEM_PROFISSIONAL'; end if;

  select ep.* into v_prod
  from public.estoque_produtos ep
  where ep.empresa_id=v_p.empresa_id and ep.item_assistencial_id=v_c.item_assistencial_id and ep.ativo
  order by ep.updated_at desc,ep.id
  limit 1;
  if not found then raise exception 'FARMACIA_COMPONENTE_SEM_PRODUTO_ESTOQUE'; end if;

  select fcl.local_id into v_local
  from public.farmacia_catalogo_local fcl
  join public.estoque_locais el on el.id=fcl.local_id
  where fcl.empresa_id=v_p.empresa_id and fcl.unidade_id=v_p.unidade_id
    and fcl.produto_id=v_prod.id and fcl.ativo and fcl.permite_dispensacao
    and el.empresa_id=v_p.empresa_id and el.unidade_id=v_p.unidade_id and el.ativo and el.eh_farmacia
    and (p_farmacia_local_id is null or fcl.local_id=p_farmacia_local_id)
  order by case when p_farmacia_local_id is not null and fcl.local_id=p_farmacia_local_id then 0 else 1 end,
           fcl.padrao desc,el.prioridade_atendimento asc,fcl.local_id
  limit 1;
  if v_local is null then raise exception 'FARMACIA_PRODUTO_SEM_LOCAL_DISPENSACAO'; end if;

  for v_l in
    select l.*,ep.descricao,ep.unidade_medida
    from public.estoque_lotes l
    join public.estoque_produtos ep on ep.id=l.produto_id
    where l.empresa_id=v_p.empresa_id and l.unidade_id=v_p.unidade_id
      and l.local_id=v_local and l.produto_id=v_prod.id
      and l.status='disponivel' and l.quantidade>0
      and l.validade is not null and l.validade>=current_date
    order by l.validade asc,l.created_at asc,l.id
    for update of l
  loop
    exit when v_remaining<=0;
    v_take:=least(v_remaining,v_l.quantidade);
    if v_take<=0 then continue; end if;
    v_seq:=v_seq+1;

    update public.estoque_lotes set quantidade=quantidade-v_take,updated_at=now() where id=v_l.id;

    insert into public.dispensacoes_medicamentos(
      empresa_id,unidade_id,atendimento_id,prescricao_id,prescricao_componente_id,paciente_id,item,lote,validade,
      quantidade,unidade_medida,dispensado_por,dispensado_em,status,produto_id,estoque_lote_id,quantidade_atendida,
      farmacia_local_id,selecao_lote,fefo_sequencia,created_by,updated_by
    ) values (
      v_p.empresa_id,v_p.unidade_id,v_p.atendimento_id,v_p.id,v_c.id,v_p.paciente_id,coalesce(v_c.item_descricao,v_l.descricao),
      v_l.numero_lote,v_l.validade,v_take,v_l.unidade_medida,v_prof,now(),'dispensado',v_l.produto_id,v_l.id,v_take,
      v_local,'fefo',v_seq,auth.uid(),auth.uid()
    ) returning id into v_disp;

    insert into public.estoque_movimentos(
      empresa_id,unidade_id,produto_id,lote_id,local_origem_id,atendimento_id,prescricao_id,tipo,
      quantidade,custo_unitario,motivo,created_by
    ) values (
      v_p.empresa_id,v_p.unidade_id,v_l.produto_id,v_l.id,v_local,v_p.atendimento_id,v_p.id,'consumo_paciente',
      v_take,v_l.custo_unitario,'Dispensação FEFO de componente da prescrição',auth.uid()
    );

    v_alocacoes:=v_alocacoes || jsonb_build_array(jsonb_build_object(
      'dispensacao_id',v_disp,'estoque_lote_id',v_l.id,'lote',v_l.numero_lote,'validade',v_l.validade,
      'quantidade',v_take,'sequencia',v_seq
    ));
    v_remaining:=v_remaining-v_take;
  end loop;

  if v_remaining>0 then raise exception 'FARMACIA_ESTOQUE_FEFO_INSUFICIENTE'; end if;

  insert into public.prescricao_eventos(
    empresa_id,unidade_id,prescricao_id,atendimento_id,evento,detalhe,profissional_id,usuario_id
  ) values (
    v_p.empresa_id,v_p.unidade_id,v_p.id,v_p.atendimento_id,'dispensacao_componente_fefo',
    jsonb_build_object('prescricao_componente_id',v_c.id,'quantidade_total',p_quantidade,'farmacia_local_id',v_local,'alocacoes',v_alocacoes),
    v_prof,auth.uid()
  );

  return jsonb_build_object('prescricao_id',v_p.id,'prescricao_componente_id',v_c.id,'farmacia_local_id',v_local,'quantidade_total',p_quantidade,'alocacoes',v_alocacoes);
end;
$$;

create or replace function public.devolver_medicamento_dispensacao(
  p_dispensacao_id uuid,
  p_quantidade numeric,
  p_motivo text default null
) returns uuid
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_d public.dispensacoes_medicamentos%rowtype;
  v_l public.estoque_lotes%rowtype;
  v_prof uuid;
  v_id uuid;
  v_saldo numeric;
begin
  if p_quantidade is null or p_quantidade<=0 then raise exception 'FARMACIA_QUANTIDADE_INVALIDA'; end if;
  if coalesce(btrim(p_motivo),'')='' then raise exception 'FARMACIA_MOTIVO_DEVOLUCAO_OBRIGATORIO'; end if;

  select * into v_d from public.dispensacoes_medicamentos where id=p_dispensacao_id for update;
  if not found then raise exception 'FARMACIA_DISPENSACAO_NAO_LOCALIZADA'; end if;
  if not public.tem_permissao(v_d.empresa_id,v_d.unidade_id,'farmacia.devolver') then
    raise exception 'FARMACIA_SEM_PERMISSAO' using errcode='42501';
  end if;
  if v_d.estoque_lote_id is null then raise exception 'FARMACIA_DISPENSACAO_SEM_LOTE'; end if;

  v_prof:=public.profissional_logado(v_d.empresa_id);
  if v_prof is null then raise exception 'FARMACIA_USUARIO_SEM_PROFISSIONAL'; end if;

  v_saldo:=v_d.quantidade-coalesce(v_d.quantidade_devolvida,0);
  if p_quantidade>v_saldo then raise exception 'FARMACIA_DEVOLUCAO_SUPERIOR_SALDO'; end if;

  select * into v_l from public.estoque_lotes where id=v_d.estoque_lote_id for update;
  if not found then raise exception 'FARMACIA_LOTE_NAO_LOCALIZADO'; end if;

  update public.estoque_lotes set quantidade=quantidade+p_quantidade,updated_at=now() where id=v_l.id;

  insert into public.devolucoes_medicamentos(
    empresa_id,unidade_id,atendimento_id,dispensacao_id,item,lote,quantidade,motivo,devolvido_por,devolvido_em,
    produto_id,estoque_lote_id,created_by
  ) values (
    v_d.empresa_id,v_d.unidade_id,v_d.atendimento_id,v_d.id,v_d.item,v_d.lote,p_quantidade,p_motivo,
    v_prof,now(),v_d.produto_id,v_d.estoque_lote_id,auth.uid()
  ) returning id into v_id;

  insert into public.estoque_movimentos(
    empresa_id,unidade_id,produto_id,lote_id,local_destino_id,atendimento_id,prescricao_id,tipo,
    quantidade,custo_unitario,motivo,created_by
  ) values (
    v_d.empresa_id,v_d.unidade_id,v_d.produto_id,v_d.estoque_lote_id,coalesce(v_d.farmacia_local_id,v_l.local_id),
    v_d.atendimento_id,v_d.prescricao_id,'devolucao',p_quantidade,v_l.custo_unitario,p_motivo,auth.uid()
  );

  update public.dispensacoes_medicamentos
  set quantidade_devolvida=quantidade_devolvida+p_quantidade,
      status=case when quantidade_devolvida+p_quantidade>=quantidade then 'devolvido' else 'parcial' end,
      updated_at=now(),updated_by=auth.uid()
  where id=v_d.id;

  if v_d.prescricao_id is not null then
    insert into public.prescricao_eventos(
      empresa_id,unidade_id,prescricao_id,atendimento_id,evento,detalhe,profissional_id,usuario_id
    ) values (
      v_d.empresa_id,v_d.unidade_id,v_d.prescricao_id,v_d.atendimento_id,'devolucao_farmacia',
      jsonb_build_object('devolucao_id',v_id,'dispensacao_id',v_d.id,'quantidade',p_quantidade,'motivo',p_motivo),v_prof,auth.uid()
    );
  end if;

  return v_id;
end;
$$;

create or replace function public.registrar_conciliacao_medicamentosa(
  p_atendimento_id uuid,
  p_momento text,
  p_medicamento text,
  p_dose_domiciliar text default null,
  p_via_domiciliar text default null,
  p_frequencia_domiciliar text default null,
  p_fonte_informacao text default null,
  p_decisao text default 'manter',
  p_prescricao_id uuid default null,
  p_divergencia text default null,
  p_intencional boolean default null,
  p_justificativa text default null,
  p_observacoes text default null
) returns uuid
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_a public.atendimentos%rowtype;
  v_prof uuid;
  v_id uuid;
begin
  if p_momento not in ('admissao','transferencia','alta') then raise exception 'CONCILIACAO_MOMENTO_INVALIDO'; end if;
  if p_decisao not in ('manter','suspender','substituir','ajustar','incluir') then raise exception 'CONCILIACAO_DECISAO_INVALIDA'; end if;
  if coalesce(btrim(p_medicamento),'')='' then raise exception 'CONCILIACAO_MEDICAMENTO_OBRIGATORIO'; end if;

  select * into v_a from public.atendimentos where id=p_atendimento_id;
  if not found then raise exception 'CONCILIACAO_ATENDIMENTO_NAO_LOCALIZADO'; end if;
  if not public.tem_permissao(v_a.empresa_id,v_a.unidade_id,'conciliacao_medicamentosa.registrar') then
    raise exception 'CONCILIACAO_SEM_PERMISSAO' using errcode='42501';
  end if;

  v_prof:=public.profissional_logado(v_a.empresa_id);
  if v_prof is null then raise exception 'CONCILIACAO_USUARIO_SEM_PROFISSIONAL'; end if;

  if p_prescricao_id is not null and not exists(
    select 1 from public.prescricoes p where p.id=p_prescricao_id and p.atendimento_id=v_a.id
      and p.empresa_id=v_a.empresa_id and p.unidade_id=v_a.unidade_id
  ) then raise exception 'CONCILIACAO_PRESCRICAO_FORA_ATENDIMENTO'; end if;

  insert into public.conciliacoes_medicamentosas(
    empresa_id,unidade_id,atendimento_id,paciente_id,profissional_id,momento,medicamento,dose_domiciliar,
    via_domiciliar,frequencia_domiciliar,fonte_informacao,decisao,prescricao_id,divergencia,intencional,
    justificativa,conciliado_em,observacoes,created_by,updated_by
  ) values (
    v_a.empresa_id,v_a.unidade_id,v_a.id,v_a.paciente_id,v_prof,p_momento,p_medicamento,p_dose_domiciliar,
    p_via_domiciliar,p_frequencia_domiciliar,p_fonte_informacao,p_decisao,p_prescricao_id,p_divergencia,p_intencional,
    p_justificativa,now(),p_observacoes,auth.uid(),auth.uid()
  ) returning id into v_id;

  if p_prescricao_id is not null then
    insert into public.prescricao_eventos(
      empresa_id,unidade_id,prescricao_id,atendimento_id,evento,detalhe,profissional_id,usuario_id
    ) values (
      v_a.empresa_id,v_a.unidade_id,p_prescricao_id,v_a.id,'conciliacao_medicamentosa',
      jsonb_build_object('conciliacao_id',v_id,'momento',p_momento,'decisao',p_decisao,'medicamento',p_medicamento),v_prof,auth.uid()
    );
  end if;

  return v_id;
end;
$$;

revoke all on function public.dispensar_medicamento_prescricao_fefo(uuid,numeric,uuid) from public,anon;
revoke all on function public.dispensar_componente_prescricao_fefo(uuid,numeric,uuid) from public,anon;
revoke all on function public.registrar_conciliacao_medicamentosa(uuid,text,text,text,text,text,text,text,uuid,text,boolean,text,text) from public,anon;
grant execute on function public.dispensar_medicamento_prescricao_fefo(uuid,numeric,uuid) to authenticated;
grant execute on function public.dispensar_componente_prescricao_fefo(uuid,numeric,uuid) to authenticated;
grant execute on function public.registrar_conciliacao_medicamentosa(uuid,text,text,text,text,text,text,text,uuid,text,boolean,text,text) to authenticated;
