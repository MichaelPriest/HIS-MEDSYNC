begin;

-- ============================================================================
-- MedSync HIS - reconciliacao final do schema (2026-08-23)
-- Objetivo: reconciliar bancos que ja receberam parte das migrations sem apagar
-- dados, sem recriar objetos existentes e sem depender de ordem ambigua.
-- Esta migration pressupoe que a fundacao (empresas/unidades/permissoes) exista.
-- ============================================================================

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.empresas') is null
     or to_regclass('public.unidades') is null
     or to_regclass('public.permissoes') is null then
    raise exception 'Fundacao do MedSync HIS ausente. Aplique primeiro as migrations 202608220001+ antes da reconciliacao final.';
  end if;
end $$;

insert into public.permissoes(codigo,descricao) values
('autorizacoes.visualizar','Visualizar autorizações assistenciais'),
('autorizacoes.editar','Solicitar e atualizar autorizações'),
('triagem.encaminhar','Definir especialidade e encaminhar paciente'),
('fila_medica.visualizar','Visualizar fila médica da própria especialidade'),
('fila_medica.assumir','Assumir paciente da própria especialidade'),
('paineis.configurar','Configurar painéis e chamadas'),
('compras.visualizar','Visualizar compras'),
('compras.gerenciar','Gerenciar compras'),
('compras.receber','Receber pedidos de compra e integrar estoque/financeiro'),
('estoque.visualizar','Visualizar estoque e almoxarifado'),
('estoque.gerenciar','Gerenciar estoque e almoxarifado'),
('auditoria.visualizar','Visualizar auditoria de contas'),
('auditoria.executar','Auditar e liberar contas'),
('guias.visualizar','Visualizar central de guias'),
('guias.gerenciar','Gerenciar autorizações e guias'),
('credenciamento.visualizar','Visualizar comercial e credenciamento'),
('credenciamento.gerenciar','Gerenciar contratos e credenciamento'),
('ged.visualizar','Visualizar documentos GED'),
('ged.gerenciar','Gerenciar documentos GED'),
('contas_medicas.visualizar','Visualizar contas médicas'),
('contas_medicas.processar','Processar contas médicas'),
('diretoria.visualizar','Visualizar painel da diretoria'),
('tabelas_comerciais.visualizar','Visualizar tabelas comerciais e referenciais'),
('tabelas_comerciais.gerenciar','Gerenciar edições e valores de tabelas comerciais'),
('tabelas_procedimentos.visualizar','Visualizar tabelas de procedimentos e regras contratuais'),
('tabelas_procedimentos.gerenciar','Gerenciar tabelas de procedimentos e regras contratuais')
on conflict (codigo) do update set descricao=excluded.descricao;

alter table if exists public.profissionais add column if not exists usuario_id uuid references auth.users(id);
alter table if exists public.atendimentos add column if not exists especialidade_destino text;
alter table if exists public.atendimentos add column if not exists triagem_concluida_em timestamptz;

do $$ begin
  if to_regclass('public.profissionais') is not null then
    create unique index if not exists profissionais_usuario_unique on public.profissionais(usuario_id) where usuario_id is not null;
  end if;
end $$;

alter table if exists public.contas_faturamento add column if not exists auditoria_liberada boolean not null default false;
alter table if exists public.contas_faturamento add column if not exists contas_medicas_liberada boolean not null default false;
alter table if exists public.contas_faturamento add column if not exists contas_medicas_liberada_em timestamptz;

do $$ begin
  if to_regclass('public.contas_faturamento') is not null and to_regclass('public.auditoria_contas') is not null then
    alter table public.contas_faturamento add column if not exists auditoria_id uuid references public.auditoria_contas(id);
  end if;
end $$;

alter table if exists public.central_guias add column if not exists codigo_procedimento text;
alter table if exists public.central_guias add column if not exists descricao_procedimento text;
alter table if exists public.central_guias add column if not exists categoria_preco text default 'procedimentos';
alter table if exists public.central_guias add column if not exists valor_contratual numeric(14,2);
alter table if exists public.central_guias add column if not exists valor_solicitado numeric(14,2);
alter table if exists public.central_guias add column if not exists valor_autorizado numeric(14,2);
alter table if exists public.central_guias add column if not exists metodologia_preco text;
alter table if exists public.central_guias add column if not exists memoria_calculo_preco jsonb not null default '{}'::jsonb;

