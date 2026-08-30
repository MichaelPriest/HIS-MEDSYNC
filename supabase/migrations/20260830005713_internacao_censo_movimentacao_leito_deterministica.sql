create or replace function public.sincronizar_censo_por_movimentacao_leito_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_catalog','extensions'
as $$
declare
  v_data date := (new.movimentado_em at time zone 'America/Sao_Paulo')::date;
  v_diaria uuid;
  v_setor text;
  v_acomodacao text;
begin
  if new.internacao_id is null or new.tipo not in ('admissao','transferencia','alta') then
    return new;
  end if;

  v_diaria:=public.sincronizar_diaria_internacao_internal(new.internacao_id,v_data);

  if new.tipo in ('admissao','transferencia') and new.leito_destino_id is not null and v_diaria is not null then
    select l.setor,l.acomodacao into v_setor,v_acomodacao
    from public.leitos l where l.id=new.leito_destino_id;

    update public.internacao_diarias
       set leito_id=new.leito_destino_id,
           setor=coalesce(v_setor,setor),
           acomodacao=coalesce(v_acomodacao,acomodacao),
           censo_referencia_em=now(),
           updated_at=now(),
           updated_by=auth.uid()
     where id=v_diaria
       and origem<>'manual';
  end if;

  return new;
end $$;

revoke all on function public.sincronizar_censo_por_movimentacao_leito_trigger() from public,anon,authenticated;
grant execute on function public.sincronizar_censo_por_movimentacao_leito_trigger() to postgres;
