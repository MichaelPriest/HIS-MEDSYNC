alter table public.credenciamento_contratos
  add column if not exists plano_id uuid references public.convenio_planos(id);

alter table public.contrato_tabelas_comerciais
  add column if not exists base_preco text,
  add column if not exists valor_filme_m2 numeric;

alter table public.contrato_regras_faturamento
  add column if not exists operacao text not null default 'multiplicar_percentual',
  add column if not exists aplica_sobre text not null default 'valor_atual',
  add column if not exists encerra_processamento boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.contrato_tabelas_comerciais'::regclass
      and conname = 'contrato_tabelas_comerciais_base_preco_check'
  ) then
    alter table public.contrato_tabelas_comerciais
      add constraint contrato_tabelas_comerciais_base_preco_check
      check (
        base_preco is null
        or base_preco in ('valor_referencia','valor_fabrica','valor_pmc','valor_maximo')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.contrato_regras_faturamento'::regclass
      and conname = 'contrato_regras_faturamento_operacao_check'
  ) then
    alter table public.contrato_regras_faturamento
      add constraint contrato_regras_faturamento_operacao_check
      check (operacao in ('multiplicar_percentual','acrescentar_percentual','descontar_percentual','somar_valor_fixo','substituir_valor'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.contrato_regras_faturamento'::regclass
      and conname = 'contrato_regras_faturamento_aplica_sobre_check'
  ) then
    alter table public.contrato_regras_faturamento
      add constraint contrato_regras_faturamento_aplica_sobre_check
      check (aplica_sobre in ('valor_base','valor_atual'));
  end if;
end $$;

create index if not exists credenciamento_contratos_contexto_idx
  on public.credenciamento_contratos(convenio_id, plano_id, unidade_id, status, data_inicio, data_fim);

comment on column public.credenciamento_contratos.plano_id is
  'Plano opcional do convenio. NULL significa contrato aplicavel a todos os planos elegiveis do convenio.';
comment on column public.contrato_tabelas_comerciais.base_preco is
  'Base monetaria explicita para tabelas referenciais. Brasindice/CMED/SIMPRO exigem configuracao explicita; tabelas por pontos/porte usam sua metodologia propria.';
comment on column public.contrato_tabelas_comerciais.valor_filme_m2 is
  'Valor contratual do filme por m2 quando a metodologia da tabela exigir filme.';
comment on column public.contrato_regras_faturamento.operacao is
  'Operacao deterministica aplicada pela regra de cobranca.';
comment on column public.contrato_regras_faturamento.aplica_sobre is
  'Define se o percentual usa o valor base contratual ou o valor acumulado ate a regra.';
comment on column public.contrato_regras_faturamento.encerra_processamento is
  'Quando true, impede avaliacao de regras posteriores depois que esta regra for aplicada.';

create or replace function public.validar_credenciamento_contrato_plano()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_plano record;
begin
  if new.plano_id is null then
    return new;
  end if;

  select p.empresa_id, p.convenio_id, p.ativo
    into v_plano
    from public.convenio_planos p
   where p.id = new.plano_id;

  if not found or not coalesce(v_plano.ativo, false) then
    raise exception 'Plano do convenio inexistente ou inativo';
  end if;

  if v_plano.empresa_id is distinct from new.empresa_id
     or v_plano.convenio_id is distinct from new.convenio_id then
    raise exception 'Plano informado nao pertence ao mesmo convenio/empresa do contrato';
  end if;

  return new;
end;
$$;

revoke all on function public.validar_credenciamento_contrato_plano() from public, anon, authenticated;

drop trigger if exists trg_validar_credenciamento_contrato_plano on public.credenciamento_contratos;
create trigger trg_validar_credenciamento_contrato_plano
before insert or update of plano_id, convenio_id, empresa_id
on public.credenciamento_contratos
for each row execute function public.validar_credenciamento_contrato_plano();

-- Normaliza configuracoes AMB antigas sem inventar regra: replica somente dados
-- de Doppler ja existentes no vinculo geral da mesma fonte/contrato.
update public.contrato_tabelas_comerciais especifica
   set regras_adicionais = especifica.regras_adicionais
     || jsonb_build_object(
          'doppler_tuss_codes', geral.regras_adicionais->'doppler_tuss_codes',
          'doppler_ch_multiplicador', geral.regras_adicionais->'doppler_ch_multiplicador',
          'doppler_filme_multiplicador', coalesce(geral.regras_adicionais->'doppler_filme_multiplicador','1'::jsonb)
        )
  from public.contrato_tabelas_comerciais geral
 where especifica.contrato_id = geral.contrato_id
   and especifica.fonte_id = geral.fonte_id
   and especifica.categoria <> 'geral'
   and geral.categoria = 'geral'
   and geral.ativo
   and geral.regras_adicionais ? 'doppler_tuss_codes'
   and not (especifica.regras_adicionais ? 'doppler_tuss_codes');

update public.contrato_tabelas_comerciais
   set valor_filme_m2 = replace(regras_adicionais->>'valor_filme_m2', ',', '.')::numeric
 where valor_filme_m2 is null
   and coalesce(regras_adicionais->>'valor_filme_m2','') ~ '^[0-9]+([\.,][0-9]+)?$';

-- Converte percentuais historicamente guardados em regras_adicionais em regras
-- tipadas. Os INSERTs sao idempotentes e preservam o valor originalmente negociado.
insert into public.contrato_regras_faturamento(
  contrato_id,categoria,codigo_regra,descricao,percentual,prioridade,condicoes,
  ativo,vigencia_inicio,vigencia_fim,operacao,aplica_sobre,encerra_processamento
)
select ctc.contrato_id, ctc.categoria, 'URGENCIA',
       'Adicional de urgencia migrado da negociacao da tabela comercial',
       (ctc.regras_adicionais->>'urgencia_percentual')::numeric,
       ctc.prioridade,
       jsonb_build_object('urgencia',true,'origem_vinculo_tabela_id',ctc.id),
       true, c.data_inicio, c.data_fim, 'acrescentar_percentual','valor_atual',false
  from public.contrato_tabelas_comerciais ctc
  join public.credenciamento_contratos c on c.id=ctc.contrato_id
 where ctc.ativo
   and coalesce(ctc.regras_adicionais->>'urgencia_percentual','') ~ '^-?[0-9]+([\.,][0-9]+)?$'
   and replace(ctc.regras_adicionais->>'urgencia_percentual',',','.')::numeric <> 0
   and not exists (
     select 1 from public.contrato_regras_faturamento r
      where r.contrato_id=ctc.contrato_id and r.categoria=ctc.categoria and r.codigo_regra='URGENCIA' and r.ativo
   );

insert into public.contrato_regras_faturamento(
  contrato_id,categoria,codigo_regra,descricao,percentual,prioridade,condicoes,
  ativo,vigencia_inicio,vigencia_fim,operacao,aplica_sobre,encerra_processamento
)
select ctc.contrato_id, ctc.categoria, 'ACOMODACAO_INDIVIDUAL',
       'Adicional de acomodacao individual migrado da negociacao da tabela comercial',
       replace(ctc.regras_adicionais->>'apartamento_percentual',',','.')::numeric,
       ctc.prioridade,
       jsonb_build_object('acomodacao_individual',true,'origem_vinculo_tabela_id',ctc.id),
       true, c.data_inicio, c.data_fim, 'acrescentar_percentual','valor_atual',false
  from public.contrato_tabelas_comerciais ctc
  join public.credenciamento_contratos c on c.id=ctc.contrato_id
 where ctc.ativo
   and coalesce(ctc.regras_adicionais->>'apartamento_percentual','') ~ '^-?[0-9]+([\.,][0-9]+)?$'
   and replace(ctc.regras_adicionais->>'apartamento_percentual',',','.')::numeric <> 0
   and not exists (
     select 1 from public.contrato_regras_faturamento r
      where r.contrato_id=ctc.contrato_id and r.categoria=ctc.categoria and r.codigo_regra='ACOMODACAO_INDIVIDUAL' and r.ativo
   );

insert into public.contrato_regras_faturamento(
  contrato_id,categoria,codigo_regra,descricao,percentual,prioridade,condicoes,
  ativo,vigencia_inicio,vigencia_fim,operacao,aplica_sobre,encerra_processamento
)
select ctc.contrato_id, ctc.categoria, 'HORARIO_ESPECIAL',
       'Adicional de horario especial migrado da negociacao da tabela comercial',
       replace(regexp_replace(ctc.regras_adicionais->>'horario_especial_regra','[^0-9,.-]','','g'),',','.')::numeric,
       ctc.prioridade,
       jsonb_build_object('horario_especial',true,'origem_vinculo_tabela_id',ctc.id),
       true, c.data_inicio, c.data_fim, 'acrescentar_percentual','valor_atual',false
  from public.contrato_tabelas_comerciais ctc
  join public.credenciamento_contratos c on c.id=ctc.contrato_id
 where ctc.ativo
   and coalesce(regexp_replace(ctc.regras_adicionais->>'horario_especial_regra','[^0-9,.-]','','g'),'') ~ '^-?[0-9]+([\.,][0-9]+)?$'
   and replace(regexp_replace(ctc.regras_adicionais->>'horario_especial_regra','[^0-9,.-]','','g'),',','.')::numeric <> 0
   and not exists (
     select 1 from public.contrato_regras_faturamento r
      where r.contrato_id=ctc.contrato_id and r.categoria=ctc.categoria and r.codigo_regra='HORARIO_ESPECIAL' and r.ativo
   );

create or replace function public.obter_valor_item_comercial_contextual_internal(
  p_convenio_id uuid,
  p_plano_id uuid,
  p_unidade_id uuid,
  p_item_assistencial_id uuid,
  p_codigo text,
  p_data date,
  p_categoria text
)
returns table(valor numeric, metodologia text, fonte_id uuid, edicao_id uuid, item_id uuid, memoria jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
  v_data date := coalesce(p_data,current_date);
  v_contrato public.credenciamento_contratos%rowtype;
  v_vinculo public.contrato_tabelas_comerciais%rowtype;
  v_edicao public.tabelas_comerciais_edicoes%rowtype;
  v_fonte public.tabelas_comerciais_fontes%rowtype;
  v_item public.tabelas_comerciais_itens%rowtype;
  v_codigo_tuss_map text;
  v_codigo_fonte_map text;
  v_codigo_tuss_resolvido text;
  v_base numeric := 0;
  v_final numeric := 0;
  v_usou_pontos boolean := false;
  v_ordem integer := 0;
  v_filme_qtd numeric := 0;
  v_valor_filme numeric;
  v_ch_mult numeric := 1;
  v_ch_parcela numeric := 0;
  v_filme_parcela numeric := 0;
  v_base_preco_resolvida text;
  v_valor_porte numeric;
  v_valor_uco numeric;
  v_mapa_porte jsonb;
  v_metodo_base text;
begin
  select c.empresa_id into v_empresa
    from public.convenios c
   where c.id = p_convenio_id and c.ativo;
  if v_empresa is null or not public.tem_empresa(v_empresa) then
    return;
  end if;

  select c.* into v_contrato
    from public.credenciamento_contratos c
   where c.convenio_id = p_convenio_id
     and c.status = 'ativo'
     and (c.plano_id is null or c.plano_id = p_plano_id)
     and (c.unidade_id is null or c.unidade_id = p_unidade_id)
     and (c.data_inicio is null or c.data_inicio <= v_data)
     and (c.data_fim is null or c.data_fim >= v_data)
   order by ((c.plano_id is not null)::int * 2 + (c.unidade_id is not null)::int) desc,
            c.data_inicio desc nulls last,
            c.created_at desc,
            c.id
   limit 1;
  if not found then
    return;
  end if;

  for v_vinculo in
    select t.*
      from public.contrato_tabelas_comerciais t
     where t.contrato_id = v_contrato.id
       and t.ativo
       and t.categoria in (p_categoria,'geral')
     order by case when t.categoria=p_categoria then 0 else 1 end,
              t.prioridade,
              t.id
  loop
    v_ordem := v_ordem + 1;

    select f.* into v_fonte
      from public.tabelas_comerciais_fontes f
     where f.id=v_vinculo.fonte_id
       and f.ativo
       and f.empresa_id=v_empresa;
    if not found then continue; end if;

    if v_vinculo.modo_edicao='edicao_fixa' then
      select e.* into v_edicao
        from public.tabelas_comerciais_edicoes e
       where e.id=v_vinculo.edicao_fixa_id
         and e.fonte_id=v_vinculo.fonte_id
         and e.status<>'cancelada'
         and (e.convenio_id is null or e.convenio_id=p_convenio_id);
    else
      select e.* into v_edicao
        from public.tabelas_comerciais_edicoes e
       where e.fonte_id=v_vinculo.fonte_id
         and e.status='vigente'
         and e.vigencia_inicio<=v_data
         and (e.vigencia_fim is null or e.vigencia_fim>=v_data)
         and (e.convenio_id is null or e.convenio_id=p_convenio_id)
       order by case when e.convenio_id=p_convenio_id then 0 else 1 end,
                e.vigencia_inicio desc,
                e.id
       limit 1;
    end if;
    if not found then continue; end if;

    v_codigo_tuss_map:=null;
    v_codigo_fonte_map:=null;
    if nullif(trim(p_codigo),'') is not null then
      select r.codigo_destino into v_codigo_tuss_map
        from public.referencia_equivalencias r
       where r.status='ativa'
         and r.codigo_origem=p_codigo
         and upper(r.sistema_destino)='TUSS'
         and (
           upper(r.sistema_origem) in (upper(v_fonte.codigo),upper(v_fonte.tipo))
           or (v_fonte.tipo like 'amb%' and upper(r.sistema_origem)='AMB')
         )
       order by case
                  when upper(r.sistema_origem)=upper(v_fonte.codigo) then 0
                  when upper(r.sistema_origem)=upper(v_fonte.tipo) then 1
                  else 2
                end,
                r.updated_at desc,
                r.id
       limit 1;

      select r.codigo_destino into v_codigo_fonte_map
        from public.referencia_equivalencias r
       where r.status='ativa'
         and r.codigo_origem=p_codigo
         and upper(r.sistema_origem)='TUSS'
         and (
           upper(r.sistema_destino) in (upper(v_fonte.codigo),upper(v_fonte.tipo))
           or (v_fonte.tipo like 'amb%' and upper(r.sistema_destino)='AMB')
         )
       order by case
                  when upper(r.sistema_destino)=upper(v_fonte.codigo) then 0
                  when upper(r.sistema_destino)=upper(v_fonte.tipo) then 1
                  else 2
                end,
                r.updated_at desc,
                r.id
       limit 1;
    end if;

    select i.* into v_item
      from public.tabelas_comerciais_itens i
     where i.edicao_id=v_edicao.id
       and i.ativo
       and (
         (p_item_assistencial_id is not null and i.item_assistencial_id=p_item_assistencial_id)
         or (nullif(trim(p_codigo),'') is not null and i.codigo=p_codigo)
         or (nullif(trim(p_codigo),'') is not null and i.codigo_tuss=p_codigo)
         or (nullif(trim(p_codigo),'') is not null and i.codigo_tabela_propria=p_codigo)
         or (v_codigo_tuss_map is not null and i.codigo_tuss=v_codigo_tuss_map)
         or (v_codigo_fonte_map is not null and (i.codigo=v_codigo_fonte_map or i.codigo_tabela_propria=v_codigo_fonte_map))
       )
     order by
       case when p_item_assistencial_id is not null and i.item_assistencial_id=p_item_assistencial_id then 0 else 1 end,
       case when nullif(trim(p_codigo),'') is not null and i.codigo=p_codigo then 0 else 1 end,
       case when nullif(trim(p_codigo),'') is not null and i.codigo_tuss=p_codigo then 0 else 1 end,
       case when v_codigo_tuss_map is not null and i.codigo_tuss=v_codigo_tuss_map then 0 else 1 end,
       i.id
     limit 1;
    if not found then continue; end if;

    v_codigo_tuss_resolvido:=coalesce(
      v_item.codigo_tuss,
      v_codigo_tuss_map,
      case when p_codigo ~ '^[0-9]{8}$' then p_codigo end
    );
    v_usou_pontos:=false;
    v_ch_mult:=1;
    v_ch_parcela:=0;
    v_filme_parcela:=0;
    v_base_preco_resolvida:=v_vinculo.base_preco;
    v_valor_porte:=null;
    v_valor_uco:=0;
    v_mapa_porte:=null;
    v_metodo_base:=null;

    if v_fonte.tipo in ('amb90','amb92','amb96','amb99') then
      v_filme_qtd:=coalesce(v_item.quantidade_filme,0);
      v_valor_filme:=v_vinculo.valor_filme_m2;
      if v_valor_filme is null
         and coalesce(v_vinculo.regras_adicionais->>'valor_filme_m2','') ~ '^[0-9]+([\.,][0-9]+)?$' then
        v_valor_filme:=replace(v_vinculo.regras_adicionais->>'valor_filme_m2',',','.')::numeric;
      end if;

      if (v_vinculo.regras_adicionais->'doppler_tuss_codes') @> to_jsonb(array[v_codigo_tuss_resolvido]::text[]) then
        if coalesce(v_vinculo.regras_adicionais->>'doppler_ch_multiplicador','') ~ '^[0-9]+([\.,][0-9]+)?$' then
          v_ch_mult:=replace(v_vinculo.regras_adicionais->>'doppler_ch_multiplicador',',','.')::numeric;
        end if;
      end if;

      if coalesce(v_item.pontos_ch,0)<>0 and v_vinculo.valor_sadt is null then continue; end if;
      if v_filme_qtd<>0 and v_valor_filme is null then continue; end if;

      v_ch_parcela:=coalesce(v_item.pontos_ch,0)*coalesce(v_vinculo.valor_sadt,0)*v_ch_mult;
      v_filme_parcela:=v_filme_qtd*coalesce(v_valor_filme,0);
      v_base:=v_ch_parcela+v_filme_parcela;
      v_usou_pontos:=true;
      v_metodo_base:='amb_ch_sadt_filme';

    elsif v_edicao.metodo_calculo='ch_hm_sadt' then
      if (coalesce(v_item.pontos_ch,0)<>0 and v_vinculo.valor_ch is null)
         or (coalesce(v_item.pontos_hm,0)<>0 and v_vinculo.valor_hm is null)
         or (coalesce(v_item.pontos_sadt,0)<>0 and v_vinculo.valor_sadt is null) then
        continue;
      end if;
      v_base:=coalesce(v_item.pontos_ch,0)*coalesce(v_vinculo.valor_ch,0)
            + coalesce(v_item.pontos_hm,0)*coalesce(v_vinculo.valor_hm,0)
            + coalesce(v_item.pontos_sadt,0)*coalesce(v_vinculo.valor_sadt,0);
      v_usou_pontos:=true;
      v_metodo_base:='ch_hm_sadt';

    elsif v_edicao.metodo_calculo='cbhpm' and v_vinculo.base_preco is null then
      if p_categoria='anestesia' then
        v_mapa_porte:=v_vinculo.regras_adicionais->'valores_porte_anestesico';
        if nullif(v_item.porte_anestesico,'') is not null then
          if v_mapa_porte is null
             or coalesce(v_mapa_porte->>v_item.porte_anestesico,'') !~ '^-?[0-9]+([\.,][0-9]+)?$' then
            continue;
          end if;
          v_valor_porte:=replace(v_mapa_porte->>v_item.porte_anestesico,',','.')::numeric;
        end if;
        if v_valor_porte is null then continue; end if;
        v_base:=v_valor_porte;
        v_metodo_base:='cbhpm_porte_anestesico';
      else
        v_mapa_porte:=v_vinculo.regras_adicionais->'valores_porte';
        if nullif(v_item.porte,'') is not null then
          if v_mapa_porte is null
             or coalesce(v_mapa_porte->>v_item.porte,'') !~ '^-?[0-9]+([\.,][0-9]+)?$' then
            continue;
          end if;
          v_valor_porte:=replace(v_mapa_porte->>v_item.porte,',','.')::numeric;
        end if;
        if coalesce(v_item.quantidade_uco,0)<>0 then
          if v_vinculo.valor_uco_contratual is null then continue; end if;
          v_valor_uco:=coalesce(v_item.quantidade_uco,0)*v_vinculo.valor_uco_contratual;
        end if;
        if v_valor_porte is null and v_valor_uco=0 then continue; end if;
        v_base:=coalesce(v_valor_porte,0)+v_valor_uco;
        v_metodo_base:='cbhpm_porte_uco';
      end if;

    else
      if v_vinculo.base_preco='valor_fabrica' then
        if v_item.valor_fabrica is null then continue; end if;
        v_base:=v_item.valor_fabrica;
        v_base_preco_resolvida:='valor_fabrica';
      elsif v_vinculo.base_preco='valor_pmc' then
        if v_item.valor_pmc is null then continue; end if;
        v_base:=v_item.valor_pmc;
        v_base_preco_resolvida:='valor_pmc';
      elsif v_vinculo.base_preco='valor_maximo' then
        if v_item.valor_maximo is null then continue; end if;
        v_base:=v_item.valor_maximo;
        v_base_preco_resolvida:='valor_maximo';
      elsif v_vinculo.base_preco='valor_referencia' then
        if v_item.valor_referencia is null then continue; end if;
        v_base:=v_item.valor_referencia;
        v_base_preco_resolvida:='valor_referencia';
      elsif v_fonte.tipo in ('brasindice','cmed','simpro') then
        -- Essas fontes possuem multiplas bases possiveis. Sem escolha contratual,
        -- nao existe preco seguro a ser inferido.
        continue;
      else
        if v_item.valor_referencia is null then continue; end if;
        v_base:=v_item.valor_referencia;
        v_base_preco_resolvida:='valor_referencia';
      end if;
      v_metodo_base:='base_monetaria_explicita';
    end if;

    v_final:=round(
      v_base*(1+coalesce(v_vinculo.percentual_ajuste,0)/100.0),
      v_vinculo.arredondamento_casas
    );

    return query
    select v_final,
           v_fonte.tipo,
           v_fonte.id,
           v_edicao.id,
           v_item.id,
           jsonb_build_object(
             'contrato_id',v_contrato.id,
             'plano_id',v_contrato.plano_id,
             'unidade_id',v_contrato.unidade_id,
             'vinculo_tabela_id',v_vinculo.id,
             'fonte',v_fonte.nome,
             'fonte_codigo',v_fonte.codigo,
             'fonte_tipo',v_fonte.tipo,
             'edicao',v_edicao.nome_edicao,
             'categoria_contrato',v_vinculo.categoria,
             'prioridade_tabela',v_vinculo.prioridade,
             'ordem_fallback',v_ordem,
             'codigo_pesquisado',p_codigo,
             'codigo_fonte',v_item.codigo,
             'codigo_tuss',v_codigo_tuss_resolvido,
             'depara_tuss',v_codigo_tuss_map,
             'tabela_tiss_codigo',v_item.tabela_tiss_codigo,
             'metodo_base',v_metodo_base,
             'base_preco',v_base_preco_resolvida,
             'pontos_ch',v_item.pontos_ch,
             'pontos_hm',v_item.pontos_hm,
             'pontos_sadt',v_item.pontos_sadt,
             'porte',v_item.porte,
             'porte_anestesico',v_item.porte_anestesico,
             'quantidade_uco',v_item.quantidade_uco,
             'valor_porte',v_valor_porte,
             'valor_uco_contratual',v_vinculo.valor_uco_contratual,
             'parcela_uco',v_valor_uco,
             'quantidade_filme',v_filme_qtd,
             'valor_sadt_contratual',v_vinculo.valor_sadt,
             'valor_filme_m2',v_valor_filme,
             'doppler_ch_multiplicador',v_ch_mult,
             'parcela_ch',v_ch_parcela,
             'parcela_filme',v_filme_parcela,
             'calculo_por_pontos',v_usou_pontos,
             'base_calculo',v_base,
             'percentual_ajuste_contrato',v_vinculo.percentual_ajuste,
             'valor_calculado',v_final
           );
    return;
  end loop;
end;
$$;

revoke all on function public.obter_valor_item_comercial_contextual_internal(uuid,uuid,uuid,uuid,text,date,text) from public, anon, authenticated;

create or replace function public.obter_valor_item_comercial(
  p_convenio_id uuid,
  p_item_assistencial_id uuid,
  p_codigo text,
  p_data date,
  p_categoria text
)
returns table(valor numeric, metodologia text, fonte_id uuid, edicao_id uuid, item_id uuid, memoria jsonb)
language sql
security definer
set search_path = ''
as $$
  select r.valor,r.metodologia,r.fonte_id,r.edicao_id,r.item_id,r.memoria
    from public.obter_valor_item_comercial_contextual_internal(
      p_convenio_id,null,null,p_item_assistencial_id,p_codigo,p_data,p_categoria
    ) r;
$$;

revoke all on function public.obter_valor_item_comercial(uuid,uuid,text,date,text) from public, anon;
grant execute on function public.obter_valor_item_comercial(uuid,uuid,text,date,text) to authenticated;

create or replace function public.obter_valor_item_comercial_tuss_contextual_internal(
  p_convenio_id uuid,
  p_plano_id uuid,
  p_unidade_id uuid,
  p_item_assistencial_id uuid,
  p_codigo text,
  p_data date,
  p_categoria text
)
returns table(valor numeric, metodologia text, fonte_id uuid, edicao_id uuid, item_id uuid, memoria jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_map record;
begin
  return query
  select r.valor,r.metodologia,r.fonte_id,r.edicao_id,r.item_id,r.memoria
    from public.obter_valor_item_comercial_contextual_internal(
      p_convenio_id,p_plano_id,p_unidade_id,p_item_assistencial_id,p_codigo,p_data,p_categoria
    ) r;
  if found then return; end if;

  for v_map in
    select eq.codigo_origem,eq.sistema_origem
      from public.referencia_equivalencias eq
     where eq.status='ativa'
       and upper(eq.sistema_destino)='TUSS'
       and eq.codigo_destino=p_codigo
     order by eq.updated_at desc nulls last,eq.id
  loop
    return query
    select r.valor,r.metodologia,r.fonte_id,r.edicao_id,r.item_id,
           coalesce(r.memoria,'{}'::jsonb)
           || jsonb_build_object(
                'depara_origem',v_map.codigo_origem,
                'depara_destino',p_codigo,
                'depara_sentido','fonte_para_tuss_reverso',
                'depara_sistema_origem',v_map.sistema_origem
              )
      from public.obter_valor_item_comercial_contextual_internal(
        p_convenio_id,p_plano_id,p_unidade_id,p_item_assistencial_id,v_map.codigo_origem,p_data,p_categoria
      ) r;
    if found then return; end if;
  end loop;
end;
$$;

revoke all on function public.obter_valor_item_comercial_tuss_contextual_internal(uuid,uuid,uuid,uuid,text,date,text) from public, anon, authenticated;

create or replace function public.obter_valor_item_comercial_tuss_internal(
  p_convenio_id uuid,
  p_item_assistencial_id uuid,
  p_codigo text,
  p_data date,
  p_categoria text
)
returns table(valor numeric, metodologia text, fonte_id uuid, edicao_id uuid, item_id uuid, memoria jsonb)
language sql
security definer
set search_path = ''
as $$
  select r.valor,r.metodologia,r.fonte_id,r.edicao_id,r.item_id,r.memoria
    from public.obter_valor_item_comercial_tuss_contextual_internal(
      p_convenio_id,null,null,p_item_assistencial_id,p_codigo,p_data,p_categoria
    ) r;
$$;

revoke all on function public.obter_valor_item_comercial_tuss_internal(uuid,uuid,text,date,text) from public, anon, authenticated;

create or replace function public.recalcular_item_contratual_avancado_internal(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_preco record;
  v_contrato public.credenciamento_contratos%rowtype;
  v_regra record;
  v_regra_id uuid := null;
  v_base numeric := 0;
  v_final numeric := 0;
  v_categoria text := 'procedimentos';
  v_categoria_singular text := 'procedimento';
  v_memoria jsonb := '{}'::jsonb;
  v_regras_aplicadas jsonb := '[]'::jsonb;
  v_grupo_codigo text := null;
  v_via_acesso text := null;
  v_via_referencia text := null;
  v_acomodacao text := null;
  v_urgencia boolean := false;
  v_horario_especial boolean := false;
  v_acomodacao_individual boolean := false;
  v_anestesia boolean := false;
  v_auxiliares integer := 0;
  v_usou_comercial boolean := false;
  v_cond_ok boolean;
  v_alvo numeric;
  v_antes numeric;
  v_percentual_efetivo numeric;
  v_codigo_seq integer;
  v_data date;
begin
  select i.*,
         c.empresa_id,
         c.unidade_id,
         c.convenio_id,
         c.plano_id as conta_plano_id,
         c.status as conta_status,
         c.fechada_em as conta_fechada_em,
         c.faturada_em as conta_faturada_em
    into v_item
    from public.conta_faturamento_itens i
    join public.contas_faturamento c on c.id=i.conta_id
   where i.id=p_item_id;

  if v_item.id is null then return null; end if;
  if not public.tem_unidade(v_item.empresa_id,v_item.unidade_id) then
    raise exception 'Sem acesso a conta';
  end if;

  if v_item.conta_fechada_em is not null or v_item.conta_faturada_em is not null then
    return coalesce(v_item.memoria_calculo,'{}'::jsonb)
      || jsonb_build_object('recalculo_ignorado','conta_historica_fechada');
  end if;

  if v_item.convenio_id is null or v_item.codigo is null then
    update public.conta_faturamento_itens
       set metodologia_preco=null,
           tabela_procedimento_edicao_id=null,
           tabela_procedimento_item_id=null,
           tabela_comercial_edicao_id=null,
           tabela_comercial_item_id=null,
           valor_referencia=null,
           valor_contratual_calculado=null,
           percentual_aplicado=null,
           regra_contratual_id=null,
           memoria_calculo=jsonb_build_object('status','sem_referencia')
     where id=p_item_id;
    return null;
  end if;

  v_data:=coalesce(v_item.data_execucao::date,current_date);

  if v_item.grupo_ato_id is not null then
    select g.codigo_grupo,g.via_acesso,g.acomodacao,g.urgencia
      into v_grupo_codigo,v_via_acesso,v_acomodacao,v_urgencia
      from public.conta_faturamento_grupos_ato g
     where g.id=v_item.grupo_ato_id;

    select coalesce(i.via_acesso,v_via_acesso)
      into v_via_referencia
      from public.conta_faturamento_itens i
     where i.grupo_ato_id=v_item.grupo_ato_id
     order by coalesce(i.sequencia_ato,1),i.created_at,i.id
     limit 1;
  end if;

  v_via_acesso:=coalesce(v_item.via_acesso,v_via_acesso);
  v_urgencia:=coalesce(v_item.urgencia,false) or coalesce(v_urgencia,false);
  v_horario_especial:=coalesce(v_item.horario_especial,false);
  v_acomodacao_individual:=coalesce(v_item.acomodacao_individual,false)
    or lower(coalesce(v_acomodacao,'')) in ('apartamento','individual','quarto');
  v_anestesia:=coalesce(v_item.anestesia,false);
  v_auxiliares:=greatest(coalesce(v_item.numero_auxiliares,0),coalesce(v_item.quantidade_auxiliares,0));

  v_categoria:=case
    when lower(coalesce(v_item.categoria_item,'')) in ('medicamento','medicamentos') or v_item.origem_tipo='medicamento' then 'medicamentos'
    when lower(coalesce(v_item.categoria_item,'')) in ('material','materiais') or v_item.origem_tipo='material' then 'materiais'
    when lower(coalesce(v_item.categoria_item,'')) in ('opme','oprme') or v_item.origem_tipo in ('opme','oprme') then 'opme'
    when v_item.origem_tipo in ('gas','gas_medicinal','gases') then 'gases'
    when v_item.origem_tipo in ('exame','laboratorio','imagem','sadt') then 'sadt'
    when v_item.origem_tipo='honorario' then 'honorarios'
    when v_item.origem_tipo='anestesia' then 'anestesia'
    when v_item.origem_tipo='auxiliar' then 'auxiliares'
    when v_item.origem_tipo='diaria' then 'diarias'
    when v_item.origem_tipo='taxa' then 'taxas'
    when v_item.origem_tipo in ('cirurgia','procedimento_cirurgico') then 'cirurgias'
    else 'procedimentos'
  end;

  v_categoria_singular:=case v_categoria
    when 'medicamentos' then 'medicamento'
    when 'materiais' then 'material'
    when 'gases' then 'gas'
    when 'sadt' then 'sadt'
    when 'honorarios' then 'honorario'
    when 'auxiliares' then 'auxiliar'
    when 'diarias' then 'diaria'
    when 'taxas' then 'taxa'
    when 'cirurgias' then 'cirurgia'
    else v_categoria
  end;

  select c.* into v_contrato
    from public.credenciamento_contratos c
   where c.convenio_id=v_item.convenio_id
     and c.status='ativo'
     and (c.plano_id is null or c.plano_id=v_item.conta_plano_id)
     and (c.unidade_id is null or c.unidade_id=v_item.unidade_id)
     and (c.data_inicio is null or c.data_inicio<=v_data)
     and (c.data_fim is null or c.data_fim>=v_data)
   order by ((c.plano_id is not null)::int*2+(c.unidade_id is not null)::int) desc,
            c.data_inicio desc nulls last,c.created_at desc,c.id
   limit 1;

  if v_contrato.id is not null then
    select * into v_preco
      from public.obter_valor_item_comercial_tuss_contextual_internal(
        v_item.convenio_id,
        v_item.conta_plano_id,
        v_item.unidade_id,
        v_item.item_assistencial_id,
        v_item.codigo,
        v_data,
        v_categoria
      )
     limit 1;
    v_usou_comercial:=v_preco.valor is not null;
  end if;

  -- Compatibilidade: o motor legado so participa quando o contrato selecionado
  -- e geral (sem plano/unidade). Assim ele nunca sobrepoe um contexto especifico.
  if v_preco.valor is null
     and v_contrato.id is not null
     and v_contrato.plano_id is null
     and v_contrato.unidade_id is null then
    select * into v_preco
      from public.obter_valor_procedimento_contratual(
        v_item.convenio_id,
        v_item.codigo,
        v_data,
        v_categoria,
        v_urgencia,
        v_acomodacao_individual
      )
     limit 1;
  end if;

  if v_preco.valor is null then
    update public.conta_faturamento_itens
       set metodologia_preco=null,
           tabela_procedimento_edicao_id=null,
           tabela_procedimento_item_id=null,
           tabela_comercial_edicao_id=null,
           tabela_comercial_item_id=null,
           valor_referencia=null,
           valor_contratual_calculado=null,
           percentual_aplicado=null,
           regra_contratual_id=null,
           memoria_calculo=jsonb_build_object(
             'status','sem_preco_contratual',
             'codigo',v_item.codigo,
             'categoria',v_categoria,
             'contrato_id',v_contrato.id,
             'plano_id',v_item.conta_plano_id,
             'unidade_id',v_item.unidade_id,
             'fallback_legado_permitido',coalesce(v_contrato.plano_id is null and v_contrato.unidade_id is null,false)
           )
     where id=p_item_id;
    return null;
  end if;

  v_base:=v_preco.valor;
  v_final:=v_base;

  if v_contrato.id is not null then
    for v_regra in
      select r.*
        from public.contrato_regras_faturamento r
       where r.contrato_id=v_contrato.id
         and r.ativo
         and r.categoria in ('geral',v_categoria,v_categoria_singular)
         and (r.vigencia_inicio is null or r.vigencia_inicio<=v_data)
         and (r.vigencia_fim is null or r.vigencia_fim>=v_data)
       order by r.prioridade,r.id
    loop
      v_cond_ok:=true;

      -- Compatibilidade com codigos MULTIPLO antigos, agora dentro do mesmo motor.
      if v_regra.codigo_regra='MULTIPLO_N' then
        v_cond_ok:=coalesce(v_item.sequencia_ato,1)>1;
      elsif v_regra.codigo_regra ~ '^MULTIPLO_[0-9]+$' then
        v_codigo_seq:=substring(v_regra.codigo_regra from 'MULTIPLO_([0-9]+)')::integer;
        v_cond_ok:=coalesce(v_item.sequencia_ato,1)=v_codigo_seq;
      elsif v_regra.codigo_regra='URGENCIA' and not (v_regra.condicoes ? 'urgencia') then
        v_cond_ok:=v_urgencia;
      elsif v_regra.codigo_regra='HORARIO_ESPECIAL' and not (v_regra.condicoes ? 'horario_especial') then
        v_cond_ok:=v_horario_especial;
      elsif v_regra.codigo_regra='ACOMODACAO_INDIVIDUAL' and not (v_regra.condicoes ? 'acomodacao_individual') then
        v_cond_ok:=v_acomodacao_individual;
      elsif v_regra.codigo_regra='ANESTESIA' and not (v_regra.condicoes ? 'anestesia') then
        v_cond_ok:=v_anestesia;
      elsif v_regra.codigo_regra='AUXILIARES' and not (v_regra.condicoes ? 'quantidade_auxiliares_min') then
        v_cond_ok:=v_auxiliares>0;
      end if;

      if v_cond_ok and v_regra.condicoes ? 'sequencia' then
        v_cond_ok:=(v_regra.condicoes->>'sequencia')=coalesce(v_item.sequencia_ato,1)::text;
      end if;
      if v_cond_ok and v_regra.condicoes ? 'sequencia_min'
         and coalesce(v_regra.condicoes->>'sequencia_min','') ~ '^[0-9]+$' then
        v_cond_ok:=coalesce(v_item.sequencia_ato,1)>=(v_regra.condicoes->>'sequencia_min')::integer;
      end if;
      if v_cond_ok and v_regra.condicoes ? 'sequencia_max'
         and coalesce(v_regra.condicoes->>'sequencia_max','') ~ '^[0-9]+$' then
        v_cond_ok:=coalesce(v_item.sequencia_ato,1)<=(v_regra.condicoes->>'sequencia_max')::integer;
      end if;
      if v_cond_ok and v_regra.condicoes ? 'urgencia' then
        v_cond_ok:=lower(v_regra.condicoes->>'urgencia')=case when v_urgencia then 'true' else 'false' end;
      end if;
      if v_cond_ok and v_regra.condicoes ? 'horario_especial' then
        v_cond_ok:=lower(v_regra.condicoes->>'horario_especial')=case when v_horario_especial then 'true' else 'false' end;
      end if;
      if v_cond_ok and v_regra.condicoes ? 'acomodacao_individual' then
        v_cond_ok:=lower(v_regra.condicoes->>'acomodacao_individual')=case when v_acomodacao_individual then 'true' else 'false' end;
      end if;
      if v_cond_ok and v_regra.condicoes ? 'anestesia' then
        v_cond_ok:=lower(v_regra.condicoes->>'anestesia')=case when v_anestesia then 'true' else 'false' end;
      end if;
      if v_cond_ok and v_regra.condicoes ? 'quantidade_auxiliares_min'
         and coalesce(v_regra.condicoes->>'quantidade_auxiliares_min','') ~ '^[0-9]+$' then
        v_cond_ok:=v_auxiliares>=(v_regra.condicoes->>'quantidade_auxiliares_min')::integer;
      end if;
      if v_cond_ok and v_regra.condicoes ? 'via_acesso' then
        v_cond_ok:=lower(coalesce(v_via_acesso,''))=lower(v_regra.condicoes->>'via_acesso');
      end if;
      if v_cond_ok and v_regra.condicoes ? 'mesma_via' then
        v_cond_ok:=(lower(coalesce(v_via_acesso,''))=lower(coalesce(v_via_referencia,'')))
          = (lower(v_regra.condicoes->>'mesma_via')='true');
      end if;
      if v_cond_ok and v_regra.condicoes ? 'origem_tipo' then
        v_cond_ok:=lower(coalesce(v_item.origem_tipo,''))=lower(v_regra.condicoes->>'origem_tipo');
      end if;
      if v_cond_ok and v_regra.condicoes ? 'codigo' then
        v_cond_ok:=coalesce(v_item.codigo,'')=(v_regra.condicoes->>'codigo');
      end if;

      if not v_cond_ok then continue; end if;

      v_antes:=v_final;
      v_alvo:=case when v_regra.aplica_sobre='valor_base' then v_base else v_final end;

      case v_regra.operacao
        when 'multiplicar_percentual' then
          if v_regra.percentual is not null then
            v_final:=v_alvo*(v_regra.percentual/100.0);
          end if;
          if v_regra.valor_fixo is not null then
            v_final:=v_final+v_regra.valor_fixo;
          end if;
        when 'acrescentar_percentual' then
          if v_regra.percentual is not null then
            v_final:=v_final+(v_alvo*(v_regra.percentual/100.0));
          end if;
          if v_regra.valor_fixo is not null then
            v_final:=v_final+v_regra.valor_fixo;
          end if;
        when 'descontar_percentual' then
          if v_regra.percentual is not null then
            v_final:=v_final-(v_alvo*(v_regra.percentual/100.0));
          end if;
          if v_regra.valor_fixo is not null then
            v_final:=v_final-v_regra.valor_fixo;
          end if;
        when 'somar_valor_fixo' then
          if v_regra.valor_fixo is not null then
            v_final:=v_final+v_regra.valor_fixo;
          end if;
        when 'substituir_valor' then
          if v_regra.valor_fixo is not null then
            v_final:=v_regra.valor_fixo;
          end if;
      end case;

      v_final:=round(v_final,2);
      if v_regra_id is null then v_regra_id:=v_regra.id; end if;
      v_regras_aplicadas:=v_regras_aplicadas || jsonb_build_array(jsonb_build_object(
        'id',v_regra.id,
        'codigo',v_regra.codigo_regra,
        'descricao',v_regra.descricao,
        'prioridade',v_regra.prioridade,
        'operacao',v_regra.operacao,
        'aplica_sobre',v_regra.aplica_sobre,
        'percentual',v_regra.percentual,
        'valor_fixo',v_regra.valor_fixo,
        'condicoes',v_regra.condicoes,
        'valor_antes',round(v_antes,2),
        'valor_depois',round(v_final,2)
      ));

      if v_regra.encerra_processamento then exit; end if;
    end loop;
  end if;

  v_percentual_efetivo:=case when v_base<>0 then round((v_final/v_base)*100.0,6) else null end;

  v_memoria:=coalesce(v_preco.memoria,'{}'::jsonb)
    || jsonb_build_object(
      'catalogo_preco',case when v_usou_comercial then 'comercial_versionado' else 'procedimento_legado' end,
      'contrato_id',v_contrato.id,
      'plano_id',v_item.conta_plano_id,
      'unidade_id',v_item.unidade_id,
      'categoria_cobranca',v_categoria,
      'valor_base',round(v_base,2),
      'sequencia_ato',coalesce(v_item.sequencia_ato,1),
      'grupo_ato',v_grupo_codigo,
      'via_acesso',v_via_acesso,
      'via_referencia',v_via_referencia,
      'acomodacao',v_acomodacao,
      'acomodacao_individual',v_acomodacao_individual,
      'urgencia',v_urgencia,
      'horario_especial',v_horario_especial,
      'anestesia',v_anestesia,
      'quantidade_auxiliares',v_auxiliares,
      'regras_aplicadas',v_regras_aplicadas,
      'percentual_efetivo',v_percentual_efetivo,
      'valor_final',round(v_final,2)
    );

  update public.conta_faturamento_itens
     set metodologia_preco=v_preco.metodologia,
         tabela_procedimento_edicao_id=case when v_usou_comercial then null else v_preco.edicao_id end,
         tabela_procedimento_item_id=case when v_usou_comercial then null else v_preco.item_id end,
         tabela_comercial_edicao_id=case when v_usou_comercial then v_preco.edicao_id else null end,
         tabela_comercial_item_id=case when v_usou_comercial then v_preco.item_id else null end,
         valor_referencia=v_base,
         valor_contratual_calculado=round(v_final,2),
         percentual_aplicado=v_percentual_efetivo,
         regra_contratual_id=v_regra_id,
         memoria_calculo=v_memoria,
         memoria_calculo_comercial=case when v_usou_comercial then coalesce(v_preco.memoria,'{}'::jsonb) else memoria_calculo_comercial end
   where id=p_item_id;

  return v_memoria;
end;
$$;

revoke all on function public.recalcular_item_contratual_avancado_internal(uuid) from public, anon, authenticated;
