create or replace function public.sincronizar_censo_por_movimentacao_leito_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_catalog','extensions'
as $$
begin
  if new.internacao_id is not null and new.tipo in ('admissao','transferencia','alta') then
    perform public.sincronizar_diaria_internacao_internal(
      new.internacao_id,
      (new.movimentado_em at time zone 'America/Sao_Paulo')::date
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_sincronizar_censo_movimentacao_leito on public.movimentacoes_leitos;
create trigger trg_sincronizar_censo_movimentacao_leito
after insert on public.movimentacoes_leitos
for each row execute function public.sincronizar_censo_por_movimentacao_leito_trigger();

revoke all on function public.sincronizar_censo_por_movimentacao_leito_trigger() from public,anon,authenticated;
grant execute on function public.sincronizar_censo_por_movimentacao_leito_trigger() to postgres;
