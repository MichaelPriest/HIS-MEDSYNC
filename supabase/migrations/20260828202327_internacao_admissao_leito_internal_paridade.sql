create or replace function public.movimentar_internacao_leito_internal(p_internacao_id uuid,p_leito_destino_id uuid,p_motivo text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_i public.internacoes%rowtype; v_l public.leitos%rowtype; v_prof uuid; v_mov uuid; v_tipo text; v_reserva uuid;
  v_sexo text; v_restricao_sexo text; v_acomodacao_internacao text; v_acomodacao_leito text;
begin
  if auth.uid() is null then raise exception 'LEITO_USUARIO_NAO_AUTENTICADO' using errcode='42501'; end if;
  select * into v_i from public.internacoes where id=p_internacao_id for update;
  if not found then raise exception 'LEITO_INTERNACAO_NAO_LOCALIZADA'; end if;
  if v_i.status not in ('aguardando_leito','internado','transferido') then raise exception 'LEITO_INTERNACAO_NAO_ATIVA'; end if;
  select * into v_l from public.leitos where id=p_leito_destino_id for update;
  if not found then raise exception 'LEITO_DESTINO_NAO_LOCALIZADO'; end if;
  if v_l.empresa_id<>v_i.empresa_id or v_l.unidade_id<>v_i.unidade_id then raise exception 'LEITO_DESTINO_FORA_ESCOPO'; end if;
  if not v_l.ativo or v_l.status in ('ocupado','manutencao','bloqueado','higienizacao') then raise exception 'LEITO_DESTINO_INDISPONIVEL'; end if;
  if exists(select 1 from public.internacoes x where x.leito_id=p_leito_destino_id and x.status='internado' and x.id<>p_internacao_id) then raise exception 'LEITO_DESTINO_OCUPADO'; end if;
  select p.sexo::text into v_sexo from public.atendimentos a join public.pacientes p on p.id=a.paciente_id where a.id=v_i.atendimento_id and a.empresa_id=v_i.empresa_id and a.unidade_id=v_i.unidade_id;
  if coalesce(v_i.isolamento,false) and not coalesce(v_l.isolamento_capaz,false) then raise exception 'LEITO_INCOMPATIVEL_ISOLAMENTO'; end if;
  v_restricao_sexo:=case lower(trim(coalesce(v_l.sexo_restricao,''))) when 'm' then 'masculino' when 'masc' then 'masculino' when 'masculino' then 'masculino' when 'f' then 'feminino' when 'fem' then 'feminino' when 'feminino' then 'feminino' else nullif(lower(trim(coalesce(v_l.sexo_restricao,''))),'') end;
  if v_restricao_sexo is not null and (v_sexo is null or lower(v_sexo)<>v_restricao_sexo) then raise exception 'LEITO_INCOMPATIVEL_SEXO'; end if;
  v_acomodacao_internacao:=case lower(trim(coalesce(v_i.acomodacao,''))) when 'enfermaria' then 'coletiva' when 'coletiva' then 'coletiva' when 'apartamento' then 'apartamento' when 'privativo' then 'apartamento' when 'privativa' then 'apartamento' when 'uti' then 'uti' when 'observacao' then 'observacao' when 'observação' then 'observacao' else nullif(lower(trim(coalesce(v_i.acomodacao,''))),'') end;
  v_acomodacao_leito:=case lower(trim(coalesce(v_l.acomodacao,''))) when 'enfermaria' then 'coletiva' when 'coletiva' then 'coletiva' when 'apartamento' then 'apartamento' when 'privativo' then 'apartamento' when 'privativa' then 'apartamento' when 'uti' then 'uti' when 'observacao' then 'observacao' when 'observação' then 'observacao' else nullif(lower(trim(coalesce(v_l.acomodacao,''))),'') end;
  if v_acomodacao_internacao is not null and v_acomodacao_leito is not null and v_acomodacao_internacao<>v_acomodacao_leito then raise exception 'LEITO_INCOMPATIVEL_ACOMODACAO'; end if;
  if v_l.status='reservado' then
    select id into v_reserva from public.leito_reservas where leito_id=v_l.id and status='ativa' and atendimento_id=v_i.atendimento_id limit 1 for update;
    if v_reserva is null then raise exception 'LEITO_RESERVADO_PARA_OUTRO_ATENDIMENTO'; end if;
  end if;
  v_prof:=public.profissional_logado(v_i.empresa_id); v_tipo:=case when v_i.leito_id is null then 'admissao' else 'transferencia' end;
  if v_i.leito_id is not null and v_i.leito_id<>p_leito_destino_id then
    update public.leitos set status='higienizacao',updated_at=now(),updated_by=auth.uid() where id=v_i.leito_id;
    insert into public.leito_higienizacoes(empresa_id,unidade_id,leito_id,internacao_id,atendimento_id,status,solicitada_por,created_by,updated_by)
    values(v_i.empresa_id,v_i.unidade_id,v_i.leito_id,v_i.id,v_i.atendimento_id,'pendente',auth.uid(),auth.uid(),auth.uid()) on conflict do nothing;
  end if;
  update public.leitos set status='ocupado',updated_at=now(),updated_by=auth.uid() where id=v_l.id;
  if v_reserva is not null then update public.leito_reservas set status='utilizada',updated_at=now(),updated_by=auth.uid() where id=v_reserva; end if;
  update public.internacoes set leito_id=v_l.id,setor=v_l.setor,quarto=v_l.quarto,leito=v_l.codigo,acomodacao=coalesce(v_l.acomodacao,acomodacao),status='internado',updated_at=now(),updated_by=auth.uid() where id=v_i.id;
  update public.atendimentos set status='em_atendimento',setor_atual=v_l.setor,ultima_movimentacao_em=now(),updated_at=now(),updated_by=auth.uid() where id=v_i.atendimento_id and status not in ('alta','cancelado');
  insert into public.movimentacoes_leitos(empresa_id,unidade_id,internacao_id,atendimento_id,leito_origem_id,leito_destino_id,tipo,motivo,movimentado_em,profissional_id,created_by)
  values(v_i.empresa_id,v_i.unidade_id,v_i.id,v_i.atendimento_id,v_i.leito_id,v_l.id,v_tipo,p_motivo,now(),v_prof,auth.uid()) returning id into v_mov;
  return v_mov;
end $$;
revoke execute on function public.movimentar_internacao_leito_internal(uuid,uuid,text) from public,anon,authenticated;

create or replace function public.movimentar_internacao_leito(p_internacao_id uuid,p_leito_destino_id uuid,p_motivo text default null)
returns uuid language plpgsql security definer set search_path=''
as $$declare v_i public.internacoes%rowtype; begin
 if auth.uid() is null then raise exception 'LEITO_USUARIO_NAO_AUTENTICADO' using errcode='42501'; end if;
 select * into v_i from public.internacoes where id=p_internacao_id;
 if not found then raise exception 'LEITO_INTERNACAO_NAO_LOCALIZADA'; end if;
 if not public.tem_unidade(v_i.empresa_id,v_i.unidade_id) then raise exception 'LEITO_UNIDADE_FORA_ESCOPO' using errcode='42501'; end if;
 if not(public.tem_permissao(v_i.empresa_id,v_i.unidade_id,'leitos.gerenciar') or public.tem_permissao(v_i.empresa_id,v_i.unidade_id,'internacao.movimentar') or public.tem_permissao(v_i.empresa_id,v_i.unidade_id,'internacao.gerenciar')) then raise exception 'LEITO_SEM_PERMISSAO' using errcode='42501'; end if;
 return public.movimentar_internacao_leito_internal(p_internacao_id,p_leito_destino_id,p_motivo);
end $$;
revoke execute on function public.movimentar_internacao_leito(uuid,uuid,text) from public,anon; grant execute on function public.movimentar_internacao_leito(uuid,uuid,text) to authenticated;

create or replace function public.admitir_internacao_operacional(p_atendimento_id uuid,p_setor text,p_profissional_responsavel_id uuid default null,p_leito_id uuid default null,p_acomodacao text default null,p_acomodacao_tuss49_codigo text default null,p_motivo text default null,p_previsao_alta date default null,p_observacoes text default null)
returns uuid language plpgsql security definer set search_path=''
as $$declare v_at public.atendimentos%rowtype; v_dom record; v_internacao uuid; begin
 if auth.uid() is null then raise exception 'INTERNACAO_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
 if coalesce(btrim(p_setor),'')='' then raise exception 'INTERNACAO_SETOR_OBRIGATORIO'; end if;
 select * into v_at from public.atendimentos where id=p_atendimento_id for update;
 if not found then raise exception 'INTERNACAO_ATENDIMENTO_NAO_LOCALIZADO'; end if;
 if not public.tem_unidade(v_at.empresa_id,v_at.unidade_id) then raise exception 'INTERNACAO_UNIDADE_FORA_ESCOPO' using errcode='42501'; end if;
 if v_at.status in ('alta','cancelado') then raise exception 'INTERNACAO_ATENDIMENTO_ENCERRADO'; end if;
 if not(public.tem_permissao(v_at.empresa_id,v_at.unidade_id,'internacao.admitir') or public.tem_permissao(v_at.empresa_id,v_at.unidade_id,'internacao.criar') or public.tem_permissao(v_at.empresa_id,v_at.unidade_id,'internacao.gerenciar')) then raise exception 'INTERNACAO_SEM_PERMISSAO_ADMITIR' using errcode='42501'; end if;
 if exists(select 1 from public.internacoes i where i.atendimento_id=v_at.id and i.status in ('aguardando_leito','internado','transferido')) then raise exception 'INTERNACAO_ATIVA_JA_EXISTE'; end if;
 if p_profissional_responsavel_id is not null and not exists(select 1 from public.profissionais p where p.id=p_profissional_responsavel_id and p.empresa_id=v_at.empresa_id and p.ativo=true) then raise exception 'INTERNACAO_RESPONSAVEL_INVALIDO'; end if;
 if v_at.cobertura::text='convenio' and coalesce(btrim(p_acomodacao_tuss49_codigo),'')='' then raise exception 'INTERNACAO_ACOMODACAO_ANS_OBRIGATORIA'; end if;
 if coalesce(btrim(p_acomodacao_tuss49_codigo),'')<>'' then select conceito_id,codigo,display,versao,canonical into v_dom from public.ans_fhir_dominios_ativos where tabela=49 and codigo=btrim(p_acomodacao_tuss49_codigo) limit 1; if v_dom.codigo is null then raise exception 'INTERNACAO_ACOMODACAO_ANS_INVALIDA'; end if; end if;
 insert into public.internacoes(empresa_id,unidade_id,atendimento_id,profissional_responsavel_id,setor,acomodacao,acomodacao_tuss49_conceito_id,acomodacao_tuss49_codigo,acomodacao_tuss49_descricao,acomodacao_tuss49_versao,acomodacao_tuss49_canonical,motivo,previsao_alta,observacoes,status,created_by,updated_by)
 values(v_at.empresa_id,v_at.unidade_id,v_at.id,p_profissional_responsavel_id,btrim(p_setor),nullif(btrim(p_acomodacao),''),v_dom.conceito_id,v_dom.codigo,v_dom.display,v_dom.versao,v_dom.canonical,nullif(btrim(p_motivo),''),p_previsao_alta,nullif(btrim(p_observacoes),''),'aguardando_leito',auth.uid(),auth.uid()) returning id into v_internacao;
 update public.atendimentos set status='em_atendimento',setor_atual=btrim(p_setor),ultima_movimentacao_em=now(),updated_at=now(),updated_by=auth.uid() where id=v_at.id;
 if p_leito_id is not null then perform public.movimentar_internacao_leito_internal(v_internacao,p_leito_id,'Admissão'); end if;
 return v_internacao;
end $$;
revoke execute on function public.admitir_internacao_operacional(uuid,text,uuid,uuid,text,text,text,date,text) from public,anon; grant execute on function public.admitir_internacao_operacional(uuid,text,uuid,uuid,text,text,text,date,text) to authenticated;
