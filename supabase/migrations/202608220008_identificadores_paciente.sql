begin;

create sequence if not exists public.paciente_registro_seq start with 100000;

alter table public.pacientes
  add column if not exists numero_registro bigint,
  add column if not exists ra text;

update public.pacientes
set numero_registro = nextval('public.paciente_registro_seq')
where numero_registro is null;

update public.pacientes
set ra = 'RA' || lpad(numero_registro::text, 8, '0')
where ra is null;

alter table public.pacientes
  alter column numero_registro set default nextval('public.paciente_registro_seq'),
  alter column numero_registro set not null,
  alter column ra set not null;

create unique index if not exists pacientes_numero_registro_unique on public.pacientes(numero_registro);
create unique index if not exists pacientes_ra_unique on public.pacientes(ra);

create or replace function public.preencher_ra_paciente()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.numero_registro is null then
    new.numero_registro := nextval('public.paciente_registro_seq');
  end if;
  new.ra := 'RA' || lpad(new.numero_registro::text, 8, '0');
  return new;
end;
$$;

drop trigger if exists trg_pacientes_ra on public.pacientes;
create trigger trg_pacientes_ra
before insert or update of numero_registro on public.pacientes
for each row execute function public.preencher_ra_paciente();

commit;
