# Consolidação de UX do MedSync HIS

Atualizado em 2026-08-24.

## Objetivo

Reduzir carga cognitiva, cliques e pesquisas repetidas sem apagar rotas, misturar regras de negócio ou perder rastreabilidade clínica/administrativa.

## Áreas de trabalho

### 1. Jornada do paciente

`Agenda → Recepção/Senhas → Atendimento → Guias/Autorizações → Triagem → Fila médica → Prontuário`

O atendimento é o ponto de entrada do episódio e o prontuário é o workspace central do paciente durante aquele episódio.

### 2. Assistência clínica

`Central Assistencial → Prescrição → Internação/Leitos`

A Central Assistencial prioriza domínios frequentes e mantém especialidades avançadas acessíveis sem expor todos os módulos de uma vez.

### 3. Execução por setor

`Enfermagem → Farmácia → Laboratório → Imagem → Internação`

As filas setoriais continuam independentes porque representam responsabilidades operacionais distintas, mas ficam agrupadas no mesmo contexto de navegação.

### 4. Cadastros e contratos

`Pacientes → Profissionais → Convênios → Catálogos → Credenciamento → Procedimentos → Regras → Tabelas`

Cadastros permanecem separados por entidade, com navegação contextual única.

### 5. Gestão e suprimentos

`Diretoria → GED → Compras → Estoque`

Compras e Estoque usam indicadores primeiro e ações complexas recolhidas para reduzir poluição visual.

### 6. Ciclo da receita

`Auditoria → Contas Médicas → Pré-faturamento → Lotes TISS → Glosas/Recursos → Recebimentos → Notas Fiscais`

A ordem visual acompanha a cadeia de negócio e não permite interpretar uma etapa posterior como substituta das validações anteriores.

## Padrões aplicados

- menu lateral por áreas de trabalho, com apenas um grupo expandido;
- barra contextual horizontal dentro da área ativa;
- cabeçalhos compactos em todas as páginas baseadas em `SectionPage`;
- busca global direcionada a paciente/episódio;
- prontuário como contexto persistente do atendimento;
- filtros operacionais na fila de atendimentos;
- formulários longos em `ActionPanel`, abrindo sob demanda;
- cartões/linhas extensas usando `details` para edição progressiva;
- dashboard inicial como central de trabalho, não como catálogo de módulos;
- nenhuma migration, RLS ou regra clínica alterada pela consolidação.

## Regra para novas telas

Antes de criar uma nova rota, verificar se a função pertence a uma área de trabalho existente. Criar nova tela apenas quando houver responsabilidade, estado ou regra de negócio realmente distinta. Ações secundárias devem preferir painel, drawer ou seção contextual dentro do workspace atual.
