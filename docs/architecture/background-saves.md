# Salvamentos em segundo plano

## Regra global

Salvamentos e mutações operacionais normais do MedSync HIS devem acontecer sem navegação automática e sem recarga completa da página.

O padrão obrigatório é:

1. a tela envia a operação em segundo plano por Server Action;
2. o usuário recebe estado visual imediato (`Salvando…`);
3. sucesso e erro são exibidos no próprio contexto do formulário;
4. erro não apaga os dados digitados;
5. o banco/RPC continua sendo a autoridade para validação, RBAC, RLS e transação;
6. após sucesso, dados dependentes podem ser invalidados com `revalidatePath`, recebendo atualização por resposta RSC, sem `redirect`, `window.location` ou `router.refresh` usado apenas para refletir o save;
7. operações clínicas/financeiras críticas não devem mostrar sucesso otimista antes da confirmação do banco.

## Contrato

O contrato compartilhado está em `src/lib/actions/background-action.ts` e usa `BackgroundActionState` (`idle | success | error`). Formulários interativos usam React 19 `useActionState` e feedback acessível por `aria-live`.

## Exceções

Navegação continua permitida quando ela é a própria intenção explícita do usuário, por exemplo login, seleção de contexto ou botão que leva a uma etapa/tela distinta. Não usar navegação como mecanismo de feedback de um salvamento comum.

Na Agenda, o `check-in` é uma exceção deliberada: após o banco confirmar a transição, a aplicação abre a próxima etapa operacional (`/atendimentos/novo` para atendimento comum ou Centro Cirúrgico para cirurgia eletiva). Confirmação, falta, conclusão e cancelamento permanecem na própria Agenda.

Na Admissão, erros de paciente, cobertura, TISS, identificação do beneficiário e falhas transacionais permanecem no próprio formulário. Após a abertura real do atendimento/RA ser confirmada pelo banco, a navegação continua obrigatória porque representa a próxima etapa operacional: Autorização para convênio ou Triagem para particular.

Na Triagem, chamar/rechamar o paciente e falhas de registro permanecem na própria tela. A conclusão comum atualiza a fila sem reload. A navegação só ocorre após salvamento confirmado quando o fluxo realmente exige mudança de setor para Autorização ou Pronto-Socorro.

Na Fila Médica, erros de perfil profissional, especialidade, concorrência, atendimento e publicação da fila permanecem inline. Após a tomada do encaminhamento e atualização assistencial serem confirmadas, a aplicação navega para o prontuário clínico porque essa abertura representa a continuidade real do atendimento pelo profissional que venceu a disputa.

Em Autorizações, biometria/token, validações e salvamento de guia permanecem na mesma tela. Navegação só ocorre depois de uma liberação/dispensa confirmada quando a jornada realmente precisa seguir para Triagem, Fila Médica ou Pronto-Socorro. Se a guia for salva mas o encaminhamento posterior falhar, a tela informa essa condição sem ocultar que a autorização já foi persistida.

Na Enfermagem, evolução assistencial e administração à beira-leito permanecem na própria tela. A checagem de medicamentos continua usando o RPC `registrar_administracao_beira_leito` como autoridade para prescrição ativa, validação farmacêutica, identificação do paciente, dispensação, lote, contingência sem etiqueta e dupla checagem; apenas o feedback deixou de depender de redirect/reload.

Na Farmácia, conciliação medicamentosa, validação farmacêutica, dispensação FEFO do item principal e de componentes e devolução permanecem na própria tela. Os RPCs `validar_prescricao_farmaceutica`, `dispensar_medicamento_prescricao_fefo`, `dispensar_componente_prescricao_fefo`, `devolver_medicamento_dispensacao` e `registrar_conciliacao_medicamentosa` continuam como autoridades transacionais; a migração não introduz DML paralelo nem altera FEFO, lote ou saldo.

