-- Resolução contratual: pacote explicitamente aplicado > mapeamento do contrato > catálogo > fallback.
-- Diárias e taxas não recebem código arbitrário: sem mapeamento ficam pendentes.

create table if not exists public.contrato_producao_mapeamentos (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid null references public.unidades(id),
  contrato_id uuid not null references public.credenciamento_contratos(id),
  tipo_evento text not null,
  acomodacao text null,
  setor text null,
  codigo_tabela text not null default '22',
  codigo text not null,
  item_assistencial_id uuid null references public.itens_assistenciais(id),
  prioridade integer not null default 100,
  vigencia_inicio date null,
  vigencia_fim date null,
  ativo boolean not null default true,
  observacoes text null,
  created_at timestamptz not null default now(),
  created_by uuid null,
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  constraint contrato_producao_tipo_check check (tipo_evento in (
    'consulta_ambulatorial','consulta_pronto_atendimento','visita_medica','procedimento',
    'laboratorio','imagem','exame','sessao_tea_aba','diaria','taxa','medicamento',
    'material','opme','gas_medicinal','honorario','outro'
  )),
  constraint contrato_producao_vigencia_check check (vigencia_fim is null or vigencia_inicio is null or vigencia_fim>=vigencia_inicio)
);

create index if not exists idx_contrato_producao_resolver
  on public.contrato_producao_mapeamentos(contrato_id,tipo_evento,ativo,prioridade,vigencia_inicio);
alter table public.contrato_producao_mapeamentos enable row level security;
drop policy if exists contrato_producao_mapeamentos_select on public.contrato_producao_mapeamentos;
create policy contrato_producao_mapeamentos_select on public.contrato_producao_mapeamentos
for select to authenticated using (public.tem_empresa(empresa_id) and (unidade_id is null or public.tem_unidade(empresa_id,unidade_id)));

create or replace function public.resolver_evento_producao_contratual_internal(p_evento_id uuid)
returns jsonb
language plpgsql security definer
set search_path=public,pg_catalog,extensions
as $$
declare
  v_e public.producao_assistencial_eventos%rowtype;
  v_at public.atendimentos%rowtype;
  v_contrato public.credenciamento_contratos%rowtype;
  v_map public.contrato_producao_mapeamentos%rowtype;
  v_item public.itens_assistenciais%rowtype;
  v_codigo text; v_tabela text; v_origem text:='pendente';
  v_pacote_id uuid; v_pacote_vinculo_id uuid; v_pacote_codigo text; v_pacote_nome text;
  v_pacote_valor numeric; v_quantidade_inclusa numeric; v_cobranca_excedente boolean; v_data date;
