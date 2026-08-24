# Estado real da implementação

Atualizado em 2026-08-24.

Este documento separa **estrutura criada**, **funcionalidade inicial** e **módulo ainda não homologado**. O MedSync HIS continua em desenvolvimento e não deve ser considerado pronto para produção hospitalar apenas porque determinado menu/tabela existe.

| Área | Estado atual | Próximos pontos críticos |
|---|---|---|
| Fundação / Auth / multiempresa | Funcional em evolução; RBAC granular, navegação por perfil, central de acessos, hardening inicial de RPCs sensíveis e testes automatizados ampliados desde o PR #6; helpers RLS otimizados no PR #13 sem alterar a matriz de acesso | proteção granular progressiva dos RPCs restantes, testes RLS multi-tenant completos e break-glass clínico |
| Interface / navegação | Funcional em evolução; áreas de trabalho e contexto do episódio no PR #5, RBAC no shell no PR #6, reorganização de sidebar/topbar/menu no PR #8, avatar real + atalhos contextuais no PR #9 e nova reorganização no pacote pós-PR #18 com sidebar desktop recolhível, `Fluxo de atendimento`, `Atendimento médico` e `Internação` como grupos distintos | persistência opcional do estado recolhido, acessibilidade, busca global ampliada, troca controlada de unidade e testes de usabilidade autenticados |
| Pacientes / Profissionais / Convênios | Funcional em evolução | validações, documentos, contratos e fluxos especializados |
| Agenda | Em evolução desde o PR #14; visão diária/semanal, filtros, confirmação, check-in direto, atendido, falta, cancelamento com motivo, encaixe, retorno, especialidade, local, convênio/plano e identificação de cirurgia eletiva; PR #15 integra check-in ambulatorial à admissão sem senha com vínculo único `agendamento → atendimento` | grade de disponibilidade, bloqueios/feriados, recorrência, lembretes/confirmação externa, edição/reagendamento, integração completa da cirurgia eletiva com pré-admissão e centro cirúrgico |
| Totem / Senhas / Recepção | Base funcional; abertura do atendimento por demanda espontânea encaminha o episódio para a fila operacional de Triagem e os atalhos contextuais aproximam cadastro de paciente/atendimento da Recepção no PR #9 | impressão, SLA, regras de prioridade, rate limit/abuso dos endpoints públicos e homologação dos painéis |
| Atendimento / ADT | Base funcional; indicador do episódio `Atendimento a RN` integrado à admissão e ao snapshot TISS no PR #9 | completar regras ADT, transferências, documentos e validações específicas por tipo de episódio |
| Central de Guias | Base funcional; UX consolidada por fila/status no PR #5 | integração automática com solicitações e operadoras |
| Triagem / Fila médica | Base funcional ampliada no PR #9; lista apenas atendimentos abertos sem triagem concluída, permite chamar/rechamar no painel e, na conclusão, retira o paciente da fila de Triagem e encaminha para a fila médica por especialidade | protocolos/escalas configuráveis, SLA, reclassificação e homologação clínica/operacional |
| Prontuário | Base funcional em evolução; usado como workspace central do episódio no PR #5 e recebe registros/reavaliações da Urgência no PR #7. No PR #21, `/prontuario/[atendimentoId]` ganha navegação médica compartilhada entre Resumo, Anamnese/Evolução e Prescrição; a nova prescrição contextual mantém paciente/RA/atendimento fixos, resolve o prescritor pelo usuário autenticado, consulta catálogo sob demanda e preserva leitura de itens de outros profissionais sem permitir alteração por autoria indevida | assinatura clínica ampliada, adendos, documentos clínicos, protocolos/escalas configuráveis, validação de interações/alergias, conciliação e homologação clínica completa |
| Urgência/Emergência | Base funcional no PR #7; Central de Urgência, ABCDE, risco, reavaliações e destino vinculados ao mesmo atendimento; reavaliação endurecida por RPC autorizado e sem DELETE clínico | protocolos clínicos configuráveis, SLA, observação, indicadores e homologação operacional |
| Enfermagem | Parcial | SAE, checagem, evolução, balanço, escalas |
| Farmácia | Parcial; medicamentos podem ser vinculados ao catálogo mestre e ao estoque sem duplicar a referência de faturamento | dispensação, devolução, rastreabilidade por lote e validação clínica/farmacêutica ampliada |
| Laboratório / Imagem | Parcial | execução, resultados/laudos e liberação |
| Internação / NIR | Base funcional em evolução; PR #16 separa censo por ala/UTI e fila regulatória, PR #17 sincroniza leitos/internações/reservas/bloqueios/higienização via Supabase Realtime, PR #18 especializa o Mapa de Leitos para censo/operação física e PR #19 separa a `Central de Altas`. No PR #20 a fila NIR passa a incluir toda internação ativa sem leito e a alocação é revalidada transacionalmente por disponibilidade, isolamento, restrição de sexo e acomodação, normalizando `enfermaria ↔ coletiva` | critérios regulatórios configuráveis, prioridade/SLA por perfil assistencial, transferências interunidades, giro/censo/diárias e homologação operacional do fluxo NIR/alta |
| Estrutura hospitalar | Base funcional; hierarquia `bloco → andar → ala → setor/sala`, tipos para UTI/centro cirúrgico/obstétrico/pronto-socorro/enfermaria/ambulatório/apoio e leitos reais vinculados. No PR #18, criação/características permanentes do leito passam para `Configurações → Estrutura → Cadastro de leitos`, separadas da operação assistencial | edição/inativação controlada de leitos, mapear estrutura física real de cada unidade, regras de capacidade e homologação operacional |
| Compras | Base funcional; UX consolidada por operação no PR #5 | alçadas, pedido automático, recebimento parcial/divergência |
| Almoxarifado | Base funcional; UX consolidada em visão operacional no PR #5. No PR #22, produtos físicos podem apontar para o cadastro mestre de item assistencial e exibir TISS/TUSS, ANVISA, Brasíndice e SIMPRO sem transformar estoque em tabela de faturamento | inventário, requisições, reposição, rastreabilidade e completar vínculo de todos os itens reais |
| Comercial / Credenciamento | Base avançada | alimentar contratos reais e regras específicas |
| Tabelas comerciais | Base avançada; PR #22 cria catálogo mestre de diárias, taxas, gases, materiais, OPME, medicamentos, procedimentos e pacotes, separa família TUSS do código de tabela TISS e amplia fontes por edição/vigência para Brasíndice, SIMPRO, CMED e tabelas próprias/licenciadas | importar/gerenciar dados reais licenciados e versões, mapear códigos próprios por operadora e homologar regras contratuais por categoria |
| Auditoria pós-alta | Base funcional; RPCs críticos de execução/liberação passaram a exigir permissão funcional explícita | regras automáticas adicionais, segregação de funções e testes de autorização por perfil |
| Contas Médicas | Base funcional; checklist, auditoria de preços e liberação tiveram hardening funcional de RPCs | checklist por convênio, automações de conferência e testes de autorização por perfil |
| GED | Base funcional | upload/visualização/versionamento/assinaturas completos |
| Conta hospitalar | Base funcional; PR #22 permite lançar itens pelo catálogo mestre, preservar snapshot de tabela/código e resolver preço por edição comercial vinculada ao contrato | pacotes com composição formal, consumo automático dos setores, fechamento operacional e regras adicionais de cobrança fracionada |
| Motor contratual | Base avançada; recálculos sensíveis protegidos por wrappers autorizados e PR #22 acrescenta resolução comercial para MATMED/OPME/gases/pacotes por fonte/edição/percentual do contrato | ampliar regras reais por contrato, impostos/listas/ajustes específicos e homologar cálculos |
| TISS | Estrutura funcional, não homologada; `Atendimento a RN` é persistido no episódio e copiado para a guia como indicador próprio no PR #9. No PR #22, o catálogo diferencia código de tabela TISS da família TUSS: `00` para tabela própria quando não há TUSS, `98` para pacotes e `18/19/20/22` quando há terminologia TUSS aplicável | XSD oficial ANS, XML definitivo por versão/tipo, adapters de operadoras, mapeamento real de códigos próprios e homologação |
| Glosas / Recursos | Base funcional | importação automática de demonstrativos e XML definitivo |
| Financeiro | Parcial; integrado visualmente ao ciclo da receita no PR #5 | baixas, retenções, conciliação, contas a pagar e caixa |
| NFS-e | Estrutura | adapters reais das prefeituras/provedores utilizados |
| Diretoria | Base | KPIs, filtros, metas, drill-down e governança |
| Centro Cirúrgico / CME | Não concluído; estrutura física já admite centro cirúrgico/obstétrico, vínculo de salas e a Agenda passa a identificar cirurgia eletiva no PR #14 | desenvolver pré-admissão cirúrgica, agenda de sala/equipe, intraoperatório, RPA, CME e OPME |
| Nutrição / Hemoterapia etc. | Não iniciado/concluído | definir escopo e implementar |

