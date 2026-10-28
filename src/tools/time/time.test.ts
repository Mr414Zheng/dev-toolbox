import { describe, expect, it } from 'vitest';
import { dateToMilliseconds, formatTime, timestampToMilliseconds } from './time';

describe('时间戳解析和显示', () => {
  it('零与负数时间戳', () => {
    expect(timestampToMilliseconds('0', 'milliseconds')).toBe(0);
    expect(timestampToMilliseconds('-1', 'milliseconds')).toBe(-1);
    expect(timestampToMilliseconds('-0.001', 'seconds')).toBe(-1);
    expect(timestampToMilliseconds('-1.25', 'seconds')).toBe(-1250);
    expect(formatTime(-1, 'UTC').seconds).toBe('-0.001');
    expect(formatTime(0, 'UTC').utc).toBe('1970-01-01T00:00:00.000Z');
  });
  it('严格遵守显式单位和毫秒精度', () => {
    expect(timestampToMilliseconds('1.123', 'seconds')).toBe(1123);
    expect(timestampToMilliseconds('1', 'milliseconds')).toBe(1);
    expect(() => timestampToMilliseconds('1.1', 'milliseconds')).toThrow();
    expect(() => timestampToMilliseconds('1.0000', 'seconds')).toThrow();
    expect(() => timestampToMilliseconds('1e3', 'seconds')).toThrow();
    expect(() => timestampToMilliseconds('8640000000000001', 'milliseconds')).toThrow();
  });
  it('输出命名时区和偏移量', () => {
    const result = formatTime(0, 'Asia/Shanghai');
    expect(result.local).toBe('1970-01-01 08:00:00.000 +08:00 [Asia/Shanghai]');
    expect(result.milliseconds).toBe('0');
    expect(result.seconds).toBe('0');
  });
  it.each([
    [-62198755200000, '-000001-01-01'],
    [253402300800000, '+010000-01-01'],
    [-62167219200000, '0000-01-01'],
  ])('扩展年份规范显示并支持往返：%s', (milliseconds, yearDate) => {
    const result = formatTime(milliseconds, 'UTC');
    expect(result.local).toBe(`${yearDate} 00:00:00.000 +00:00 [UTC]`);
    expect(dateToMilliseconds(result.utc, 'UTC')).toBe(milliseconds);
    expect(dateToMilliseconds(`${yearDate} 00:00:00.000`, 'UTC')).toBe(milliseconds);
  });
});

describe('严格日期解析', () => {
  it('无偏移日期按选择的时区解释', () => {
    expect(dateToMilliseconds('1970-01-01 00:00:00', 'UTC')).toBe(0);
    expect(dateToMilliseconds('1970-01-01 08:00:00', 'Asia/Shanghai')).toBe(0);
    expect(dateToMilliseconds('1970-01-01 00:00:00.001', 'UTC')).toBe(1);
  });
  it('尊重输入中的偏移量', () => {
    expect(dateToMilliseconds('1970-01-01T08:00:00+08:00', 'America/New_York')).toBe(0);
    expect(dateToMilliseconds('1970-01-01T00:00:00Z', 'Asia/Shanghai')).toBe(0);
  });
  it('校验闰年和非法日期，不归一化溢出', () => {
    expect(dateToMilliseconds('2024-02-29 00:00:00', 'UTC')).toBe(1709164800000);
    for (const source of ['2023-02-29 00:00:00', '2024-02-30 00:00:00', '2024-13-01 00:00:00', '2024-01-01 24:00:00', '2024-01-01 00:00:60', '2024-01-01 00:00:00.0001', '2024-01-01']) {
      expect(() => dateToMilliseconds(source, 'UTC')).toThrow();
    }
  });
  it('拒绝纽约夏令时不存在和重复的本地时间', () => {
    expect(() => dateToMilliseconds('2024-03-10 02:30:00', 'America/New_York')).toThrow();
    expect(() => dateToMilliseconds('2024-11-03 01:30:00', 'America/New_York')).toThrow();
    expect(dateToMilliseconds('2024-11-03T01:30:00-04:00', 'America/New_York')).toBe(1730611800000);
    expect(dateToMilliseconds('2024-11-03T01:30:00-05:00', 'America/New_York')).toBe(1730615400000);
  });
});
