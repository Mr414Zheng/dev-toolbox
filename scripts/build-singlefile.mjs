import { build } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
// 独立产物只存在于内存中，保留普通网站的 dist 与按需分包构建。
const result = await build({
  root,
  configFile: resolve(root, 'vite.config.ts'),
  // file:// 的不透明源无法可靠加载 module Worker，改用内联经典 Worker。
  worker: { format: 'iife' },
  build: {
    write: false,
    copyPublicDir: false,
    assetsInlineLimit: () => true,
    cssCodeSplit: false,
    modulePreload: false,
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
const bundles = Array.isArray(result) ? result : [result];
const output = bundles.flatMap(bundle => bundle.output);
const document = output.find(item => item.fileName === 'index.html');
if (!document || document.type !== 'asset') throw new Error('缺少 HTML 构建产物');
const asText = source => typeof source === 'string' ? source : Buffer.from(source).toString('utf8');
let html = asText(document.source);
const embedded = new Set(['index.html']);

html = html.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gi, (_tag, href) => {
  const name = href.replace(/^\.\//, '').replace(/^\//, '');
  const chunk = output.find(item => item.fileName === name);
  if (!chunk || chunk.type !== 'chunk' || chunk.imports.length || chunk.dynamicImports.some(name => name !== chunk.fileName)) {
    throw new Error(`脚本仍有外部依赖：${href}`);
  }
  embedded.add(name);
  // 防止脚本中的字符串被 HTML 解析器误当作结束标签。
  return `<script type="module">${chunk.code.replace(/<\/script/gi, '<\\/script')}</script>`;
});
html = html.replace(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/gi, (_tag, href) => {
  const name = href.replace(/^\.\//, '').replace(/^\//, '');
  const css = output.find(item => item.fileName === name);
  if (!css || css.type !== 'asset') throw new Error(`样式仍有外部依赖：${href}`);
  embedded.add(name);
  return `<style>${asText(css.source).replace(/<\/style/gi, '<\\/style')}</style>`;
});
const favicon = await readFile(resolve(root, 'public/favicon.svg'));
html = html.replace('href="./favicon.svg"', `href="data:image/svg+xml;base64,${favicon.toString('base64')}"`);
const remaining = output.filter(item => !embedded.has(item.fileName));
if (remaining.length) throw new Error(`单文件构建仍含独立资源：${remaining.map(item => item.fileName).join(', ')}`);
if (/<(?:script|link)\b[^>]*(?:src|href)="(?!data:)[^"]+"/i.test(html)) {
  throw new Error('HTML 中仍有外部脚本或样式链接');
}
const target = resolve(root, 'dev-toolbox.html');
await writeFile(target, html);
console.log(`已生成 ${target}（${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB），可直接双击打开。`);
