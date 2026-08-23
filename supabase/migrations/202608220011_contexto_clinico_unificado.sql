create or replace view public.vw_atendimento_contexto_clinico
with (security_invoker = true)
as
select
  a.id as atendimento_id,
  a.empresa_id,
  a.unidade_id,
  a.numero_atendimento,
  a.status,
  a.data_abertura,
  a.paciente_id,
  p.numero_registro,
  p.ra,
  p.nome_completo as paciente_nome,
  p.cpf as paciente_cpf,
  p.cns as paciente_cns,
  a.cobertura,
  a.convenio_id,
  a.plano_id,
  a.numero_carteirinha,
  a.validade_carteirinha,
  a.numero_autorizacao,
  a.senha_autorizacao,
  (select row_to_json(t) from (
    select tr.peso_kg,tr.altura_cm,tr.pressao_arterial,tr.frequencia_cardiaca,tr.frequencia_respiratoria,tr.saturacao_o2,tr.temperatura_c,tr.glicemia_mg_dl,tr.dor_escala,tr.classificacao_risco,tr.queixa_principal,tr.observacoes,tr.updated_at
    from public.triagens tr where tr.atendimento_id=a.id order by tr.updated_at desc limit 1
  ) t) as ultima_triagem,
  (select count(*) from public.prontuario_evolucoes pe where pe.atendimento_id=a.id) as total_evolucoes,
  (select count(*) from public.prescricoes pr where pr.atendimento_id=a.id) as total_prescricoes,
  (select count(*) from public.internacoes i where i.atendimento_id=a.id and i.status in ('aguardando_leito','internado','transferido')) as internacoes_ativas
from public.atendimentos a
join public.pacientes p on p.id=a.paciente_id;

grant select on public.vw_atendimento_contexto_clinico to authenticated;
comment on view public.vw_atendimento_contexto_clinico is 'Contexto unificado do episodio assistencial para prontuario/atendimento medico. Respeita RLS das tabelas base via security_invoker.';