import { state, COLORS, WIDTHS } from '../core/state.js';
import { selected } from '../core/shapes.js';
import { commit } from '../core/history.js';
import { t } from '../i18n/index.js';
import { api } from './api.js';
import { render } from './canvas.js';
import { finishEdit } from './editor.js';
import { setMode, toggleMode, relabelMode, syncPassThrough } from './mode.js';
import { undo, redo, clearAll } from './actions.js';
import { toolIcon } from './icons.js';
import { takeScreenshot } from './screenshot.js';

const CAMERA = 'M9 4 7.5 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.5L15 4zm3 4.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z';

const $ = (s) => document.querySelector(s);
const dock = $('#dock');
let tools = [];

function button(className, onClick) {
  const b = document.createElement('button');
  if (className) b.className = className;
  b.addEventListener('click', onClick);
  return b;
}

export function selectTool(id) {
  finishEdit();
  state.tool = id;
  if (id !== 'select') state.sel = null;
  if (state.mode !== 'draw') setMode('draw');
  refreshToolbar();
  render();
}

export function applyStyle(patch) {
  Object.assign(state, patch);
  const s = selected();
  if (s) {
    if (patch.color) s.color = patch.color;
    if (patch.width && s.type !== 'text') s.width = patch.width;
    commit();
  }
  refreshToolbar();
  render();
}

function refreshToolbar() {
  document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === state.tool));
  document.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('active', b.dataset.color === state.color));
  document.querySelectorAll('[data-width]').forEach((b) => b.classList.toggle('active', Number(b.dataset.width) === state.width));
}

// Подсказки с параметрами (клавиша, номер) — их нельзя задать статично в разметке.
export function relabelToolbar() {
  tools.forEach((tool, i) => { $(`[data-tool="${tool.id}"]`).title = `${t(tool.label)} (${(i + 1) % 10})`; });
  COLORS.forEach((c, i) => { $(`[data-color="${c}"]`).title = `${t('toolbar.color', { n: i + 1 })} (Alt+${i + 1})`; });
  WIDTHS.forEach((w, i) => { $(`[data-width="${w}"]`).title = `${t('toolbar.width', { n: w })} (Shift+${i + 1})`; });
  relabelMode();
}

function buildGroups() {
  for (const tool of tools) {
    const b = button('', () => selectTool(tool.id));
    b.append(toolIcon(tool));
    b.dataset.tool = tool.id;
    $('#tools').append(b);
  }
  for (const c of COLORS) {
    const b = button('swatch', () => applyStyle({ color: c }));
    b.style.background = c;
    b.dataset.color = c;
    $('#colors').append(b);
  }
  for (const w of WIDTHS) {
    const b = button('width', () => applyStyle({ width: w }));
    const line = document.createElement('i');
    line.style.height = `${Math.max(2, w / 1.5)}px`;
    b.append(line);
    b.dataset.width = String(w);
    $('#widths').append(b);
  }
}

// Перетаскивание панели (вместе с настройками) за «ручку».
function enableDrag() {
  $('#grip').addEventListener('pointerdown', (e) => {
    const r = dock.getBoundingClientRect();
    const dx = e.clientX - r.left;
    const dy = e.clientY - r.top;
    dock.style.transform = 'none';
    const onMove = (ev) => {
      dock.style.left = `${Math.max(0, Math.min(innerWidth - r.width, ev.clientX - dx))}px`;
      dock.style.top = `${Math.max(0, Math.min(innerHeight - r.height, ev.clientY - dy))}px`;
    };
    const onUp = () => {
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      syncPassThrough();
    };
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
  });
}

export function initToolbar(toolList) {
  tools = toolList;
  buildGroups();
  relabelToolbar();
  refreshToolbar();
  enableDrag();
  $('#shot-btn').append(toolIcon({ iconPath: CAMERA }));
  $('#shot-btn').addEventListener('click', takeScreenshot);
  $('#undo').addEventListener('click', undo);
  $('#redo').addEventListener('click', redo);
  $('#clear').addEventListener('click', clearAll);
  $('#mode').addEventListener('click', toggleMode);
  $('#hide').addEventListener('click', () => api.hide());
}
