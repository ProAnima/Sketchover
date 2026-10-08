import { state } from '../core/state.js';
import { commit, undo as undoHistory, redo as redoHistory } from '../core/history.js';
import { removeShape, selected } from '../core/shapes.js';
import { finishEdit } from './editor.js';
import { render } from './canvas.js';

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
  state.shapes = [];
  state.sel = null;
  commit();
  render();
}

export function deleteSelected() {
  const s = selected();
  if (!s) return;
  removeShape(s);
  commit();
  render();
}