begin
  select * into v_e from public.producao_assistencial_eventos where id=p_evento_id;
  if not found then raise exception 'PRODUCAO_EVENTO_NAO_LOCALIZADO'; end if;
  select * into v_at from public.atendimentos where id=v_e.atendimento_id;
  v_data:=(v_e.ocorrido_em at time zone 'America/Sao_Paulo')::date;

  if v_at.convenio_id is not null then
    select * into v_contrato from public.credenciamento_contratos c
    where c.empresa_id=v_e.empresa_id and c.convenio_id=v_at.convenio_id
      and (c.unidade_id is null or c.unidade_id=v_e.unidade_id) and c.status='ativo'
      and (c.data_inicio is null or c.data_inicio<=v_data) and (c.data_fim is null or c.data_fim>=v_data)
    order by case when c.unidade_id=v_e.unidade_id then 0 else 1 end,c.data_inicio desc nulls last,c.created_at desc limit 1;
  end if;

  if v_e.item_assistencial_id is not null then
    select * into v_item from public.itens_assistenciais where id=v_e.item_assistencial_id and empresa_id=v_e.empresa_id and ativo;
  end if;

  if v_contrato.id is not null then
    select * into v_map from public.contrato_producao_mapeamentos m
    where m.contrato_id=v_contrato.id and m.empresa_id=v_e.empresa_id
      and (m.unidade_id is null or m.unidade_id=v_e.unidade_id) and m.ativo and m.tipo_evento=v_e.tipo_evento
      and (m.acomodacao is null or lower(m.acomodacao)=lower(coalesce(v_e.metadados->>'acomodacao','')))
      and (m.setor is null or lower(m.setor)=lower(coalesce(v_e.setor,v_e.metadados->>'setor','')))
      and (m.vigencia_inicio is null or m.vigencia_inicio<=v_data) and (m.vigencia_fim is null or m.vigencia_fim>=v_data)
    order by case when m.acomodacao is not null then 0 else 1 end,case when m.setor is not null then 0 else 1 end,m.prioridade,m.vigencia_inicio desc nulls last,m.created_at desc limit 1;
  end if;

  if v_map.id is not null then
    v_codigo:=v_map.codigo; v_tabela:=v_map.codigo_tabela; v_origem:='contrato';
    if v_map.item_assistencial_id is not null then select * into v_item from public.itens_assistenciais where id=v_map.item_assistencial_id and empresa_id=v_e.empresa_id and ativo; end if;
  elsif v_item.id is not null then
    v_codigo:=case when v_item.tabela_tiss_codigo in ('00','98') then v_item.codigo_tabela_propria else v_item.codigo_tuss end;
    v_tabela:=v_item.tabela_tiss_codigo; v_origem:='catalogo';
  elsif v_e.codigo_tuss_fallback is not null then
    v_codigo:=v_e.codigo_tuss_fallback; v_tabela:='22'; v_origem:='fallback';
  end if;

  if v_contrato.id is not null and v_codigo is not null then
    select ap.id,p.id,p.codigo,p.nome,p.valor,pi.quantidade_inclusa,pi.cobranca_excedente
    into v_pacote_vinculo_id,v_pacote_id,v_pacote_codigo,v_pacote_nome,v_pacote_valor,v_quantidade_inclusa,v_cobranca_excedente
    from public.atendimento_pacotes_contratados ap
    join public.contrato_pacotes p on p.id=ap.pacote_id and p.contrato_id=ap.contrato_id
    join public.contrato_pacote_itens pi on pi.pacote_id=p.id and pi.codigo=v_codigo
    where ap.atendimento_id=v_e.atendimento_id and ap.empresa_id=v_e.empresa_id and ap.unidade_id=v_e.unidade_id
      and ap.contrato_id=v_contrato.id and ap.status='ativo' and p.ativo
      and (p.vigencia_inicio is null or p.vigencia_inicio<=v_data) and (p.vigencia_fim is null or p.vigencia_fim>=v_data)
      and (pi.tabela is null or pi.tabela=v_tabela)
    order by ap.aplicado_em,p.created_at limit 1;
  end if;

  if v_pacote_id is not null then
    return jsonb_build_object('status','pacote','contrato_id',v_contrato.id,'pacote_vinculo_id',v_pacote_vinculo_id,'pacote_id',v_pacote_id,'pacote_codigo',v_pacote_codigo,'pacote_nome',v_pacote_nome,'pacote_valor',v_pacote_valor,'quantidade_inclusa',v_quantidade_inclusa,'cobranca_excedente',coalesce(v_cobranca_excedente,false),'codigo_evento',v_codigo,'tabela_evento',v_tabela,'item_assistencial_id',v_item.id,'origem_codigo',v_origem,'mapeamento_id',v_map.id);
  end if;

  if v_codigo is null then
    return jsonb_build_object('status','pendente_codigo','contrato_id',v_contrato.id,'origem_codigo','pendente','motivo',case when v_e.tipo_evento in ('diaria','taxa') then 'codigo_deve_ser_configurado_no_contrato' else 'codigo_nao_resolvido' end);
  end if;

  return jsonb_build_object('status','individual','contrato_id',v_contrato.id,'codigo_evento',v_codigo,'tabela_evento',coalesce(v_tabela,'22'),'item_assistencial_id',v_item.id,'origem_codigo',v_origem,'mapeamento_id',v_map.id);
end $$;
revoke execute on function public.resolver_evento_producao_contratual_internal(uuid) from public,anon,authenticated;

create or replace function public.consolidar_producao_conta_internal(p_atendimento_id uuid,p_conta_id uuid)
returns jsonb
language plpgsql security definer
set search_path=public,pg_catalog,extensions
as $$
declare
  v_conta public.contas_faturamento%rowtype; r record; v_res jsonb; v_status text; v_codigo text; v_tabela text;
  v_item_id uuid; v_pacote_id uuid; v_pacote_vinculo_id uuid; v_pacote_valor numeric; v_qtd_inclusa numeric;
  v_excedente numeric; v_cobranca_excedente boolean; v_inserted integer:=0; v_pendentes integer:=0; v_pacotes integer:=0;
