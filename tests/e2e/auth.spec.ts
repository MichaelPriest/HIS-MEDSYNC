import { expect, test } from "@playwright/test";
test("rota privada redireciona para autenticação", async ({ page }) => { await page.goto("/painel"); await expect(page).toHaveURL(/\/login$/); await expect(page.getByRole("heading",{name:"Entrar"})).toBeVisible(); });
