alter table public.contrato_tabelas_comerciais
  add column if not exists desvinculado_em timestamptz,
  add column if not exists desvinculado_por uuid,
  add column if not exists motivo_desvinculo text;

alter table public.contrato_depara_tuss
  add column if not exists origem_mapeamento text not null default 'manual',
  add column if not exists vinculo_id uuid,
  add column if not exists tabela_item_id uuid,
  add column if not exists sincronizado_em timestamptz;

alter table public.contrato_depara_tuss
  drop constraint if exists contrato_depara_tuss_origem_mapeamento_check;
alter table public.contrato_depara_tuss
  add constraint contrato_depara_tuss_origem_mapeamento_check
  check (origem_mapeamento in ('manual','automatico_tabela'));

alter table public.contrato_depara_tuss
  drop constraint if exists contrato_depara_tuss_vinculo_id_fkey;
alter table public.contrato_depara_tuss
  add constraint contrato_depara_tuss_vinculo_id_fkey
  foreign key (vinculo_id) references public.contrato_tabelas_comerciais(id) on delete set null;

alter table public.contrato_depara_tuss
  drop constraint if exists contrato_depara_tuss_tabela_item_id_fkey;
alter table public.contrato_depara_tuss
  add constraint contrato_depara_tuss_tabela_item_id_fkey
  foreign key (tabela_item_id) references public.tabelas_comerciais_itens(id) on delete set null;

create index if not exists idx_contrato_depara_tuss_vinculo_auto
  on public.contrato_depara_tuss(vinculo_id, origem_mapeamento, ativo);

