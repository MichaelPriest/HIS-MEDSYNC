# Padrão TISS Comunicação 04.03.00 — XSD ANS

Este diretório é materializado pelo script `npm run tiss:xsd:sync` durante o build.

Fonte regulatória: Agência Nacional de Saúde Suplementar (ANS), Padrão TISS vigente Julho/2026. O componente de Comunicação vigente é 04.03.00 para a troca operadora ↔ prestador.

O ambiente de execução desta automação não consegue extrair diretamente o ZIP binário do portal gov.br. Por isso, os bytes são obtidos de um espelho público fixado por commit que declara preservar os XSD oficiais sem modificação. **Nenhum arquivo é aceito sem corresponder exatamente ao SHA-256 registrado em `manifest.json`.**

Arquivos do conjunto operacional 04.03.00:

- `tissSimpleTypesV4_03_00.xsd`
- `tissComplexTypesV4_03_00.xsd`
- `tissGuiasV4_03_00.xsd`
- `tissV4_03_00.xsd`
- `tissWebServicesV4_03_00.xsd`
- `tissAssinaturaDigital_v1.01.xsd`
- `xmldsig-core-schema.xsd`

O arquivo principal para mensagens `mensagemTISS` é `tissV4_03_00.xsd`. O arquivo `tissWebServicesV4_03_00.xsd` é mantido no mesmo contrato para as estruturas usadas pelos webservices.

## Regras de segurança

- validação XSD é executada no servidor;
- DTD e declarações `ENTITY` são recusadas antes do parser;
- dependências XSD são pré-carregadas localmente; nenhuma resolução de schema é feita pela rede durante a validação;
- `xsd_validado=true` só pode ser persistido depois de uma validação real;
- envio manual e webservice continuam bloqueados quando `xsd_validado=false`.

Ao atualizar a versão ANS, não substitua arquivos silenciosamente: crie um novo diretório/versionamento, registre origem e hashes, adicione testes e só então altere a versão ativa.
