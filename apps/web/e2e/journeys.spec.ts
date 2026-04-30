import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'Catarina2026!';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

test.describe('jornada do ADMIN', () => {
  test('navega pelas 4 abas, vê toggle R$/Peças e botão Exportar PDF', async ({ page }) => {
    await login(page, 'admin@catarina.local');

    for (const path of ['/negocio', '/marca-cidade', '/produto', '/mapa']) {
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/forbidden/);
      await expect(page.locator('main')).toBeVisible();
    }

    await page.goto('/negocio');
    await expect(page.getByRole('button', { name: /^R\$$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Peças$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Exportar PDF/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Fontes' })).toBeVisible();
  });

  test('acessa /admin/datasources com botões Testar e Sincronizar', async ({ page }) => {
    await login(page, 'admin@catarina.local');
    await page.goto('/admin/datasources');
    await expect(page).not.toHaveURL(/\/forbidden/);
    await expect(page.getByRole('heading', { name: 'Fontes de dados' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Testar' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sincronizar' }).first()).toBeVisible();
  });
});

test.describe('jornada do GESTOR', () => {
  test('vê Exportar PDF e datasources read-only; /admin/users → forbidden', async ({ page }) => {
    await login(page, 'gestor@catarina.local');

    await expect(page.getByRole('button', { name: /Exportar PDF/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Peças$/ })).toBeVisible();

    await page.goto('/admin/datasources');
    await expect(page).not.toHaveURL(/\/forbidden/);
    await expect(page.getByRole('button', { name: 'Testar' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sincronizar' })).toHaveCount(0);

    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/forbidden/);
  });
});

test.describe('jornada do ANALISTA', () => {
  test('travado em Peças, sem Exportar PDF', async ({ page }) => {
    await login(page, 'analista@catarina.local');

    // Sem botão R$ clicável (analista não pode trocar)
    await expect(page.getByRole('button', { name: /^R\$$/ })).toHaveCount(0);
    // Sem botão Exportar PDF
    await expect(page.getByRole('button', { name: /Exportar PDF/i })).toHaveCount(0);

    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/forbidden/);
  });

  test('vê as 4 abas e /admin/datasources sem botão Sincronizar', async ({ page }) => {
    await login(page, 'analista@catarina.local');
    for (const path of ['/negocio', '/marca-cidade', '/produto', '/mapa', '/admin/datasources']) {
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/forbidden/);
    }
    await page.goto('/admin/datasources');
    await expect(page.getByRole('button', { name: 'Sincronizar' })).toHaveCount(0);
  });
});
