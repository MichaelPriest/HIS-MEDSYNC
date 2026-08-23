begin;

create or replace function public.aplicar_precificacao_item_conta()
returns trigger language plpgsql security invoker as $$
declare
  v_conta record;
  v_preco record;
  v_categoria text;
  v_data date;
begin
  select convenio_id,tipo_cobranca into v_conta from public.contas_faturamento where id=new.conta_id;
  if v_conta.convenio_id is null or new.codigo is null then return new; end if;
  v_data := coalesce(new.data_execucao::date,current_date);
  v_categoria := case
    when new.origem_tipo in ('procedimento','laboratorio','imagem','honorario') then 'procedimentos'
    when new.origem_tipo='medicamento' then 'medicamentos'
    when new.origem_tipo in ('material','opme') then case when new.origem_tipo='opme' then 'opme' else 'materiais' end
    when new.origem_tipo='taxa' then 'taxas'
    when new.origem_tipo='diaria' then 'diarias'
    else 'geral' end;
  select * into v_preco from public.obter_valor_procedimento_comercial(v_conta.convenio_id,new.codigo,v_data,v_categoria,false,null) limit 1;
  if found then
    new.tabela_comercial_edicao_id := v_preco.edicao_id;
    new.tabela_comercial_item_id := v_preco.item_id;
    new.valor_referencia_contrato := v_preco.valor_final;
    new.origem_valor := concat(v_preco.fonte,' · ',v_preco.edicao);
    new.memoria_calculo_comercial := v_preco.memoria_calculo;
    if coalesce(new.valor_unitario,0) <= 0 then
      new.valor_unitario := v_preco.valor_final;
    else
      new.valor_cobrado_original := new.valor_unitario;
    end if;
    new.divergencia_valor_contratual := round(coalesce(new.valor_unitario,0)-coalesce(v_preco.valor_final,0),4);
    new.valor_total := round(coalesce(new.quantidade,1)*coalesce(new.valor_unitario,0),2);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_precificacao_item_conta on public.conta_faturamento_itens;
create trigger trg_precificacao_item_conta before insert or update of codigo,valor_unitario,quantidade,data_execucao,origem_tipo
on public.conta_faturamento_itens for each row execute function public.aplicar_precificacao_item_conta();

create table if not exists public.central_guias_itens (
  id uuid primary key default gen_random_uuid(),
  guia_id uuid not null references public.central_guias on delete cascade,
  codigo_tabela text,
  codigo text not null,
  descricao text not null,
  categoria text not null default 'procedimentos' check (categoria in ('procedimentos','opme','medicamentos','materiais','taxas','diarias','geral')),
  quantidade_solicitada numeric(14,4) not null default 1,
  quantidade_autorizada numeric(14,4),
  valor_solicitado numeric(14,4),
  valor_autorizado numeric(14,4),
  valor_contratual numeric(14,4),
  tabela_comercial_edicao_id uuid references public.tabelas_comerciais_edicoes,
  tabela_comercial_item_id uuid references public.tabelas_comerciais_itens,
  memoria_calculo jsonb,
  divergencia_autorizacao numeric(14,4),
  status text not null default 'solicitado' check(status in ('solicitado','autorizado','parcial','negado','cancelado')),
  observacoes text,
  created_at timestamptz not null default now()
);

alter table public.central_guias_itens enable row level security;
create policy central_guias_itens_select on public.central_guias_itens for select using (
  exists(select 1 from public.central_guias g where g.id=guia_id and public.tem_unidade(g.empresa_id,g.unidade_id))
);

create or replace function public.aplicar_precificacao_item_guia()
returns trigger language plpgsql security invoker as $$
declare
  v_guia record;
  v_preco record;
begin
  select convenio_id,data_solicitacao into v_guia from public.central_guias where id=new.guia_id;
  if v_guia.convenio_id is null or new.codigo is null then return new; end if;
  select * into v_preco from public.obter_valor_procedimento_comercial(v_guia.convenio_id,new.codigo,coalesce(v_guia.data_solicitacao::date,current_date),new.categoria,false,null) limit 1;
  if found then
    new.valor_contratual := v_preco.valor_final;
    new.tabela_comercial_edicao_id := v_preco.edicao_id;
    new.tabela_comercial_item_id := v_preco.item_id;
    new.memoria_calculo := v_preco.memoria_calculo;
    if coalesce(new.valor_solicitado,0)<=0 then new.valor_solicitado:=v_preco.valor_final; end if;
    if new.valor_autorizado is not null then new.divergencia_autorizacao:=round(new.valor_autorizado-v_preco.valor_final,4); end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_precificacao_item_guia on public.central_guias_itens;
create trigger trg_precificacao_item_guia before insert or update of codigo,categoria,valor_solicitado,valor_autorizado
on public.central_guias_itens for each row execute function public.aplicar_precificacao_item_guia();

comment on table public.central_guias_itens is 'Itens autorizáveis com comparação automática do valor solicitado/autorizado contra a tabela contratual vigente.';

commit;
