import { describe, expect, it } from 'vitest';
import { MAX_JSON_BYTES, processJson } from './json';

describe('JSON 文本处理', () => {
  it('格式化保留 Unicode、重复键、大整数和指数原文', () => {
    const source = '{"中文":"你好🌍","big":900719925474099312345,"x":1.2300e+15,"x":-0}';
    const result = processJson(source, 'format');
    expect(result.issue).toBeUndefined();
    expect(result.output).toBe('{\n  "中文": "你好🌍",\n  "big": 900719925474099312345,\n  "x": 1.2300e+15,\n  "x": -0\n}');
  });
  it.each(['null', 'true', '123456789012345678901', '"顶层字符串"', '1e-12'])('支持顶层标量 %s', source => {
    expect(processJson(source, 'validate').issue).toBeUndefined();
    expect(processJson(source, 'minify').output).toBe(source);
  });
  it('压缩仅移除字符串之外的空白', () => {
    expect(processJson(' { "a" : " a \\n b ", "n": 1.000e+2 } \n', 'minify').output).toBe('{"a":" a \\n b ","n":1.000e+2}');
  });
  it('支持 4 空格和 Tab 缩进', () => {
    expect(processJson('{"a":1}', 'format', '4').output).toContain('\n    "a"');
    expect(processJson('{"a":1}', 'format', 'tab').output).toContain('\n\t"a"');
  });
  it.each(['{"a":1,}', '[1,]', '{/*注释*/"a":1}', '//注释\n1', '{"a":undefined}', '01', 'NaN', 'true false', '', '"\\uZZZZ"'])('严格拒绝非法 JSON %s', source => {
    expect(processJson(source, 'validate').issue).toBeDefined();
  });
  it('错误提供行列和源位置', () => {
    const issue = processJson('{\n  "a":\n}', 'format').issue;
    expect(issue).toMatchObject({ line: 3, column: 1, offset: 9 });
  });
  it('5 MiB 按 UTF-8 字节限制', () => {
    const exact = `"${'a'.repeat(MAX_JSON_BYTES - 2)}"`;
    expect(processJson(exact, 'validate').issue).toBeUndefined();
    expect(processJson(`${exact} `, 'validate').issue?.message).toContain('5 MiB');
    expect(processJson(`"${'中'.repeat(Math.ceil(MAX_JSON_BYTES / 3))}"`, 'validate').issue?.message).toContain('5 MiB');
  });
});
