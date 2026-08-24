create table if not exists public.leito_reservas (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id),
  leito_id uuid not null references public.leitos(id), atendimento_id uuid not null references public.atendimentos(id), paciente_id uuid references public.pacientes(id),
  reservado_em timestamptz not null default now(), reservado_ate timestamptz, status text not null default 'ativa' check (status in ('ativa','utilizada','cancelada','expirada')),
  motivo_cancelamento text, observacoes text, created_at timestamptz not null default now(), created_by uuid, updated_at timestamptz not null default now(), updated_by uuid,
  unique (id, empresa_id, unidade_id)
);
create unique index if not exists leito_reservas_leito_ativo_uidx on public.leito_reservas(leito_id) where status='ativa';
create index if not exists leito_reservas_atendimento_idx on public.leito_reservas(atendimento_id,status);
create index if not exists leito_reservas_unidade_idx on public.leito_reservas(unidade_id,status,reservado_ate);

create table if not exists public.leito_bloqueios (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), leito_id uuid not null references public.leitos(id),
  tipo text not null default 'operacional', motivo text not null, inicio_em timestamptz not null default now(), previsto_ate timestamptz, fim_em timestamptz,
  status text not null default 'ativo' check (status in ('ativo','encerrado','cancelado')), observacoes text,
  created_at timestamptz not null default now(), created_by uuid, updated_at timestamptz not null default now(), updated_by uuid
);
create unique index if not exists leito_bloqueios_leito_ativo_uidx on public.leito_bloqueios(leito_id) where status='ativo';
create index if not exists leito_bloqueios_unidade_idx on public.leito_bloqueios(unidade_id,status);

create table if not exists public.leito_higienizacoes (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id), leito_id uuid not null references public.leitos(id),
  internacao_id uuid references public.internacoes(id), atendimento_id uuid references public.atendimentos(id), status text not null default 'pendente' check (status in ('pendente','em_andamento','concluida','cancelada')),
  solicitada_em timestamptz not null default now(), iniciada_em timestamptz, concluida_em timestamptz, solicitada_por uuid, iniciada_por uuid, concluida_por uuid, observacoes text,
  created_at timestamptz not null default now(), created_by uuid, updated_at timestamptz not null default now(), updated_by uuid
);
create unique index if not exists leito_higienizacoes_aberta_uidx on public.leito_higienizacoes(leito_id) where status in ('pendente','em_andamento');
create index if not exists leito_higienizacoes_unidade_idx on public.leito_higienizacoes(unidade_id,status,solicitada_em);

create table if not exists public.alta_pendencias (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id),
  internacao_id uuid not null references public.internacoes(id), atendimento_id uuid not null references public.atendimentos(id), codigo text not null, descricao text not null,
  categoria text not null default 'assistencial', bloqueia_alta boolean not null default true, origem text not null default 'manual' check (origem in ('manual','sistema')),
  status text not null default 'pendente' check (status in ('pendente','resolvida','dispensada')), detalhes jsonb not null default '{}'::jsonb,
  resolvida_em timestamptz, resolvida_por uuid, justificativa text, created_at timestamptz not null default now(), created_by uuid, updated_at timestamptz not null default now(), updated_by uuid,
  unique(internacao_id,codigo)
);
create index if not exists alta_pendencias_unidade_idx on public.alta_pendencias(unidade_id,status,bloqueia_alta);
create index if not exists alta_pendencias_atendimento_idx on public.alta_pendencias(atendimento_id,status);

alter table public.leito_reservas enable row level security;
alter table public.leito_bloqueios enable row level security;
alter table public.leito_higienizacoes enable row level security;
alter table public.alta_pendencias enable row level security;
revoke all on public.leito_reservas, public.leito_bloqueios, public.leito_higienizacoes, public.alta_pendencias from anon;
grant select,insert,update,delete on public.leito_reservas, public.leito_bloqueios, public.leito_higienizacoes, public.alta_pendencias to authenticated;

