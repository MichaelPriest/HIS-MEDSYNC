begin;

-- Reconciliacao idempotente da camada comercial de procedimentos/exames.
-- Mantem separada a camada tabelas_procedimentos_* (AMB/CBHPM contratual detalhada)
-- da camada tabelas_comerciais_* (SIMPRO/BRASINDICE/OPME e tabelas proprias).

alter table if exists public.tabelas_comerciais_fontes drop constraint if exists tabelas_comerciais_fontes_tipo_check;
alter table if exists public.tabelas_comerciais_fontes add constraint tabelas_comerciais_fontes_tipo_check check (
  tipo in ('simpro','brasindice','opme_convenio','propria_convenio','medicamentos_convenio','materiais_convenio','amb90','amb92','amb96','amb99','cbhpm','procedimentos_convenio','outra')
);

alter table if exists public.tabelas_comerciais_edicoes add column if not exists metodo_calculo text not null default 'fixo';
alter table if exists public.tabelas_comerciais_edicoes add column if not exists valor_uco numeric(14,6);
alter table if exists public.tabelas_comerciais_edicoes add column if not exists moeda text not null default 'BRL';

do $$ begin
  if to_regclass('public.tabelas_comerciais_edicoes') is not null and not exists (
    select 1 from pg_constraint where conname='tabelas_comerciais_edicoes_metodo_calculo_check'
  ) then
    alter table public.tabelas_comerciais_edicoes add constraint tabelas_comerciais_edicoes_metodo_calculo_check check (metodo_calculo in ('fixo','ch_hm_sadt','cbhpm'));
  end if;
end $$;

alter table if exists public.tabelas_comerciais_itens add column if not exists pontos_ch numeric(14,6);
alter table if exists public.tabelas_comerciais_itens add column if not exists pontos_hm numeric(14,6);
alter table if exists public.tabelas_comerciais_itens add column if not exists pontos_sadt numeric(14,6);
alter table if exists public.tabelas_comerciais_itens add column if not exists porte text;
alter table if exists public.tabelas_comerciais_itens add column if not exists quantidade_uco numeric(14,6);
alter table if exists public.tabelas_comerciais_itens add column if not exists porte_anestesico text;
alter table if exists public.tabelas_comerciais_itens add column if not exists codigo_auxiliar text;

create table if not exists public.cbhpm_valores_portes (
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.tabelas_comerciais_edicoes on delete cascade,
  porte text not null,
  valor numeric(14,6) not null check (valor >= 0),
  unique(edicao_id,porte)
);

alter table if exists public.contrato_tabelas_comerciais add column if not exists valor_ch numeric(14,6);
alter table if exists public.contrato_tabelas_comerciais add column if not exists valor_hm numeric(14,6);
alter table if exists public.contrato_tabelas_comerciais add column if not exists valor_sadt numeric(14,6);
alter table if exists public.contrato_tabelas_comerciais add column if not exists valor_uco_contratual numeric(14,6);
alter table if exists public.contrato_tabelas_comerciais add column if not exists regras_adicionais jsonb not null default '{}'::jsonb;
alter table if exists public.contrato_tabelas_comerciais add column if not exists arredondamento_casas integer not null default 2;

do $$ begin
  if to_regclass('public.contrato_tabelas_comerciais') is not null and not exists (
    select 1 from pg_constraint where conname='contrato_tabelas_comerciais_arredondamento_check'
  ) then
    alter table public.contrato_tabelas_comerciais add constraint contrato_tabelas_comerciais_arredondamento_check check (arredondamento_casas between 0 and 6);
  end if;
end $$;

create or replace function public.obter_valor_procedimento_comercial(
  p_convenio_id uuid,
  p_codigo text,
  p_data date default current_date,
  p_categoria text default 'procedimentos',
  p_urgencia boolean default false,
  p_acomodacao text default null
) returns table(
  fonte_id uuid,
  edicao_id uuid,
  item_id uuid,
  fonte text,
  edicao text,
  metodo_calculo text,
  valor_base numeric,
  percentual_contratual numeric,
  adicional_urgencia numeric,
  adicional_acomodacao numeric,
  valor_final numeric,
  memoria_calculo jsonb
)
language plpgsql stable security invoker as $$
declare
  v record;
  v_base numeric := 0;
  v_porte numeric := 0;
  v_uco numeric := 0;
  v_urg_pct numeric := 0;
  v_acom_pct numeric := 0;
  v_add_urg numeric := 0;
  v_add_acom numeric := 0;
  v_final numeric := 0;