## Segurança e autorização

O PR #6 introduziu catálogo granular de permissões, navegação por perfil e uma Central de Acessos em `/configuracoes/acessos`. A matriz operacional exibida pela aplicação usa `public.permissoes` como fonte de verdade; o catálogo TypeScript existe apenas para os códigos que o código da aplicação precisa referenciar estaticamente.

O shell continua usando o RBAC apenas para apresentação e descoberta das áreas. O RLS permanece como fronteira definitiva de autorização. O PR #8 adicionou requisitos explícitos de navegação para Urgência/Emergência e NIR. O PR #9 acrescenta a configuração de Estrutura Hospitalar sob `estrutura.visualizar|criar|editar`, com RLS forçado, isolamento por empresa/unidade e sem DELETE pelo cliente. O PR #18 alinha a rota de cadastro físico de leitos à permissão `leitos.gerenciar`; usuários apenas visualizadores não recebem ações operacionais de bloqueio/higienização no Mapa de Leitos. A rota `/internacao/altas` herda requisitos explícitos de `internacao.visualizar|internacao.gerenciar` no shell, enquanto operações sensíveis continuam dependendo das policies/RPCs do banco. No PR #21, o workspace médico usa `prescricao.visualizar|prontuario.visualizar` para leitura; criação, assinatura e suspensão exigem respectivamente `prescricao.criar`, `prescricao.assinar` e `prescricao.suspender`, além de validar empresa, unidade, atendimento e autoria profissional no servidor. No PR #22, `itens_assistenciais` usa RLS forçado por empresa, permite SELECT/INSERT/UPDATE para `authenticated` conforme escopo e não concede DELETE; a RPC de preço comercial é `SECURITY DEFINER`, valida o escopo via `tem_empresa` e não concede EXECUTE a `anon`.

