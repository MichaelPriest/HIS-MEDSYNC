# Assistencial — lote hospitalar integrado (2026-08-24)

Este lote consolida a evolução do núcleo assistencial do HIS-MEDSYNC. O banco remoto do projeto Supabase recebeu as migrations abaixo via mecanismo oficial de migrations do Supabase antes da publicação do frontend.

## Migrations aplicadas no Supabase

| Versão | Nome |
|---|---|
| 20260824020430 | assistencial_transversal_completo |
| 20260824020646 | assistencial_funcoes_transacionais |
| 20260824020952 | assistencial_rls_perfis_operacionais |
| 20260824021907 | assistencial_governanca_uti_transporte_obito |
| 20260824022137 | assistencial_prontuario_prescricao_rls_assinatura |
| 20260824022230 | assistencial_conciliacao_farmaceutica_sumario_alta |
| 20260824022325 | assistencial_prescricao_fluxo_seguro |
| 20260824022438 | assistencial_prescricao_status_rascunho |
| 20260824022534 | assistencial_seguranca_procedimentos_transicao |

A fundação anterior permanece em `supabase/migrations/20260824020000_assistencial_hospitalar_completo.sql`.

## Capacidades consolidadas

- prontuário clínico estruturado, assinatura e adendos;
- SAE, sinais vitais, balanço hídrico, dispositivos, lesões e curativos;
- prescrição hospitalar em rascunho, assinatura, validação farmacêutica e imutabilidade;
- dispensação/devolução por estoque e lote e administração à beira-leito;
- conciliação medicamentosa e stewardship de antimicrobianos;
- laboratório com amostras, resultados, críticos, liberação e histórico;
- imagem com execução, PACS/DICOM, laudo, liberação e histórico;
- internação e mapa/movimentação de leitos;
- urgência/emergência e reavaliação;
- centro cirúrgico, anestesia, RPA, OPME e CME;
- nutrição;
- hemoterapia;
- CCIH;
- UTI e ventilação mecânica;
- transporte de pacientes;
- obstetrícia, parto e neonatal;
- óbitos;
- segurança do paciente;
- procedimentos assistenciais;
- planejamento e sumário de alta.

## Regras críticas

1. Registro clínico assinado é imutável; correções posteriores usam adendo/retificação.
2. Prescrição de medicamento nasce como `rascunho` e só passa a `ativa` após assinatura.
3. A fila da Farmácia é criada depois da assinatura da prescrição, não no rascunho.
4. Prescrição marcada como dependente de validação farmacêutica não pode ser dispensada antes de parecer válido.
5. Dispensação e devolução movimentam o lote de estoque de forma transacional.
6. Leito não pode ter dupla ocupação ativa; transferência e alta atualizam o estado do leito atomicamente.
7. Resultados e laudos liberados recebem hash e histórico de versão.
8. Escritas assistenciais usam RLS por módulo/permissão, além do escopo empresa/unidade.

## Publicação

Este lote deve ser publicado em um único commit para evitar builds repetidos na Vercel. Alterações posteriores voltam a ser acumuladas até nova autorização explícita de publicação.
