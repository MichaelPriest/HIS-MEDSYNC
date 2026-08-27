# Estado real da implementação

Atualizado em 2026-08-27.

Este documento registra o estado **real** do MedSync HIS. A existência de uma rota, tabela ou migration não significa homologação hospitalar. O sistema permanece em desenvolvimento e os módulos abaixo devem ser tratados como fundação, fluxo operacional em evolução ou pendência, conforme indicado.

## Estado por área

| Área | Estado atual | Próximos pontos críticos |
|---|---|---|
| Fundação / Auth / multiempresa | Funcional em evolução. RBAC granular, contexto por empresa/unidade, seleção de perfil, RLS e helpers de autorização já existem. O PR #71 adiciona metadados de perfil (`setor_chave`, `nivel_acesso`, `pagina_inicial`, `ordem_navegacao`) e passa a usar o perfil também para organizar a experiência, sem substituir RLS/permissões como fronteira de segurança. | testes RLS multi-tenant completos, break-glass clínico controlado e hardening progressivo dos RPCs legados ainda sinalizados pelos Advisors |
| Interface / navegação | Reestruturada no PR #71. A antiga concentração em `Central Assistencial` e `Setores especializados` foi substituída por macroáreas hospitalares e um grupo prioritário **Meu setor**. O perfil ativo determina setor, nível e página inicial; as permissões continuam determinando o que pode ser aberto. | validar usabilidade autenticada por perfis reais, busca global ampliada, acessibilidade e persistência opcional de preferências de navegação |
| Central Assistencial | Deixa de ser um menu-depósito. No PR #71 vira um mapa assistencial filtrado pelo perfil e pelas permissões, direcionando para workspaces setoriais em vez de duplicar operações. | homologar agrupamentos com equipes assistenciais e ajustar atalhos conforme uso real |
| Recepção / Totem / Senhas | Base funcional. Demanda espontânea segue `Totem/Senha → Recepção → atendimento → Triagem`. Paciente agendado pode fazer check-in direto, sem obrigação do Totem. | impressão, SLA, prioridades, abuso/rate limit de endpoints públicos e homologação do painel de chamadas |
| Agenda | Base em evolução: visão diária/semanal, confirmação, check-in, faltas/cancelamentos, encaixe, retorno, especialidade, local, convênio/plano e identificação de cirurgia eletiva. | disponibilidade/bloqueios, recorrência, lembretes, reagendamento e integração cirúrgica completa |
| Atendimento / ADT | Base funcional, mantendo um único episódio/RA para o atendimento. Identificação já suporta etiqueta e pulseira com QR para o ciclo assistencial. | regras ADT completas, transferências, documentos e configuração de formatos/impressoras por unidade |
| Triagem / Fila médica | Base funcional ampliada. Fila médica setorial por PS, Ambulatório, Internação e outros setores; `Chamar e assumir` preserva o setor do episódio. | protocolos configuráveis, SLA, reclassificação e lotação por consultório/setor |
| Prontuário / histórico longitudinal | Workspace central do episódio. Resumo, histórico, anamnese/evolução, prescrição e documentos usam o mesmo atendimento. PR #70 integra laudos LIS/RIS liberados e alertas críticos; PR #71 amplia a leitura clínica para anexos GED vinculados a laudos liberados, sem dar gestão do GED ao médico. | assinatura/adendos adicionais, protocolos, interações/alergias e homologação clínica/regulatória |
| Prescrição | Base funcional com documentos/receituários e ciclo medicamentoso conectado à Farmácia/Enfermagem. | regras clínicas adicionais, interações, função renal, protocolos e homologação |
| Enfermagem | Base funcional em evolução. Checagem à beira-leito, aprazamento, pulseira/QR, lote, dispensação, dupla checagem, contingência e eventos auditáveis. | SAE completo, balanço, evolução, escalas, alto risco e indicadores |
| Farmácia | Base funcional avançada. FEFO transacional, divisão entre lotes, bloqueio/quarentena/vencimento, devolução por lote, estoque e conciliação medicamentosa integrados. | análise clínica ampliada, reposição setorial, indicadores e homologação farmacêutica |
| Laboratório / LIS | Base operacional avançada. Pedido vinculado ao atendimento/paciente, accession/etiqueta, coleta, recebimento/rejeição, cadeia de custódia, setor/bancada, analisador, resultados, referência, flags/críticos, comunicação/read-back, validação técnica, laudo assinado e histórico/retificação. PR #71 acrescenta anexos GED vinculados diretamente ao laudo. | homologação com pedidos clínicos reais, interfaces com equipamentos, protocolos e validação das bancadas/setores reais |
| Diagnóstico por Imagem / RIS | Base operacional avançada. Pedido, agenda/status, execução, accession, sala/equipamento, contraste/dose, Study/Series UID, PACS, achados/conclusão/recomendações, laudo assinado/retificável e crítico com comunicação obrigatória. PR #71 acrescenta anexos GED vinculados diretamente ao laudo. | integração de visualizador/storage DICOM/PACS do provedor escolhido e homologação radiológica |
| GED | Evoluído no PR #71 de listagem para fluxo funcional: Storage privado, upload direto por URL assinada, limite/MIME no bucket, SHA-256, detalhe, download/visualização temporária, status, assinatura de integridade, imutabilidade após assinatura e versionamento sem sobrescrever arquivo. Pode vincular atendimento, paciente, profissional, convênio, lote TISS, conta e laudos LIS/RIS. | homologar categorias/documentos por setor, retenção/temporalidade, política de descarte e integrações adicionais |
| Internação / NIR | Base funcional em evolução. Painel, mapa de leitos, NIR e Central de Altas têm responsabilidades separadas; alocação revalida disponibilidade e compatibilidade no banco. | regras regulatórias, SLA/prioridade, transferências interunidades, giro/censo e homologação |
| Urgência / Emergência | Base funcional com ABCDE, risco, reavaliações e destino no mesmo atendimento. | protocolos configuráveis, observação, SLA, indicadores e homologação operacional |
| Centro Cirúrgico / CME | Estrutura parcial; existem base assistencial e estrutura física, mas fluxo hospitalar cirúrgico completo ainda não está homologado. | pré-admissão, agenda de sala/equipe, anestesia, intraoperatório, RPA, CME, OPME e integração de conta |
| Nutrição / Hemoterapia / CCIH / UTI / Multiprofissional / especialidades | Há fundações e workspaces em vários módulos, mas o nível de completude varia. No PR #71 deixam de ficar em uma lista única e passam a ser organizados pela macroárea/setor correspondente. | evoluir cada fluxo para operação hospitalar completa e homologar por equipe |
| RH | Banco, RLS e permissões já existiam, mas não havia rota própria. PR #71 cria hub `/rh` com indicadores de colaboradores, escalas, treinamentos e documentos. | CRUD/fluxos completos, escalas, documentos no GED, saúde ocupacional e integrações de acesso |
| Segurança / Portaria / Visitantes | Banco e permissões já existiam, mas não havia rota própria. PR #71 cria hub `/seguranca` com acessos, credenciais, visitantes e ocorrências. | operação de check-in/out, credenciais, dispositivos/portaria e relatórios de segurança |
| Estrutura hospitalar | Hierarquia física e leitos já existem com separação entre cadastro e operação assistencial. | edição/inativação controlada, cadastro real das unidades e capacidade |
| Compras / Almoxarifado | Bases funcionais; estoque e catálogo assistencial já se relacionam. | alçadas, recebimento divergente/parcial, inventário, reposição e rastreabilidade completa |
| Comercial / Credenciamento / Tabelas | Base avançada com tabelas comerciais, referências e regras contratuais. | importar dados licenciados reais, códigos próprios por operadora e homologar contratos |
| Auditoria / Contas Médicas | Bases funcionais com hardening de operações sensíveis. | regras automáticas, segregação de funções, checklist por convênio e testes de autorização |
| Faturamento / Livro de produção | Base funcional e integrada aos eventos assistenciais/conta. | completar automações de consumo, fechamento e homologação financeira/TISS |
| TISS | Estrutura funcional, ainda não homologada integralmente. Validador anti-glosa, status de guia, requisitos para lote e proteção de itens já existem. | XSD oficial por versão/tipo, XML definitivo, adapters das operadoras e homologação |
| Glosas / Recursos | Base funcional. | importação automática de demonstrativos, XML definitivo e ciclo de recurso/retorno completo |
| Financeiro | Parcialmente integrado ao ciclo da receita. | baixas, retenções, conciliação, contas a pagar e caixa |
| NFS-e | Estrutura disponível. | adapters reais dos municípios/provedores utilizados |
| Diretoria | Base de gestão. | KPIs, metas, filtros, drill-down e governança |
| TI / Engenharia Clínica | Bases operacionais existentes e agora organizadas na macroárea de apoio/gestão. | ampliar automações, inventário, contratos, manutenção preventiva e indicadores |

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

