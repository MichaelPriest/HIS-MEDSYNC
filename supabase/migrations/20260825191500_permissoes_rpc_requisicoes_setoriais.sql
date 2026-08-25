-- Permissões dos perfis e RPCs seguras das requisições setoriais.

insert into public.perfil_permissoes(perfil_id,permissao_id)
select p.id, pe.id from public.perfis p cross join public.permissoes pe
where p.ativo=true and pe.codigo='almoxarifado.requisitar'
  and p.nome in ('Administrador','Enfermagem','Medico','Farmacia','Centro Cirurgico','CME','Laboratorio','Diagnostico por Imagem','Nutricao','Equipe Multiprofissional','Fisioterapia','Hemodialise','Hemodinamica','Hemoterapia','Oncologia','Radioterapia','Home Care','Cuidados Paliativos')
on conflict do nothing;

insert into public.perfil_permissoes(perfil_id,permissao_id)
select p.id, pe.id from public.perfis p cross join public.permissoes pe
where p.ativo=true and pe.codigo='almoxarifado.atender' and p.nome in ('Administrador','Compras e Estoque')
on conflict do nothing;

create or replace function public.criar_requisicao_setorial(
  p_empresa_id uuid,p_unidade_id uuid,p_setor_id uuid,p_local_destino_id uuid,p_prioridade text,p_justificativa text,p_itens jsonb
) returns uuid language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_id uuid;v_numero text;v_prof uuid;v_item jsonb;v_prod record;
begin
 if auth.uid() is null then raise exception 'USUARIO_NAO_AUTENTICADO' using errcode='42501';end if;
 if not public.tem_permissao(p_empresa_id,p_unidade_id,'almoxarifado.requisitar') then raise exception 'SEM_PERMISSAO_REQUISITAR_ALMOXARIFADO' using errcode='42501';end if;
 if p_empresa_id is null or p_unidade_id is null or p_local_destino_id is null then raise exception 'REQUISICAO_ESCOPO_INVALIDO';end if;
 if coalesce(jsonb_array_length(p_itens),0)=0 then raise exception 'REQUISICAO_SEM_ITENS';end if;
 if not exists(select 1 from public.estoque_locais l where l.id=p_local_destino_id and l.empresa_id=p_empresa_id and l.unidade_id=p_unidade_id and l.ativo=true) then raise exception 'LOCAL_DESTINO_INVALIDO';end if;
 if p_setor_id is not null and not exists(select 1 from public.setores s where s.id=p_setor_id and s.empresa_id=p_empresa_id and s.unidade_id=p_unidade_id and s.ativo=true) then raise exception 'SETOR_INVALIDO';end if;
 v_prof:=public.profissional_logado(p_empresa_id);
 v_numero:='REQ-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));
 insert into public.estoque_requisicoes_setoriais(empresa_id,unidade_id,numero,setor_id,local_destino_id,solicitante_id,prioridade,justificativa,status,created_by,updated_by)
 values(p_empresa_id,p_unidade_id,v_numero,p_setor_id,p_local_destino_id,v_prof,coalesce(nullif(p_prioridade,''),'normal'),nullif(trim(coalesce(p_justificativa,'')),''),'solicitada',auth.uid(),auth.uid()) returning id into v_id;
 for v_item in select value from jsonb_array_elements(p_itens) loop
   if nullif(v_item->>'produto_id','') is null or coalesce((v_item->>'quantidade')::numeric,0)<=0 then continue;end if;
   select id,unidade_medida into v_prod from public.estoque_produtos where id=(v_item->>'produto_id')::uuid and empresa_id=p_empresa_id and ativo=true;
   if not found then raise exception 'PRODUTO_INVALIDO';end if;
   insert into public.estoque_requisicao_setorial_itens(requisicao_id,produto_id,quantidade_solicitada,unidade_medida,observacoes,created_by,updated_by)
   values(v_id,v_prod.id,(v_item->>'quantidade')::numeric,coalesce(nullif(v_item->>'unidade_medida',''),v_prod.unidade_medida),nullif(trim(coalesce(v_item->>'observacoes','')),''),auth.uid(),auth.uid());
 end loop;
 if not exists(select 1 from public.estoque_requisicao_setorial_itens where requisicao_id=v_id) then delete from public.estoque_requisicoes_setoriais where id=v_id;raise exception 'REQUISICAO_SEM_ITENS_VALIDOS';end if;
 insert into public.estoque_requisicao_setorial_eventos(requisicao_id,evento,detalhe,profissional_id,usuario_id)
 values(v_id,'solicitada',jsonb_build_object('prioridade',coalesce(p_prioridade,'normal'),'local_destino_id',p_local_destino_id),v_prof,auth.uid());
 return v_id;
