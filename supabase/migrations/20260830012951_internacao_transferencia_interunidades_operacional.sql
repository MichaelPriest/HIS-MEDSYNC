-- Transferência interunidades: continuidade assistencial entre unidades da mesma empresa.
-- Versiona o estado operacional já aplicado no Supabase conectado.

create table if not exists public.internacao_transferencias_interunidades (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  internacao_origem_id uuid not null references public.internacoes(id),
  atendimento_origem_id uuid not null references public.atendimentos(id),
  unidade_origem_id uuid not null references public.unidades(id),
  unidade_destino_id uuid not null references public.unidades(id),
  leito_origem_id uuid references public.leitos(id),
  leito_destino_id uuid references public.leitos(id),
  atendimento_destino_id uuid references public.atendimentos(id),
  internacao_destino_id uuid references public.internacoes(id),
  status text not null default 'solicitada' check (status in ('solicitada','recusada','cancelada','concluida')),
  prioridade text not null default 'normal' check (prioridade in ('normal','alta','urgente','emergencia')),
  motivo text not null,
  resumo_clinico text,
  condicoes_transporte text,
  numero_autorizacao_destino text,
  senha_autorizacao_destino text,
  observacoes text,
  solicitada_por uuid references auth.users(id),
  solicitada_em timestamptz not null default now(),
  decidida_por uuid references auth.users(id),
  decidida_em timestamptz,
  concluida_por uuid references auth.users(id),
  concluida_em timestamptz,
  motivo_recusa text,
  motivo_cancelamento text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internacao_transferencias_interunidades_unidades_check check (unidade_origem_id <> unidade_destino_id),
  constraint internacao_transferencias_interunidades_destino_check check (
    status <> 'concluida' or (
      atendimento_destino_id is not null and internacao_destino_id is not null and
      leito_destino_id is not null and concluida_em is not null
    )
  )
);

create unique index if not exists uq_internacao_transferencia_aberta
  on public.internacao_transferencias_interunidades(internacao_origem_id)
  where status='solicitada';
create unique index if not exists uq_internacao_transferencia_atendimento_destino
  on public.internacao_transferencias_interunidades(atendimento_destino_id)
  where atendimento_destino_id is not null;
create unique index if not exists uq_internacao_transferencia_internacao_destino
  on public.internacao_transferencias_interunidades(internacao_destino_id)
  where internacao_destino_id is not null;
create index if not exists idx_internacao_transferencias_destino_fila
  on public.internacao_transferencias_interunidades(empresa_id,unidade_destino_id,status,prioridade,solicitada_em);
create index if not exists idx_internacao_transferencias_origem
  on public.internacao_transferencias_interunidades(empresa_id,unidade_origem_id,status,solicitada_em desc);

alter table public.internacao_transferencias_interunidades enable row level security;
alter table public.internacao_transferencias_interunidades force row level security;
revoke all on public.internacao_transferencias_interunidades from anon, authenticated;
grant select on public.internacao_transferencias_interunidades to authenticated;

drop policy if exists internacao_transferencias_interunidades_select on public.internacao_transferencias_interunidades;
create policy internacao_transferencias_interunidades_select
on public.internacao_transferencias_interunidades
for select to authenticated
using (
  auth.uid() is not null
  and (public.tem_unidade(empresa_id,unidade_origem_id) or public.tem_unidade(empresa_id,unidade_destino_id))
  and (
    public.tem_permissao(empresa_id,case when public.tem_unidade(empresa_id,unidade_origem_id) then unidade_origem_id else unidade_destino_id end,'internacao.visualizar')
    or public.tem_permissao(empresa_id,case when public.tem_unidade(empresa_id,unidade_origem_id) then unidade_origem_id else unidade_destino_id end,'internacao.movimentar')
    or public.tem_permissao(empresa_id,case when public.tem_unidade(empresa_id,unidade_origem_id) then unidade_origem_id else unidade_destino_id end,'internacao.gerenciar')
  )
);