begin
  select * into v_conta from public.contas_faturamento where id=p_conta_id and atendimento_id=p_atendimento_id;
  if not found then raise exception 'PRODUCAO_CONTA_INVALIDA'; end if;
  if v_conta.status in ('pronta','faturada','cancelada') then return jsonb_build_object('preservada',true,'status',v_conta.status,'itens',0); end if;

  for r in select * from public.producao_assistencial_eventos e where e.atendimento_id=p_atendimento_id and e.empresa_id=v_conta.empresa_id and e.unidade_id=v_conta.unidade_id and e.status not in ('cancelado','estornado') order by e.ocorrido_em,e.created_at loop
    v_res:=public.resolver_evento_producao_contratual_internal(r.id);
    v_status:=v_res->>'status'; v_codigo:=v_res->>'codigo_evento'; v_tabela:=v_res->>'tabela_evento';
    v_item_id:=nullif(v_res->>'item_assistencial_id','')::uuid; v_pacote_id:=nullif(v_res->>'pacote_id','')::uuid;
    v_pacote_vinculo_id:=nullif(v_res->>'pacote_vinculo_id','')::uuid; v_pacote_valor:=coalesce((v_res->>'pacote_valor')::numeric,0);
    v_qtd_inclusa:=coalesce((v_res->>'quantidade_inclusa')::numeric,r.quantidade); v_cobranca_excedente:=coalesce((v_res->>'cobranca_excedente')::boolean,false);

    if v_status='pacote' then
      insert into public.conta_faturamento_itens(conta_id,origem_tipo,origem_id,producao_evento_id,data_execucao,tabela,codigo,descricao,quantidade,valor_unitario,valor_total,profissional_id,setor,cobravel,observacao,item_assistencial_id,categoria_item,familia_tuss,pacote_id,memoria_calculo)
      values(p_conta_id,'pacote',v_pacote_vinculo_id,null,r.ocorrido_em,'98',v_res->>'pacote_codigo',coalesce(v_res->>'pacote_nome','Pacote contratual'),1,v_pacote_valor,v_pacote_valor,null,r.setor,true,'Pacote explicitamente aplicado ao atendimento; possui prioridade sobre itens individuais.',null,'pacote',null,v_pacote_id,jsonb_build_object('origem','livro_producao','resolucao',v_res))
      on conflict (conta_id,origem_tipo,origem_id) do update set valor_unitario=excluded.valor_unitario,valor_total=excluded.valor_total,pacote_id=excluded.pacote_id,memoria_calculo=excluded.memoria_calculo;

      insert into public.conta_faturamento_itens(conta_id,origem_tipo,origem_id,producao_evento_id,data_execucao,tabela,codigo,descricao,quantidade,valor_unitario,valor_total,profissional_id,setor,cobravel,observacao,item_assistencial_id,categoria_item,familia_tuss,pacote_id,memoria_calculo)
      values(p_conta_id,'producao',r.id,r.id,r.ocorrido_em,v_tabela,v_codigo,coalesce((select descricao from public.itens_assistenciais where id=coalesce(v_item_id,r.item_assistencial_id)),replace(r.tipo_evento,'_',' ')),least(r.quantidade,v_qtd_inclusa),0,0,r.profissional_id,r.setor,false,'Produção absorvida pelo pacote contratual.',coalesce(v_item_id,r.item_assistencial_id),case when r.tipo_evento='diaria' then 'diaria' when r.tipo_evento='taxa' then 'taxa' else 'procedimento' end,(select familia_tuss from public.itens_assistenciais where id=coalesce(v_item_id,r.item_assistencial_id)),v_pacote_id,jsonb_build_object('origem','livro_producao','resolucao',v_res,'quantidade_total',r.quantidade))
      on conflict (conta_id,origem_tipo,origem_id) do update set producao_evento_id=excluded.producao_evento_id,tabela=excluded.tabela,codigo=excluded.codigo,descricao=excluded.descricao,quantidade=excluded.quantidade,cobravel=false,pacote_id=excluded.pacote_id,memoria_calculo=excluded.memoria_calculo;

      v_excedente:=greatest(r.quantidade-v_qtd_inclusa,0);
      if v_excedente>0 and v_cobranca_excedente then
        insert into public.conta_faturamento_itens(conta_id,origem_tipo,origem_id,producao_evento_id,data_execucao,tabela,codigo,descricao,quantidade,valor_unitario,valor_total,profissional_id,setor,cobravel,observacao,item_assistencial_id,categoria_item,familia_tuss,pacote_id,memoria_calculo)
        values(p_conta_id,'producao_excedente',r.id,r.id,r.ocorrido_em,v_tabela,v_codigo,coalesce((select descricao from public.itens_assistenciais where id=coalesce(v_item_id,r.item_assistencial_id)),replace(r.tipo_evento,'_',' ')),v_excedente,0,0,r.profissional_id,r.setor,true,'Quantidade excedente ao pacote; precificar pelo contrato.',coalesce(v_item_id,r.item_assistencial_id),case when r.tipo_evento='diaria' then 'diaria' when r.tipo_evento='taxa' then 'taxa' else 'procedimento' end,(select familia_tuss from public.itens_assistenciais where id=coalesce(v_item_id,r.item_assistencial_id)),v_pacote_id,jsonb_build_object('origem','livro_producao','resolucao',v_res,'quantidade_excedente',v_excedente))
        on conflict (conta_id,origem_tipo,origem_id) do update set quantidade=excluded.quantidade,cobravel=true,tabela=excluded.tabela,codigo=excluded.codigo,producao_evento_id=excluded.producao_evento_id,memoria_calculo=excluded.memoria_calculo;
      end if;
      v_pacotes:=v_pacotes+1;
    else
      insert into public.conta_faturamento_itens(conta_id,origem_tipo,origem_id,producao_evento_id,data_execucao,tabela,codigo,descricao,quantidade,valor_unitario,valor_total,profissional_id,setor,cobravel,observacao,item_assistencial_id,categoria_item,familia_tuss,memoria_calculo)
      values(p_conta_id,'producao',r.id,r.id,r.ocorrido_em,v_tabela,v_codigo,coalesce((select descricao from public.itens_assistenciais where id=coalesce(v_item_id,r.item_assistencial_id)),replace(r.tipo_evento,'_',' ')),r.quantidade,0,0,r.profissional_id,r.setor,(r.cobravel and v_status='individual'),case when v_status='pendente_codigo' then 'Pendente: código deve ser resolvido/configurado no contrato antes da cobrança.' else 'Gerado automaticamente pelo Livro de Produção Assistencial.' end,coalesce(v_item_id,r.item_assistencial_id),case when r.tipo_evento='diaria' then 'diaria' when r.tipo_evento='taxa' then 'taxa' when r.tipo_evento='medicamento' then 'medicamento' when r.tipo_evento='material' then 'material' when r.tipo_evento='opme' then 'opme' when r.tipo_evento='gas_medicinal' then 'gas_medicinal' else 'procedimento' end,(select familia_tuss from public.itens_assistenciais where id=coalesce(v_item_id,r.item_assistencial_id)),jsonb_build_object('origem','livro_producao','resolucao',v_res))
      on conflict (conta_id,origem_tipo,origem_id) do update set producao_evento_id=excluded.producao_evento_id,tabela=excluded.tabela,codigo=excluded.codigo,descricao=excluded.descricao,quantidade=excluded.quantidade,cobravel=excluded.cobravel,observacao=excluded.observacao,item_assistencial_id=excluded.item_assistencial_id,categoria_item=excluded.categoria_item,familia_tuss=excluded.familia_tuss,memoria_calculo=excluded.memoria_calculo;
      if v_status='pendente_codigo' then v_pendentes:=v_pendentes+1; end if;
    end if;

    update public.producao_assistencial_eventos set status='consolidado',consolidado_em=coalesce(consolidado_em,now()),updated_at=now(),updated_by=auth.uid() where id=r.id;
    v_inserted:=v_inserted+1;
  end loop;
  return jsonb_build_object('eventos_processados',v_inserted,'pendentes_codigo',v_pendentes,'eventos_em_pacote',v_pacotes);
