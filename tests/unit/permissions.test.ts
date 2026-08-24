import { describe, expect, it } from "vitest";
import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  permissions,
} from "@/lib/permissions/catalog";
import {
  canAccessNavigation,
  navigationRequirements,
  requirementForPath,
} from "@/lib/permissions/navigation";

describe("RBAC", () => {
  it("autoriza somente código concedido", () => {
    expect(hasPermission(["pacientes.visualizar"], "pacientes.visualizar")).toBe(true);
    expect(hasPermission([], "prontuario.visualizar")).toBe(false);
  });

  it("suporta autorização por qualquer ou por todas as permissões", () => {
    const granted = ["prontuario.visualizar", "prescricao.criar"];
    expect(hasAnyPermission(granted, ["prescricao.visualizar", "prescricao.criar"])).toBe(true);
    expect(hasAllPermissions(granted, ["prontuario.visualizar", "prescricao.criar"])).toBe(true);
    expect(hasAllPermissions(granted, ["prontuario.visualizar", "prontuario.assinar"])).toBe(false);
  });

  it("não contém códigos duplicados nem fora do padrão", () => {
    expect(new Set(permissions).size).toBe(permissions.length);
    for (const permission of permissions) {
      expect(permission).toMatch(/^[a-z]+[a-z0-9_.]+$/);
      expect(permission).toContain(".");
    }
  });

  it("mantém todas as permissões da navegação no catálogo tipado", () => {
    const known = new Set<string>(permissions);
    for (const required of Object.values(navigationRequirements).flat()) {
      expect(known.has(required)).toBe(true);
    }
  });

  it("resolve a rota mais específica antes da rota pai", () => {
    expect(requirementForPath("/faturamento/lotes/123")).toEqual([
      "tiss.visualizar",
      "faturamento.visualizar",
    ]);
    expect(requirementForPath("/financeiro/notas-fiscais/abc")).toEqual([
      "nfse.visualizar",
      "financeiro.visualizar",
    ]);
  });

  it("oculta módulo sem permissão e preserva aliases legados", () => {
    expect(canAccessNavigation([], "/setores/farmacia")).toBe(false);
    expect(canAccessNavigation(["farmacia.visualizar"], "/setores/farmacia")).toBe(true);
    expect(canAccessNavigation(["senhas.visualizar"], "/senhas")).toBe(true);
    expect(canAccessNavigation(["guias.visualizar"], "/central-guias")).toBe(true);
  });

  it("mantém navegação disponível apenas quando a carga de permissões falha", () => {
    expect(canAccessNavigation(null, "/auditoria")).toBe(true);
    expect(canAccessNavigation([], "/auditoria")).toBe(false);
  });
});
