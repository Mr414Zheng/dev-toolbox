import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TimeTool from './TimeTool';

describe('时间工具交互', () => {
  it('转换零时间戳，修改输入使四项结果全部失效', () => {
    render(<TimeTool />);
    fireEvent.click(screen.getByRole('tab', { name: '时间戳 → 日期' }));
    fireEvent.click(screen.getByRole('button', { name: '清空' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Unix 时间戳' }), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: '转换为日期' }));
    expect(screen.getByText('1970-01-01T00:00:00.000Z')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '复制' })).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: '复制' }).every(button => !button.hasAttribute('disabled'))).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Unix 时间戳' }), { target: { value: '-1' } });
    expect(screen.getByRole('status')).toHaveTextContent('输入已修改');
    expect(screen.getAllByRole('button', { name: '复制' }).every(button => button.hasAttribute('disabled'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '转换为日期' }));
    expect(screen.getByText('1969-12-31T23:59:59.999Z')).toBeInTheDocument();
  });

  it('日期转换显式选择 UTC，并向用户解释非法日期', () => {
    render(<TimeTool />);
    fireEvent.click(screen.getByRole('tab', { name: '日期 → 时间戳' }));
    fireEvent.change(screen.getByRole('combobox', { name: '无偏移日期的时区' }), { target: { value: 'UTC' } });
    fireEvent.change(screen.getByRole('textbox', { name: '日期时间' }), { target: { value: '2023-02-29 00:00:00' } });
    fireEvent.click(screen.getByRole('button', { name: '转换为时间戳' }));
    expect(screen.getByRole('alert')).toHaveTextContent('日期无效');
    fireEvent.change(screen.getByRole('textbox', { name: '日期时间' }), { target: { value: '1970-01-01 00:00:00' } });
    fireEvent.click(screen.getByRole('button', { name: '转换为时间戳' }));
    expect(screen.getByText('1970-01-01T00:00:00.000Z')).toBeInTheDocument();
  });
});
