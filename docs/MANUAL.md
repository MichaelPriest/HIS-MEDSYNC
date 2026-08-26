# Manual Operacional — MedSync HIS

> Manual em evolução. As telas podem mudar durante o desenvolvimento. Integrações como TISS definitivo, webservices de operadoras e NFS-e municipal dependem de homologação externa.

## 1. Visão geral

O MedSync HIS utiliza um único episódio assistencial para acompanhar o paciente da entrada até o ciclo financeiro. Não crie atendimentos paralelos quando já existir episódio ativo para a mesma jornada.

Fluxo de demanda espontânea/Pronto Atendimento:

`Totem/Senha → Recepção/Admissão → Triagem → Central de Guias (quando exigida) → Fila Médica/PS → Prontuário → Prescrição/Exames/Avaliações → Enfermagem/Setores → Alta → Auditoria → Contas Médicas → Faturamento/TISS → Financeiro`.

Fluxo ambulatorial agendado:

`Agenda → Confirmação/Check-in → Admissão → Autorização (quando exigida) → Atendimento médico ambulatorial → Prontuário → Alta ambulatorial → Faturamento`.

Ambulatório e Pronto Atendimento devem permanecer operacionalmente separados, embora utilizem o mesmo cadastro de paciente e o mesmo núcleo de prontuário.

## 2. Cadastros iniciais

Antes da operação, configure empresa/unidades, usuários e permissões, pacientes, profissionais e vínculo com login, convênios/planos, contratos/credenciamento, tabelas comerciais, regras de cálculo, estrutura hospitalar, setores de chamada e integrações aplicáveis.

### Paciente

Cadastre dados pessoais, documentos, nascimento, sexo, contatos e endereços. O paciente recebe RA/número de registro conforme o fluxo configurado. Pesquise antes de cadastrar para evitar duplicidades.

A identificação pode utilizar foto capturada pela câmera e, conforme configuração do convênio, biometria ou token. Não armazene imagem bruta da digital ou token de operadora em texto puro quando houver mecanismo de template/hash/referência segura.

### Profissional

Cadastre conselho, número/UF, especialidade, CBO, contatos e vínculos. O profissional que prescreve ou registra evolução é resolvido pelo usuário autenticado; o médico não deve selecionar a si próprio em um campo de profissional.

### Convênio

Cadastre operadora, Registro ANS, planos e parâmetros administrativos. Depois configure contratos, tabelas, regras e exigências de autorização/identificação.

## 3. Totem, senhas, painéis e Recepção

No Totem o paciente escolhe o tipo de atendimento e pode informar CPF para facilitar a identificação. As senhas da Recepção usam sequências diárias independentes:

- `G001...` — Atendimento Geral;
- `P001...` — Atendimento Preferencial;
- `E001...` — Urgência/Emergência.

Senhas históricas com outros prefixos continuam válidas no histórico. O painel chama o paciente identificado pelo **nome completo** e mantém a senha como referência operacional.

Na Recepção, chame a senha, localize/confirme o paciente, informe Particular ou Convênio, complete plano/carteirinha quando necessário e abra a admissão. Se for necessário abrir o cadastro de um paciente novo durante a admissão, a senha/admissão em andamento deve ser preservada para retomada.

## 4. Central de Guias e Autorizações

A Central de Guias controla consulta, SADT, internação, prorrogação, OPME, medicamentos e demais autorizações. Registre guia prestador/operadora, senha, protocolo, validade, procedimento, quantidade e valores quando aplicável.

Quando a triagem for concluída e a guia ainda estiver pendente, **a triagem permanece salva** e o paciente aguarda a liberação na Central de Guias. A autorização/dispensa posterior deve sincronizar o atendimento e criar o encaminhamento para a fila médica sem exigir nova triagem.

Se o convênio exigir identificação, biometria/token pode ser validado na admissão e reaproveitado pela autorização dentro da janela permitida pela configuração, evitando identificação repetida desnecessariamente.

## 5. Triagem

