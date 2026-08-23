# Manual Operacional — MedSync HIS

> Manual em evolução. As telas podem mudar durante o desenvolvimento. Algumas integrações (TISS definitivo, webservices de operadoras e NFS-e municipal) dependem de homologação externa.

## 1. Visão geral

O MedSync HIS foi projetado para que o mesmo atendimento acompanhe o paciente da entrada até o recebimento financeiro. Evite criar registros paralelos quando já existir um episódio aberto.

Fluxo principal:

`Totem → Recepção → Atendimento → Autorização → Triagem → Médico → Setores → Alta → Auditoria → Contas Médicas → Faturamento/TISS → Financeiro`.

## 2. Cadastros iniciais

Antes da operação, configure:

1. unidades/empresa e usuários;
2. pacientes;
3. profissionais e vínculo do profissional com usuário logado;
4. convênios e planos;
5. contratos/credenciamento;
6. tabelas comerciais e respectivas edições;
7. regras de cálculo e pacotes;
8. webservices TISS, se utilizados;
9. prefeitura/provedor NFS-e, se utilizado.

### Paciente

Cadastre dados pessoais, CPF, RG, nascimento, sexo, nacionalidade, estado civil, contatos e endereços. O paciente recebe RA/número de registro conforme o fluxo configurado. Use esses identificadores nas buscas para evitar duplicidade.

### Profissional

Cadastre tipo profissional, conselho, número/UF, especialidade, CBO, contatos e dados contratuais. Para fila médica, associe o profissional ao usuário que fará login.

### Convênio

Cadastre operadora, Registro ANS, planos, endereços, logo e parâmetros comerciais. Depois configure contratos, tabelas e autorizações exigidas.

## 3. Totem e Recepção

No Totem o paciente retira uma senha. Quando disponível, pode informar CPF para facilitar a identificação.

Na Recepção:

1. chame a senha;
2. localize o paciente por nome, CPF, RA ou registro;
3. confirme novamente os dados do paciente;
4. informe se o atendimento é Particular ou Convênio;
5. para convênio, selecione plano, carteirinha e demais dados;
6. abra o atendimento.

Nunca presuma que os dados cadastrais antigos continuam corretos; a admissão é um ponto de conferência.

## 4. Central de Guias e Autorizações

Use a Central de Guias para controlar consulta, SADT, internação, prorrogação, OPME, medicamentos e demais autorizações.

Registre quando aplicável:

- guia do prestador;
- guia da operadora;
- senha;
- protocolo;
- validade;
- código e descrição do procedimento;
- quantidade solicitada/autorizada;
- valor solicitado, contratual e autorizado.

Divergências entre valor contratado e autorizado devem ser analisadas antes do faturamento.

## 5. Triagem

A Triagem registra sinais vitais, queixa, risco e demais informações disponíveis. A especialidade de destino é obrigatória para o encaminhamento médico.

Ao concluir, o atendimento entra na fila correspondente à especialidade.

## 6. Fila médica e prontuário

O profissional logado acessa **Minha Fila Médica**. Ao assumir um paciente, o atendimento fica atribuído ao profissional e o prontuário é aberto no mesmo episódio.

Dados produzidos por outros módulos devem permanecer visíveis no contexto do atendimento: triagem, autorizações, prescrições, exames, movimentações, internação e documentos.

## 7. Encaminhamentos setoriais

Durante o atendimento, o paciente pode ser encaminhado para:

- Enfermagem;
- Farmácia;
- Laboratório;
- Diagnóstico por Imagem;
- Internação.

Cada setor trabalha sua fila, mas o vínculo permanece no mesmo `atendimento_id`.

## 8. Alta e Auditoria

Depois da alta, a conta segue para **Auditoria pós-alta**.

A Auditoria verifica consistência clínica/administrativa, cobrança, documentação, autorizações e pendências. Pendências classificadas como erro/bloqueio impedem a liberação.

Somente após liberação a conta segue para Contas Médicas.

## 9. Contas Médicas

Contas Médicas é a conferência final antes do faturamento/TISS.

Use o checklist documental para verificar documentos obrigatórios por convênio. Cada requisito pode ser marcado como:

- Pendente;
- OK;
- Não aplicável;
- Divergente.

Vincule documentos do GED quando necessário. A conta só deve ser liberada quando não houver bloqueios e os documentos obrigatórios estiverem regulares.

### Auditoria contratual

Execute o recálculo de valores. O sistema compara valor lançado com o valor contratual segundo contrato, tabela, edição e regras vigentes na data do atendimento.

## 10. Comercial / Credenciamento

### Tabelas

Use `/comercial/tabelas` para manter fontes e edições como:

- tabela própria;
- SIMPRO;
- BRASÍNDICE;
- OPME específica do convênio;
- outras tabelas comerciais.