-- O ledger transversal passa a aceitar as duas transições interunidades.
alter table public.integracao_eventos drop constraint if exists integracao_eventos_tipo_check;
alter table public.integracao_eventos add constraint integracao_eventos_tipo_check check (tipo_evento in (
  'exame.liberado','imagem.executada','laudo.liberado','cirurgia.iniciada','cirurgia.concluida','opme.utilizada','producao.registrada',
  'prescricao.assinada','farmacia.validada','medicamento.dispensado','medicamento.administrado','medicamento.devolvido','estoque.consumo_paciente',
  'internacao.admitida','leito.alocado','leito.transferido','internacao.alta','leito.higienizacao_concluida',
  'internacao.transferencia_solicitada','internacao.transferencia_concluida'
));

create or replace function public.solicitar_transferencia_interunidade(
  p_internacao_id uuid,
  p_unidade_destino_id uuid,
  p_motivo text,
  p_prioridade text default 'normal',
  p_resumo_clinico text default null,
  p_condicoes_transporte text default null,
  p_numero_autorizacao_destino text default null,
  p_senha_autorizacao_destino text default null,
  p_observacoes text default null
) returns uuid
language plpgsql security definer
set search_path=public,pg_catalog,extensions
as $$
declare
  v_i public.internacoes%rowtype;
  v_a public.atendimentos%rowtype;
  v_dest public.unidades%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'TRANSFERENCIA_USUARIO_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_i from public.internacoes where id=p_internacao_id for update;
  if not found then raise exception 'TRANSFERENCIA_INTERNACAO_NAO_LOCALIZADA'; end if;
  if v_i.status not in ('internado','transferido') then raise exception 'TRANSFERENCIA_INTERNACAO_NAO_ATIVA'; end if;
  if v_i.leito_id is null then raise exception 'TRANSFERENCIA_ORIGEM_SEM_LEITO'; end if;
  if not public.tem_unidade(v_i.empresa_id,v_i.unidade_id) then raise exception 'TRANSFERENCIA_ORIGEM_FORA_ESCOPO' using errcode='42501'; end if;
  if not (public.tem_permissao(v_i.empresa_id,v_i.unidade_id,'internacao.movimentar') or public.tem_permissao(v_i.empresa_id,v_i.unidade_id,'internacao.gerenciar')) then
    raise exception 'TRANSFERENCIA_ORIGEM_SEM_PERMISSAO' using errcode='42501';
  end if;
  if nullif(trim(coalesce(p_motivo,'')),'') is null then raise exception 'TRANSFERENCIA_MOTIVO_OBRIGATORIO'; end if;
  if coalesce(p_prioridade,'normal') not in ('normal','alta','urgente','emergencia') then raise exception 'TRANSFERENCIA_PRIORIDADE_INVALIDA'; end if;
  select * into v_dest from public.unidades where id=p_unidade_destino_id and empresa_id=v_i.empresa_id and ativo=true;
  if not found or v_dest.id=v_i.unidade_id then raise exception 'TRANSFERENCIA_UNIDADE_DESTINO_INVALIDA'; end if;
  select * into v_a from public.atendimentos where id=v_i.atendimento_id and empresa_id=v_i.empresa_id and unidade_id=v_i.unidade_id;
  if not found then raise exception 'TRANSFERENCIA_ATENDIMENTO_ORIGEM_INCONSISTENTE'; end if;

  insert into public.internacao_transferencias_interunidades(
    empresa_id,internacao_origem_id,atendimento_origem_id,unidade_origem_id,unidade_destino_id,leito_origem_id,
    prioridade,motivo,resumo_clinico,condicoes_transporte,numero_autorizacao_destino,senha_autorizacao_destino,observacoes,solicitada_por
  ) values (
    v_i.empresa_id,v_i.id,v_i.atendimento_id,v_i.unidade_id,v_dest.id,v_i.leito_id,
    coalesce(p_prioridade,'normal'),trim(p_motivo),nullif(trim(coalesce(p_resumo_clinico,'')),''),nullif(trim(coalesce(p_condicoes_transporte,'')),''),
    nullif(trim(coalesce(p_numero_autorizacao_destino,'')),''),nullif(trim(coalesce(p_senha_autorizacao_destino,'')),''),nullif(trim(coalesce(p_observacoes,'')),''),auth.uid()
  ) returning id into v_id;

  perform public.registrar_integracao_evento_internal(v_i.empresa_id,v_i.unidade_id,v_i.atendimento_id,v_a.paciente_id,
    'internacao.transferencia_solicitada','internacao_transferencias_interunidades',v_id,now(),
    jsonb_build_object('unidade_origem_id',v_i.unidade_id,'unidade_destino_id',v_dest.id,'prioridade',coalesce(p_prioridade,'normal')));
  return v_id;
