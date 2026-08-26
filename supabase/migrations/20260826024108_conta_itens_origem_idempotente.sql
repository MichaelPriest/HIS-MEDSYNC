create unique index if not exists conta_faturamento_itens_origem_uidx
  on public.conta_faturamento_itens (conta_id, origem_tipo, origem_id)
  where origem_id is not null;

comment on index public.conta_faturamento_itens_origem_uidx is
  'Evita duplicidade de itens importados da mesma origem assistencial na mesma conta.';