## Segurança e autorização

A matriz operacional em `public.permissoes` permanece a fonte de verdade. O catálogo TypeScript referencia códigos usados estaticamente pela aplicação e possui teste automatizado que garante que toda permissão exigida pela navegação esteja presente no catálogo tipado.

O PR #71 preserva o isolamento por empresa/unidade e não cria bypass de RLS. O hardening do GED usa RLS forçado e policies específicas para leitura, inserção, atualização e Storage. RPCs sensíveis de GED são executáveis apenas por `authenticated` e revalidam permissões funcionais dentro do fluxo.

O Security/Performance Advisor deve ser analisado por objeto. Avisos históricos de `SECURITY DEFINER`, endpoints públicos do Totem/Painel e outras rotinas legadas não devem ser corrigidos de forma indiscriminada dentro de um pacote funcional sem validar o fluxo que depende deles.

## Travas de negócio já consolidadas

Cadeia de faturamento de convênio:

`Alta → Auditoria → Contas Médicas → Validação da conta → Guia TISS → Lote → XML validado → envio/manual → retorno → financeiro`.

A conta não deve pular Auditoria ou Contas Médicas. XML preliminar não deve ser tratado como TISS homologado sem validação pelos schemas oficiais aplicáveis. Guia com crítica impeditiva permanece em `rascunho`; alteração faturável posterior exige nova validação.

