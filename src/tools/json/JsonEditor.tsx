import { useEffect, useRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, keymap, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, foldGutter, indentOnInput, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { json } from '@codemirror/lang-json';
import type { JsonIssue } from './json';
import styles from './JsonTool.module.css';

interface Props { value: string; onChange?: (value: string) => void; label: string; readOnly?: boolean; issue?: JsonIssue }

const highlightStyle = HighlightStyle.define([
  { tag: tags.string, color: 'var(--success)' },
  { tag: tags.number, color: 'var(--primary)' },
  { tag: [tags.bool, tags.null], color: 'var(--danger)' },
  { tag: tags.propertyName, color: 'var(--text)' },
  { tag: tags.punctuation, color: 'var(--muted)' },
]);

export default function JsonEditor({ value, onChange, label, readOnly = false, issue }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const callback = useRef(onChange);
  const editable = useRef(new Compartment());
  useEffect(() => { callback.current = onChange; }, [onChange]);
  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({ doc: value, extensions: [
        lineNumbers(), foldGutter(), history(), drawSelection(), highlightActiveLine(), highlightActiveLineGutter(),
        bracketMatching(), indentOnInput(), syntaxHighlighting(highlightStyle), json(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        editable.current.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
        EditorView.contentAttributes.of({ 'aria-label': label, spellcheck: 'false' }),
        EditorView.updateListener.of(update => { if (update.docChanged) callback.current?.(update.state.doc.toString()); }),
        EditorView.theme({ '&': { height: '100%', fontSize: '13px', color: 'var(--text)', background: 'var(--surface)' }, '.cm-scroller': { overflow: 'auto', fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace', lineHeight: '1.8' }, '.cm-content': { padding: '16px 8px', caretColor: 'var(--primary)' }, '.cm-gutters': { background: 'var(--surface-alt)', color: 'var(--text)', border: 'none', paddingRight: '6px' }, '.cm-activeLine': { background: 'var(--primary-soft)' }, '.cm-activeLineGutter': { background: 'var(--primary-soft)', color: 'var(--primary)' }, '.cm-cursor': { borderLeftColor: 'var(--primary)' }, '&.cm-focused': { outline: 'none' } }),
      ] }),
    });
    editor.current = view;
    return () => { view.destroy(); editor.current = null; };
    // 编辑器只创建一次，后续内容通过事务同步，以保留光标和撤销历史。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const view = editor.current;
    if (view && view.state.doc.toString() !== value) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value]);
  useEffect(() => {
    editor.current?.dispatch({ effects: editable.current.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]) });
  }, [readOnly]);
  useEffect(() => {
    const view = editor.current;
    if (view && issue) {
      const offset = Math.min(issue.offset, view.state.doc.length);
      view.dispatch({ selection: { anchor: offset }, effects: EditorView.scrollIntoView(offset, { y: 'center' }) });
      view.focus();
    }
  }, [issue]);
  return <div ref={host} className={styles.editor} />;
}