create or replace function public.comercial_resolver_edicao_vinculo_internal(
  p_vinculo_id uuid,
  p_data date default current_date
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_v public.contrato_tabelas_comerciais%rowtype;
  v_c public.credenciamento_contratos%rowtype;
  v_edicao uuid;
begin
  select * into v_v from public.contrato_tabelas_comerciais where id=p_vinculo_id;
  if not found or not v_v.ativo then return null; end if;
  select * into v_c from public.credenciamento_contratos where id=v_v.contrato_id;

  if v_v.modo_edicao='edicao_fixa' then
    select e.id into v_edicao
      from public.tabelas_comerciais_edicoes e
     where e.id=v_v.edicao_fixa_id and e.fonte_id=v_v.fonte_id;
    return v_edicao;
  end if;

  select e.id into v_edicao
    from public.tabelas_comerciais_edicoes e
   where e.fonte_id=v_v.fonte_id
     and e.status='vigente'
     and e.vigencia_inicio<=coalesce(p_data,current_date)
     and (e.vigencia_fim is null or e.vigencia_fim>=coalesce(p_data,current_date))
     and (e.convenio_id is null or e.convenio_id=v_c.convenio_id)
   order by (e.convenio_id is not null) desc,e.vigencia_inicio desc,e.id
   limit 1;
  return v_edicao;
end;
$$;
revoke all on function public.comercial_resolver_edicao_vinculo_internal(uuid,date) from public,anon,authenticated;

create or replace function public.comercial_sincronizar_depara_vinculo_internal(
  p_vinculo_id uuid,
  p_data date default current_date
)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_v public.contrato_tabelas_comerciais%rowtype;
  v_c public.credenciamento_contratos%rowtype;
  v_e public.tabelas_comerciais_edicoes%rowtype;
  v_item record;
  v_id uuid;
  v_inicio date;
  v_fim date;
  v_count integer:=0;
begin
  select * into v_v from public.contrato_tabelas_comerciais where id=p_vinculo_id;
  if not found then return 0; end if;
  select * into v_c from public.credenciamento_contratos where id=v_v.contrato_id;

  if not v_v.ativo then
    update public.contrato_depara_tuss d
       set ativo=false,
           vigencia_fim=case when current_date<d.vigencia_inicio then d.vigencia_inicio else least(coalesce(d.vigencia_fim,current_date),current_date) end,
           updated_at=now(),updated_by=auth.uid(),sincronizado_em=now()
     where d.vinculo_id=p_vinculo_id and d.origem_mapeamento='automatico_tabela' and d.ativo;
    return 0;
  end if;

  select * into v_e from public.tabelas_comerciais_edicoes
   where id=public.comercial_resolver_edicao_vinculo_internal(p_vinculo_id,coalesce(p_data,current_date));
  if not found then return 0; end if;

  v_inicio:=greatest(coalesce(v_c.data_inicio,v_e.vigencia_inicio),v_e.vigencia_inicio);
  if v_c.data_fim is null then v_fim:=v_e.vigencia_fim;
  elsif v_e.vigencia_fim is null then v_fim:=v_c.data_fim;
  else v_fim:=least(v_c.data_fim,v_e.vigencia_fim); end if;
  if v_fim is not null and v_fim<v_inicio then return 0; end if;

  update public.contrato_depara_tuss d
     set ativo=false,updated_at=now(),updated_by=auth.uid(),sincronizado_em=now()
   where d.vinculo_id=p_vinculo_id and d.origem_mapeamento='automatico_tabela' and d.ativo;

  for v_item in
    select i.id,i.codigo,i.descricao,i.codigo_tuss,i.tabela_tiss_codigo
      from public.tabelas_comerciais_itens i
     where i.edicao_id=v_e.id and i.ativo
       and nullif(btrim(i.codigo),'') is not null
       and nullif(btrim(i.codigo_tuss),'') is not null
  loop
    if exists(
      select 1 from public.contrato_depara_tuss d
       where d.contrato_id=v_v.contrato_id and d.fonte_id=v_v.fonte_id
         and d.codigo_origem=btrim(v_item.codigo) and d.ativo
         and d.origem_mapeamento='manual'
         and d.vigencia_inicio<=coalesce(v_fim,'infinity'::date)
         and coalesce(d.vigencia_fim,'infinity'::date)>=v_inicio
    ) then continue; end if;

    select d.id into v_id
      from public.contrato_depara_tuss d
     where d.vinculo_id=p_vinculo_id
       and d.origem_mapeamento='automatico_tabela'
       and d.codigo_origem=btrim(v_item.codigo)
     order by d.updated_at desc,d.id limit 1;

    if v_id is null then
      insert into public.contrato_depara_tuss(
        contrato_id,fonte_id,codigo_origem,descricao_origem,codigo_tuss,descricao_tuss,
        tabela_tiss_codigo,vigencia_inicio,vigencia_fim,ativo,observacoes,created_by,updated_by,
        origem_mapeamento,vinculo_id,tabela_item_id,sincronizado_em
      ) values (
        v_v.contrato_id,v_v.fonte_id,btrim(v_item.codigo),nullif(btrim(v_item.descricao),''),
        btrim(v_item.codigo_tuss),nullif(btrim(v_item.descricao),''),nullif(btrim(v_item.tabela_tiss_codigo),''),
        v_inicio,v_fim,true,'Gerado automaticamente a partir do codigo_tuss explícito do item da tabela comercial.',
        auth.uid(),auth.uid(),'automatico_tabela',p_vinculo_id,v_item.id,now()
      ) returning id into v_id;
    else
      update public.contrato_depara_tuss d set
        codigo_tuss=btrim(v_item.codigo_tuss),
        descricao_origem=nullif(btrim(v_item.descricao),''),
        descricao_tuss=nullif(btrim(v_item.descricao),''),
        tabela_tiss_codigo=nullif(btrim(v_item.tabela_tiss_codigo),''),
        vigencia_inicio=v_inicio,vigencia_fim=v_fim,ativo=true,tabela_item_id=v_item.id,
        updated_at=now(),updated_by=auth.uid(),sincronizado_em=now()
      where d.id=v_id;
    end if;
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.comercial_sincronizar_depara_vinculo_internal(uuid,date) from public,anon,authenticated;

create or replace function public.comercial_normalizar_vinculo_before()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.ativo then
    new.desvinculado_em:=null;
    new.desvinculado_por:=null;
    new.motivo_desvinculo:=null;
  end if;
  return new;
end;
$$;
revoke all on function public.comercial_normalizar_vinculo_before() from public,anon,authenticated;
drop trigger if exists trg_comercial_normalizar_vinculo on public.contrato_tabelas_comerciais;
create trigger trg_comercial_normalizar_vinculo
before insert or update on public.contrato_tabelas_comerciais
for each row execute function public.comercial_normalizar_vinculo_before();

create or replace function public.comercial_sync_vinculo_after_mutation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not new.ativo then
    update public.contrato_regras_faturamento r set ativo=false
     where r.condicoes->>'origem_vinculo_tabela_id'=new.id::text and r.ativo;
    perform public.comercial_sincronizar_depara_vinculo_internal(new.id,current_date);
    return new;
  end if;
  if tg_op='INSERT'
     or old.ativo is distinct from new.ativo
     or old.modo_edicao is distinct from new.modo_edicao
     or old.edicao_fixa_id is distinct from new.edicao_fixa_id then
    perform public.comercial_sincronizar_depara_vinculo_internal(new.id,current_date);
  end if;
  return new;
end;
$$;
revoke all on function public.comercial_sync_vinculo_after_mutation() from public,anon,authenticated;
drop trigger if exists trg_comercial_sync_vinculo on public.contrato_tabelas_comerciais;
create trigger trg_comercial_sync_vinculo
after insert or update on public.contrato_tabelas_comerciais
for each row execute function public.comercial_sync_vinculo_after_mutation();

create or replace function public.comercial_desvincular_tabela(p_vinculo_id uuid,p_motivo text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_v public.contrato_tabelas_comerciais%rowtype;
  v_c public.credenciamento_contratos%rowtype;
begin
  if auth.uid() is null then raise exception 'COMERCIAL_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_v from public.contrato_tabelas_comerciais where id=p_vinculo_id for update;
  if not found then raise exception 'COMERCIAL_VINCULO_NAO_LOCALIZADO'; end if;
  select * into v_c from public.credenciamento_contratos where id=v_v.contrato_id;
  if not (public.comercial_pode_editar(v_c.empresa_id,v_c.unidade_id) or public.tabelas_comerciais_pode_editar(v_c.empresa_id,v_c.unidade_id)) then
    raise exception 'COMERCIAL_SEM_PERMISSAO_EDITAR' using errcode='42501';
  end if;
  if nullif(btrim(p_motivo),'') is null then raise exception 'COMERCIAL_MOTIVO_DESVINCULO_OBRIGATORIO'; end if;
  update public.contrato_tabelas_comerciais
     set ativo=false,desvinculado_em=now(),desvinculado_por=auth.uid(),motivo_desvinculo=btrim(p_motivo)
   where id=p_vinculo_id;
  return p_vinculo_id;
end;
$$;
revoke all on function public.comercial_desvincular_tabela(uuid,text) from public,anon;
grant execute on function public.comercial_desvincular_tabela(uuid,text) to authenticated;

create or replace function public.comercial_sincronizar_depara_vinculo(p_vinculo_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare
  v_v public.contrato_tabelas_comerciais%rowtype;
  v_c public.credenciamento_contratos%rowtype;
begin
  if auth.uid() is null then raise exception 'COMERCIAL_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_v from public.contrato_tabelas_comerciais where id=p_vinculo_id;
  if not found then raise exception 'COMERCIAL_VINCULO_NAO_LOCALIZADO'; end if;
  select * into v_c from public.credenciamento_contratos where id=v_v.contrato_id;
  if not (public.comercial_pode_editar(v_c.empresa_id,v_c.unidade_id) or public.tabelas_comerciais_pode_editar(v_c.empresa_id,v_c.unidade_id)) then
    raise exception 'COMERCIAL_SEM_PERMISSAO_EDITAR' using errcode='42501';
  end if;
  return public.comercial_sincronizar_depara_vinculo_internal(p_vinculo_id,current_date);
end;
$$;
revoke all on function public.comercial_sincronizar_depara_vinculo(uuid) from public,anon;
grant execute on function public.comercial_sincronizar_depara_vinculo(uuid) to authenticated;

create or replace function public.comercial_salvar_depara_tuss(
  p_id uuid,p_contrato_id uuid,p_fonte_id uuid,p_codigo_origem text,p_descricao_origem text,p_codigo_tuss text,p_descricao_tuss text,
  p_tabela_tiss_codigo text,p_vigencia_inicio date,p_vigencia_fim date,p_ativo boolean,p_observacoes text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_empresa uuid; v_unidade uuid; v_id uuid;
  v_codigo_origem text:=nullif(btrim(p_codigo_origem),'');
  v_codigo_tuss text:=nullif(btrim(p_codigo_tuss),'');
  v_tabela text:=nullif(btrim(p_tabela_tiss_codigo),'');
begin
  if auth.uid() is null then raise exception 'COMERCIAL_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select c.empresa_id,c.unidade_id into v_empresa,v_unidade
    from public.credenciamento_contratos c where c.id=p_contrato_id;
  if not found then raise exception 'Contrato comercial não encontrado.'; end if;
  if not public.comercial_pode_editar(v_empresa,v_unidade) then raise exception 'Usuário sem permissão para editar este contrato.'; end if;
  if not exists(select 1 from public.tabelas_comerciais_fontes f where f.id=p_fonte_id and f.empresa_id=v_empresa and f.ativo) then raise exception 'Fonte comercial inválida para a empresa do contrato.'; end if;
  if not exists(select 1 from public.contrato_tabelas_comerciais v where v.contrato_id=p_contrato_id and v.fonte_id=p_fonte_id and v.ativo) then raise exception 'A fonte precisa estar vinculada e ativa no contrato antes do DePara.'; end if;
  if v_codigo_origem is null or v_codigo_tuss is null then raise exception 'Código de origem e código TUSS são obrigatórios.'; end if;
  if p_vigencia_inicio is null then raise exception 'A vigência inicial do DePara é obrigatória.'; end if;
  if p_vigencia_fim is not null and p_vigencia_fim<p_vigencia_inicio then raise exception 'Vigência final anterior à vigência inicial.'; end if;
  if v_tabela is not null and v_tabela!~'^[0-9]{2}$' then raise exception 'Tabela TISS deve possuir dois dígitos.'; end if;
  if p_id is not null and not exists(select 1 from public.contrato_depara_tuss d where d.id=p_id and d.contrato_id=p_contrato_id) then raise exception 'DePara não pertence ao contrato informado.'; end if;
  if coalesce(p_ativo,true) and exists(
    select 1 from public.contrato_depara_tuss d
     where d.contrato_id=p_contrato_id and d.fonte_id=p_fonte_id and d.codigo_origem=v_codigo_origem and d.ativo
       and (p_id is null or d.id<>p_id)
       and d.vigencia_inicio<=coalesce(p_vigencia_fim,'infinity'::date)
       and coalesce(d.vigencia_fim,'infinity'::date)>=p_vigencia_inicio
  ) then raise exception 'Já existe DePara ativo para este código/fonte com vigência sobreposta.'; end if;

  if p_id is null then
    insert into public.contrato_depara_tuss(
      contrato_id,fonte_id,codigo_origem,descricao_origem,codigo_tuss,descricao_tuss,tabela_tiss_codigo,
      vigencia_inicio,vigencia_fim,ativo,observacoes,created_by,updated_by,origem_mapeamento,vinculo_id,tabela_item_id,sincronizado_em
    ) values (
      p_contrato_id,p_fonte_id,v_codigo_origem,nullif(btrim(p_descricao_origem),''),v_codigo_tuss,
      nullif(btrim(p_descricao_tuss),''),v_tabela,p_vigencia_inicio,p_vigencia_fim,coalesce(p_ativo,true),
      nullif(btrim(p_observacoes),''),auth.uid(),auth.uid(),'manual',null,null,null
    ) returning id into v_id;
  else
    update public.contrato_depara_tuss d set
      fonte_id=p_fonte_id,codigo_origem=v_codigo_origem,descricao_origem=nullif(btrim(p_descricao_origem),''),
      codigo_tuss=v_codigo_tuss,descricao_tuss=nullif(btrim(p_descricao_tuss),''),tabela_tiss_codigo=v_tabela,
      vigencia_inicio=p_vigencia_inicio,vigencia_fim=p_vigencia_fim,ativo=coalesce(p_ativo,true),
      observacoes=nullif(btrim(p_observacoes),''),updated_at=now(),updated_by=auth.uid(),
      origem_mapeamento='manual',vinculo_id=null,tabela_item_id=null,sincronizado_em=null
    where d.id=p_id returning d.id into v_id;
  end if;
  return v_id;
end;
$$;
revoke all on function public.comercial_salvar_depara_tuss(uuid,uuid,uuid,text,text,text,text,text,date,date,boolean,text) from public,anon;
grant execute on function public.comercial_salvar_depara_tuss(uuid,uuid,uuid,text,text,text,text,text,date,date,boolean,text) to authenticated;
