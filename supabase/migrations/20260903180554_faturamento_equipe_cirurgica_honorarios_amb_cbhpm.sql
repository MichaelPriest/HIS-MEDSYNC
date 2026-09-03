create or replace function public.faturamento_amb_porte_anestesico_ch(p_porte text)
returns numeric language sql immutable set search_path to '' as $$
  select case regexp_replace(coalesce(p_porte,''),'[^0-9]','','g')
    when '1' then 70::numeric when '2' then 110::numeric when '3' then 170::numeric
    when '4' then 250::numeric when '5' then 380::numeric when '6' then 550::numeric
    when '7' then 780::numeric else null::numeric end
$$;

create or replace function public.centro_cirurgico_requisitos_equipe_item(p_tabela_item_id uuid, p_descricao text default null)
returns jsonb language plpgsql security definer set search_path to 'public','pg_catalog' as $$
declare
  v_item public.tabelas_comerciais_itens%rowtype; v_desc text:=lower(coalesce(p_descricao,''));
  v_aux integer:=0; v_ch_anest numeric:=0; v_anestesista boolean:=false; v_instrumentador boolean:=true;
  v_pediatra boolean:=false; v_neonatal boolean:=false;
begin
  if p_tabela_item_id is not null then
    select * into v_item from public.tabelas_comerciais_itens where id=p_tabela_item_id;
    if found then
      v_desc:=lower(coalesce(v_item.descricao,p_descricao,''));
      v_aux:=greatest(0,least(8,coalesce(v_item.quantidade_auxiliares::integer,
        case when coalesce(v_item.metadata->>'quantidade_aux','')~'^[0-9]+$' then (v_item.metadata->>'quantidade_aux')::integer end,0)));
      v_ch_anest:=coalesce(v_item.ch_anestesista,
        case when coalesce(v_item.metadata->>'ch_anestesista','')~'^[0-9]+([.][0-9]+)?$' then (v_item.metadata->>'ch_anestesista')::numeric end,0);
      v_anestesista:=v_ch_anest>0 or nullif(btrim(v_item.porte_anestesico),'') is not null;
      if v_item.metadata?'instrumentador' then v_instrumentador:=lower(coalesce(v_item.metadata->>'instrumentador','false')) in ('true','t','1','yes','on'); end if;
      v_pediatra:=lower(coalesce(v_item.metadata->>'pediatra_sala',v_item.metadata->>'pediatra','false')) in ('true','t','1','yes','on');
      v_neonatal:=lower(coalesce(v_item.metadata->>'neonatologista',v_item.metadata->>'neonatal','false')) in ('true','t','1','yes','on');
    end if;
  end if;
  if v_desc like '%pediatra%' or v_desc like '%recem-nascid%' or v_desc like '%recém-nascid%' then v_pediatra:=true; end if;
  if v_desc like '%neonatal%' or v_desc like '%neonatolog%' then v_neonatal:=true; end if;
  return jsonb_build_object('quantidade_auxiliares',v_aux,'anestesista',v_anestesista,'ch_anestesista',v_ch_anest,
    'instrumentador',v_instrumentador,'pediatra',v_pediatra,'neonatologista',v_neonatal,'permite_outros',true);
end $$;

update public.cirurgia_procedimentos p set
  requisitos_equipe=coalesce(p.requisitos_equipe,'{}'::jsonb)||public.centro_cirurgico_requisitos_equipe_item(p.tabela_item_id,p.descricao),updated_at=now()
where p.tabela_item_id is not null;

