# Baseline consolidada do MedSync HIS

Este diretório contém o SQL autoritativo para **reconstruir integralmente o schema `public`** do MedSync HIS em um ambiente de desenvolvimento/homologação.

## Arquivo

`RESET_TOTAL_HIS_MEDSYNC.sql`

> **ATENÇÃO — DESTRUTIVO:** o arquivo apaga e recria o schema `public`. Faça backup/snapshot do projeto Supabase antes de executar.

## O que é preservado

O script preserva os registros existentes de `public.usuarios` em uma tabela temporária antes do reset e os restaura depois, desde que o mesmo UUID ainda exista em `auth.users`.

O script **não apaga `auth.users`**, portanto seu login do Supabase Auth permanece existente. Também não apaga os schemas `auth`, `storage` ou `supabase_migrations`.

Se `public.usuarios` estiver vazio, o script recupera o primeiro usuário existente em `auth.users` para evitar que o sistema fique sem administrador.

## O que é apagado

Todo o conteúdo operacional/cadastral do schema `public`, incluindo pacientes, profissionais, convênios, atendimentos, filas, prontuário, faturamento, TISS, glosas, financeiro, estoque, compras, GED, auditoria, contas médicas, tabelas comerciais e regras contratuais.

## Como executar com segurança

1. Faça um backup/snapshot do banco Supabase.
2. Confirme em **Authentication → Users** que seu login continua existente.
3. Abra **SQL Editor** no Supabase.
4. Copie o conteúdo completo de `RESET_TOTAL_HIS_MEDSYNC.sql`.
5. Execute o arquivo uma única vez.
6. Se alguma instrução falhar, a transação iniciada por `BEGIN` deve fazer rollback; não execute apenas trechos isolados do arquivo.
7. Depois do sucesso, saia do HIS e entre novamente para renovar o contexto da sessão.

**Não execute esse arquivo com `supabase db push`.** Ele foi propositalmente colocado fora de `supabase/migrations/` para não poder ser reaplicado automaticamente.

## Diagnóstico após o reset

Execute:

```sql
select *
from public.validar_schema_his()
where status <> 'OK';
```

Resultado esperado: **zero linhas**.

Para listar todo o diagnóstico:

```sql
select *
from public.validar_schema_his();
```

Confira também:

```sql
select id, nome, ativo, bloqueado
from public.usuarios;

select id, nome_fantasia, ativo
from public.empresas;

select id, empresa_id, nome, ativo
from public.unidades;
```

## Cenário de teste criado

O baseline cria dados claramente identificados por `[TESTE]` ou códigos `TESTE_*` para permitir validação dos principais módulos sem misturar com dados reais:

- empresa e unidade;
- estrutura/setores e locais;
- perfil Administrador e perfis operacionais;
- tipos profissionais, especialidade, CBO e catálogo;
- médico;
- profissional de Enfermagem;
- recepcionista;
- paciente com contatos/endereço;
- convênio e plano;
- contrato de credenciamento;
- tabela de procedimento e regra contratual;
- tabela comercial de material;
- regra de múltiplos procedimentos;
- pacote contratual;
- fornecedor;
- material de estoque, locais e lote;
- solicitação de compra;
- agendamento;
- atendimento assistencial concluído;
- triagem;
- autorização;
- encaminhamento;
- evolução de prontuário;
- prescrição de teste;
- solicitação/resultado de exame de teste;
- Central de Guias;
- conta hospitalar com item e grupo de ato;
- Auditoria liberada;
- processo de Contas Médicas e checklist;
- guia, lote e protocolo TISS de teste;
- glosa e recurso de glosa de teste;
- recebível financeiro;
- configuração NFS-e de homologação e nota em rascunho;
- configuração do painel de chamadas.

Os identificadores clínicos, cadastrais, valores, autorizações, protocolos, TISS e NFS-e desse cenário são **fictícios e exclusivos para teste**. Não representam dados oficiais nem validação/homologação TISS.

## Totem após o reset

O trigger da unidade cria os setores de chamada automaticamente, incluindo `recepcao` com `permite_totem = true`.

Descubra o UUID da unidade:

```sql
select id, nome
from public.unidades
where ativo;
```

Acesse:

```text
https://SEU-DOMINIO/totem/UUID_DA_UNIDADE
```

O paciente de teste pode ser localizado no Totem pelo CPF fictício `00000000000`.

## Usuários de teste e login

O baseline **não cria senhas nem novos usuários diretamente em `auth.users`**. Isso é intencional: credenciais de autenticação não devem ser semeadas por SQL de domínio.

O usuário já existente e preservado recebe perfil Administrador da empresa/unidade de teste e também é vinculado ao profissional médico de teste, permitindo validar fila médica e prontuário com o login existente.

Os registros de recepcionista e Enfermagem são profissionais de teste, mas não possuem login próprio. Para testar autenticação separada por função, crie usuários adicionais normalmente no Supabase Auth e depois vincule-os aos respectivos perfis/profissionais pelo fluxo administrativo do sistema.

## Migrations históricas

As migrations antigas em `supabase/migrations/` continuam no Git para preservar o histórico de ambientes que já as registraram em `supabase_migrations.schema_migrations`.

Para um reset completo/manual, use esta baseline. Não apague ou altere o histórico remoto de `supabase_migrations` apenas para fazê-lo coincidir com o reset.
