create or replace function public.atualizar_dados_financeiros_lote_operacional(p_lote_id uuid,p_competencia text,p_previsao_pagamento date default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_l public.tiss_lotes%rowtype;
begin
  if v_user is null then raise exception 'TISS_LOTE_NAO_AUTENTICADO' using errcode='42501'; end if;
  if coalesce(p_competencia,'') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'TISS_LOTE_COMPETENCIA_INVALIDA'; end if;
  select * into v_l from public.tiss_lotes where id=p_lote_id for update;
  if not found then raise exception 'TISS_LOTE_NAO_LOCALIZADO'; end if;
  if not public.tem_unidade(v_l.empresa_id,v_l.unidade_id) or not (public.tem_permissao(v_l.empresa_id,v_l.unidade_id,'tiss.gerar') or public.tem_permissao(v_l.empresa_id,v_l.unidade_id,'financeiro.gerenciar')) then raise exception 'TISS_LOTE_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_l.status in ('aceito','rejeitado') then raise exception 'TISS_LOTE_NAO_EDITAVEL'; end if;
  update public.tiss_lotes set competencia=p_competencia,previsao_pagamento=p_previsao_pagamento where id=v_l.id;
  update public.financeiro_recebiveis set competencia=p_competencia,previsao_pagamento=p_previsao_pagamento,updated_at=now(),updated_by=v_user where lote_id=v_l.id and status<>'cancelado';
  return v_l.id;
end $$;
revoke execute on function public.atualizar_dados_financeiros_lote_operacional(uuid,text,date) from public,anon;
grant execute on function public.atualizar_dados_financeiros_lote_operacional(uuid,text,date) to authenticated;

create or replace function public.registrar_protocolo_envio_tiss_operacional(p_lote_id uuid,p_protocolo text,p_origem text default 'portal',p_observacoes text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_l public.tiss_lotes%rowtype;
begin
  if v_user is null then raise exception 'TISS_LOTE_NAO_AUTENTICADO' using errcode='42501'; end if;
  if coalesce(btrim(p_protocolo),'')='' then raise exception 'TISS_PROTOCOLO_ENVIO_OBRIGATORIO'; end if;
  select * into v_l from public.tiss_lotes where id=p_lote_id for update;
  if not found then raise exception 'TISS_LOTE_NAO_LOCALIZADO'; end if;
  if not public.tem_unidade(v_l.empresa_id,v_l.unidade_id) or not (public.tem_permissao(v_l.empresa_id,v_l.unidade_id,'tiss.enviar') or public.tem_permissao(v_l.empresa_id,v_l.unidade_id,'tiss.gerar')) then raise exception 'TISS_ENVIO_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_l.status in ('aceito','rejeitado') then raise exception 'TISS_LOTE_NAO_EDITAVEL'; end if;
  update public.tiss_lotes set protocolo_envio_operadora=btrim(p_protocolo),protocolo_operadora=btrim(p_protocolo),origem_protocolo=coalesce(nullif(btrim(p_origem),''),'portal'),data_envio_manual=now(),observacoes_envio=nullif(btrim(p_observacoes),''),status='protocolado' where id=v_l.id;
  update public.financeiro_recebiveis set status=case when status in ('recebido','parcial','cancelado') then status else 'aguardando_pagamento' end,updated_at=now(),updated_by=v_user where lote_id=v_l.id;
  return v_l.id;
end $$;
revoke execute on function public.registrar_protocolo_envio_tiss_operacional(uuid,text,text,text) from public,anon;
grant execute on function public.registrar_protocolo_envio_tiss_operacional(uuid,text,text,text) to authenticated;