import { isSupportedImageHeader, MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS } from './decode.types';

export class LocalImageError extends Error {}

/** WebKit 的 file:// Worker 无法读取 Blob；在主线程取像素，识别仍交给 Worker。 */
export async function readLocalImagePixels(file: File): Promise<ImageData> {
  if (file.size > MAX_IMAGE_BYTES) throw new LocalImageError('图片不能超过 10 MiB。');
  let image: ImageBitmap;
  try {
    if (!isSupportedImageHeader(new Uint8Array(await file.slice(0, 12).arrayBuffer()))) {
      throw new LocalImageError('仅支持 PNG、JPEG 和 WebP 图片。');
    }
    image = await createImageBitmap(file);
  } catch (cause) {
    if (cause instanceof LocalImageError) throw cause;
    throw new LocalImageError('图片损坏或无法读取，请重新导出图片后重试。');
  }
  const canvas = document.createElement('canvas');
  try {
    if (image.width * image.height > MAX_IMAGE_PIXELS) {
      throw new LocalImageError('图片超过 1600 万像素，请缩小后重试。');
    }
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new LocalImageError('浏览器无法读取图片像素，请使用最新版浏览器。');
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } finally {
    image.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
