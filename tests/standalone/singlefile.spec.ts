import { expect, test, type Page } from '@playwright/test';
import { copyFile, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

let isolatedDirectory: string;
let fileUrl: string;
test.beforeAll(async () => {
  isolatedDirectory = await mkdtemp(join(tmpdir(), 'dev-toolbox-single-'));
  const target = join(isolatedDirectory, '开发者 工具箱.html');
  await copyFile(resolve('dev-toolbox.html'), target);
  fileUrl = pathToFileURL(target).href;
  expect(await readdir(isolatedDirectory)).toEqual(['开发者 工具箱.html']);
});
test.afterAll(async () => { await rm(isolatedDirectory, { recursive: true, force: true }); });

test.beforeEach(async ({ page }) => {
  // 不仅禁网，也拒绝意外引用项目目录中的额外文件。
  const unexpected: string[] = [];
  page.on('request', request => {
    const url = request.url();
    if (/^https?:/.test(url) || (url.startsWith('file:') && url.split('#')[0] !== fileUrl)) unexpected.push(url);
  });
  page.on('pageerror', error => unexpected.push(`pageerror: ${error.message}`));
  await page.goto(fileUrl);
  await expect(page.getByRole('heading', { name: 'JSON 格式化', exact: true })).toBeVisible();
  Object.assign(page, { standaloneUnexpected: unexpected });
});
test.afterEach(async ({ page }) => {
  expect((page as Page & { standaloneUnexpected: string[] }).standaloneUnexpected).toEqual([]);
});

async function download(page: Page, name: string) {
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  const saved = await (await event).path();
  if (!saved) throw new Error('下载未生成本地文件');
  return readFile(saved);
}

test('断网单文件：JSON 格式化、压缩、导入、校验与下载', async ({ page }) => {
  const input = page.getByLabel('JSON 输入', { exact: true });
  await input.fill('{"id":9007199254740993123,"x":1e+20,"x":-0,"text":"中文😀"}');
  await page.getByRole('button', { name: '格式化', exact: true }).click();
  const result = page.getByLabel('JSON 处理结果', { exact: true });
  await expect(result).toContainText('9007199254740993123');
  await expect(result).toContainText('"x": 1e+20');
  await expect(result).toContainText('"x": -0');
  expect((await download(page, '下载 JSON')).toString()).toContain('9007199254740993123');
  await input.fill('{"a":1,}');
  await page.getByRole('button', { name: '校验 JSON' }).click();
  await expect(page.locator('.error-message')).toBeVisible();
  await page.getByLabel('导入 JSON 文件').setInputFiles({ name: 'example.json', mimeType: 'application/json', buffer: Buffer.from('{ "local": true }') });
  await page.getByRole('button', { name: '压缩', exact: true }).click();
  await expect(result).toHaveText('{"local":true}');
  await page.getByRole('button', { name: '格式化', exact: true }).click();
  await expect(result).toContainText('"local": true');
});

test('断网单文件：时间转换、草稿、Hash 导航和刷新', async ({ page }) => {
  await page.getByLabel('JSON 输入', { exact: true }).fill('{"draft":1}');
  await page.getByRole('link', { name: '时间戳转换' }).click();
  await page.getByLabel('Unix 时间戳', { exact: true }).fill('-1');
  await page.getByRole('button', { name: '转换为日期' }).click();
  await expect(page.getByText('1969-12-31T23:59:59.999Z', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '日期 → 时间戳' }).click();
  await page.getByLabel('日期时间', { exact: true }).fill('2024-01-01T08:00:00+08:00');
  await page.getByRole('button', { name: '转换为时间戳' }).click();
  await expect(page.getByText('1704067200000', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel('JSON 输入', { exact: true })).toHaveText('{"draft":1}');
  await page.getByRole('button', { name: '深色主题' }).click();
  await page.reload();
  await expect(page.getByLabel('JSON 输入', { exact: true })).toBeEmpty();
  await page.getByRole('link', { name: '时间戳转换' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: '时间戳转换', exact: true })).toBeVisible();
});

test('断网单文件：五种条码生成导出与内嵌引擎回扫', async ({ page }) => {
  await page.getByRole('link', { name: '条形码工具' }).click();
  for (const [format, input, expected] of [
    ['CODE128', 'TEST-128', 'TEST-128'], ['CODE39', 'ABC+A', 'ABC+A'],
    ['EAN13', '400638133393', '4006381333931'], ['EAN8', '9638507', '96385074'], ['UPC', '03600029145', '0036000291452'],
  ]) {
    await page.getByRole('tab', { name: '生成条码' }).click();
    await page.getByLabel('编码制式').selectOption(format);
    await page.getByLabel('条码内容', { exact: true }).fill(input);
    await page.getByRole('button', { name: '生成条形码', exact: true }).click();
    await expect(page.getByRole('button', { name: '下载 PNG' })).toBeEnabled();
    const png = await download(page, '下载 PNG');
    expect((await download(page, '下载 SVG')).toString()).toContain('<svg');
    await page.getByRole('tab', { name: '识别图片' }).click();
    await page.locator('input[type=file]').setInputFiles({ name: 'code.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator('article pre')).toHaveText(expected);
  }
});

test('断网单文件：二维码中文 Emoji、四档纠错、上传和粘贴识别', async ({ page }) => {
  await page.getByRole('link', { name: '二维码工具' }).click();
  const value = '离线 HTML / 中文 😀\nhttps://example.com';
  for (const level of ['L', 'M', 'Q', 'H']) {
    await page.getByRole('tab', { name: '生成二维码' }).click();
    await page.getByLabel('文本或 URL').fill(value);
    await page.getByLabel('纠错等级').selectOption(level);
    await page.getByRole('button', { name: '生成二维码', exact: true }).click();
    await expect(page.getByRole('button', { name: '下载 PNG' })).toBeEnabled();
    const png = await download(page, '下载 PNG');
    expect((await download(page, '下载 SVG')).toString()).toContain('<svg');
    await page.getByRole('tab', { name: '识别图片' }).click();
    await page.locator('input[type=file]').setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator('article pre')).toHaveText(value);
  }
  const fixture = await readFile('tests/fixtures/qr-reference.png');
  await page.evaluate(base64 => {
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    const data = new DataTransfer(); data.items.add(new File([bytes], 'paste.png', { type: 'image/png' }));
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: data });
    window.dispatchEvent(event);
  }, fixture.toString('base64'));
  await expect(page.locator('article pre')).toHaveText('dev-toolbox reference / 中文 😀');
});

