-- Livro de Produção: classificação TEA/ABA e requisito contratual de autorização.

alter table public.contrato_producao_mapeamentos
  add column if not exists exige_autorizacao boolean null;

alter table public.producao_assistencial_eventos
  add column if not exists autorizacao_id uuid null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='producao_assistencial_eventos_autorizacao_id_fkey') then
    alter table public.producao_assistencial_eventos
      add constraint producao_assistencial_eventos_autorizacao_id_fkey
      foreign key (autorizacao_id) references public.central_guias(id) on delete set null;
  end if;
end $$;
create index if not exists idx_producao_eventos_autorizacao
  on public.producao_assistencial_eventos(autorizacao_id)
  where autorizacao_id is not null;

create or replace function public.classificar_procedimento_producao_internal(p_procedimento_id uuid)
returns jsonb
language plpgsql security definer
set search_path=public,pg_catalog,extensions
as $$
declare
  v_p public.procedimentos_assistenciais%rowtype;
  v_item public.itens_assistenciais%rowtype;
  v_tipo text := 'procedimento';
  v_marcador text := 'procedimento_padrao';
  v_texto text;
  v_codigo text;
begin
  select * into v_p from public.procedimentos_assistenciais where id=p_procedimento_id;
  if not found then raise exception 'PRODUCAO_PROCEDIMENTO_NAO_LOCALIZADO'; end if;

  select i.* into v_item
    from public.itens_assistenciais i
   where i.empresa_id=v_p.empresa_id and i.ativo
     and ((v_p.codigo_tuss is not null and i.codigo_tuss=v_p.codigo_tuss)
       or (v_p.codigo_interno is not null and i.codigo_interno=v_p.codigo_interno))
   order by case when v_p.codigo_tuss is not null and i.codigo_tuss=v_p.codigo_tuss then 0 else 1 end,i.created_at
   limit 1;

  v_texto := lower(coalesce(v_p.procedimento,''));
  v_codigo := coalesce(v_p.codigo_tuss,v_p.codigo_interno,'');

  if lower(coalesce(v_item.metadata->>'tipo_producao',''))='sessao_tea_aba'
     or lower(coalesce(v_item.metadata->>'linha_cuidado','')) in ('tea','aba','tea_aba','tea/aba')
     or lower(coalesce(v_item.metadata->>'programa_assistencial','')) in ('tea','aba','tea_aba','tea/aba') then
    v_tipo := 'sessao_tea_aba';
    v_marcador := 'catalogo_metadata';
  elsif v_codigo in ('66600480','66600499','66600502','66600510') then
    v_tipo := 'sessao_tea_aba';
    v_marcador := 'codigo_tea_tgd_compatibilidade';
  elsif v_texto ~ '(^|[^[:alnum:]_])(tea|tgd|aba)([^[:alnum:]_]|$)|autis' then
    v_tipo := 'sessao_tea_aba';
    v_marcador := 'descricao_linha_cuidado';
  end if;

  return jsonb_build_object(
    'tipo_evento',v_tipo,
    'categoria_contratual','procedimentos',
    'item_assistencial_id',v_item.id,
    'codigo_tuss_fallback',v_p.codigo_tuss,
    'marcador',v_marcador,
    'codigo_interno',v_p.codigo_interno,
    'codigo_tuss',v_p.codigo_tuss
  );
end $$;
revoke execute on function public.classificar_procedimento_producao_internal(uuid) from public,anon,authenticated;

create or replace function public.capturar_producao_procedimento()
returns trigger
language plpgsql security definer
set search_path=public,pg_catalog,extensions
as $$
declare
  v_class jsonb;
  v_tipo text;
  v_item uuid;
  v_fallback text;
