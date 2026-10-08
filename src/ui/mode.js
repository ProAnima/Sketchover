import { state } from '../core/state.js';
import { t } from '../i18n/index.js';
import { api } from './api.js';
import { finishEdit } from './editor.js';

const dock = document.querySelector('#dock');

// В сквозном режиме клики уходят в окна под холстом, кроме области панели —
// Rust-сторона сама следит за курсором, ей нужен только прямоугольник панели.
export function syncPassThrough() {
  const r = dock.getBoundingClientRect();
  api.setPassThrough(state.mode === 'pass', { x: r.x, y: r.y, w: r.width, h: r.height });
}
new ResizeObserver(syncPassThrough).observe(dock);

export function relabelMode() {
  document.querySelector('#mode').textContent = t(state.mode === 'draw' ? 'mode.draw' : 'mode.pass');
}

export function setMode(mode) {
  finishEdit();
  state.mode = mode;
  document.body.className = `mode-${mode}`;
  relabelMode();
  if (mode === 'draw') api.focus();
  syncPassThrough();
}

export const toggleMode = () => setMode(state.mode === 'draw' ? 'pass' : 'draw');
