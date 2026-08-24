begin;

-- P0 Segurança: catálogo granular de autorização por domínio hospitalar.
-- Mantém códigos legados para compatibilidade com policies e perfis já implantados.
insert into public.permissoes(codigo, descricao)
values
  ('agenda.visualizar','Visualizar agenda'),
  ('agenda.criar','Criar agendamentos'),
  ('agenda.editar','Editar agendamentos'),
  ('recepcao.visualizar','Visualizar recepção'),
  ('recepcao.operar','Operar recepção'),
  ('senhas.visualizar','Visualizar filas e senhas'),
  ('senhas.chamar','Chamar senhas'),
  ('paineis.visualizar','Visualizar painéis de chamada'),
  ('paineis.configurar','Configurar painéis de chamada'),
  ('autorizacoes.visualizar','Visualizar autorizações'),
  ('autorizacoes.editar','Gerenciar autorizações'),
  ('autorizacoes.solicitar','Solicitar autorizações'),
  ('autorizacoes.decidir','Registrar decisão de autorização'),
  ('guias.visualizar','Visualizar central de guias'),
  ('guias.gerenciar','Gerenciar central de guias'),
  ('triagem.visualizar','Visualizar triagens'),
  ('triagem.registrar','Registrar triagem'),
  ('triagem.encaminhar','Encaminhar após triagem'),
  ('fila_medica.visualizar','Visualizar fila médica'),
  ('fila_medica.assumir','Assumir paciente na fila médica'),
  ('fila_medica.operar','Operar fila médica'),
  ('prontuario.visualizar','Visualizar prontuário'),
  ('prontuario.evoluir','Evoluir prontuário'),
  ('prontuario.assinar','Assinar documento clínico'),
  ('prontuario.adendo','Registrar adendo em documento clínico'),
  ('prescricao.visualizar','Visualizar prescrições'),
  ('prescricao.criar','Criar prescrições'),
  ('prescricao.assinar','Assinar prescrições'),
  ('prescricao.suspender','Suspender prescrições'),
  ('assistencial.visualizar','Visualizar central assistencial'),
  ('assistencial.registrar','Registrar dados assistenciais'),
  ('enfermagem.visualizar','Visualizar enfermagem'),
  ('enfermagem.gerenciar','Gerenciar enfermagem'),
  ('enfermagem.registrar','Registrar processo de enfermagem'),
  ('enfermagem.checar','Checar cuidados de enfermagem'),
  ('farmacia.visualizar','Visualizar farmácia'),
  ('farmacia.gerenciar','Gerenciar farmácia'),
  ('farmacia.validar','Validar prescrição farmacêutica'),
  ('farmacia.dispensar','Dispensar medicamentos'),
  ('farmacia.devolver','Registrar devolução de medicamentos'),
  ('medicamentos.administrar','Administrar medicamentos à beira-leito'),
  ('laboratorio.visualizar','Visualizar laboratório'),
  ('laboratorio.gerenciar','Gerenciar laboratório'),
  ('laboratorio.coletar','Coletar e receber amostras'),
  ('laboratorio.resultar','Registrar resultados laboratoriais'),
  ('laboratorio.liberar','Liberar resultados laboratoriais'),
  ('laboratorio.criticos','Comunicar resultados críticos'),
  ('imagem.visualizar','Visualizar diagnóstico por imagem'),
  ('imagem.gerenciar','Gerenciar diagnóstico por imagem'),
  ('imagem.agendar','Agendar exame de imagem'),
  ('imagem.executar','Executar exame de imagem'),
  ('imagem.laudar','Registrar laudo de imagem'),
  ('imagem.liberar','Liberar laudo de imagem'),
  ('exames.visualizar','Visualizar solicitações de exames'),
  ('exames.gerenciar','Gerenciar solicitações de exames'),
  ('internacao.visualizar','Visualizar internações'),
  ('internacao.criar','Criar internações'),
  ('internacao.editar','Editar internações'),
  ('internacao.gerenciar','Gerenciar internações'),
  ('internacao.admitir','Admitir paciente em internação'),
  ('internacao.movimentar','Movimentar paciente e leito'),
  ('internacao.alta','Registrar alta hospitalar'),
  ('centro_cirurgico.visualizar','Visualizar centro cirúrgico'),
  ('centro_cirurgico.operar','Operar centro cirúrgico e CME'),
  ('nutricao.visualizar','Visualizar nutrição clínica'),
  ('nutricao.operar','Operar nutrição clínica'),
  ('hemoterapia.visualizar','Visualizar hemoterapia'),
  ('hemoterapia.operar','Operar hemoterapia'),
  ('ccih.visualizar','Visualizar CCIH'),
  ('ccih.operar','Operar CCIH'),
  ('uti.visualizar','Visualizar UTI'),
  ('uti.operar','Operar UTI'),
  ('compras.visualizar','Visualizar compras'),
  ('compras.gerenciar','Gerenciar compras'),
  ('compras.solicitar','Criar solicitação de compra'),
  ('compras.cotar','Gerenciar cotação de compra'),
  ('compras.aprovar','Aprovar compra'),
  ('compras.receber','Receber compra'),
  ('estoque.visualizar','Visualizar estoque'),
  ('estoque.gerenciar','Gerenciar estoque'),
  ('estoque.movimentar','Movimentar estoque'),
  ('estoque.inventariar','Executar inventário de estoque'),
  ('credenciamento.visualizar','Visualizar credenciamento'),
  ('credenciamento.gerenciar','Gerenciar credenciamento'),
  ('comercial.visualizar','Visualizar contratos e regras comerciais'),
  ('comercial.editar','Editar contratos e regras comerciais'),
  ('tabelas_comerciais.visualizar','Visualizar tabelas comerciais'),
  ('tabelas_comerciais.gerenciar','Gerenciar tabelas comerciais'),
  ('tabelas_procedimentos.visualizar','Visualizar tabelas de procedimentos'),
  ('tabelas_procedimentos.gerenciar','Gerenciar tabelas de procedimentos'),
  ('auditoria.visualizar','Visualizar auditoria'),
  ('auditoria.executar','Executar auditoria'),
  ('auditoria.analisar','Analisar conta em auditoria'),
  ('auditoria.liberar','Liberar conta na auditoria'),
  ('contas_medicas.visualizar','Visualizar contas médicas'),
  ('contas_medicas.processar','Processar contas médicas'),
  ('contas_medicas.analisar','Analisar conta médica'),
  ('contas_medicas.liberar','Liberar conta médica'),
  ('faturamento.visualizar','Visualizar faturamento'),
  ('faturamento.criar','Criar pré-faturamento'),
  ('faturamento.fechar','Fechar faturamento'),
  ('tiss.visualizar','Visualizar operação TISS'),
  ('tiss.gerar','Gerar artefatos TISS'),
  ('tiss.enviar','Enviar TISS para operadora'),
  ('tiss.retorno','Processar retorno TISS'),
  ('glosas.visualizar','Visualizar glosas e recursos'),
  ('glosas.registrar','Registrar glosa'),
  ('glosas.recorrer','Criar e enviar recurso de glosa'),
  ('financeiro.visualizar','Visualizar financeiro'),
  ('financeiro.gerenciar','Gerenciar financeiro'),
  ('financeiro.receber','Registrar recebimento'),
  ('financeiro.conciliar','Executar conciliação financeira'),
  ('nfse.visualizar','Visualizar NFS-e'),
  ('nfse.gerenciar','Gerenciar NFS-e'),
  ('nfse.configurar','Configurar NFS-e'),
  ('nfse.emitir','Emitir NFS-e'),
  ('ged.visualizar','Visualizar GED'),
  ('ged.gerenciar','Gerenciar GED'),
  ('ged.enviar','Enviar documento ao GED'),
  ('ged.administrar','Administrar documentos do GED'),
  ('diretoria.visualizar','Visualizar painel da diretoria'),
  ('configuracoes.visualizar','Visualizar configurações'),
  ('configuracoes.administrar','Administrar configurações')
