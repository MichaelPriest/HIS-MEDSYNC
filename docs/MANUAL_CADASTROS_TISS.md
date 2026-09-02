# Manual — Cadastros prontos para TISS

## Objetivo

A tela **Cadastros → Prontidão TISS** centraliza pendências de cadastro que podem impedir a validação ou a geração da mensagem TISS 4.03.00.

A regra principal é corrigir o dado na sua origem. A Guia TISS não deve ser usada para inventar ou substituir cadastro institucional, profissional, de operadora ou de procedimento.

## Como acessar

1. Abra **Cadastros**.
2. Selecione **Prontidão TISS**.
3. Revise o total de bloqueios e as filas por origem.
4. Use **Corrigir** ou os formulários rápidos para atualizar o cadastro correto.
5. Retorne à Guia TISS e execute a revalidação antes de criar/usar o lote.

## Prestador / Empresa

O bloco do prestador verifica CNPJ com 14 dígitos e CNES com 7 dígitos. A correção rápida altera apenas esses identificadores; os demais dados institucionais continuam em **Configurações → Empresa**.

Não copie CNPJ/CNES de outra instituição ou unidade apenas para liberar a mensagem.

## Unidade ativa

A unidade do contexto assistencial possui CNES próprio. O sistema não assume automaticamente que o CNES da empresa e o CNES da unidade são iguais. Informe o CNES real do estabelecimento onde o atendimento ocorreu.

## Profissionais — domínios padronizados

O cadastro profissional separa **tipo de profissional** de **habilitação para uso TISS**. Profissionais administrativos podem permanecer com a habilitação TISS desativada e não entram como pendência apenas por não possuírem conselho ou CBO regulatório.

Quando o profissional atuar como solicitante ou executante TISS, ative **Habilitado para uso profissional no TISS**. O sistema passa a exigir:

- **CBO** selecionado na TUSS 24 ativa;
- **conselho profissional** selecionado na TUSS 26 ativa;
- número do conselho;
- **UF** selecionada entre as 27 UFs brasileiras válidas.

### CBO e especialidade/ocupação

O CBO deixou de ser texto livre. Ao selecionar o CBO, o sistema utiliza a descrição oficial daquela ocupação como **Especialidade / ocupação vinculada**. Exemplo: `225125` é apresentado como **Médico clínico**.

O cadastro não permite usar `999999` para declarar um profissional mestre como pronto para TISS. Esse código existe no domínio regulatório para situações específicas de mensagem, mas não substitui a identificação ocupacional real do profissional cadastrado.

### Conselho profissional

O conselho também deixou de ser texto livre. O seletor usa a **TUSS 26** e mantém o código ANS junto do cadastro. Exemplos: `06 · CRM`, `02 · COREN`, `09 · CRP`, `05 · CREFITO` e `04 · CREFONO`.

Para famílias ocupacionais com relação inequívoca, a interface pode sugerir o conselho após a escolha do CBO. A sugestão permanece editável e o servidor valida o código selecionado; ocupações ambíguas não recebem conselho inventado automaticamente.

### UF do conselho

A UF é selecionada em lista fechada com as 27 UFs brasileiras. Valores como `XX`, nomes por extenso ou siglas inválidas são recusados pelo banco e pelo formulário.

### Versionamento regulatório

Os domínios de CBO e conselho estão armazenados no modelo ANS FHIR já existente no HIS. A baseline carregada neste pacote é a TUSS 24/26 **versão 202309**, com metadados de versão e fonte. Isso permite substituir ou complementar a edição quando uma referência posterior for incorporada, sem hardcode espalhado pelas telas.

A Ficha 360° possui o bloco **Habilitação para TISS**. A edição ocorre em segundo plano, com feedback inline e sem recarregar a tela apenas para informar sucesso/erro.

## Convênios / Operadoras

O cadastro da operadora deve possuir **registro ANS com 6 dígitos**. Na Ficha 360°, use **Identificação TISS da operadora** para corrigir registro ANS e CNPJ quando informado.

O registro ANS não deve ser substituído por código interno, número de contrato, CNPJ ou código do prestador na operadora.

## Procedimentos e tabelas

A Central sinaliza itens ativos das tabelas comerciais sem mapeamento TUSS. A correção deve ser feita em **Credenciamento/Comercial → Fontes e edições / Tabelas** usando a referência regulatória ou contratual correta. O sistema não cria código TUSS artificial para eliminar pendência.

## Pacientes

CPF e CNS são tratados na Central como **qualidade documental**, não como bloqueio TISS universal. A obrigatoriedade do identificador do beneficiário depende da mensagem, do episódio e das regras aplicáveis.

Carteirinha, autorização, senha, protocolo e validade pertencem ao atendimento/episódio e às autorizações; não devem ser gravados como atributos fixos do cadastro mestre do paciente.

## Depois de corrigir

1. Abra **Faturamento → Guias TISS**.
2. Abra a guia correspondente.
3. Execute **Revalidar guia**.
4. Corrija eventuais complementos específicos do episódio.
5. Somente guias sem crítica impeditiva podem entrar em lote.
6. A mensagem final do lote só é promovida para envio depois de passar pelo XSD oficial.

## Importante

A Central de Prontidão é uma camada preventiva. Ela não substitui a validação da Guia TISS, o XSD da mensagem final, regras contratuais ou homologação institucional/da operadora.

Nenhum indicador verde autoriza preencher fatos que não tenham origem real no HIS.
