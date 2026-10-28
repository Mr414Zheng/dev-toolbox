import { applyEdits, createScanner, format, parseTree, printParseErrorCode, type ParseError } from 'jsonc-parser';

export const MAX_JSON_BYTES = 5 * 1024 * 1024;
export type JsonAction = 'format' | 'minify' | 'validate';
export type JsonIndent = '2' | '4' | 'tab';
export interface JsonIssue { message: string; offset: number; line: number; column: number }
export interface JsonResult { output: string; issue?: JsonIssue; bytes: number }
export interface JsonRequest { id: number; input: string; action: JsonAction; indent: JsonIndent }
export interface JsonResponse extends JsonResult { id: number }

const errorLabels: Record<string, string> = {
  InvalidSymbol: '存在无效字符', InvalidNumberFormat: '数字格式无效', PropertyNameExpected: '属性名称必须使用双引号',
  ValueExpected: '此处需要 JSON 值', ColonExpected: '属性名称后缺少冒号', CommaExpected: '此处缺少逗号',
  CloseBraceExpected: '缺少右花括号 }', CloseBracketExpected: '缺少右方括号 ]', EndOfFileExpected: 'JSON 值后存在多余内容',
  InvalidCommentToken: '标准 JSON 不允许注释', UnexpectedEndOfComment: '注释未闭合', UnexpectedEndOfString: '字符串未闭合',
  UnexpectedEndOfNumber: '数字不完整', InvalidUnicode: 'Unicode 转义无效', InvalidEscapeCharacter: '字符串转义无效', InvalidCharacter: '字符串包含无效字符',
};

export function issueAt(input: string, offset: number, message: string): JsonIssue {
  const preceding = input.slice(0, offset);
  const lines = preceding.split(/\r\n|\r|\n/);
  return { message, offset, line: lines.length, column: lines[lines.length - 1].length + 1 };
}

/** 校验后只编辑原始文本，保留大整数、重复键和数字字面量。 */
export function processJson(input: string, action: JsonAction, indent: JsonIndent = '2'): JsonResult {
  const bytes = new TextEncoder().encode(input).byteLength;
  if (bytes > MAX_JSON_BYTES) return { output: '', bytes, issue: issueAt(input, 0, '内容超过 5 MiB 限制，请缩小后重试') };
  const errors: ParseError[] = [];
  parseTree(input, errors, { allowTrailingComma: false, disallowComments: true, allowEmptyContent: false });
  if (errors.length) {
    const first = errors[0];
    const code = printParseErrorCode(first.error);
    return { output: '', bytes, issue: issueAt(input, first.offset, errorLabels[code] ?? `JSON 语法错误：${code}`) };
  }
  if (action === 'validate') return { output: input, bytes };
  if (action === 'format') {
    return { output: applyEdits(input, format(input, undefined, { insertSpaces: indent !== 'tab', tabSize: indent === '4' ? 4 : 2, eol: '\n' })), bytes };
  }
  const scanner = createScanner(input, true);
  const tokens: string[] = [];
  for (scanner.scan(); scanner.getTokenLength() > 0; scanner.scan()) {
    tokens.push(input.slice(scanner.getTokenOffset(), scanner.getTokenOffset() + scanner.getTokenLength()));
  }
  return { output: tokens.join(''), bytes };
}
