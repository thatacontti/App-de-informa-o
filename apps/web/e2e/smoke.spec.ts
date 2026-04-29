import { test, expect } from '@playwright/test';

test('unauthenticated visit to / redirects to /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Painel');
});

test('login page renders e-mail and password fields', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('E-mail')).toBeVisible();
  await expect(page.getByLabel('Senha')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});

test('forbidden page renders 403 message', async ({ page }) => {
  await page.goto('/forbidden?action=admin:users');
  await expect(page.getByText('Acesso negado')).toBeVisible();
  await expect(page.getByText('admin:users')).toBeVisible();
});