begin
  select cc.id contrato_id, ctc.*, f.nome fonte_nome, e.id ed_id, e.nome_edicao, e.metodo_calculo, e.valor_uco,
         i.id item_id_sel, i.valor_referencia, i.pontos_ch, i.pontos_hm, i.pontos_sadt, i.porte, i.quantidade_uco,
         i.codigo, i.descricao
    into v
  from public.credenciamento_contratos cc
  join public.contrato_tabelas_comerciais ctc on ctc.contrato_id=cc.id and ctc.ativo
  join public.tabelas_comerciais_fontes f on f.id=ctc.fonte_id and f.ativo
  join public.tabelas_comerciais_edicoes e on e.fonte_id=f.id and e.status='vigente'
    and (e.convenio_id is null or e.convenio_id=p_convenio_id)
    and ((ctc.modo_edicao='edicao_fixa' and e.id=ctc.edicao_fixa_id)
      or (ctc.modo_edicao='vigente_na_data' and e.vigencia_inicio<=p_data and (e.vigencia_fim is null or e.vigencia_fim>=p_data)))
  join public.tabelas_comerciais_itens i on i.edicao_id=e.id and i.codigo=p_codigo and i.ativo
  where cc.convenio_id=p_convenio_id and cc.status='ativo'
    and (cc.data_inicio is null or cc.data_inicio<=p_data)
    and (cc.data_fim is null or cc.data_fim>=p_data)
    and ctc.categoria in (p_categoria,'geral')
  order by case when ctc.categoria=p_categoria then 0 else 1 end, ctc.prioridade, e.vigencia_inicio desc
  limit 1;

  if not found then return; end if;

  if v.metodo_calculo='fixo' then
    v_base := coalesce(v.valor_referencia,0);
  elsif v.metodo_calculo='ch_hm_sadt' then
    v_base := coalesce(v.pontos_ch,0)*coalesce(v.valor_ch,0)
            + coalesce(v.pontos_hm,0)*coalesce(v.valor_hm,0)
            + coalesce(v.pontos_sadt,0)*coalesce(v.valor_sadt,0);
  elsif v.metodo_calculo='cbhpm' then
    select coalesce(cvp.valor,0) into v_porte
      from public.cbhpm_valores_portes cvp
      where cvp.edicao_id=v.ed_id and cvp.porte=v.porte
      limit 1;
    v_uco := coalesce(v.valor_uco_contratual,v.valor_uco,0);
    v_base := coalesce(v_porte,0) + coalesce(v.quantidade_uco,0)*v_uco;
  end if;

  v_base := v_base * (1 + coalesce(v.percentual_ajuste,0)/100.0);
  v_urg_pct := case when p_urgencia then coalesce((v.regras_adicionais->>'urgencia_percentual')::numeric,0) else 0 end;
  v_acom_pct := case when lower(coalesce(p_acomodacao,'')) in ('apartamento','individual','quarto') then coalesce((v.regras_adicionais->>'apartamento_percentual')::numeric,0) else 0 end;
  v_add_urg := v_base * v_urg_pct/100.0;
  v_add_acom := v_base * v_acom_pct/100.0;
  v_final := round(v_base + v_add_urg + v_add_acom, coalesce(v.arredondamento_casas,2));

  return query select
    v.fonte_id, v.ed_id, v.item_id_sel, v.fonte_nome, v.nome_edicao, v.metodo_calculo,
    round(v_base,6), coalesce(v.percentual_ajuste,0), round(v_add_urg,6), round(v_add_acom,6), v_final,
    jsonb_build_object(
      'codigo',v.codigo,'descricao',v.descricao,'metodo',v.metodo_calculo,
      'pontos_ch',v.pontos_ch,'valor_ch',v.valor_ch,'pontos_hm',v.pontos_hm,'valor_hm',v.valor_hm,
      'pontos_sadt',v.pontos_sadt,'valor_sadt',v.valor_sadt,
      'porte',v.porte,'valor_porte',v_porte,'quantidade_uco',v.quantidade_uco,'valor_uco',v_uco,
      'percentual_ajuste',coalesce(v.percentual_ajuste,0),'urgencia_percentual',v_urg_pct,'acomodacao_percentual',v_acom_pct
    );
end;
$$;

grant execute on function public.obter_valor_procedimento_comercial(uuid,text,date,text,boolean,text) to authenticated;

alter table public.cbhpm_valores_portes enable row level security;
drop policy if exists cbhpm_portes_select on public.cbhpm_valores_portes;
create policy cbhpm_portes_select on public.cbhpm_valores_portes for select using (
  exists(select 1 from public.tabelas_comerciais_edicoes e join public.tabelas_comerciais_fontes f on f.id=e.fonte_id where e.id=edicao_id and public.tem_empresa(f.empresa_id))
);

alter table if exists public.conta_faturamento_itens add column if not exists memoria_calculo_comercial jsonb;
alter table if exists public.conta_faturamento_itens add column if not exists valor_cobrado_original numeric(14,4);
alter table if exists public.conta_faturamento_itens add column if not exists divergencia_valor_contratual numeric(14,4);

comment on function public.obter_valor_procedimento_comercial is 'Calcula procedimentos/exames por tabela fixa, AMB CH/HM/SADT ou CBHPM porte+UCO, respeitando edição e parâmetros do contrato.';

commit;
