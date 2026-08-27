create index if not exists idx_cirurgia_eventos_profissional
  on public.cirurgia_eventos(profissional_id)
  where profissional_id is not null;

create index if not exists idx_cirurgia_cme_ciclos_ciclo
  on public.cirurgia_cme_ciclos(ciclo_id);
