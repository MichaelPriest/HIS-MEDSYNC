# Validação XSD — Padrão TISS ANS

## Versão operacional

Em setembro de 2026, o HIS-MEDSYNC usa o Padrão TISS vigente Julho/2026. No catálogo interno (`tiss_versoes`), a versão de Comunicação é **04.03.00**. No XML transmitido, a tag `Padrao` usa **4.03.00**, exatamente como o tipo `dm_versao` do XSD oficial.

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
- até 100 erros XSD são normalizados para exibição/auditoria;
- uma mensagem inválida nunca é promovida como artefato enviável.

## Mensagem final `ENVIO_LOTE_GUIAS`

O serializer está dividido em duas camadas:

- `src/modules/tiss/mensagem-final-040300.ts`: representação canônica do HIS;
- `src/modules/tiss/mensagem-final-wire-040300.ts`: wire-format exato da ANS.

O wire-format:

- usa namespace explícito `ans:`;
- emite `tipoTransacao=ENVIO_LOTE_GUIAS`;
- emite `Padrao=4.03.00`;
- suporta, no fluxo atualmente gerado pelo HIS, Guia de Consulta, SP/SADT e Resumo de Internação;
- diferencia solicitante e executante no SP/SADT;
- mantém o CNES no local definido pelo tipo específico de cada guia;
- separa procedimentos de outras despesas conforme a origem fotografada no item;
- exige unidade de medida TISS para medicamento, material, OPME, diária, taxa e gás medicinal;
- aplica `reducaoAcrescimo` e cardinalidades numéricas conforme o tipo de procedimento do XSD;
- calcula o MD5 TISS sobre os valores das tags, na ordem física da mensagem, em LATIN1;
- calcula SHA-256 separado para integridade técnica da representação persistida.

O XML só segue ao staging depois de passar por `validateTissXmlXsd`. Em seguida, `salvar_xml_candidato_tiss_operacional` recalcula os hashes e valida a estrutura mínima no PostgreSQL. Apenas então `registrar_validacao_xsd_tiss_operacional` pode promover `ENVIO_LOTE_GUIAS_CANDIDATO` para `ENVIO_LOTE_GUIAS`.

## Autoridade no banco

O frontend não pode simplesmente marcar um XML como válido. A cadeia transacional exige:

1. usuário autenticado;
2. unidade e permissão funcional válidas;
3. lote ainda editável;
4. versão de Comunicação compatível;
5. lote com um único tipo de guia e até 100 guias;
6. `ENVIO_LOTE_GUIAS` com estrutura e número do lote correspondentes;
7. SHA-256 recalculado no banco;
8. MD5 TISS recalculado no banco em LATIN1;
9. resultado XSD sem erros para promoção final.

`PRELIMINAR_INTERNO` nunca pode ser promovido. O envio manual também é fail-closed: `registrar_envio_manual_tiss_operacional` aceita somente `ENVIO_LOTE_GUIAS`, versão interna `04.03.00`, previamente validado pelo XSD.

Migrations principais desta etapa:

- `20260902144511_tiss_xsd_ans_040300.sql`;
- `20260902153013_tiss_xsd_ans_040300_fix_lote_columns.sql`;
- `20260902164216_tiss_lote_xsd_040300_hardening.sql`;
- `20260902165336_tiss_guia_complemento_comunicacao_040300.sql`;
- `20260902173406_tiss_xml_final_040300_transacional.sql`;
- `20260902173810_tiss_guia_item_reducao_snapshot_040300.sql`;
- `20260902175402_tiss_guia_solicitante_validacao_integrada_040300.sql`;
- `20260902180109_tiss_guia_item_origem_snapshot_040300.sql`;
- `20260902180256_tiss_item_unidade_despesa_040300.sql`;
- `20260902183026_tiss_envio_final_only_040300.sql`.

## Fluxo operacional

### Guia

A validação da guia inclui a camada geral e a Comunicação 04.03.00. Campos que não podem ser inferidos são preenchidos na própria tela com salvamento em segundo plano. No SP/SADT, o solicitante possui snapshot próprio e não é copiado silenciosamente do executante. Itens de despesa exibem complemento de unidade de medida TISS sem assumir um valor padrão.

### Lote e XML gerado pelo HIS

O lote permanece bloqueado enquanto houver crítica impeditiva. Ao solicitar a geração final:

1. as guias e os itens reais do lote são carregados;
2. o serializer cria `mensagemTISS/loteGuias`;
3. o MD5 regulatório é calculado;
4. a mensagem passa pelo XSD oficial em memória;
5. o banco recalcula SHA-256 e MD5 no staging;
6. o RPC de validação promove o candidato;
7. o lote recebe `status=valido` e somente então o XML pode ser baixado/enviado.

Se inválido, os erros XSD retornam inline e o lote não é liberado para transmissão.

### Charset na borda

A representação textual fica persistida como `text` no PostgreSQL, mas a borda respeita a declaração da mensagem. Para XML final `ISO-8859-1`:

- o endpoint de download converte explicitamente para bytes LATIN1 e informa `charset=iso-8859-1`;
- o transporte HTTP XML envia bytes LATIN1;
- o SOAP remove a declaração XML da mensagem interna antes de envelopá-la e envia o envelope no mesmo charset;
- caracteres fora de ISO-8859-1 são rejeitados antes da geração.

### XML recebido da operadora

A importação manual valida o conteúdo contra o XSD 04.03.00 no servidor. Mesmo quando inválido, o arquivo permanece na trilha manual para auditoria, acompanhado dos erros; não é tratado como mensagem processada válida.

### Artefato preliminar

`PRELIMINAR_INTERNO` permanece apenas como artefato histórico/de conferência. A ação principal da tela do lote agora gera a mensagem final. O preliminar **não é uma mensagem TISS**, nunca recebe promoção para `ENVIO_LOTE_GUIAS` e nunca pode ser enviado à operadora.

## Atualização futura

Quando a ANS publicar nova versão de Comunicação:

1. não sobrescrever `040300`;
2. criar novo diretório versionado;
3. registrar fonte e SHA-256 dos novos arquivos;
4. adicionar o novo conjunto ao validador;
5. atualizar `tiss_versoes` por migration controlada;
6. validar compatibilidade com mensagens existentes;
7. só então ativar a versão para novos lotes.
