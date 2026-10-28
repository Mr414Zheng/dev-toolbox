import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useDraft } from '../../shared/useDraft';
import { rasterizeSvg, type CodeArtwork } from './artwork';
import { CodePreview } from './CodePreview';
import { ImageDecoder } from './ImageDecoder';
import styles from './codes.module.css';

type Correction = 'L' | 'M' | 'Q' | 'H';

export default function QrTool() {
  const [tab, setTab] = useDraft<'generate' | 'decode'>('qrcode-tab', 'generate');
  const [draft, setDraft] = useDraft('qrcode', { value: 'https://example.com', size: 320, correction: 'M' as Correction });
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
      if (!draft.value) throw new Error('请输入二维码内容。');
      if (draft.value.length > 7089) throw new Error('内容超出二维码容量，请缩短内容后重试。');
      const qr = QRCode.create(draft.value, { errorCorrectionLevel: draft.correction });
      const modules = qr.modules.size;
      const scale = Math.max(1, Math.ceil(draft.size / (modules + 8)));
      const pixels = (modules + 8) * scale;
      const paths: string[] = [];
      for (let row = 0; row < modules; row++) for (let col = 0; col < modules; col++) {
        if (qr.modules.get(row, col)) paths.push(`M${(col + 4) * scale} ${(row + 4) * scale}h${scale}v${scale}h-${scale}z`);
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" viewBox="0 0 ${pixels} ${pixels}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${paths.join('')}" fill="#000"/></svg>`;
      const png = await rasterizeSvg(svg, pixels, pixels);
      if (request !== revision.current || inputKey !== currentKey.current) return;
      setArtwork({ svg, png, value: draft.value, width: pixels, height: pixels }); setGeneratedKey(inputKey);
    } catch (cause) {
      if (request === revision.current && inputKey === currentKey.current) setError(cause instanceof Error && /amount of data|too big|too long/i.test(cause.message) ? '内容超出当前纠错等级的容量，请缩短内容或降低纠错等级。' : cause instanceof Error ? cause.message : '二维码生成失败。');
    } finally { if (request === revision.current) setBusy(false); }
  };

  return <div>
    <div className={styles.tabs} role="tablist" aria-label="二维码操作">
      <button className={`${styles.tab} ${tab === 'generate' ? styles.tabActive : ''}`} role="tab" aria-selected={tab === 'generate'} onClick={() => setTab('generate')}>生成二维码</button>
      <button className={`${styles.tab} ${tab === 'decode' ? styles.tabActive : ''}`} role="tab" aria-selected={tab === 'decode'} onClick={() => setTab('decode')}>识别图片</button>
    </div>
    {tab === 'decode' ? <ImageDecoder kind="qrcode" /> : <div className="tool-grid">
      <section className="tool-panel"><div className="panel-heading"><h2>二维码内容</h2><span className="muted">文本 / 链接</span></div><form className="panel-body" onSubmit={event => { event.preventDefault(); void generate(); }}>
        <label className="field"><span className="field-label">文本或 URL</span><textarea className="textarea" aria-label="文本或 URL" aria-describedby="qr-content-help" rows={6} value={draft.value} spellCheck={false} onChange={event => setDraft({ ...draft, value: event.target.value })} placeholder="输入文本、网址、中文或 Emoji…" /><span className={styles.help} id="qr-content-help">支持中文和 Emoji。链接会按原文编码，不会自动打开。</span></label>
        <div className={styles.fieldsRow}>
          <label className="field"><span className="field-label">目标尺寸</span><select className="select" value={draft.size} onChange={event => setDraft({ ...draft, size: Number(event.target.value) })}>{[160, 240, 320, 480, 640].map(size => <option key={size} value={size}>{size} px</option>)}</select></label>
          <label className="field"><span className="field-label">纠错等级</span><select className="select" value={draft.correction} onChange={event => setDraft({ ...draft, correction: event.target.value as Correction })}><option value="L">L · 约 7%</option><option value="M">M · 约 15%（默认）</option><option value="Q">Q · 约 25%</option><option value="H">H · 约 30%</option></select></label>
        </div>
        <p className={styles.help}>黑白配色，四模块静区。实际尺寸向上对齐完整模块，保持边缘清晰。</p>
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="toolbar"><button className="button button-primary" type="submit" disabled={busy}>{busy ? '正在生成…' : '生成二维码'}</button><button className="button" type="button" onClick={() => { setError(''); setDraft({ ...draft, value: 'https://example.com/你好?message=Hello%20World' }); }}>填入示例</button><button className="button button-quiet" type="button" onClick={clear}>清空</button></div>
        <p className={styles.footer}>在浏览器本地生成，内容不会上传。</p>
      </form></section>
      <CodePreview artwork={artwork} stale={!!artwork && generatedKey !== inputKey} busy={busy} filename="qrcode" />
    </div>}
  </div>;
}
