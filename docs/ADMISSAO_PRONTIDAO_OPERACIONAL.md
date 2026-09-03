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