on conflict (codigo) do update
set descricao = excluded.descricao,
    ativo = true,
    updated_at = now();

-- Perfis de sistema existentes recebem apenas capacidades equivalentes ao seu domínio.
-- Administradores continuam sincronizados com todo o catálogo pelo trigger existente.
insert into public.perfil_permissoes(perfil_id, permissao_id)
select pf.id, pe.id
from public.perfis pf
join public.permissoes pe on pe.ativo
where pf.ativo
  and pf.sistema
  and lower(unaccent(pf.nome)) in ('administrador','admin')
on conflict do nothing;

insert into public.perfil_permissoes(perfil_id, permissao_id)
select pf.id, pe.id
from public.perfis pf
join public.permissoes pe on pe.codigo = any(array[
  'pacientes.visualizar','pacientes.criar','pacientes.editar',
  'agenda.visualizar','agenda.criar','agenda.editar',
  'recepcao.visualizar','recepcao.operar','senhas.visualizar','senhas.chamar','paineis.visualizar',
  'atendimentos.visualizar','atendimentos.abrir','atendimentos.transferir',
  'autorizacoes.visualizar','autorizacoes.editar','autorizacoes.solicitar','guias.visualizar','guias.gerenciar'
])
where pf.ativo and pf.sistema and lower(unaccent(pf.nome)) in ('recepcao','recepção')
on conflict do nothing;

