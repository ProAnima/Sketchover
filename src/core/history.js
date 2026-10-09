import { state } from './state.js';

const LIMIT = 200;
let committed = '[]';
let revision = 0;
// Растёт при каждом изменении истории — по нему видно, менял ли что-то конкретный клик.
export const version = () => revision;
const undoStack = [];
const redoStack = [];

export function commit() {
  const now = JSON.stringify(state.shapes);
  if (now === committed) return;
  undoStack.push(committed);
  if (undoStack.length > LIMIT) undoStack.shift();
  redoStack.length = 0;
  committed = now;
  revision++;
}

function restore(json) {
  state.shapes = JSON.parse(json);
  committed = json;
  state.sel = null;
  revision++;
}

// Id картинок, на которые ссылаются холст и вся история отмены/повтора.
export function referencedImageIds() {
  const ids = new Set();
  for (const json of [committed, ...undoStack, ...redoStack]) {
    for (const m of json.matchAll(/"imageId":"([^"]+)"/g)) ids.add(m[1]);
  }
  return ids;
}

// Возвращают true, если состояние изменилось.
export function undo() {
  if (!undoStack.length) return false;
  redoStack.push(committed);
  restore(undoStack.pop());
  return true;
}
export function redo() {
  if (!redoStack.length) return false;
  undoStack.push(committed);
  restore(redoStack.pop());
  return true;
}
