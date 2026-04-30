import { test, expect, type Page } from '@playwright/test';
import * as path from 'node:path';

const PASSWORD = 'Catarina2026!';
const OUTPUT_DIR = path.resolve(__dirname, '../../../', 'storage', 'screenshots-demo');

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

test.describe('Demo screenshots — entrega rodando', () => {
  test.use({ viewport: { width: 1500, height: 1000 } });

  test('login screen', async ({ page }) => {
    await page.goto('/login');
    await page.screenshot({ path: `${OUTPUT_DIR}/01-login.png`, fullPage: true });
  });

  test('admin · negocio + filtros', async ({ page }) => {
    await login(page, 'admin@catarina.local');
    await page.goto('/negocio');
    await page.locator('text=/4\\.788\\.\\d{3}/').first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUTPUT_DIR}/02-admin-negocio.png`, fullPage: true });
  });

  test('admin · marca-cidade', async ({ page }) => {
    await login(page, 'admin@catarina.local');
    await page.goto('/marca-cidade');
    await page.getByText('SSS por Marca').first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUTPUT_DIR}/03-admin-marca-cidade.png`, fullPage: true });
  });

  test('admin · produto', async ({ page }) => {
    await login(page, 'admin@catarina.local');
    await page.goto('/produto');
    await page.getByText('Resumo para Desenvolvimento').first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUTPUT_DIR}/04-admin-produto.png`, fullPage: true });
  });

  test('admin · mapa', async ({ page }) => {
    await login(page, 'admin@catarina.local');
    await page.goto('/mapa');
    await page.getByText(/Mapa de Ataque · Visão Completa/).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUTPUT_DIR}/05-admin-mapa.png`, fullPage: true });
  });

  test('admin · datasources', async ({ page }) => {
    await login(page, 'admin@catarina.local');
    await page.goto('/admin/datasources');
    await page.getByRole('heading', { name: 'Fontes de dados' }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUTPUT_DIR}/06-admin-datasources.png`, fullPage: true });
  });

  test('gestor · negocio (sem botão sincronizar)', async ({ page }) => {
    await login(page, 'gestor@catarina.local');
    await page.goto('/admin/datasources');
    await page.getByRole('heading', { name: 'Fontes de dados' }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUTPUT_DIR}/07-gestor-datasources-readonly.png`, fullPage: true });
  });

  test('analista · negocio modo Peças', async ({ page }) => {
    await login(page, 'analista@catarina.local');
    await page.goto('/negocio');
    await page.locator('main').waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUTPUT_DIR}/08-analista-negocio-pecas.png`, fullPage: true });
  });

  test('analista · forbidden em /admin/users', async ({ page }) => {
    await login(page, 'analista@catarina.local');
    await page.goto('/admin/users');
    await page.getByText('Acesso negado').waitFor({ timeout: 30_000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUTPUT_DIR}/09-analista-forbidden.png`, fullPage: true });
  });
});
