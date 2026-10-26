import { state, NODE_SIZE } from '../core/state.js';
import { createShape, isLine, isStroke, attachAt, removeShape, topmostAt, getShape, hit } from '../core/shapes.js';

// Инструмент «протяни фигуру»: кисть, маркер, линия, стрелка, прямоугольник, эллипс, нода.
export function createShapeTool(meta, host) {
  let drag = null; // { shape, x, y }

  function finish(s, x, y) {
    if (isLine(s)) {
      s.to = attachAt(x, y)?.id ?? null;
      // Начало и конец в одном блоке — не связь: стрелка схлопнулась бы в его центр.
      if (s.to === s.from) s.to = null;
      const from = s.from != null ? getShape(s.from) : null;
      // Клик стрелкой (или короткий штрих внутри блока либо скриншота) — не стрелка:
      // иначе внутри осталась бы чёрточка или одинокий наконечник.
      const junk = !s.to && (Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < 4 || (from && hit(from, s.x2, s.y2)));
      if (junk) removeShape(s);
    } else if (s.type === 'node') {
      if (s.w < 10 || s.h < 10) Object.assign(s, { x: s.x - NODE_SIZE.w / 2, y: s.y - NODE_SIZE.h / 2, ...NODE_SIZE });
      host.edit(s); // commit произойдёт по завершении правки
    } else if ((s.type === 'rect' || s.type === 'ellipse') && (s.w < 4 || s.h < 4)) removeShape(s);
  }

  return {
    ...meta,
    down(x, y) {
      // Инструмент «Блок» по существующему блоку — правит его текст, а не кладёт новый сверху.
      const existing = meta.id === 'node' && topmostAt(x, y, (t) => t.type === 'node');
      if (existing) {
        host.edit(existing);
        return;
      }
      const s = createShape(meta.id, x, y);
      if (isLine(s)) s.from = attachAt(x, y)?.id ?? null;
      state.shapes.push(s);
      drag = { shape: s, x, y };
      host.render();
    },
    move(x, y) {
      if (!drag) return;
      const s = drag.shape;
      if (isStroke(s)) s.points.push({ x, y });
      else if (isLine(s)) Object.assign(s, { x2: x, y2: y });
      else Object.assign(s, { x: Math.min(drag.x, x), y: Math.min(drag.y, y), w: Math.abs(x - drag.x), h: Math.abs(y - drag.y) });
      host.render();
    },
    up(x, y) {
      if (!drag) return;
      const { shape } = drag;
      drag = null;
      finish(shape, x, y);
    },
  };
}
