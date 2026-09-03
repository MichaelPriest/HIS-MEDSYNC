begin;

-- Domínios oficiais de referência usados pelo cadastro profissional/TISS.
-- Fonte: ANS FHIR TUSS 24/26, versão 202309. A modelagem é versionada para
-- permitir troca por edição posterior sem reescrever o cadastro histórico.

insert into public.ans_fhir_code_systems(
  tabela,canonical,versao,nome_computavel,titulo,pacote,fhir_versao,status,publicado_em,fonte_url,ativo
)
values
(24,'https://fhir.ans.gov.br/CodeSystem/tuss-24','202309','TUSS-24','Tabela 24 - Código brasileiro de ocupação (CBO)','br.gov.ans.fhir#202309','4.0.1','active','2023-11-24','https://fhir-hm.ans.gov.br/CodeSystem-tuss-24.html',true),
(26,'https://fhir.ans.gov.br/CodeSystem/tuss-26','202309','TUSS-26','Tabela 26 - Conselho profissional','br.gov.ans.fhir#202309','4.0.1','active','2023-11-24','https://fhir-hm.ans.gov.br/CodeSystem-tuss-26.html',true)
on conflict (canonical,versao) do update set
  nome_computavel=excluded.nome_computavel,
  titulo=excluded.titulo,
  pacote=excluded.pacote,
  fhir_versao=excluded.fhir_versao,
  status=excluded.status,
  publicado_em=excluded.publicado_em,
  fonte_url=excluded.fonte_url,
  ativo=true,
  updated_at=now();

