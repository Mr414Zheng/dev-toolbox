import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const referenceText = 'dev-toolbox reference / 中文 😀';

test('独立生成器固定样例：五码制与二维码可解码', async ({ page }) => {
  await page.goto('/#/tools/barcode');
  await page.getByRole('tab', { name: '识别图片' }).click();
  for (const [name, value] of [
    ['code128-reference', 'REF-00128'], ['code39-reference', 'REF+39'],
    ['ean13-reference', '5901234123457'], ['ean8-reference', '96385074'],
    ['upca-reference', '0036000291452'],
  ]) {
    await page.locator('input[type=file]').setInputFiles(`tests/fixtures/${name}.png`);
    await expect(page.locator('article pre')).toHaveText(value);
  }
  await page.getByRole('link', { name: '二维码工具' }).click();
  await page.getByRole('tab', { name: '识别图片' }).click();
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/qr-reference.png');
  await expect(page.locator('article pre')).toHaveText(referenceText);
});

test('拖入、粘贴、旋转、多码、JPEG/WebP 与 URL 释放', async ({ page }) => {
  await page.addInitScript(() => {
    const created = new Set<string>();
    const originalCreate = URL.createObjectURL.bind(URL);
    const originalRevoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => { const url = originalCreate(blob); if (blob instanceof Blob && blob.type.startsWith('image/')) created.add(url); return url; };
    URL.revokeObjectURL = url => { created.delete(url); originalRevoke(url); };
    Object.defineProperty(window, '__activeUrls', { get: () => [...created] });
  });
  await page.goto('/#/tools/qrcode');
  await page.getByRole('tab', { name: '识别图片' }).click();
  const bytes = [...await readFile('tests/fixtures/qr-reference.png')];
  await page.evaluate(bytes => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(bytes)], 'paste.png', { type: 'image/png' }));
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: transfer });
    window.dispatchEvent(event);
  }, bytes);
  await expect(page.locator('article pre')).toHaveText(referenceText);
  await page.getByRole('button', { name: '移除', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __activeUrls: string[] }).__activeUrls.length)).toBe(0);
  await page.locator('div').filter({ has: page.getByText('拖放图片到这里，或直接粘贴', { exact: true }) }).last().evaluate((element, bytes) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(bytes)], 'drop.png', { type: 'image/png' }));
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: transfer });
    element.dispatchEvent(event);
  }, bytes);
  await expect(page.locator('article pre')).toHaveText(referenceText);
  const rendered = await page.evaluate(async bytes => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
    const source = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = source.height + 40; canvas.height = source.width + 40;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width - 20, 20); context.rotate(Math.PI / 2); context.drawImage(source, 0, 0);
    const rotated = canvas.toDataURL('image/png').split(',')[1];
    const jpg = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
    const webpUrl = canvas.toDataURL('image/webp', 0.95);
    canvas.width = source.width * 2 + 100; canvas.height = source.height + 40;
    const multiContext = canvas.getContext('2d')!;
    multiContext.fillStyle = 'white'; multiContext.fillRect(0, 0, canvas.width, canvas.height);
    multiContext.drawImage(source, 20, 20); multiContext.drawImage(source, source.width + 80, 20);
    source.close();
    return { rotated, jpg, webpUrl, multiple: canvas.toDataURL('image/png').split(',')[1] };
  }, bytes);
  for (const [name, mimeType, encoded] of [
    ['rotated.png', 'image/png', rendered.rotated], ['photo.jpg', 'image/jpeg', rendered.jpg],
    ...(rendered.webpUrl.startsWith('data:image/webp') ? [['image.webp', 'image/webp', rendered.webpUrl.split(',')[1]]] : []),
  ]) {
    await page.locator('input[type=file]').setInputFiles({ name, mimeType, buffer: Buffer.from(encoded, 'base64') });
    await expect(page.locator('article pre')).toHaveText(referenceText);
  }
  await page.locator('input[type=file]').setInputFiles({ name: 'two.png', mimeType: 'image/png', buffer: Buffer.from(rendered.multiple, 'base64') });
  await expect(page.locator('article pre')).toHaveCount(2);
  await page.getByRole('link', { name: 'JSON 格式化' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __activeUrls: string[] }).__activeUrls.length)).toBe(0);
});

test('子路径部署刷新、Worker、WASM 和图片解码', async ({ page }) => {
  const bad: string[] = [];
  page.on('response', response => { if (response.status() >= 400) bad.push(response.url()); });
  await page.goto('http://127.0.0.1:4174/toolbox/#/tools/json');
  await page.getByRole('button', { name: '试用示例' }).click();
  await page.getByRole('button', { name: '格式化', exact: true }).click();
  await expect(page.getByLabel('JSON 处理结果', { exact: true })).toContainText('dev-toolbox');
  await page.getByRole('link', { name: '二维码工具' }).click();
  await page.reload();
  await page.getByRole('tab', { name: '识别图片' }).click();
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/qr-reference.png');
  await expect(page.locator('article pre')).toHaveText(referenceText);
  expect(bad).toEqual([]);
});
