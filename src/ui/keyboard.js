import { state, COLORS, WIDTHS } from '../core/state.js';
import { render } from './canvas.js';
import { setMode } from './mode.js';
import { undo, redo, deleteSelected, clearAll } from './actions.js';
import { selectTool, applyStyle } from './toolbar.js';
import { toggleHelp } from './help.js';
import { takeScreenshot } from './screenshot.js';

// Цифры берём по физической клавише (e.code): работает на любой раскладке и с Alt/Shift
// (Shift+1 даёт «!», Option+1 на macOS — «¡»).
const digitIndex = (code) => {
  const m = /^(?:Digit|Numpad)(\d)$/.exec(code);
  if (!m) return -1;
  return m[1] === '0' ? 9 : Number(m[1]) - 1; // 1…9, 0 — десятая
};

export function initKeyboard(tools) {
  // Одиночный Alt в Windows переводит окно в «режим меню», и следующая клавиша теряется.
  // Alt у нас — удержание и двойной тап, поэтому гасим его сами.
  const swallowAlt = (e) => { if (e.key === 'Alt') e.preventDefault(); };
  addEventListener('keyup', swallowAlt);

  addEventListener('keydown', (e) => {
    swallowAlt(e);
    if (state.editing) return;
    const mod = e.ctrlKey || e.metaKey;
    const idx = digitIndex(e.code);

    if (mod && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && e.code === 'KeyY') { e.preventDefault(); redo(); return; }
    if (mod) return;

    if (idx >= 0) {
      e.preventDefault();
      if (e.altKey) { if (idx < COLORS.length) applyStyle({ color: COLORS[idx] }); return; }
      if (e.shiftKey) { if (idx < WIDTHS.length) applyStyle({ width: WIDTHS[idx] }); return; }
      if (idx < tools.length) selectTool(tools[idx].id);
      return;
    }
    if (e.altKey) return;
    if (e.key === 'F1') { e.preventDefault(); toggleHelp(); return; }
    if (e.code === 'KeyS' && !e.shiftKey) { takeScreenshot(); return; }
    if (e.key === 'Escape') {
      if (state.sel != null) { state.sel = null; render(); } else setMode('pass');
      return;
    }
    if (e.shiftKey && e.key === 'Delete') { clearAll(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
  });
}