drop policy if exists leito_reservas_select on public.leito_reservas;
create policy leito_reservas_select on public.leito_reservas for select to authenticated using (public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'internacao.visualizar') or public.tem_permissao(empresa_id,unidade_id,'leitos.gerenciar')));
drop policy if exists leito_reservas_write on public.leito_reservas;
create policy leito_reservas_write on public.leito_reservas for all to authenticated using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'leitos.gerenciar')) with check (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'leitos.gerenciar'));
drop policy if exists leito_bloqueios_select on public.leito_bloqueios;
create policy leito_bloqueios_select on public.leito_bloqueios for select to authenticated using (public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'internacao.visualizar') or public.tem_permissao(empresa_id,unidade_id,'leitos.gerenciar')));
drop policy if exists leito_bloqueios_write on public.leito_bloqueios;
create policy leito_bloqueios_write on public.leito_bloqueios for all to authenticated using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'leitos.gerenciar')) with check (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'leitos.gerenciar'));
drop policy if exists leito_higienizacoes_select on public.leito_higienizacoes;
create policy leito_higienizacoes_select on public.leito_higienizacoes for select to authenticated using (public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'internacao.visualizar') or public.tem_permissao(empresa_id,unidade_id,'leitos.gerenciar')));
drop policy if exists leito_higienizacoes_write on public.leito_higienizacoes;
create policy leito_higienizacoes_write on public.leito_higienizacoes for all to authenticated using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'leitos.gerenciar')) with check (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'leitos.gerenciar'));
drop policy if exists alta_pendencias_select on public.alta_pendencias;
create policy alta_pendencias_select on public.alta_pendencias for select to authenticated using (public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'internacao.visualizar') or public.tem_permissao(empresa_id,unidade_id,'alta.planejar') or public.tem_permissao(empresa_id,unidade_id,'alta.sumario') or public.tem_permissao(empresa_id,unidade_id,'leitos.gerenciar')));
drop policy if exists alta_pendencias_write on public.alta_pendencias;
create policy alta_pendencias_write on public.alta_pendencias for all to authenticated using (public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'alta.planejar') or public.tem_permissao(empresa_id,unidade_id,'alta.sumario') or public.tem_permissao(empresa_id,unidade_id,'leitos.gerenciar'))) with check (public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'alta.planejar') or public.tem_permissao(empresa_id,unidade_id,'alta.sumario') or public.tem_permissao(empresa_id,unidade_id,'leitos.gerenciar')));