end;$$;

create or replace function public.atender_requisicao_setorial_item(p_item_id uuid,p_estoque_lote_id uuid,p_quantidade numeric)
returns uuid language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_item record;v_req record;v_lote record;v_dest_lote uuid;v_mov uuid;v_prof uuid;v_restante numeric;
begin
 if auth.uid() is null then raise exception 'USUARIO_NAO_AUTENTICADO' using errcode='42501';end if;
 if p_quantidade is null or p_quantidade<=0 then raise exception 'QUANTIDADE_INVALIDA';end if;
 select i.* into v_item from public.estoque_requisicao_setorial_itens i where i.id=p_item_id for update;if not found then raise exception 'ITEM_REQUISICAO_NAO_LOCALIZADO';end if;
 select r.* into v_req from public.estoque_requisicoes_setoriais r where r.id=v_item.requisicao_id for update;
 if not public.tem_permissao(v_req.empresa_id,v_req.unidade_id,'almoxarifado.atender') then raise exception 'SEM_PERMISSAO_ATENDER_ALMOXARIFADO' using errcode='42501';end if;
 if v_req.status in ('cancelada','atendida','recebida') then raise exception 'REQUISICAO_NAO_PODE_SER_ATENDIDA';end if;
 select l.* into v_lote from public.estoque_lotes l where l.id=p_estoque_lote_id for update;if not found then raise exception 'LOTE_NAO_LOCALIZADO';end if;
 if v_lote.empresa_id<>v_req.empresa_id or v_lote.unidade_id<>v_req.unidade_id then raise exception 'LOTE_FORA_ESCOPO';end if;
 if v_lote.produto_id<>v_item.produto_id then raise exception 'PRODUTO_DIVERGENTE';end if;
 if v_lote.local_id=v_req.local_destino_id then raise exception 'ORIGEM_IGUAL_DESTINO';end if;
 v_restante:=greatest(coalesce(v_item.quantidade_aprovada,v_item.quantidade_solicitada)-coalesce(v_item.quantidade_atendida,0),0);
 if p_quantidade>v_restante then raise exception 'QUANTIDADE_SUPERA_PENDENCIA';end if;
 if v_lote.quantidade<p_quantidade then raise exception 'ESTOQUE_INSUFICIENTE';end if;
 update public.estoque_lotes set quantidade=quantidade-p_quantidade,updated_at=now() where id=v_lote.id;
 select id into v_dest_lote from public.estoque_lotes where empresa_id=v_req.empresa_id and unidade_id=v_req.unidade_id and local_id=v_req.local_destino_id and produto_id=v_lote.produto_id and coalesce(numero_lote,'')=coalesce(v_lote.numero_lote,'') and validade is not distinct from v_lote.validade and coalesce(custo_unitario,0)=coalesce(v_lote.custo_unitario,0) limit 1 for update;
 if v_dest_lote is null then
   insert into public.estoque_lotes(empresa_id,unidade_id,local_id,produto_id,fornecedor_id,numero_lote,validade,quantidade,custo_unitario,created_at,updated_at)
   values(v_req.empresa_id,v_req.unidade_id,v_req.local_destino_id,v_lote.produto_id,v_lote.fornecedor_id,v_lote.numero_lote,v_lote.validade,p_quantidade,v_lote.custo_unitario,now(),now()) returning id into v_dest_lote;
 else update public.estoque_lotes set quantidade=quantidade+p_quantidade,updated_at=now() where id=v_dest_lote;end if;
 insert into public.estoque_movimentos(empresa_id,unidade_id,produto_id,lote_id,local_origem_id,local_destino_id,tipo,quantidade,custo_unitario,motivo,created_at,created_by)
 values(v_req.empresa_id,v_req.unidade_id,v_lote.produto_id,v_lote.id,v_lote.local_id,v_req.local_destino_id,'transferencia',p_quantidade,v_lote.custo_unitario,'Atendimento da requisição '||v_req.numero,now(),auth.uid()) returning id into v_mov;
 update public.estoque_requisicao_setorial_itens set quantidade_atendida=quantidade_atendida+p_quantidade,status=case when quantidade_atendida+p_quantidade>=coalesce(quantidade_aprovada,quantidade_solicitada) then 'atendido' else 'parcial' end,updated_at=now(),updated_by=auth.uid() where id=v_item.id;
 update public.estoque_requisicoes_setoriais r set local_origem_id=coalesce(r.local_origem_id,v_lote.local_id),iniciado_em=coalesce(r.iniciado_em,now()),status=case when not exists(select 1 from public.estoque_requisicao_setorial_itens x where x.requisicao_id=r.id and x.status not in ('atendido','cancelado')) then 'atendida' when exists(select 1 from public.estoque_requisicao_setorial_itens x where x.requisicao_id=r.id and x.quantidade_atendida>0) then 'parcial' else 'em_separacao' end,atendido_em=case when not exists(select 1 from public.estoque_requisicao_setorial_itens x where x.requisicao_id=r.id and x.status not in ('atendido','cancelado')) then now() else r.atendido_em end,updated_at=now(),updated_by=auth.uid() where r.id=v_req.id;
 v_prof:=public.profissional_logado(v_req.empresa_id);
 insert into public.estoque_requisicao_setorial_eventos(requisicao_id,evento,detalhe,profissional_id,usuario_id) values(v_req.id,'item_atendido',jsonb_build_object('item_id',v_item.id,'lote_origem_id',v_lote.id,'lote_destino_id',v_dest_lote,'quantidade',p_quantidade,'movimento_id',v_mov),v_prof,auth.uid());
 return v_mov;
