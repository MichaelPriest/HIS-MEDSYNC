drop index if exists public.conta_faturamento_itens_origem_uidx;

create unique index conta_faturamento_itens_origem_uidx
  on public.conta_faturamento_itens (conta_id, origem_tipo, origem_id);

comment on index public.conta_faturamento_itens_origem_uidx is
  'Evita duplicidade de itens importados da mesma origem assistencial na mesma conta e permite inferencia por ON CONFLICT.';