create or replace function public.sincronizar_pendencias_alta(p_internacao_id uuid)
returns integer language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_i public.internacoes%rowtype; v_abertas integer;
begin
 select * into v_i from public.internacoes where id=p_internacao_id;
 if not found then raise exception 'ALTA_INTERNACAO_NAO_LOCALIZADA'; end if;
 if not (public.tem_permissao(v_i.empresa_id,v_i.unidade_id,'alta.planejar') or public.tem_permissao(v_i.empresa_id,v_i.unidade_id,'alta.sumario') or public.tem_permissao(v_i.empresa_id,v_i.unidade_id,'leitos.gerenciar') or public.tem_permissao(v_i.empresa_id,v_i.unidade_id,'internacao.gerenciar')) then raise exception 'ALTA_SEM_PERMISSAO' using errcode='42501'; end if;
 insert into public.alta_pendencias(empresa_id,unidade_id,internacao_id,atendimento_id,codigo,descricao,categoria,bloqueia_alta,origem,status,detalhes,created_by,updated_by)
 values(v_i.empresa_id,v_i.unidade_id,v_i.id,v_i.atendimento_id,'PLANO_ALTA_CONCLUIDO','Planejamento multiprofissional de alta concluído','transicao',true,'sistema',case when exists(select 1 from public.planejamentos_alta p where p.atendimento_id=v_i.atendimento_id and p.status in ('concluido','pronto','finalizado')) then 'resolvida' else 'pendente' end,'{}'::jsonb,auth.uid(),auth.uid())
 on conflict(internacao_id,codigo) do update set status=excluded.status,descricao=excluded.descricao,detalhes=excluded.detalhes,resolvida_em=case when excluded.status='resolvida' then coalesce(public.alta_pendencias.resolvida_em,now()) else null end,resolvida_por=case when excluded.status='resolvida' then coalesce(public.alta_pendencias.resolvida_por,auth.uid()) else null end,updated_at=now(),updated_by=auth.uid();
 insert into public.alta_pendencias(empresa_id,unidade_id,internacao_id,atendimento_id,codigo,descricao,categoria,bloqueia_alta,origem,status,detalhes,created_by,updated_by)
 values(v_i.empresa_id,v_i.unidade_id,v_i.id,v_i.atendimento_id,'CONCILIACAO_MEDICAMENTOSA_ALTA','Conciliação medicamentosa registrada no momento da alta','medicamentos',true,'sistema',case when exists(select 1 from public.conciliacoes_medicamentosas c where c.atendimento_id=v_i.atendimento_id and c.momento='alta') then 'resolvida' else 'pendente' end,'{}'::jsonb,auth.uid(),auth.uid())
 on conflict(internacao_id,codigo) do update set status=excluded.status,descricao=excluded.descricao,detalhes=excluded.detalhes,resolvida_em=case when excluded.status='resolvida' then coalesce(public.alta_pendencias.resolvida_em,now()) else null end,resolvida_por=case when excluded.status='resolvida' then coalesce(public.alta_pendencias.resolvida_por,auth.uid()) else null end,updated_at=now(),updated_by=auth.uid();
 insert into public.alta_pendencias(empresa_id,unidade_id,internacao_id,atendimento_id,codigo,descricao,categoria,bloqueia_alta,origem,status,detalhes,created_by,updated_by)
 values(v_i.empresa_id,v_i.unidade_id,v_i.id,v_i.atendimento_id,'SUMARIO_ALTA_ASSINADO','Sumário de alta concluído e assinado','documentacao',true,'sistema',case when exists(select 1 from public.sumarios_alta s where s.atendimento_id=v_i.atendimento_id and s.assinado_em is not null and s.bloqueado) then 'resolvida' else 'pendente' end,'{}'::jsonb,auth.uid(),auth.uid())
 on conflict(internacao_id,codigo) do update set status=excluded.status,descricao=excluded.descricao,detalhes=excluded.detalhes,resolvida_em=case when excluded.status='resolvida' then coalesce(public.alta_pendencias.resolvida_em,now()) else null end,resolvida_por=case when excluded.status='resolvida' then coalesce(public.alta_pendencias.resolvida_por,auth.uid()) else null end,updated_at=now(),updated_by=auth.uid();
 select count(*) into v_abertas from public.alta_pendencias where internacao_id=v_i.id and bloqueia_alta and status='pendente'; return v_abertas;
end $$;

create or replace function public.reservar_leito(p_leito_id uuid,p_atendimento_id uuid,p_reservado_ate timestamptz default null,p_observacoes text default null)
returns uuid language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_l public.leitos%rowtype; v_a public.atendimentos%rowtype; v_id uuid;
begin
 select * into v_l from public.leitos where id=p_leito_id for update; if not found then raise exception 'LEITO_NAO_LOCALIZADO'; end if;
 if not public.tem_permissao(v_l.empresa_id,v_l.unidade_id,'leitos.gerenciar') then raise exception 'LEITO_SEM_PERMISSAO' using errcode='42501'; end if;
 update public.leito_reservas set status='expirada',updated_at=now(),updated_by=auth.uid() where leito_id=v_l.id and status='ativa' and reservado_ate is not null and reservado_ate<=now();
 if v_l.status='reservado' and not exists(select 1 from public.leito_reservas where leito_id=v_l.id and status='ativa') then update public.leitos set status='livre',updated_at=now(),updated_by=auth.uid() where id=v_l.id; select * into v_l from public.leitos where id=p_leito_id for update; end if;
 if not v_l.ativo or v_l.status<>'livre' then raise exception 'LEITO_INDISPONIVEL_PARA_RESERVA'; end if;
 if exists(select 1 from public.internacoes i where i.leito_id=v_l.id and i.status='internado') then raise exception 'LEITO_OCUPADO'; end if;
 select * into v_a from public.atendimentos where id=p_atendimento_id; if not found or v_a.empresa_id<>v_l.empresa_id or v_a.unidade_id<>v_l.unidade_id then raise exception 'ATENDIMENTO_FORA_ESCOPO'; end if;
 insert into public.leito_reservas(empresa_id,unidade_id,leito_id,atendimento_id,paciente_id,reservado_ate,observacoes,created_by,updated_by) values(v_l.empresa_id,v_l.unidade_id,v_l.id,v_a.id,v_a.paciente_id,coalesce(p_reservado_ate,now()+interval '2 hours'),p_observacoes,auth.uid(),auth.uid()) returning id into v_id;
 update public.leitos set status='reservado',updated_at=now(),updated_by=auth.uid() where id=v_l.id; return v_id;
