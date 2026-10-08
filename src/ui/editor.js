import { state } from '../core/state.js';
import { textFont, textSize, removeShape } from '../core/shapes.js';
import { commit } from '../core/history.js';
import { api } from './api.js';
import { render } from './canvas.js';

const editor = document.querySelector('#editor');
let minHeight = 0;

// Поле растёт вниз по мере набора строк, чтобы текст не уезжал из вида.
function fitHeight() {
  editor.style.height = `${minHeight}px`;
  editor.style.height = `${Math.max(minHeight, editor.scrollHeight)}px`;
}

const LIST_ITEM = /^(\s*)(?:([-*+])|(\d+)([.)]))\s+(.*)$/;

// Enter в пункте списка — следующий пункт («- » или «2. »), как в обычных редакторах.
// Enter в пустом пункте — конец списка: маркер убирается. Возвращает false, если строка не пункт.
function continueList() {
  const pos = editor.selectionStart;
  const lineStart = editor.value.lastIndexOf('\n', pos - 1) + 1;
  const m = LIST_ITEM.exec(editor.value.slice(lineStart, pos));
  if (!m) return false;
  const [, indent, bullet, number, dot, content] = m;
  if (!content.trim()) {
    editor.setRangeText('', lineStart, pos, 'end');
  } else {
    const marker = bullet || `${Number(number) + 1}${dot}`;
    editor.setRangeText(`\n${indent}${marker} `, pos, editor.selectionEnd, 'end');
  }
  fitHeight();
  return true;
}

export function editText(s) {
  state.editing = s;
  state.sel = s.id;
  const isNode = s.type === 'node';
  const t = textSize(s);
  const box = isNode ? { x: s.x, y: s.y, w: s.w, h: s.h } : { x: s.x, y: s.y, w: Math.max(160, t.w + 24), h: t.h + 12 };
  Object.assign(editor.style, {
    left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px`,
    font: textFont(s), color: isNode ? '#fff' : s.color,
  });
  minHeight = box.h;
  editor.value = s.text;
  editor.hidden = false;
  fitHeight();
  // Окно без фокуса (вызвали хоткеем) — сначала фокус окну, потом полю: наоборот поле
  // тут же теряло бы фокус и правка закрывалась пустой.
  const ready = document.hasFocus() ? Promise.resolve() : api.focus();
  ready.finally(() => {
    if (state.editing !== s) return;
    editor.focus();
    editor.select();
  });
  render();
}

export function finishEdit() {
  const s = state.editing;
  if (!s) return;
  state.editing = null;
  s.text = editor.value.replace(/\s+$/, ''); // хвост пустых строк от завершения списка не нужен
  editor.hidden = true;
  if (s.type === 'text' && !s.text.trim()) removeShape(s);
  if (s.type === 'node') {
    // Блок растёт под текст (заголовки, списки), но не сжимается.
    const t = textSize(s);
    s.w = Math.max(s.w, Math.ceil(t.w) + 28);
    s.h = Math.max(s.h, Math.ceil(t.h) + 16);
  }
  commit();
  render();
}

editor.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    if (!continueList()) finishEdit();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    finishEdit();
  }
});
editor.addEventListener('input', fitHeight);
editor.addEventListener('blur', finishEdit);
