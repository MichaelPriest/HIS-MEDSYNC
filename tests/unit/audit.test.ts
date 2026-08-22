import { describe, expect, it } from "vitest";
import { auditEventSchema } from "@/lib/audit/types";
describe("auditoria", () => { it("rejeita origem desconhecida", () => { expect(auditEventSchema.safeParse({ empresaId: crypto.randomUUID(), unidadeId:null, operacao:"ler", entidade:"paciente", registroId:null, origem:"browser", correlationId:crypto.randomUUID() }).success).toBe(false); }); });