do $$ begin
  if to_regclass('public.central_guias') is not null and to_regclass('public.tabelas_procedimentos_edicoes') is not null then
    alter table public.central_guias add column if not exists edicao_preco_id uuid references public.tabelas_procedimentos_edicoes(id);
  end if;
end $$;

alter table if exists public.conta_faturamento_itens add column if not exists metodologia_preco text;
alter table if exists public.conta_faturamento_itens add column if not exists valor_referencia numeric(14,4);
alter table if exists public.conta_faturamento_itens add column if not exists valor_referencia_contrato numeric(14,4);
alter table if exists public.conta_faturamento_itens add column if not exists origem_valor text;
alter table if exists public.conta_faturamento_itens add column if not exists memoria_calculo jsonb not null default '{}'::jsonb;
alter table if exists public.conta_faturamento_itens add column if not exists memoria_calculo_comercial jsonb;
alter table if exists public.conta_faturamento_itens add column if not exists valor_cobrado_original numeric(14,4);
alter table if exists public.conta_faturamento_itens add column if not exists divergencia_valor_contratual numeric(14,4);
alter table if exists public.conta_faturamento_itens add column if not exists sequencia_ato integer;
alter table if exists public.conta_faturamento_itens add column if not exists percentual_aplicado numeric(8,4);
alter table if exists public.conta_faturamento_itens add column if not exists valor_contratual_calculado numeric(14,2);
alter table if exists public.conta_faturamento_itens add column if not exists valor_filme numeric(14,2);
alter table if exists public.conta_faturamento_itens add column if not exists valor_anestesista numeric(14,2);
alter table if exists public.conta_faturamento_itens add column if not exists valor_auxiliares numeric(14,2);
alter table if exists public.conta_faturamento_itens add column if not exists via_acesso text;
alter table if exists public.conta_faturamento_itens add column if not exists urgencia boolean not null default false;
alter table if exists public.conta_faturamento_itens add column if not exists horario_especial boolean not null default false;
alter table if exists public.conta_faturamento_itens add column if not exists acomodacao_individual boolean not null default false;
alter table if exists public.conta_faturamento_itens add column if not exists anestesia boolean not null default false;
alter table if exists public.conta_faturamento_itens add column if not exists quantidade_auxiliares integer not null default 0;
alter table if exists public.conta_faturamento_itens add column if not exists filme_m2 numeric(14,4) not null default 0;

do $$ begin
  if to_regclass('public.conta_faturamento_itens') is not null and to_regclass('public.tabelas_comerciais_edicoes') is not null then
    alter table public.conta_faturamento_itens add column if not exists tabela_comercial_edicao_id uuid references public.tabelas_comerciais_edicoes(id);
  end if;
  if to_regclass('public.conta_faturamento_itens') is not null and to_regclass('public.tabelas_comerciais_itens') is not null then
    alter table public.conta_faturamento_itens add column if not exists tabela_comercial_item_id uuid references public.tabelas_comerciais_itens(id);
  end if;
  if to_regclass('public.conta_faturamento_itens') is not null and to_regclass('public.tabelas_procedimentos_edicoes') is not null then
    alter table public.conta_faturamento_itens add column if not exists tabela_procedimento_edicao_id uuid references public.tabelas_procedimentos_edicoes(id);
  end if;
  if to_regclass('public.conta_faturamento_itens') is not null and to_regclass('public.tabelas_procedimentos_itens') is not null then
    alter table public.conta_faturamento_itens add column if not exists tabela_procedimento_item_id uuid references public.tabelas_procedimentos_itens(id);
  end if;
  if to_regclass('public.conta_faturamento_itens') is not null and to_regclass('public.conta_faturamento_grupos_ato') is not null then
    alter table public.conta_faturamento_itens add column if not exists grupo_ato_id uuid references public.conta_faturamento_grupos_ato(id);
  end if;
  if to_regclass('public.conta_faturamento_itens') is not null and to_regclass('public.contrato_regras_faturamento') is not null then
    alter table public.conta_faturamento_itens add column if not exists regra_contratual_id uuid references public.contrato_regras_faturamento(id);
  end if;
  if to_regclass('public.conta_faturamento_itens') is not null and to_regclass('public.contrato_pacotes') is not null then
    alter table public.conta_faturamento_itens add column if not exists pacote_id uuid references public.contrato_pacotes(id);
  end if;
