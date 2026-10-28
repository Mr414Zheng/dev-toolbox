import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

const drafts = new Map<string, unknown>();

/** 仅在当前页面会话内保留草稿，不向持久存储写入业务数据。每个模块使用独立 key。 */
export function useDraft<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (!drafts.has(key)) drafts.set(key, initial);
    return drafts.get(key) as T;
  });
  const setDraft = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    const previous = drafts.get(key) as T;
    const resolved = typeof next === 'function' ? (next as (value: T) => T)(previous) : next;
    drafts.set(key, resolved);
    setValue(resolved);
  }, [key]);
  return [value, setDraft];
}
