import { Temporal } from '@js-temporal/polyfill';

export type TimestampUnit = 'milliseconds' | 'seconds';
export interface TimeResult { milliseconds: string; seconds: string; local: string; utc: string; timezone: string }

/** 秒数通过整数计算保留毫秒精度，负的小数时间戳也按原符号解释。 */
export function timestampToMilliseconds(source: string, unit: TimestampUnit): number {
  const input = source.trim();
  const pattern = unit === 'milliseconds' ? /^[+-]?\d+$/ : /^[+-]?\d+(?:\.\d{1,3})?$/;
  if (!pattern.test(input)) throw new Error(unit === 'milliseconds' ? '毫秒时间戳必须是整数' : '秒时间戳最多保留 3 位小数');
  const unsigned = input.replace(/^[+-]/, '');
  const [whole, fraction = ''] = unsigned.split('.');
  let value = BigInt(whole) * (unit === 'seconds' ? 1000n : 1n);
  if (unit === 'seconds') value += BigInt(fraction.padEnd(3, '0'));
  if (input.startsWith('-')) value = -value;
  if (value < -8640000000000000n || value > 8640000000000000n) throw new Error('时间戳超出可支持的日期范围');
  return Number(value);
}

export function getLocalTimezone(): string { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }

/** 无偏移的日期在指定时区解释，夏令时重复时间和不存在的时间均拒绝。 */
export function dateToMilliseconds(source: string, timezone: string): number {
  const input = source.trim();
  const match = /^((?:\d{4}|[+-]\d{6})-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/.exec(input);
  if (!match) throw new Error('请输入 YYYY-MM-DD HH:mm:ss[.SSS] 或 ISO 日期（支持 ±6 位扩展年份），精度最多为毫秒');
  const normalized = `${match[1]}T${match[2]}${match[3] ?? ''}`;
  try {
    const plain = Temporal.PlainDateTime.from(normalized, { overflow: 'reject' });
    // Temporal 接受闰秒并折算为 59 秒；本工具严格拒绝超出 00–59 的秒字段。
    if (match[2].slice(-2) === '60') throw new Error('invalid second');
    if (match[4]) return Temporal.Instant.from(normalized + match[4]).epochMilliseconds;
    return plain.toZonedDateTime(timezone, { disambiguation: 'reject' }).epochMilliseconds;
  } catch {
    throw new Error('日期无效，或该时间在所选时区存在夏令时歧义 / 不存在');
  }
}

export function formatTime(milliseconds: number, timezone = getLocalTimezone()): TimeResult {
  const instant = Temporal.Instant.fromEpochMilliseconds(milliseconds);
  const local = instant.toZonedDateTimeISO(timezone);
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');
  const year = local.year >= 0 && local.year <= 9999 ? pad(local.year, 4) : `${local.year < 0 ? '-' : '+'}${pad(Math.abs(local.year), 6)}`;
  const sign = milliseconds < 0 ? '-' : '';
  const absolute = BigInt(Math.abs(milliseconds));
  const remainder = absolute % 1000n;
  return {
    milliseconds: String(milliseconds),
    seconds: `${sign}${absolute / 1000n}${remainder ? `.${String(remainder).padStart(3, '0').replace(/0+$/, '')}` : ''}`,
    local: `${year}-${pad(local.month)}-${pad(local.day)} ${pad(local.hour)}:${pad(local.minute)}:${pad(local.second)}.${pad(local.millisecond, 3)} ${local.offset} [${timezone}]`,
    utc: instant.toString({ smallestUnit: 'millisecond' }),
    timezone,
  };
}
