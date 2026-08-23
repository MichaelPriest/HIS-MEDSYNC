# MedSync HIS

HIS (Hospital Information System) multiempresa/multiunidade em desenvolvimento, construído com Next.js, Supabase/PostgreSQL e deploy na Vercel.

> **Importante:** o projeto está em evolução. Ter uma tela ou estrutura de banco não significa que o módulo esteja homologado para uso hospitalar em produção. O objetivo deste README é registrar o estado funcional atual e o que ainda precisa ser concluído.

## Stack

- Next.js 15 / React / TypeScript
- Supabase: PostgreSQL, Auth, RLS e Storage
- Vercel
- Tailwind CSS / Lucide
- Integrações planejadas: TISS/ANS, webservices de operadoras, NFS-e/prefeituras e serviços externos homologados

## Fluxo assistencial e administrativo projetado

```text
Totem/Senha
  → Recepção / ADT
  → Autorização / Central de Guias
  → Triagem
  → Fila por especialidade
  → Atendimento médico / Prontuário
  → Enfermagem / Farmácia / Laboratório / Imagem / Internação
  → Alta
  → Auditoria pós-alta
  → Contas Médicas
  → Pré-faturamento
  → TISS / Lote / Operadora
  → Glosas / Recursos
  → Financeiro / NFS-e
```

Os módulos corporativos alimentam o mesmo fluxo:

```text
Comercial/Credenciamento → contratos/tabelas/regras
Compras → recebimento → Almoxarifado/Farmácia → consumo → conta hospitalar
Compras → Financeiro/Contas a pagar
GED → documentos clínicos/administrativos/financeiros
Diretoria → indicadores consolidados
```

## O que já foi criado

### Fundação e interface

- autenticação Supabase e sessão SSR;
- estrutura multiempresa/multiunidade;
- RLS e base de auditoria;
- interface com sidebar, topbar, cards e navegação responsiva;
- Meu Perfil;
- configuração de painéis e chamadas.

### Cadastros

- pacientes com RA e número de registro;
- dados pessoais, contatos e endereços;
- profissionais e tipos de profissionais;
- dados de conselho/especialidade/CBO e base para contratos;
- convênios e planos;
- catálogos e cadastros auxiliares;
- suporte a fotos/logotipos conforme o cadastro.

### Recepção e assistência

- totem/senhas com identificação por CPF;
- recepção e abertura do atendimento;
- cobertura particular ou convênio;
- carteirinha/plano/autorização no episódio;
- Central de Guias e autorizações;
- triagem com classificação e definição da especialidade de destino;
- fila médica por especialidade/profissional logado;
- base do prontuário e atendimento médico;
- prescrição;
- internação;
- filas setoriais de Enfermagem, Farmácia, Laboratório, Imagem e Internação;
- movimentação do paciente entre setores mantendo o mesmo atendimento.

### Auditoria, Contas Médicas e GED

- Auditoria pós-alta antes do faturamento;
- pendências com alerta/erro/bloqueio;
- liberação obrigatória da Auditoria;
- Contas Médicas entre Auditoria e TISS;
- checklist documental por convênio;
- bloqueio de faturamento enquanto houver pendência obrigatória;
- GED transversal vinculado a paciente, atendimento, conta, convênio e lote.

### Comercial e credenciamento

- contratos de convênios;
- vigências e prazos;
- tabelas comerciais versionadas;
- tabelas próprias de operadora;
- SIMPRO, BRASÍNDICE e OPME por edição/vigência;
- AMB 90, AMB 92, AMB 96, AMB 99;
- CBHPM por edição;
- edição fixa ou edição vigente na data do atendimento;
- regras de CH/HM, CH/SADT, valores fixos, porte/UCO e ajustes contratuais;
- regras avançadas de múltiplos procedimentos, via, urgência, acomodação, auxiliares, anestesia e filme;
- pacotes contratuais;
- memória de cálculo e auditoria de valor contratado.

### Conta hospitalar e faturamento

- criação de conta por atendimento;
- itens faturáveis;
- competência;
- críticas TISS;
- auditoria contratual de valores;
- grupos de ato cirúrgico/SADT;
- sequência de procedimentos no mesmo ato;
- comparação valor lançado × valor contratual;
- bloqueios Auditoria → Contas Médicas → TISS;
- guia TISS em rascunho;
- lotes TISS;
- competência e previsão de pagamento do lote;
- protocolos, anexos, glosas e recursos.

### TISS

- fundação de versões/componentes TISS;
- guias, itens, lotes e artefatos XML;
- configuração de webservice por operadora e ambiente;
- SOAP/HTTP XML como camada de transporte;
- operação manual paralela ao webservice;
- importação de XML recebido;
- histórico de transmissão;
- bloqueio de envio/download final enquanto o XML não estiver validado por XSD.

**Pendente crítico:** incorporar os schemas XSD oficiais aplicáveis da ANS e concluir os geradores/validadores de mensagens TISS. XML preliminar não deve ser tratado como XML TISS homologado.

### Compras, Almoxarifado e Farmácia