Jornada de demanda espontânea/urgência:

`Totem/Senha → Recepção/abertura do atendimento → Triagem → chamada → fila médica setorial → Prontuário/Assistência`.

Paciente agendado comum:

`Agenda → confirmação → check-in direto → admissão/atendimento → fila médica ambulatorial → prontuário`.

Cirurgia eletiva deve seguir programação especializada e integrar pré-admissão, Centro Cirúrgico, equipe/anestesia, RPA, CME/OPME e conta hospitalar.

Na Internação, `Painel da Internação`, `Mapa de Leitos`, `NIR` e `Central de Altas` mantêm responsabilidades distintas. Seleção visual de leito nunca substitui revalidação transacional.

No atendimento médico, o mesmo episódio deve ser preservado em toda a jornada:

`Fila médica setorial → Resumo → Histórico longitudinal → Anamnese/Evolução → Prescrição/Documentos → Laboratório/Imagem/Farmácia/Enfermagem/demais setores`.

Pedidos, resultados, laudos e documentos assistenciais pertencem ao mesmo paciente/atendimento quando clinicamente aplicável. Dados produzidos pelos setores devem reaparecer no prontuário e nos fluxos subsequentes sem criar episódios paralelos.

## Validação do pacote atual

PR ativo: **#71 — `feat(navegacao): reorganizar HIS por setor e perfil + GED integrado`**.

O primeiro CI do PR passou em `lint` e `typecheck`, mas falhou no teste unitário que exige sincronismo entre requisitos de navegação e catálogo tipado de permissões. A correção foi aplicada no commit posterior do PR, sincronizando RH, Segurança/Visitantes e permissões LIS/RIS. O PR deve permanecer em draft até o novo head passar por `lint`, `typecheck`, testes, `build`, Chromium/Playwright, smoke E2E, Vercel e revisão dos Supabase Advisors.