create table if not exists public.faturamento_equipe_cirurgica(
  id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id), unidade_id uuid not null references public.unidades(id),
  conta_id uuid not null references public.contas_faturamento(id) on delete cascade, cirurgia_id uuid not null references public.cirurgias(id),
  cirurgia_procedimento_id uuid not null references public.cirurgia_procedimentos(id), cirurgia_equipe_id uuid not null references public.cirurgia_equipe(id),
  profissional_id uuid not null references public.profissionais(id), tabela_item_id uuid null references public.tabelas_comerciais_itens(id), papel text not null,
  ordem_participacao integer null, fonte_codigo text null, fonte_tipo text null, porte_anestesico text null, quantidade_auxiliares_regra integer not null default 0,
  percentual_honorario numeric(10,4) null, ch_anestesista numeric(14,4) null, valor_ch numeric(14,6) null, valor_base_procedimento numeric(14,2) null,
  valor_calculado numeric(14,2) null, cobrar_regra boolean not null default false, cobrar boolean not null default false, repasse boolean not null default false,
  ajuste_manual boolean not null default false, justificativa_ajuste text null, status_calculo text not null default 'pendente', origem_regra text not null default 'tabela_contratual',
  memoria_calculo jsonb not null default '{}'::jsonb, ativo boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id), updated_by uuid null references auth.users(id),
  constraint faturamento_equipe_cirurgica_aux_ordem_check check(ordem_participacao is null or ordem_participacao between 1 and 4),
  constraint faturamento_equipe_cirurgica_valor_check check(valor_calculado is null or valor_calculado>=0),
  constraint faturamento_equipe_cirurgica_unique unique(conta_id,cirurgia_equipe_id)
);
create index if not exists faturamento_equipe_cirurgica_conta_idx on public.faturamento_equipe_cirurgica(conta_id,cirurgia_procedimento_id,ativo);
create index if not exists faturamento_equipe_cirurgica_prof_idx on public.faturamento_equipe_cirurgica(profissional_id,created_at desc);
alter table public.faturamento_equipe_cirurgica enable row level security;
alter table public.faturamento_equipe_cirurgica force row level security;
drop policy if exists faturamento_equipe_cirurgica_select on public.faturamento_equipe_cirurgica;
create policy faturamento_equipe_cirurgica_select on public.faturamento_equipe_cirurgica for select to authenticated using(
  public.tem_unidade(empresa_id,unidade_id) and (
    public.tem_permissao(empresa_id,unidade_id,'faturamento.visualizar') or public.tem_permissao(empresa_id,unidade_id,'faturamento.criar') or public.tem_permissao(empresa_id,unidade_id,'auditoria.visualizar')));
revoke insert,update,delete on public.faturamento_equipe_cirurgica from authenticated,anon;
grant select on public.faturamento_equipe_cirurgica to authenticated;