Em 2026-08-24, as migrations pendentes do P0/P1 foram aplicadas em ordem no projeto Supabase principal e validadas após aplicação. Foram verificados RLS/privilegios da nova estrutura, colunas do indicador RN, vínculos de leitos/salas/setores e EXECUTE dos wrappers sensíveis. O PR #13 converteu os helpers booleanos usados pelas policies para execução fechada sem recursão de RLS, mantendo `auth.uid()` e o mesmo escopo por empresa/unidade; o benchmark de `tem_permissao()` caiu de aproximadamente 135 ms para 7 ms. O PR #17 publicou `leitos`, `internacoes`, `leito_reservas`, `leito_bloqueios` e `leito_higienizacoes` no Supabase Realtime mantendo RLS como fronteira dos eventos. O PR #20 endurece `movimentar_internacao_leito`: a função mantém lock transacional, valida empresa/unidade, permissão funcional, ocupação/reserva e compatibilidade assistencial antes de ocupar o destino; `anon` continua sem EXECUTE. As migrations do PR #22 também foram aplicadas em ordem no projeto principal: cadastro mestre MATMED/TISS, códigos próprios `00/98` e resolução de preço comercial; foram validados RLS/privilegios, constraints de tabela/categoria e EXECUTE autenticado da RPC, mantendo `anon` sem acesso. Os endpoints públicos de Totem/Painel permanecem públicos apenas onde o fluxo de terminal exige e seguem como pendência específica de hardening/limitação de abuso.