end;
$$;

create or replace function public.aceitar_transferencia_interunidade(
  p_transferencia_id uuid,
  p_leito_destino_id uuid,
  p_observacoes text default null
) returns jsonb
language plpgsql security definer
set search_path=public,pg_catalog,extensions
as $$
declare
  v_t public.internacao_transferencias_interunidades%rowtype;
  v_i public.internacoes%rowtype;
  v_a public.atendimentos%rowtype;
  v_l public.leitos%rowtype;
  v_p public.pacientes%rowtype;
  v_at_dest uuid; v_int_dest uuid; v_mov_src uuid; v_mov_dest uuid;
  v_prof uuid; v_acom_i text; v_acom_l text; v_sexo text; v_restricao text;
begin
  if auth.uid() is null then raise exception 'TRANSFERENCIA_USUARIO_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_t from public.internacao_transferencias_interunidades where id=p_transferencia_id for update;
  if not found then raise exception 'TRANSFERENCIA_NAO_LOCALIZADA'; end if;
  if v_t.status<>'solicitada' then raise exception 'TRANSFERENCIA_NAO_PENDENTE'; end if;
  if not public.tem_unidade(v_t.empresa_id,v_t.unidade_destino_id) or not (public.tem_permissao(v_t.empresa_id,v_t.unidade_destino_id,'internacao.movimentar') or public.tem_permissao(v_t.empresa_id,v_t.unidade_destino_id,'internacao.gerenciar') or public.tem_permissao(v_t.empresa_id,v_t.unidade_destino_id,'internacao.admitir')) then
    raise exception 'TRANSFERENCIA_DESTINO_SEM_PERMISSAO' using errcode='42501';
  end if;
  select * into v_i from public.internacoes where id=v_t.internacao_origem_id for update;
  if not found or v_i.status not in ('internado','transferido') or v_i.unidade_id<>v_t.unidade_origem_id then raise exception 'TRANSFERENCIA_ORIGEM_NAO_ATIVA'; end if;
  select * into v_a from public.atendimentos where id=v_i.atendimento_id and unidade_id=v_t.unidade_origem_id for update;
  if not found then raise exception 'TRANSFERENCIA_ATENDIMENTO_ORIGEM_INCONSISTENTE'; end if;
  select * into v_p from public.pacientes where id=v_a.paciente_id;
  select * into v_l from public.leitos where id=p_leito_destino_id for update;
  if not found or v_l.empresa_id<>v_t.empresa_id or v_l.unidade_id<>v_t.unidade_destino_id or not v_l.ativo then raise exception 'TRANSFERENCIA_LEITO_DESTINO_INVALIDO'; end if;
  if v_l.status in ('ocupado','manutencao','bloqueado','higienizacao') then raise exception 'TRANSFERENCIA_LEITO_DESTINO_INDISPONIVEL'; end if;
  if exists(select 1 from public.internacoes x where x.leito_id=v_l.id and x.status='internado') then raise exception 'TRANSFERENCIA_LEITO_DESTINO_OCUPADO'; end if;
  if coalesce(v_i.isolamento,false) and not coalesce(v_l.isolamento_capaz,false) then raise exception 'TRANSFERENCIA_LEITO_INCOMPATIVEL_ISOLAMENTO'; end if;
  v_sexo:=lower(trim(coalesce(v_p.sexo::text,'')));
  v_restricao:=case lower(trim(coalesce(v_l.sexo_restricao,''))) when 'm' then 'masculino' when 'masc' then 'masculino' when 'masculino' then 'masculino' when 'f' then 'feminino' when 'fem' then 'feminino' when 'feminino' then 'feminino' else nullif(lower(trim(coalesce(v_l.sexo_restricao,''))),'') end;
  if v_restricao is not null and v_sexo<>v_restricao then raise exception 'TRANSFERENCIA_LEITO_INCOMPATIVEL_SEXO'; end if;
  v_acom_i:=case lower(trim(coalesce(v_i.acomodacao,''))) when 'enfermaria' then 'coletiva' when 'coletiva' then 'coletiva' when 'apartamento' then 'apartamento' when 'privativo' then 'apartamento' when 'privativa' then 'apartamento' when 'uti' then 'uti' when 'observacao' then 'observacao' when 'observação' then 'observacao' else nullif(lower(trim(coalesce(v_i.acomodacao,''))),'') end;
  v_acom_l:=case lower(trim(coalesce(v_l.acomodacao,''))) when 'enfermaria' then 'coletiva' when 'coletiva' then 'coletiva' when 'apartamento' then 'apartamento' when 'privativo' then 'apartamento' when 'privativa' then 'apartamento' when 'uti' then 'uti' when 'observacao' then 'observacao' when 'observação' then 'observacao' else nullif(lower(trim(coalesce(v_l.acomodacao,''))),'') end;
  if v_acom_i is not null and v_acom_l is not null and v_acom_i<>v_acom_l then raise exception 'TRANSFERENCIA_LEITO_INCOMPATIVEL_ACOMODACAO'; end if;

  insert into public.atendimentos(
    empresa_id,unidade_id,paciente_id,profissional_id,tipo_atendimento,origem,status,cobertura,convenio_id,plano_id,
    numero_carteirinha,validade_carteirinha,numero_autorizacao,senha_autorizacao,
    paciente_nome,paciente_cpf,paciente_rg,paciente_cns,paciente_data_nascimento,paciente_nacionalidade,paciente_estado_civil,paciente_sexo,paciente_telefone,paciente_email,
    paciente_cep,paciente_endereco,paciente_numero,paciente_complemento,paciente_bairro,paciente_cidade,paciente_estado,
    especialidade_destino,setor_atual,observacoes,registro_ans_snapshot,cnes_snapshot,
    profissional_conselho_snapshot,profissional_numero_conselho_snapshot,profissional_uf_conselho_snapshot,profissional_cbo_snapshot,profissional_especialidade_snapshot,
    regime_atendimento,tipo_atendimento_tiss,codigo_tuss_principal,descricao_tuss_principal,indicacao_clinica,
    tipo_atendimento_tuss50_conceito_id,tipo_atendimento_tuss50_codigo,tipo_atendimento_tuss50_descricao,tipo_atendimento_tuss50_versao,tipo_atendimento_tuss50_canonical,
    created_by,updated_by
  ) select
    empresa_id,v_t.unidade_destino_id,paciente_id,profissional_id,tipo_atendimento,'transferencia_interunidade','em_atendimento',cobertura,convenio_id,plano_id,
    numero_carteirinha,validade_carteirinha,coalesce(v_t.numero_autorizacao_destino,numero_autorizacao),coalesce(v_t.senha_autorizacao_destino,senha_autorizacao),
    paciente_nome,paciente_cpf,paciente_rg,paciente_cns,paciente_data_nascimento,paciente_nacionalidade,paciente_estado_civil,paciente_sexo,paciente_telefone,paciente_email,
    paciente_cep,paciente_endereco,paciente_numero,paciente_complemento,paciente_bairro,paciente_cidade,paciente_estado,
    especialidade_destino,v_l.setor,concat_ws(E'\n',nullif(observacoes,''),'Continuidade assistencial por transferencia interunidades.'),registro_ans_snapshot,cnes_snapshot,
    profissional_conselho_snapshot,profissional_numero_conselho_snapshot,profissional_uf_conselho_snapshot,profissional_cbo_snapshot,profissional_especialidade_snapshot,
    regime_atendimento,tipo_atendimento_tiss,codigo_tuss_principal,descricao_tuss_principal,indicacao_clinica,
    tipo_atendimento_tuss50_conceito_id,tipo_atendimento_tuss50_codigo,tipo_atendimento_tuss50_descricao,tipo_atendimento_tuss50_versao,tipo_atendimento_tuss50_canonical,
    auth.uid(),auth.uid()
  from public.atendimentos where id=v_a.id
  returning id into v_at_dest;

  insert into public.internacoes(
    empresa_id,unidade_id,atendimento_id,profissional_responsavel_id,setor,quarto,leito,leito_id,acomodacao,tipo_internacao,motivo,previsao_alta,status,observacoes,
    isolamento,tipo_isolamento,acomodacao_tuss49_conceito_id,acomodacao_tuss49_codigo,acomodacao_tuss49_descricao,acomodacao_tuss49_versao,acomodacao_tuss49_canonical,tipo_internacao_ans_codigo,
    created_by,updated_by
  ) values (
    v_t.empresa_id,v_t.unidade_destino_id,v_at_dest,v_i.profissional_responsavel_id,v_l.setor,v_l.quarto,v_l.codigo,v_l.id,coalesce(v_l.acomodacao,v_i.acomodacao),v_i.tipo_internacao,
    concat('Transferencia interunidades: ',v_t.motivo),v_i.previsao_alta,'internado',concat_ws(E'\n',v_t.resumo_clinico,p_observacoes),
    v_i.isolamento,v_i.tipo_isolamento,v_i.acomodacao_tuss49_conceito_id,v_i.acomodacao_tuss49_codigo,v_i.acomodacao_tuss49_descricao,v_i.acomodacao_tuss49_versao,v_i.acomodacao_tuss49_canonical,v_i.tipo_internacao_ans_codigo,
    auth.uid(),auth.uid()
  ) returning id into v_int_dest;

  if v_i.leito_id is not null then
    update public.leitos set status='higienizacao',updated_at=now(),updated_by=auth.uid() where id=v_i.leito_id;
    insert into public.leito_higienizacoes(empresa_id,unidade_id,leito_id,internacao_id,atendimento_id,status,solicitada_por,created_by,updated_by)
    values(v_t.empresa_id,v_t.unidade_origem_id,v_i.leito_id,v_i.id,v_i.atendimento_id,'pendente',auth.uid(),auth.uid(),auth.uid()) on conflict do nothing;
  end if;
  update public.leitos set status='ocupado',updated_at=now(),updated_by=auth.uid() where id=v_l.id;

  update public.internacoes set status='alta',data_alta=now(),motivo_alta='transferencia_interunidade',leito_id=null,updated_at=now(),updated_by=auth.uid() where id=v_i.id;
  update public.atendimentos set status='alta',data_fechamento=now(),setor_atual='transferencia_interunidade',ultima_movimentacao_em=now(),updated_at=now(),updated_by=auth.uid() where id=v_a.id;

  v_prof:=public.profissional_logado(v_t.empresa_id);
  insert into public.movimentacoes_leitos(empresa_id,unidade_id,internacao_id,atendimento_id,leito_origem_id,leito_destino_id,tipo,motivo,movimentado_em,profissional_id,created_by)
  values(v_t.empresa_id,v_t.unidade_origem_id,v_i.id,v_a.id,v_i.leito_id,v_l.id,'transferencia_interunidade_saida',v_t.motivo,now(),v_prof,auth.uid()) returning id into v_mov_src;
  insert into public.movimentacoes_leitos(empresa_id,unidade_id,internacao_id,atendimento_id,leito_origem_id,leito_destino_id,tipo,motivo,movimentado_em,profissional_id,created_by)
  values(v_t.empresa_id,v_t.unidade_destino_id,v_int_dest,v_at_dest,v_i.leito_id,v_l.id,'transferencia_interunidade_entrada',v_t.motivo,now(),v_prof,auth.uid()) returning id into v_mov_dest;

  update public.internacao_transferencias_interunidades set
    status='concluida',leito_destino_id=v_l.id,atendimento_destino_id=v_at_dest,internacao_destino_id=v_int_dest,
    decidida_por=auth.uid(),decidida_em=now(),concluida_por=auth.uid(),concluida_em=now(),observacoes=coalesce(nullif(trim(coalesce(p_observacoes,'')),''),observacoes),updated_at=now()
  where id=v_t.id;

  perform public.registrar_integracao_evento_internal(v_t.empresa_id,v_t.unidade_destino_id,v_at_dest,v_a.paciente_id,
    'internacao.transferencia_concluida','internacao_transferencias_interunidades',v_t.id,now(),
    jsonb_build_object('atendimento_origem_id',v_a.id,'atendimento_destino_id',v_at_dest,'internacao_origem_id',v_i.id,'internacao_destino_id',v_int_dest,'unidade_origem_id',v_t.unidade_origem_id,'unidade_destino_id',v_t.unidade_destino_id));

  begin
    perform public.preparar_conta_pos_alta_internal_impl(v_a.id);
  exception when others then
    insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,titulo,descricao,severidade,status,origem_tabela,origem_id,detectada_em,metadados)
    values(v_t.empresa_id,v_t.unidade_origem_id,v_a.id,v_a.paciente_id,'transferencia_origem_faturamento_nao_preparado','Transferencia interunidades com faturamento de origem pendente',
      'O segmento assistencial de origem foi encerrado por transferencia interunidades, mas a conta nao pôde ser preparada automaticamente.','alta','aberta','internacao_transferencias_interunidades',v_t.id,now(),jsonb_build_object('erro',sqlerrm))
    on conflict (empresa_id,regra_chave,origem_tabela,origem_id) where status='aberta' do update set descricao=excluded.descricao,detectada_em=excluded.detectada_em,metadados=excluded.metadados;
  end;

  return jsonb_build_object('transferencia_id',v_t.id,'atendimento_origem_id',v_a.id,'atendimento_destino_id',v_at_dest,'internacao_destino_id',v_int_dest,'movimento_origem_id',v_mov_src,'movimento_destino_id',v_mov_dest);
