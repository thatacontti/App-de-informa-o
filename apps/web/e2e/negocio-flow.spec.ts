import { expect, test } from '@playwright/test';

test('Negócio: KPIs do snapshot V27 e filtro por marca atualiza dados', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('admin@catarina.local');
  await page.getByLabel('Senha').fill('Catarina2026!');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/negocio/, { timeout: 30_000 });

  // KPIs principais — exact match evita strict-mode com texto da seção
  await expect(page.getByText('Faturamento', { exact: true })).toBeVisible();
  await expect(page.getByText('SKUs', { exact: true })).toBeVisible();
  await expect(page.getByText('Clientes', { exact: true })).toBeVisible();

  // Snapshot total esperado: R$ 4.788.607
  await expect(page.locator('text=/4\\.788\\.607|4\\.788\\.\\d{3}/').first()).toBeVisible({ timeout: 30_000 });

  // SSS macro banner com headline
  await expect(page.getByText(/SSS YoY/i).first()).toBeVisible();

  // Filtra por marca KIKI
  await page.getByRole('button', { name: 'KIKI', exact: true }).first().click();
  await page.waitForTimeout(1500);
  // O total agregado muda — KIKI sozinha tem ~R$ 3.25 MM
  await expect(page.locator('text=/3\\.\\d{3}\\.\\d{3}/').first()).toBeVisible({ timeout: 30_000 });
});
