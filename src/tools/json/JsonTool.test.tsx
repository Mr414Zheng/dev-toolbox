import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import JsonTool from './JsonTool';
import type { JsonRequest, JsonResponse } from './json';

vi.mock('./JsonEditor', () => ({
  default: ({ value, onChange, label, readOnly }: { value: string; onChange?: (value: string) => void; label: string; readOnly?: boolean }) => <textarea aria-label={label} value={value} readOnly={readOnly} onChange={event => onChange?.(event.target.value)} />,
}));
vi.mock('./json.worker?worker&inline', () => ({ default: FakeWorker }));

const { FakeWorker } = vi.hoisted(() => {
  class FakeWorker {
    static instances: FakeWorker[] = [];
    onmessage: ((event: MessageEvent<JsonResponse>) => void) | null = null;
    onerror: (() => void) | null = null;
    request?: JsonRequest;
    terminated = false;
    constructor() { FakeWorker.instances.push(this); }
    postMessage(request: JsonRequest) { this.request = request; }
    terminate() { this.terminated = true; }
    complete(output: string) { this.onmessage?.({ data: { id: this.request!.id, output, bytes: 1 } } as MessageEvent<JsonResponse>); }
  }
  return { FakeWorker };
});

beforeEach(() => { FakeWorker.instances = []; });
afterEach(() => vi.unstubAllGlobals());

function start() {
  render(<JsonTool />);
  fireEvent.click(screen.getByRole('button', { name: '清空' }));
}

describe('JSON 任务与结果状态', () => {
  it('取消后从内联入口重建 Worker，不再使用脚本 URL 构造器', () => {
    const urlWorker = vi.fn(() => { throw new Error('离线无法获取脚本 URL'); });
    vi.stubGlobal('Worker', urlWorker);
    start();
    fireEvent.change(screen.getByRole('textbox', { name: 'JSON 输入' }), { target: { value: '{"offline":true}' } });
    fireEvent.click(screen.getByRole('button', { name: '格式化' }));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    fireEvent.click(screen.getByRole('button', { name: '格式化' }));
    expect(FakeWorker.instances).toHaveLength(2);
    expect(FakeWorker.instances[0].terminated).toBe(true);
    act(() => FakeWorker.instances[1].complete('{"offline":true}'));
    expect(screen.getByRole('textbox', { name: 'JSON 处理结果' })).toHaveValue('{"offline":true}');
    expect(urlWorker).not.toHaveBeenCalled();
  });

  it('输入修改后禁用旧结果，取消任务并丢弃旧响应', () => {
    start();
    const input = screen.getByRole('textbox', { name: 'JSON 输入' });
    fireEvent.change(input, { target: { value: '{"a":1}' } });
    fireEvent.click(screen.getByRole('button', { name: '格式化' }));
    const first = FakeWorker.instances[0];
    act(() => first.complete('{\n  "a": 1\n}'));
    expect(screen.getByRole('button', { name: '复制' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '下载 JSON' })).toBeEnabled();
    fireEvent.change(input, { target: { value: '{"a":2}' } });
    expect(screen.getByRole('button', { name: '复制' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下载 JSON' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '格式化' }));
    const second = FakeWorker.instances[1];
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(second.terminated).toBe(true);
    act(() => second.complete('stale response'));
    expect(screen.getByRole('textbox', { name: 'JSON 处理结果' })).toHaveValue('{\n  "a": 1\n}');
    fireEvent.click(screen.getByRole('button', { name: '格式化' }));
    act(() => FakeWorker.instances[2].complete('{"a":2}'));
    act(() => first.complete('old response'));
    expect(screen.getByRole('textbox', { name: 'JSON 处理结果' })).toHaveValue('{"a":2}');
    expect(screen.getByRole('button', { name: '复制' })).toBeEnabled();
  });

  it('读取中的旧文件不会覆盖之后的输入', async () => {
    start();
    let finish!: (value: string) => void;
    const file = new File(['{"old":true}'], 'old.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => new Promise<string>(resolve => { finish = resolve; }) });
    fireEvent.change(screen.getByLabelText('导入 JSON 文件'), { target: { files: [file] } });
    fireEvent.change(screen.getByRole('textbox', { name: 'JSON 输入' }), { target: { value: '{"new":true}' } });
    await act(async () => { finish('{"old":true}'); });
    expect(screen.getByRole('textbox', { name: 'JSON 输入' })).toHaveValue('{"new":true}');
  });
});
