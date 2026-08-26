# Manual de Diagnóstico por Imagem (RIS/PACS)

## Objetivo

O módulo de Diagnóstico por Imagem funciona como RIS integrado ao HIS e preparado para integração com PACS/DICOM. Solicitação, agenda, execução, equipamento, contraste, dose, imagens e laudo permanecem vinculados ao mesmo episódio assistencial.

## Fluxo operacional

1. O exame é solicitado no prontuário e chega à fila de Imagem.
2. A equipe agenda data/hora, sala, equipamento e protocolo técnico.
3. Confirmação, chegada, falta e cancelamento são registrados na agenda.
4. A execução cria/usa accession number e exige equipamento operacional.
5. A execução registra início, término, sala, equipamento e intercorrências.
6. Quando houver PACS/DICOM, são preservados Study Instance UID, Series Instance UID e referência PACS.
7. Contraste é registrado com lote, validade, volume, via e checagens de segurança.
8. Dose de radiação é registrada quando aplicável.
9. Após a execução concluída, o radiologista/profissional autorizado abre o laudo.
10. O laudo pode ser salvo como rascunho e revisado.
11. A assinatura libera o laudo e encerra a solicitação.
12. Laudo liberado não pode ser alterado ou excluído diretamente.
13. Correção exige retificação formal com motivo e nova revisão.
14. O documento pode ser impresso/salvo em PDF e, futuramente, publicado no Portal do Paciente por regra de liberação externa.

## Agenda RIS

A agenda guarda:

- solicitação e atendimento;
- paciente;
- protocolo técnico;
- data/hora e duração;
- sala;
- equipamento e vínculo com Engenharia Clínica;
- status operacional;
- observações.

## Execução e PACS/DICOM

`imagem_execucoes` representa o ato realizado. O RIS mantém:

- accession number;
- protocolo;
- sala e equipamento;
- profissional executor;
- início/fim;
- Study Instance UID;
- Series Instance UID;
- referência PACS;
- intercorrências.

O HIS não depende de uma URL PACS para manter o laudo. A camada PACS/DICOM pode ser integrada posteriormente sem alterar o vínculo clínico ou o documento assinado.

## Contraste

O registro de contraste contempla:

- contraste utilizado;
- lote e validade;
- volume e via;
- alergia questionada/negada;
- função renal e parâmetros disponíveis;
- consentimento;
- data/profissional da administração;
- reação adversa e conduta.

## Dose de radiação

Quando aplicável, podem ser armazenados modalidade, CTDIvol, DLP, DAP, dose em mGy e tempo de fluoroscopia, mantendo rastreabilidade clínica e técnica.

## Laudos

A arquitetura garante um laudo por execução através de índice único. A edição usa RPC transacional e não `UPDATE` livre.

Regras principais:

- execução deve estar concluída para criar/editar o laudo;
- rascunho pode ser editado;
- laudo liberado é imutável;
- liberação exige conteúdo e profissional vinculado;
- assinatura gera hash SHA-256;
- retificação exige motivo, preserva versão anterior e incrementa revisão;
- a solicitação só é encerrada na liberação do laudo.

O RLS também impede atualização/exclusão direta de laudos liberados. As RPCs de salvar, retificar e liberar são executáveis apenas por usuários autenticados e verificam permissões internas.

## Permissões principais

- `imagem.visualizar`;
- `imagem.agendar`;
- `imagem.executar`;
- `imagem.laudar`;
- `imagem.liberar_laudo`;
- permissões relacionadas a gerenciamento conforme o perfil institucional.

## Impresso/PDF

O laudo impresso contém:

- unidade/CNES;
- paciente e identificação do episódio;
- exame e TUSS;
- accession;
- sala/equipamento;
- horário da execução;
- técnica;
- achados;
- conclusão;
- recomendações;
- responsável e conselho;
- revisão;
- hash SHA-256;
- Study/Series UID quando disponíveis.

O HIS permanece digital por padrão; a impressão é destinada a contingência ou necessidade externa.

## Integração com produção e faturamento

A solicitação por si só não constitui produção faturável. O evento de execução concluída, documentação e liberação do laudo compõem a rastreabilidade. Código e preço final são resolvidos pela regra contratual/pacote aplicável no ciclo da receita.
