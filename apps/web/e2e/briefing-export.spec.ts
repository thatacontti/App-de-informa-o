import { expect, test } from '@playwright/test';

test('ADMIN gera briefing e o artefato é servido pelo /api/briefing', async ({ page, context }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('admin@catarina.local');
  await page.getByLabel('Senha').fill('Catarina2026!');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  const [popup] = await Promise.all([
    context.waitForEvent('page', { timeout: 60_000 }),
    page.getByRole('button', { name: /Exportar PDF/i }).click(),
  ]);

  // O artefato carrega — em sandbox sem Chromium, o fallback HTML é entregue.
  await popup.waitForLoadState('domcontentloaded');
  expect(popup.url()).toMatch(/\/api\/briefing\/[^/]+\/pdf/);
  // Briefing HTML reconhecível (header tag)
  const body = await popup.content();
  expect(body).toContain('Briefing Diretoria');
});
