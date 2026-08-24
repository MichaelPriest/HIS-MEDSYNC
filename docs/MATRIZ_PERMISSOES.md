# Matriz de permissões

Perfis são agrupadores editáveis e podem ser vinculados ao usuário no escopo da empresa inteira ou de uma unidade. Policies, server actions e regras de aplicação verificam **códigos de permissão**, nunca o nome do perfil.

A navegação usa a matriz para reduzir exposição visual de módulos não autorizados, mas **não é fronteira de segurança**. O RLS do Supabase continua sendo a barreira definitiva de acesso aos dados.

## Domínios principais

| Domínio | Visualizar | Operar / criar | Ações sensíveis |
|---|---|---|---|
| Empresas | `empresas.visualizar` | — | `empresas.administrar` |
| Estrutura | `estrutura.visualizar` | `estrutura.criar`, `estrutura.editar` | — |
| Usuários e acessos | `usuarios.visualizar` | `usuarios.vincular` | `usuarios.administrar` |
| Pacientes | `pacientes.visualizar` | `pacientes.criar`, `pacientes.editar` | — |
| Profissionais | `profissionais.visualizar` | `profissionais.criar`, `profissionais.editar` | — |
| Convênios | `convenios.visualizar` | `convenios.criar`, `convenios.editar` | — |
| Catálogos | `catalogos.visualizar` | `catalogos.criar`, `catalogos.editar` | — |
| Agenda | `agenda.visualizar` | `agenda.criar`, `agenda.editar` | — |
| Recepção / senhas | `recepcao.visualizar`, `senhas.visualizar` | `recepcao.operar`, `senhas.chamar` | `paineis.configurar` |
| Atendimento | `atendimentos.visualizar` | `atendimentos.abrir`, `atendimentos.transferir` | `atendimentos.alta` |
| Autorizações / guias | `autorizacoes.visualizar`, `guias.visualizar` | `autorizacoes.solicitar`, `guias.gerenciar` | `autorizacoes.decidir` |
| Triagem | `triagem.visualizar` | `triagem.registrar`, `triagem.encaminhar` | — |
| Fila médica | `fila_medica.visualizar` | `fila_medica.assumir`, `fila_medica.operar` | — |
| Prontuário | `prontuario.visualizar` | `prontuario.evoluir` | `prontuario.assinar`, `prontuario.adendo` |
| Prescrição | `prescricao.visualizar` | `prescricao.criar` | `prescricao.assinar`, `prescricao.suspender` |
| Enfermagem | `enfermagem.visualizar` | `enfermagem.registrar`, `enfermagem.checar` | `enfermagem.gerenciar` |
| Farmácia | `farmacia.visualizar` | `farmacia.dispensar`, `farmacia.devolver` | `farmacia.validar`, `farmacia.gerenciar` |
| Administração de medicamentos | — | `medicamentos.administrar` | — |
| Laboratório | `laboratorio.visualizar` | `laboratorio.coletar`, `laboratorio.resultar` | `laboratorio.liberar`, `laboratorio.criticos` |
| Imagem | `imagem.visualizar` | `imagem.agendar`, `imagem.executar`, `imagem.laudar` | `imagem.liberar` |
| Internação | `internacao.visualizar` | `internacao.admitir`, `internacao.movimentar` | `internacao.alta` |
| Centro cirúrgico / CME | `centro_cirurgico.visualizar` | `centro_cirurgico.operar` | — |
| Nutrição | `nutricao.visualizar` | `nutricao.operar` | — |
| Hemoterapia | `hemoterapia.visualizar` | `hemoterapia.operar` | — |
| CCIH | `ccih.visualizar` | `ccih.operar` | — |
| UTI | `uti.visualizar` | `uti.operar` | — |
| Compras | `compras.visualizar` | `compras.solicitar`, `compras.cotar`, `compras.receber` | `compras.aprovar` |
| Estoque | `estoque.visualizar` | `estoque.movimentar`, `estoque.inventariar` | `estoque.gerenciar` |
| Comercial | `comercial.visualizar` | `comercial.editar` | — |
| Auditoria | `auditoria.visualizar` | `auditoria.analisar`, `auditoria.executar` | `auditoria.liberar` |
| Contas médicas | `contas_medicas.visualizar` | `contas_medicas.analisar`, `contas_medicas.processar` | `contas_medicas.liberar` |
| Faturamento | `faturamento.visualizar` | `faturamento.criar` | `faturamento.fechar` |
| TISS | `tiss.visualizar` | `tiss.gerar`, `tiss.retorno` | `tiss.enviar` |
| Glosas | `glosas.visualizar` | `glosas.registrar` | `glosas.recorrer` |
| Financeiro | `financeiro.visualizar` | `financeiro.receber` | `financeiro.conciliar`, `financeiro.gerenciar` |
| NFS-e | `nfse.visualizar` | `nfse.configurar` | `nfse.emitir`, `nfse.gerenciar` |
| GED | `ged.visualizar` | `ged.enviar` | `ged.administrar`, `ged.gerenciar` |
| Diretoria | `diretoria.visualizar` | — | — |
| Configurações | `configuracoes.visualizar` | — | `configuracoes.administrar` |

## Compatibilidade

O catálogo mantém códigos legados que já são usados por policies e pelo baseline, como `internacao.criar`, `internacao.editar`, `exames.gerenciar`, `farmacia.gerenciar`, `auditoria.executar`, `contas_medicas.processar`, `credenciamento.gerenciar` e equivalentes. Novos códigos mais granulares são adicionados sem renomear permissões existentes.

## Perfis de sistema

A migration P0 preserva e amplia os perfis de sistema já existentes: **Administrador, Recepção, Médico, Enfermagem, Faturamento, Auditoria, Financeiro e Compras e Estoque**. O perfil Administrador permanece sincronizado com todo o catálogo ativo para impedir lockout acidental.

A tela `/configuracoes/acessos` permite criar perfis personalizados, definir a matriz de permissões e vincular perfis a usuários por empresa/unidade. Alterações de acesso são registradas em `auditoria_eventos`.
