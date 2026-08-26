# Cadastro de Paciente e Abertura de Atendimento TISS

## Objetivo

Padronizar a identificação do paciente/beneficiário e impedir que o atendimento nasça com dados administrativos que gerem inconsistência clínica, autorização incompleta ou glosa evitável.

## Cadastro de paciente

### Identificação

- **Nome de registro**: usado no faturamento e snapshots regulatórios.
- **Nome social**: quando preenchido, é a identidade preferencial nas telas assistenciais e de chamada; o nome de registro é preservado.
- **Data de nascimento**: determina automaticamente a maioridade.
- **Sexo regulatório do novo cadastro**: Masculino, Feminino ou Não informado.
- **CPF**: obrigatório no fluxo padrão e validado por dígitos verificadores no servidor.
- **CNS**: 15 dígitos, com triagem local de consistência. A confirmação definitiva pode depender do CADSUS.
- **Foto**: webcam ou upload em bucket privado.

### Convênio do beneficiário

O vínculo principal fica em `paciente_convenios` e contém:

- operadora;
- plano/produto;
- carteirinha;
- validade;
- indicador de vínculo principal;
- último status/protocolo de elegibilidade, quando disponível.

O plano pode configurar `carteirinha_mascara`, `carteirinha_regex` e `exige_validade_carteirinha`.

### Contato e LGPD

Endereço usa ViaCEP como assistência de preenchimento. Consentimentos de comunicação são registrados separadamente em `paciente_comunicacao_consentimentos`, por canal e finalidade. Não confundir consentimento de lembretes com consentimento clínico.

### Responsável

Para paciente menor de 18 anos, o fluxo exige nome, CPF válido e parentesco do responsável. O vínculo é persistido em `paciente_responsaveis`.

### Alertas

Alertas relevantes podem ser registrados em `paciente_alertas`. A admissão também consulta alergias clínicas ativas para exibição destacada.

## Abertura do atendimento

A abertura continua sendo originada por **senha do Totem/Recepção** ou **agendamento com check-in**. As RPCs `abrir_atendimento_por_senha_v2` e `abrir_atendimento_por_agendamento_v2` executam a abertura antiga e a validação TISS na mesma transação.

### Identificação da guia

- `numero_guia_prestador` é sequencial no banco e não pode ser alterado depois da criação.
- data/hora de abertura usa o relógio do banco/servidor;
- Registro ANS e CNES são fotografados no episódio;
- conselho, número, UF, CBO e especialidade do profissional também são fotografados.

### Bloqueios antiglosa para convênio

A abertura é bloqueada quando aplicável se houver:

- profissional ausente;
- conselho/número/UF incompletos;
- CBO ausente;
- CNES da unidade ausente;
- Registro ANS da operadora ausente;
- validade obrigatória não informada;
- carteira vencida;
- carteirinha fora do regex configurado no plano;
- classificação TISS inválida;
- TUSS obrigatório ausente;
- indicação clínica ausente para SADT/exames, pequena cirurgia ou sessão de terapia.

### TUSS

A busca inteligente utiliza `buscar_tuss_admissao`, pesquisando código ou descrição nos itens assistenciais ativos. Para consulta sem pacote/regra contratual específica, a interface sugere:

- **10101012** — consulta ambulatorial;
- **10101039** — consulta em pronto atendimento.

Esses códigos são candidatos/fallbacks. O motor contratual e o Livro de Produção continuam responsáveis por pacote, código contratado e precificação final.

### Retorno em 30 dias

`verificar_retorno_30_dias` procura atendimento anterior da mesma especialidade, na mesma unidade, em até 30 dias. O resultado é um alerta operacional; não é decisão automática de cobrança.

### Token / biometria

Quando exigida pela operadora, a identificação do beneficiário usa a configuração já existente de convênio. O HIS persiste somente hash/referência da validação, e não o token em texto puro ou a imagem biométrica.

### Documentos

PDF/JPG/PNG da admissão podem ser anexados por drag-and-drop. Os arquivos são enviados ao bucket privado `documentos-pacientes` e registrados no GED vinculados ao paciente e atendimento.

## Elegibilidade online

A tela verifica se existe Webservice TISS configurado para a operadora/unidade e mostra o último status de elegibilidade conhecido do vínculo do beneficiário. O sistema **não simula resposta da operadora**. A operação online depende da parametrização específica do endpoint/operação de elegibilidade da operadora e deve reutilizar o módulo de Webservices TISS.

## Segurança e rastreabilidade

- tabelas novas usam RLS por empresa;
- RPCs internas não são executáveis por `anon`/`authenticated` quando marcadas como internas;
- as RPCs públicas de abertura exigem sessão autenticada e permissões já validadas pelo fluxo de admissão;
- dados TISS são armazenados como snapshot do momento da abertura para evitar alteração retroativa de guias.
