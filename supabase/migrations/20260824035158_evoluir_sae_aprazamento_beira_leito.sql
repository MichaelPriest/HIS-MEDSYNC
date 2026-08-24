-- SAE avançada, aprazamento e checagem à beira leito
-- Aplicada no Supabase como 20260824035158_evoluir_sae_aprazamento_beira_leito

create table if not exists public.sae_terminologias (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
  sistema text not null check (sistema in ('NANDA-I','NOC','NIC','LOCAL')), tipo text not null check (tipo in ('diagnostico','resultado','intervencao')),
  versao text not null default 'local', codigo text not null, titulo text not null, descricao text, dominio text, classe text, fonte_referencia text,
  ativo boolean not null default true, created_at timestamptz not null default now(), created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id), unique (empresa_id,sistema,tipo,versao,codigo)
);

create table if not exists public.sae_planos_cuidado (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade, atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete restrict, avaliacao_id uuid references public.sae_avaliacoes(id) on delete set null,
  profissional_id uuid references public.profissionais(id) on delete set null, status text not null default 'ativo' check (status in ('rascunho','ativo','suspenso','concluido','cancelado')),
  objetivo_geral text, inicio_em timestamptz not null default now(), reavaliar_em timestamptz, concluido_em timestamptz, assinado_em timestamptz, assinatura_hash text,
  created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);

create table if not exists public.sae_planos_itens (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade, atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete restrict, plano_id uuid not null references public.sae_planos_cuidado(id) on delete cascade,
  diagnostico_id uuid references public.sae_diagnosticos(id) on delete set null, terminologia_id uuid references public.sae_terminologias(id) on delete set null,
  tipo text not null check (tipo in ('resultado','intervencao')), codigo text, descricao text not null, meta text, valor_inicial text, valor_alvo text, valor_atual text,
  frequencia text, horario_programado timestamptz, prazo_em timestamptz, responsavel_perfil text, status text not null default 'ativo' check (status in ('ativo','atingido','suspenso','cancelado')),
  observacoes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);

create table if not exists public.sae_passagens_plantao (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade, atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete restrict, profissional_id uuid references public.profissionais(id) on delete set null,
  turno text not null, resumo_clinico text, pendencias text, riscos text, dispositivos jsonb not null default '[]'::jsonb, medicamentos_criticos jsonb not null default '[]'::jsonb,
  isolamento text, dieta text, plano_proximo_turno text, recebido_por_profissional_id uuid references public.profissionais(id) on delete set null,
  recebido_em timestamptz, assinado_em timestamptz, assinatura_hash text, created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);

create table if not exists public.prescricao_aprazamentos (
  id uuid primary key default extensions.gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade, atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete restrict, prescricao_id uuid not null references public.prescricoes(id) on delete cascade,
  programado_em timestamptz not null, tolerancia_minutos integer not null default 30 check (tolerancia_minutos between 0 and 360),
  status text not null default 'pendente' check (status in ('pendente','administrado','recusado','omitido','cancelado')),
  administracao_id uuid references public.administracoes_medicamentos(id) on delete set null, checado_em timestamptz, justificativa text,
  created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
  unique (prescricao_id,programado_em)
);

alter table public.sae_diagnosticos add column if not exists terminologia_id uuid references public.sae_terminologias(id) on delete set null;
alter table public.sae_cuidados add column if not exists terminologia_id uuid references public.sae_terminologias(id) on delete set null;
alter table public.sae_cuidados add column if not exists resultado_esperado text;
alter table public.sae_cuidados add column if not exists meta text;
alter table public.sae_cuidados add column if not exists proxima_checagem_em timestamptz;
alter table public.sae_cuidados add column if not exists ultima_checagem_em timestamptz;
alter table public.estoque_produtos add column if not exists codigo_barras text;
alter table public.administracoes_medicamentos add column if not exists aprazamento_id uuid references public.prescricao_aprazamentos(id) on delete set null;

