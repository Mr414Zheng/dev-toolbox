export type DecodeKind = 'barcode' | 'qrcode';
export interface DecodeResult { text: string; format: string }
export type DecodeRequest = { requestId: number; kind: DecodeKind; wasmBinary: ArrayBuffer } & (
  { file: File; imageData?: never } | { file?: never; imageData: ImageData }
);
export type DecodeResponse = { requestId: number; results: DecodeResult[] } | { requestId: number; error: 'corrupt' | 'dimensions' | 'format' | 'engine'; message: string };

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 16_000_000;

/** 通过文件头限制解码输入，避免把重命名的 SVG / GIF 当作支持的图片。 */
export function isSupportedImageHeader(bytes: Uint8Array): boolean {
  return (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a)
    || (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    || (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP');
}
