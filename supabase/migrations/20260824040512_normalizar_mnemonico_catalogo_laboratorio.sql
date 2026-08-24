-- Normaliza o identificador do campo sem acento para uso consistente no cliente.
do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='laboratorio_catalogo_exames' and column_name='mnemônico')
     and not exists(select 1 from information_schema.columns where table_schema='public' and table_name='laboratorio_catalogo_exames' and column_name='mnemonico') then
    execute 'alter table public.laboratorio_catalogo_exames rename column "mnemônico" to mnemonico';
  end if;
end $$;
alter table public.laboratorio_catalogo_exames add column if not exists mnemonico text;
