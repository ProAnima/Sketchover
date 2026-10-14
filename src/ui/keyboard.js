import { state, COLORS, WIDTHS } from '../core/state.js';
import { comboFromEvent } from '../core/keymap.js';
import { render } from './canvas.js';
import { setMode } from './mode.js';
import { undo, redo, deleteSelected, clearAll } from './actions.js';
import { selectTool, applyStyle } from './toolbar.js';
import { toggleHelp } from './help.js';
import { takeScreenshot } from './screenshot.js';
import { copyImage, saveScene, openScene } from './export.js';
import { actionFor } from './shortcuts.js';
import { isMac } from './keys.js';

// Что делает каждое действие реестра (shortcuts.js); клавиши к ним назначает человек.
const RUN = {
  pass: () => { if (state.sel != null) { state.sel = null; render(); } else setMode('pass'); },
  help: toggleHelp,
  shot: takeScreenshot,
  undo,
  redo,
  copy: copyImage,
  save: saveScene,
  open: openScene,
  delete: deleteSelected,
  clear: clearAll,
};

function run(action) {
  const [kind, arg] = action.split('.');
  if (kind === 'tool') return selectTool(arg);
  if (kind === 'color') return applyStyle({ color: COLORS[Number(arg) - 1] });
  if (kind === 'width') return applyStyle({ width: WIDTHS[Number(arg) - 1] });
  return RUN[action]();
}

export function initKeyboard() {
  // Одиночный Alt в Windows переводит окно в «режим меню», и следующая клавиша теряется.
  // Alt у нас — удержание и двойной тап, поэтому гасим его сами.
  const swallowAlt = (e) => { if (e.key === 'Alt') e.preventDefault(); };
  addEventListener('keyup', swallowAlt);

  addEventListener('keydown', (e) => {
    swallowAlt(e);
    if (state.editing) return;
    const combo = comboFromEvent(e, isMac());
    const action = combo && actionFor(combo);
    if (!action) return;
    e.preventDefault();
    run(action);
  });
}