end $$;

alter table if exists public.tiss_lotes add column if not exists previsao_pagamento date;
alter table if exists public.tiss_lotes add column if not exists data_envio_manual timestamptz;
alter table if exists public.tiss_lotes add column if not exists protocolo_envio_operadora text;
alter table if exists public.tiss_lotes add column if not exists origem_protocolo text;
alter table if exists public.tiss_lotes add column if not exists observacoes_envio text;

do $$ begin
  if to_regclass('public.central_guias') is not null then execute 'create index if not exists central_guias_atendimento_idx on public.central_guias(atendimento_id,status)'; end if;
  if to_regclass('public.contas_medicas_processos') is not null then execute 'create index if not exists contas_medicas_status_idx on public.contas_medicas_processos(empresa_id,unidade_id,status,created_at desc)'; end if;
  if to_regclass('public.ged_documentos') is not null then
    execute 'create index if not exists ged_atendimento_idx on public.ged_documentos(atendimento_id,categoria,created_at desc)';
    execute 'create index if not exists ged_conta_idx on public.ged_documentos(conta_faturamento_id,categoria,created_at desc)';
  end if;
  if to_regclass('public.financeiro_contas_pagar') is not null then execute 'create index if not exists financeiro_pagar_vencimento_idx on public.financeiro_contas_pagar(empresa_id,unidade_id,status,vencimento)'; end if;
  if to_regclass('public.encaminhamentos_assistenciais') is not null then execute 'create index if not exists idx_encaminhamentos_especialidade_status on public.encaminhamentos_assistenciais(unidade_id,especialidade,status,created_at)'; end if;
end $$;

do $$ begin
  if to_regclass('public.financeiro_recebiveis') is not null
     and to_regclass('public.financeiro_contas_pagar') is not null
     and to_regclass('public.tiss_glosas') is not null
     and to_regclass('public.auditoria_contas') is not null
     and to_regclass('public.contas_medicas_processos') is not null
     and to_regclass('public.internacoes') is not null
     and to_regclass('public.contas_faturamento') is not null then
    execute $view$
      create or replace view public.vw_diretoria_indicadores
      with (security_invoker=true)
      as
      select
        u.empresa_id,
        u.id as unidade_id,
        (select count(*) from public.atendimentos a where a.unidade_id=u.id and a.data_abertura::date=current_date) as atendimentos_hoje,
        (select count(*) from public.internacoes i where i.unidade_id=u.id and i.status in ('internado','transferido')) as pacientes_internados,
        (select coalesce(sum(cf.valor_liquido),0) from public.contas_faturamento cf where cf.unidade_id=u.id and cf.competencia=to_char(current_date,'YYYY-MM')) as faturamento_competencia,
        (select coalesce(sum(fr.valor_liquido_previsto-fr.valor_recebido),0) from public.financeiro_recebiveis fr where fr.unidade_id=u.id and fr.status in ('previsto','faturado','aguardando_pagamento','parcial','vencido')) as contas_receber_aberto,
        (select coalesce(sum(fp.valor_bruto-fp.valor_pago),0) from public.financeiro_contas_pagar fp where fp.unidade_id=u.id and fp.status in ('aberto','parcial','vencido')) as contas_pagar_aberto,
        (select coalesce(sum(g.valor_glosado),0) from public.tiss_glosas g where g.unidade_id=u.id and g.status in ('aberta','em_recurso')) as glosas_abertas,
        (select count(*) from public.auditoria_contas ac where ac.unidade_id=u.id and ac.status in ('aguardando','em_auditoria','pendencia_assistencial','pendencia_autorizacao','pendencia_documental','devolvida')) as contas_em_auditoria,
        (select count(*) from public.contas_medicas_processos cm where cm.unidade_id=u.id and cm.status not in ('liberada_tiss','cancelada')) as contas_medicas_pendentes
      from public.unidades u
    $view$;
    grant select on public.vw_diretoria_indicadores to authenticated;
  end if;
end $$;

