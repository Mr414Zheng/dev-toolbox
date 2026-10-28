export const barcodeFormats = ['CODE128', 'CODE39', 'EAN13', 'EAN8', 'UPC'] as const;
export type BarcodeFormat = (typeof barcodeFormats)[number];

export const barcodeLabels: Record<BarcodeFormat, string> = {
  CODE128: 'Code 128', CODE39: 'Code 39', EAN13: 'EAN-13', EAN8: 'EAN-8', UPC: 'UPC-A',
};

/** 按 EAN / UPC 从右向左的 3、1 权重计算校验位，始终保留原字符串的前导零。 */
export function calculateCheckDigit(body: string): string {
  if (!/^\d+$/.test(body)) throw new Error('主体只能包含数字。');
  let sum = 0;
  for (let i = body.length - 1, position = 0; i >= 0; i--, position++) {
    sum += Number(body[i]) * (position % 2 === 0 ? 3 : 1);
  }
  return String((10 - (sum % 10)) % 10);
}

/** 验证条码输入；EAN / UPC 的主体输入会补齐校验位，完整输入必须通过校验。 */
export function normalizeBarcode(value: string, format: BarcodeFormat): string {
  if (!value) throw new Error('请输入条码内容。');
  if (format === 'CODE128') {
    if (!/^[\x20-\x7E]+$/.test(value)) throw new Error('Code 128 仅支持可打印 ASCII 字符（英文、数字、空格和符号）。');
    return value;
  }
  if (format === 'CODE39') {
    if (!/^[0-9A-Z .\-$/+%]+$/.test(value)) throw new Error('Code 39 支持大写字母、数字、空格和 - . $ / + %。');
    return value;
  }
  const length = format === 'EAN13' ? 13 : format === 'EAN8' ? 8 : 12;
  if (!/^\d+$/.test(value)) throw new Error(`${barcodeLabels[format]} 只能包含数字。`);
  if (value.length === length - 1) return value + calculateCheckDigit(value);
  if (value.length !== length) throw new Error(`请输入 ${length - 1} 位主体，或包含校验位的完整 ${length} 位数字。`);
  if (calculateCheckDigit(value.slice(0, -1)) !== value.at(-1)) throw new Error('校验位不正确，请检查最后一位或输入不含校验位的主体。');
  return value;
}
