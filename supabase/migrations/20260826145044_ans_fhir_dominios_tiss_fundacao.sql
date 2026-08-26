create table if not exists public.ans_fhir_code_systems (
  id uuid primary key default gen_random_uuid(),
  tabela integer not null check (tabela > 0),
  canonical text not null,
  versao text not null,
  nome_computavel text,
  titulo text not null,
  pacote text,
  fhir_versao text,
  status text not null default 'active',
  publicado_em date,
  fonte_url text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ans_fhir_code_systems_canonical_versao_key unique (canonical, versao),
  constraint ans_fhir_code_systems_tabela_versao_key unique (tabela, versao)
);

create unique index if not exists ans_fhir_code_systems_tabela_ativa_uidx
  on public.ans_fhir_code_systems (tabela)
  where ativo;

create table if not exists public.ans_fhir_conceitos (
  id uuid primary key default gen_random_uuid(),
  code_system_id uuid not null references public.ans_fhir_code_systems(id) on delete restrict,
  codigo text not null,
  display text not null,
  ordem integer,
  pai_codigo text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ans_fhir_conceitos_sistema_codigo_key unique (code_system_id, codigo)
);

create index if not exists ans_fhir_conceitos_sistema_ordem_idx
  on public.ans_fhir_conceitos (code_system_id, ordem, codigo);

alter table public.ans_fhir_code_systems enable row level security;
alter table public.ans_fhir_conceitos enable row level security;

revoke all on table public.ans_fhir_code_systems from public, anon, authenticated;
revoke all on table public.ans_fhir_conceitos from public, anon, authenticated;
grant select on table public.ans_fhir_code_systems to authenticated;
grant select on table public.ans_fhir_conceitos to authenticated;

drop policy if exists ans_fhir_code_systems_select_authenticated on public.ans_fhir_code_systems;
create policy ans_fhir_code_systems_select_authenticated
  on public.ans_fhir_code_systems for select to authenticated
  using (auth.uid() is not null);

drop policy if exists ans_fhir_conceitos_select_authenticated on public.ans_fhir_conceitos;
create policy ans_fhir_conceitos_select_authenticated
  on public.ans_fhir_conceitos for select to authenticated
  using (auth.uid() is not null);

insert into public.ans_fhir_code_systems
  (tabela, canonical, versao, nome_computavel, titulo, pacote, fhir_versao, status, publicado_em, fonte_url, ativo)
values
  (48, 'https://fhir.ans.gov.br/CodeSystem/tuss-48', '202309', 'TUSS48', 'Tabela 48 - Técnica utilizada', 'br.gov.ans.fhir#202309', '4.0.1', 'active', date '2023-11-24', 'https://fhir-hm.ans.gov.br/CodeSystem-tuss-48.html', true),
  (49, 'https://fhir.ans.gov.br/CodeSystem/tuss-49', '202309', 'TUSS49', 'Tabela 49 - Tipo de acomodação', 'br.gov.ans.fhir#202309', '4.0.1', 'active', date '2023-11-24', 'https://fhir-hm.ans.gov.br/CodeSystem-tuss-49.html', true),
  (50, 'https://fhir.ans.gov.br/CodeSystem/tuss-50', '202309', 'TUSS50', 'Tabela 50 - Tipo de atendimento', 'br.gov.ans.fhir#202309', '4.0.1', 'active', date '2023-11-24', 'https://fhir-hm.ans.gov.br/CodeSystem-tuss-50.html', true),
  (52, 'https://fhir.ans.gov.br/CodeSystem/tuss-52', '202309', 'TUSS52', 'Tabela 52 - Tipo de consulta', 'br.gov.ans.fhir#202309', '4.0.1', 'active', date '2023-11-24', 'https://fhir-hm.ans.gov.br/CodeSystem-tuss-52.html', true),
  (61, 'https://fhir.ans.gov.br/CodeSystem/tuss-61', '202309', 'TUSS61', 'Tabela 61 - Via de acesso', 'br.gov.ans.fhir#202309', '4.0.1', 'active', date '2023-11-24', 'https://fhir-hm.ans.gov.br/CodeSystem-tuss-61.html', true)
