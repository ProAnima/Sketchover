// Markdown для подписей на холсте — то, что полезно на созвоне, без лишнего:
// # заголовки (1–3), - списки, 1. нумерация, **жирный**, *курсив*, `код`, ~~зачёркнутый~~.
// Вложенные стили не поддерживаются: проще и предсказуемее.

const HEADING_SCALE = { 1: 1.6, 2: 1.35, 3: 1.15 };
// С захватывающей группой split() кладёт совпадения на нечётные позиции.
const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/;

function styleOf(token) {
  if (token.startsWith('`')) return { text: token.slice(1, -1), code: true };
  if (token.startsWith('**') || token.startsWith('__')) return { text: token.slice(2, -2), bold: true };
  if (token.startsWith('~~')) return { text: token.slice(2, -2), strike: true };
  return { text: token.slice(1, -1), italic: true };
}

export function parseInline(text) {
  return text
    .split(INLINE)
    .map((part, i) => (i % 2 ? styleOf(part) : { text: part }))
    .filter((run) => run.text);
}

// Строка → { scale, bold, prefix, runs }. Пустая строка остаётся строкой (высота сохраняется).
export function parseLines(text) {
  return String(text || '').split('\n').map((line) => {
    let m = /^(#{1,3})\s+(.*)$/.exec(line);
    if (m) return { scale: HEADING_SCALE[m[1].length], bold: true, prefix: '', runs: parseInline(m[2]) };
    m = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (m) return { scale: 1, bold: false, prefix: '• ', runs: parseInline(m[1]) };
    m = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (m) return { scale: 1, bold: false, prefix: `${m[1]}. `, runs: parseInline(m[2]) };
    return { scale: 1, bold: false, prefix: '', runs: parseInline(line) };
  });
}
