import { describe, expect, it } from 'vitest';
import { calculateCheckDigit, normalizeBarcode } from './barcode';

describe('barcode validation', () => {
  it('accepts printable Code 128, including spaces, and rejects Unicode / control characters', () => {
    expect(normalizeBarcode(' 0123-Ab! ', 'CODE128')).toBe(' 0123-Ab! ');
    for (const input of ['', '你好', 'abc\n']) expect(() => normalizeBarcode(input, 'CODE128')).toThrow();
  });
  it('validates Code 39 without silently changing input', () => {
    expect(normalizeBarcode('ABC 09-.$/+%', 'CODE39')).toBe('ABC 09-.$/+%');
    for (const input of ['abc', '*ABC*', '中文', '']) expect(() => normalizeBarcode(input, 'CODE39')).toThrow();
  });
  it.each([
    ['EAN13', '400638133393', '4006381333931'],
    ['EAN8', '9638507', '96385074'],
    ['UPC', '03600029145', '036000291452'],
  ] as const)('%s fills check digit and validates complete input', (format, body, full) => {
    expect(normalizeBarcode(body, format)).toBe(full);
    expect(normalizeBarcode(full, format)).toBe(full);
    expect(() => normalizeBarcode(full.slice(0, -1) + '9', format)).toThrow('校验位');
    expect(() => normalizeBarcode(body.slice(1), format)).toThrow('请输入');
    expect(() => normalizeBarcode('x' + body.slice(1), format)).toThrow('只能包含数字');
  });
  it('preserves leading zeros and zero check digits', () => {
    expect(normalizeBarcode('000000000000', 'EAN13')).toBe('0000000000000');
    expect(normalizeBarcode('0000000', 'EAN8')).toBe('00000000');
    expect(normalizeBarcode('00000000000', 'UPC')).toBe('000000000000');
    expect(calculateCheckDigit('03600029145')).toBe('2');
  });
});
