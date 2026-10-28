import { useEffect, useRef, useState } from 'react';
import { FileUp, Braces, CheckCircle2, Download, Eraser, Play, Sparkles, X } from 'lucide-react';
import { useDraft } from '../../shared/useDraft';
import { CopyButton } from '../../shared/CopyButton';
import { downloadBlob } from '../../shared/browser';
import JsonEditor from './JsonEditor';
import JsonWorker from './json.worker?worker&inline';
import { MAX_JSON_BYTES, type JsonAction, type JsonIndent, type JsonIssue, type JsonResponse } from './json';
import styles from './JsonTool.module.css';

const example = '{"project":"dev-toolbox","version":1,"features":["JSON 格式化","时间转换","编码解码"],"settings":{"theme":"light","private":true}}';
const actionNames = { format: '格式化', minify: '压缩', validate: '校验' };
interface Draft { input: string; indent: JsonIndent }
interface Result { output: string; source: string; indent: JsonIndent; action: JsonAction }

export default function JsonTool() {
  const [draft, setDraft] = useDraft<Draft>('json', { input: '', indent: '2' });
  const [result, setResult] = useState<Result | null>(null);
  const [issue, setIssue] = useState<JsonIssue>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const worker = useRef<Worker | null>(null);
  const request = useRef(0);
  const fileRequest = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const stale = !!result && (result.source !== draft.input || result.indent !== draft.indent);
  const usable = !!result && !stale && !busy && !issue;
  useEffect(() => () => { worker.current?.terminate(); request.current += 1; fileRequest.current += 1; }, []);

  function cancel() {
    request.current += 1;
    fileRequest.current += 1;
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
  }
  function updateInput(input: string) {
    cancel();
    setDraft(previous => ({ ...previous, input }));
    setIssue(undefined);
    setMessage('');
  }
  function run(action: JsonAction) {
    cancel();
    setIssue(undefined);
    setMessage('');
    if (!draft.input.trim()) { setMessage('请先输入 JSON 内容'); return; }
    setBusy(true);
    const id = ++request.current;
    const source = draft.input;
    const indent = draft.indent;
    try {
      const nextWorker = new JsonWorker();
      worker.current = nextWorker;
      nextWorker.onmessage = ({ data }: MessageEvent<JsonResponse>) => {
        if (data.id !== request.current) return;
        nextWorker.terminate();
        worker.current = null;
        setBusy(false);
        if (data.issue) { setIssue(data.issue); setResult(null); return; }
        setResult({ output: data.output, source, indent, action });
        setMessage(action === 'validate' ? '校验通过，JSON 语法有效' : `${actionNames[action]}完成`);
      };
      nextWorker.onerror = () => {
        if (id !== request.current) return;
        cancel();
        setIssue({ message: '处理失败，请重试', offset: 0, line: 1, column: 1 });
      };
      nextWorker.postMessage({ id, input: source, indent, action });
    } catch {
      cancel();
      setIssue({ message: '无法启动处理任务，请刷新页面后重试', offset: 0, line: 1, column: 1 });
    }
  }
  async function loadFile(file: File | undefined) {
    if (!file) return;
    const id = ++fileRequest.current;
    if (file.size > MAX_JSON_BYTES) {
      setMessage('文件超过 5 MiB 限制，请选择更小的 JSON 文件');
      return;
    }
    try {
      const text = await file.text();
      if (id === fileRequest.current) updateInput(text);
    } catch {
      if (id === fileRequest.current) setMessage('文件读取失败，请重新选择');
    }
  }

  return <div className={styles.root}>
    <div className={styles.topbar}>
      <div className="toolbar">
        <button className="button" onClick={() => fileInput.current?.click()}><FileUp size={15} />导入文件</button>
        <button className="button button-quiet" onClick={() => updateInput(example)}><Sparkles size={15} />试用示例</button>
        <button className="button button-quiet" onClick={() => { updateInput(''); setResult(null); }}><Eraser size={15} />清空</button>
        <input ref={fileInput} hidden type="file" accept=".json,application/json,text/plain" aria-label="导入 JSON 文件" onChange={event => { void loadFile(event.target.files?.[0]); event.target.value = ''; }} />
      </div>
      <span className={styles.privacy}>仅在浏览器处理 · 文件上限 5 MiB</span>
    </div>
    <div className={`tool-grid ${styles.workspace}`}>
      <section className={`tool-panel ${styles.panel}`}>
        <div className="panel-heading"><div className={styles.panelTitle}><Braces size={17} /><h2>输入 JSON</h2></div><span className={styles.tag}>SOURCE</span></div>
        <div className={styles.editorWrap}>
          <JsonEditor value={draft.input} onChange={updateInput} label="JSON 输入" issue={issue} />
          {!draft.input && <div className={styles.editorPlaceholder}>在此粘贴 JSON，或导入一个文件…<span>支持对象、数组，以及字符串、数字等顶层值</span></div>}
        </div>
        <div className={styles.editorFooter}><span>{draft.input.length.toLocaleString()} 字符</span><span>JSON · UTF-8</span></div>
      </section>
      <div className={styles.controls}>
    <div className={styles.actionbar}>
      <label className={styles.indentLabel}>缩进<select className="select" aria-label="JSON 缩进" value={draft.indent} onChange={event => { cancel(); setDraft(previous => ({ ...previous, indent: event.target.value as JsonIndent })); }}><option value="2">2 个空格</option><option value="4">4 个空格</option><option value="tab">Tab</option></select></label>
      <div className="toolbar"><button className="button button-primary" disabled={busy} onClick={() => run('format')}><Play size={15} />格式化</button><button className="button" disabled={busy} onClick={() => run('minify')}>压缩</button><button className="button" disabled={busy} onClick={() => run('validate')}>校验 JSON</button>{busy && <button className="button button-quiet" onClick={() => { cancel(); setMessage('已取消处理'); }}><X size={15} />取消</button>}</div>
    </div>
    <div aria-live="polite" className={styles.feedback}>
      {issue && <p className="error-message">{issue.message} · 第 {issue.line} 行，第 {issue.column} 列</p>}
      {stale && <p className="stale-message">输入或缩进已修改，请重新处理以更新结果。</p>}
      {message && <p className="status-message">{message}</p>}
    </div>
      </div>
      <section className={`tool-panel ${styles.panel} ${styles.outputPanel}`}>
        <div className="panel-heading"><div className={styles.panelTitle}><CheckCircle2 size={17} /><h2>处理结果</h2></div><span className={styles.tag}>{busy ? '处理中…' : 'OUTPUT'}</span></div>
        <div className={styles.editorWrap} aria-busy={busy}>
          {result ? <JsonEditor value={result.output} label="JSON 处理结果" readOnly /> : <div className={styles.empty}><div className={styles.emptyIcon}><Braces size={26} /></div><strong>{busy ? '正在处理 JSON…' : '让 JSON 清晰有序'}</strong><span>{busy ? '大文件处理可能需要一点时间' : '输入内容后，选择格式化、压缩或校验'}</span></div>}
        </div>
        <div className={styles.editorFooter}><span>{result ? `${result.output.length.toLocaleString()} 字符` : '等待处理'}</span><div className="result-actions"><CopyButton text={result?.output ?? ''} disabled={!usable} /><button className={styles.iconButton} aria-label="下载 JSON" title="下载 JSON" disabled={!usable} onClick={() => result && downloadBlob(new Blob([result.output], { type: 'application/json;charset=utf-8' }), 'formatted.json')}><Download size={15} /></button></div></div>
      </section>
    </div>
    <p className={styles.tip}>小提示：格式化只调整排版，会保留大整数、重复键与数字的原始写法。</p>
  </div>;
}
