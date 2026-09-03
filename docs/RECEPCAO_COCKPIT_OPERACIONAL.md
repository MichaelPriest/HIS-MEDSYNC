# Cockpit operacional da Recepção

## Objetivo

Concentrar em uma única visão o que a Recepção precisa acompanhar entre a chegada do paciente e a abertura do atendimento, sem criar um fluxo paralelo ao Totem ou à Agenda.

O cockpit é somente uma visão operacional. Ele não emite senha, não faz check-in e não cria atendimento diretamente no banco.

## Origens permitidas para admissão

O HIS mantém duas origens válidas para abrir atendimento:

1. **Demanda espontânea pelo Totem**: a senha deve chegar à Recepção, ser chamada e entrar em atendimento no guichê antes da admissão.
2. **Paciente agendado**: o agendamento deve estar com **check-in** confirmado antes da abertura.

O cockpit não oferece um botão genérico de “novo atendimento”. Cada ação de abertura carrega obrigatoriamente o identificador da senha ou do agendamento correspondente.

## O que aparece no cockpit

- quantidade de senhas aguardando no Totem no dia;
- pacientes já chamados;
- admissões iniciadas e ainda não concluídas;
- check-ins da Agenda ainda sem atendimento criado;
- quantidade de atendimentos ativos na unidade;
- lista ordenada dos próximos passos da Recepção;
- relação resumida dos atendimentos ativos.

## Próximos passos

### Senha chamada

A senha continua sendo administrada na tela **Fila de senhas**. O usuário seleciona o guichê e inicia a admissão pelo fluxo já existente.

### Admissão iniciada pelo Totem

O cockpit oferece **Continuar admissão** e abre `/atendimentos/novo?senha=<id>`. A própria tela de admissão volta a validar se a senha ainda está em atendimento e sem atendimento vinculado.

### Check-in da Agenda

O cockpit oferece **Abrir atendimento** e abre `/atendimentos/novo?agendamento=<id>`. A tela de admissão valida novamente se o agendamento ainda está em check-in, se não é cirurgia eletiva e se nenhum atendimento já foi criado para ele.

## Atualização em tempo real

A tela acompanha mudanças autorizadas pelo RLS nas tabelas:

- `senhas_atendimento`;
- `agendamentos`;
- `atendimentos`.

Quando um evento chega, o servidor refaz somente a leitura da página. Existe também um heartbeat de segurança de 60 segundos e atualização ao retornar para a aba.

## Segurança

- nenhuma nova migration ou RPC foi criada;
- as consultas continuam sob o RLS das tabelas existentes;
- o cockpit não faz `INSERT`, `UPDATE`, `DELETE` ou `UPSERT`;
- IDs de senha e agendamento são usados somente nas rotas internas já validadas;
- não existe admissão direta sem origem válida;
- dados clínicos, token, biometria, carteirinha e senha de autorização não são transportados em links do cockpit.

## Uso recomendado

Mantenha o cockpit aberto no posto da Recepção para acompanhar as chegadas. Use a **Fila de senhas** para chamar demanda espontânea, a **Agenda** para confirmar check-in e o cockpit para enxergar o que está pronto para o próximo passo sem alternar entre várias listagens.
