import { expect, test } from '@playwright/test';

test('JSON 格式化保留数字原文与重复键，输入修改后禁用旧结果', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/#\/tools\/json$/);
  const input = page.getByLabel('JSON 输入', { exact: true });
  const source = '{"id":900719925474099312345,"x":1e+20,"x":-0,"text":"中文 😀"}';
  await input.fill(source);
  await page.getByRole('button', { name: '格式化', exact: true }).click();
  const output = page.getByLabel('JSON 处理结果', { exact: true });
  await expect(output).toContainText('900719925474099312345');
  await expect(output).toContainText('1e+20');
  await expect(output).toContainText('"x": -0');
  await expect(page.getByRole('button', { name: '下载 JSON' })).toBeEnabled();
  await input.fill('{"changed":true}');
  await expect(page.getByRole('button', { name: '下载 JSON' })).toBeDisabled();
  await expect(page.getByText('输入或缩进已修改，请重新处理以更新结果。')).toBeVisible();
  await page.getByRole('button', { name: '压缩', exact: true }).click();
  await expect(output).toHaveText('{"changed":true}');
});

test('JSON 错误定位、标准顶层标量和下载', async ({ page }) => {
  await page.goto('/#/tools/json');
  const input = page.getByLabel('JSON 输入', { exact: true });
  await input.fill('{\n"a":1,\n}');
  await page.getByRole('button', { name: '校验 JSON' }).click();
  await expect(page.locator('.error-message')).toContainText('第 3 行');
  await expect(input).toBeFocused();
  await input.fill('"hello 😀"');
  await page.getByRole('button', { name: '格式化', exact: true }).click();
  await expect(page.getByLabel('JSON 处理结果', { exact: true })).toHaveText('"hello 😀"');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('formatted.json');
  const stream = await download.createReadStream();
  const pieces: Buffer[] = [];
  for await (const piece of stream!) pieces.push(piece as Buffer);
  expect(Buffer.concat(pieces).toString()).toBe('"hello 😀"');
});

test('草稿仅在会话保留，搜索、深链接、前进后退有效', async ({ page }) => {
  await page.goto('/#/tools/json');
  await page.getByLabel('JSON 输入', { exact: true }).fill('{"draft":true}');
  await page.getByRole('link', { name: '时间戳转换' }).click();
  await expect(page.getByRole('heading', { name: '时间戳转换', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel('JSON 输入', { exact: true })).toHaveText('{"draft":true}');
  await page.getByLabel('搜索工具').fill('qr');
  await expect(page.getByRole('link', { name: '二维码工具' })).toBeVisible();
  await expect(page.getByRole('link', { name: '时间戳转换' })).toHaveCount(0);
  await page.getByLabel('搜索工具').fill('');
  await page.reload();
  await expect(page.getByLabel('JSON 输入', { exact: true })).toBeEmpty();
});

test('时间戳零点、负小数、偏移日期及非法日期', async ({ page }) => {
  await page.goto('/#/tools/time');
  await page.getByLabel('Unix 时间戳', { exact: true }).fill('0');
  await page.getByRole('button', { name: '转换为日期' }).click();
  await expect(page.getByText('1970-01-01T00:00:00.000Z', { exact: true })).toBeVisible();
  await page.getByLabel('时间戳单位').selectOption('seconds');
  await page.getByLabel('Unix 时间戳', { exact: true }).fill('-0.001');
  await page.getByRole('button', { name: '转换为日期' }).click();
  await expect(page.getByText('1969-12-31T23:59:59.999Z', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '日期 → 时间戳' }).click();
  await page.getByLabel('日期时间', { exact: true }).fill('2024-01-01T08:00:00+08:00');
  await page.getByRole('button', { name: '转换为时间戳' }).click();
  await expect(page.getByText('2024-01-01T00:00:00.000Z', { exact: true })).toBeVisible();
  await page.getByLabel('日期时间', { exact: true }).fill('2023-02-29 12:00:00');
  await page.getByRole('button', { name: '转换为时间戳' }).click();
  await expect(page.getByRole('alert')).toContainText('日期无效');
});

test('本地时区下拒绝夏令时不存在和重复时间', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'America/New_York' });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/#/tools/time');
  await page.getByRole('tab', { name: '日期 → 时间戳' }).click();
  for (const value of ['2024-03-10 02:30:00', '2024-11-03 01:30:00']) {
    await page.getByLabel('日期时间', { exact: true }).fill(value);
    await page.getByRole('button', { name: '转换为时间戳' }).click();
    await expect(page.getByRole('alert')).toContainText('夏令时');
  }
  await page.clock.setFixedTime(new Date('2024-11-03T05:30:00Z'));
  await page.getByRole('button', { name: '当前时间', exact: true }).click();
  await expect(page.getByText('2024-11-03T05:30:00.000Z', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await context.close();
});

test('主题持久化，已加载 JSON 工具离线可计算且无外部请求', async ({ page, context }) => {
  const external: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:4173/')) external.push(request.url()); });
  await page.goto('/#/tools/json');
  await page.getByRole('button', { name: '深色主题', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '试用示例' }).click();
  await page.getByRole('button', { name: '格式化', exact: true }).click();
  await expect(page.getByLabel('JSON 处理结果', { exact: true })).toContainText('dev-toolbox');
  await context.setOffline(true);
  await page.getByLabel('JSON 输入', { exact: true }).fill('{"offline":true}');
  await page.getByRole('button', { name: '格式化', exact: true }).click();
  await expect(page.getByLabel('JSON 处理结果', { exact: true })).toContainText('"offline": true');
  expect(external).toEqual([]);
});
