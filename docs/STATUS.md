# Estado real da implementação

Atualizado em 2026-08-28.

Este documento registra o estado **real** do MedSync HIS. A existência de uma rota, tabela ou migration não significa homologação hospitalar. O sistema permanece em desenvolvimento e os módulos abaixo devem ser tratados como fundação, fluxo operacional em evolução ou pendência, conforme indicado.

## Estado por área

| Área | Estado atual | Próximos pontos críticos |
|---|---|---|
| Fundação / Auth / multiempresa | Funcional em evolução. RBAC granular, contexto por empresa/unidade, seleção de perfil, RLS e helpers de autorização já existem. O PR #71 adiciona metadados de perfil (`setor_chave`, `nivel_acesso`, `pagina_inicial`, `ordem_navegacao`) e passa a usar o perfil também para organizar a experiência, sem substituir RLS/permissões como fronteira de segurança. | testes RLS multi-tenant completos, break-glass clínico controlado e hardening progressivo dos RPCs legados ainda sinalizados pelos Advisors |
| Interface / navegação | Reestruturada no PR #71. A antiga concentração em `Central Assistencial` e `Setores especializados` foi substituída por macroáreas hospitalares e um grupo prioritário **Meu setor**. O perfil ativo determina setor, nível e página inicial; as permissões continuam determinando o que pode ser aberto. PR #73 inclui a Central de Pendências Intersetoriais e o PR #74 a expõe no **Meu setor** de Farmácia e Enfermagem. O PR #80 acrescenta `Suprimentos / OPME` ao workspace do Bloco Cirúrgico. | validar usabilidade autenticada por perfis reais, busca global ampliada, acessibilidade e persistência opcional de preferências de navegação |
| Central Assistencial | Deixa de ser um menu-depósito. No PR #71 vira um mapa assistencial filtrado pelo perfil e pelas permissões, direcionando para workspaces setoriais em vez de duplicar operações. | homologar agrupamentos com equipes assistenciais e ajustar atalhos conforme uso real |
| Integração intersetorial | PR #73 criou `/integracoes`, `integracao_eventos` append-only e `integracao_pendencias`, com reconciliação derivada sem editar fatos clínicos. PR #74 amplia o ledger e as regras para `Prescrição → Farmácia → Enfermagem → Estoque → Produção`. O PR #80 acrescenta reconciliação de OPME utilizada sem baixa física compatível, consumo cirúrgico sem produção e requisição cirúrgica pendente após conclusão. | ampliar cobertura por jornada, SLAs/ownership, E2E autenticado por perfil e rotina operacional de saneamento das pendências históricas |
| Recepção / Totem / Senhas | Base funcional. Demanda espontânea segue `Totem/Senha → Recepção → atendimento → Triagem`. Paciente agendado pode fazer check-in direto, sem obrigação do Totem. | impressão, SLA, prioridades, abuso/rate limit de endpoints públicos e homologação do painel de chamadas |
| Agenda | Base em evolução: visão diária/semanal, confirmação, check-in, faltas/cancelamentos, encaixe, retorno, especialidade, local, convênio/plano e identificação de cirurgia eletiva. O PR #72 substitui listas extensas de profissionais pela busca remota global por nome, CPF, conselho, número do conselho, UF, especialidade e CBO. | disponibilidade/bloqueios, recorrência, lembretes, reagendamento e homologação do agendamento cirúrgico |
| Atendimento / ADT | Base funcional, mantendo um único episódio/RA para o atendimento. Identificação já suporta etiqueta e pulseira com QR para o ciclo assistencial. O PR #72 aplica a mesma busca global de profissional na admissão, preservando retorno em 30 dias e validações TISS de conselho/CBO. | regras ADT completas, transferências, documentos e configuração de formatos/impressoras por unidade |
| Triagem / Fila médica | Base funcional ampliada. Fila médica setorial por PS, Ambulatório, Internação e outros setores; `Chamar e assumir` preserva o setor do episódio. | protocolos configuráveis, SLA, reclassificação e lotação por consultório/setor |
| Prontuário / histórico longitudinal | Workspace central do episódio. Resumo, histórico, anamnese/evolução, prescrição e documentos usam o mesmo atendimento. PR #70 integra laudos LIS/RIS liberados e alertas críticos; PR #71 amplia a leitura clínica para anexos GED vinculados a laudos liberados; PR #72 acrescenta a aba **Cirurgia**, reunindo histórico cirúrgico acessível do paciente, checklists, anestesia, RPA, OPME, CME e timeline auditável sem transformar o médico em operador do Centro Cirúrgico. | assinatura/adendos adicionais, protocolos, interações/alergias e homologação clínica/regulatória |
| Prescrição | Base funcional com documentos/receituários e ciclo medicamentoso conectado à Farmácia/Enfermagem. PR #74 registra prescrição assinada no ledger transversal e reconcilia validação farmacêutica obrigatória sem alterar o documento clínico. | regras clínicas adicionais, interações, função renal, protocolos e homologação |
| Enfermagem | Base funcional em evolução. Checagem à beira-leito, aprazamento, pulseira/QR, lote, dispensação, dupla checagem, contingência e eventos auditáveis. PR #74 correlaciona administração concluída com dispensação e produção e encaminha divergências à Central. | SAE completo, balanço, evolução, escalas, alto risco, indicadores e homologação do ciclo de medicamentos |
| Farmácia | Base funcional avançada. FEFO transacional, divisão entre lotes, bloqueio/quarentena/vencimento, devolução por lote, estoque e conciliação medicamentosa integrados. PR #74 registra validação/dispensação/devolução no ledger e bloqueia prospectivamente nova dispensação em prescrição com único aprazamento já atendido/sem saldo operacional. O PR #80 preserva a responsabilidade farmacêutica: medicamento não pode ser baixado diretamente pelo consumo cirúrgico. | análise clínica ampliada, reposição setorial, indicadores, saneamento de legado e homologação farmacêutica |
| Laboratório / LIS | Base operacional avançada. Pedido vinculado ao atendimento/paciente, accession/etiqueta, coleta, recebimento/rejeição, cadeia de custódia, setor/bancada, analisador, resultados, referência, flags/críticos, comunicação/read-back, validação técnica, laudo assinado e histórico/retificação. PR #71 acrescenta anexos GED vinculados diretamente ao laudo. | homologação com pedidos clínicos reais, interfaces com equipamentos, protocolos e validação das bancadas/setores reais |
| Diagnóstico por Imagem / RIS | Base operacional avançada. Pedido, agenda/status, execução, accession, sala/equipamento, contraste/dose, Study/Series UID, PACS, achados/conclusão/recomendações, laudo assinado/retificável e crítico com comunicação obrigatória. PR #71 acrescenta anexos GED vinculados diretamente ao laudo. | integração de visualizador/storage DICOM/PACS do provedor escolhido e homologação radiológica |
| GED | Evoluído no PR #71 de listagem para fluxo funcional: Storage privado, upload direto por URL assinada, limite/MIME no bucket, SHA-256, detalhe, download/visualização temporária, status, assinatura de integridade, imutabilidade após assinatura e versionamento sem sobrescrever arquivo. Pode vincular atendimento, paciente, profissional, convênio, lote TISS, conta e laudos LIS/RIS. | homologar categorias/documentos por setor, retenção/temporalidade, política de descarte e integrações adicionais |
| Internação / NIR | Base funcional em evolução. Painel, mapa de leitos, NIR e Central de Altas têm responsabilidades separadas; alocação revalida disponibilidade e compatibilidade no banco. | regras regulatórias, SLA/prioridade, transferências interunidades, giro/censo e homologação |
| Urgência / Emergência | Base funcional com ABCDE, risco, reavaliações e destino no mesmo atendimento. | protocolos configuráveis, observação, SLA, indicadores e homologação operacional |
| Centro Cirúrgico / CME | Base operacional avançada no PR #72: agendamento transacional, telas separadas de cirurgias agendadas e em andamento, painel de salas, prontidão, cirurgia segura em três etapas, transições assistenciais controladas, anestesia com múltiplas técnicas combinadas e tempos distintos, RPA, OPME, ciclos CME liberados e imutáveis, vínculo cirurgia↔CME, timeline append-only e integração ao prontuário, livro de produção e conta hospitalar. Procedimento, código contratado, porte e porte anestésico são resolvidos pelo contrato vigente do convênio quando aplicável. O PR #80 fecha a ligação `Cirurgia/RA → requisição → transferência por lote → recebimento → consumo/estorno → OPME → produção`, usando `estoque_movimentos` como livro físico único. OPME `utilizado` exige produto, lote e movimento real. | homologação presencial com equipe cirúrgica/CME/Almoxarifado, cadastro real de estoque satélite/bloco quando adotado pela instituição, protocolos anestésicos ampliados e impressos/termos especializados |
| Nutrição / Hemoterapia / CCIH / UTI / Multiprofissional / especialidades | Há fundações e workspaces em vários módulos, mas o nível de completude varia. No PR #71 deixam de ficar em uma lista única e passam a ser organizados pela macroárea/setor correspondente. | evoluir cada fluxo para operação hospitalar completa e homologar por equipe |
| RH | Banco, RLS e permissões já existiam, mas não havia rota própria. PR #71 cria hub `/rh` com indicadores de colaboradores, escalas, treinamentos e documentos. | CRUD/fluxos completos, escalas, documentos no GED, saúde ocupacional e integrações de acesso |
| Segurança / Portaria / Visitantes | Banco e permissões já existiam, mas não havia rota própria. PR #71 cria hub `/seguranca` com acessos, credenciais, visitantes e ocorrências. | operação de check-in/out, credenciais, dispositivos/portaria e relatórios de segurança |
| Estrutura hospitalar | Hierarquia física e leitos já existem com separação entre cadastro e operação assistencial. | edição/inativação controlada, cadastro real das unidades e capacidade |
| Compras / Almoxarifado | Base operacional avançada. O PR #77 fecha o recebimento parcial/total de pedidos com divergência, lote/validade, movimento, saldo e conta a pagar na mesma transação. O PR #78 acrescenta inventário físico por local/lote, conciliação com ajuste rastreável, parâmetros mínimo/ponto de reposição/máximo por produto e local, cálculo pelo saldo disponível mais requisições em trânsito e geração da reposição no fluxo setorial existente. O PR #79 adiciona alçadas configuráveis por valor e perfis, aprovações distintas, segregação solicitante/aprovador, congelamento de fornecedor/valor por ciclo e emissão do pedido somente após aprovação formal. O PR #80 reutiliza a requisição setorial existente para o Centro Cirúrgico: o Almoxarifado separa/transfere por lote e o recebimento da requisição cirúrgica é confirmado pelo bloco, preservando cirurgia, RA, requisição, item e lote. | configurar os valores reais das alçadas da instituição, cadastrar local físico/satélite do bloco quando existir, saneamento das divergências históricas, curva ABC/planejamento de consumo, inventários cíclicos programados e homologação operacional com Compras/Almoxarifado/Farmácia/Financeiro |
| Comercial / Credenciamento / Tabelas | Reestruturado no PR #72 como workspace operacional único em `/comercial`: seleção de contrato, dados/vigência, negociação por tabela, versões/edições, visualização paginada dos itens, busca por código/descrição/TUSS, edição de contrato, vínculo e coeficientes, inclusão/alteração/inativação de itens em edição rascunho, publicação imutável e histórico auditável. A central prioriza automaticamente uma tabela com itens em vez de abrir um vínculo vazio. | homologar contratos reais por operadora, revisar vínculos vazios/duplicados, importar bases licenciadas que ainda estejam sem itens e ampliar testes automatizados de precificação contratual |
| Auditoria / Contas Médicas | Bases funcionais com hardening de operações sensíveis. | regras automáticas, segregação de funções, checklist por convênio e testes de autorização |
| Faturamento / Livro de produção | Base funcional e integrada aos eventos assistenciais/conta. PR #72 registra automaticamente o procedimento cirúrgico e OPME utilizada no livro de produção durante a conclusão e cria/atualiza o grupo do ato cirúrgico quando existe conta aberta compatível. PR #74 passa a sinalizar produção de medicamento incompatível com o desfecho de administração, sem alterar automaticamente o fato faturável. O PR #80 registra material e gás medicinal consumidos no ato cirúrgico pelo tipo canônico do Livro de Produção, usando quantidade líquida após devoluções e origem no movimento físico. | completar automações de fechamento, precificação/conta quando aplicável e homologação financeira/TISS |
| TISS | Estrutura funcional, ainda não homologada integralmente. Validador anti-glosa, status de guia, requisitos para lote e proteção de itens já existem. | XSD oficial por versão/tipo, XML definitivo, adapters das operadoras e homologação |
| Glosas / Recursos | Base funcional. | importação automática de demonstrativos, XML definitivo e ciclo de recurso/retorno completo |
| Financeiro | Parcialmente integrado ao ciclo da receita. | baixas, retenções, conciliação, contas a pagar e caixa |
| NFS-e | Estrutura disponível. | adapters reais dos municípios/provedores utilizados |
| Diretoria | Base de gestão. | KPIs, metas, filtros, drill-down e governança |
| TI / Engenharia Clínica | Bases operacionais existentes e agora organizadas na macroárea de apoio/gestão. | ampliar automações, inventário, contratos, manutenção preventiva e indicadores |

