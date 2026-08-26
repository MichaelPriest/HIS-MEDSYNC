-- Livro de Produção Assistencial
-- O fato clínico é armazenado separado da resolução contratual/TISS.

create table if not exists public.producao_assistencial_eventos (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  atendimento_id uuid not null references public.atendimentos(id),
  paciente_id uuid not null references public.pacientes(id),
  internacao_id uuid null references public.internacoes(id),
  profissional_id uuid null references public.profissionais(id),
  setor text null,
  tipo_evento text not null,
  origem_tipo text not null,
  origem_id uuid not null,
  ocorrido_em timestamptz not null default now(),
  quantidade numeric(14,4) not null default 1 check (quantidade > 0),
  categoria_contratual text not null default 'procedimentos',
  item_assistencial_id uuid null references public.itens_assistenciais(id),
  codigo_tuss_fallback text null,
  cobravel boolean not null default true,
  status text not null default 'registrado' check (status in ('registrado','consolidado','cancelado','estornado')),
  metadados jsonb not null default '{}'::jsonb,
  consolidado_em timestamptz null,
  created_at timestamptz not null default now(),
  created_by uuid null,
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  constraint producao_evento_tipo_check check (tipo_evento in (
    'consulta_ambulatorial','consulta_pronto_atendimento','visita_medica','procedimento',
    'laboratorio','imagem','exame','sessao_tea_aba','diaria','taxa','medicamento',
    'material','opme','gas_medicinal','honorario','outro'
  )),
  constraint producao_evento_categoria_check check (categoria_contratual in (
    'procedimentos','exames','honorarios','diarias','taxas','medicamentos','materiais',
    'opme','gases','pacotes','outros'
  )),
  constraint producao_evento_origem_unica unique (empresa_id,unidade_id,origem_tipo,origem_id,tipo_evento)
);

create index if not exists idx_producao_eventos_atendimento
  on public.producao_assistencial_eventos(atendimento_id, ocorrido_em desc);
create index if not exists idx_producao_eventos_internacao
  on public.producao_assistencial_eventos(internacao_id, ocorrido_em desc)
  where internacao_id is not null;
create index if not exists idx_producao_eventos_status
  on public.producao_assistencial_eventos(empresa_id, unidade_id, status, ocorrido_em desc);

create table if not exists public.atendimento_pacotes_contratados (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  atendimento_id uuid not null references public.atendimentos(id),
  contrato_id uuid not null references public.credenciamento_contratos(id),
  pacote_id uuid not null references public.contrato_pacotes(id),
  status text not null default 'ativo' check (status in ('ativo','encerrado','cancelado')),
  origem_tipo text null,
  origem_id uuid null,
  aplicado_em timestamptz not null default now(),
  encerrado_em timestamptz null,
  observacoes text null,
  created_at timestamptz not null default now(),
  created_by uuid null,
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

create index if not exists idx_atendimento_pacotes_escopo
  on public.atendimento_pacotes_contratados(empresa_id,unidade_id,atendimento_id,status);
create unique index if not exists uq_atendimento_pacote_ativo
  on public.atendimento_pacotes_contratados(atendimento_id,pacote_id)
  where status='ativo';

alter table public.conta_faturamento_itens
  add column if not exists memoria_calculo jsonb not null default '{}'::jsonb,
  add column if not exists pacote_id uuid null,
  add column if not exists producao_evento_id uuid null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='conta_item_pacote_fk') then
    alter table public.conta_faturamento_itens
      add constraint conta_item_pacote_fk foreign key (pacote_id) references public.contrato_pacotes(id);
  end if;
  if not exists (select 1 from pg_constraint where conname='conta_faturamento_itens_producao_evento_id_fkey') then
    alter table public.conta_faturamento_itens
      add constraint conta_faturamento_itens_producao_evento_id_fkey
      foreign key (producao_evento_id) references public.producao_assistencial_eventos(id);
  end if;
end $$;

create index if not exists idx_conta_itens_producao_evento
  on public.conta_faturamento_itens(producao_evento_id)
  where producao_evento_id is not null;

