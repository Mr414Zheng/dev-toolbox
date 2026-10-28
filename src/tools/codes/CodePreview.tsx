import { useEffect, useState } from 'react';
import { ScanLine } from 'lucide-react';
import { CopyButton } from '../../shared/CopyButton';
import { downloadBlob } from '../../shared/browser';
import type { CodeArtwork } from './artwork';
import styles from './codes.module.css';

export function CodePreview({ artwork, stale, busy, filename }: { artwork: CodeArtwork | null; stale: boolean; busy: boolean; filename: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!artwork) { setUrl(''); return; }
    const objectUrl = URL.createObjectURL(new Blob([artwork.svg], { type: 'image/svg+xml' }));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [artwork]);
  return <section className="tool-panel" aria-label="生成预览">
    <div className="panel-heading"><h2>预览</h2>{artwork && <span className="muted">{artwork.width} × {artwork.height} px</span>}</div>
    <div className="panel-body">
      <div className={`${styles.preview} ${stale ? styles.stale : ''}`} aria-busy={busy}>
        {url ? <img src={url} alt={`生成的条码，内容：${artwork?.value}`} /> : <div className="empty-state"><ScanLine className={styles.emptyIcon} size={40} aria-hidden="true" /><p>{busy ? '正在生成…' : '生成后在这里预览'}</p><span className="muted">SVG 矢量图 · PNG 图片</span></div>}
      </div>
      {stale && <p className="stale-message" role="status">输入或参数已更改，请重新生成后复制或下载。</p>}
      {artwork && <><p className={styles.resultValue}>{artwork.value}</p><div className="result-actions">
        <button className="button button-primary" disabled={stale || busy} onClick={() => downloadBlob(artwork.png, `${filename}.png`)}>下载 PNG</button>
        <button className="button" disabled={stale || busy} onClick={() => downloadBlob(new Blob([artwork.svg], { type: 'image/svg+xml' }), `${filename}.svg`)}>下载 SVG</button>
        <CopyButton text={artwork.value} disabled={stale || busy} />
      </div></>}
    </div>
  </section>;
}