end $$;

create or replace function public.cancelar_reserva_leito(p_reserva_id uuid,p_motivo text default null)
returns void language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_r public.leito_reservas%rowtype;
begin
 select * into v_r from public.leito_reservas where id=p_reserva_id for update; if not found then raise exception 'RESERVA_NAO_LOCALIZADA'; end if;
 if not public.tem_permissao(v_r.empresa_id,v_r.unidade_id,'leitos.gerenciar') then raise exception 'LEITO_SEM_PERMISSAO' using errcode='42501'; end if;
 if v_r.status<>'ativa' then return; end if; update public.leito_reservas set status='cancelada',motivo_cancelamento=p_motivo,updated_at=now(),updated_by=auth.uid() where id=v_r.id;
 if not exists(select 1 from public.internacoes i where i.leito_id=v_r.leito_id and i.status='internado') and not exists(select 1 from public.leito_bloqueios b where b.leito_id=v_r.leito_id and b.status='ativo') and not exists(select 1 from public.leito_higienizacoes h where h.leito_id=v_r.leito_id and h.status in ('pendente','em_andamento')) then update public.leitos set status='livre',updated_at=now(),updated_by=auth.uid() where id=v_r.leito_id; end if;
end $$;

create or replace function public.bloquear_leito(p_leito_id uuid,p_motivo text,p_tipo text default 'operacional',p_previsto_ate timestamptz default null)
returns uuid language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_l public.leitos%rowtype; v_id uuid;
begin
 select * into v_l from public.leitos where id=p_leito_id for update; if not found then raise exception 'LEITO_NAO_LOCALIZADO'; end if;
 if not public.tem_permissao(v_l.empresa_id,v_l.unidade_id,'leitos.gerenciar') then raise exception 'LEITO_SEM_PERMISSAO' using errcode='42501'; end if;
 if coalesce(trim(p_motivo),'')='' then raise exception 'MOTIVO_BLOQUEIO_OBRIGATORIO'; end if;
 if v_l.status in ('ocupado','higienizacao','reservado') or exists(select 1 from public.internacoes i where i.leito_id=v_l.id and i.status='internado') then raise exception 'LEITO_NAO_PODE_SER_BLOQUEADO'; end if;
 insert into public.leito_bloqueios(empresa_id,unidade_id,leito_id,tipo,motivo,previsto_ate,created_by,updated_by) values(v_l.empresa_id,v_l.unidade_id,v_l.id,coalesce(nullif(trim(p_tipo),''),'operacional'),p_motivo,p_previsto_ate,auth.uid(),auth.uid()) returning id into v_id;
 update public.leitos set status='bloqueado',updated_at=now(),updated_by=auth.uid() where id=v_l.id; return v_id;
end $$;

create or replace function public.desbloquear_leito(p_bloqueio_id uuid,p_observacoes text default null)
returns void language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_b public.leito_bloqueios%rowtype;
begin
 select * into v_b from public.leito_bloqueios where id=p_bloqueio_id for update; if not found then raise exception 'BLOQUEIO_NAO_LOCALIZADO'; end if;
 if not public.tem_permissao(v_b.empresa_id,v_b.unidade_id,'leitos.gerenciar') then raise exception 'LEITO_SEM_PERMISSAO' using errcode='42501'; end if;
 update public.leito_bloqueios set status='encerrado',fim_em=now(),observacoes=coalesce(p_observacoes,observacoes),updated_at=now(),updated_by=auth.uid() where id=v_b.id and status='ativo';
 if not exists(select 1 from public.internacoes i where i.leito_id=v_b.leito_id and i.status='internado') and not exists(select 1 from public.leito_reservas r where r.leito_id=v_b.leito_id and r.status='ativa') and not exists(select 1 from public.leito_higienizacoes h where h.leito_id=v_b.leito_id and h.status in ('pendente','em_andamento')) then update public.leitos set status='livre',updated_at=now(),updated_by=auth.uid() where id=v_b.leito_id; end if;
