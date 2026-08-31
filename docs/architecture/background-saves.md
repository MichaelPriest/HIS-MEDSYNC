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

## Migração

Esta política é global, mas a base existente possui ações legadas que ainda usam `redirect()` após mutações. A conversão será incremental e rastreável; não declarar o sistema inteiro convertido até que os módulos legados tenham sido removidos da lista.

Convertidos no pacote inicial:

- alta médica ambulatorial;
- solicitação de avaliação médica interprofissional.

O teste `tests/unit/background-save-policy.test.ts` impede regressão nos fluxos já migrados. Cada pacote posterior deve ampliar essa cobertura ao converter novos módulos.
