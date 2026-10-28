import { useState } from 'react';
import { ArrowRight, Clock3, CalendarDays, Globe2, Sparkles, Eraser, Zap } from 'lucide-react';
import { useDraft } from '../../shared/useDraft';
import { CopyButton } from '../../shared/CopyButton';
import { dateToMilliseconds, formatTime, getLocalTimezone, timestampToMilliseconds, type TimestampUnit, type TimeResult } from './time';
import styles from './TimeTool.module.css';

interface Draft { mode: 'timestamp' | 'date'; timestamp: string; date: string; unit: TimestampUnit; zone: 'local' | 'UTC' }
interface Result { value: TimeResult; signature: string }

export default function TimeTool() {
  const [draft, setDraft] = useDraft<Draft>('time', { mode: 'timestamp', timestamp: '', date: '', unit: 'milliseconds', zone: 'local' });
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const timezone = getLocalTimezone();
  const signature = JSON.stringify(draft);
  const stale = !!result && result.signature !== signature;
  function update(patch: Partial<Draft>) { setDraft(previous => ({ ...previous, ...patch })); setError(''); }
  function convert(next = draft) {
    try {
      const milliseconds = next.mode === 'timestamp' ? timestampToMilliseconds(next.timestamp, next.unit) : dateToMilliseconds(next.date, next.zone === 'UTC' ? 'UTC' : timezone);
      setResult({ value: formatTime(milliseconds, timezone), signature: JSON.stringify(next) });
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '转换失败，请检查输入'); setResult(null); }
  }
  function now() {
    const milliseconds = Date.now();
    const value = formatTime(milliseconds, timezone);
    const [localDate, localTime, offset] = value.local.split(' ');
    // 当前时刻已确定，保留偏移，避免秋季夏令时回拨时填出有歧义的本地时间。
    const next = { ...draft, timestamp: draft.unit === 'seconds' ? value.seconds : value.milliseconds, date: draft.zone === 'UTC' ? value.utc : `${localDate}T${localTime}${offset}` };
    update(next);
    convert(next);
  }
  function sample() {
    update(draft.mode === 'timestamp' ? { timestamp: draft.unit === 'milliseconds' ? '1704067200000' : '1704067200' } : { date: '2024-01-01 00:00:00' });
  }
  const rows = result ? [
    { label: 'Unix 时间戳 · 毫秒', hint: 'MILLISECONDS', value: result.value.milliseconds },
    { label: 'Unix 时间戳 · 秒', hint: 'SECONDS', value: result.value.seconds },
    { label: '本地时间', hint: timezone, value: result.value.local },
    { label: 'UTC 时间', hint: 'ISO 8601', value: result.value.utc },
  ] : [];

  return <div className={styles.root}>
    <div className={styles.topbar}><div className={`segmented ${styles.tabs}`} role="tablist" aria-label="时间转换方向"><button id="timestamp-tab" type="button" role="tab" aria-controls="time-input-panel" aria-selected={draft.mode === 'timestamp'} className={draft.mode === 'timestamp' ? 'active' : ''} onClick={() => update({ mode: 'timestamp' })}><Clock3 size={15} />时间戳 → 日期</button><button id="date-tab" type="button" role="tab" aria-controls="time-input-panel" aria-selected={draft.mode === 'date'} className={draft.mode === 'date' ? 'active' : ''} onClick={() => update({ mode: 'date' })}><CalendarDays size={15} />日期 → 时间戳</button></div><span className={styles.precision}><span />毫秒级精度</span></div>
    <div className="tool-grid">
      <section id="time-input-panel" role="tabpanel" aria-labelledby={draft.mode === 'timestamp' ? 'timestamp-tab' : 'date-tab'} className="tool-panel">
        <div className="panel-heading"><div className={styles.panelTitle}><Clock3 size={17} /><h2>{draft.mode === 'timestamp' ? '输入时间戳' : '输入日期时间'}</h2></div><span className={styles.tag}>INPUT</span></div>
        <div className={`panel-body ${styles.inputBody}`}>
          {draft.mode === 'timestamp' ? <>
            <label className="field"><span className="field-label">时间戳单位</span><select className="select" value={draft.unit} onChange={event => update({ unit: event.target.value as TimestampUnit })}><option value="milliseconds">毫秒 (ms)</option><option value="seconds">秒 (s)</option></select></label>
            <label className="field"><span className="field-label">Unix 时间戳</span><input className={`input ${styles.monoInput}`} value={draft.timestamp} onChange={event => update({ timestamp: event.target.value })} placeholder={draft.unit === 'milliseconds' ? '例如：1704067200000' : '例如：1704067200.123'} spellCheck={false} onKeyDown={event => { if (event.key === 'Enter') convert(); }} /></label>
            <p className={styles.inputHint}>{draft.unit === 'milliseconds' ? '输入整数毫秒，支持 0 和负数时间戳。' : '支持整数或最多 3 位小数，不会自动猜测单位。'}</p>
          </> : <>
            <label className="field"><span className="field-label">无偏移日期的时区</span><select className="select" value={draft.zone} onChange={event => update({ zone: event.target.value as 'local' | 'UTC' })}><option value="local">本地时区 · {timezone}</option><option value="UTC">UTC · +00:00</option></select></label>
            <label className="field"><span className="field-label">日期时间</span><input className={`input ${styles.monoInput}`} value={draft.date} onChange={event => update({ date: event.target.value })} placeholder="2024-01-01 00:00:00" spellCheck={false} onKeyDown={event => { if (event.key === 'Enter') convert(); }} /></label>
            <p className={styles.inputHint}>支持 YYYY-MM-DD HH:mm:ss[.SSS] 和 ISO 格式；带 Z 或偏移量时使用输入中的时区。</p>
          </>}
          <div className="toolbar"><button className="button button-quiet" onClick={now}><Zap size={14} />当前时间</button><button className="button button-quiet" onClick={sample}><Sparkles size={14} />示例</button><button className="button button-quiet" onClick={() => { update({ timestamp: '', date: '' }); setResult(null); }}><Eraser size={14} />清空</button></div>
          <button className={`button button-primary ${styles.convert}`} onClick={() => convert()}>转换{draft.mode === 'timestamp' ? '为日期' : '为时间戳'}<ArrowRight size={16} /></button>
          {error && <p className="error-message" role="alert">{error}</p>}
          <div className={styles.zoneNote}><Globe2 size={14} /><span>本地时区：<strong>{timezone}</strong></span></div>
        </div>
      </section>
      <section className="tool-panel">
        <div className="panel-heading"><div className={styles.panelTitle}><CalendarDays size={17} /><h2>转换结果</h2></div>{result && !stale && <span className={styles.success}>转换成功</span>}</div>
        {result ? <div className={styles.results}>{rows.map(row => <div className={styles.resultRow} key={row.label}><div className={styles.resultLabel}><span>{row.label}</span><span>{row.hint}</span></div><div className={styles.resultValue}><code>{row.value}</code><CopyButton text={row.value} disabled={stale} /></div></div>)}{stale && <p className="stale-message" role="status">输入已修改，请重新转换以更新结果。</p>}</div> : <div className={styles.empty}><div className={styles.emptyIcon}><CalendarDays size={27} /></div><strong>时间，一目了然</strong><span>转换后可查看本地时间、UTC 与时间戳</span></div>}
      </section>
    </div>
    <div className={styles.info}><Clock3 size={17} /><p><strong>关于 Unix 时间戳</strong><span>从 1970 年 1 月 1 日 00:00:00 UTC 起计算。1 秒 = 1,000 毫秒；时间戳本身不包含时区。</span></p></div>
  </div>;
}
