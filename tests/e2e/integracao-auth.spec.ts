import { expect, test } from "@playwright/test";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const hasAuthenticatedEnvironment = Boolean(
  email && password && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

test.describe("integração intersetorial autenticada", () => {
  test.skip(!hasAuthenticatedEnvironment, "Configure as credenciais E2E e um Supabase de homologação para executar a jornada autenticada.");

  test("perfil autorizado acessa a Central de Pendências Intersetoriais", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email!);
    await page.getByLabel("Senha").fill(password!);
    await page.getByRole("button", { name: "Entrar no sistema" }).click();
    await expect(page).toHaveURL(/\/painel(?:\?|$)/);

    await page.goto("/integracoes");
    await expect(page).toHaveURL(/\/integracoes(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "Central de Pendências Intersetoriais" })).toBeVisible();
    await expect(page.getByText("Pendências que exigem ação")).toBeVisible();
    await expect(page.getByText("Eventos de integração")).toBeVisible();
  });
});
