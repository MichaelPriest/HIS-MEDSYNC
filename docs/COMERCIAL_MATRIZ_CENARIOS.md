# Comercial — Matriz de cenários contextuais

## Objetivo

A Matriz de cenários compara um mesmo código de cobrança nos contratos ativos do mesmo convênio, respeitando a data de referência e os contextos de plano e unidade já cadastrados.

Ela existe para detectar antes da operação real:

- contrato específico que resolve para outro contrato;
- contexto sem preço contratual;
- sobreposição de contratos com o mesmo plano e unidade;
- bloqueios ou avisos de prontidão no contexto;
- diferenças de valor causadas pela configuração comercial real.

## Fonte de verdade

A matriz não possui um segundo motor de preço. A RPC `comercial_simular_matriz_cenarios` chama, para cada contexto, as autoridades já existentes:

- `comercial_simular_precificacao` para resolver tabela, DePara, base e regras;
- `comercial_prontidao_contrato` para contar bloqueios e avisos;
- `comercial_pode_visualizar` para aplicar o escopo do usuário.

Nenhum preço, percentual, edição ou equivalência é inferido pela matriz.

## Contextos avaliados

O contrato escolhido na tela identifica empresa e convênio. Na data informada, entram na comparação apenas contratos:

- do mesmo convênio;
- com status `ativo`;
- dentro da vigência;
- acessíveis ao usuário;
- gerais ou específicos por plano e/ou unidade.

A especificidade exibida vai de 0 a 2:

- 0: todos os planos e todas as unidades;
- 1: plano ou unidade específico;
- 2: plano e unidade específicos.

## Sobreposição

A matriz conta quantos contratos ativos existem, na mesma data, com o mesmo `plano_id` e `unidade_id`. Mais de um contrato no mesmo contexto é sinalizado como sobreposição e deve ser revisado antes da homologação.

A existência da sobreposição não autoriza o HIS a escolher qual contrato deveria prevalecer por interpretação humana. O resultado do resolvedor real é mostrado para revisão.

## Resultado `Resolve outro contrato`

Esse resultado ocorre quando o simulador do contexto selecionado identifica que o resolvedor comercial escolheu outro contrato. A correção deve ser feita em contrato, vigência, vínculo, prioridade ou configuração contextual; a matriz não altera a resolução automaticamente.

## Segurança e persistência

A RPC é `SECURITY DEFINER`, exige `auth.uid()`, valida permissão comercial e não é executável por `anon`.

A matriz é somente leitura. Ela não executa `INSERT`, `UPDATE` ou `DELETE` e não cria:

- contas;
- itens de faturamento;
- snapshots;
- vínculos de tabela;
- DePara TUSS;
- regras;
- homologações.

## Fluxo recomendado

1. Configure contratos e vínculos reais.
2. Execute Prontidão comercial.
3. Use o Simulador para um código/contexto específico.
4. Use a Matriz para comparar os contextos ativos do convênio.
5. Corrija sobreposições, ausência de preço ou resolução divergente.
6. Execute novamente Prontidão, Simulador e Matriz.
7. Somente depois conclua a homologação comercial institucional.

## Limites

A Matriz valida a configuração conhecida no HIS. Ela não representa aprovação da operadora, validação jurídica ou homologação regulatória externa.