O CI executa `lint`, `typecheck`, testes unitários, `build`, instalação do Chromium e smoke E2E público com Playwright. O endurecimento dos RPCs `SECURITY DEFINER` continua sendo incremental e deve preservar apenas endpoints públicos intencionais e exigir permissão funcional explícita nos fluxos autenticados sensíveis. O Security Advisor ainda sinaliza endpoints `SECURITY DEFINER` expostos intencionalmente a `authenticated` e alguns endpoints públicos do Totem/Painel; esses avisos devem ser revisados por endpoint, não resolvidos removendo indiscriminadamente os fluxos necessários.

## Travas de negócio já planejadas/implementadas

O faturamento de convênio deve respeitar a cadeia:

`Alta → Auditoria → Contas Médicas → Validação da conta → Guia TISS → Lote → XML validado → envio/manual → retorno → financeiro`.

A conta não deve pular Auditoria ou Contas Médicas. XML preliminar não deve ser tratado como TISS homologado enquanto não houver validação pelos schemas oficiais aplicáveis.

A jornada de demanda espontânea/urgência parte do mesmo episódio:

`Totem/Senha → Recepção/abertura do atendimento → Triagem → chamada no painel → conclusão da Triagem → fila médica por especialidade → Prontuário/Assistência`.

Para **paciente com agendamento comum**, o Totem não é obrigatório. O fluxo previsto é:

`Agenda → confirmação → check-in direto → admissão/atendimento → assistência/prontuário`.

A **cirurgia eletiva** é a exceção tratada como programação especializada: o agendamento identifica o caso e o encaminha para pré-admissão e Centro Cirúrgico, onde sala, equipe, anestesia e demais etapas devem ser controladas pelo módulo cirúrgico.

Concluir a Triagem encerra apenas a etapa/fila de Triagem; não encerra o atendimento hospitalar.

Na Internação, a responsabilidade fica separada por área: `Painel da Internação` para visão/admissão, `Mapa de Leitos` para censo e operação física, `NIR` para reserva/regulação/alocação e `Central de Altas` para planejamento, conciliação medicamentosa, sumário/assinatura e liberação transacional da alta. A NIR deve considerar qualquer internação ativa sem `leito_id`; a seleção visual de um leito nunca substitui a revalidação transacional no banco.

No atendimento médico, o contexto clínico deve permanecer no mesmo episódio: `Fila médica → Resumo do prontuário → Anamnese/Evolução → Prescrição → setores assistenciais/urgência quando necessário`. A prescrição contextual não deve exigir nova busca de paciente nem permitir que o usuário selecione arbitrariamente outro prescritor.

Na cobrança de itens, a fonte de preço comercial e o código de tabela TISS são conceitos distintos. Brasíndice, SIMPRO, CMED e tabelas próprias/licenciadas definem referência de preço por edição e contrato; o snapshot enviado ao faturamento/guia usa `00` para item sem TUSS com código próprio da operadora, `98` para pacote e `18/19/20/22` quando houver TUSS aplicável. Pacote não pode ser salvo sem código próprio válido de até 10 caracteres; itens legados de tabela `00` sem mapeamento válido permanecem pendentes e devem ser bloqueados pela validação antes da guia.

## Dependências externas

- projetos Supabase corretamente configurados por ambiente;
- variáveis e segredos na Vercel;
- schemas/documentação oficial TISS aplicável;
- credenciais/endpoints de homologação das operadoras;
- certificados quando exigidos;
- contratos/tabelas comerciais reais e licenciadas;
- credenciais/layouts dos provedores NFS-e utilizados.

## Qualidade e deploy

O projeto deve continuar passando por `lint`, `typecheck`, testes, `build` e smoke E2E. O check da Vercel pode falhar por **build rate limit**; esse caso deve ser distinguido de falha real de compilação.

A aplicação das migrations no banco principal não equivale à homologação hospitalar dos módulos: os fluxos assistenciais, TISS, operação por perfis, contingência e integrações externas ainda precisam dos respectivos testes de homologação.

Consulte também [`MANUAL.md`](MANUAL.md), [`UX-CONSOLIDACAO.md`](UX-CONSOLIDACAO.md), [`MATRIZ_PERMISSOES.md`](MATRIZ_PERMISSOES.md), [`SEGURANCA.md`](SEGURANCA.md) e o módulo interno `/manual`.