insert into public.perfil_permissoes(perfil_id, permissao_id)
select pf.id, pe.id
from public.perfis pf
join public.permissoes pe on pe.codigo = any(array[
  'pacientes.visualizar','atendimentos.visualizar',
  'fila_medica.visualizar','fila_medica.assumir','fila_medica.operar',
  'prontuario.visualizar','prontuario.evoluir','prontuario.assinar','prontuario.adendo',
  'prescricao.visualizar','prescricao.criar','prescricao.assinar','prescricao.suspender',
  'assistencial.visualizar','assistencial.registrar',
  'exames.visualizar','exames.gerenciar','laboratorio.visualizar','imagem.visualizar',
  'internacao.visualizar','internacao.criar','internacao.admitir'
])
where pf.ativo and pf.sistema and lower(unaccent(pf.nome)) in ('medico','médico')
on conflict do nothing;

insert into public.perfil_permissoes(perfil_id, permissao_id)
select pf.id, pe.id
from public.perfis pf
join public.permissoes pe on pe.codigo = any(array[
  'pacientes.visualizar','atendimentos.visualizar',
  'triagem.visualizar','triagem.registrar','triagem.encaminhar',
  'prontuario.visualizar','prontuario.evoluir','prescricao.visualizar',
  'assistencial.visualizar','assistencial.registrar',
  'enfermagem.visualizar','enfermagem.gerenciar','enfermagem.registrar','enfermagem.checar',
  'medicamentos.administrar','internacao.visualizar'
])
where pf.ativo and pf.sistema and lower(unaccent(pf.nome)) = 'enfermagem'
on conflict do nothing;

insert into public.perfil_permissoes(perfil_id, permissao_id)
select pf.id, pe.id
from public.perfis pf
join public.permissoes pe on pe.codigo = any(array[
  'autorizacoes.visualizar','guias.visualizar','guias.gerenciar',
  'faturamento.visualizar','faturamento.criar','faturamento.fechar',
  'tiss.visualizar','tiss.gerar','tiss.enviar','tiss.retorno',
  'glosas.visualizar','glosas.registrar','glosas.recorrer',
  'financeiro.visualizar','nfse.visualizar',
  'comercial.visualizar','credenciamento.visualizar','tabelas_comerciais.visualizar','tabelas_procedimentos.visualizar'
])
where pf.ativo and pf.sistema and lower(unaccent(pf.nome)) = 'faturamento'
on conflict do nothing;

insert into public.perfil_permissoes(perfil_id, permissao_id)
select pf.id, pe.id
from public.perfis pf
join public.permissoes pe on pe.codigo = any(array[
  'auditoria.visualizar','auditoria.executar','auditoria.analisar','auditoria.liberar',
  'contas_medicas.visualizar','contas_medicas.processar','contas_medicas.analisar',
  'faturamento.visualizar','prontuario.visualizar'
])
where pf.ativo and pf.sistema and lower(unaccent(pf.nome)) = 'auditoria'
on conflict do nothing;