do $$ begin
  if to_regprocedure('public.obter_valor_procedimento_contratual(uuid,text,date,text,boolean,boolean)') is not null
     and to_regclass('public.contrato_regras_faturamento') is not null
     and to_regclass('public.conta_faturamento_grupos_ato') is not null
     and to_regclass('public.conta_faturamento_itens') is not null then
    execute $fn$
      create or replace function public.recalcular_item_contratual_avancado(p_item_id uuid)
      returns jsonb
      language plpgsql
      security definer
      set search_path=public
      as $body$
      declare
        v_item record; v_preco record; v_contrato_id uuid;
        v_regra_id uuid:=null; v_regra_codigo text:=null; v_regra_percentual numeric:=null; v_regra_valor_fixo numeric:=null;
        v_base numeric:=0; v_final numeric:=0; v_percentual numeric:=100; v_valor_fixo numeric:=0;
        v_categoria text:='procedimentos'; v_memoria jsonb:='{}'::jsonb;
        v_grupo_codigo text:=null; v_via_acesso text:=null; v_acomodacao text:=null; v_urgencia boolean:=false;
      begin
        select i.*,c.convenio_id into v_item from public.conta_faturamento_itens i join public.contas_faturamento c on c.id=i.conta_id where i.id=p_item_id;
        if v_item.id is null or v_item.convenio_id is null or v_item.codigo is null then return null; end if;
        if v_item.grupo_ato_id is not null then
          select g.codigo_grupo,g.via_acesso,g.acomodacao,g.urgencia into v_grupo_codigo,v_via_acesso,v_acomodacao,v_urgencia from public.conta_faturamento_grupos_ato g where g.id=v_item.grupo_ato_id;
        end if;
        v_categoria:=case when v_item.origem_tipo in ('exame','laboratorio','imagem') then 'exames' when v_item.origem_tipo='honorario' then 'honorarios' when v_item.origem_tipo='diaria' then 'diarias' when v_item.origem_tipo='taxa' then 'taxas' else 'procedimentos' end;
        select * into v_preco from public.obter_valor_procedimento_contratual(v_item.convenio_id,v_item.codigo,coalesce(v_item.data_execucao::date,current_date),v_categoria,coalesce(v_urgencia,false),lower(coalesce(v_acomodacao,'')) in ('apartamento','individual','quarto')) limit 1;
        if v_preco.valor is null then return null; end if;
        v_base:=v_preco.valor; v_final:=v_base;
        select c.id into v_contrato_id from public.credenciamento_contratos c where c.convenio_id=v_item.convenio_id and c.status='ativo' and (c.data_inicio is null or c.data_inicio<=coalesce(v_item.data_execucao::date,current_date)) and (c.data_fim is null or c.data_fim>=coalesce(v_item.data_execucao::date,current_date)) order by c.data_inicio desc nulls last,c.created_at desc limit 1;
        if v_contrato_id is not null and coalesce(v_item.sequencia_ato,1)>1 then
          select r.id,r.codigo_regra,r.percentual,r.valor_fixo into v_regra_id,v_regra_codigo,v_regra_percentual,v_regra_valor_fixo
          from public.contrato_regras_faturamento r
          where r.contrato_id=v_contrato_id and r.ativo=true and r.codigo_regra in ('MULTIPLO_'||v_item.sequencia_ato::text,'MULTIPLO_N')
            and (r.vigencia_inicio is null or r.vigencia_inicio<=coalesce(v_item.data_execucao::date,current_date))
            and (r.vigencia_fim is null or r.vigencia_fim>=coalesce(v_item.data_execucao::date,current_date))
          order by case when r.codigo_regra='MULTIPLO_'||v_item.sequencia_ato::text then 0 else 1 end,r.prioridade limit 1;
          if v_regra_id is not null then
            if v_regra_percentual is not null then v_percentual:=v_regra_percentual; v_final:=v_final*(v_percentual/100.0); end if;
            if v_regra_valor_fixo is not null then v_valor_fixo:=v_regra_valor_fixo; v_final:=v_final+v_valor_fixo; end if;
          end if;
        end if;
        v_memoria:=coalesce(v_preco.memoria,'{}'::jsonb)||jsonb_build_object('valor_base',round(v_base,2),'sequencia_ato',coalesce(v_item.sequencia_ato,1),'grupo_ato',v_grupo_codigo,'via_acesso',v_via_acesso,'acomodacao',v_acomodacao,'urgencia',v_urgencia,'regra_multiplo',v_regra_codigo,'percentual_sequencia',v_percentual,'adicional_fixo',v_valor_fixo,'valor_final',round(v_final,2));
        update public.conta_faturamento_itens set metodologia_preco=v_preco.metodologia,tabela_procedimento_edicao_id=v_preco.edicao_id,tabela_procedimento_item_id=v_preco.item_id,valor_referencia=v_base,valor_contratual_calculado=round(v_final,2),percentual_aplicado=v_percentual,regra_contratual_id=v_regra_id,memoria_calculo=v_memoria where id=p_item_id;
        return v_memoria;
      end;
      $body$
    $fn$;
    grant execute on function public.recalcular_item_contratual_avancado(uuid) to authenticated;
  end if;
