# Transferências interunidades

Fluxo operacional do NIR para continuidade assistencial entre unidades da mesma empresa.

- A unidade de origem solicita a transferência a partir de uma internação ativa com leito.
- A unidade de destino recebe a fila com identificação mínima do paciente, resumo clínico e condições de transporte sem abrir a RLS do prontuário de origem.
- O destino aceita selecionando um leito físico livre ou recusa com motivo.
- O aceite encerra o segmento/RA da origem, inicia higienização do leito de origem, abre um novo atendimento/RA e internação na unidade destino, ocupa o leito destino e preserva os vínculos na tabela de transferência.
- O CNES do novo atendimento é sincronizado com a unidade destino.
- A conta do segmento de origem é preparada; falha gera pendência transversal sem desfazer a continuidade clínica.
- Reserva ativa de outro atendimento bloqueia a ocupação do leito. Reserva compatível é consumida ao ocupar.
- Mutação ocorre apenas por RPCs com autenticação, escopo e RBAC; `authenticated` mantém apenas SELECT direto na trilha.

## Ambiente conectado

No momento da implementação há apenas uma unidade ativa (`[TESTE] Unidade Principal`). Por isso não existe cenário real de destino para homologação interunidades. A interface informa essa ausência e não cria unidade fictícia.

Migrations versionadas neste pacote:

- `20260830012951_internacao_transferencia_interunidades_operacional.sql` (drift já existente no Supabase);
- `20260830013036_internacao_transferencia_cnes_destino.sql` (drift já existente no Supabase);
- `20260830023008_internacao_transferencia_reserva_leito_hardening.sql`;
- `20260830023525_internacao_transferencia_destinos_operacionais.sql`;
- `20260830023629_internacao_transferencia_fila_operacional.sql`.
