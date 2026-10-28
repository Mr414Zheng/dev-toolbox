import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import QRCode from 'qrcode';

async function exportedImages(page: Page) {
  const pngEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 PNG' }).click();
  const pngPath = await (await pngEvent).path();
  if (!pngPath) throw new Error('PNG download has no local file');
  const png = await readFile(pngPath);
  const svgEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 SVG' }).click();
  const svgPath = await (await svgEvent).path();
  if (!svgPath) throw new Error('SVG download has no local file');
  const svg = await readFile(svgPath);
  const rasterized = await page.evaluate(async ({ pngBase64, svgBase64 }) => {
    async function rasterize(source: string) {
      const image = new Image(); image.src = source; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
      return { width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data, png: canvas.toDataURL('image/png').split(',')[1] };
    }
    const pngImage = await rasterize(`data:image/png;base64,${pngBase64}`);
    const svgImage = await rasterize(`data:image/svg+xml;base64,${svgBase64}`);
    return { width: svgImage.width, height: svgImage.height, samePixels: pngImage.width === svgImage.width && pngImage.height === svgImage.height && pngImage.data.every((byte, index) => byte === svgImage.data[index]), svgPng: svgImage.png };
  }, { pngBase64: png.toString('base64'), svgBase64: svg.toString('base64') });
  expect(rasterized.samePixels).toBe(true);
  expect(rasterized.width).toBeGreaterThan(0);
  return { png, svg: svg.toString('utf8'), svgPng: Buffer.from(rasterized.svgPng, 'base64') };
}

async function upload(page: Page, png: Buffer, name = 'generated.png') {
  await page.getByRole('tab', { name: '识别图片' }).click();
  await page.locator('input[type=file]').setInputFiles({ name, mimeType: 'image/png', buffer: png });
}

test('all five barcodes export matching SVG / PNG, roundtrip, and invalidate changed output', async ({ page }) => {
  const remoteRequests: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1') remoteRequests.push(request.url()); });
  await page.goto('/#/tools/barcode');
  for (const item of [
    { format: 'CODE128', input: '001234-Ab', result: '001234-Ab' },
    { format: 'CODE39', input: 'ABC+A', result: 'ABC+A' },
    { format: 'EAN13', input: '400638133393', result: '4006381333931' },
    { format: 'EAN8', input: '9638507', result: '96385074' },
    { format: 'UPC', input: '03600029145', result: '0036000291452' },
  ]) {
    await page.getByRole('tab', { name: '生成条码' }).click();
    await page.getByLabel('编码制式').selectOption(item.format);
    await page.getByLabel('条码内容', { exact: true }).fill(item.input);
    await page.getByRole('button', { name: '生成条形码', exact: true }).click();
    await expect(page.getByRole('button', { name: '下载 PNG' })).toBeEnabled();
    const images = await exportedImages(page);
    expect(images.svg).toContain('<svg');
    await page.getByLabel('条码内容', { exact: true }).fill(item.input + '0');
    await expect(page.getByRole('button', { name: '下载 PNG' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '下载 SVG' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '复制', exact: true })).toBeDisabled();
    await upload(page, images.png);
    await expect(page.locator('article pre')).toHaveText(item.result);
    await page.locator('input[type=file]').setInputFiles({ name: 'svg-rasterized.png', mimeType: 'image/png', buffer: images.svgPng });
    await expect(page.locator('article pre')).toHaveText(item.result);
  }
  expect(remoteRequests).toEqual([]);
});

test('QR text, Chinese and Emoji survive all correction levels and SVG / PNG exports', async ({ page }) => {
  await page.goto('/#/tools/qrcode');
  const value = '本地二维码 ✅ https://example.com/中文?q=😀';
  for (const correction of ['L', 'M', 'Q', 'H']) {
    await page.getByRole('tab', { name: '生成二维码' }).click();
    await page.getByLabel('文本或 URL').fill(value);
    await page.getByLabel('纠错等级').selectOption(correction);
    await page.getByLabel('目标尺寸').selectOption('320');
    await page.getByRole('button', { name: '生成二维码', exact: true }).click();
    await expect(page.getByRole('button', { name: '下载 PNG' })).toBeEnabled();
    const images = await exportedImages(page);
    expect(images.svg).toContain('shape-rendering="crispEdges"');
    await upload(page, images.png);
    await expect(page.locator('article pre')).toHaveText(value);
    await page.locator('input[type=file]').setInputFiles({ name: 'svg-rasterized.png', mimeType: 'image/png', buffer: images.svgPng });
    await expect(page.locator('article pre')).toHaveText(value);
  }
});