create or replace function public.faturamento_sincronizar_equipe_cirurgica(p_conta_id uuid,p_cirurgia_procedimento_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_catalog','extensions' as $$
declare
  v_user uuid:=auth.uid(); v_conta public.contas_faturamento%rowtype; v_proc public.cirurgia_procedimentos%rowtype;
  v_item public.tabelas_comerciais_itens%rowtype; v_edicao public.tabelas_comerciais_edicoes%rowtype; v_fonte public.tabelas_comerciais_fontes%rowtype;
  v_contrato public.credenciamento_contratos%rowtype; v_vinculo public.contrato_tabelas_comerciais%rowtype; v_preco record; v_membro record; v_snap_id uuid;
  v_req jsonb; v_aux_req integer:=0; v_base numeric:=null; v_anest numeric:=null; v_ch_anest numeric:=null; v_pct numeric:=null; v_valor numeric:=null;
  v_status text; v_origem text; v_cobrar_regra boolean; v_cobrar boolean; v_role_label text; v_bruto numeric:=0; v_count integer:=0; v_unresolved integer:=0;
  v_metodo_9699 text; v_porte text;
begin
  if v_user is null then raise exception 'FAT_EQUIPE_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  select * into v_conta from public.contas_faturamento where id=p_conta_id for update;
  if not found then raise exception 'FAT_EQUIPE_CONTA_NAO_LOCALIZADA'; end if;
  if not public.tem_unidade(v_conta.empresa_id,v_conta.unidade_id) or not public.tem_permissao(v_conta.empresa_id,v_conta.unidade_id,'faturamento.criar') then raise exception 'FAT_EQUIPE_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_conta.status in ('faturada','cancelada') then raise exception 'FAT_EQUIPE_CONTA_NAO_EDITAVEL'; end if;
  if exists(select 1 from public.tiss_guias g where g.conta_id=p_conta_id and g.status<>'cancelada') then raise exception 'FAT_EQUIPE_GUIA_TISS_ATIVA'; end if;
  select * into v_proc from public.cirurgia_procedimentos where id=p_cirurgia_procedimento_id;
  if not found or v_proc.atendimento_id<>v_conta.atendimento_id then raise exception 'FAT_EQUIPE_PROCEDIMENTO_INCOMPATIVEL'; end if;
  if v_proc.tabela_item_id is null then raise exception 'FAT_EQUIPE_PROCEDIMENTO_SEM_ITEM_TABELA'; end if;
  select * into v_item from public.tabelas_comerciais_itens where id=v_proc.tabela_item_id and ativo;
  if not found then raise exception 'FAT_EQUIPE_ITEM_TABELA_NAO_LOCALIZADO'; end if;
  select * into v_edicao from public.tabelas_comerciais_edicoes where id=v_item.edicao_id;
  select * into v_fonte from public.tabelas_comerciais_fontes where id=v_edicao.fonte_id;
  if v_proc.contrato_id is not null then select * into v_contrato from public.credenciamento_contratos where id=v_proc.contrato_id and status='ativo'; end if;
  if v_contrato.id is null then
    select * into v_contrato from public.credenciamento_contratos c where c.empresa_id=v_conta.empresa_id and c.convenio_id=v_conta.convenio_id and c.status='ativo'
      and(c.plano_id is null or c.plano_id=v_conta.plano_id) and(c.unidade_id is null or c.unidade_id=v_conta.unidade_id)
      and(c.data_inicio is null or c.data_inicio<=coalesce(v_proc.inicio_em::date,current_date)) and(c.data_fim is null or c.data_fim>=coalesce(v_proc.inicio_em::date,current_date))
      order by((c.plano_id is not null)::int*2+(c.unidade_id is not null)::int) desc,c.data_inicio desc nulls last,c.created_at desc limit 1;
  end if;
  if v_contrato.id is null then raise exception 'FAT_EQUIPE_CONTRATO_NAO_LOCALIZADO'; end if;
  select * into v_vinculo from public.contrato_tabelas_comerciais v where v.contrato_id=v_contrato.id and v.fonte_id=v_fonte.id and v.ativo
    order by case when v.categoria in('cirurgias','honorarios') then 0 when v.categoria='geral' then 1 else 2 end,v.prioridade,v.id limit 1;
  if v_vinculo.id is null then raise exception 'FAT_EQUIPE_TABELA_NAO_VINCULADA_AO_CONTRATO'; end if;
  v_req:=public.centro_cirurgico_requisitos_equipe_item(v_item.id,v_proc.descricao);
  v_aux_req:=greatest(0,least(4,coalesce((v_req->>'quantidade_auxiliares')::integer,0)));
  update public.cirurgia_procedimentos set requisitos_equipe=coalesce(requisitos_equipe,'{}'::jsonb)||v_req,porte=coalesce(porte,v_item.porte),porte_anestesico=coalesce(porte_anestesico,v_item.porte_anestesico),updated_at=now() where id=v_proc.id;
  v_metodo_9699:=lower(coalesce(v_vinculo.regras_adicionais->>'amb96_99_metodo',''));
  if v_fonte.tipo in('amb90','amb92') then
    if v_vinculo.valor_ch is not null and coalesce(v_item.pontos_ch,0)>0 then v_base:=round(v_item.pontos_ch*v_vinculo.valor_ch*(1+coalesce(v_vinculo.percentual_ajuste,0)/100.0),2); end if;
  elsif v_fonte.tipo in('amb96','amb99') then
    if v_metodo_9699='conversao_ch' and v_vinculo.valor_ch is not null and coalesce(v_item.pontos_ch,0)>0 then v_base:=round(v_item.pontos_ch*v_vinculo.valor_ch*(1+coalesce(v_vinculo.percentual_ajuste,0)/100.0),2);
    elsif v_metodo_9699='valor_tabela_reajustado' and v_item.valor_referencia is not null then v_base:=round(v_item.valor_referencia*(1+coalesce(v_vinculo.percentual_ajuste,0)/100.0),2); end if;
  else
    select * into v_preco from public.obter_valor_item_comercial_tuss_contextual_internal(v_conta.convenio_id,v_conta.plano_id,v_conta.unidade_id,v_item.item_assistencial_id,coalesce(v_proc.codigo,v_item.codigo),coalesce(v_proc.inicio_em::date,current_date),'cirurgias') limit 1; v_base:=v_preco.valor;
  end if;
  v_porte:=coalesce(nullif(btrim(v_proc.porte_anestesico),''),nullif(btrim(v_item.porte_anestesico),''));
  if v_fonte.tipo in('amb90','amb92') then
    v_ch_anest:=case when coalesce(v_item.ch_anestesista,0)>0 then v_item.ch_anestesista else public.faturamento_amb_porte_anestesico_ch(v_porte) end;
    if coalesce(v_ch_anest,0)>0 and v_vinculo.valor_ch is not null then v_anest:=round(v_ch_anest*v_vinculo.valor_ch*(1+coalesce(v_vinculo.percentual_ajuste,0)/100.0),2); end if;
  elsif v_fonte.tipo in('amb96','amb99') then
    if v_metodo_9699='conversao_ch' and coalesce(v_item.ch_anestesista,0)>0 and v_vinculo.valor_ch is not null then v_ch_anest:=v_item.ch_anestesista;v_anest:=round(v_ch_anest*v_vinculo.valor_ch*(1+coalesce(v_vinculo.percentual_ajuste,0)/100.0),2);
    elsif v_metodo_9699='valor_tabela_reajustado' and v_porte is not null and coalesce(v_vinculo.regras_adicionais->'valores_porte_anestesico'->>v_porte,'')~'^-?[0-9]+([.,][0-9]+)?$' then v_anest:=round(replace(v_vinculo.regras_adicionais->'valores_porte_anestesico'->>v_porte,',','.')::numeric*(1+coalesce(v_vinculo.percentual_ajuste,0)/100.0),2); end if;
  else
    select * into v_preco from public.obter_valor_item_comercial_tuss_contextual_internal(v_conta.convenio_id,v_conta.plano_id,v_conta.unidade_id,v_item.item_assistencial_id,coalesce(v_proc.codigo,v_item.codigo),coalesce(v_proc.inicio_em::date,current_date),'anestesia') limit 1;v_anest:=v_preco.valor;
  end if;
  for v_membro in select ce.*,p.nome_completo from public.cirurgia_equipe ce join public.profissionais p on p.id=ce.profissional_id where ce.cirurgia_procedimento_id=v_proc.id
    order by case ce.papel when 'cirurgiao_principal' then 0 when 'cirurgiao_auxiliar' then 1 when 'anestesista' then 2 when 'instrumentador' then 3 else 9 end,ce.ordem_participacao nulls first,ce.created_at,ce.id loop
    v_count:=v_count+1;v_pct:=null;v_valor:=null;v_status:='calculado';v_origem:='regra_equipe_percentual';v_cobrar_regra:=false;
    if v_membro.papel='cirurgiao_principal' then v_pct:=100;v_valor:=v_base;v_cobrar_regra:=v_base is not null;
    elsif v_membro.papel='cirurgiao_auxiliar' then
      if coalesce(v_membro.ordem_participacao,0)=1 then v_pct:=30; elsif coalesce(v_membro.ordem_participacao,0) between 2 and 4 then v_pct:=20; end if;
      if v_membro.ordem_participacao is null or v_membro.ordem_participacao>v_aux_req then v_status:='fora_quantidade_auxiliares_tabela';v_cobrar_regra:=false;
      elsif v_base is null then v_status:='sem_base_procedimento';v_cobrar_regra:=false; else v_valor:=round(v_base*v_pct/100.0,2);v_cobrar_regra:=true; end if;
    elsif v_membro.papel='instrumentador' then v_pct:=10;if coalesce((v_req->>'instrumentador')::boolean,true) and v_base is not null then v_valor:=round(v_base*0.10,2);v_cobrar_regra:=true;else v_status:='instrumentador_nao_previsto_ou_sem_base';end if;
    elsif v_membro.papel='anestesista' then v_origem:=case when v_fonte.tipo in('amb90','amb92') then 'amb_ch_anestesista' when v_fonte.tipo in('amb96','amb99') then 'amb96_99_contrato' else 'porte_anestesico_contratual' end;v_valor:=v_anest;if coalesce((v_req->>'anestesista')::boolean,false) and v_anest is not null then v_cobrar_regra:=true;else v_status:='anestesia_sem_configuracao_contratual';end if;
    else v_status:='papel_sem_regra_cobranca'; end if;
    if v_valor is null and v_status='calculado' then v_status:='sem_base_procedimento';end if;if v_status<>'calculado' then v_unresolved:=v_unresolved+1;end if;
    select id,cobrar into v_snap_id,v_cobrar from public.faturamento_equipe_cirurgica where conta_id=v_conta.id and cirurgia_equipe_id=v_membro.id;
    if v_snap_id is null then
      insert into public.faturamento_equipe_cirurgica(empresa_id,unidade_id,conta_id,cirurgia_id,cirurgia_procedimento_id,cirurgia_equipe_id,profissional_id,tabela_item_id,papel,ordem_participacao,fonte_codigo,fonte_tipo,porte_anestesico,quantidade_auxiliares_regra,percentual_honorario,ch_anestesista,valor_ch,valor_base_procedimento,valor_calculado,cobrar_regra,cobrar,repasse,status_calculo,origem_regra,memoria_calculo,created_by,updated_by)
      values(v_conta.empresa_id,v_conta.unidade_id,v_conta.id,v_proc.cirurgia_id,v_proc.id,v_membro.id,v_membro.profissional_id,v_item.id,v_membro.papel,v_membro.ordem_participacao,v_fonte.codigo,v_fonte.tipo,v_porte,v_aux_req,v_pct,v_ch_anest,v_vinculo.valor_ch,v_base,v_valor,v_cobrar_regra,v_cobrar_regra,false,v_status,v_origem,jsonb_build_object('procedimento_codigo',v_proc.codigo,'procedimento',v_proc.descricao,'pontos_ch',v_item.pontos_ch,'ch_anestesista_item',v_item.ch_anestesista,'porte_anestesico',v_porte,'amb96_99_metodo',nullif(v_metodo_9699,''),'vinculo_id',v_vinculo.id,'contrato_id',v_contrato.id),v_user,v_user) returning id,cobrar into v_snap_id,v_cobrar;
    else
      update public.faturamento_equipe_cirurgica set profissional_id=v_membro.profissional_id,tabela_item_id=v_item.id,papel=v_membro.papel,ordem_participacao=v_membro.ordem_participacao,fonte_codigo=v_fonte.codigo,fonte_tipo=v_fonte.tipo,porte_anestesico=v_porte,quantidade_auxiliares_regra=v_aux_req,percentual_honorario=v_pct,ch_anestesista=v_ch_anest,valor_ch=v_vinculo.valor_ch,valor_base_procedimento=v_base,valor_calculado=v_valor,cobrar_regra=v_cobrar_regra,cobrar=case when ajuste_manual then cobrar else v_cobrar_regra end,status_calculo=v_status,origem_regra=v_origem,memoria_calculo=jsonb_build_object('procedimento_codigo',v_proc.codigo,'procedimento',v_proc.descricao,'pontos_ch',v_item.pontos_ch,'ch_anestesista_item',v_item.ch_anestesista,'porte_anestesico',v_porte,'amb96_99_metodo',nullif(v_metodo_9699,''),'vinculo_id',v_vinculo.id,'contrato_id',v_contrato.id),ativo=true,updated_at=now(),updated_by=v_user where id=v_snap_id returning cobrar into v_cobrar;
    end if;
    if v_valor is not null then
      v_role_label:=case v_membro.papel when 'cirurgiao_principal' then 'Cirurgião' when 'cirurgiao_auxiliar' then concat(v_membro.ordem_participacao,'º auxiliar') when 'anestesista' then 'Anestesista' when 'instrumentador' then 'Instrumentador' else initcap(replace(v_membro.papel,'_',' ')) end;
      insert into public.conta_faturamento_itens(conta_id,origem_tipo,origem_id,data_execucao,tabela,codigo,descricao,quantidade,valor_unitario,percentual_reducao_acrescimo,valor_total,profissional_id,setor,cobravel,observacao,tabela_comercial_edicao_id,tabela_comercial_item_id,valor_referencia,valor_contratual_calculado,origem_valor,metodologia_preco,memoria_calculo,memoria_calculo_comercial,categoria_item,subgrupo_item)
      values(v_conta.id,'honorario',v_snap_id,coalesce(v_proc.fim_em,v_proc.inicio_em,now()),v_fonte.codigo,coalesce(v_proc.codigo,v_item.codigo),concat(v_role_label,' · ',v_proc.descricao),1,v_valor,0,v_valor,v_membro.profissional_id,'Centro Cirúrgico',coalesce(v_cobrar,false) and v_status='calculado',concat('Equipe cirúrgica · ',v_origem),v_edicao.id,v_item.id,coalesce(v_base,v_valor),v_valor,concat(v_fonte.codigo,' · equipe cirúrgica'),v_origem,jsonb_build_object('equipe_faturamento_id',v_snap_id,'papel',v_membro.papel,'ordem',v_membro.ordem_participacao,'percentual',v_pct,'ch_anestesista',v_ch_anest,'regra',v_origem),jsonb_build_object('equipe_faturamento_id',v_snap_id,'fonte',v_fonte.codigo,'edicao',v_edicao.nome_edicao,'contrato_id',v_contrato.id,'vinculo_id',v_vinculo.id),'procedimento','Honorários')
      on conflict(conta_id,origem_tipo,origem_id) do update set data_execucao=excluded.data_execucao,tabela=excluded.tabela,codigo=excluded.codigo,descricao=excluded.descricao,quantidade=1,valor_unitario=excluded.valor_unitario,percentual_reducao_acrescimo=0,valor_total=excluded.valor_total,profissional_id=excluded.profissional_id,setor=excluded.setor,cobravel=excluded.cobravel,observacao=excluded.observacao,tabela_comercial_edicao_id=excluded.tabela_comercial_edicao_id,tabela_comercial_item_id=excluded.tabela_comercial_item_id,valor_referencia=excluded.valor_referencia,valor_contratual_calculado=excluded.valor_contratual_calculado,origem_valor=excluded.origem_valor,metodologia_preco=excluded.metodologia_preco,memoria_calculo=excluded.memoria_calculo,memoria_calculo_comercial=excluded.memoria_calculo_comercial,categoria_item=excluded.categoria_item,subgrupo_item=excluded.subgrupo_item;
    else update public.conta_faturamento_itens set cobravel=false,observacao=concat('Equipe cirúrgica pendente: ',v_status) where conta_id=v_conta.id and origem_tipo='honorario' and origem_id=v_snap_id; end if;
  end loop;
  update public.faturamento_equipe_cirurgica fe set ativo=false,cobrar=false,updated_at=now(),updated_by=v_user where fe.conta_id=v_conta.id and fe.cirurgia_procedimento_id=v_proc.id and not exists(select 1 from public.cirurgia_equipe ce where ce.id=fe.cirurgia_equipe_id and ce.cirurgia_procedimento_id=v_proc.id);
  update public.conta_faturamento_itens i set cobravel=false where i.conta_id=v_conta.id and i.origem_tipo='honorario' and exists(select 1 from public.faturamento_equipe_cirurgica fe where fe.id=i.origem_id and not fe.ativo);
  select coalesce(sum(valor_total) filter(where cobravel),0) into v_bruto from public.conta_faturamento_itens where conta_id=v_conta.id;
  update public.contas_faturamento set valor_bruto=v_bruto,valor_liquido=greatest(v_bruto-coalesce(valor_desconto,0),0),status='pre_faturamento',updated_at=now(),updated_by=v_user where id=v_conta.id;
  insert into public.auditoria_eventos(empresa_id,unidade_id,usuario_id,operacao,entidade,registro_id,origem,valores_novos,motivo) values(v_conta.empresa_id,v_conta.unidade_id,v_user,'sincronizar','faturamento_equipe_cirurgica',v_proc.id,'faturamento',jsonb_build_object('conta_id',v_conta.id,'membros',v_count,'pendencias',v_unresolved,'fonte',v_fonte.codigo,'auxiliares_tabela',v_aux_req),'Sincronização da equipe cirúrgica com regra contratual');
  return jsonb_build_object('status','ok','membros',v_count,'pendencias',v_unresolved,'quantidade_auxiliares_tabela',v_aux_req,'fonte',v_fonte.codigo,'base_procedimento',v_base,'anestesia',v_anest);
end $$;

create or replace function public.faturamento_atualizar_equipe_cirurgica(p_equipe_faturamento_id uuid,p_cobrar boolean,p_repasse boolean,p_justificativa text default null)
returns uuid language plpgsql security definer set search_path to 'public','pg_catalog' as $$
declare v_user uuid:=auth.uid();v_row public.faturamento_equipe_cirurgica%rowtype;v_conta public.contas_faturamento%rowtype;v_before jsonb;v_bruto numeric;
begin
  if v_user is null then raise exception 'FAT_EQUIPE_AUTENTICACAO_OBRIGATORIA' using errcode='42501';end if;
  select * into v_row from public.faturamento_equipe_cirurgica where id=p_equipe_faturamento_id for update;if not found then raise exception 'FAT_EQUIPE_LANCAMENTO_NAO_LOCALIZADO';end if;
  select * into v_conta from public.contas_faturamento where id=v_row.conta_id for update;
  if not public.tem_unidade(v_conta.empresa_id,v_conta.unidade_id) or not public.tem_permissao(v_conta.empresa_id,v_conta.unidade_id,'faturamento.criar') then raise exception 'FAT_EQUIPE_SEM_PERMISSAO' using errcode='42501';end if;
  if v_conta.status in('faturada','cancelada') or exists(select 1 from public.tiss_guias g where g.conta_id=v_conta.id and g.status<>'cancelada') then raise exception 'FAT_EQUIPE_CONTA_NAO_EDITAVEL';end if;
  if coalesce(p_cobrar,false) and(v_row.status_calculo<>'calculado' or v_row.valor_calculado is null) then raise exception 'FAT_EQUIPE_CALCULO_PENDENTE';end if;
  if coalesce(p_cobrar,false)<>v_row.cobrar_regra and nullif(btrim(coalesce(p_justificativa,'')),'') is null then raise exception 'FAT_EQUIPE_JUSTIFICATIVA_OBRIGATORIA';end if;
  v_before:=to_jsonb(v_row);
  update public.faturamento_equipe_cirurgica set cobrar=coalesce(p_cobrar,false),repasse=coalesce(p_repasse,false),ajuste_manual=(coalesce(p_cobrar,false)<>cobrar_regra),justificativa_ajuste=case when coalesce(p_cobrar,false)<>cobrar_regra then nullif(btrim(p_justificativa),'') else null end,updated_at=now(),updated_by=v_user where id=v_row.id;
  update public.conta_faturamento_itens set cobravel=coalesce(p_cobrar,false) where conta_id=v_conta.id and origem_tipo='honorario' and origem_id=v_row.id;
  select coalesce(sum(valor_total) filter(where cobravel),0) into v_bruto from public.conta_faturamento_itens where conta_id=v_conta.id;
  update public.contas_faturamento set valor_bruto=v_bruto,valor_liquido=greatest(v_bruto-coalesce(valor_desconto,0),0),status='pre_faturamento',updated_at=now(),updated_by=v_user where id=v_conta.id;
  insert into public.auditoria_eventos(empresa_id,unidade_id,usuario_id,operacao,entidade,registro_id,origem,valores_anteriores,valores_novos,motivo) values(v_conta.empresa_id,v_conta.unidade_id,v_user,'atualizar','faturamento_equipe_cirurgica',v_row.id,'faturamento',v_before,(select to_jsonb(x) from public.faturamento_equipe_cirurgica x where x.id=v_row.id),nullif(btrim(coalesce(p_justificativa,'')),''));
  return v_row.id;
end $$;

revoke all on function public.faturamento_amb_porte_anestesico_ch(text) from public,anon,authenticated;
revoke all on function public.faturamento_sincronizar_equipe_cirurgica(uuid,uuid) from public,anon;
revoke all on function public.faturamento_atualizar_equipe_cirurgica(uuid,boolean,boolean,text) from public,anon;
grant execute on function public.faturamento_sincronizar_equipe_cirurgica(uuid,uuid) to authenticated;
grant execute on function public.faturamento_atualizar_equipe_cirurgica(uuid,boolean,boolean,text) to authenticated;