on conflict (tabela, versao) do update set
  canonical = excluded.canonical,
  nome_computavel = excluded.nome_computavel,
  titulo = excluded.titulo,
  pacote = excluded.pacote,
  fhir_versao = excluded.fhir_versao,
  status = excluded.status,
  publicado_em = excluded.publicado_em,
  fonte_url = excluded.fonte_url,
  ativo = excluded.ativo,
  updated_at = now();

insert into public.ans_fhir_conceitos (code_system_id, codigo, display, ordem)
select s.id, v.codigo, v.display, v.ordem
from public.ans_fhir_code_systems s
join (values
  ('1','Convencional',1), ('2','Video',2), ('3','Robótica',3)
) as v(codigo,display,ordem) on true
where s.tabela=48 and s.versao='202309'
on conflict (code_system_id,codigo) do update set display=excluded.display, ordem=excluded.ordem, ativo=true, updated_at=now();

insert into public.ans_fhir_conceitos (code_system_id, codigo, display, ordem)
select s.id, v.codigo, v.display, v.ordem
from public.ans_fhir_code_systems s
join (values
  ('16','APARTAMENTO PARA PACIENTE COM OBESIDADE MÓRBIDA',1),
  ('43','QUARTO COM ALOJAMENTO CONJUNTO',2),
  ('17','APARTAMENTO SIMPLES DA MATERNIDADE',3),
  ('44','SEMI UTI NEUROLÓGICA',4),
  ('18','APARTAMENTO SIMPLES DE PSIQUIATRIA',5),
  ('45','SEMI UTI INFANTIL/PEDIÁTRICA',6),
  ('48','UNIDADE DE TRANSPLANTE EM GERAL',7),
  ('20','APARTAMENTO SUÍTE DE PSIQUIATRIA',8),
  ('49','APARTAMENTO STANDARD DA MATERNIDADE',9),
  ('21','BERÇÁRIO NORMAL',10),
  ('19','APARTAMENTO SUÍTE DA MATERNIDADE',11),
  ('46','SEMI UTI QUEIMADOS',12),
  ('47','UNIDADE DE TRANSPLANTE DE MEDULA ÓSSEA',13),
  ('13','APARTAMENTO STANDARD',14),
  ('39','SEMI UTI CORONARIANA',15),
  ('40','SEMI UTI NEONATAL',16),
  ('14','APARTAMENTO SUÍTE',17),
  ('15','APARTAMENTO COM ALOJAMENTO CONJUNTO',18),
  ('41','QUARTO COLETIVO DE 2 LEITOS',19),
  ('10','APARTAMENTO DE LUXO DE PSIQUIATRIA',20),
  ('36','QUARTO PRIVATIVO / PARTICULAR DA MATERNIDADE',21),
  ('11','APARTAMENTO DE LUXO',22),
  ('37','QUARTO PRIVATIVO / PARTICULAR DE PSIQUIATRIA',23),
  ('12','APARTAMENTO SIMPLES',24),
  ('38','SEMI UTI ADULTO GERAL',25),
  ('57','UTI CORONARIANA',26),
  ('29','HOSPITAL DIA PSIQUIATRIA',27),
  ('58','UTI NEUROLÓGICA',28),
  ('30','QUARTO COLETIVO DE 2 LEITOS DA MATERNIDADE',29),
  ('59','UTI QUEIMADOS',30),
  ('31','ENFERMARIA DE 3 LEITOS',31),
  ('32','ENFERMARIA DE 4 OU MAIS LEITOS',32),
  ('33','ENFERMARIA COM ALOJAMENTO CONJUNTO',33),
  ('02','QUARTO PRIVATIVO / PARTICULAR',34),
  ('09','APARTAMENTO DE LUXO DA MATERNIDADE',35),
  ('52','UTI INFANTIL/PEDIÁTRICA',36),
  ('53','UTI NEONATAL',37),
  ('27','HOSPITAL DIA APARTAMENTO',38),
  ('56','UNIDADE PARA TRATAMENTO RADIOATIVO',39),
  ('28','HOSPITAL DIA ENFERMARIA',40),
  ('50','APARTAMENTO STANDARD DE PSIQUIATRIA',41),
  ('22','BERÇÁRIO PATOLÓGICO / PREMATURO',42),
  ('51','UTI ADULTO GERAL',43),
  ('25','ENFERMARIA DE 3 LEITOS DA MATERNIDADE',44),
  ('26','ENFERMARIA DE 4 OU MAIS LEITOS DA MATERNIDADE',45)
) as v(codigo,display,ordem) on true
where s.tabela=49 and s.versao='202309'
on conflict (code_system_id,codigo) do update set display=excluded.display, ordem=excluded.ordem, ativo=true, updated_at=now();

