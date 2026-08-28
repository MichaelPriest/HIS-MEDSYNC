create or replace function public.proteger_item_tabela_comercial_publicada()
returns trigger
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_edicao_id uuid := case when tg_op='DELETE' then old.edicao_id else new.edicao_id end;
  v_status text;
begin
  select status into v_status from public.tabelas_comerciais_edicoes where id=v_edicao_id;
  if v_status is null then raise exception 'COMERCIAL_EDICAO_NAO_LOCALIZADA'; end if;
  if v_status <> 'rascunho' then
    raise exception 'COMERCIAL_EDICAO_PUBLICADA_IMUTAVEL_CRIAR_NOVA_VERSAO';
  end if;
  return case when tg_op='DELETE' then old else new end;
end
$$;

revoke execute on function public.proteger_item_tabela_comercial_publicada() from public,anon,authenticated;

drop trigger if exists trg_proteger_item_tabela_comercial_publicada on public.tabelas_comerciais_itens;
create trigger trg_proteger_item_tabela_comercial_publicada
before insert or update or delete on public.tabelas_comerciais_itens
for each row execute function public.proteger_item_tabela_comercial_publicada();

create or replace function public.proteger_edicao_comercial_publicada()
returns trigger
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_publicacao boolean := coalesce(current_setting('app.comercial_publicacao',true),'')='1';
begin
  if tg_op='INSERT' then
    if new.status <> 'rascunho' and not v_publicacao then
      raise exception 'COMERCIAL_NOVA_EDICAO_DEVE_INICIAR_COMO_RASCUNHO';
    end if;
    return new;
  end if;

  if tg_op='DELETE' then
    if old.status <> 'rascunho' and not v_publicacao then
      raise exception 'COMERCIAL_EDICAO_PUBLICADA_IMUTAVEL';
    end if;
    return old;
  end if;

  if old.status <> 'rascunho' and not v_publicacao then
    raise exception 'COMERCIAL_EDICAO_PUBLICADA_IMUTAVEL';
  end if;
  if old.status='rascunho' and new.status <> 'rascunho' and not v_publicacao then
    raise exception 'COMERCIAL_PUBLICACAO_DEVE_USAR_FLUXO_VERSIONADO';
  end if;
  return new;
end
$$;

revoke execute on function public.proteger_edicao_comercial_publicada() from public,anon,authenticated;

drop trigger if exists trg_proteger_edicao_comercial_publicada on public.tabelas_comerciais_edicoes;
create trigger trg_proteger_edicao_comercial_publicada
before insert or update or delete on public.tabelas_comerciais_edicoes
for each row execute function public.proteger_edicao_comercial_publicada();

create or replace function public.comercial_publicar_edicao(p_edicao_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare v_e public.tabelas_comerciais_edicoes%rowtype; v_empresa uuid; v_qtd bigint;
begin
  if auth.uid() is null then raise exception 'COMERCIAL_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_e from public.tabelas_comerciais_edicoes where id=p_edicao_id for update;
  if not found then raise exception 'COMERCIAL_EDICAO_NAO_LOCALIZADA'; end if;
  select f.empresa_id into v_empresa from public.tabelas_comerciais_fontes f where f.id=v_e.fonte_id;
  if not public.tabelas_comerciais_pode_editar(v_empresa,null) then raise exception 'COMERCIAL_SEM_PERMISSAO_TABELA' using errcode='42501'; end if;
  if v_e.status<>'rascunho' then raise exception 'COMERCIAL_EDICAO_NAO_E_RASCUNHO'; end if;
  select count(*) into v_qtd from public.tabelas_comerciais_itens where edicao_id=p_edicao_id and ativo;
  if v_qtd=0 then raise exception 'COMERCIAL_EDICAO_SEM_ITENS'; end if;

  perform set_config('app.comercial_publicacao','1',true);
  update public.tabelas_comerciais_edicoes
  set status='encerrada',vigencia_fim=case when vigencia_inicio<v_e.vigencia_inicio then v_e.vigencia_inicio-1 else vigencia_fim end
  where fonte_id=v_e.fonte_id and id<>v_e.id and status='vigente'
    and convenio_id is not distinct from v_e.convenio_id and vigencia_inicio<=v_e.vigencia_inicio;
  update public.tabelas_comerciais_edicoes set status='vigente',data_publicacao=current_date where id=p_edicao_id;
  return p_edicao_id;
end
$$;

revoke all on function public.comercial_publicar_edicao(uuid) from public,anon;
grant execute on function public.comercial_publicar_edicao(uuid) to authenticated;
