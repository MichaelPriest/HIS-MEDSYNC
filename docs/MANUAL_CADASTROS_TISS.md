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

O bloco do prestador verifica:

- CNPJ com 14 dígitos;
- CNES com 7 dígitos.

A correção rápida altera apenas CNPJ e CNES. Razão social, nome fantasia, endereço e outros dados institucionais continuam em **Configurações → Empresa**.

Não copie CNPJ/CNES de outra instituição ou unidade apenas para liberar a mensagem.

## Unidade ativa

A unidade do contexto assistencial possui CNES próprio. O sistema não assume automaticamente que o CNES da empresa e o CNES da unidade são iguais.

Informe o CNES real do estabelecimento onde o atendimento ocorreu.

## Profissionais

Para um profissional que atuará como solicitante ou executante TISS, mantenha na ficha:

- conselho profissional;
- número do conselho;
- UF do conselho;
- CBO com 6 dígitos;
- especialidade, quando aplicável.

A Ficha 360° possui o bloco **Habilitação para TISS**. O salvamento ocorre em segundo plano e a página informa se a base ficou pronta.

Profissionais exclusivamente administrativos não precisam receber conselho/CBO fictícios. Se nenhum campo regulatório for informado, o cadastro pode permanecer sem habilitação TISS; a obrigatoriedade passa a existir quando esse profissional for usado em uma função regulatória que exija os dados.

## Convênios / Operadoras

O cadastro da operadora deve possuir **registro ANS com 6 dígitos**.

Na Ficha 360°, use **Identificação TISS da operadora** para corrigir:

- registro ANS;
- CNPJ, quando informado.

O registro ANS não deve ser substituído por código interno, número de contrato, CNPJ ou código do prestador na operadora.

## Procedimentos e tabelas

A Central sinaliza itens ativos das tabelas comerciais sem mapeamento TUSS.

A correção deve ser feita em **Credenciamento/Comercial → Fontes e edições / Tabelas** usando a referência regulatória ou contratual correta.

O sistema não cria código TUSS artificial para eliminar pendência.

## Pacientes

CPF e CNS são tratados na Central como **qualidade documental**, não como bloqueio TISS universal.

A obrigatoriedade do identificador do beneficiário depende da mensagem, do episódio e das regras aplicáveis. Corrija os documentos na ficha de identificação do paciente, sem duplicar o paciente nem alterar o RA.

Carteirinha, autorização, senha, protocolo e validade pertencem ao atendimento/episódio e às autorizações; não devem ser gravados como atributos fixos do cadastro mestre do paciente.

## Depois de corrigir

1. Abra **Faturamento → Guias TISS**.
2. Abra a guia correspondente.
3. Execute **Revalidar guia**.
4. Corrija eventuais complementos específicos do episódio.
5. Somente guias sem crítica impeditiva podem entrar em lote.
6. A mensagem final do lote só é promovida para envio depois de passar pelo XSD oficial.

## Importante

A Central de Prontidão é uma camada preventiva. Ela não substitui:

- validação da Guia TISS;
- validação XSD da mensagem final;
- regras contratuais da operadora;
- homologação institucional ou da operadora.

Nenhum indicador verde autoriza preencher fatos que não tenham origem real no HIS.