insert into public.ans_fhir_conceitos (code_system_id, codigo, display, ordem)
select s.id, v.codigo, v.display, v.ordem
from public.ans_fhir_code_systems s
join (values
  ('06','Atendimento Domiciliar',1),
  ('05','Exame Ambulatorial',2),
  ('17','Saúde Ocupacional - Retorno ao trabalho',3),
  ('04','Consulta',4),
  ('16','Saúde Ocupacional - Periódico',5),
  ('14','Saúde Ocupacional - Admissional',6),
  ('13','Pequeno atendimento (sutura, gesso e outros)',7),
  ('01','Remoção',8),
  ('03','Outras Terapias',9),
  ('15','Saúde Ocupacional - Demissional',10),
  ('02','Pequena Cirurgia',11),
  ('09','Radioterapia',12),
  ('20','Saúde Ocupacional - Beneficiário novo',13),
  ('08','Quimioterapia',14),
  ('19','Saúde Ocupacional - Promoção a saúde',15),
  ('07','Internação',16),
  ('18','Saúde Ocupacional - Mudança de função',17),
  ('23','Exame',18),
  ('11','Pronto Socorro',19),
  ('22','TELESSAÚDE',20),
  ('10','Terapia Renal Substitutiva (TRS)',21),
  ('21','Saúde Ocupacional - Assistência a demitidos',22)
) as v(codigo,display,ordem) on true
where s.tabela=50 and s.versao='202309'
on conflict (code_system_id,codigo) do update set display=excluded.display, ordem=excluded.ordem, ativo=true, updated_at=now();

insert into public.ans_fhir_conceitos (code_system_id, codigo, display, ordem)
select s.id, v.codigo, v.display, v.ordem
from public.ans_fhir_code_systems s
join (values
  ('4','Por encaminhamento',1), ('2','Retorno',2), ('1','Primeira Consulta',3), ('3','Pré-natal',4)
) as v(codigo,display,ordem) on true
where s.tabela=52 and s.versao='202309'
on conflict (code_system_id,codigo) do update set display=excluded.display, ordem=excluded.ordem, ativo=true, updated_at=now();

insert into public.ans_fhir_conceitos (code_system_id, codigo, display, ordem)
select s.id, v.codigo, v.display, v.ordem
from public.ans_fhir_code_systems s
join (values
  ('2','Mesma via',1), ('3','Diferentes vias',2), ('1','Única',3)
) as v(codigo,display,ordem) on true
where s.tabela=61 and s.versao='202309'
on conflict (code_system_id,codigo) do update set display=excluded.display, ordem=excluded.ordem, ativo=true, updated_at=now();

create or replace view public.ans_fhir_dominios_ativos
with (security_invoker=true)
as
select s.tabela,s.canonical,s.versao,s.nome_computavel,s.titulo,c.id as conceito_id,c.codigo,c.display,c.ordem
from public.ans_fhir_code_systems s
join public.ans_fhir_conceitos c on c.code_system_id=s.id
where s.ativo and c.ativo;

revoke all on table public.ans_fhir_dominios_ativos from public, anon, authenticated;
grant select on table public.ans_fhir_dominios_ativos to authenticated;