end;
$$;

create or replace function public.recusar_transferencia_interunidade(p_transferencia_id uuid,p_motivo text)
returns uuid language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_t public.internacao_transferencias_interunidades%rowtype;
begin
  if auth.uid() is null then raise exception 'TRANSFERENCIA_USUARIO_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_t from public.internacao_transferencias_interunidades where id=p_transferencia_id for update;
  if not found then raise exception 'TRANSFERENCIA_NAO_LOCALIZADA'; end if;
  if v_t.status<>'solicitada' then raise exception 'TRANSFERENCIA_NAO_RECUSAVEL'; end if;
  if not public.tem_unidade(v_t.empresa_id,v_t.unidade_destino_id) or not (public.tem_permissao(v_t.empresa_id,v_t.unidade_destino_id,'internacao.movimentar') or public.tem_permissao(v_t.empresa_id,v_t.unidade_destino_id,'internacao.gerenciar')) then raise exception 'TRANSFERENCIA_DESTINO_SEM_PERMISSAO' using errcode='42501'; end if;
  if nullif(trim(coalesce(p_motivo,'')),'') is null then raise exception 'TRANSFERENCIA_MOTIVO_RECUSA_OBRIGATORIO'; end if;
  update public.internacao_transferencias_interunidades set status='recusada',motivo_recusa=trim(p_motivo),decidida_por=auth.uid(),decidida_em=now(),updated_at=now() where id=v_t.id;
  return v_t.id;
