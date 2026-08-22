export const permissions = [
  "empresas.visualizar", "empresas.administrar", "estrutura.visualizar", "estrutura.criar", "estrutura.editar",
  "usuarios.visualizar", "usuarios.vincular", "usuarios.administrar", "pacientes.visualizar", "pacientes.criar",
  "pacientes.editar", "atendimentos.visualizar", "atendimentos.abrir", "atendimentos.transferir", "atendimentos.alta",
  "triagem.registrar", "prontuario.visualizar", "prontuario.evoluir", "prescricao.criar", "prescricao.suspender",
  "faturamento.visualizar", "faturamento.fechar", "auditoria.visualizar",
] as const;
export type Permission = (typeof permissions)[number];
export function hasPermission(granted: readonly string[], required: Permission) { return granted.includes(required); }
