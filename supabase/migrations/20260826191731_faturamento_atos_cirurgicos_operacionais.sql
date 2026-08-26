alter table public.conta_faturamento_grupos_ato
  add column if not exists procedimento_principal_codigo text,
  add column if not exists procedimento_principal_descricao text,
  add column if not exists sala text,
  add column if not exists inicio_ato timestamptz,
  add column if not exists fim_ato timestamptz,
  add column if not exists porte_sala text,
  add column if not exists porte_anestesico text,
  add column if not exists potencial_contaminacao text,
  add column if not exists sala_contaminada boolean not null default false;

alter table public.conta_faturamento_grupos_ato
  drop constraint if exists conta_faturamento_grupos_ato_horario_check;

alter table public.conta_faturamento_grupos_ato
  add constraint conta_faturamento_grupos_ato_horario_check
  check (inicio_ato is null or fim_ato is null or fim_ato >= inicio_ato);

create index if not exists idx_conta_grupo_ato_sala_data
  on public.conta_faturamento_grupos_ato(conta_id,data_ato,sala);
