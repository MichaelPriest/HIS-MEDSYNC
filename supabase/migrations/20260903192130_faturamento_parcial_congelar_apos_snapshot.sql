do $$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='faturamento_fechar_parcial_internacao';
  v_def:=replace(v_def,$old$v_i.id,'parcial',p_periodo_inicio,p_periodo_fim,v_num,v_corrente,now(),v_user$old$,$new$v_i.id,'parcial',p_periodo_inicio,p_periodo_fim,v_num,v_corrente,null,null$new$);
  v_def:=replace(v_def,$old$update public.contas_faturamento set valor_bruto=v_total,valor_liquido=v_total,fechada_em=now(),updated_at=now(),updated_by=v_user where id=v_parcial;$old$,$new$update public.contas_faturamento set valor_bruto=v_total,valor_liquido=v_total,fechada_em=now(),congelada_em=now(),congelada_por=v_user,updated_at=now(),updated_by=v_user where id=v_parcial;$new$);
  execute v_def;

  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='faturamento_fechar_conta_final_internacao';
  v_def:=replace(v_def,$old$v_i.id,'final',v_inicio,v_fim,v_corrente,now(),v_user$old$,$new$v_i.id,'final',v_inicio,v_fim,v_corrente,null,null$new$);
  v_def:=replace(v_def,$old$update public.contas_faturamento set valor_bruto=v_total,valor_liquido=v_total,fechada_em=now(),updated_at=now(),updated_by=v_user where id=v_final;$old$,$new$update public.contas_faturamento set valor_bruto=v_total,valor_liquido=v_total,fechada_em=now(),congelada_em=now(),congelada_por=v_user,updated_at=now(),updated_by=v_user where id=v_final;$new$);
  execute v_def;
end $$;

create or replace function public.faturamento_proteger_conta_congelada_internal()
returns trigger language plpgsql security definer set search_path='public','pg_catalog' as $$
begin
  if tg_op='DELETE' then
    if old.congelada_em is not null then raise exception 'FAT_CONTA_CONGELADA'; end if;
    return old;
  end if;
  if old.congelada_em is not null then
    if (to_jsonb(new)-array['status','auditoria_liberada','contas_medicas_liberada','auditoria_id','updated_at','updated_by'])
       is distinct from
       (to_jsonb(old)-array['status','auditoria_liberada','contas_medicas_liberada','auditoria_id','updated_at','updated_by']) then
      raise exception 'FAT_CONTA_CONGELADA';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.faturamento_proteger_conta_congelada_internal() from public,anon,authenticated;