end;$$;

create or replace function public.receber_requisicao_setorial(p_requisicao_id uuid)
returns void language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_req record;v_prof uuid;
begin
 select * into v_req from public.estoque_requisicoes_setoriais where id=p_requisicao_id for update;if not found then raise exception 'REQUISICAO_NAO_LOCALIZADA';end if;
 if not public.tem_permissao(v_req.empresa_id,v_req.unidade_id,'almoxarifado.requisitar') then raise exception 'SEM_PERMISSAO_RECEBER_REQUISICAO' using errcode='42501';end if;
 if v_req.status<>'atendida' then raise exception 'REQUISICAO_AINDA_NAO_ATENDIDA';end if;
 if exists(select 1 from public.estoque_requisicao_setorial_itens where requisicao_id=v_req.id and status not in ('atendido','cancelado')) then raise exception 'REQUISICAO_POSSUI_ITENS_PENDENTES';end if;
 update public.estoque_requisicoes_setoriais set status='recebida',recebido_em=now(),updated_at=now(),updated_by=auth.uid() where id=v_req.id;
 v_prof:=public.profissional_logado(v_req.empresa_id);
 insert into public.estoque_requisicao_setorial_eventos(requisicao_id,evento,detalhe,profissional_id,usuario_id) values(v_req.id,'recebida','{}'::jsonb,v_prof,auth.uid());
end;$$;

revoke execute on function public.criar_requisicao_setorial(uuid,uuid,uuid,uuid,text,text,jsonb) from anon,public;
revoke execute on function public.atender_requisicao_setorial_item(uuid,uuid,numeric) from anon,public;
revoke execute on function public.receber_requisicao_setorial(uuid) from anon,public;
grant execute on function public.criar_requisicao_setorial(uuid,uuid,uuid,uuid,text,text,jsonb) to authenticated;
grant execute on function public.atender_requisicao_setorial_item(uuid,uuid,numeric) to authenticated;
grant execute on function public.receber_requisicao_setorial(uuid) to authenticated;
