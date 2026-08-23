# Migrations do MedSync HIS — aplicação segura

Atualizado em 2026-08-23.

## Objetivo

O histórico do projeto já teve arquivos diferentes compartilhando o mesmo prefixo de versão. Isso é perigoso porque o Supabase registra a **versão** da migration, e não qual arquivo homônimo foi executado.

As colisões foram eliminadas no repositório e foram acrescentadas duas camadas de segurança:

- `20260823192500_reparo_colisoes_historicas.sql` — restaura objetos que podem ter sido pulados em bancos que executaram somente um dos antigos arquivos de versão duplicada;
- `20260823193000_reconciliacao_schema_his_completa.sql` — reconcilia colunas, índices, funções e visão executiva e cria o diagnóstico `validar_schema_his()`.

## Colisões corrigidas

| Versão antiga | Conteúdos que disputavam a mesma versão | Situação atual |
|---|---|---|
| `202608220011` | Hub clínico / Contexto clínico | Hub permanece `011`; contexto passou para `01150`; reparo garante exames |
| `20260823008000` | Metodologias AMB/CBHPM / extensão da tabela comercial | Metodologias permanecem `08000`; extensão comercial passou para `08050` |
| `20260823008100` | Auditoria de preços / integração de precificação conta-guias | Auditoria permanece `08100`; integração passou para `08150` |

## Banco já existente / produção ou homologação

**Não execute `db reset` em banco com dados.**

1. Faça backup/snapshot do banco antes de qualquer alteração estrutural.
2. Atualize o repositório para a `main` mais recente.
3. Consulte o histórico local/remoto com o comando de listagem de migrations da Supabase CLI.
4. Não apague nem edite manualmente registros de `supabase_migrations.schema_migrations` apenas para “fazer bater”.
5. Aplique as migrations pendentes pelo fluxo normal do Supabase CLI.
6. Depois da aplicação, execute no SQL Editor:

```sql
select *
from public.validar_schema_his()
where status <> 'OK';
```

O resultado ideal é **zero linhas**.

Para ver o diagnóstico completo:

```sql
select * from public.validar_schema_his();
```

## Banco novo

Em um projeto vazio, aplique o histórico completo em ordem. A fundação começa em:

```text
202608220001_foundation.sql
```

As migrations de reparo/reconciliação no final são intencionalmente idempotentes e funcionam também em banco novo após o restante do histórico.

## Se o remoto já tiver uma das antigas versões duplicadas

Não tente descobrir apenas pela versão qual SQL foi executado — isso é justamente a ambiguidade que foi corrigida. As migrations `192500` e `193000` verificam/criam os efeitos faltantes sem depender dessa suposição.

## O que as migrations de reparo NÃO fazem

- não apagam pacientes, contas, atendimentos ou históricos;
- não dão `DROP TABLE` em estruturas de negócio;
- não trocam UUIDs/PKs;
- não sobrescrevem edições históricas de tabelas comerciais;
- não zeram dados;
- não marcam migrations antigas manualmente como aplicadas.

## Atenção a alterações manuais no banco

Se uma tabela ou coluna foi criada manualmente com **tipo incompatível** com o schema do projeto, `ADD COLUMN IF NOT EXISTS` não corrige o tipo. Nesse caso, o conflito precisa ser analisado individualmente antes de converter dados.

Também é recomendável comparar o schema de homologação com produção antes de promover novas migrations.

## Diagnóstico mínimo esperado

O `validar_schema_his()` verifica, entre outros:

- empresas, unidades, pacientes, profissionais, convênios e atendimentos;
- triagem, prontuário, prescrições, internações, autorizações e encaminhamentos;
- Compras, Estoque, Auditoria, Central de Guias, Credenciamento, GED e Contas Médicas;
- conta hospitalar e motores de tabelas comerciais/procedimentos;
- TISS, lotes e glosas;
- Financeiro, Contas a Pagar e NFS-e;
- colunas críticas como RA, registro, vínculo do profissional ao usuário, liberação da Auditoria/Contas Médicas e memória de cálculo contratual.

## Regra para novas migrations

A partir deste ponto:

1. cada arquivo deve ter um prefixo de versão único;
2. nunca reutilize um timestamp já existente;
3. alterações incrementais devem preferir `IF NOT EXISTS` quando isso não esconder incompatibilidades de tipo;
4. policies recriadas devem usar `DROP POLICY IF EXISTS` antes de `CREATE POLICY`;
5. funções podem usar `CREATE OR REPLACE FUNCTION` quando a assinatura não mudar;
6. alterações destrutivas exigem migration específica, backup e plano de rollback;
7. não renomeie migrations que já tenham sido aplicadas em produção sem uma migration compensatória/reparo.
