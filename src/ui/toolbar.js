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
import { copyImage, saveScene, openScene } from './export.js';
import { keysText, labelOf, firstKeyText } from './shortcuts.js';
import { showToast, hideToast } from './toast.js';

const COPY = 'M8 3h9a2 2 0 0 1 2 2v11h-2V5H8zM5 7h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm0 2v10h9V9z';
const SAVE = 'M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 2v4h8V5zm5 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z';
const OPEN = 'M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z';
// Исчезающие рисунки — точки гаснут слева направо; доска — лист на подставке.
const FADE = 'M3 12a3.2 3.2 0 1 0 6.4 0 3.2 3.2 0 1 0-6.4 0zm8.3 0a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 1 0-4.4 0zm6.4 0a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 1 0-2.6 0z';
const BOARD = 'M3 4h18v12H3zm1.6 1.6v8.8h14.8V5.6zM11.2 16h1.6v2.2l3 2.8h-2.2l-1.6-1.5-1.6 1.5H8.2l3-2.8z';
const FADE_KEY = 'sketchover.fade';
const CAMERA = 'M9 4 7.5 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.5L15 4zm3 4.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z';

const $ = (s) => document.querySelector(s);
const dock = $('#dock');
// Кнопки панели и их действия в реестре клавиш (shortcuts.js).
const BUTTON_KEYS = {
  undo: 'undo', redo: 'redo', clear: 'clear', mode: 'pass', 'help-toggle': 'help',
  'shot-btn': 'shot', 'copy-btn': 'copy', 'save-btn': 'save', 'open-btn': 'open', 'fade-btn': 'fade',
};
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

/** Исчезающие рисунки вкл/выкл; выбор помнится между запусками. */
export function toggleFade() {
  state.fade = !state.fade;
  try { localStorage.setItem(FADE_KEY, state.fade ? '1' : '0'); } catch { /* без памяти — не страшно */ }
  refreshToolbar();
  // Включили клавишей случайно — без подсказки непонятно, почему рисунки пропадают.
  showToast(state.fade ? t('toast.fadeOn', { key: firstKeyText('fade') }) : t('toast.fadeOff'));
}

/** Доска нужного цвета; та же ещё раз — убрать. Видна только в режиме рисования. */
export function toggleBoard(kind) {
  state.board = state.board === kind ? null : kind;
  if (state.board && state.mode !== 'draw') setMode('draw');
  refreshToolbar();
  render();
  // Доска закрывает экран целиком — сразу сказать, как вернуть его.
  if (state.board) {
    const board = t(state.board === 'white' ? 'toolbar.boardWhite' : 'toolbar.boardBlack');
    showToast(t('toast.board', { board, key: firstKeyText(`board.${state.board}`), esc: firstKeyText('pass') }));
  } else {
    hideToast(); // подсказка «как убрать доску» больше не нужна
  }
}

// Кнопка доски по кругу: нет → белая → тёмная → нет.
const cycleBoard = () => toggleBoard(state.board === null ? 'white' : state.board === 'white' ? 'black' : state.board);

function refreshToolbar() {
  $('#fade-btn').classList.toggle('active', state.fade);
  $('#board-btn').classList.toggle('active', state.board !== null);
  $('#board-btn').dataset.board = state.board ?? '';
  document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === state.tool));
  document.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('active', b.dataset.color === state.color));
  document.querySelectorAll('[data-width]').forEach((b) => b.classList.toggle('active', Number(b.dataset.width) === state.width));
}

// Подсказки с параметрами (клавиша, номер) — их нельзя задать статично в разметке.
export function relabelToolbar() {
  tools.forEach((tool) => { $(`[data-tool="${tool.id}"]`).title = `${t(tool.label)} (${keysText(`tool.${tool.id}`)})`; });
  COLORS.forEach((c, i) => { $(`[data-color="${c}"]`).title = `${t('toolbar.color', { n: i + 1 })} (${keysText(`color.${i + 1}`)})`; });
  WIDTHS.forEach((w, i) => { $(`[data-width="${w}"]`).title = `${t('toolbar.width', { n: w })} (${keysText(`width.${i + 1}`)})`; });
  // Кнопки с клавишами: подпись из словаря, клавиша — текущая.
  for (const [id, action] of Object.entries(BUTTON_KEYS)) $(`#${id}`).title = `${labelOf(action)} (${keysText(action)})`;
  $('#board-btn').title = `${t('toolbar.board')} (${keysText('board.white')} · ${keysText('board.black')})`;
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
  try { state.fade = localStorage.getItem(FADE_KEY) === '1'; } catch { /* приватный режим и т. п. */ }
  buildGroups();
  relabelToolbar();
  refreshToolbar();
  enableDrag();
  $('#shot-btn').append(toolIcon({ iconPath: CAMERA }));
  $('#shot-btn').addEventListener('click', takeScreenshot);
  for (const [id, path, action] of [['#copy-btn', COPY, copyImage], ['#save-btn', SAVE, saveScene], ['#open-btn', OPEN, openScene]]) {
    $(id).append(toolIcon({ iconPath: path }));
    $(id).addEventListener('click', action);
  }
  $('#fade-btn').append(toolIcon({ iconPath: FADE }));
  $('#fade-btn').addEventListener('click', toggleFade);
  $('#board-btn').append(toolIcon({ iconPath: BOARD }));
  $('#board-btn').addEventListener('click', cycleBoard);
  $('#undo').addEventListener('click', undo);
  $('#redo').addEventListener('click', redo);
  $('#clear').addEventListener('click', clearAll);
  $('#mode').addEventListener('click', toggleMode);
  $('#hide').addEventListener('click', () => api.hide());
}