insert into public.perfil_permissoes(perfil_id, permissao_id)
select pf.id, pe.id
from public.perfis pf
join public.permissoes pe on pe.codigo = any(array[
  'financeiro.visualizar','financeiro.gerenciar','financeiro.receber','financeiro.conciliar',
  'nfse.visualizar','nfse.gerenciar','nfse.configurar','nfse.emitir',
  'faturamento.visualizar','glosas.visualizar'
])
where pf.ativo and pf.sistema and lower(unaccent(pf.nome)) = 'financeiro'
on conflict do nothing;

insert into public.perfil_permissoes(perfil_id, permissao_id)
select pf.id, pe.id
from public.perfis pf
join public.permissoes pe on pe.codigo = any(array[
  'compras.visualizar','compras.gerenciar','compras.solicitar','compras.cotar','compras.aprovar','compras.receber',
  'estoque.visualizar','estoque.gerenciar','estoque.movimentar','estoque.inventariar'
])
where pf.ativo and pf.sistema and lower(unaccent(pf.nome)) = 'compras e estoque'
on conflict do nothing;

-- Gestão de perfis é permitida apenas a usuários com usuarios.administrar.
drop policy if exists perfis_admin_insert on public.perfis;
create policy perfis_admin_insert on public.perfis
for insert to authenticated
with check (
  public.tem_empresa(empresa_id)
  and public.tem_permissao(empresa_id, null, 'usuarios.administrar')
);

drop policy if exists perfis_admin_update on public.perfis;
create policy perfis_admin_update on public.perfis
for update to authenticated
using (
  public.tem_empresa(empresa_id)
  and public.tem_permissao(empresa_id, null, 'usuarios.administrar')
)
with check (
  public.tem_empresa(empresa_id)
  and public.tem_permissao(empresa_id, null, 'usuarios.administrar')
);

drop policy if exists perfil_permissoes_admin_insert on public.perfil_permissoes;
create policy perfil_permissoes_admin_insert on public.perfil_permissoes
for insert to authenticated
with check (
  exists(
    select 1 from public.perfis pf
    where pf.id = perfil_id
      and public.tem_permissao(pf.empresa_id, null, 'usuarios.administrar')
  )
);

drop policy if exists perfil_permissoes_admin_delete on public.perfil_permissoes;
create policy perfil_permissoes_admin_delete on public.perfil_permissoes
for delete to authenticated
using (
  exists(
    select 1 from public.perfis pf
    where pf.id = perfil_id
      and public.tem_permissao(pf.empresa_id, null, 'usuarios.administrar')
  )
);

drop policy if exists usuario_perfis_admin_insert on public.usuario_perfis;
create policy usuario_perfis_admin_insert on public.usuario_perfis
for insert to authenticated
with check (
  public.tem_empresa(empresa_id)
  and public.tem_permissao(empresa_id, unidade_id, 'usuarios.administrar')
  and exists(
    select 1 from public.usuario_empresas ue
    where ue.usuario_id = usuario_perfis.usuario_id
      and ue.empresa_id = usuario_perfis.empresa_id
      and ue.ativo
  )
);

drop policy if exists usuario_perfis_admin_update on public.usuario_perfis;
create policy usuario_perfis_admin_update on public.usuario_perfis
for update to authenticated
using (
  public.tem_permissao(empresa_id, unidade_id, 'usuarios.administrar')
)
with check (
  public.tem_empresa(empresa_id)
  and public.tem_permissao(empresa_id, unidade_id, 'usuarios.administrar')
);

drop policy if exists usuario_perfis_admin_delete on public.usuario_perfis;
create policy usuario_perfis_admin_delete on public.usuario_perfis
for delete to authenticated
using (
  public.tem_permissao(empresa_id, unidade_id, 'usuarios.administrar')
);

create index if not exists auditoria_eventos_usuario_data_idx
  on public.auditoria_eventos(usuario_id, created_at desc);
create index if not exists auditoria_eventos_entidade_registro_data_idx
  on public.auditoria_eventos(entidade, registro_id, created_at desc)
  where registro_id is not null;

-- A função de trigger já é usada internamente; nunca deve ser RPC pública.
revoke all on function public.sincronizar_permissao_administradores_sistema()
  from public, anon, authenticated;

commit;