create unique index if not exists ux_estoque_produtos_empresa_codigo_barras on public.estoque_produtos(empresa_id,codigo_barras) where codigo_barras is not null and btrim(codigo_barras)<>'';
create index if not exists ix_sae_planos_atendimento_status on public.sae_planos_cuidado(atendimento_id,status,created_at desc);
create index if not exists ix_sae_planos_itens_plano_tipo on public.sae_planos_itens(plano_id,tipo,status);
create index if not exists ix_sae_passagem_atendimento on public.sae_passagens_plantao(atendimento_id,created_at desc);
create index if not exists ix_prescricao_aprazamentos_unidade_programado on public.prescricao_aprazamentos(unidade_id,status,programado_em);
create index if not exists ix_prescricao_aprazamentos_atendimento on public.prescricao_aprazamentos(atendimento_id,programado_em);

insert into public.permissoes(codigo,descricao,ativo) values
 ('sae.gerenciar_catalogo','Gerenciar terminologias e catálogos da SAE',true),('sae.plano_cuidados','Criar e manter plano de cuidados da SAE',true),
 ('sae.passagem_plantao','Registrar e receber passagem de plantão',true),('medicamentos.aprazar','Gerar e ajustar aprazamentos de medicamentos',true),
 ('medicamentos.checar_beira_leito','Realizar checagem de medicamento à beira leito',true)
on conflict(codigo) do update set descricao=excluded.descricao,ativo=true,updated_at=now();

insert into public.perfil_permissoes(perfil_id,permissao_id)
select pf.id,pm.id from public.perfis pf cross join public.permissoes pm
where pf.ativo and (lower(pf.nome)='administrador' or (lower(pf.nome)='enfermagem' and pm.codigo in ('sae.plano_cuidados','sae.passagem_plantao','medicamentos.aprazar','medicamentos.checar_beira_leito')))
and pm.codigo in ('sae.gerenciar_catalogo','sae.plano_cuidados','sae.passagem_plantao','medicamentos.aprazar','medicamentos.checar_beira_leito') on conflict do nothing;

alter table public.sae_terminologias enable row level security; alter table public.sae_planos_cuidado enable row level security;
alter table public.sae_planos_itens enable row level security; alter table public.sae_passagens_plantao enable row level security; alter table public.prescricao_aprazamentos enable row level security;
revoke all on table public.sae_terminologias,public.sae_planos_cuidado,public.sae_planos_itens,public.sae_passagens_plantao,public.prescricao_aprazamentos from anon,authenticated;
grant select,insert,update,delete on table public.sae_terminologias,public.sae_planos_cuidado,public.sae_planos_itens,public.sae_passagens_plantao to authenticated;
grant select,insert,update on table public.prescricao_aprazamentos to authenticated;