Nunca sobrescreva uma edição antiga. Cadastre uma nova edição/vigência para preservar a memória histórica das contas.

### Procedimentos

Use `/comercial/procedimentos` para configurar AMB 90, AMB 92, AMB 96, AMB 99, CBHPM por edição e tabelas próprias.

Os parâmetros contratuais podem incluir CH/HM, CH/SADT, porte, UCO, valores fixos e ajustes negociados.

### Regras avançadas

Use `/comercial/regras` para percentuais de múltiplos procedimentos, mesma/diferente via, urgência, acomodação, anestesia, auxiliares, filme e pacotes.

As regras devem refletir o contrato real; não use percentuais genéricos sem validação contratual.

## 11. Conta hospitalar

No Pré-faturamento, abra a conta vinculada ao atendimento. Adicione ou confira procedimentos, materiais, medicamentos, taxas, diárias, honorários, laboratório e imagem.

### Atos cirúrgicos/SADT

Na conta é possível criar grupos de ato e classificar os itens como 1º, 2º, 3º procedimento etc., além de via, anestesia, auxiliares e filme.

Recalcule o ato para obter o valor contratual final e comparar com o lançado.

## 12. TISS

Após Auditoria e Contas Médicas, valide a conta. Corrija críticas impeditivas antes de gerar a guia.

Fluxo:

`Conta pronta → Guia → Lote → XML → XSD → envio → protocolo → retorno`.

### Operação por webservice

Configure o endpoint da operadora em `/configuracoes/tiss-webservices`, separando homologação e produção. Segredos/certificados devem ser referenciados por variáveis/cofre, nunca gravados em texto puro no banco.

### Operação manual

Se a operadora não usar webservice:

1. gere o XML;
2. valide contra o XSD aplicável;
3. faça o download;
4. envie pelo portal/canal da operadora;
5. registre o protocolo externo;
6. anexe comprovantes;
7. importe os XMLs de retorno recebidos.

**Enquanto a validação XSD oficial não estiver concluída no projeto, XML preliminar não deve ser tratado como arquivo homologado para envio.**

## 13. Glosas e recursos

Na Central de Glosas registre/importe código, motivo, valor e vínculo com guia/lote. Quando cabível, abra o recurso, informe valor recursado e justificativa e acompanhe protocolo, deferimento e indeferimento.

## 14. Compras

Fluxo previsto:

`Solicitação → Cotação → Aprovação → Pedido → Recebimento → Estoque/Farmácia → Financeiro`.

Compare propostas por fornecedor, valor, frete, prazo e condição. No recebimento registre documento fiscal, lote e validade. O recebimento alimenta estoque e gera obrigação financeira conforme configuração.

## 15. Almoxarifado e Farmácia

Mantenha produtos, lotes, validade e locais de estoque. Movimentações devem preservar rastreabilidade. Itens consumidos por paciente devem permanecer vinculados ao atendimento para posterior cobrança quando aplicável.

## 16. GED

Use o GED para centralizar documentos clínicos e administrativos. Sempre que possível, vincule o documento à entidade correta: paciente, atendimento, conta, convênio, lote ou outro processo.

## 17. Financeiro

A Central Financeira acompanha recebíveis dos lotes, previsão de pagamento, valor bruto, glosas, líquido e recebido. A baixa, retenções e conciliação ainda estão em evolução.

## 18. NFS-e

A emissão pode operar manualmente pelo portal da prefeitura ou, quando houver adapter homologado, via API/webservice.

Configure município/unidade em `/configuracoes/nfse`. Não habilite integração automática para um provedor sem adapter testado/homologado.

## 19. Diretoria

A Diretoria apresenta visão executiva de indicadores assistenciais, financeiros, glosas, auditoria e pendências. Os indicadores serão ampliados conforme os módulos operacionais forem concluídos.

## 20. Boas práticas

- pesquise antes de cadastrar para evitar duplicidades;
- nunca altere uma edição histórica de tabela para representar uma atualização nova;
- não ignore bloqueios de Auditoria/Contas Médicas;
- não envie XML TISS sem validação oficial aplicável;
- não grave senhas/tokens/certificados em campos comuns do banco;
- mantenha documentos e protocolos vinculados ao processo correto;
- confira contrato e autorização antes de faturar divergências;
- use ambientes separados para homologação e produção.

## 21. Módulos ainda em evolução

O manual será ampliado à medida que forem concluídos prontuário avançado, SAE, Farmácia clínica/dispensação, Laboratório, Imagem, mapa de leitos, Centro Cirúrgico, CME, Urgência/Emergência, Nutrição, Hemoterapia, financeiro completo, TISS homologado e integrações externas.