end $$;
revoke execute on function public.consolidar_producao_conta_internal(uuid,uuid) from public,anon,authenticated;

create or replace function public.preparar_conta_pos_alta_livro_internal(p_atendimento_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog,extensions
as $$
declare
  v_at public.atendimentos%rowtype; v_conta_id uuid; v_status text; v_sync jsonb; v_cons jsonb;
  v_auditoria_id uuid; v_criticas integer:=0; v_total numeric(14,2):=0; v_precificados integer:=0; r record;
begin
  select * into v_at from public.atendimentos where id=p_atendimento_id;
  if not found then raise exception 'FAT_POS_ALTA_ATENDIMENTO_NAO_LOCALIZADO'; end if;
  if v_at.status<>'alta' then raise exception 'FAT_POS_ALTA_ATENDIMENTO_NAO_FINALIZADO'; end if;
  if auth.uid() is not null and not public.tem_unidade(v_at.empresa_id,v_at.unidade_id) then raise exception 'FAT_POS_ALTA_SEM_ACESSO_UNIDADE' using errcode='42501'; end if;

  select id,status into v_conta_id,v_status from public.contas_faturamento where atendimento_id=v_at.id limit 1;
  if v_conta_id is not null and v_status in ('pronta','faturada','cancelada') then return jsonb_build_object('conta_id',v_conta_id,'status',v_status,'preservada',true,'motivo','conta_em_estado_protegido'); end if;

  if v_conta_id is null then
    insert into public.contas_faturamento(empresa_id,unidade_id,atendimento_id,paciente_id,convenio_id,plano_id,competencia,tipo_cobranca,status,auditoria_liberada,contas_medicas_liberada,created_by,updated_by)
    values(v_at.empresa_id,v_at.unidade_id,v_at.id,v_at.paciente_id,v_at.convenio_id,v_at.plano_id,to_char(coalesce(v_at.data_fechamento,now()) at time zone 'America/Sao_Paulo','YYYY-MM'),case when v_at.cobertura::text='convenio' then 'convenio' else 'particular' end,'pre_faturamento',false,false,auth.uid(),auth.uid()) returning id,status into v_conta_id,v_status;
  else
    update public.contas_faturamento set status=case when status in ('aberta','pre_faturamento','com_criticas') then 'pre_faturamento' else status end,competencia=coalesce(nullif(competencia,''),to_char(coalesce(v_at.data_fechamento,now()) at time zone 'America/Sao_Paulo','YYYY-MM')),updated_at=now(),updated_by=auth.uid() where id=v_conta_id;
  end if;

  v_sync:=public.sincronizar_producao_atendimento_internal(v_at.id);
  v_cons:=public.consolidar_producao_conta_internal(v_at.id,v_conta_id);

  for r in select id from public.conta_faturamento_itens where conta_id=v_conta_id and cobravel and origem_tipo in ('producao','producao_excedente') and codigo is not null loop
    begin
      perform public.recalcular_item_contratual_avancado_internal(r.id);
      update public.conta_faturamento_itens set valor_unitario=coalesce(valor_contratual_calculado,valor_unitario,0),valor_total=round(coalesce(valor_contratual_calculado,valor_unitario,0)*quantidade,2) where id=r.id;
      v_precificados:=v_precificados+1;
    exception when others then raise warning 'PRECIFICACAO_PRODUCAO_PENDENTE item=% sqlstate=%',r.id,sqlstate; end;
  end loop;

  select coalesce(sum(case when cobravel then valor_total else 0 end),0) into v_total from public.conta_faturamento_itens where conta_id=v_conta_id;
  update public.contas_faturamento set valor_bruto=v_total,valor_liquido=greatest(v_total-coalesce(valor_desconto,0),0),updated_at=now(),updated_by=auth.uid() where id=v_conta_id;

  v_auditoria_id:=public.encaminhar_conta_para_auditoria_internal(v_at.id);
  begin v_criticas:=public.executar_auditoria_conta_automatica_internal(v_auditoria_id); exception when others then raise warning 'AUDITORIA_AUTOMATICA_PRODUCAO_PENDENTE auditoria=% sqlstate=%',v_auditoria_id,sqlstate; end;

  return jsonb_build_object('conta_id',v_conta_id,'auditoria_id',v_auditoria_id,'status','pre_faturamento','sincronizacao',v_sync,'consolidacao',v_cons,'itens_precificados',v_precificados,'valor_bruto',v_total,'criticas_auditoria',v_criticas);
end $$;
revoke execute on function public.preparar_conta_pos_alta_livro_internal(uuid) from public,anon,authenticated;

create or replace function public.preparar_conta_pos_alta_internal(p_atendimento_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog
as $$
declare v_conta record;
begin
  select id,status into v_conta from public.contas_faturamento where atendimento_id=p_atendimento_id limit 1;
  if v_conta.id is not null and v_conta.status in ('pronta','faturada','cancelada') then return jsonb_build_object('conta_id',v_conta.id,'status',v_conta.status,'preservada',true,'motivo','conta_em_estado_protegido'); end if;
  return public.preparar_conta_pos_alta_livro_internal(p_atendimento_id);
end $$;
revoke execute on function public.preparar_conta_pos_alta_internal(uuid) from public,anon,authenticated;