create policy sae_terminologias_select on public.sae_terminologias for select to authenticated using(public.tem_permissao(empresa_id,null,'sae.visualizar'));
create policy sae_terminologias_insert on public.sae_terminologias for insert to authenticated with check(public.tem_permissao(empresa_id,null,'sae.gerenciar_catalogo'));
create policy sae_terminologias_update on public.sae_terminologias for update to authenticated using(public.tem_permissao(empresa_id,null,'sae.gerenciar_catalogo')) with check(public.tem_permissao(empresa_id,null,'sae.gerenciar_catalogo'));
create policy sae_terminologias_delete on public.sae_terminologias for delete to authenticated using(public.tem_permissao(empresa_id,null,'sae.gerenciar_catalogo'));
create policy sae_planos_select on public.sae_planos_cuidado for select to authenticated using(public.tem_permissao(empresa_id,unidade_id,'sae.visualizar'));
create policy sae_planos_insert on public.sae_planos_cuidado for insert to authenticated with check(public.tem_permissao(empresa_id,unidade_id,'sae.plano_cuidados'));
create policy sae_planos_update on public.sae_planos_cuidado for update to authenticated using(public.tem_permissao(empresa_id,unidade_id,'sae.plano_cuidados')) with check(public.tem_permissao(empresa_id,unidade_id,'sae.plano_cuidados'));
create policy sae_planos_delete on public.sae_planos_cuidado for delete to authenticated using(public.tem_permissao(empresa_id,unidade_id,'sae.plano_cuidados'));
create policy sae_planos_itens_select on public.sae_planos_itens for select to authenticated using(public.tem_permissao(empresa_id,unidade_id,'sae.visualizar'));
create policy sae_planos_itens_insert on public.sae_planos_itens for insert to authenticated with check(public.tem_permissao(empresa_id,unidade_id,'sae.plano_cuidados'));
create policy sae_planos_itens_update on public.sae_planos_itens for update to authenticated using(public.tem_permissao(empresa_id,unidade_id,'sae.plano_cuidados')) with check(public.tem_permissao(empresa_id,unidade_id,'sae.plano_cuidados'));
create policy sae_planos_itens_delete on public.sae_planos_itens for delete to authenticated using(public.tem_permissao(empresa_id,unidade_id,'sae.plano_cuidados'));
create policy sae_passagem_select on public.sae_passagens_plantao for select to authenticated using(public.tem_permissao(empresa_id,unidade_id,'sae.visualizar'));
create policy sae_passagem_insert on public.sae_passagens_plantao for insert to authenticated with check(public.tem_permissao(empresa_id,unidade_id,'sae.passagem_plantao'));
create policy sae_passagem_update on public.sae_passagens_plantao for update to authenticated using(public.tem_permissao(empresa_id,unidade_id,'sae.passagem_plantao')) with check(public.tem_permissao(empresa_id,unidade_id,'sae.passagem_plantao'));
create policy sae_passagem_delete on public.sae_passagens_plantao for delete to authenticated using(public.tem_permissao(empresa_id,unidade_id,'sae.passagem_plantao'));
create policy prescricao_aprazamentos_select on public.prescricao_aprazamentos for select to authenticated using(public.tem_permissao(empresa_id,unidade_id,'prescricao.visualizar') or public.tem_permissao(empresa_id,unidade_id,'medicamentos.administrar'));
create policy prescricao_aprazamentos_insert on public.prescricao_aprazamentos for insert to authenticated with check(public.tem_permissao(empresa_id,unidade_id,'medicamentos.aprazar'));
create policy prescricao_aprazamentos_update on public.prescricao_aprazamentos for update to authenticated using(public.tem_permissao(empresa_id,unidade_id,'medicamentos.administrar') or public.tem_permissao(empresa_id,unidade_id,'medicamentos.aprazar')) with check(public.tem_permissao(empresa_id,unidade_id,'medicamentos.administrar') or public.tem_permissao(empresa_id,unidade_id,'medicamentos.aprazar'));