A Triagem registra queixa, especialidade de destino, classificação de risco, sinais vitais e demais dados disponíveis. Concluir a triagem encerra somente a etapa de triagem — não encerra o atendimento hospitalar.

Após salvar:

- atendimento liberado segue à fila médica/PS;
- atendimento de convênio com guia pendente aguarda na Central de Guias;
- após autorização/dispensa, o encaminhamento pós-triagem é criado automaticamente e sem duplicidade.

## 6. Fila médica e prontuário

O profissional logado acessa sua fila e assume o paciente. O prontuário permanece vinculado ao mesmo `atendimento_id` e apresenta o **Contexto Assistencial do Episódio**, incluindo triagem, risco, sinais vitais, cobertura, plano, carteirinha, guia, senha, protocolo e dados autorizados disponíveis.

A navegação do atendimento mantém o episódio em Resumo, Anamnese/Evolução, Prescrição e Avaliações. O atalho de Enfermagem abre a checagem já filtrada pelo mesmo atendimento e permite retorno ao prontuário de origem.

### Solicitar avaliação médica

Em **Avaliações**, o médico pode solicitar parecer/interconsulta de outra especialidade sem criar outro prontuário. Informe especialidade, prioridade (`rotina`, `urgente` ou `emergência`), motivo e observações. A solicitação registra profissional solicitante, horário, status, responsável e parecer quando concluído.

## 7. Prescrição médica diária

A prescrição utiliza o catálogo assistencial do banco para medicamentos, dietas, cuidados, procedimentos, exames e materiais conforme o tipo de lançamento. O prescritor é o profissional autenticado.

### Inclusão de itens

Itens do rascunho são salvos **em segundo plano**. Após adicionar um item, o grid é atualizado sem recarregar a página e o médico pode lançar o próximo item imediatamente. Enquanto não houver assinatura, os itens permanecem como rascunho e não devem ser liberados aos setores.

Frequências padronizadas devem calcular/apresentar os horários previstos automaticamente. Prescrições compostas podem registrar solução-base e componentes, preservando dose, diluente, volume, via e velocidade quando aplicáveis.

### Impressão

A impressão representa o fechamento diário assinado pelo profissional. Os itens devem sair em **uma única tabela contínua**, sem separar o documento em grupos visuais independentes. O formato de impressão é **A4 paisagem**, com identificação institucional, paciente, atendimento, itens, horários e prescritor.

## 8. Enfermagem

A Enfermagem visualiza prescrições dos andares e do Pronto-Socorro, aprazamentos e doses pendentes. Ao abrir pelo prontuário, use o filtro do atendimento para evitar trocar de paciente.

A checagem registra administração, recusa ou omissão, horário, profissional, dose/via, dispensação/lote quando disponível, leitura da identificação do paciente e dupla checagem quando exigida. SAE, balanço hídrico, escalas e demais evoluções permanecem em expansão.

## 9. Laboratório e Diagnóstico por Imagem

Solicitações geradas no episódio devem manter o `atendimento_id` durante coleta, processamento, resultado/laudo e faturamento.

O Laboratório possui fluxo de solicitação, amostra/accession, coleta, recebimento/rejeição, analisador, resultado, criticidade, liberação e comunicação de resultado crítico. Integrações com equipamentos devem preservar o equipamento de origem.

Diagnóstico por Imagem usa núcleo comum RIS/PACS, mas Raio-X, Tomografia e Ressonância devem ter worklists e protocolos operacionais próprios, incluindo preparos e requisitos de segurança por modalidade.

## 10. Farmácia e Almoxarifado

Farmácias podem ser setoriais, por exemplo Central, Satélite PS e Centro Cirúrgico, cada uma com estoque próprio. O fluxo deve manter validação farmacêutica, separação/dispensação, lote/validade, devolução e consumo vinculados ao paciente/atendimento.

Setores solicitam materiais ao Almoxarifado por requisição rastreável. Movimentações físicas não substituem o catálogo mestre de referência/faturamento.

## 11. Internação, NIR e leitos

