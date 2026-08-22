import { z } from "zod";
export const auditEventSchema = z.object({
  empresaId: z.string().uuid(), unidadeId: z.string().uuid().nullable(), operacao: z.string().min(1).max(50),
  entidade: z.string().min(1).max(80), registroId: z.string().uuid().nullable(), origem: z.enum(["web", "api", "job"]),
  correlationId: z.string().uuid(), motivo: z.string().max(500).optional(), alteracoes: z.record(z.string(), z.unknown()).optional(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;
