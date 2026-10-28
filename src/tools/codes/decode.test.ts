import { describe, expect, it } from 'vitest';
import { isSupportedImageHeader } from './decode.types';

describe('supported image signatures', () => {
  it('accepts PNG, JPEG and WebP', () => {
    expect(isSupportedImageHeader(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
    expect(isSupportedImageHeader(new Uint8Array([255, 216, 255, 224]))).toBe(true);
    expect(isSupportedImageHeader(new TextEncoder().encode('RIFF1234WEBP'))).toBe(true);
  });
  it('rejects SVG, GIF and truncated headers', () => {
    for (const value of ['<svg/>', 'GIF89a', '', 'RIFF1234WAVE']) expect(isSupportedImageHeader(new TextEncoder().encode(value))).toBe(false);
  });
});
