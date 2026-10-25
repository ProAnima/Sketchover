import { state } from '../core/state.js';
import { commit, undo as undoHistory, redo as redoHistory } from '../core/history.js';
import { removeShape, selected } from '../core/shapes.js';
import { finishEdit } from './editor.js';
import { render } from './canvas.js';
import { showToast } from './toast.js';
import { firstKeyText } from './shortcuts.js';
import { t } from '../i18n/index.js';

export function undo() {
  finishEdit();
  if (undoHistory()) render();
}

export function redo() {
  finishEdit();
  if (redoHistory()) render();
}

export function clearAll() {
  finishEdit();
  const had = state.shapes.length > 0;
  state.shapes = [];
  state.fading = [];
  state.sel = null;
  commit();
  render();
  // Очистка мгновенная — сказать, что её можно отменить.
  if (had) showToast(t('toast.cleared', { undo: firstKeyText('undo') }));
}

export function deleteSelected() {
  const s = selected();
  if (!s) return;
  removeShape(s);
  commit();
  render();
}
