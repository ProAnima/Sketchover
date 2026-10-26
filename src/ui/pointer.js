import { state } from '../core/state.js';
import { commit, undo, version, clearRedo } from '../core/history.js';
import { getShape, topmostAt } from '../core/shapes.js';
import { splitFading } from '../core/fade.js';
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
  let pointerId = null; // указатель этого жеста: второе касание (сенсорный экран, перо) не вмешивается
  let lastClick = null; // версии истории до и после предыдущего клика
  let lastDown = null; // время и место предыдущего нажатия
  let before = new Set(); // id фигур до жеста

  // Исчезающие рисунки: новые линии и фигуры жеста уходят с холста в угасание — без истории.
  function moveToFading() {
    const { kept, fading } = splitFading(state.shapes, before);
    if (!fading.length) return;
    state.shapes = kept;
    const since = performance.now();
    state.fading.push(...fading.map((shape) => ({ shape, since })));
  }

  // Двойной клик по блоку или тексту — правка текста любым инструментом.
  function editOnDoubleClick(x, y) {
    const target = editableAt(x, y);
    if (!target) return false;
    if (state.editing === target) return true;
    finishEdit();
    // Первый клик мог что-то нарисовать (например, точку кистью) — откатываем это.
    const id = target.id;
    if (lastClick && lastClick.after !== lastClick.before && version() === lastClick.after) {
      undo();
      clearRedo(); // случайную точку не должен возвращать и повтор
    }
    const s = getShape(id); // после отката фигуры — новые объекты, ищем по id
    if (s) editText(s);
    render();
    return true;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (state.mode !== 'draw' || e.button !== 0) return;
    if (active && e.pointerId !== pointerId) return; // второе касание во время жеста
    if (active) end(e); // тот же указатель — прошлый жест не завершился: закрываем его
    // Мышь на холсте — наша. Без этого браузер после pointerdown переводит фокус на место
    // клика, и только что открытое поле ввода (инструмент «Текст», правка двойным кликом)
    // тут же закрывалось пустым. Фокус с панели и настроек снимаем сами — иначе клавиши
    // холста уходили бы туда.
    e.preventDefault();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    pointerId = e.pointerId;
    const double = lastDown && e.timeStamp - lastDown.t < DOUBLE_MS
      && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < DOUBLE_PX;
    lastDown = double ? null : { t: e.timeStamp, x: e.clientX, y: e.clientY };
    if (double && editOnDoubleClick(e.clientX, e.clientY)) return;
    finishEdit();
    canvas.setPointerCapture(e.pointerId);
    lastClick = { before: version(), after: null };
    // Что было до жеста: в режиме «исчезающие» гаснут только новые фигуры.
    before = new Set(state.shapes.map((s) => s.id));
    active = current();
    active.down(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!active || e.pointerId !== pointerId) return;
    // Кнопку отпустили вне холста (зажали клавишу удержания посреди штриха — окно стало
    // пропускать мышь): жест закончен, иначе кисть рисовала бы без нажатой кнопки.
    if (!(e.buttons & 1)) { end(e); return; }
    active.move(e.clientX, e.clientY);
  });

  function end(e) {
    if (!active || e.pointerId !== pointerId) return;
    const tool = active;
    active = null;
    tool.up(e.clientX, e.clientY);
    if (state.fade) moveToFading();
    if (!state.editing) commit(); // при правке текста commit будет в finishEdit
    if (lastClick) lastClick.after = version();
    render();
  }
  canvas.addEventListener('pointerup', end);
  // Жест может прерваться системой (смена фокуса, сенсорный ввод) — завершаем, чтобы инструмент не «залип».
  canvas.addEventListener('pointercancel', end);
}
