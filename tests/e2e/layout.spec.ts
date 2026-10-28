import { expect, test } from '@playwright/test';

for (const width of [375, 768, 1024, 1440]) {
  test(`四工具在 ${width}px 布局无页面溢出`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    for (const [id, heading] of [['json', 'JSON 格式化'], ['time', '时间戳转换'], ['barcode', '条形码工具'], ['qrcode', '二维码工具']]) {
      await page.goto(`/#/tools/${id}`);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      await expect(page.locator('.tool-grid')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      if (testInfo.project.name === 'chromium') await page.screenshot({ path: testInfo.outputPath(`${id}-${width}.png`), fullPage: true });
    }
  });
}

test('手机导航支持焦点管理与主题切换', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('button', { name: '打开工具导航' }).click();
  await expect(page.getByRole('dialog', { name: '工具导航' })).toBeVisible();
  await expect(page.getByLabel('搜索工具')).toBeFocused();
  await page.getByRole('link', { name: '二维码工具' }).click();
  await expect(page.getByRole('heading', { name: '二维码工具', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '深色主题' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
