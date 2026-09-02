# Base de Conhecimento do MedSync HIS

## Objetivo

A rota autenticada `/manual` é a Base de Conhecimento operacional do HIS. Ela deve ensinar o usuário a executar tarefas no sistema sem substituir protocolo institucional, treinamento clínico, regra contratual ou homologação externa.

## Fontes

Os artigos estruturados da interface ficam em `src/modules/knowledge-base/articles.ts` e devem referenciar em `sourceDocs` os documentos versionados que sustentam o conteúdo. Os principais materiais já existentes são:

- `docs/MANUAL.md`;
- `docs/MANUAL_CADASTRO_PACIENTE_ADMISSAO_TISS.md`;
- `docs/MANUAL_LABORATORIO_LIS.md`;
- `docs/MANUAL_IMAGEM_RIS_PACS.md`;
- `docs/MANUAL_LIVRO_PRODUCAO.md`;
- `docs/MATRIZ_PERMISSOES.md`;
- `docs/SEGURANCA.md`;
- manuais específicos adicionados futuramente.

## Estrutura mínima de um artigo

Cada artigo deve conter:

1. título e categoria;
2. público-alvo;
3. resumo objetivo;
4. passo a passo coerente com o fluxo real implementado;
5. alertas quando houver risco de quebra de rastreabilidade, segurança ou homologação;
6. links para as telas relacionadas;
7. palavras-chave para pesquisa;
8. referência aos documentos versionados usados como fonte.

## Regras editoriais

- não inventar paciente, unidade, convênio, valor, lote, leito, autorização, protocolo ou fato clínico para exemplificar uma operação;
- não afirmar homologação clínica, TISS, fiscal, PACS/DICOM ou de webservice apenas porque a tela/integração técnica existe;
- manter o `atendimento_id`/RA como eixo nos guias assistenciais;
- explicar quando uma navegação representa mudança real de etapa e quando o salvamento deve permanecer inline;
- não ensinar atalhos que contornem RPC, RBAC, RLS, Auditoria ou transações do banco;
- atualizar o artigo junto com mudanças relevantes do fluxo operacional.

## Evolução prevista

A base pode evoluir com:

- artigos por função/perfil automaticamente priorizados;
- ajuda contextual aberta a partir do módulo atual;
- vídeos e imagens institucionais quando existirem materiais reais aprovados;
- histórico de revisão e responsável pelo conteúdo;
- busca por sinônimos e termos TISS/TUSS;
- trilhas de treinamento por setor;
- perguntas frequentes e resolução de erros comuns;
- indicadores de artigos mais consultados, sem registrar conteúdo clínico do paciente na telemetria de ajuda.
