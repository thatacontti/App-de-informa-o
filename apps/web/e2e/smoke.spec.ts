import { test, expect } from '@playwright/test';

test('homepage shows hero and status section', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Verão');
  await expect(page.getByText('Status de implementação')).toBeVisible();
});
