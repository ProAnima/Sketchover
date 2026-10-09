import { state } from './state.js';

const LIMIT = 200;
// И по объёму: длинные штрихи кистью — тысячи точек, 200 полных копий холста заняли бы сотни МБ.
const MAX_CHARS = 50_000_000;
const stackChars = () => undoStack.reduce((sum, json) => sum + json.length, 0);
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
  while (undoStack.length > LIMIT || (undoStack.length > 1 && stackChars() > MAX_CHARS)) undoStack.shift();
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