create or replace function public.gerar_aprazamentos_prescricao(p_prescricao_id uuid,p_horizonte_dias integer default 2) returns integer language plpgsql security invoker set search_path=public,pg_catalog as $$
declare v_p public.prescricoes%rowtype;v_at public.atendimentos%rowtype;v_inicio timestamptz;v_fim timestamptz;v_dia date;v_hora text;v_programado timestamptz;v_count integer:=0;v_json jsonb;
begin
 if p_horizonte_dias<1 or p_horizonte_dias>30 then raise exception 'HORIZONTE_INVALIDO';end if;
 select * into v_p from public.prescricoes where id=p_prescricao_id;if not found then raise exception 'PRESCRICAO_NAO_ENCONTRADA';end if;
 if v_p.assinado_em is null or v_p.status<>'ativa' then raise exception 'PRESCRICAO_NAO_ATIVA_ASSINADA';end if;
 if not(public.tem_permissao(v_p.empresa_id,v_p.unidade_id,'medicamentos.aprazar') or public.tem_permissao(v_p.empresa_id,v_p.unidade_id,'prescricao.assinar')) then raise exception 'SEM_PERMISSAO';end if;
 select * into v_at from public.atendimentos where id=v_p.atendimento_id;v_inicio:=greatest(coalesce(v_p.inicio_em,now()),now());v_fim:=least(coalesce(v_p.fim_em,now()+make_interval(days=>p_horizonte_dias)),now()+make_interval(days=>p_horizonte_dias));
 v_json:=case when jsonb_array_length(coalesce(v_p.aprazamento,'[]'::jsonb))>0 then v_p.aprazamento else coalesce(v_p.horarios,'[]'::jsonb) end;
 if jsonb_array_length(v_json)>0 then
  for v_dia in select generate_series((v_inicio at time zone 'America/Sao_Paulo')::date,(v_fim at time zone 'America/Sao_Paulo')::date,'1 day'::interval)::date loop
   for v_hora in select value from jsonb_array_elements_text(v_json) loop begin v_programado:=(v_dia+v_hora::time) at time zone 'America/Sao_Paulo';exception when others then continue;end;
    if v_programado between v_inicio and v_fim then insert into public.prescricao_aprazamentos(empresa_id,unidade_id,atendimento_id,paciente_id,prescricao_id,programado_em,created_by) values(v_p.empresa_id,v_p.unidade_id,v_p.atendimento_id,v_at.paciente_id,v_p.id,v_programado,auth.uid()) on conflict(prescricao_id,programado_em) do nothing;if found then v_count:=v_count+1;end if;end if;
   end loop;
  end loop;
 elsif v_p.intervalo_minutos is not null and v_p.intervalo_minutos>0 and not v_p.se_necessario then
  for v_programado in select generate_series(v_inicio,v_fim,make_interval(mins=>v_p.intervalo_minutos)) loop insert into public.prescricao_aprazamentos(empresa_id,unidade_id,atendimento_id,paciente_id,prescricao_id,programado_em,created_by) values(v_p.empresa_id,v_p.unidade_id,v_p.atendimento_id,v_at.paciente_id,v_p.id,v_programado,auth.uid()) on conflict(prescricao_id,programado_em) do nothing;if found then v_count:=v_count+1;end if;end loop;
 end if;return v_count;
end$$;