## Integração ponta a ponta — PR #73 e PR #74

O PR #73, já mesclado na `main`, introduziu uma camada **derivada** de integração hospitalar. `integracao_eventos` preserva um ledger append-only/idempotente de fatos finalizados entre setores e `integracao_pendencias` registra divergências que exigem ação, sem transformar a central em nova fonte de prontuário, estoque, laudo, cirurgia ou faturamento.

A primeira cobertura correlaciona diagnóstico, cirurgia/OPME, produção, código e autorização. A rota `/integracoes` exige `integracao.visualizar`; a reconciliação exige `integracao.reconciliar`, usuário autenticado e unidade no escopo. Helpers internos permanecem sem `EXECUTE` para `anon`/`authenticated`.

O PR #74 amplia a mesma arquitetura para:

`Prescrição assinada → validação farmacêutica → dispensação FEFO → administração à beira-leito → estoque/devolução → Livro de Produção`.

Migrations efetivamente aplicadas no Supabase conectado e versionadas no branch do PR #74:

- `20260828130627_integracao_medicamentos_ponta_a_ponta.sql`;
- `20260828131453_integracao_medicamentos_reconciliar_devolucao_historica.sql`;
- `20260828131946_integracao_medicamentos_indices_reconciliacao.sql`.

A trava prospectiva de dispensação atua somente quando existe um único aprazamento para a prescrição simples: não permite uma nova dispensação quando esse aprazamento já não está pendente ou quando existe outra dispensação operacionalmente ativa. Prescrições compostas e divisões FEFO por múltiplos lotes continuam usando seus fluxos próprios.