- solicitações de compra;
- fornecedores;
- cotações e comparação de propostas;
- escolha de fornecedor;
- pedidos;
- estrutura para recebimento parcial/total;
- recebimento vinculado a documento fiscal;
- entrada em estoque;
- lote e validade;
- destino Almoxarifado/Farmácia;
- geração de obrigação em Contas a Pagar.

### Financeiro e NFS-e

- contas a receber por lote;
- previsão de pagamento;
- valores bruto, glosa, líquido e recebido;
- estrutura de contas a pagar;
- central de NFS-e;
- configuração municipal por unidade;
- operação manual via portal da prefeitura;
- arquitetura para API/webservice de prefeitura;
- referências seguras para credenciais/certificados.

### Diretoria

- base de dashboard executivo com indicadores assistenciais, faturamento, recebíveis, pagamentos, glosas, auditoria e Contas Médicas.

## O que ainda falta / precisa ser aprofundado

### Assistencial

- prontuário clínico completo: anamnese estruturada, antecedentes, alergias, problemas, CID, SOAP, exame físico, escalas, conduta e assinatura;
- SAE de Enfermagem completa;
- prescrição hospitalar completa e checagem à beira leito;
- dispensação/devolução/administração de medicamentos;
- laboratório: solicitação, coleta, amostra, resultado, referência, liberação e assinatura;
- imagem: solicitação, execução, laudo e liberação;
- internação: mapa de leitos, transferências, diárias, isolamento e alta;
- urgência/emergência completa;
- centro cirúrgico, anestesia, RPA, checklist de cirurgia segura, OPME e CME;
- Nutrição, Banco de Sangue/Hemoterapia e demais módulos hospitalares necessários.

### Suprimentos

- converter cotação aprovada automaticamente em pedido;
- aprovações por alçada;
- recebimento parcial com divergências;
- requisição interna por setor;
- inventário e ajustes;
- estoque mínimo/ponto de reposição;
- rastreabilidade completa de lote/validade;
- consumo automático por paciente e conta;
- devoluções e perdas;
- aprofundar integração Farmácia ↔ Prescrição ↔ Enfermagem ↔ Conta.

### Comercial / Contas Médicas

- regras adicionais específicas de contratos reais;
- pacotes automáticos na conta;
- cobrança de excedentes/exclusões;
- checklist documental automático por produto/plano/procedimento;
- conferência automática autorização × executado × cobrado × contrato;
- versionamento/importação operacional das tabelas comerciais reais licenciadas.

### TISS

- XSD oficiais ANS no projeto;
- geradores XML definitivos por mensagem/guia;
- validação XSD real;
- adapters homologados de operadoras;
- mTLS/certificados quando exigidos;
- consulta de protocolo/status;
- importação e interpretação automática dos retornos/demonstrativos;
- geração definitiva de Recurso de Glosa.

### Financeiro

- baixa total/parcial;
- retenções tributárias;
- conciliação bancária;
- contas a pagar operacional;
- fluxo de caixa e DRE gerencial;
- integração real com provedores NFS-e/prefeituras utilizadas pela instituição.

### Segurança e produção

- concluir matriz de permissões por módulo/ação;
- ampliar trilha de auditoria clínica e administrativa;
- políticas LGPD, consentimento, acesso emergencial e assinatura;
- testes unitários/integrados/E2E dos fluxos críticos;
- homologação TISS e integrações externas;
- homologação operacional antes de produção.

## Manual do usuário

O sistema possui um módulo interno em **`/manual`**. A documentação textual complementar fica em [`docs/MANUAL.md`](docs/MANUAL.md).

## Requisitos

Node.js 22.x (conforme `package.json`), npm e Supabase CLI/Docker para banco local.

## Instalação

```bash
cp .env.example .env.local
npm ci
supabase start
supabase db reset
npm run dev
```

Nunca envie segredos ao repositório. Configure as URLs autorizadas no Supabase Auth.

## Qualidade

```bash
npm run lint
npm run typecheck
npm test
npm run build
supabase test db
npm run test:e2e
```

## Ambientes e deploy

Use projetos Supabase distintos para development, preview e production. Na Vercel cadastre as variáveis do Supabase por ambiente. Preview nunca deve utilizar banco/chave de produção.

O projeto atualmente pode apresentar falha de check da Vercel quando a conta atingir o **build rate limit**; isso é diferente de erro de TypeScript/build e deve ser analisado separadamente.

## Supabase / Vercel

A configuração preferencial usa:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` somente no servidor quando necessário
- `NEXT_PUBLIC_APP_ENV`

Também há compatibilidade com nomes legados já previstos no código. Depois de alterar variáveis `NEXT_PUBLIC_*`, publique um novo build; um deploy já criado não recebe esses valores retroativamente.

## Documentação

- [`docs/STATUS.md`](docs/STATUS.md) — estado do desenvolvimento;
- [`docs/MANUAL.md`](docs/MANUAL.md) — manual operacional;
- migrations em `supabase/migrations/` — evolução do banco e regras de negócio.