No Laboratório/LIS, preparo e accession da amostra, cadeia de custódia, encaminhamento para setor/bancada, registro de resultado, validação técnica e comunicação de resultado crítico permanecem na mesma tela. O editor de laudos também salva rascunho, valida analito, registra crítico, assina/libera e abre retificação sem reload. Os RPCs laboratoriais continuam sendo a autoridade para rastreabilidade, equipamento, criticidade, liberação, assinatura, versão e read-back. A única navegação deliberada ocorre ao **iniciar um laudo novo**: após o RPC confirmar a criação, o cliente abre o editor daquele laudo.

No Diagnóstico por Imagem/RIS, agendamento, confirmação/chegada/falta/cancelamento, início e conclusão da execução, registro de contraste e registro de dose permanecem na mesma tela com feedback inline. Os RPCs `agendar_exame_imagem_operacional`, `atualizar_agendamento_imagem_operacional`, `iniciar_execucao_imagem_operacional` e `concluir_execucao_imagem_operacional` continuam como autoridades das transições operacionais. Contraste e dose mantêm as escritas já existentes sob o escopo empresa/unidade e RLS; esta conversão não cria schema, migration nem caminho paralelo de autorização.

O editor de laudos RIS segue a mesma regra: `salvar_laudo_imagem`, `registrar_criticidade_laudo_imagem`, `liberar_laudo_imagem` e `abrir_retificacao_laudo_imagem` continuam sendo as autoridades. Rascunho, criticidade/comunicação, assinatura/liberação e abertura de retificação permanecem no editor com feedback inline. Marcar um achado crítico sem destinatário continua permitido para preservar o estado clínico real, mas a interface mantém a liberação bloqueada enquanto a comunicação estiver pendente. A única navegação automática do pacote ocorre ao **iniciar um laudo novo**: depois que `salvar_laudo_imagem` confirma o identificador, o cliente abre o editor daquele laudo.

## Migração

Esta política é global, mas a base existente possui ações legadas que ainda usam `redirect()` após mutações. A conversão será incremental e rastreável; não declarar o sistema inteiro convertido até que os módulos legados tenham sido removidos da lista.

Convertidos:

- alta médica ambulatorial;
- solicitação de avaliação médica interprofissional;
- criação de agendamento;
- confirmação, falta, conclusão e cancelamento de agendamento;
- validações e falhas de abertura da Admissão/Recepção, preservando navegação apenas após criação efetiva do atendimento;
- chamada/rechamada e registro da Triagem, com feedback inline e navegação somente para transições setoriais reais;
- tomada de paciente na Fila Médica, com erros inline e navegação para o prontuário somente depois da confirmação da operação;
- identificação do beneficiário e atualização de Autorizações, com feedback inline e navegação somente para continuidade assistencial real;
- evolução de Enfermagem em Andares e Pronto-Socorro;
- administração de medicamentos à beira-leito, preservando o RPC e todos os campos de rastreabilidade clínica/farmacêutica;
- conciliação medicamentosa, validação farmacêutica, dispensação FEFO principal/componente e devolução na Farmácia;
- bancada Laboratório/LIS: preparo de amostra, status/cadeia de custódia, encaminhamento, resultado, validação técnica e comunicação de crítico;
- laudos Laboratório/LIS: abertura com navegação pós-criação confirmada e editor com rascunho, validação, comunicação crítica, liberação e retificação inline;
- operação Diagnóstico por Imagem/RIS: agenda, transições da agenda, início/conclusão de execução, contraste e dose;
- laudos Diagnóstico por Imagem/RIS: criação com navegação pós-confirmação e editor com rascunho, criticidade/comunicação, liberação e retificação inline.

Os testes `tests/unit/background-save-policy.test.ts`, `tests/unit/enfermagem-background-saves.test.ts`, `tests/unit/farmacia-background-actions.test.ts`, `tests/unit/laboratorio-background-saves.test.ts`, `tests/unit/laboratorio-laudo-background-saves.test.ts`, `tests/unit/imagem-background-saves.test.ts` e `tests/unit/imagem-laudo-background-saves.test.ts` impedem regressão nos fluxos já migrados. Cada pacote posterior deve ampliar essa cobertura ao converter novos módulos.