A reconciliação atual detecta validação farmacêutica pendente, dispensação excedente, dispensação sem movimento de estoque, medicamento administrado sem produção ativa, produção incompatível com a administração concluída e devolução sem retorno rastreável ao estoque. Uma devolução histórica registrada em `devolucoes_medicamentos` é considerada evidência mesmo quando o legado não atualizou `quantidade_devolvida`, evitando alerta redundante.

Estado real dos dados históricos de teste após a reconciliação do PR #74: permanecem **1 dispensação excedente de uma prescrição de dose única, 2 dispensações sem movimento de baixa de estoque e 1 devolução sem movimento de retorno**. Esses registros são anteriores ao hardening atual. O pacote deliberadamente **não cria movimentos retroativos de estoque, não reescreve prontuário e não altera produção para esconder a divergência**; a regularização deve ocorrer no setor responsável com rastreabilidade.

## Centro Cirúrgico + Suprimentos + Estoque — PR #80

O PR #80 fecha a cadeia física do ato cirúrgico sem introduzir uma tabela paralela de consumo:

`Cirurgia/RA → requisição setorial → separação/transferência por lote → recebimento no bloco → consumo/estorno → OPME → Livro de Produção/conta`.

Migrations efetivamente aplicadas no Supabase conectado e versionadas no branch do PR #80:

- `20260828182501_centro_cirurgico_consumo_estoque_operacional.sql`;
- `20260828183329_centro_cirurgico_consumo_catalogo_legado.sql`;
- `20260828183446_centro_cirurgico_producao_consumo_canonica.sql`.

Regras consolidadas neste pacote:

- `estoque_movimentos` permanece o livro físico único; consumo cirúrgico não ganha uma segunda fonte de verdade;
- requisição e movimento preservam `cirurgia_id`, `atendimento_id`, requisição e item da requisição;
- o Almoxarifado separa/transfere por lote usando o fluxo setorial existente; o Centro Cirúrgico confirma o recebimento da requisição cirúrgica;
- consumo direto pelo bloco é permitido somente para material, OPME e gás medicinal e exige cirurgia `em_andamento`, lote válido/disponível e escopo/RBAC;
- **medicamento é bloqueado no RPC cirúrgico** e continua obrigatoriamente em `Prescrição → Farmácia → Dispensação → Administração`;
- OPME `utilizado` exige produto, lote e movimento de estoque reais; cadastro textual isolado serve apenas para planejamento;
- estorno referencia o movimento original, repõe o mesmo lote e, para OPME, deve ser integral antes da conclusão da cirurgia;
- material e gás são registrados no Livro de Produção apenas na conclusão, pelo domínio canônico (`material`/`gas_medicinal`) e pela quantidade líquida após devoluções;
- a reconciliação derivada detecta OPME sem baixa física compatível, consumo cirúrgico sem produção e requisição ainda pendente após a conclusão, sem editar os fatos fonte.