A operação de Internação é separada em Painel da Internação, Mapa de Leitos, NIR e Central de Altas. O Mapa representa censo/operação física; a NIR regula reserva/alocação; a Central de Altas reúne planejamento e liberação da alta.

## 12. Centro Cirúrgico e CME

A estrutura hospitalar comporta salas cirúrgicas e equipamentos, mas o fluxo completo continua em evolução. O desenho-alvo inclui mapa cirúrgico, equipe, anestesia, OPME, checklist de cirurgia segura, intraoperatório, RPA e consumo/faturamento. A CME deve rastrear instrumental/caixas desde expurgo e esterilização até paciente/cirurgia.

## 13. Comercial / Credenciamento

Use a área Comercial para contratos, credenciamento, tabelas, regras e pacotes. Nunca sobrescreva edição histórica para representar nova vigência.

Tabelas como AMB/CBHPM e fontes comerciais devem ser versionadas por edição/vigência. Equivalências de códigos e catálogo de glosas são dados de referência, não substitutos do contrato real.

## 14. Conta hospitalar, Auditoria e Contas Médicas

O consumo assistencial deve alimentar a conta preservando o vínculo com atendimento, item, tabela e preço aplicável. Após alta, a conta passa por Auditoria e depois Contas Médicas antes do faturamento.

Pendências impeditivas não devem ser ignoradas. A auditoria contratual compara valores lançados com regras/tabelas vigentes do contrato.

## 15. TISS

Fluxo previsto:

`Conta validada → Guia → Lote → XML → validação XSD → envio → protocolo → retorno`.

Não trate XML preliminar como TISS homologado enquanto não houver validação contra os schemas oficiais aplicáveis e homologação do canal da operadora.

## 16. Glosas e recursos

Registre/importa glosas com código, motivo, valor e vínculo à guia/conta/item. Recursos devem manter justificativa, valor recursado, protocolo, prazos e resultado. O catálogo de motivos de glosa pode ser alimentado por tabelas de referência, mas a ocorrência real permanece vinculada à conta.

## 17. Financeiro e NFS-e

A Central Financeira acompanha recebíveis, previsões, bruto, glosas e líquido. Baixas, retenções, conciliação, contas a pagar e caixa ainda estão em evolução.

NFS-e pode operar manualmente ou via adapter homologado do município/provedor. Não habilite emissão automática para integração não testada.

## 18. Engenharia Clínica e equipamentos

Equipamentos assistenciais são cadastrados por patrimônio e podem ser vinculados às interfaces de Laboratório, Imagem, UTI, Diálise e Centro Cirúrgico. Telemetria deve registrar equipamento, atendimento/paciente, horário e dado recebido. Alertas automáticos são apoio operacional e não substituem avaliação clínica.

## 19. GED, TI e Auditoria in loco

O GED centraliza documentos clínicos/administrativos com vínculo à entidade correta. O módulo de TI controla chamados, ativos e operação tecnológica. Auditoria in loco da operadora deve conceder somente o acesso necessário, temporário e auditável aos episódios liberados.

## 20. Boas práticas

- pesquise antes de cadastrar;
- mantenha um único episódio para a mesma jornada;
- não perca o `atendimento_id` ao navegar entre setores;
- não altere edição histórica de tabela para representar nova vigência;
- não ignore bloqueios de Auditoria/Contas Médicas;
- não envie TISS sem validação/homologação aplicável;
- não grave tokens, senhas ou certificados sensíveis em texto puro;
- confira contrato e autorização antes de faturar divergências;
- use ambientes separados para homologação e produção;
- valide alterações assistenciais com equipe clínica e operacional antes de homologação.

## 21. Estado de evolução

O sistema está em desenvolvimento contínuo. Ainda exigem ampliação/homologação, entre outros: SAE e administração beira-leito completa, Farmácia hospitalar completa, Laboratório/LIS, RIS/PACS por modalidade, Centro Cirúrgico/CME, documentos clínicos de alta/SVO/óbito, TISS definitivo, integrações externas, Financeiro completo e módulos especializados.