begin
  if new.status='realizado' then
    v_class := public.classificar_procedimento_producao_internal(new.id);
    v_tipo := coalesce(v_class->>'tipo_evento','procedimento');
    v_item := nullif(v_class->>'item_assistencial_id','')::uuid;
    v_fallback := nullif(v_class->>'codigo_tuss_fallback','');

    perform public.registrar_evento_producao_assistencial_internal(
      new.atendimento_id,v_tipo,'procedimento_assistencial',new.id,new.executado_em,new.quantidade,
      'procedimentos',new.profissional_id,new.area,null,v_item,v_fallback,true,
      jsonb_build_object(
        'procedimento',new.procedimento,'codigo_interno',new.codigo_interno,
        'classificacao_producao',v_class->>'marcador','duracao_minutos',new.duracao_minutos
      )
    );

    update public.producao_assistencial_eventos
       set status='estornado',cobravel=false,consolidado_em=null,updated_at=now(),updated_by=auth.uid(),
           metadados=metadados||jsonb_build_object('motivo_estorno','reclassificacao_producao','tipo_evento_ativo',v_tipo)
     where empresa_id=new.empresa_id and unidade_id=new.unidade_id
       and origem_tipo='procedimento_assistencial' and origem_id=new.id
       and tipo_evento in ('procedimento','sessao_tea_aba') and tipo_evento<>v_tipo
       and status not in ('cancelado','estornado');
  else
    update public.producao_assistencial_eventos
       set status='cancelado',cobravel=false,consolidado_em=null,updated_at=now(),updated_by=auth.uid()
     where empresa_id=new.empresa_id and unidade_id=new.unidade_id
       and origem_tipo='procedimento_assistencial' and origem_id=new.id
       and tipo_evento in ('procedimento','sessao_tea_aba');
  end if;
  return new;
end $$;
revoke execute on function public.capturar_producao_procedimento() from public,anon,authenticated;

drop trigger if exists trg_capturar_producao_procedimento on public.procedimentos_assistenciais;
create trigger trg_capturar_producao_procedimento
after insert or update of status,quantidade,codigo_tuss,codigo_interno,procedimento,executado_em
on public.procedimentos_assistenciais
for each row execute function public.capturar_producao_procedimento();

create or replace function public.sincronizar_producao_atendimento_internal(p_atendimento_id uuid)
returns jsonb
language plpgsql security definer
set search_path=public,pg_catalog,extensions
as $$
declare
  v_at public.atendimentos%rowtype;
  v_tipo text;
  v_codigo text;
  v_item uuid;
  v_class jsonb;
  v_count_consulta integer := 0;
  v_count_avaliacoes integer := 0;
  v_count_procedimentos integer := 0;
  v_count_tea integer := 0;
  v_count_exames integer := 0;
  v_count_diarias integer := 0;
  r record;
