-- Captura imediata da produção executada/consumida nos setores.

create or replace function public.sincronizar_producao_consumos_internal(p_atendimento_id uuid)
returns jsonb
language plpgsql security definer
set search_path=public,pg_catalog,extensions
as $$
declare
  v_at public.atendimentos%rowtype; v_item uuid; v_tipo text; v_categoria text; v_qtd numeric;
  v_materiais integer:=0; v_medicamentos integer:=0; r record;
begin
  select * into v_at from public.atendimentos where id=p_atendimento_id;
  if not found then raise exception 'PRODUCAO_ATENDIMENTO_NAO_LOCALIZADO'; end if;

  for r in select s.* from public.solicitacoes_materiais_assistenciais s where s.atendimento_id=v_at.id and s.empresa_id=v_at.empresa_id and s.unidade_id=v_at.unidade_id and s.status='entregue' loop
    v_item:=r.item_assistencial_id;
    v_tipo:=case when lower(coalesce(r.categoria,''))='opme' then 'opme' when lower(coalesce(r.categoria,'')) in ('gas','gás','gas_medicinal','gás medicinal') then 'gas_medicinal' else 'material' end;
    v_categoria:=case when v_tipo='opme' then 'opme' when v_tipo='gas_medicinal' then 'gases' else 'materiais' end;
    perform public.registrar_evento_producao_assistencial_internal(v_at.id,v_tipo,'material_assistencial',r.id,coalesce(r.updated_at,r.solicitado_em),r.quantidade,v_categoria,r.profissional_id,'almoxarifado',null,v_item,null,true,jsonb_build_object('descricao',r.descricao,'categoria_origem',r.categoria,'unidade_medida',r.unidade_medida));
    v_materiais:=v_materiais+1;
  end loop;

  update public.producao_assistencial_eventos e set status='cancelado',cobravel=false,updated_at=now(),updated_by=auth.uid()
  where e.atendimento_id=v_at.id and e.origem_tipo='material_assistencial'
    and not exists(select 1 from public.solicitacoes_materiais_assistenciais s where s.id=e.origem_id and s.status='entregue');

  for r in
    select d.*,greatest(coalesce(nullif(d.quantidade_atendida,0),d.quantidade)-coalesce(dev.total_devolvido,0),0) quantidade_liquida,
           coalesce(p.item_assistencial_id,ep.item_assistencial_id) item_assistencial_resolvido,
           coalesce(ia.codigo_tuss,ep.codigo_tuss,ep.codigo) codigo_fallback,
           coalesce(ia.descricao,d.item,ep.descricao) descricao_resolvida
    from public.dispensacoes_medicamentos d
    left join lateral(select coalesce(sum(dm.quantidade),0) total_devolvido from public.devolucoes_medicamentos dm where dm.dispensacao_id=d.id) dev on true
    left join public.prescricoes p on p.id=d.prescricao_id
    left join public.estoque_produtos ep on ep.id=d.produto_id and ep.empresa_id=d.empresa_id
    left join public.itens_assistenciais ia on ia.id=coalesce(p.item_assistencial_id,ep.item_assistencial_id) and ia.empresa_id=d.empresa_id
    where d.atendimento_id=v_at.id and d.empresa_id=v_at.empresa_id and d.unidade_id=v_at.unidade_id and d.status in ('dispensado','parcial')
  loop
    v_qtd:=r.quantidade_liquida;
    if v_qtd>0 then
      perform public.registrar_evento_producao_assistencial_internal(v_at.id,'medicamento','dispensacao_medicamento',r.id,coalesce(r.dispensado_em,r.updated_at),v_qtd,'medicamentos',null,'farmacia',null,r.item_assistencial_resolvido,r.codigo_fallback,true,jsonb_build_object('descricao',r.descricao_resolvida,'quantidade_dispensada',r.quantidade,'quantidade_liquida',v_qtd,'unidade_medida',r.unidade_medida));
      v_medicamentos:=v_medicamentos+1;
    else
      update public.producao_assistencial_eventos set status='cancelado',cobravel=false,updated_at=now(),updated_by=auth.uid(),metadados=metadados||jsonb_build_object('motivo','devolucao_integral') where atendimento_id=v_at.id and origem_tipo='dispensacao_medicamento' and origem_id=r.id and tipo_evento='medicamento';
    end if;
  end loop;

  update public.producao_assistencial_eventos e set status='cancelado',cobravel=false,updated_at=now(),updated_by=auth.uid()
  where e.atendimento_id=v_at.id and e.origem_tipo='dispensacao_medicamento'
    and not exists(select 1 from public.dispensacoes_medicamentos d where d.id=e.origem_id and d.status in ('dispensado','parcial'));

  return jsonb_build_object('atendimento_id',v_at.id,'materiais',v_materiais,'medicamentos',v_medicamentos);
end $$;
revoke execute on function public.sincronizar_producao_consumos_internal(uuid) from public,anon,authenticated;