A validação funcional no Supabase percorreu requisição, transferência por lote, recebimento, consumo, estorno parcial, conclusão e produção dentro de subtransação revertida. O resultado comprovou rastreabilidade das FKs e produção líquida de **0,75 material**, com `ROLLBACK` confirmado e sem persistência de cenário artificial.

Estado real de parametrização no banco durante a implementação: **não existe estoque satélite/bloco cirúrgico cadastrado e não há OPME operacional cadastrada/consumida**. A UI sinaliza isso e exige um local físico real; nenhuma migration cria estoque, lote ou estrutura hospitalar fictícios. O PR #80 continua sujeito aos gates efetivos de CI/Vercel do SHA final; este documento não presume homologação por existir rota/migration.

## Compras / alçadas de aprovação — PR #79

A migration `20260828173414_compras_alcadas_aprovacao_operacional.sql` foi aplicada no Supabase conectado e versionada no branch do PR #79. O fluxo passa a seguir:

`Solicitação MATMED → cotação item a item → alçada por valor/perfis → aprovações distintas → pedido → recebimento por lote → estoque/financeiro`.

Regras consolidadas neste pacote:

- a rota `/compras/alcadas` configura faixas por valor, quantidade de aprovações e perfis autorizadores;
- **nenhum valor de alçada foi inventado ou seedado**: enquanto não houver regra ativa que cubra o valor da proposta, o banco bloqueia a aprovação;
- faixas ativas não podem se sobrepor e os perfis vinculados precisam possuir `compras.aprovar`;
- `compras.gerenciar` configura ou reinicia o processo, mas não substitui `compras.aprovar` para comprometer valores;
- o solicitante não pode aprovar nem emitir o próprio pedido;
- cada usuário conta uma única vez por ciclo de aprovação;
- ao iniciar o ciclo são congelados fornecedor, valor total, quantidade mínima de aprovações e conjunto de perfis autorizadores;
- rejeição exige motivo e fica registrada; reinício cancela o ciclo anterior com justificativa, preservando o histórico;
- a emissão do pedido revalida ciclo formal aprovado, quantidade de aprovadores, fornecedor e valor congelado; alteração de valor após a aprovação bloqueia a emissão;
- escrita direta das tabelas críticas de cotação/propostas/pedido foi removida de `authenticated`; as mutações passam pelos RPCs autenticados com unidade e RBAC internos;
- os novos registros de alçada, fluxo e decisão usam RLS + FORCE RLS e não são graváveis diretamente pelo cliente autenticado.

Estado real do banco após a migration: **0 alçadas configuradas, 0 ciclos/decisões artificiais, 1 cotação histórica preservada e 0 pedidos existentes**. A instituição ainda precisa definir sua política monetária real antes de homologar aprovações. O PR #79 permanece sujeito aos gates de CI/Vercel do seu SHA final; este documento não presume aprovação dos checks antes da execução efetiva.

## Navegação por setor e perfil — PR #71

A navegação deixa de ser apenas uma lista filtrada por permissões. O perfil ativo passa a carregar metadados de **setor**, **nível de atuação**, **página inicial** e **ordem**. O shell usa esses metadados para priorizar o trabalho do usuário:

