# Regras permanentes do HIS MedSync

- Toda interface e documentação funcional devem usar português do Brasil.
- TypeScript deve permanecer em modo `strict`; não use `any` sem justificativa documentada.
- Regras de negócio pertencem a `src/modules`; páginas devem apenas compor casos de uso e componentes.
- Toda tabela exposta deve habilitar RLS e possuir políticas com isolamento por empresa e unidade.
- Nunca registre segredos, tokens ou dados clínicos desnecessários em logs/auditoria.
- Dados assistenciais são inativados/versionados, nunca excluídos fisicamente.
- Migrations são incrementais, imutáveis após publicadas e testadas em banco limpo.
- Testes e seeds usam somente dados fictícios.
- Antes de concluir um marco execute lint, typecheck, testes e build; atualize `docs/STATUS.md`.
- Não declare funcionalidades preparadas ou planejadas como concluídas.