alter table public.atendimentos
  add column if not exists tipo_atendimento_tuss50_conceito_id uuid references public.ans_fhir_conceitos(id) on delete restrict,
  add column if not exists tipo_atendimento_tuss50_codigo text,
  add column if not exists tipo_atendimento_tuss50_descricao text,
  add column if not exists tipo_atendimento_tuss50_versao text,
  add column if not exists tipo_atendimento_tuss50_canonical text,
  add column if not exists tipo_consulta_tuss52_conceito_id uuid references public.ans_fhir_conceitos(id) on delete restrict,
  add column if not exists tipo_consulta_tuss52_codigo text,
  add column if not exists tipo_consulta_tuss52_descricao text,
  add column if not exists tipo_consulta_tuss52_versao text,
  add column if not exists tipo_consulta_tuss52_canonical text;

create index if not exists atendimentos_tuss50_conceito_idx on public.atendimentos(tipo_atendimento_tuss50_conceito_id);
create index if not exists atendimentos_tuss52_conceito_idx on public.atendimentos(tipo_consulta_tuss52_conceito_id);

alter table public.internacoes
  add column if not exists acomodacao_tuss49_conceito_id uuid references public.ans_fhir_conceitos(id) on delete restrict,
  add column if not exists acomodacao_tuss49_codigo text,
  add column if not exists acomodacao_tuss49_descricao text,
  add column if not exists acomodacao_tuss49_versao text,
  add column if not exists acomodacao_tuss49_canonical text;

create index if not exists internacoes_tuss49_conceito_idx on public.internacoes(acomodacao_tuss49_conceito_id);

alter table public.tiss_guias
  add column if not exists tipo_atendimento_tuss50_codigo text,
  add column if not exists tipo_atendimento_tuss50_descricao text,
  add column if not exists tipo_atendimento_tuss50_versao text,
  add column if not exists tipo_atendimento_tuss50_canonical text,
  add column if not exists tipo_consulta_tuss52_codigo text,
  add column if not exists tipo_consulta_tuss52_descricao text,
  add column if not exists tipo_consulta_tuss52_versao text,
  add column if not exists tipo_consulta_tuss52_canonical text;

alter table public.tiss_guia_itens
  add column if not exists via_acesso_tuss61_conceito_id uuid references public.ans_fhir_conceitos(id) on delete restrict,
  add column if not exists via_acesso_tuss61_descricao text,
  add column if not exists via_acesso_tuss61_versao text,
  add column if not exists via_acesso_tuss61_canonical text,
  add column if not exists tecnica_utilizada_tuss48_conceito_id uuid references public.ans_fhir_conceitos(id) on delete restrict,
  add column if not exists tecnica_utilizada_tuss48_descricao text,
  add column if not exists tecnica_utilizada_tuss48_versao text,
  add column if not exists tecnica_utilizada_tuss48_canonical text;

create index if not exists tiss_guia_itens_tuss61_conceito_idx on public.tiss_guia_itens(via_acesso_tuss61_conceito_id);
create index if not exists tiss_guia_itens_tuss48_conceito_idx on public.tiss_guia_itens(tecnica_utilizada_tuss48_conceito_id);

update public.atendimentos a
set tipo_atendimento_tuss50_conceito_id=d.conceito_id,
    tipo_atendimento_tuss50_codigo=d.codigo,
    tipo_atendimento_tuss50_descricao=d.display,
    tipo_atendimento_tuss50_versao=d.versao,
    tipo_atendimento_tuss50_canonical=d.canonical
from public.ans_fhir_dominios_ativos d
where d.tabela=50 and d.codigo='04' and a.tipo_atendimento_tiss='consulta' and a.tipo_atendimento_tuss50_codigo is null;