end;
$$;

create or replace function public.cancelar_transferencia_interunidade(p_transferencia_id uuid,p_motivo text)
returns uuid language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_t public.internacao_transferencias_interunidades%rowtype;
begin
  if auth.uid() is null then raise exception 'TRANSFERENCIA_USUARIO_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_t from public.internacao_transferencias_interunidades where id=p_transferencia_id for update;
  if not found then raise exception 'TRANSFERENCIA_NAO_LOCALIZADA'; end if;
  if v_t.status<>'solicitada' then raise exception 'TRANSFERENCIA_NAO_CANCELAVEL'; end if;
  if not public.tem_unidade(v_t.empresa_id,v_t.unidade_origem_id) or not (public.tem_permissao(v_t.empresa_id,v_t.unidade_origem_id,'internacao.movimentar') or public.tem_permissao(v_t.empresa_id,v_t.unidade_origem_id,'internacao.gerenciar')) then raise exception 'TRANSFERENCIA_SEM_PERMISSAO' using errcode='42501'; end if;
  if nullif(trim(coalesce(p_motivo,'')),'') is null then raise exception 'TRANSFERENCIA_MOTIVO_CANCELAMENTO_OBRIGATORIO'; end if;
  update public.internacao_transferencias_interunidades set status='cancelada',motivo_cancelamento=trim(p_motivo),decidida_por=auth.uid(),decidida_em=now(),updated_at=now() where id=v_t.id;
  return v_t.id;
end;
$$;

revoke all on function public.solicitar_transferencia_interunidade(uuid,uuid,text,text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.aceitar_transferencia_interunidade(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.recusar_transferencia_interunidade(uuid,text) from public,anon,authenticated;
revoke all on function public.cancelar_transferencia_interunidade(uuid,text) from public,anon,authenticated;
grant execute on function public.solicitar_transferencia_interunidade(uuid,uuid,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.aceitar_transferencia_interunidade(uuid,uuid,text) to authenticated;
grant execute on function public.recusar_transferencia_interunidade(uuid,text) to authenticated;
grant execute on function public.cancelar_transferencia_interunidade(uuid,text) to authenticated;
