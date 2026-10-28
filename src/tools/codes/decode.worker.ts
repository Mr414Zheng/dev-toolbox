import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import { isSupportedImageHeader, MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS, type DecodeRequest, type DecodeResponse } from './decode.types';

self.onmessage = async (event: MessageEvent<DecodeRequest>) => {
  const { requestId, file, kind, wasmBinary } = event.data;
  let pixels = event.data.imageData;
  const respond = (response: DecodeResponse) => self.postMessage(response);
  let image: ImageBitmap | undefined;
  if (!pixels) {
    if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') {
      respond({ requestId, error: 'engine', message: '当前浏览器不支持 Worker 图片处理，请使用最新版 Chrome、Edge、Firefox 或 Safari。' }); return;
    }
    try {
      if (!file) throw new Error('Missing image');
      if (file.size > MAX_IMAGE_BYTES) { respond({ requestId, error: 'format', message: '图片不能超过 10 MiB。' }); return; }
      if (!isSupportedImageHeader(new Uint8Array(await file.slice(0, 12).arrayBuffer()))) { respond({ requestId, error: 'format', message: '仅支持 PNG、JPEG 和 WebP 图片。' }); return; }
      image = await createImageBitmap(file);
    } catch {
      respond({ requestId, error: 'corrupt', message: '图片损坏或无法读取，请重新导出图片后重试。' }); return;
    }
  }
  const width = pixels?.width ?? image!.width;
  const height = pixels?.height ?? image!.height;
  if (width * height > MAX_IMAGE_PIXELS) {
    image?.close(); respond({ requestId, error: 'dimensions', message: '图片超过 1600 万像素，请缩小后重试。' }); return;
  }
  try {
    // 二进制由主线程会话缓存传入；新建 Worker 和离线重试都不会请求默认 CDN。
    prepareZXingModule({ overrides: { wasmBinary: new Uint8Array(wasmBinary) } });
    if (!pixels) {
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(image!, 0, 0);
      pixels = context.getImageData(0, 0, width, height);
    }
    const results = await readBarcodes(pixels, {
      // 标准 Code 39 的 +A 等字面内容不能被扩展模式自动转换为小写字母。
      formats: kind === 'qrcode' ? ['QRCode'] : ['Code128', 'Code39Std', 'EAN13', 'EAN8', 'UPCA'],
      tryHarder: true,
      maxNumberOfSymbols: 10,
      textMode: 'Plain',
    });
    respond({ requestId, results: results.slice(0, 10).map(result => ({ text: result.text, format: result.format })) });
  } catch {
    respond({ requestId, error: 'engine', message: '本地识别引擎启动或运行失败，请重新识别；若持续失败，请刷新页面。' });
  } finally {
    image?.close();
  }
};
