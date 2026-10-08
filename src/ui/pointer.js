import { state } from '../core/state.js';
import { commit, undo, version } from '../core/history.js';
import { getShape, topmostAt } from '../core/shapes.js';
import { canvas, render } from './canvas.js';
import { editText, finishEdit } from './editor.js';

const editableAt = (x, y) => topmostAt(x, y, (s) => s.type === 'node' || s.type === 'text');
// Двойной клик считаем сами: у pointerdown счётчик кликов (detail) по спецификации всегда 0.
const DOUBLE_MS = 400;
const DOUBLE_PX = 6;

// Передаёт события мыши активному инструменту.
export function initPointer(tools) {
  const current = () => tools.find((t) => t.id === state.tool);
  let active = null; // инструмент, получивший pointerdown
  let lastClick = null; // версии истории до и после предыдущего клика
  let lastDown = null; // время и место предыдущего нажатия

  // Двойной клик по блоку или тексту — правка текста любым инструментом.
  function editOnDoubleClick(x, y) {
    const target = editableAt(x, y);
    if (!target) return false;
    if (state.editing === target) return true;
    finishEdit();
    // Первый клик мог что-то нарисовать (например, точку кистью) — откатываем это.
    const id = target.id;
    if (lastClick && lastClick.after !== lastClick.before && version() === lastClick.after) undo();
    const s = getShape(id); // после отката фигуры — новые объекты, ищем по id
    if (s) editText(s);
    render();
    return true;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (state.mode !== 'draw' || e.button !== 0) return;
    const double = lastDown && e.timeStamp - lastDown.t < DOUBLE_MS
      && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < DOUBLE_PX;
    lastDown = double ? null : { t: e.timeStamp, x: e.clientX, y: e.clientY };
    if (double && editOnDoubleClick(e.clientX, e.clientY)) return;
    finishEdit();
    canvas.setPointerCapture(e.pointerId);
    lastClick = { before: version(), after: null };
    active = current();
    active.down(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (active) active.move(e.clientX, e.clientY);
  });

  const end = (e) => {
    if (!active) return;
    const tool = active;
    active = null;
    tool.up(e.clientX, e.clientY);
    if (!state.editing) commit(); // при правке текста commit будет в finishEdit
    if (lastClick) lastClick.after = version();
    render();
  };
  canvas.addEventListener('pointerup', end);
  // Жест может прерваться системой (смена фокуса, сенсорный ввод) — завершаем, чтобы инструмент не «залип».
  canvas.addEventListener('pointercancel', end);
}
