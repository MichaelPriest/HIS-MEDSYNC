begin;

alter table public.configuracoes_painel_chamadas
  add column if not exists quantidade_guiches integer not null default 3;

alter table public.configuracoes_painel_chamadas
  drop constraint if exists configuracoes_painel_chamadas_quantidade_guiches_check;

alter table public.configuracoes_painel_chamadas
  add constraint configuracoes_painel_chamadas_quantidade_guiches_check
  check (quantidade_guiches between 1 and 30);

update public.configuracoes_painel_chamadas
set quantidade_guiches = greatest(1, least(coalesce(quantidade_guiches, 3), 30));

comment on column public.configuracoes_painel_chamadas.quantidade_guiches is
  'Quantidade de guiches habilitados para chamadas na recepcao da unidade.';

commit;