begin
  select * into v_at from public.atendimentos where id=p_atendimento_id;
  if not found then raise exception 'PRODUCAO_ATENDIMENTO_NAO_LOCALIZADO'; end if;

  v_tipo := null;
  v_codigo := null;
  if v_at.agendamento_id is not null or lower(coalesce(v_at.origem,'')) in ('agenda','agendamento','checkin','check-in') then
    v_tipo := 'consulta_ambulatorial'; v_codigo := '10101012';
  elsif lower(coalesce(v_at.origem,'')) in ('demanda_espontanea','totem','recepcao','pronto_socorro','pronto atendimento','pronto_atendimento','urgencia','emergencia') then
    v_tipo := 'consulta_pronto_atendimento'; v_codigo := '10101039';
  end if;

  if v_tipo is not null and v_at.status='alta' then
    select i.id into v_item from public.itens_assistenciais i
     where i.empresa_id=v_at.empresa_id and i.ativo and i.codigo_tuss=v_codigo order by i.created_at limit 1;
    perform public.registrar_evento_producao_assistencial_internal(
      v_at.id,v_tipo,'atendimento_medico',v_at.id,coalesce(v_at.data_fechamento,now()),1,
      'procedimentos',v_at.profissional_id,'consultorio',null,v_item,v_codigo,true,
      jsonb_build_object('origem_atendimento',v_at.origem,'tipo_atendimento_original',v_at.tipo_atendimento,'regra','fallback_tuss_sem_pacote')
    );
    v_count_consulta := 1;
  end if;

  for r in select e.* from public.encaminhamentos_assistenciais e
    where e.atendimento_id=v_at.id and e.empresa_id=v_at.empresa_id and e.unidade_id=v_at.unidade_id
      and e.status='concluido' and e.concluido_em is not null and e.tipo_solicitacao in ('avaliacao_medica','interconsulta')
  loop
    select i.id into v_item from public.itens_assistenciais i where i.empresa_id=v_at.empresa_id and i.ativo and i.codigo_tuss='10102019' order by i.created_at limit 1;
    perform public.registrar_evento_producao_assistencial_internal(
      v_at.id,'visita_medica','encaminhamento_assistencial',r.id,r.concluido_em,1,
      'honorarios',r.profissional_id,coalesce(r.especialidade,'internacao'),null,v_item,'10102019',true,
      jsonb_build_object('especialidade',r.especialidade,'tipo_solicitacao',r.tipo_solicitacao,'regra','fallback_tuss_sem_pacote')
    );
    v_count_avaliacoes := v_count_avaliacoes+1;
  end loop;

  for r in select p.* from public.procedimentos_assistenciais p
    where p.atendimento_id=v_at.id and p.empresa_id=v_at.empresa_id and p.unidade_id=v_at.unidade_id and p.status='realizado'
  loop
    v_class := public.classificar_procedimento_producao_internal(r.id);
    v_tipo := coalesce(v_class->>'tipo_evento','procedimento');
    v_item := nullif(v_class->>'item_assistencial_id','')::uuid;
    perform public.registrar_evento_producao_assistencial_internal(
      v_at.id,v_tipo,'procedimento_assistencial',r.id,r.executado_em,r.quantidade,
      'procedimentos',r.profissional_id,r.area,null,v_item,nullif(v_class->>'codigo_tuss_fallback',''),true,
      jsonb_build_object('procedimento',r.procedimento,'codigo_interno',r.codigo_interno,
        'classificacao_producao',v_class->>'marcador','duracao_minutos',r.duracao_minutos)
    );
    update public.producao_assistencial_eventos
       set status='estornado',cobravel=false,consolidado_em=null,updated_at=now(),updated_by=auth.uid(),
           metadados=metadados||jsonb_build_object('motivo_estorno','reclassificacao_producao','tipo_evento_ativo',v_tipo)
     where empresa_id=r.empresa_id and unidade_id=r.unidade_id
       and origem_tipo='procedimento_assistencial' and origem_id=r.id
       and tipo_evento in ('procedimento','sessao_tea_aba') and tipo_evento<>v_tipo
       and status not in ('cancelado','estornado');
    if v_tipo='sessao_tea_aba' then v_count_tea:=v_count_tea+1; else v_count_procedimentos:=v_count_procedimentos+1; end if;
  end loop;

  for r in select s.* from public.solicitacoes_exames s
    where s.atendimento_id=v_at.id and s.empresa_id=v_at.empresa_id and s.unidade_id=v_at.unidade_id and s.status='liberado'
  loop
    select i.id into v_item from public.itens_assistenciais i
     where i.empresa_id=v_at.empresa_id and i.ativo and r.codigo_tuss is not null and i.codigo_tuss=r.codigo_tuss order by i.created_at limit 1;
    perform public.registrar_evento_producao_assistencial_internal(
      v_at.id,case when r.modalidade='laboratorio' then 'laboratorio' when r.modalidade='imagem' then 'imagem' else 'exame' end,
      'solicitacao_exame',r.id,coalesce(r.resultado_em,r.updated_at),1,'exames',r.profissional_id,
      r.modalidade,null,v_item,r.codigo_tuss,true,jsonb_build_object('exame',r.exame,'modalidade',r.modalidade)
    );
    v_count_exames:=v_count_exames+1;
  end loop;

  for r in select d.* from public.internacao_diarias d
    where d.atendimento_id=v_at.id and d.empresa_id=v_at.empresa_id and d.unidade_id=v_at.unidade_id
      and lower(coalesce(d.status,''))<>'cancelada'
  loop
    perform public.registrar_evento_producao_assistencial_internal(
      v_at.id,'diaria','internacao_diaria',r.id,r.data_referencia::timestamptz,1,'diarias',null,
      r.setor,r.internacao_id,null,null,true,
      jsonb_build_object('data_referencia',r.data_referencia,'acomodacao',r.acomodacao,'setor',r.setor,'status_origem',r.status,'codigo','resolver_pelo_contrato')
    );
    v_count_diarias:=v_count_diarias+1;
  end loop;

  perform public.sincronizar_producao_consumos_internal(v_at.id);

  return jsonb_build_object(
    'atendimento_id',v_at.id,'consulta',v_count_consulta,'avaliacoes_medicas',v_count_avaliacoes,
    'procedimentos',v_count_procedimentos,'sessoes_tea_aba',v_count_tea,'exames',v_count_exames,'diarias',v_count_diarias
  );
end $$;
revoke execute on function public.sincronizar_producao_atendimento_internal(uuid) from public,anon,authenticated;