test('断网单文件：图片错误、大小限制与取消后重试', async ({ page }) => {
  await page.getByRole('link', { name: '二维码工具' }).click();
  await page.getByRole('tab', { name: '识别图片' }).click();
  const upload = page.locator('input[type=file]');
  await upload.setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) });
  await expect(page.getByRole('alert')).toContainText('图片损坏');
  await upload.setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await expect(page.getByRole('alert')).toContainText('10 MiB');
  const oversized = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 4001; canvas.height = 4000;
    const context = canvas.getContext('2d')!; context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await upload.setInputFiles({ name: 'pixels.png', mimeType: 'image/png', buffer: Buffer.from(oversized, 'base64') });
  await expect(page.getByRole('alert')).toContainText('1600 万像素');
  // 延迟位图准备，稳定覆盖取消发生在像素尚未发送给 Worker 的阶段。
  await page.evaluate(() => {
    const original = window.createImageBitmap.bind(window);
    Object.defineProperty(window, 'createImageBitmap', { value: async (source: Blob) => {
      const bitmap = await original(source);
      await new Promise(resolve => setTimeout(resolve, 300));
      return bitmap;
    } });
  });
  await upload.setInputFiles('tests/fixtures/qr-reference.png');
  await page.getByRole('button', { name: '取消识别', exact: true }).click();
  await expect(page.getByText('识别已取消', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重新识别', exact: true }).click();
  await expect(page.locator('article pre')).toHaveText('dev-toolbox reference / 中文 😀');
});
