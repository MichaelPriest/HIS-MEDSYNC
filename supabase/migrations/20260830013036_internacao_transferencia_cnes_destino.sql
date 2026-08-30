-- Em transferências interunidades o novo atendimento pertence ao CNES da unidade destino.
create or replace function public.sincronizar_cnes_transferencia_interunidade()
returns trigger
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
begin
  if new.origem='transferencia_interunidade' then
    select u.cnes into new.cnes_snapshot
      from public.unidades u
     where u.id=new.unidade_id and u.empresa_id=new.empresa_id;
  end if;
  return new;
end;
$$;

revoke all on function public.sincronizar_cnes_transferencia_interunidade() from public,anon,authenticated;

drop trigger if exists trg_atendimentos_cnes_transferencia_interunidade on public.atendimentos;
create trigger trg_atendimentos_cnes_transferencia_interunidade
before insert on public.atendimentos
for each row
when (new.origem='transferencia_interunidade')
execute function public.sincronizar_cnes_transferencia_interunidade();
