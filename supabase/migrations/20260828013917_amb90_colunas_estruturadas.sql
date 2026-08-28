begin;

alter table public.tabelas_comerciais_itens
  add column if not exists quantidade_auxiliares numeric(14,6) null,
  add column if not exists ch_anestesista numeric(14,6) null,
  add column if not exists quantidade_filme numeric(14,6) null;

-- Correção estrutural de dados já importados. A edição publicada continua
-- imutável para a aplicação; o trigger é suspenso somente nesta transação.
alter table public.tabelas_comerciais_itens disable trigger trg_proteger_item_tabela_comercial_publicada;

update public.tabelas_comerciais_itens
set
  quantidade_auxiliares=coalesce(quantidade_auxiliares,nullif(metadata->>'quantidade_aux','')::numeric),
  porte=coalesce(porte,nullif(metadata->>'porte_cirurgico','')),
  ch_anestesista=coalesce(ch_anestesista,nullif(metadata->>'ch_anestesista','')::numeric),
  quantidade_filme=coalesce(quantidade_filme,nullif(metadata->>'quantidade_filme','')::numeric)
where metadata ?| array['quantidade_aux','porte_cirurgico','ch_anestesista','quantidade_filme'];

alter table public.tabelas_comerciais_itens enable trigger trg_proteger_item_tabela_comercial_publicada;

comment on column public.tabelas_comerciais_itens.quantidade_auxiliares is 'Quantidade de auxiliares prevista na tabela de origem, inclusive AMB.';
comment on column public.tabelas_comerciais_itens.ch_anestesista is 'Coeficiente de honorário anestésico informado pela tabela de origem.';
comment on column public.tabelas_comerciais_itens.quantidade_filme is 'Quantidade de filme prevista na tabela de origem.';

commit;