- **Meu setor** aparece primeiro quando existe um perfil específico selecionado;
- perfis operacionais veem prioritariamente o workspace do próprio setor e dependências necessárias;
- supervisão e gestão recebem áreas transversais compatíveis com suas permissões;
- administrador mantém visão global;
- permissões continuam sendo verificadas em cada rota e o **RLS continua sendo a fronteira final**;
- fila do setor e workspace técnico permanecem conceitos separados: por exemplo, fila/chamada do Laboratório não substitui coleta/resultados/laudos do LIS.

Macroáreas adotadas no shell: Atendimento e Recepção; Médico e Prontuário; Enfermagem e Internação; Diagnóstico e Terapias; Bloco Cirúrgico e Especialidades; Qualidade e Segurança; Faturamento e Receita; Cadastros e Comercial; Suprimentos e Apoio; Gestão e Configurações.

## GED e diagnóstico — PR #71

As migrations `20260827135557_ged_upload_versionamento_hardening.sql`, `20260827143416_ged_laudos_liberados_prontuario.sql` e `20260827143705_ged_anexos_diagnostico_autorizacao_setorial.sql` complementam o diagnóstico entregue no PR #70.

O bucket `ged-documentos` é privado e os caminhos são segmentados por empresa/unidade. Uploads recebem caminho UUID próprio e não sobrescrevem a versão anterior. O registro do documento valida escopo, arquivo existente no Storage, tamanho/MIME e hash. Documento assinado torna-se imutável; alteração de conteúdo exige nova versão.

Para LIS/RIS, a escrita do anexo exige permissão do respectivo setor (`laboratorio.*`/`imagem.*`) ou administração explícita do GED. Para o prontuário, documentos vinculados a laudos podem ser lidos com `prontuario.visualizar` **somente quando o laudo correspondente já estiver liberado**. Isso preserva a visão longitudinal sem transformar o médico em operador do GED/LIS/RIS.

## Centro Cirúrgico + CME — PR #72

As migrations `20260827163718_centro_cirurgico_cme_operacional_transacional.sql` e `20260827164619_centro_cirurgico_cme_indices_fk.sql` correspondem ao estado efetivamente aplicado no Supabase.

O fluxo operacional passa a seguir:

`Atendimento/RA → Agendamento cirúrgico → Em preparo → Sign in → Time out → Cirurgia → Sign out → Recuperação/RPA → Alta da RPA → Conclusão → Livro de produção/conta hospitalar`.

Regras consolidadas no banco:

- agendamento e transições críticas são feitos por RPCs autenticados e com verificação de permissão;
- a cirurgia não inicia sem sala definida, prontidão de equipamentos quando houver cadastro físico correspondente e checklists de entrada/pausa concluídos;
- a recuperação exige checklist de saída; se houver anestesista, a anestesia deve estar finalizada;
- a conclusão exige alta da RPA quando houver anestesista vinculado;
- cancelamento exige permissão gerencial e motivo;
- OPME registra código, fabricante, lote, série, registro ANVISA, quantidade e situação de uso;
- somente ciclo CME liberado pode ser vinculado à cirurgia e ciclo liberado torna-se imutável;
- `cirurgia_eventos` mantém timeline append-only das ações operacionais;
- ao concluir, procedimento e OPME utilizada são registrados no livro de produção e a conta hospitalar aberta recebe o grupo do ato cirúrgico quando aplicável;
- leitura clínica das cirurgias, checklists, anestesia, RPA, OPME, CME e eventos é disponibilizada ao prontuário com `prontuario.visualizar`, sem conceder permissão operacional ao usuário médico.
- a navegação operacional possui telas específicas para **Cirurgias agendadas** e **Em andamento**, mantendo o painel de salas como visão consolidada;
- o registro anestésico permite selecionar múltiplas técnicas no mesmo ato, mantém compatibilidade com o campo legado e bloqueia finalização sem início registrado;
- início e fim da anestesia são gravados em ações distintas e apresentados com precisão de segundos na tela operacional.
- o agendamento aceita múltiplos procedimentos no mesmo ato cirúrgico, preservando um único atendimento/RA; cada procedimento mantém sequência, equipe, contrato, porte e tempos próprios.
- o Centro Cirúrgico lista e agenda somente pacientes com internação ativa; a internação recebe classificação estruturada pelo domínio TISS/ANS: 1 Clínica, 2 Cirúrgica, 3 Obstétrica (inclui parto), 4 Pediátrica e 5 Psiquiátrica;
- após a alta da RPA, o paciente pode ser movimentado para ala/quarto/leito disponível pelo fluxo transacional da Internação;
- a equipe do ato contempla cirurgião, 1º ao 4º auxiliar, anestesista, auxiliar de anestesia, instrumentador, pediatra, neonatologista, perfusionista, enfermagem, circulante, técnico de radiologia e outros participantes.