end $$;

create or replace function public.validar_schema_his()
returns table(grupo text,objeto text,status text,detalhe text)
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  r record;
begin
  for r in select * from (values
    ('core','empresas','public.empresas'),('core','unidades','public.unidades'),('core','pacientes','public.pacientes'),('core','profissionais','public.profissionais'),('core','convenios','public.convenios'),('core','atendimentos','public.atendimentos'),
    ('assistencial','triagens','public.triagens'),('assistencial','prontuario_evolucoes','public.prontuario_evolucoes'),('assistencial','prescricoes','public.prescricoes'),('assistencial','internacoes','public.internacoes'),('assistencial','autorizacoes_atendimento','public.autorizacoes_atendimento'),('assistencial','encaminhamentos_assistenciais','public.encaminhamentos_assistenciais'),
    ('corporativo','fornecedores','public.fornecedores'),('corporativo','estoque_produtos','public.estoque_produtos'),('corporativo','compras_solicitacoes','public.compras_solicitacoes'),('corporativo','auditoria_contas','public.auditoria_contas'),('corporativo','central_guias','public.central_guias'),('corporativo','credenciamento_contratos','public.credenciamento_contratos'),('corporativo','ged_documentos','public.ged_documentos'),('corporativo','contas_medicas_processos','public.contas_medicas_processos'),
    ('faturamento','contas_faturamento','public.contas_faturamento'),('faturamento','conta_faturamento_itens','public.conta_faturamento_itens'),('faturamento','tabelas_comerciais_fontes','public.tabelas_comerciais_fontes'),('faturamento','tabelas_procedimentos_fontes','public.tabelas_procedimentos_fontes'),('faturamento','contrato_regras_faturamento','public.contrato_regras_faturamento'),
    ('tiss','tiss_guias','public.tiss_guias'),('tiss','tiss_lotes','public.tiss_lotes'),('tiss','tiss_glosas','public.tiss_glosas'),
    ('financeiro','financeiro_recebiveis','public.financeiro_recebiveis'),('financeiro','financeiro_contas_pagar','public.financeiro_contas_pagar'),('financeiro','notas_fiscais_servico','public.notas_fiscais_servico')
  ) v(grupo_nome,objeto_nome,relacao)
  loop
    grupo:=r.grupo_nome; objeto:=r.objeto_nome;
    if to_regclass(r.relacao) is null then status:='AUSENTE'; detalhe:='Tabela/view não encontrada'; else status:='OK'; detalhe:='Objeto disponível'; end if;
    return next;
  end loop;

  for r in select * from (values
    ('pacientes','ra'),('pacientes','numero_registro'),('profissionais','usuario_id'),('atendimentos','especialidade_destino'),
    ('contas_faturamento','auditoria_liberada'),('contas_faturamento','contas_medicas_liberada'),
    ('conta_faturamento_itens','valor_contratual_calculado'),('conta_faturamento_itens','grupo_ato_id'),('conta_faturamento_itens','memoria_calculo'),
    ('central_guias','valor_contratual'),('tiss_lotes','previsao_pagamento')
  ) c(tabela,coluna)
  loop
    grupo:='coluna'; objeto:=c.tabela||'.'||c.coluna;
    if exists(select 1 from information_schema.columns x where x.table_schema='public' and x.table_name=c.tabela and x.column_name=c.coluna) then status:='OK'; detalhe:='Coluna disponível'; else status:='AUSENTE'; detalhe:='Coluna não encontrada'; end if;
    return next;
  end loop;
end;$$;

revoke all on function public.validar_schema_his() from public;
grant execute on function public.validar_schema_his() to authenticated,service_role;
comment on function public.validar_schema_his is 'Diagnóstico não destrutivo do schema MedSync HIS após aplicação das migrations.';

commit;
