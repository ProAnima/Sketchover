export const COLORS = ['#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#0a84ff', '#bf5af2', '#ffffff', '#111111'];
export const WIDTHS = [3, 6, 10];
export const NODE_SIZE = { w: 150, h: 56 };
// Режим доски: фон вместо экрана. Тёмная — не чёрная: на ней видны и тёмные цвета, кроме самого тёмного.
export const BOARDS = { white: '#ffffff', black: '#1e2127' };

// Единственное место общего состояния; меняется через функции модулей.
export const state = {
  tool: 'pen',
  color: COLORS[0],
  width: WIDTHS[0],
  mode: 'draw', // 'draw' | 'pass'
  shapes: [],
  sel: null, // id выбранной фигуры
  editing: null, // фигура, чей текст сейчас правится
  laser: { points: [], active: false, pos: null },
  board: null, // null | 'white' | 'black'
  fade: false, // исчезающие рисунки
  fading: [], // [{ shape, since }] — угасают, в историю и файл не попадают
};

let lastId = 0;
export const newId = () => ++lastId;
// После открытия файла новые фигуры не должны получить id уже существующих.
export const reserveIds = (maxId) => { lastId = Math.max(lastId, maxId); };
