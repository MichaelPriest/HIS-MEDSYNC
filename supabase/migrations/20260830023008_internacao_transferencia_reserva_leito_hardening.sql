-- Impede que qualquer fluxo ocupe um leito reservado para outro atendimento.
-- Reserva compatível é consumida quando o próprio atendimento passa a ocupar o leito.
create or replace function public.validar_ocupacao_leito_reserva_internal()
returns trigger
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_atendimento_id uuid;
begin
  if new.status is distinct from 'ocupado' or old.status = 'ocupado' then
    return new;
  end if;

  update public.leito_reservas
     set status='expirada',updated_at=now(),updated_by=auth.uid()
   where leito_id=new.id
     and status='ativa'
     and reservado_ate is not null
     and reservado_ate<=now();

  if not exists(select 1 from public.leito_reservas r where r.leito_id=new.id and r.status='ativa') then
    return new;
  end if;

  select i.atendimento_id into v_atendimento_id
    from public.internacoes i
   where i.leito_id=new.id and i.status='internado'
   order by i.updated_at desc nulls last,i.created_at desc
   limit 1;

  if v_atendimento_id is null or exists(
    select 1 from public.leito_reservas r
     where r.leito_id=new.id and r.status='ativa' and r.atendimento_id<>v_atendimento_id
  ) then
    raise exception 'LEITO_RESERVADO_PARA_OUTRO_ATENDIMENTO' using errcode='23514';
  end if;

  update public.leito_reservas
     set status='utilizada',updated_at=now(),updated_by=auth.uid()
   where leito_id=new.id and status='ativa' and atendimento_id=v_atendimento_id;

  return new;
end;
$$;

revoke all on function public.validar_ocupacao_leito_reserva_internal() from public,anon,authenticated;

drop trigger if exists trg_validar_ocupacao_leito_reserva on public.leitos;
create trigger trg_validar_ocupacao_leito_reserva
before update of status on public.leitos
for each row
when (new.status='ocupado' and old.status is distinct from 'ocupado')
execute function public.validar_ocupacao_leito_reserva_internal();