create or replace function public.registrar_administracao_beira_leito(p_aprazamento_id uuid,p_dispensacao_id uuid,p_codigo_paciente text,p_codigo_medicamento text,p_status text default 'administrado',p_justificativa text default null,p_dose text default null,p_via text default null,p_dupla_checagem boolean default false,p_segundo_profissional_id uuid default null) returns uuid language plpgsql security invoker set search_path=public,pg_catalog as $$
declare v_ap public.prescricao_aprazamentos%rowtype;v_p public.prescricoes%rowtype;v_pac public.pacientes%rowtype;v_disp public.dispensacoes_medicamentos%rowtype;v_prod public.estoque_produtos%rowtype;v_prof uuid;v_admin uuid;v_paciente_ok boolean:=false;v_medicamento_ok boolean:=false;v_codigo text:=btrim(coalesce(p_codigo_paciente,''));v_cod_med text:=btrim(coalesce(p_codigo_medicamento,''));v_atraso integer;
begin
 if p_status not in('administrado','recusado','omitido') then raise exception 'STATUS_INVALIDO';end if;
 select * into v_ap from public.prescricao_aprazamentos where id=p_aprazamento_id for update;if not found then raise exception 'APRAZAMENTO_NAO_ENCONTRADO';end if;if v_ap.status<>'pendente' then raise exception 'APRAZAMENTO_JA_CHECADO';end if;
 if not(public.tem_permissao(v_ap.empresa_id,v_ap.unidade_id,'medicamentos.checar_beira_leito') or public.tem_permissao(v_ap.empresa_id,v_ap.unidade_id,'medicamentos.administrar')) then raise exception 'SEM_PERMISSAO';end if;
 select * into v_p from public.prescricoes where id=v_ap.prescricao_id;if v_p.assinado_em is null or v_p.status<>'ativa' then raise exception 'PRESCRICAO_NAO_ATIVA_ASSINADA';end if;
 if v_p.requer_validacao_farmaceutica and not exists(select 1 from public.validacoes_farmaceuticas vf where vf.prescricao_id=v_p.id and vf.status in('validada','validada_com_ressalva')) then raise exception 'VALIDACAO_FARMACEUTICA_PENDENTE';end if;
 select * into v_pac from public.pacientes where id=v_ap.paciente_id;v_paciente_ok:=v_codigo<>'' and(v_codigo=v_pac.id::text or v_codigo=coalesce(v_pac.ra,'') or v_codigo=coalesce(v_pac.numero_registro::text,'') or v_codigo=coalesce(v_pac.cns,'') or regexp_replace(v_codigo,'\D','','g')=regexp_replace(coalesce(v_pac.cpf,''),'\D','','g'));if not v_paciente_ok then raise exception 'PACIENTE_DIVERGENTE';end if;
 select id into v_prof from public.profissionais where usuario_id=auth.uid() and empresa_id=v_ap.empresa_id and ativo limit 1;if v_prof is null then raise exception 'USUARIO_SEM_PROFISSIONAL';end if;
 if p_status='administrado' then select * into v_disp from public.dispensacoes_medicamentos where id=p_dispensacao_id;if not found or v_disp.prescricao_id is distinct from v_p.id or v_disp.status not in('dispensado','parcial') then raise exception 'DISPENSACAO_INVALIDA';end if;select * into v_prod from public.estoque_produtos where id=coalesce(v_disp.produto_id,v_p.produto_id);v_medicamento_ok:=v_cod_med<>'' and(v_cod_med=v_prod.id::text or v_cod_med=coalesce(v_prod.codigo,'') or v_cod_med=coalesce(v_prod.codigo_barras,''));if not v_medicamento_ok then raise exception 'MEDICAMENTO_DIVERGENTE';end if;else if coalesce(btrim(p_justificativa),'')='' then raise exception 'JUSTIFICATIVA_OBRIGATORIA';end if;end if;
 if p_dupla_checagem and(p_segundo_profissional_id is null or p_segundo_profissional_id=v_prof) then raise exception 'SEGUNDO_PROFISSIONAL_INVALIDO';end if;v_atraso:=floor(extract(epoch from(now()-v_ap.programado_em))/60)::integer;
 insert into public.administracoes_medicamentos(empresa_id,unidade_id,atendimento_id,prescricao_id,paciente_id,profissional_id,administrado_em,status,dose_administrada,via,lote,dupla_checagem,segundo_profissional_id,justificativa,created_by,dispensacao_id,produto_id,estoque_lote_id,codigo_barras_paciente,codigo_barras_medicamento,paciente_confirmado,medicamento_confirmado,dose_confirmada,via_confirmada,horario_confirmado,atraso_minutos,aprazamento_id)
 values(v_ap.empresa_id,v_ap.unidade_id,v_ap.atendimento_id,v_p.id,v_ap.paciente_id,v_prof,case when p_status='administrado' then now() else null end,p_status,coalesce(p_dose,v_p.dose),coalesce(p_via,v_p.via),v_disp.lote,p_dupla_checagem,p_segundo_profissional_id,p_justificativa,auth.uid(),case when p_status='administrado' then v_disp.id else null end,case when p_status='administrado' then v_prod.id else v_p.produto_id end,case when p_status='administrado' then v_disp.estoque_lote_id else null end,p_codigo_paciente,p_codigo_medicamento,true,case when p_status='administrado' then true else false end,true,true,abs(v_atraso)<=v_ap.tolerancia_minutos,v_atraso,v_ap.id) returning id into v_admin;
 update public.prescricao_aprazamentos set status=p_status,administracao_id=v_admin,checado_em=now(),justificativa=p_justificativa,updated_at=now(),updated_by=auth.uid() where id=v_ap.id;return v_admin;
end$$;

revoke all on function public.gerar_aprazamentos_prescricao(uuid,integer) from public,anon;
revoke all on function public.registrar_administracao_beira_leito(uuid,uuid,text,text,text,text,text,text,boolean,uuid) from public,anon;
grant execute on function public.gerar_aprazamentos_prescricao(uuid,integer) to authenticated;
grant execute on function public.registrar_administracao_beira_leito(uuid,uuid,text,text,text,text,text,text,boolean,uuid) to authenticated;