end $$;

create or replace function public.iniciar_higienizacao_leito(p_leito_id uuid,p_observacoes text default null)
returns uuid language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_l public.leitos%rowtype; v_h uuid;
begin
 select * into v_l from public.leitos where id=p_leito_id for update; if not found then raise exception 'LEITO_NAO_LOCALIZADO'; end if;
 if not public.tem_permissao(v_l.empresa_id,v_l.unidade_id,'leitos.gerenciar') then raise exception 'LEITO_SEM_PERMISSAO' using errcode='42501'; end if;
 if exists(select 1 from public.internacoes i where i.leito_id=v_l.id and i.status='internado') then raise exception 'LEITO_AINDA_OCUPADO'; end if;
 select id into v_h from public.leito_higienizacoes where leito_id=v_l.id and status in ('pendente','em_andamento') order by solicitada_em desc limit 1 for update;
 if v_h is null then insert into public.leito_higienizacoes(empresa_id,unidade_id,leito_id,status,solicitada_por,iniciada_em,iniciada_por,observacoes,created_by,updated_by) values(v_l.empresa_id,v_l.unidade_id,v_l.id,'em_andamento',auth.uid(),now(),auth.uid(),p_observacoes,auth.uid(),auth.uid()) returning id into v_h;
 else update public.leito_higienizacoes set status='em_andamento',iniciada_em=coalesce(iniciada_em,now()),iniciada_por=coalesce(iniciada_por,auth.uid()),observacoes=coalesce(p_observacoes,observacoes),updated_at=now(),updated_by=auth.uid() where id=v_h; end if;
 update public.leitos set status='higienizacao',updated_at=now(),updated_by=auth.uid() where id=v_l.id; return v_h;
end $$;

create or replace function public.concluir_higienizacao_leito(p_leito_id uuid,p_observacoes text default null)
returns void language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_l public.leitos%rowtype; v_h uuid;
begin
 select * into v_l from public.leitos where id=p_leito_id for update; if not found then raise exception 'LEITO_NAO_LOCALIZADO'; end if;
 if not public.tem_permissao(v_l.empresa_id,v_l.unidade_id,'leitos.gerenciar') then raise exception 'LEITO_SEM_PERMISSAO' using errcode='42501'; end if;
 if exists(select 1 from public.internacoes i where i.leito_id=v_l.id and i.status='internado') then raise exception 'LEITO_AINDA_OCUPADO'; end if;
 select id into v_h from public.leito_higienizacoes where leito_id=v_l.id and status in ('pendente','em_andamento') order by solicitada_em desc limit 1 for update;
 if v_h is not null then update public.leito_higienizacoes set status='concluida',iniciada_em=coalesce(iniciada_em,now()),iniciada_por=coalesce(iniciada_por,auth.uid()),concluida_em=now(),concluida_por=auth.uid(),observacoes=coalesce(p_observacoes,observacoes),updated_at=now(),updated_by=auth.uid() where id=v_h; end if;
 if exists(select 1 from public.leito_bloqueios b where b.leito_id=v_l.id and b.status='ativo') then update public.leitos set status='bloqueado',updated_at=now(),updated_by=auth.uid() where id=v_l.id;
 elsif exists(select 1 from public.leito_reservas r where r.leito_id=v_l.id and r.status='ativa') then update public.leitos set status='reservado',updated_at=now(),updated_by=auth.uid() where id=v_l.id;
 else update public.leitos set status='livre',updated_at=now(),updated_by=auth.uid() where id=v_l.id; end if;
end $$;

