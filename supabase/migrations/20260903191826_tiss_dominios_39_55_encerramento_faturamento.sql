do $$
declare
  v_cs39 uuid;
  v_cs55 uuid;
begin
  insert into public.ans_fhir_code_systems(
    tabela,canonical,versao,nome_computavel,titulo,pacote,fhir_versao,status,publicado_em,fonte_url,ativo
  ) values(
    39,'https://fhir.ans.gov.br/CodeSystem/tuss-39','202309','TUSS39','Tabela 39 - Motivo de encerramento',
    'br.gov.ans.fhir#202309','4.0.1','active','2023-11-24','https://fhir-hm.ans.gov.br/CodeSystem-tuss-39.html',true
  ) on conflict(tabela,versao) do update set canonical=excluded.canonical,nome_computavel=excluded.nome_computavel,
    titulo=excluded.titulo,pacote=excluded.pacote,fhir_versao=excluded.fhir_versao,status=excluded.status,
    publicado_em=excluded.publicado_em,fonte_url=excluded.fonte_url,ativo=true,updated_at=now()
  returning id into v_cs39;

  insert into public.ans_fhir_code_systems(
    tabela,canonical,versao,nome_computavel,titulo,pacote,fhir_versao,status,publicado_em,fonte_url,ativo
  ) values(
    55,'https://fhir.ans.gov.br/CodeSystem/tuss-55','202309','TUSS55','Tabela 55 - Tipo de faturamento',
    'br.gov.ans.fhir#202309','4.0.1','active','2023-11-24','https://fhir-hm.ans.gov.br/ValueSet-tipo-faturamento.html',true
  ) on conflict(tabela,versao) do update set canonical=excluded.canonical,nome_computavel=excluded.nome_computavel,
    titulo=excluded.titulo,pacote=excluded.pacote,fhir_versao=excluded.fhir_versao,status=excluded.status,
    publicado_em=excluded.publicado_em,fonte_url=excluded.fonte_url,ativo=true,updated_at=now()
  returning id into v_cs55;

  insert into public.ans_fhir_conceitos(code_system_id,codigo,display,ordem,ativo)
  select v_cs39,x.codigo,x.display,x.ordem,true
  from (values
    ('26','Permanência, por mudança de Procedimento',1),
    ('28','Permanência, outros motivos',2),
    ('31','Transferido para outro estabelecimento',3),
    ('32','Transferência para Internação Domiciliar',4),
    ('41','Óbito com declaração de óbito fornecida pelo médico assistente',5),
    ('42','Óbito com declaração de Óbito fornecida pelo Instituto Médico Legal - IML',6),
    ('61','Alta da mãe/puérpera e do recém-nascido',7),
    ('62','Alta da mãe/puérpera e permanência do recém-nascido',8),
    ('63','Alta da mãe/puérpera e óbito do recém-nascido',9),
    ('64','Alta da mãe/puérpera com óbito fetal',10),
    ('27','Permanência, por reoperação',11),
    ('43','Óbito com declaração de Óbito fornecida pelo Serviço de Verificação de Óbito - SVO.',12),
    ('51','Encerramento Administrativo',13),
    ('19','Alta de Paciente Agudo em Psiquiatria',14),
    ('21','Permanência, por características próprias da doença',15),
    ('22','Permanência, por intercorrência',16),
    ('23','Permanência, por impossibilidade sócio-familiar',17),
    ('24','Permanência, por Processo de doação de órgãos, tecidos e células - doador vivo',18),
    ('25','Permanência, por Processo de doação de órgãos, tecidos e células - doador morto',19),
    ('11','Alta Curado',20),
    ('14','Alta a pedido',21),
    ('12','Alta Melhorado',22),
    ('15','Alta com previsão de retorno para acompanhamento do paciente',23),
    ('18','Alta por outros motivos',24),
    ('16','Alta por Evasão',25),
    ('66','Óbito da mãe/puérpera e alta do recém-nascido',26),
    ('67','Óbito da mãe/puérpera e permanência do recém-nascido',27),
    ('65','Óbito da gestante e do concepto',28)
  ) as x(codigo,display,ordem)
  on conflict(code_system_id,codigo) do update set display=excluded.display,ordem=excluded.ordem,ativo=true,updated_at=now();

  insert into public.ans_fhir_conceitos(code_system_id,codigo,display,ordem,ativo)
  select v_cs55,x.codigo,x.display,x.ordem,true
  from (values
    ('1','Parcial',1),('2','Final',2),('3','Complementar',3),('4','Total',4)
  ) as x(codigo,display,ordem)
  on conflict(code_system_id,codigo) do update set display=excluded.display,ordem=excluded.ordem,ativo=true,updated_at=now();
end $$;