with sistema as (
  select id from public.ans_fhir_code_systems where tabela=24 and versao='202309'
), dados(codigo,display,ordem) as (
  values
('322135','Doula',1),
('322125','Terapeuta holístico',2),
('224110','Ludomotricista',3),
('322205','Técnico de enfermagem',4),
('224115','Preparador de atleta',5),
('224120','Preparador físico',6),
('223910','Ortoptista',7),
('251605','Assistente social',8),
('223905','Terapeuta ocupacional',9),
('251555','Psicólogo acupunturista',10),
('322120','Massoterapeuta',11),
('223915','Psicomotricista',12),
('224105','Avaliador físico',13),
('322230','Auxiliar de enfermagem',14),
('224130','Técnico de laboratório e fiscalização desportiva',15),
('224135','Treinador profissional de futebol',16),
('224125','Técnico de desporto individual e coletivo (exceto futebol)',17),
('322220','Técnico de enfermagem psiquiátrica',18),
('322225','Instrumentador cirúrgico',19),
('225103','Médico infectologista',20),
('516210','Cuidador de idosos',21),
('224140','Profissional de educação física na saúde',22),
('999999','CBO do prestador solicitante desconhecido ou não informado',23),
('225105','Médico acupunturista',24),
('225106','Médico legista',25),
('223810','Fonoaudiólogo',26),
('223710','Nutricionista',27),
('226310','Arteterapeuta',28),
('223815','Fonoaudiólogo educacional',29),
('226315','Equoterapeuta',30),
('226320','Naturólogo',31),
('226105','Quiropraxista',32),
('223660','Fisioterapeuta do trabalho',33),
('225355','Médico radiologista intervencionista',34),
('223655','Fisioterapeuta esportivo',35),
('223705','Dietista',36),
('226110','Osteopata',37),
('226305','Musicoterapeuta',38),
('223830','Fonoaudiólogo em linguagem',39),
('239440','Neuropsicopedagogo clinico',40),
('239445','Neuropsicopedagogo institucional',41),
('239425','Psicopedagogo',42),
('223820','Fonoaudiólogo em audiologia',43),
('223825','Fonoaudiólogo em disfagia',44),
('223840','Fonoaudiólogo em saúde coletiva',45),
('223835','Fonoaudiólogo em motricidade orofacial',46),
('251510','Psicólogo clínico',47),
('223845','Fonoaudiólogo em voz',48),
('251545','Neuropsicólogo',49),
('251550','Psicanalista',50),
('225315','Médico em medicina nuclear',51),
('225310','Médico em endoscopia',52),
('223565','Enfermeiro da estratégia de saúde da família',53),
('225320','Médico em radiologia e diagnóstico por imagem',54),
('223570','Perfusionista',55),
('223605','Fisioterapeuta geral',56),
('223550','Enfermeiro psiquiátrico',57),
('225295','Médico cirurgião da mão',58),
('223545','Enfermeiro obstétrico',59),
('225290','Médico cancerologista cirúrgico',60),
('225305','Médico citopatologista',61),
('223555','Enfermeiro puericultor e pediátrico',62),
('223560','Enfermeiro sanitarista',63),
('225335','Médico patologista clínico / medicina laboratorial',64),
('223630','Fisioterapeuta neurofuncional',65),
('223635','Fisioterapeuta traumato-ortopédica funcional',66),
('225345','Médico hiperbarista',67),
('223625','Fisioterapeuta respiratória',68),
('225325','Médico patologista',69),
('225330','Médico radioterapeuta',70),
('225340','Médico hemoterapeuta',71),
('223640','Fisioterapeuta osteopata',72),
('225350','Médico neurofisiologista',73),
('223645','Fisioterapeuta quiropraxista',74),
('223650','Fisioterapeuta acupunturista',75),
('225240','Médico cirurgião torácico',76),
('225235','Médico cirurgião plástico',77),
('223505','Enfermeiro',78),
('225250','Médico ginecologista e obstetra',79),
('223510','Enfermeiro auditor',80),
('223515','Enfermeiro de bordo',81),
('223435','Farmacêutico industrial',82),
('225225','Médico cirurgião geral',83),
('223430','Farmacêutico em saúde pública',84),
('225220','Médico cirurgião do aparelho digestivo',85),
('225230','Médico cirurgião pediátrico',86),
('223440','Farmacêutico toxicologista',87),
('223445','Farmacêutico hospitalar e clínico',88),
('223525','Enfermeiro de terapia intensiva',89),
('225265','Médico oftalmologista',90),
('225270','Médico ortopedista e traumatologista',91),
('225260','Médico neurocirurgião',92),
('225255','Médico Mastologista',93),
('223520','Enfermeiro de centro cirúrgico',94),
('223535','Enfermeiro nefrologista',95),
('223530','Enfermeiro do trabalho',96),
('225275','Médico otorrinolaringologista',97),
('223540','Enfermeiro neonatologista',98),
('225280','Médico proctologista',99),
('225285','Médico urologista',100),
('223280','Cirurgião dentista - dentística',101),
('223276','Cirurgião dentista - odontologia do trabalho',102),
('225165','Médico gastroenterologista',103),
('223284','Cirurgião dentista - disfunção temporomandibular e dor orofacial',104),
('225170','Médico generalista',105),
('225175','Médico geneticista',106),
('225154','Médico antroposófico',107),
('223268','Cirurgião dentista - traumatologista bucomaxilofacial',108),
('225151','Médico anestesiologista',109),
('223264','Cirurgião dentista - reabilitador oral',110),
('223272','Cirurgião dentista de saúde coletiva',111),
('225155','Médico endocrinologista e metabologista',112),
('225160','Médico fisiatra',113),
('223405','Farmacêutico',114),
('225185','Médico Hematologista',115),
('225195','Médico Homeopata',116),
('225180','Médico geriatra',117),
('223288','Cirurgião dentista - odontologia para pacientes com necessidades especiais',118),
('223293','Cirurgião-dentista da estratégia de saúde da família',119),
('223420','Farmacêutico de alimentos',120),
('223415','Farmacêutico analista clínico',121),
('225203','Médico em cirurgia vascular',122),
('223425','Farmacêutico práticas integrativas e complementares',123),
('225210','Médico cirurgião cardiovascular',124),
('225215','Médico cirurgião de cabeça e pescoço',125),
('225135','Médico dermatologista',126),
('225133','Médico psiquiatra',127),
('223228','Cirurgião dentista - odontogeriatra',128),
('225136','Médico reumatologista',129),
('223232','Cirurgião dentista - odontologista legal',130),
('223236','Cirurgião dentista - odontopediatra',131),
('223216','Cirurgião dentista - epidemiologista',132),
('225127','Médico pneumologista',133),
('223212','Cirurgião dentista - endodontista',134),
('225125','Médico clínico',135),
('225130','Médico de família e comunidade',136),
('223220','Cirurgião dentista - estomatologista',137),
('223224','Cirurgião dentista - implantodontista',138),
('225142','Médico da estratégia de saúde da família',139),
('223244','Cirurgião dentista - patologista bucal',140),
('223248','Cirurgião dentista - periodontista',141),
('223240','Cirurgião dentista - ortopedista e ortodontista',142),
('225139','Médico sanitarista',143),
('225140','Médico do trabalho',144),
('225148','Médico anatomopatologista',145),
('225145','Médico em medicina de tráfego',146),
('223252','Cirurgião dentista - protesiólogo bucomaxilofacial',147),
('225150','Médico em medicina intensiva',148),
('223256','Cirurgião dentista - protesista',149),
('223260','Cirurgião dentista - radiologista',150),
('225115','Médico angiologista',151),
('203015','Pesquisador em biologia de microorganismos e parasitas',152),
('213150','Físico médico',153),
('225118','Médico nutrologista',154),
('225110','Médico alergista e imunologista',155),
('225109','Médico Nefrologista',156),
('131220','Gerontólogo',157),
('201115','Geneticista',158),
('225112','Médico neurologista',159),
('221205','Biomédico',160),
('225121','Médico oncologista clínico',161),
('221105','Biólogo',162),
('225120','Médico cardiologista',163),
('225122','Médico cancerologista pediátrico',164),
('223204','Cirurgião dentista - auditor',165),
('223208','Cirurgião dentista - clínico geral',166),
('225124','Médico pediatra',167)
)
insert into public.ans_fhir_conceitos(code_system_id,codigo,display,ordem,ativo)
select sistema.id,dados.codigo,dados.display,dados.ordem,true from sistema cross join dados
on conflict (code_system_id,codigo) do update set
  display=excluded.display,
  ordem=excluded.ordem,
  ativo=true,
  updated_at=now();

