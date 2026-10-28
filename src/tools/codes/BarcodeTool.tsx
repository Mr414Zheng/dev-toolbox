import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { useDraft } from '../../shared/useDraft';
import { barcodeFormats, barcodeLabels, normalizeBarcode, type BarcodeFormat } from './barcode';
import { rasterizeSvg, type CodeArtwork } from './artwork';
import { CodePreview } from './CodePreview';
import { ImageDecoder } from './ImageDecoder';
import styles from './codes.module.css';

export default function BarcodeTool() {
  const [tab, setTab] = useDraft<'generate' | 'decode'>('barcode-tab', 'generate');
  const [draft, setDraft] = useDraft('barcode', { value: '1234567890', format: 'CODE128' as BarcodeFormat, width: 2, height: 100, displayValue: true });
  const [artwork, setArtwork] = useState<CodeArtwork | null>(null);
  const [generatedKey, setGeneratedKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const inputKey = JSON.stringify(draft);
  const currentKey = useRef(inputKey);
  currentKey.current = inputKey;
  useEffect(() => () => { revision.current++; }, []);

  const clear = () => {
    revision.current++; setBusy(false); setError(''); setArtwork(null); setGeneratedKey('');
    setDraft({ ...draft, value: '' });
  };

  const generate = async () => {
    const request = ++revision.current;
    setBusy(true); setError('');
    try {
      const value = normalizeBarcode(draft.value, draft.format);
      if (value.length > 4096) throw new Error('条码过长，请将内容缩短到 4096 个字符以内。');
      if (!Number.isInteger(draft.width) || draft.width < 1 || draft.width > 4) throw new Error('条宽须为 1–4 px 的整数。');
      if (!Number.isInteger(draft.height) || draft.height < 30 || draft.height > 240) throw new Error('条高须为 30–240 px 的整数。');
      const element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(element, value, { format: draft.format, width: draft.width, height: draft.height, displayValue: draft.displayValue, margin: 12 * draft.width, background: '#ffffff', lineColor: '#000000', fontSize: 18, textMargin: 8 });
      const width = Number(element.getAttribute('width')?.replace('px', ''));
      const height = Number(element.getAttribute('height')?.replace('px', ''));
      if (width > 16384 || width * height > 16_000_000) throw new Error('条码过长，请缩短内容或减小条宽。');
      const svg = new XMLSerializer().serializeToString(element);
      const png = await rasterizeSvg(svg, width, height);
      if (request !== revision.current || inputKey !== currentKey.current) return;
      setArtwork({ svg, png, value, width, height }); setGeneratedKey(inputKey);
    } catch (cause) {
      if (request === revision.current && inputKey === currentKey.current) setError(cause instanceof Error ? cause.message : '生成失败，请检查条码内容。');
    } finally { if (request === revision.current) setBusy(false); }
  };

  return <div>
    <div className={styles.tabs} role="tablist" aria-label="条形码操作">
      <button className={`${styles.tab} ${tab === 'generate' ? styles.tabActive : ''}`} role="tab" aria-selected={tab === 'generate'} onClick={() => setTab('generate')}>生成条码</button>
      <button className={`${styles.tab} ${tab === 'decode' ? styles.tabActive : ''}`} role="tab" aria-selected={tab === 'decode'} onClick={() => setTab('decode')}>识别图片</button>
    </div>
    {tab === 'decode' ? <ImageDecoder kind="barcode" /> : <div className="tool-grid">
      <section className="tool-panel"><div className="panel-heading"><h2>条码内容</h2><span className="muted">5 种常用制式</span></div><form className="panel-body" onSubmit={event => { event.preventDefault(); void generate(); }}>
        <label className="field"><span className="field-label">编码制式</span><select className="select" value={draft.format} onChange={event => setDraft({ ...draft, format: event.target.value as BarcodeFormat })}>{barcodeFormats.map(format => <option key={format} value={format}>{barcodeLabels[format]}</option>)}</select></label>
        <label className="field"><span className="field-label">条码内容</span><input className="input" aria-label="条码内容" aria-describedby="barcode-content-help" value={draft.value} spellCheck={false} onChange={event => setDraft({ ...draft, value: event.target.value })} placeholder="输入条码内容" />
          <span className={styles.help} id="barcode-content-help">{draft.format === 'CODE128' ? '支持英文、数字及 ASCII 符号；保留空格和前导零。' : draft.format === 'CODE39' ? '大写 A–Z、数字、空格与 - . $ / + %。' : '输入主体时自动补校验位；输入完整编码时验证校验位。'}</span>
        </label>
        <div className={styles.fieldsRow}>
          <label className="field"><span className="field-label">条宽（px）</span><select className="select" value={draft.width} onChange={event => setDraft({ ...draft, width: Number(event.target.value) })}>{[1, 2, 3, 4].map(value => <option key={value} value={value}>{value} px</option>)}</select></label>
          <label className="field"><span className="field-label">条高（px）</span><input className="input" type="number" min={30} max={240} step={1} value={draft.height} onChange={event => setDraft({ ...draft, height: Number(event.target.value) })} /></label>
        </div>
        <label className={styles.checkbox}><input type="checkbox" checked={draft.displayValue} onChange={event => setDraft({ ...draft, displayValue: event.target.checked })} />显示条码文字</label>
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="toolbar"><button className="button button-primary" type="submit" disabled={busy}>{busy ? '正在生成…' : '生成条形码'}</button><button className="button" type="button" onClick={() => { setError(''); setDraft({ ...draft, value: { CODE128: '1234567890', CODE39: 'DEV-TOOLBOX-2026', EAN13: '400638133393', EAN8: '9638507', UPC: '03600029145' }[draft.format] }); }}>填入示例</button><button className="button button-quiet" type="button" onClick={clear}>清空</button></div>
        <p className={styles.footer}>在浏览器本地生成，内容不会上传。</p>
      </form></section>
      <CodePreview artwork={artwork} stale={!!artwork && generatedKey !== inputKey} busy={busy} filename={`barcode-${draft.format.toLowerCase()}`} />
    </div>}
  </div>;
}
