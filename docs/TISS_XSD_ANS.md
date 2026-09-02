# Validação XSD — Padrão TISS ANS

## Versão operacional

Em setembro de 2026, o HIS-MEDSYNC usa o Padrão TISS vigente Julho/2026. Para a troca eletrônica operadora ↔ prestador, a versão de Comunicação configurada no banco é **04.03.00**.

Fonte regulatória cadastrada em `tiss_versoes`:

`https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/padrao-tiss-julho-2026`

O contrato local dos schemas fica em `vendor/tiss/040300/manifest.json`.

## Schemas

O conjunto operacional instalado contém:

- `tissSimpleTypesV4_03_00.xsd`;
- `tissComplexTypesV4_03_00.xsd`;
- `tissGuiasV4_03_00.xsd`;
- `tissV4_03_00.xsd`;
- `tissWebServicesV4_03_00.xsd`;
- `tissAssinaturaDigital_v1.01.xsd`;
- `xmldsig-core-schema.xsd`.

A integridade é obrigatória. `scripts/sync-tiss-ans-xsd.mjs` materializa os arquivos no build e calcula SHA-256 antes de aceitá-los. Qualquer divergência interrompe o build.

## Motor de validação

A aplicação usa `xmllint-wasm` 5.3.0, baseado em libxml2, no servidor. O validador está em `src/modules/tiss/xsd-validator.ts`.

Medidas de segurança:

- DTD e declarações `ENTITY` são bloqueadas antes da validação;
- dependências XSD são pré-carregadas localmente;
- a validação não consulta schemas externos durante o processamento da mensagem;
- o XML recebe SHA-256 antes da persistência do resultado;
- até 100 erros XSD são normalizados para exibição/auditoria.

## Autoridade no banco

O frontend não pode simplesmente marcar um XML como válido. O resultado é persistido pelo RPC:

`registrar_validacao_xsd_tiss_operacional(uuid, boolean, jsonb, text, text)`

Esse RPC:

1. exige usuário autenticado;
2. valida unidade e permissões funcionais;
3. bloqueia lotes já enviados/protocolados/finalizados;
4. exige que a versão validada seja a mesma do XML;
5. recusa `PRELIMINAR_INTERNO` como documento XSD válido;
6. impede resultado `válido` acompanhado de erros;
7. sincroniza `tiss_xmls` e `tiss_lotes` na mesma transação.

A migration é `20260902144511_tiss_xsd_ans_040300.sql`.

## Fluxo operacional

### XML gerado pelo HIS

Um artefato real `mensagemTISS` deve ser validado contra `tissV4_03_00.xsd` antes de envio. Estruturas de envelope de webservice usam `tissWebServicesV4_03_00.xsd`.

Se válido:

- `tiss_xmls.xsd_validado = true`;
- `validado_em` é registrado;
- `hash_documento` é salvo;
- o lote recebe `status = valido`;
- envio manual/webservice pode utilizar o artefato.

Se inválido:

- `xsd_validado = false`;
- erros são gravados em `erros_validacao`;
- lote recebe `status = invalido`;
- envio continua bloqueado.

### XML recebido da operadora

A importação manual valida o conteúdo contra o XSD 04.03.00 no servidor. Mesmo quando inválido, o arquivo permanece na trilha manual para auditoria, acompanhado dos erros; não é tratado como mensagem processada válida.

### Artefato preliminar

`PRELIMINAR_INTERNO` continua existindo apenas como instrumento de conferência. Ele **não é uma mensagem TISS**, nunca recebe `xsd_validado=true` e nunca pode ser enviado à operadora.

## Atualização futura

Quando a ANS publicar nova versão de Comunicação:

1. não sobrescrever `040300`;
2. criar novo diretório versionado;
3. registrar fonte e SHA-256 dos novos arquivos;
4. adicionar o novo conjunto ao validador;
5. atualizar `tiss_versoes` por migration controlada;
6. validar compatibilidade com mensagens existentes;
7. só então ativar a versão para novos lotes.