with sistema as (
  select id from public.ans_fhir_code_systems where tabela=26 and versao='202309'
), dados(codigo,display,ordem) as (
  values
('03','Conselho Regional de Farmácia (CRF)',1),
('11','Conselho Regional de Biologia (CRBio)',2),
('12','Conselho Regional de Biomedicina (CRBM)',3),
('13','Conselho Regional de Educação Física (CREF)',4),
('01','Conselho Regional de Serviço Social (CRESS)',5),
('09','Conselho Regional de Psicologia (CRP)',6),
('10','Outros Conselhos',7),
('02','Conselho Regional de Enfermagem (COREN)',8),
('05','Conselho Regional de Fisioterapia e Terapia Ocupacional (CREFITO)',9),
('15','Conselho Regional de Técnicos em Radiologia (CRTR)',10),
('04','Conselho Regional de Fonoaudiologia (CREFONO)',11),
('14','Conselho Regional de Medicina Veterinária (CRMV)',12),
('07','Conselho Regional de Nutrição (CRN)',13),
('06','Conselho Regional de Medicina (CRM)',14),
('08','Conselho Regional de Odontologia (CRO)',15)
)
insert into public.ans_fhir_conceitos(code_system_id,codigo,display,ordem,ativo)
select sistema.id,dados.codigo,dados.display,dados.ordem,true from sistema cross join dados
on conflict (code_system_id,codigo) do update set
  display=excluded.display,
  ordem=excluded.ordem,
  ativo=true,
  updated_at=now();

alter table public.profissionais
  add column if not exists codigo_conselho_ans text,
  add column if not exists habilitado_tiss boolean not null default false;

alter table public.profissionais drop constraint if exists profissionais_uf_conselho_check;
alter table public.profissionais add constraint profissionais_uf_conselho_check
check (uf_conselho is null or uf_conselho = any (array['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']));

alter table public.profissionais drop constraint if exists profissionais_codigo_conselho_ans_check;
alter table public.profissionais add constraint profissionais_codigo_conselho_ans_check
check (codigo_conselho_ans is null or codigo_conselho_ans = any (array['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15']));

alter table public.profissionais drop constraint if exists profissionais_cbo_formato_check;
alter table public.profissionais add constraint profissionais_cbo_formato_check
check (cbo is null or cbo ~ '^[0-9]{6}$');

create or replace function public.validar_habilitacao_tiss_profissional_internal()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not new.habilitado_tiss then
    return new;
  end if;

  if nullif(btrim(coalesce(new.numero_conselho,'')),'') is null
     or new.codigo_conselho_ans is null
     or new.uf_conselho is null
     or new.cbo is null then
    raise exception 'PROFISSIONAL_TISS_HABILITACAO_INCOMPLETA' using errcode='23514';
  end if;

  if not exists (
    select 1 from public.ans_fhir_dominios_ativos
    where tabela=24 and codigo=new.cbo
  ) or new.cbo='999999' then
    raise exception 'PROFISSIONAL_TISS_CBO_FORA_TABELA_24' using errcode='23514';
  end if;

  if not exists (
    select 1 from public.ans_fhir_dominios_ativos
    where tabela=26 and codigo=new.codigo_conselho_ans
  ) then
    raise exception 'PROFISSIONAL_TISS_CONSELHO_FORA_TABELA_26' using errcode='23514';
  end if;

  if not (new.uf_conselho = any (array['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'])) then
    raise exception 'PROFISSIONAL_TISS_UF_INVALIDA' using errcode='23514';
  end if;

  return new;
end
$function$;

drop trigger if exists profissionais_validar_habilitacao_tiss_trg on public.profissionais;
create trigger profissionais_validar_habilitacao_tiss_trg
before insert or update of habilitado_tiss,codigo_conselho_ans,numero_conselho,uf_conselho,cbo
on public.profissionais
for each row execute function public.validar_habilitacao_tiss_profissional_internal();

update public.profissionais
set codigo_conselho_ans = case upper(coalesce(conselho,''))
  when 'CRESS' then '01'
  when 'COREN' then '02'
  when 'CRF' then '03'
  when 'CREFONO' then '04'
  when 'CRFA' then '04'
  when 'CREFITO' then '05'
  when 'CRM' then '06'
  when 'CRN' then '07'
  when 'CRO' then '08'
  when 'CRP' then '09'
  when 'CRBIO' then '11'
  when 'CRBM' then '12'
  when 'CREF' then '13'
  when 'CRMV' then '14'
  when 'CRTR' then '15'
  else codigo_conselho_ans
end
where codigo_conselho_ans is null;

update public.profissionais p
set especialidade=d.display,
    habilitado_tiss=true,
    updated_at=now()
from public.ans_fhir_dominios_ativos d
where d.tabela=24
  and d.codigo=p.cbo
  and p.cbo<>'999999'
  and p.codigo_conselho_ans is not null
  and nullif(btrim(coalesce(p.numero_conselho,'')),'') is not null
  and p.uf_conselho = any (array['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']);

commit;
