# Prontidão operacional da admissão

## Objetivo

Antecipar, na abertura do atendimento, as inconsistências que normalmente só apareceriam na autorização, na auditoria da conta ou no fechamento do faturamento.

A conferência é preventiva e somente leitura. Ela não cria atendimento, autorização, conta, guia ou produção.

## Experiência do usuário

A tela de admissão mostra um cartão de conferência automática enquanto o usuário preenche os dados. A linguagem é operacional:

- **Pronto para abrir o atendimento**: nenhum bloqueio atual.
- **Pendências que impedem a abertura**: dados obrigatórios ou cadastros de origem que precisam ser corrigidos.
- **Alertas para revisão**: situações que merecem conferência, mas não são transformadas automaticamente em bloqueio quando a regra não exige isso.

Os códigos técnicos que sustentam as validações permanecem internos ao HIS.

## Pendências acionáveis

Quando o bloqueio pertence a um cadastro de origem conhecido, o cartão oferece um atalho contextual:

- **Corrigir paciente** para identificação, contato ou endereço que precisam ser saneados no cadastro do paciente;
- **Corrigir profissional** para conselho, CBO ou habilitação regulatória do profissional;
- **Corrigir convênio** para Registro ANS ou configuração estrutural da carteirinha;
- **Abrir cadastros TISS** para CNES da unidade ou procedimento ausente no catálogo operacional.

Esses atalhos abrem em uma nova aba. A admissão em andamento permanece aberta e com os dados já preenchidos. Quando o usuário volta para a aba da admissão, a conferência é refeita automaticamente para reconhecer a correção feita no cadastro de origem.

Pendências que pertencem ao próprio episódio — como selecionar plano, preencher carteirinha, indicar o procedimento ou informar justificativa clínica — continuam sendo corrigidas diretamente na tela de admissão e não recebem atalhos externos.

## O que é conferido

- paciente ativo e selecionado;
- identificação, contato e endereço essenciais;
- fluxo, local e finalidade do atendimento;
- operadora, plano, carteirinha e validade quando aplicáveis;
- padrão configurado da carteirinha;
- profissional ativo e cadastro profissional necessário ao faturamento;
- procedimento principal quando exigido pelo fluxo;
- indicação clínica quando necessária;
- identificação do beneficiário quando a operadora exigir token ou biometria;
- autorização prévia como alerta quando não informada;
- cadastro da unidade e da operadora necessário ao faturamento.

## Privacidade de token e biometria

A conferência preventiva nunca recebe a referência bruta de token ou biometria. O navegador envia somente:

- método escolhido;
- indicador booleano de que a referência foi preenchida.

O conteúdo bruto permanece restrito à transação final de admissão, que já utiliza a rotina segura de evidência e hash existente no HIS.

## Segurança

A RPC pública `admissao_prontidao`:

- exige usuário autenticado;
- exige vínculo com a unidade;
- exige a mesma permissão funcional `atendimentos.abrir` usada na abertura transacional;
- não executa INSERT, UPDATE, DELETE ou UPSERT;
- chama um helper interno que não pode ser executado diretamente por `public`, `anon` ou `authenticated`.

A validação preventiva não substitui a validação transacional. Se ela estiver indisponível, a abertura continua protegida pelas validações definitivas do banco.

## Identificador do atendimento

Quando a abertura é concluída, o número gerado para o atendimento continua sendo o mesmo identificador utilizado como Número da guia do prestador durante autorização e faturamento.

## Manutenção

Quando uma nova regra obrigatória for adicionada à abertura transacional, a prontidão deve ser atualizada para sinalizar a mesma condição antes do clique final. A RPC preventiva nunca deve criar uma regra mais permissiva do que a transação definitiva.

Atalhos de correção devem apontar somente para rotas internas existentes e nunca transportar dados clínicos, token, biometria ou outras informações sensíveis por query string.