create or replace function public.liberar_leito_higienizado(p_leito_id uuid) returns void language plpgsql security definer set search_path='public','pg_catalog' as $$ begin perform public.concluir_higienizacao_leito(p_leito_id,null); end $$;

create or replace function public.movimentar_internacao_leito(p_internacao_id uuid,p_leito_destino_id uuid,p_motivo text default null)
returns uuid language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_i public.internacoes%rowtype; v_l public.leitos%rowtype; v_prof uuid; v_mov uuid; v_tipo text; v_reserva uuid;
begin
 select * into v_i from public.internacoes where id=p_internacao_id for update; if not found then raise exception 'LEITO_INTERNACAO_NAO_LOCALIZADA'; end if; if v_i.status<>'internado' then raise exception 'LEITO_INTERNACAO_NAO_ATIVA'; end if;
 if not public.tem_permissao(v_i.empresa_id,v_i.unidade_id,'leitos.gerenciar') then raise exception 'LEITO_SEM_PERMISSAO' using errcode='42501'; end if;
 select * into v_l from public.leitos where id=p_leito_destino_id for update; if not found then raise exception 'LEITO_DESTINO_NAO_LOCALIZADO'; end if; if v_l.empresa_id<>v_i.empresa_id or v_l.unidade_id<>v_i.unidade_id then raise exception 'LEITO_DESTINO_FORA_ESCOPO'; end if;
 if not v_l.ativo or v_l.status in ('ocupado','manutencao','bloqueado','higienizacao') then raise exception 'LEITO_DESTINO_INDISPONIVEL'; end if;
 if exists(select 1 from public.internacoes x where x.leito_id=p_leito_destino_id and x.status='internado' and x.id<>p_internacao_id) then raise exception 'LEITO_DESTINO_OCUPADO'; end if;
 if v_l.status='reservado' then select id into v_reserva from public.leito_reservas where leito_id=v_l.id and status='ativa' and atendimento_id=v_i.atendimento_id limit 1 for update; if v_reserva is null then raise exception 'LEITO_RESERVADO_PARA_OUTRO_ATENDIMENTO'; end if; end if;
 v_prof:=public.profissional_logado(v_i.empresa_id); v_tipo:=case when v_i.leito_id is null then 'admissao' else 'transferencia' end;
 if v_i.leito_id is not null and v_i.leito_id<>p_leito_destino_id then update public.leitos set status='higienizacao',updated_at=now(),updated_by=auth.uid() where id=v_i.leito_id;
   insert into public.leito_higienizacoes(empresa_id,unidade_id,leito_id,internacao_id,atendimento_id,status,solicitada_por,created_by,updated_by) values(v_i.empresa_id,v_i.unidade_id,v_i.leito_id,v_i.id,v_i.atendimento_id,'pendente',auth.uid(),auth.uid(),auth.uid()) on conflict do nothing; end if;
 update public.leitos set status='ocupado',updated_at=now(),updated_by=auth.uid() where id=v_l.id; if v_reserva is not null then update public.leito_reservas set status='utilizada',updated_at=now(),updated_by=auth.uid() where id=v_reserva; end if;
 update public.internacoes set leito_id=v_l.id,setor=v_l.setor,quarto=v_l.quarto,leito=v_l.codigo,acomodacao=coalesce(v_l.acomodacao,acomodacao),updated_at=now(),updated_by=auth.uid() where id=v_i.id;
 insert into public.movimentacoes_leitos(empresa_id,unidade_id,internacao_id,atendimento_id,leito_origem_id,leito_destino_id,tipo,motivo,movimentado_em,profissional_id,created_by) values(v_i.empresa_id,v_i.unidade_id,v_i.id,v_i.atendimento_id,v_i.leito_id,v_l.id,v_tipo,p_motivo,now(),v_prof,auth.uid()) returning id into v_mov; return v_mov;
end $$;

