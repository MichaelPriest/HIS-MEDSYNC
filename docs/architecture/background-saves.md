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

## Migração

Esta política é global, mas a base existente possui ações legadas que ainda usam `redirect()` após mutações. A conversão será incremental e rastreável; não declarar o sistema inteiro convertido até que os módulos legados tenham sido removidos da lista.

Convertidos:

- alta médica ambulatorial;
- solicitação de avaliação médica interprofissional;
- criação de agendamento;
- confirmação, falta, conclusão e cancelamento de agendamento;
- validações e falhas de abertura da Admissão/Recepção, preservando navegação apenas após criação efetiva do atendimento;
- chamada/rechamada e registro da Triagem, com feedback inline e navegação somente para transições setoriais reais;
- tomada de paciente na Fila Médica, com erros inline e navegação para o prontuário somente depois da confirmação da operação.

## Consolidação da pilha

Os pacotes de Agenda, Admissão, Triagem e Fila Médica foram consolidados na PR #100 contra `main`. O head consolidado contém integralmente os antigos pacotes #96, #98 e #99, sem migration de banco. Esses PRs não devem ser mesclados separadamente após a consolidação; a PR #100 passa a ser a unidade de gate e merge para os quatro módulos.

O teste `tests/unit/background-save-policy.test.ts` impede regressão nos fluxos já migrados. Cada pacote posterior deve ampliar essa cobertura ao converter novos módulos.