create or replace function public.capturar_producao_procedimento()
returns trigger language plpgsql security definer set search_path=public,pg_catalog,extensions
as $$
declare v_item uuid;
begin
  if new.status='realizado' then
    select i.id into v_item from public.itens_assistenciais i where i.empresa_id=new.empresa_id and i.ativo and ((new.codigo_tuss is not null and i.codigo_tuss=new.codigo_tuss) or (new.codigo_interno is not null and i.codigo_interno=new.codigo_interno)) order by case when new.codigo_tuss is not null and i.codigo_tuss=new.codigo_tuss then 0 else 1 end,i.created_at limit 1;
    perform public.registrar_evento_producao_assistencial_internal(new.atendimento_id,'procedimento','procedimento_assistencial',new.id,new.executado_em,new.quantidade,'procedimentos',new.profissional_id,new.area,null,v_item,new.codigo_tuss,true,jsonb_build_object('procedimento',new.procedimento,'codigo_interno',new.codigo_interno));
  else
    update public.producao_assistencial_eventos set status='cancelado',cobravel=false,updated_at=now(),updated_by=auth.uid() where empresa_id=new.empresa_id and unidade_id=new.unidade_id and origem_tipo='procedimento_assistencial' and origem_id=new.id and tipo_evento='procedimento';
  end if;
  return new;
end $$;
revoke execute on function public.capturar_producao_procedimento() from public,anon,authenticated;
drop trigger if exists trg_capturar_producao_procedimento on public.procedimentos_assistenciais;
create trigger trg_capturar_producao_procedimento after insert or update of status,quantidade,codigo_tuss,codigo_interno on public.procedimentos_assistenciais for each row execute function public.capturar_producao_procedimento();

create or replace function public.capturar_producao_exame()
returns trigger language plpgsql security definer set search_path=public,pg_catalog,extensions
as $$
declare v_item uuid; v_tipo text;
begin
  if new.status='liberado' then
    v_tipo:=case when new.modalidade='laboratorio' then 'laboratorio' when new.modalidade='imagem' then 'imagem' else 'exame' end;
    select i.id into v_item from public.itens_assistenciais i where i.empresa_id=new.empresa_id and i.ativo and new.codigo_tuss is not null and i.codigo_tuss=new.codigo_tuss order by i.created_at limit 1;
    perform public.registrar_evento_producao_assistencial_internal(new.atendimento_id,v_tipo,'solicitacao_exame',new.id,coalesce(new.resultado_em,new.updated_at),1,'exames',new.profissional_id,new.modalidade,null,v_item,new.codigo_tuss,true,jsonb_build_object('exame',new.exame,'modalidade',new.modalidade));
  elsif old.status='liberado' and new.status is distinct from old.status then
    update public.producao_assistencial_eventos set status='cancelado',cobravel=false,updated_at=now(),updated_by=auth.uid() where empresa_id=new.empresa_id and unidade_id=new.unidade_id and origem_tipo='solicitacao_exame' and origem_id=new.id;
  end if;
  return new;
end $$;
revoke execute on function public.capturar_producao_exame() from public,anon,authenticated;
drop trigger if exists trg_capturar_producao_exame on public.solicitacoes_exames;
create trigger trg_capturar_producao_exame after insert or update of status,codigo_tuss,resultado_em on public.solicitacoes_exames for each row execute function public.capturar_producao_exame();

create or replace function public.capturar_producao_consumos_atendimento()
returns trigger language plpgsql security definer set search_path=public,pg_catalog
as $$ begin perform public.sincronizar_producao_consumos_internal(new.atendimento_id); return new; end $$;
revoke execute on function public.capturar_producao_consumos_atendimento() from public,anon,authenticated;

drop trigger if exists trg_capturar_producao_material on public.solicitacoes_materiais_assistenciais;
create trigger trg_capturar_producao_material after insert or update of status,quantidade,item_assistencial_id on public.solicitacoes_materiais_assistenciais for each row execute function public.capturar_producao_consumos_atendimento();

drop trigger if exists trg_capturar_producao_dispensacao on public.dispensacoes_medicamentos;
create trigger trg_capturar_producao_dispensacao after insert or update of status,quantidade,quantidade_atendida,produto_id on public.dispensacoes_medicamentos for each row execute function public.capturar_producao_consumos_atendimento();

create or replace function public.capturar_producao_devolucao_medicamento()
returns trigger language plpgsql security definer set search_path=public,pg_catalog
as $$ begin perform public.sincronizar_producao_consumos_internal(new.atendimento_id); return new; end $$;
revoke execute on function public.capturar_producao_devolucao_medicamento() from public,anon,authenticated;

drop trigger if exists trg_capturar_producao_devolucao on public.devolucoes_medicamentos;
create trigger trg_capturar_producao_devolucao after insert or update of quantidade on public.devolucoes_medicamentos for each row execute function public.capturar_producao_devolucao_medicamento();

create or replace function public.preparar_conta_pos_alta_internal(p_atendimento_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog
as $$
declare v_conta record;
begin
  select id,status into v_conta from public.contas_faturamento where atendimento_id=p_atendimento_id limit 1;
  if v_conta.id is not null and v_conta.status in ('pronta','faturada','cancelada') then return jsonb_build_object('conta_id',v_conta.id,'status',v_conta.status,'preservada',true,'motivo','conta_em_estado_protegido'); end if;
  perform public.sincronizar_producao_consumos_internal(p_atendimento_id);
  return public.preparar_conta_pos_alta_livro_internal(p_atendimento_id);
end $$;
revoke execute on function public.preparar_conta_pos_alta_internal(uuid) from public,anon,authenticated;
