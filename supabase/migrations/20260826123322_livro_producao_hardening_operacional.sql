insert into public.permissoes (codigo,descricao,ativo)
values
  ('producao.visualizar','Visualizar Livro de Produção Assistencial',true),
  ('producao.reprocessar','Sincronizar e reprocessar produção assistencial',true)
on conflict (codigo) do update set descricao=excluded.descricao,ativo=true,updated_at=now();

insert into public.perfil_permissoes (perfil_id,permissao_id,created_by)
select p.id,pe.id,null
from public.perfis p
join public.permissoes pe on pe.codigo in ('producao.visualizar','producao.reprocessar') and pe.ativo
where p.ativo and p.nome in ('Administrador','Faturamento','Auditoria')
on conflict (perfil_id,permissao_id) do nothing;

-- Reativação idempotente: uma origem que voltou a ser válida não pode permanecer cancelada/estornada.
create or replace function public.registrar_evento_producao_assistencial_internal(
  p_atendimento_id uuid,p_tipo_evento text,p_origem_tipo text,p_origem_id uuid,
  p_ocorrido_em timestamptz default now(),p_quantidade numeric default 1,
  p_categoria_contratual text default 'procedimentos',p_profissional_id uuid default null,
  p_setor text default null,p_internacao_id uuid default null,p_item_assistencial_id uuid default null,
  p_codigo_tuss_fallback text default null,p_cobravel boolean default true,p_metadados jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=public,pg_catalog,extensions
as $$
declare v_at public.atendimentos%rowtype; v_id uuid;
begin
  select * into v_at from public.atendimentos where id=p_atendimento_id;
  if not found then raise exception 'PRODUCAO_ATENDIMENTO_NAO_LOCALIZADO'; end if;
  if p_origem_id is null then raise exception 'PRODUCAO_ORIGEM_OBRIGATORIA'; end if;

  insert into public.producao_assistencial_eventos(
    empresa_id,unidade_id,atendimento_id,paciente_id,internacao_id,profissional_id,setor,tipo_evento,
    origem_tipo,origem_id,ocorrido_em,quantidade,categoria_contratual,item_assistencial_id,
    codigo_tuss_fallback,cobravel,status,metadados,created_by,updated_by
  ) values (
    v_at.empresa_id,v_at.unidade_id,v_at.id,v_at.paciente_id,p_internacao_id,p_profissional_id,
    nullif(trim(coalesce(p_setor,'')),''),p_tipo_evento,p_origem_tipo,p_origem_id,coalesce(p_ocorrido_em,now()),
    greatest(coalesce(p_quantidade,1),0.0001),p_categoria_contratual,p_item_assistencial_id,
    nullif(trim(coalesce(p_codigo_tuss_fallback,'')),''),coalesce(p_cobravel,true),'registrado',
    coalesce(p_metadados,'{}'::jsonb),auth.uid(),auth.uid()
  )
  on conflict (empresa_id,unidade_id,origem_tipo,origem_id,tipo_evento)
  do update set
    profissional_id=coalesce(excluded.profissional_id,public.producao_assistencial_eventos.profissional_id),
    setor=coalesce(excluded.setor,public.producao_assistencial_eventos.setor),
    internacao_id=coalesce(excluded.internacao_id,public.producao_assistencial_eventos.internacao_id),
    ocorrido_em=least(public.producao_assistencial_eventos.ocorrido_em,excluded.ocorrido_em),
    quantidade=excluded.quantidade,categoria_contratual=excluded.categoria_contratual,
    item_assistencial_id=coalesce(excluded.item_assistencial_id,public.producao_assistencial_eventos.item_assistencial_id),
    codigo_tuss_fallback=coalesce(excluded.codigo_tuss_fallback,public.producao_assistencial_eventos.codigo_tuss_fallback),
    cobravel=excluded.cobravel,
    status=case when public.producao_assistencial_eventos.status in ('cancelado','estornado') then 'registrado' else public.producao_assistencial_eventos.status end,
    consolidado_em=case when public.producao_assistencial_eventos.status in ('cancelado','estornado') then null else public.producao_assistencial_eventos.consolidado_em end,
    metadados=public.producao_assistencial_eventos.metadados||excluded.metadados,
    updated_at=now(),updated_by=auth.uid()
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.registrar_evento_producao_assistencial_internal(uuid,text,text,uuid,timestamptz,numeric,text,uuid,text,uuid,uuid,text,boolean,jsonb) from public,anon,authenticated;

-- A consulta principal entra no Livro no fato clínico da alta, mesmo se a integração administrativa falhar depois.
create or replace function public.capturar_producao_consulta_alta()
returns trigger
language plpgsql security definer set search_path=public,pg_catalog,extensions
as $$
declare v_tipo text; v_codigo text; v_item uuid;
begin
  if new.status='alta' and (tg_op='INSERT' or old.status is distinct from new.status) then
    if new.agendamento_id is not null or lower(coalesce(new.origem,'')) in ('agenda','agendamento','checkin','check-in') then
      v_tipo:='consulta_ambulatorial'; v_codigo:='10101012';
    elsif lower(coalesce(new.origem,'')) in ('demanda_espontanea','totem','recepcao','pronto_socorro','pronto atendimento','pronto_atendimento','urgencia','emergencia') then
      v_tipo:='consulta_pronto_atendimento'; v_codigo:='10101039';
    end if;

    if v_tipo is not null then
      select i.id into v_item from public.itens_assistenciais i where i.empresa_id=new.empresa_id and i.ativo and i.codigo_tuss=v_codigo order by i.created_at limit 1;
      perform public.registrar_evento_producao_assistencial_internal(new.id,v_tipo,'atendimento_medico',new.id,coalesce(new.data_fechamento,now()),1,'procedimentos',new.profissional_id,'consultorio',null,v_item,v_codigo,true,jsonb_build_object('origem_atendimento',new.origem,'tipo_atendimento_original',new.tipo_atendimento,'regra','pacote_primeiro_tuss_fallback'));
    end if;
  elsif old.status='alta' and new.status is distinct from old.status then
    update public.producao_assistencial_eventos set status='cancelado',cobravel=false,updated_at=now(),updated_by=auth.uid()
    where empresa_id=new.empresa_id and unidade_id=new.unidade_id and origem_tipo='atendimento_medico' and origem_id=new.id and tipo_evento in ('consulta_ambulatorial','consulta_pronto_atendimento');
  end if;
  return new;
end $$;
revoke execute on function public.capturar_producao_consulta_alta() from public,anon,authenticated;
drop trigger if exists trg_capturar_producao_consulta_alta on public.atendimentos;
create trigger trg_capturar_producao_consulta_alta after insert or update of status on public.atendimentos for each row execute function public.capturar_producao_consulta_alta();

-- Reprocessamento manual é contingência; não permite inserir fatos clínicos arbitrários.
create or replace function public.sincronizar_producao_atendimento(p_atendimento_id uuid)
returns jsonb
language plpgsql security definer set search_path=public,pg_catalog
as $$
declare v_at record; v_base jsonb; v_consumos jsonb;
begin
  if auth.uid() is null then raise exception 'PRODUCAO_NAO_AUTENTICADO' using errcode='42501'; end if;
  select empresa_id,unidade_id into v_at from public.atendimentos where id=p_atendimento_id;
  if v_at.empresa_id is null then raise exception 'PRODUCAO_ATENDIMENTO_NAO_LOCALIZADO'; end if;
  if not public.tem_unidade(v_at.empresa_id,v_at.unidade_id) or not public.tem_permissao_funcional(v_at.empresa_id,v_at.unidade_id,'producao.reprocessar') then
    raise exception 'PRODUCAO_SEM_PERMISSAO' using errcode='42501';
  end if;
  v_base:=public.sincronizar_producao_atendimento_internal(p_atendimento_id);
  v_consumos:=public.sincronizar_producao_consumos_internal(p_atendimento_id);
  return jsonb_build_object('assistencial',v_base,'consumos',v_consumos);
end $$;
grant execute on function public.sincronizar_producao_atendimento(uuid) to authenticated;
revoke execute on function public.sincronizar_producao_atendimento(uuid) from public,anon;
