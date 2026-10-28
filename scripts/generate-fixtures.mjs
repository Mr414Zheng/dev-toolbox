// 固定测试输入由独立于应用生成器的 ZXing-C++ writer 产生，避免只测试同源往返。
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { prepareZXingModule, writeBarcode } from 'zxing-wasm/writer';
prepareZXingModule({ overrides: { wasmBinary: await readFile(new URL('../node_modules/zxing-wasm/dist/writer/zxing_writer.wasm', import.meta.url)) } });
const fixtures = [
  ['qr-reference', 'QRCode', 'dev-toolbox reference / 中文 😀'],
  ['code128-reference', 'Code128', 'REF-00128'],
  ['code39-reference', 'Code39', 'REF+39'],
  ['ean13-reference', 'EAN13', '5901234123457'],
  ['ean8-reference', 'EAN8', '96385074'],
  ['upca-reference', 'UPCA', '036000291452'],
];
await mkdir('tests/fixtures', { recursive: true });
for (const [name, format, value] of fixtures) {
  const result = await writeBarcode(value, { format, scale: 3, addQuietZones: true });
  if (result.error || !result.image) throw new Error(result.error || 'Fixture generation failed');
  await writeFile(`tests/fixtures/${name}.png`, Buffer.from(await result.image.arrayBuffer()));
}