A validação funcional no Supabase foi executada com dados de teste explicitamente identificados dentro de uma transação com `ROLLBACK`: o caso percorreu agendamento, três checklists, anestesia, OPME, ciclo CME, RPA e conclusão, sem persistir registros de teste.

## Comercial / Credenciamento / Contratos e Tabelas — PR #72

O workspace `/comercial` foi reorganizado para eliminar o fluxo fragmentado entre contrato, negociação e itens. O contrato selecionado permanece no contexto e a operação é dividida em quatro abas: **Contrato**, **Negociação**, **Itens da tabela** e **Histórico**.

Regras e capacidades consolidadas:

- busca de contrato por operadora, Registro ANS ou número do contrato;
- edição de número, status, vigência, prazo de pagamento, índice/data-base de reajuste, contato e observações;
- visualização simultânea de todas as tabelas vinculadas ao contrato, com fonte, edição resolvida, quantidade de itens, prioridade e coeficientes;
- vínculos sem edição válida ou com edição vazia são destacados como pendência em vez de parecer que todo o contrato está sem itens;
- quando nenhum vínculo é solicitado explicitamente, a central seleciona primeiro uma tabela ativa cuja edição possua itens;
- negociação permite alterar modo de edição, edição fixa, percentual de ajuste, CH, HM, SADT, UCO contratual, prioridade, adicionais de urgência/apartamento, regra de horário especial, arredondamento e situação do vínculo;
- nova tabela pode ser vinculada ao contrato no próprio contexto; a action valida empresa/unidade e impede associar edição de fonte diferente;
- itens são exibidos em páginas de 100, com busca separada por código, descrição ou TUSS e filtro ativo/inativo;
- edição publicada é histórica e não pode ser sobrescrita: para renegociar, cria-se uma nova versão rascunho, que copia os itens e pode ser alterada antes da publicação;
- em rascunho, o usuário autorizado pode incluir e editar código, descrição, TUSS, valor de referência, categoria, tabela TISS, código próprio da operadora, CH/HM/SADT, porte, porte anestésico, UCO, autorização e situação ativa/inativa;
- publicação fecha a edição rascunho como versão vigente de forma auditável;
- alterações de contrato, vínculo, edição e itens são registradas em `comercial_eventos` para auditoria.
- a importação AMB persiste como colunas estruturadas código, descrição, CH, quantidade de auxiliares, porte cirúrgico, CH do anestesista e quantidade de filme, preservando também o metadata original;
- reimportar uma edição já publicada cria automaticamente uma nova versão rascunho, sem violar a imutabilidade histórica.
- clonagem e edição manual preservam CH, quantidade de auxiliares, CH do anestesista e quantidade de filme radiológico, evitando perda das colunas estruturadas após a importação.

Estado real observado no contrato CORE (`CORE-001`) durante esta implementação: existem cinco vínculos comerciais. As edições AMB92/AMB96/AMB99 vinculadas estão atualmente sem itens. A edição duplicada AMB90 sem vínculo foi excluída e a edição vigente, cujo identificador é preservado pelos contratos e procedimentos cirúrgicos, foi reimportada a partir do XML completo. **AMB90 / AMB 1990** contém agora **3.333 códigos únicos ativos**, todos com CH, quantidade de auxiliares, porte cirúrgico, CH do anestesista e quantidade de filme em colunas estruturadas; a descrição alternativa do único código duplicado no arquivo permanece em `metadata`. A tabela não pertence a um convênio específico e pode ser vinculada a todos os convênios que adotarem AMB90. A central seleciona automaticamente AMB90 como tabela útil principal, mantendo os vínculos vazios visíveis como pendências de parametrização. O vínculo AMB92 configurado como `vigente_na_data` permanece sinalizado quando não há edição vigente resolvível. Nenhum dado comercial foi inventado para preencher essas lacunas.