create or replace function public.dar_alta_internacao(p_internacao_id uuid,p_motivo text)
returns void language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_i public.internacoes%rowtype; v_prof uuid; v_abertas integer; v_lista text;
begin
 select * into v_i from public.internacoes where id=p_internacao_id for update; if not found then raise exception 'ALTA_INTERNACAO_NAO_LOCALIZADA'; end if; if v_i.status<>'internado' then raise exception 'ALTA_INTERNACAO_NAO_ATIVA'; end if;
 if not public.tem_permissao(v_i.empresa_id,v_i.unidade_id,'leitos.gerenciar') then raise exception 'ALTA_SEM_PERMISSAO' using errcode='42501'; end if; if coalesce(trim(p_motivo),'')='' then raise exception 'ALTA_MOTIVO_OBRIGATORIO'; end if;
 v_abertas:=public.sincronizar_pendencias_alta(v_i.id); if v_abertas>0 then select string_agg(descricao,'; ' order by descricao) into v_lista from public.alta_pendencias where internacao_id=v_i.id and bloqueia_alta and status='pendente'; raise exception 'ALTA_PENDENCIAS_BLOQUEANTES: %',coalesce(v_lista,'pendências não resolvidas'); end if;
 v_prof:=public.profissional_logado(v_i.empresa_id);
 if v_i.leito_id is not null then update public.leitos set status='higienizacao',updated_at=now(),updated_by=auth.uid() where id=v_i.leito_id;
  insert into public.leito_higienizacoes(empresa_id,unidade_id,leito_id,internacao_id,atendimento_id,status,solicitada_por,created_by,updated_by) values(v_i.empresa_id,v_i.unidade_id,v_i.leito_id,v_i.id,v_i.atendimento_id,'pendente',auth.uid(),auth.uid(),auth.uid()) on conflict do nothing;
  insert into public.movimentacoes_leitos(empresa_id,unidade_id,internacao_id,atendimento_id,leito_origem_id,leito_destino_id,tipo,motivo,movimentado_em,profissional_id,created_by) values(v_i.empresa_id,v_i.unidade_id,v_i.id,v_i.atendimento_id,v_i.leito_id,null,'alta',p_motivo,now(),v_prof,auth.uid()); end if;
 update public.internacoes set status='alta',data_alta=now(),motivo_alta=p_motivo,leito_id=null,updated_at=now(),updated_by=auth.uid() where id=v_i.id;
 update public.atendimentos set status='alta',data_fechamento=coalesce(data_fechamento,now()),setor_atual='alta',ultima_movimentacao_em=now(),updated_at=now(),updated_by=auth.uid() where id=v_i.atendimento_id;
end $$;

revoke all on function public.sincronizar_pendencias_alta(uuid) from public,anon;
revoke all on function public.reservar_leito(uuid,uuid,timestamptz,text) from public,anon;
revoke all on function public.cancelar_reserva_leito(uuid,text) from public,anon;
revoke all on function public.bloquear_leito(uuid,text,text,timestamptz) from public,anon;
revoke all on function public.desbloquear_leito(uuid,text) from public,anon;
revoke all on function public.iniciar_higienizacao_leito(uuid,text) from public,anon;
revoke all on function public.concluir_higienizacao_leito(uuid,text) from public,anon;
revoke all on function public.liberar_leito_higienizado(uuid) from public,anon;
revoke all on function public.movimentar_internacao_leito(uuid,uuid,text) from public,anon;
revoke all on function public.dar_alta_internacao(uuid,text) from public,anon;
grant execute on function public.sincronizar_pendencias_alta(uuid) to authenticated;
grant execute on function public.reservar_leito(uuid,uuid,timestamptz,text) to authenticated;
grant execute on function public.cancelar_reserva_leito(uuid,text) to authenticated;
grant execute on function public.bloquear_leito(uuid,text,text,timestamptz) to authenticated;
grant execute on function public.desbloquear_leito(uuid,text) to authenticated;
grant execute on function public.iniciar_higienizacao_leito(uuid,text) to authenticated;
grant execute on function public.concluir_higienizacao_leito(uuid,text) to authenticated;
grant execute on function public.liberar_leito_higienizado(uuid) to authenticated;
grant execute on function public.movimentar_internacao_leito(uuid,uuid,text) to authenticated;
grant execute on function public.dar_alta_internacao(uuid,text) to authenticated;
notify pgrst,'reload schema';