alter table public.producao_assistencial_eventos enable row level security;
alter table public.atendimento_pacotes_contratados enable row level security;

drop policy if exists producao_eventos_select_escopo on public.producao_assistencial_eventos;
create policy producao_eventos_select_escopo on public.producao_assistencial_eventos
for select to authenticated using (public.tem_unidade(empresa_id,unidade_id));

drop policy if exists atendimento_pacotes_select_escopo on public.atendimento_pacotes_contratados;
create policy atendimento_pacotes_select_escopo on public.atendimento_pacotes_contratados
for select to authenticated using (public.tem_unidade(empresa_id,unidade_id));

create or replace function public.registrar_evento_producao_assistencial_internal(
  p_atendimento_id uuid,
  p_tipo_evento text,
  p_origem_tipo text,
  p_origem_id uuid,
  p_ocorrido_em timestamptz default now(),
  p_quantidade numeric default 1,
  p_categoria_contratual text default 'procedimentos',
  p_profissional_id uuid default null,
  p_setor text default null,
  p_internacao_id uuid default null,
  p_item_assistencial_id uuid default null,
  p_codigo_tuss_fallback text default null,
  p_cobravel boolean default true,
  p_metadados jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer
set search_path=public,pg_catalog,extensions
as $$
declare v_at public.atendimentos%rowtype; v_id uuid;
begin
  select * into v_at from public.atendimentos where id=p_atendimento_id;
  if not found then raise exception 'PRODUCAO_ATENDIMENTO_NAO_LOCALIZADO'; end if;
  if p_origem_id is null then raise exception 'PRODUCAO_ORIGEM_OBRIGATORIA'; end if;

  insert into public.producao_assistencial_eventos(
    empresa_id,unidade_id,atendimento_id,paciente_id,internacao_id,profissional_id,setor,
    tipo_evento,origem_tipo,origem_id,ocorrido_em,quantidade,categoria_contratual,
    item_assistencial_id,codigo_tuss_fallback,cobravel,status,metadados,created_by,updated_by
  ) values (
    v_at.empresa_id,v_at.unidade_id,v_at.id,v_at.paciente_id,p_internacao_id,p_profissional_id,
    nullif(trim(coalesce(p_setor,'')),''),p_tipo_evento,p_origem_tipo,p_origem_id,
    coalesce(p_ocorrido_em,now()),greatest(coalesce(p_quantidade,1),0.0001),p_categoria_contratual,
    p_item_assistencial_id,nullif(trim(coalesce(p_codigo_tuss_fallback,'')),''),coalesce(p_cobravel,true),
    'registrado',coalesce(p_metadados,'{}'::jsonb),auth.uid(),auth.uid()
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
    metadados=public.producao_assistencial_eventos.metadados||excluded.metadados,
    updated_at=now(),updated_by=auth.uid()
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.registrar_evento_producao_assistencial_internal(uuid,text,text,uuid,timestamptz,numeric,text,uuid,text,uuid,uuid,text,boolean,jsonb) from public,anon,authenticated;

create or replace function public.sincronizar_producao_atendimento_internal(p_atendimento_id uuid)
returns jsonb
language plpgsql security definer
set search_path=public,pg_catalog,extensions
as $$
declare
  v_at public.atendimentos%rowtype; v_tipo text; v_codigo text; v_item uuid;
  v_count_consulta integer:=0; v_count_avaliacoes integer:=0; v_count_procedimentos integer:=0;
  v_count_exames integer:=0; v_count_diarias integer:=0; r record;
begin
  select * into v_at from public.atendimentos where id=p_atendimento_id;
  if not found then raise exception 'PRODUCAO_ATENDIMENTO_NAO_LOCALIZADO'; end if;

  if v_at.agendamento_id is not null or lower(coalesce(v_at.origem,'')) in ('agenda','agendamento','checkin','check-in') then
    v_tipo:='consulta_ambulatorial'; v_codigo:='10101012';
  elsif lower(coalesce(v_at.origem,'')) in ('demanda_espontanea','totem','recepcao','pronto_socorro','pronto atendimento','pronto_atendimento','urgencia','emergencia') then
    v_tipo:='consulta_pronto_atendimento'; v_codigo:='10101039';
  end if;

  if v_tipo is not null and v_at.status='alta' then
    select i.id into v_item from public.itens_assistenciais i where i.empresa_id=v_at.empresa_id and i.ativo and i.codigo_tuss=v_codigo order by i.created_at limit 1;
    perform public.registrar_evento_producao_assistencial_internal(v_at.id,v_tipo,'atendimento_medico',v_at.id,coalesce(v_at.data_fechamento,now()),1,'procedimentos',v_at.profissional_id,'consultorio',null,v_item,v_codigo,true,jsonb_build_object('origem_atendimento',v_at.origem,'tipo_atendimento_original',v_at.tipo_atendimento,'regra','fallback_tuss_sem_pacote'));
    v_count_consulta:=1;
  end if;

  for r in select e.* from public.encaminhamentos_assistenciais e where e.atendimento_id=v_at.id and e.empresa_id=v_at.empresa_id and e.unidade_id=v_at.unidade_id and e.status='concluido' and e.concluido_em is not null and e.tipo_solicitacao in ('avaliacao_medica','interconsulta') loop
    select i.id into v_item from public.itens_assistenciais i where i.empresa_id=v_at.empresa_id and i.ativo and i.codigo_tuss='10102019' order by i.created_at limit 1;
    perform public.registrar_evento_producao_assistencial_internal(v_at.id,'visita_medica','encaminhamento_assistencial',r.id,r.concluido_em,1,'honorarios',r.profissional_id,coalesce(r.especialidade,'internacao'),null,v_item,'10102019',true,jsonb_build_object('especialidade',r.especialidade,'tipo_solicitacao',r.tipo_solicitacao,'regra','fallback_tuss_sem_pacote'));
    v_count_avaliacoes:=v_count_avaliacoes+1;
  end loop;

  for r in select p.* from public.procedimentos_assistenciais p where p.atendimento_id=v_at.id and p.empresa_id=v_at.empresa_id and p.unidade_id=v_at.unidade_id and p.status='realizado' loop
    select i.id into v_item from public.itens_assistenciais i where i.empresa_id=v_at.empresa_id and i.ativo and ((r.codigo_tuss is not null and i.codigo_tuss=r.codigo_tuss) or (r.codigo_interno is not null and i.codigo_interno=r.codigo_interno)) order by case when r.codigo_tuss is not null and i.codigo_tuss=r.codigo_tuss then 0 else 1 end,i.created_at limit 1;
    perform public.registrar_evento_producao_assistencial_internal(v_at.id,'procedimento','procedimento_assistencial',r.id,r.executado_em,r.quantidade,'procedimentos',r.profissional_id,r.area,null,v_item,r.codigo_tuss,true,jsonb_build_object('procedimento',r.procedimento,'codigo_interno',r.codigo_interno));
    v_count_procedimentos:=v_count_procedimentos+1;
  end loop;

  for r in select s.* from public.solicitacoes_exames s where s.atendimento_id=v_at.id and s.empresa_id=v_at.empresa_id and s.unidade_id=v_at.unidade_id and s.status='liberado' loop
    select i.id into v_item from public.itens_assistenciais i where i.empresa_id=v_at.empresa_id and i.ativo and r.codigo_tuss is not null and i.codigo_tuss=r.codigo_tuss order by i.created_at limit 1;
    perform public.registrar_evento_producao_assistencial_internal(v_at.id,case when r.modalidade='laboratorio' then 'laboratorio' when r.modalidade='imagem' then 'imagem' else 'exame' end,'solicitacao_exame',r.id,coalesce(r.resultado_em,r.updated_at),1,'exames',r.profissional_id,r.modalidade,null,v_item,r.codigo_tuss,true,jsonb_build_object('exame',r.exame,'modalidade',r.modalidade));
    v_count_exames:=v_count_exames+1;
  end loop;

  for r in select d.* from public.internacao_diarias d where d.atendimento_id=v_at.id and d.empresa_id=v_at.empresa_id and d.unidade_id=v_at.unidade_id and lower(coalesce(d.status,''))<>'cancelada' loop
    perform public.registrar_evento_producao_assistencial_internal(v_at.id,'diaria','internacao_diaria',r.id,r.data_referencia::timestamptz,1,'diarias',null,r.setor,r.internacao_id,null,null,true,jsonb_build_object('data_referencia',r.data_referencia,'acomodacao',r.acomodacao,'setor',r.setor,'status_origem',r.status,'codigo','resolver_pelo_contrato'));
    v_count_diarias:=v_count_diarias+1;
  end loop;

  return jsonb_build_object('atendimento_id',v_at.id,'consulta',v_count_consulta,'avaliacoes_medicas',v_count_avaliacoes,'procedimentos',v_count_procedimentos,'exames',v_count_exames,'diarias',v_count_diarias);
end $$;
revoke execute on function public.sincronizar_producao_atendimento_internal(uuid) from public,anon,authenticated;

create or replace function public.capturar_producao_avaliacao_medica()
returns trigger language plpgsql security definer set search_path=public,pg_catalog,extensions
as $$
declare v_item uuid;
begin
  if new.status='concluido' and new.concluido_em is not null and new.tipo_solicitacao in ('avaliacao_medica','interconsulta') and (tg_op='INSERT' or old.status is distinct from new.status or old.concluido_em is distinct from new.concluido_em) then
    select i.id into v_item from public.itens_assistenciais i where i.empresa_id=new.empresa_id and i.ativo and i.codigo_tuss='10102019' order by i.created_at limit 1;
    perform public.registrar_evento_producao_assistencial_internal(new.atendimento_id,'visita_medica','encaminhamento_assistencial',new.id,new.concluido_em,1,'honorarios',new.profissional_id,coalesce(new.especialidade,'internacao'),null,v_item,'10102019',true,jsonb_build_object('especialidade',new.especialidade,'tipo_solicitacao',new.tipo_solicitacao,'regra','fallback_tuss_sem_pacote'));
  end if;
  return new;
end $$;
revoke execute on function public.capturar_producao_avaliacao_medica() from public,anon,authenticated;
drop trigger if exists trg_capturar_producao_avaliacao_medica on public.encaminhamentos_assistenciais;
create trigger trg_capturar_producao_avaliacao_medica after insert or update of status,concluido_em on public.encaminhamentos_assistenciais for each row execute function public.capturar_producao_avaliacao_medica();

create or replace function public.capturar_producao_internacao_diaria()
returns trigger language plpgsql security definer set search_path=public,pg_catalog,extensions
as $$
begin
  if lower(coalesce(new.status,''))<>'cancelada' then
    perform public.registrar_evento_producao_assistencial_internal(new.atendimento_id,'diaria','internacao_diaria',new.id,new.data_referencia::timestamptz,1,'diarias',null,new.setor,new.internacao_id,null,null,true,jsonb_build_object('data_referencia',new.data_referencia,'acomodacao',new.acomodacao,'setor',new.setor,'status_origem',new.status,'codigo','resolver_pelo_contrato'));
  else
    update public.producao_assistencial_eventos set status='cancelado',cobravel=false,updated_at=now(),updated_by=auth.uid() where empresa_id=new.empresa_id and unidade_id=new.unidade_id and origem_tipo='internacao_diaria' and origem_id=new.id and tipo_evento='diaria';
  end if;
  return new;
end $$;
revoke execute on function public.capturar_producao_internacao_diaria() from public,anon,authenticated;
drop trigger if exists trg_capturar_producao_internacao_diaria on public.internacao_diarias;
create trigger trg_capturar_producao_internacao_diaria after insert or update of status,acomodacao,setor on public.internacao_diarias for each row execute function public.capturar_producao_internacao_diaria();
