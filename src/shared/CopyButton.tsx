import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyButton({ text, disabled = false }: { text: string; disabled?: boolean }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timeout.current), []);
  async function copy() {
    clearTimeout(timeout.current);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
    timeout.current = setTimeout(() => setStatus('idle'), 3500);
  }
  return <span className="copy-control">
    <button type="button" className="button" onClick={copy} disabled={disabled || !text}>
      {status === 'copied' ? <Check size={15} /> : <Copy size={15} />}
      {status === 'copied' ? '已复制' : '复制'}
    </button>
    {status === 'failed' && <span role="status" className="copy-error">复制失败，请选中结果手动复制</span>}
  </span>;
}
