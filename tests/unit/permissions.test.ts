import { describe, expect, it } from "vitest";
import { hasPermission, permissions } from "@/lib/permissions/catalog";
describe("RBAC", () => { it("autoriza somente código concedido", () => { expect(hasPermission(["pacientes.visualizar"],"pacientes.visualizar")).toBe(true); expect(hasPermission([],"prontuario.visualizar")).toBe(false); }); it("não contém códigos duplicados", () => expect(new Set(permissions).size).toBe(permissions.length)); });