test('decoder separates corrupt, empty, oversized, unsupported and cancelled inputs', async ({ page }) => {
  await page.goto('/#/tools/qrcode');
  const fixtures = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const blank = (width: number, height: number) => {
      canvas.width = width; canvas.height = height; const context = canvas.getContext('2d')!;
      context.fillStyle = 'white'; context.fillRect(0, 0, width, height);
      return canvas.toDataURL('image/png').split(',')[1];
    };
    return { blank: blank(100, 100), oversized: blank(4001, 4000) };
  });
  await page.route('**/*.wasm', route => route.abort());
  await upload(page, Buffer.from(fixtures.blank, 'base64'));
  await expect(page.getByRole('alert')).toContainText('引擎资源加载');
  await page.unroute('**/*.wasm');
  await page.route('**/*.wasm', async route => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await route.continue().catch(() => {});
  });
  await page.locator('input[type=file]').setInputFiles({ name: 'blank.png', mimeType: 'image/png', buffer: Buffer.from(fixtures.blank, 'base64') });
  await page.getByRole('button', { name: '取消识别', exact: true }).click();
  await expect(page.getByText('识别已取消', { exact: true })).toBeVisible();
  await page.unroute('**/*.wasm');
  await upload(page, Buffer.from(fixtures.blank, 'base64'));
  await expect(page.getByText('未找到可识别的编码', { exact: true })).toBeVisible();
  await upload(page, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  await expect(page.getByRole('alert')).toContainText('图片损坏');
  await upload(page, Buffer.from(fixtures.oversized, 'base64'));
  await expect(page.getByRole('alert')).toContainText('1600 万像素');
  await page.locator('input[type=file]').setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await expect(page.getByRole('alert')).toContainText('10 MiB');
  await page.locator('input[type=file]').setInputFiles({ name: 'image.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByRole('alert')).toContainText('仅支持 PNG');
});

test('decoder supports paste and drop, caps ten results, and limits the selected tool format', async ({ page }) => {
  const fixture = await QRCode.toBuffer('PASTED-QR-中文😀', { margin: 4, scale: 4 });
  await page.goto('/#/tools/qrcode');
  await page.getByRole('tab', { name: '识别图片' }).click();
  await page.evaluate(base64 => {
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    const data = new DataTransfer(); data.items.add(new File([bytes], 'pasted.png', { type: 'image/png' }));
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: data });
    window.dispatchEvent(event);
  }, fixture.toString('base64'));
  await expect(page.locator('article pre')).toHaveText('PASTED-QR-中文😀');
  await page.context().setOffline(true);
  await page.locator('input[type=file]').setInputFiles({ name: 'offline.png', mimeType: 'image/png', buffer: fixture });
  await expect(page.locator('article pre')).toHaveText('PASTED-QR-中文😀');
  await page.context().setOffline(false);

  const symbols = await Promise.all(Array.from({ length: 11 }, (_, index) => QRCode.toBuffer(`MULTI-${index}`, { margin: 4, scale: 4 }).then(buffer => buffer.toString('base64'))));
  const multiple = await page.evaluate(async images => {
    const canvas = document.createElement('canvas'); canvas.width = 4 * 132; canvas.height = 3 * 132;
    const context = canvas.getContext('2d')!; context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
    for (const [index, base64] of images.entries()) {
      const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
      context.drawImage(image, (index % 4) * 132 + 8, Math.floor(index / 4) * 132 + 8);
    }
    return canvas.toDataURL('image/png').split(',')[1];
  }, symbols);
  await page.evaluate(base64 => {
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    const data = new DataTransfer(); data.items.add(new File([bytes], 'multiple.png', { type: 'image/png' }));
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: data });
    document.querySelector('input[type=file]')!.closest('label')!.parentElement!.dispatchEvent(event);
  }, multiple);
  await expect(page.locator('article pre')).toHaveCount(10);
  await expect(page.getByText('已达到 10 个结果上限，可裁剪图片后继续识别。')).toBeVisible();

  await page.goto('/#/tools/barcode');
  await upload(page, fixture);
  await expect(page.getByText('未找到可识别的编码', { exact: true })).toBeVisible();
});

test('sample, clear, parameter invalidation and session tabs work in both generators', async ({ page }) => {
  await page.goto('/#/tools/barcode');
  for (const format of ['CODE128', 'CODE39', 'EAN13', 'EAN8', 'UPC']) {
    await page.getByLabel('编码制式').selectOption(format);
    await page.getByRole('button', { name: '填入示例' }).click();
    await page.getByRole('button', { name: '生成条形码', exact: true }).click();
    await expect(page.getByRole('button', { name: '下载 PNG' })).toBeEnabled();
  }
  await page.getByLabel('条宽（px）').selectOption('3');
  await expect(page.getByRole('button', { name: '下载 PNG' })).toBeDisabled();
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await expect(page.getByLabel('条码内容', { exact: true })).toBeEmpty();
  await expect(page.getByRole('button', { name: '下载 PNG' })).toHaveCount(0);
  await page.getByRole('tab', { name: '识别图片' }).click();
  await page.goto('/#/tools/qrcode');
  await page.getByRole('button', { name: '填入示例' }).click();
  await page.getByRole('button', { name: '生成二维码', exact: true }).click();
  await expect(page.getByRole('button', { name: '下载 PNG' })).toBeEnabled();
  await page.getByLabel('目标尺寸').selectOption('480');
  await expect(page.getByRole('button', { name: '下载 PNG' })).toBeDisabled();
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await expect(page.getByLabel('文本或 URL')).toBeEmpty();
  await expect(page.getByRole('button', { name: '下载 PNG' })).toHaveCount(0);
  await page.goto('/#/tools/barcode');
  await expect(page.getByRole('tab', { name: '识别图片' })).toHaveAttribute('aria-selected', 'true');
});
