begin;

alter table public.conta_faturamento_itens add column if not exists via_acesso text;
alter table public.conta_faturamento_itens add column if not exists anestesia boolean not null default false;
alter table public.conta_faturamento_itens add column if not exists numero_auxiliares integer not null default 0;
alter table public.conta_faturamento_itens add column if not exists filme_m2 numeric(14,4) not null default 0;

comment on column public.conta_faturamento_itens.via_acesso is 'Via de acesso específica do procedimento dentro do mesmo ato.';
comment on column public.conta_faturamento_itens.anestesia is 'Indica participação anestésica para memória de cálculo contratual.';
comment on column public.conta_faturamento_itens.numero_auxiliares is 'Quantidade de auxiliares considerada no ato.';
comment on column public.conta_faturamento_itens.filme_m2 is 'Quantidade de filme em m², quando aplicável ao contrato.';

commit;
