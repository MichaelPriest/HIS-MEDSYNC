create or replace function public.faturamento_reclassificar_conta_na_alta_internal()
returns trigger
language plpgsql security definer
set search_path to 'public','pg_catalog'
as $$
declare
  v_class jsonb;
begin
  if new.status='alta' and old.status is distinct from new.status then
    v_class:=public.faturamento_classificar_atendimento_internal(new.id);
    update public.contas_faturamento c
       set tipo_atendimento_faturamento=v_class->>'tipo',
           tipo_atendimento_classificacao_memoria=v_class||jsonb_build_object('reclassificado_na_alta_em',now()),
           updated_at=now()
     where c.atendimento_id=new.id
       and c.tipo_atendimento_classificacao_origem='automatico'
       and c.status not in ('faturada','cancelada')
       and not exists(select 1 from public.tiss_guias g where g.conta_id=c.id and g.status<>'cancelada');
  end if;
  return new;
end;
$$;

revoke all on function public.faturamento_reclassificar_conta_na_alta_internal() from public,anon,authenticated;

drop trigger if exists trg_faturamento_reclassificar_conta_na_alta on public.atendimentos;
create trigger trg_faturamento_reclassificar_conta_na_alta
after update of status on public.atendimentos
for each row execute function public.faturamento_reclassificar_conta_na_alta_internal();
