import { expect, test } from "@playwright/test";

test.describe("autenticação pública", () => {
  test("exibe login institucional sem depender de sessão remota", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Bem-vindo ao MedSync" })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar no sistema" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Esqueci minha senha" })).toHaveAttribute("href", "/recuperar-senha");
  });

  test("abre recuperação de acesso e permite retornar ao login", async ({ page }) => {
    await page.goto("/recuperar-senha");
    await expect(page.getByRole("heading", { name: "Recuperar acesso" })).toBeVisible();
    await expect(page.getByLabel("E-mail institucional")).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar instruções" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Voltar para entrar" })).toHaveAttribute("href", "/login");
  });
});
