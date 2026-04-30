// Visual regression — captures masked screenshots of each tab and
// compares against the snapshot baseline next to the spec.
//
// We mask the user-badge and the relative "última sync" cell so
// timestamps don't churn the diff.

import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'Catarina2026!';

async function loginAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('admin@catarina.local');
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

const VIEWPORT = { width: 1500, height: 1000 };

test.describe('snapshots por aba', () => {
  test.use({ viewport: VIEWPORT });

  test('login screen', async ({ page }) => {
    await page.goto('/login');
    // The hero gradient + form card are the visual identity of the auth shell.
    await expect(page).toHaveScreenshot('login.png', { fullPage: false, maxDiffPixelRatio: 0.02 });
  });

  test('Negócio · acima da dobra', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/negocio');
    await page.locator('text=/4\\.788\\.\\d{3}/').first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('negocio.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.04,
      mask: [page.locator('header [class*="h-[500px]"]')],
    });
  });

  test('Marca · Cidade · acima da dobra', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/marca-cidade');
    await page.getByText('SSS por Marca · V26 estimado vs V27').first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('marca-cidade.png', { fullPage: false, maxDiffPixelRatio: 0.04 });
  });

  test('Produto · Estratégia · acima da dobra', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/produto');
    await page.getByText('Resumo para Desenvolvimento').first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('produto.png', { fullPage: false, maxDiffPixelRatio: 0.04 });
  });

  test('Mapa de Ataque · acima da dobra', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/mapa');
    await page.getByText(/Mapa de Ataque · Visão Completa/).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('mapa.png', { fullPage: false, maxDiffPixelRatio: 0.04 });
  });

  test('Admin · Fontes', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/datasources');
    await page.getByRole('heading', { name: 'Fontes de dados' }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('admin-datasources.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.04,
      // mask the relative "última sync" cells (they tick every second)
      mask: [page.locator('td:has-text("min atrás"), td:has-text("agora")')],
    });
  });
});
