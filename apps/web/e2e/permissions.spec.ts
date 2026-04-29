import { test, expect, type Page } from '@playwright/test';

const PASSWORD = 'Catarina2026!';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

test.describe('matriz de permissões · 3 perfis', () => {
  test('ADMIN acessa todas as rotas (incluindo /admin/users e /admin/audit)', async ({ page }) => {
    await login(page, 'admin@catarina.local');
    for (const path of ['/negocio', '/marca-cidade', '/produto', '/mapa', '/admin/users', '/admin/datasources', '/admin/audit']) {
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/forbidden/);
    }
  });

  test('GESTOR acessa as 4 abas e datasources (read), mas é bloqueado em users e audit', async ({ page }) => {
    await login(page, 'gestor@catarina.local');
    for (const allowed of ['/negocio', '/marca-cidade', '/produto', '/mapa', '/admin/datasources']) {
      await page.goto(allowed);
      await expect(page).not.toHaveURL(/\/forbidden/);
    }
    for (const blocked of ['/admin/users', '/admin/audit']) {
      await page.goto(blocked);
      await expect(page).toHaveURL(/\/forbidden/);
    }
  });

  test('ANALISTA acessa só as 4 abas e datasources (read); admin é bloqueado', async ({ page }) => {
    await login(page, 'analista@catarina.local');
    for (const allowed of ['/negocio', '/marca-cidade', '/produto', '/mapa', '/admin/datasources']) {
      await page.goto(allowed);
      await expect(page).not.toHaveURL(/\/forbidden/);
    }
    for (const blocked of ['/admin/users', '/admin/audit']) {
      await page.goto(blocked);
      await expect(page).toHaveURL(/\/forbidden/);
    }
  });
});
