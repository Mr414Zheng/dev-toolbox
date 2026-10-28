import { useCallback, useEffect, useRef, useState } from 'react';
import { ScanLine, Upload } from 'lucide-react';
import DecodeWorker from './decode.worker?worker&inline';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { LocalImageError, readLocalImagePixels } from './localImage';
import { CopyButton } from '../../shared/CopyButton';
import { MAX_IMAGE_BYTES, type DecodeKind, type DecodeResponse, type DecodeResult } from './decode.types';
import styles from './codes.module.css';

type Status = 'empty' | 'loading' | 'success' | 'no-result' | 'cancelled' | 'error';

let wasmPromise: Promise<ArrayBuffer> | undefined;
function loadWasm(): Promise<ArrayBuffer> {
  // 只缓存公开引擎资源，不缓存图片；失败时允许下次重试，取消不影响共享加载。
  if (!wasmPromise) wasmPromise = fetch(wasmUrl).then(response => {
    if (!response.ok) throw new Error('WASM resource unavailable');
    return response.arrayBuffer();
  }).catch(cause => { wasmPromise = undefined; throw cause; });
  return wasmPromise;
}

export function ImageDecoder({ kind }: { kind: DecodeKind }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [status, setStatus] = useState<Status>('empty');
  const [error, setError] = useState('');
  const [results, setResults] = useState<DecodeResult[]>([]);
  const [dragging, setDragging] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const stopWorker = useCallback(() => {
    requestRef.current++;
    workerRef.current?.terminate(); workerRef.current = null;
    clearTimeout(timeoutRef.current);
  }, []);
  useEffect(() => () => stopWorker(), [stopWorker]);
  useEffect(() => {
    if (!file) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const decode = useCallback(async (files: File[]) => {
    stopWorker(); setResults([]); setError(''); setStatus('empty'); setFile(null);
    if (files.length !== 1) { setError('请一次选择一张图片。'); setStatus('error'); return; }
    const nextFile = files[0];
    if (nextFile.size > MAX_IMAGE_BYTES) { setError('图片不能超过 10 MiB，请压缩后重试。'); setStatus('error'); return; }
    if (nextFile.type && !['image/png', 'image/jpeg', 'image/webp'].includes(nextFile.type)) { setError('仅支持 PNG、JPEG 和 WebP 图片。'); setStatus('error'); return; }
    setFile(nextFile); setStatus('loading');
    const requestId = ++requestRef.current;
    timeoutRef.current = setTimeout(() => {
      if (requestId !== requestRef.current) return;
      stopWorker(); setStatus('error'); setError('本地引擎处理超时，请缩小图片或裁剪到条码区域后重试。');
    }, 30_000);
    try {
      const pixels = location.protocol === 'file:' ? await readLocalImagePixels(nextFile) : undefined;
      if (requestId !== requestRef.current) return;
      const wasmBinary = await loadWasm();
      if (requestId !== requestRef.current) return;
      const worker = new DecodeWorker();
      workerRef.current = worker;
      const finish = () => { worker.terminate(); if (workerRef.current === worker) workerRef.current = null; clearTimeout(timeoutRef.current); };
      worker.onmessage = (event: MessageEvent<DecodeResponse>) => {
        if (requestId !== requestRef.current || event.data.requestId !== requestId) return;
        finish();
        if ('error' in event.data) { setStatus('error'); setError(event.data.message); return; }
        setResults(event.data.results); setStatus(event.data.results.length ? 'success' : 'no-result');
      };
      worker.onerror = () => {
        if (requestId !== requestRef.current) return;
        finish(); setStatus('error'); setError('本地识别引擎加载失败，请重新识别或刷新页面。');
      };
      // 不转移缓存 buffer 的所有权，防止取消后新 Worker 拿到已 detached 的数据。
      if (pixels) {
        worker.postMessage({ requestId, imageData: pixels, kind, wasmBinary }, [pixels.data.buffer]);
      } else {
        worker.postMessage({ requestId, file: nextFile, kind, wasmBinary });
      }
    } catch (cause) {
      if (requestId !== requestRef.current) return;
      stopWorker(); setStatus('error'); setError(cause instanceof LocalImageError ? cause.message : '本地识别引擎资源加载或启动失败，请确认页面已完整加载后重试。');
    }
  }, [kind, stopWorker]);

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const images = Array.from(event.clipboardData?.files ?? []);
      if (images.length) { event.preventDefault(); decode(images); }
    };
    window.addEventListener('paste', paste);
    return () => window.removeEventListener('paste', paste);
  }, [decode]);

  return <div className="tool-grid">
    <section className="tool-panel"><div className="panel-heading"><h2>上传图片</h2><span className="muted">本地识别</span></div><div className="panel-body">
      <div className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); decode(Array.from(event.dataTransfer.files)); }}>
        <Upload className={styles.uploadIcon} size={30} aria-hidden="true" /><p>拖放图片到这里，或直接粘贴</p>
        <label className={`button ${styles.uploadLabel}`}>选择图片<input className={styles.fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { decode(Array.from(event.target.files ?? [])); event.target.value = ''; }} /></label>
        <p className={styles.help}>单张 PNG / JPEG / WebP<br />最大 10 MiB · 1600 万像素</p>
      </div>
      {file && <><div className={styles.fileMeta}><span>{file.name} · {(file.size / 1024).toFixed(1)} KiB</span><button className="button button-quiet" onClick={() => { stopWorker(); setFile(null); setResults([]); setError(''); setStatus('empty'); }}>移除</button></div>{previewUrl && <img className={styles.imagePreview} src={previewUrl} alt="待识别图片预览" />}</>}
      {status === 'loading' && <div className="toolbar"><span className="status-message" role="status">正在本地识别…</span><button className="button" onClick={() => { stopWorker(); setStatus('cancelled'); }}>取消识别</button></div>}
      {(status === 'cancelled' || status === 'error' || status === 'no-result') && file && <div className="toolbar"><button className="button" onClick={() => decode([file])}>重新识别</button></div>}
      <p className={styles.footer}>图片与识别结果不会上传。{kind === 'qrcode' ? '仅识别 QR Code。' : '识别 Code 128、Code 39、EAN-13、EAN-8 和 UPC-A。'}</p>
    </div></section>
    <section className="tool-panel"><div className="panel-heading"><h2>识别结果</h2><span className="muted">{results.length ? `${results.length} 个结果` : '最多 10 个'}</span></div><div className="panel-body" aria-live="polite" aria-busy={status === 'loading'}>
      {error && <p className="error-message" role="alert">{error}</p>}
      {status === 'success' ? <div className={styles.resultList}>{results.map((result, index) => <article className={styles.decoded} key={`${index}-${result.format}`}><div className={styles.decodedHeader}><span className={styles.badge}>{result.format}</span><CopyButton text={result.text} /></div><pre className={styles.decodedText}>{result.text || '（空文本内容）'}</pre>{result.format === 'EAN13' && /^0\d{12}$/.test(result.text) && <p className={styles.help}>此编码与 UPC-A「{result.text.slice(1)}」的条纹相同；保留引擎识别的完整原文。</p>}</article>)}{results.length === 10 && <p className={styles.help}>已达到 10 个结果上限，可裁剪图片后继续识别。</p>}</div> : <div className="empty-state"><ScanLine className={styles.emptyIcon} size={40} aria-hidden="true" /><p>{status === 'loading' ? '正在扫描图片中的编码…' : status === 'no-result' ? '未找到可识别的编码' : status === 'cancelled' ? '识别已取消' : status === 'error' ? '识别未完成' : '等待选择图片'}</p><span className="muted">{status === 'no-result' ? '请确保制式受支持、图像清晰，且编码四周留有空白。' : '识别后的原文会显示在这里，可一键复制。'}</span></div>}
    </div></section>
  </div>;
}