create or replace function public.validar_complementar_admissao_tiss_internal(
  p_atendimento_id uuid,
  p_payload jsonb,
  p_retorno jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $$
declare
  v_at public.atendimentos%rowtype;
  v_prof public.profissionais%rowtype;
  v_un public.unidades%rowtype;
  v_plano public.convenio_planos%rowtype;
  v_regime text := nullif(btrim(coalesce(p_payload->>'regime_atendimento','')),'');
  v_tipo_tiss text := nullif(btrim(coalesce(p_payload->>'tipo_atendimento_tiss','')),'');
  v_tuss50_codigo text := nullif(btrim(coalesce(p_payload->>'tipo_atendimento_tuss50_codigo','')),'');
  v_tuss52_codigo text := nullif(btrim(coalesce(p_payload->>'tipo_consulta_tuss52_codigo','')),'');
  v_tuss50 record;
  v_tuss52 record;
  v_codigo text := nullif(btrim(coalesce(p_payload->>'codigo_tuss_principal','')),'');
  v_descricao text := nullif(btrim(coalesce(p_payload->>'descricao_tuss_principal','')),'');
  v_indicacao text := nullif(btrim(coalesce(p_payload->>'indicacao_clinica','')),'');
  v_carteirinha text;
  v_validade date;
  v_retorno_id uuid;
  v_retorno_dias integer;
  v_retorno_alerta boolean := coalesce((p_retorno->>'alerta')::boolean,false);
begin
  select * into v_at from public.atendimentos where id=p_atendimento_id for update;
  if not found then raise exception 'ADMISSAO_ATENDIMENTO_NAO_LOCALIZADO'; end if;
  if auth.uid() is null or not public.tem_unidade(v_at.empresa_id,v_at.unidade_id) then raise exception 'ADMISSAO_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_regime is null or v_regime not in ('ambulatorial','pronto_socorro','internacao','telessaude') then raise exception 'ADMISSAO_REGIME_TISS_INVALIDO'; end if;
  if v_tipo_tiss is null or v_tipo_tiss not in ('consulta','sadt_exames','pequena_cirurgia','sessao_terapia','internacao','outro') then raise exception 'ADMISSAO_TIPO_TISS_INVALIDO'; end if;

  if v_at.profissional_id is not null then select * into v_prof from public.profissionais where id=v_at.profissional_id and empresa_id=v_at.empresa_id and ativo; end if;
  select * into v_un from public.unidades where id=v_at.unidade_id;

  if v_at.cobertura::text='convenio' and v_tuss50_codigo is null then raise exception 'ADMISSAO_TUSS50_OBRIGATORIO'; end if;
  if v_tuss50_codigo is not null then
    select conceito_id,codigo,display,versao,canonical into v_tuss50 from public.ans_fhir_dominios_ativos where tabela=50 and codigo=v_tuss50_codigo;
    if not found then raise exception 'ADMISSAO_TUSS50_INVALIDO'; end if;
  end if;
  if v_at.cobertura::text='convenio' and v_tuss50_codigo='04' and v_tuss52_codigo is null then raise exception 'ADMISSAO_TUSS52_OBRIGATORIO'; end if;
  if v_tuss52_codigo is not null then
    select conceito_id,codigo,display,versao,canonical into v_tuss52 from public.ans_fhir_dominios_ativos where tabela=52 and codigo=v_tuss52_codigo;
    if not found then raise exception 'ADMISSAO_TUSS52_INVALIDO'; end if;
  end if;

  if v_at.cobertura::text='convenio' then
    if v_at.profissional_id is null then raise exception 'ADMISSAO_PROFISSIONAL_OBRIGATORIO_CONVENIO'; end if;
    if nullif(btrim(coalesce(v_prof.conselho,'')),'') is null or nullif(btrim(coalesce(v_prof.numero_conselho,'')),'') is null or nullif(btrim(coalesce(v_prof.uf_conselho,'')),'') is null then raise exception 'ADMISSAO_CONSELHO_INCOMPLETO'; end if;
    if nullif(btrim(coalesce(v_prof.cbo,'')),'') is null then raise exception 'ADMISSAO_CBO_AUSENTE'; end if;
    if nullif(btrim(coalesce(v_un.cnes,'')),'') is null then raise exception 'ADMISSAO_CNES_AUSENTE'; end if;
    if nullif(btrim(coalesce(v_at.registro_ans_snapshot,'')),'') is null then raise exception 'ADMISSAO_REGISTRO_ANS_AUSENTE'; end if;
    select * into v_plano from public.convenio_planos where id=v_at.plano_id and convenio_id=v_at.convenio_id and ativo;
    v_carteirinha := coalesce(v_at.numero_carteirinha,'');
    v_validade := v_at.validade_carteirinha;
    if v_plano.exige_validade_carteirinha and v_validade is null then raise exception 'ADMISSAO_VALIDADE_CARTEIRA_OBRIGATORIA'; end if;
    if v_validade is not null and v_validade < current_date then raise exception 'ADMISSAO_CARTEIRA_VENCIDA'; end if;
    if nullif(v_plano.carteirinha_regex,'') is not null then
      begin
        if not (v_carteirinha ~ v_plano.carteirinha_regex) then raise exception 'ADMISSAO_CARTEIRINHA_PADRAO_INVALIDO'; end if;
      exception when invalid_regular_expression then raise exception 'ADMISSAO_CONFIG_CARTEIRINHA_REGEX_INVALIDA';
      end;
    end if;
  end if;

  if v_tipo_tiss in ('consulta','sadt_exames','pequena_cirurgia','sessao_terapia') and v_codigo is null then raise exception 'ADMISSAO_TUSS_OBRIGATORIO'; end if;
  if v_tipo_tiss in ('sadt_exames','pequena_cirurgia','sessao_terapia') and v_indicacao is null then raise exception 'ADMISSAO_INDICACAO_OBRIGATORIA'; end if;
  if v_codigo is not null and not exists (
    select 1 from public.itens_assistenciais i where i.empresa_id=v_at.empresa_id and i.ativo and i.categoria='procedimento' and (i.codigo_tuss=v_codigo or i.codigo_tabela_propria=v_codigo)
  ) and v_codigo not in ('10101012','10101039','10102019') then raise exception 'ADMISSAO_TUSS_NAO_CADASTRADO'; end if;

  begin v_retorno_id := nullif(p_retorno->>'atendimento_id','')::uuid; exception when invalid_text_representation then v_retorno_id:=null; end;
  begin v_retorno_dias := nullif(p_retorno->>'dias','')::integer; exception when invalid_text_representation then v_retorno_dias:=null; end;

  update public.atendimentos set
    regime_atendimento=v_regime,
    tipo_atendimento_tiss=v_tipo_tiss,
    tipo_atendimento_tuss50_conceito_id=case when v_tuss50_codigo is null then null else v_tuss50.conceito_id end,
    tipo_atendimento_tuss50_codigo=case when v_tuss50_codigo is null then null else v_tuss50.codigo end,
    tipo_atendimento_tuss50_descricao=case when v_tuss50_codigo is null then null else v_tuss50.display end,
    tipo_atendimento_tuss50_versao=case when v_tuss50_codigo is null then null else v_tuss50.versao end,
    tipo_atendimento_tuss50_canonical=case when v_tuss50_codigo is null then null else v_tuss50.canonical end,
    tipo_consulta_tuss52_conceito_id=case when v_tuss52_codigo is null then null else v_tuss52.conceito_id end,
    tipo_consulta_tuss52_codigo=case when v_tuss52_codigo is null then null else v_tuss52.codigo end,
    tipo_consulta_tuss52_descricao=case when v_tuss52_codigo is null then null else v_tuss52.display end,
    tipo_consulta_tuss52_versao=case when v_tuss52_codigo is null then null else v_tuss52.versao end,
    tipo_consulta_tuss52_canonical=case when v_tuss52_codigo is null then null else v_tuss52.canonical end,
    codigo_tuss_principal=v_codigo,descricao_tuss_principal=v_descricao,indicacao_clinica=v_indicacao,
    retorno_alerta_30_dias=v_retorno_alerta,retorno_atendimento_referencia_id=v_retorno_id,retorno_dias=v_retorno_dias,
    updated_at=now(),updated_by=auth.uid()
  where id=v_at.id;
  return v_at.id;
end
$$;

revoke all on function public.validar_complementar_admissao_tiss_internal(uuid,jsonb,jsonb) from public,anon,authenticated;
