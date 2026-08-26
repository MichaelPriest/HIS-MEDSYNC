create or replace function public.atualizar_resumo_conta_faturamento(
  p_conta_id uuid,
  p_competencia text,
  p_valor_desconto numeric
)
returns void
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_user uuid := auth.uid();
  v_conta public.contas_faturamento%rowtype;
  v_desconto numeric := greatest(coalesce(p_valor_desconto,0),0);
begin
  if v_user is null then raise exception 'FAT_CONTA_NAO_AUTENTICADA' using errcode='42501'; end if;
  select * into v_conta from public.contas_faturamento where id=p_conta_id for update;
  if not found then raise exception 'FAT_CONTA_NAO_LOCALIZADA' using errcode='P0002'; end if;
  if not public.tem_unidade(v_conta.empresa_id,v_conta.unidade_id)
     or not public.tem_permissao(v_conta.empresa_id,v_conta.unidade_id,'faturamento.criar') then
    raise exception 'FAT_CONTA_SEM_PERMISSAO' using errcode='42501';
  end if;
  if v_conta.status in ('faturada','cancelada') then raise exception 'FAT_CONTA_NAO_EDITAVEL'; end if;
  if exists(select 1 from public.tiss_guias g where g.conta_id=p_conta_id and g.status <> 'cancelada') then
    raise exception 'FAT_CONTA_COM_GUIA_TISS_ATIVA';
  end if;
  if p_competencia is null or p_competencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'FAT_COMPETENCIA_INVALIDA'; end if;
  if v_desconto > coalesce(v_conta.valor_bruto,0) then raise exception 'FAT_DESCONTO_MAIOR_QUE_BRUTO'; end if;
  update public.contas_faturamento
     set competencia=p_competencia,
         valor_desconto=v_desconto,
         valor_liquido=greatest(coalesce(valor_bruto,0)-v_desconto,0),
         status=case when status='pronta' then 'pre_faturamento' else status end,
         updated_at=now(),updated_by=v_user
   where id=p_conta_id;
end
$function$;

revoke all on function public.atualizar_resumo_conta_faturamento(uuid,text,numeric) from public,anon,authenticated;
grant execute on function public.atualizar_resumo_conta_faturamento(uuid,text,numeric) to authenticated;
