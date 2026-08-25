-- Prescrições compostas: solução/base + medicamentos aditivos na mesma administração.
create table if not exists public.prescricao_componentes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
  prescricao_id uuid not null references public.prescricoes(id) on delete cascade,
  item_assistencial_id uuid not null references public.itens_assistenciais(id) on delete restrict,
  papel text not null default 'aditivo' check (papel in ('base','aditivo')),
  dose text,
  quantidade numeric(14,4),
  unidade_dose text,
  ordem smallint not null default 1,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (prescricao_id,item_assistencial_id,papel)
);
create index if not exists ix_prescricao_componentes_prescricao on public.prescricao_componentes(prescricao_id,ordem);
create index if not exists ix_prescricao_componentes_atendimento on public.prescricao_componentes(atendimento_id,created_at desc);
alter table public.prescricao_componentes enable row level security;
drop policy if exists prescricao_componentes_select on public.prescricao_componentes;
create policy prescricao_componentes_select on public.prescricao_componentes for select to authenticated using (public.tem_permissao(empresa_id,unidade_id,'prescricao.visualizar'));
drop policy if exists prescricao_componentes_insert on public.prescricao_componentes;
create policy prescricao_componentes_insert on public.prescricao_componentes for insert to authenticated with check (public.tem_permissao(empresa_id,unidade_id,'prescricao.criar'));
drop policy if exists prescricao_componentes_update on public.prescricao_componentes;
create policy prescricao_componentes_update on public.prescricao_componentes for update to authenticated using (public.tem_permissao(empresa_id,unidade_id,'prescricao.criar')) with check (public.tem_permissao(empresa_id,unidade_id,'prescricao.criar'));
grant select,insert,update on public.prescricao_componentes to authenticated;
revoke delete on public.prescricao_componentes from anon,authenticated;

create or replace function public.validar_regras_seguranca_componente_prescricao()
returns trigger language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_item record;v_prescricao record;v_regra record;v_administracoes integer;v_principio text;v_descricao text;
begin
 select p.frequencia,p.horarios,p.via,p.empresa_id into v_prescricao from public.prescricoes p where p.id=new.prescricao_id and p.empresa_id=new.empresa_id;
 if not found then raise exception using errcode='P0001',message='REGRA_PRESCRICAO: prescrição principal não encontrada.';end if;
 select ia.principio_ativo,ia.descricao,ia.apresentacao into v_item from public.itens_assistenciais ia where ia.id=new.item_assistencial_id and ia.empresa_id=new.empresa_id and ia.ativo=true and ia.categoria='medicamento';
 if not found then raise exception using errcode='P0001',message='REGRA_PRESCRICAO: componente não é medicamento ativo do catálogo.';end if;
 v_principio:=lower(extensions.unaccent(coalesce(v_item.principio_ativo,v_item.descricao,'')));v_descricao:=lower(extensions.unaccent(coalesce(v_item.descricao,'')));
 v_administracoes:=public.prescricao_administracoes_planejadas(v_prescricao.frequencia,case when jsonb_typeof(coalesce(v_prescricao.horarios,'[]'::jsonb))='array' then array(select jsonb_array_elements_text(coalesce(v_prescricao.horarios,'[]'::jsonb))) else array[]::text[] end);
 for v_regra in select r.* from public.prescricao_regras_seguranca r where r.ativo=true and (r.empresa_id is null or r.empresa_id=new.empresa_id) and (r.vigencia_inicio is null or r.vigencia_inicio<=current_date) and (r.vigencia_fim is null or r.vigencia_fim>=current_date) and (v_principio like '%'||lower(extensions.unaccent(r.principio_ativo_match))||'%' or v_descricao like '%'||lower(extensions.unaccent(r.principio_ativo_match))||'%') and (r.apresentacao_match is null or lower(extensions.unaccent(coalesce(v_item.apresentacao,''))) like '%'||lower(extensions.unaccent(r.apresentacao_match))||'%') and (r.via_match is null or lower(extensions.unaccent(coalesce(v_prescricao.via,''))) like '%'||lower(extensions.unaccent(r.via_match))||'%') order by case when r.empresa_id is not null then 0 else 1 end,r.created_at desc loop
  if v_regra.max_administracoes_24h is not null and v_administracoes>v_regra.max_administracoes_24h and v_regra.severidade='bloqueante' then raise exception using errcode='P0001',message='REGRA_PRESCRICAO: '||v_regra.mensagem,detail=coalesce(v_regra.fonte_referencia,v_regra.fonte_tipo),hint=coalesce(v_regra.fonte_url,'Revise a regra clínica cadastrada.');end if;
 end loop;return new;
end;$$;
drop trigger if exists trg_validar_regras_componente_prescricao on public.prescricao_componentes;
create trigger trg_validar_regras_componente_prescricao before insert or update of item_assistencial_id,dose,quantidade,unidade_dose on public.prescricao_componentes for each row execute function public.validar_regras_seguranca_componente_prescricao();
revoke all on function public.validar_regras_seguranca_componente_prescricao() from public,anon,authenticated;
