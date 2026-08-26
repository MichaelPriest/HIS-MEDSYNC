create or replace function public.validar_guia_tiss_apos_inserir_itens()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_guia_id uuid;
begin
  for v_guia_id in
    select distinct n.guia_id
      from new_rows n
     where n.guia_id is not null
  loop
    perform public.validar_guia_tiss_internal(v_guia_id);
  end loop;
  return null;
end
$function$;

revoke all on function public.validar_guia_tiss_apos_inserir_itens() from public,anon,authenticated;

drop trigger if exists trg_validar_guia_tiss_apos_inserir_itens on public.tiss_guia_itens;
create trigger trg_validar_guia_tiss_apos_inserir_itens
after insert on public.tiss_guia_itens
referencing new table as new_rows
for each statement
execute function public.validar_guia_tiss_apos_inserir_itens();
