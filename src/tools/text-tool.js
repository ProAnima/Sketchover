import { state } from '../core/state.js';
import { createShape, topmostAt } from '../core/shapes.js';

export function createTextTool(meta, host) {
  return {
    ...meta,
    down(x, y) {
      // По существующему тексту или блоку — правка, а не новый текст поверх.
      const existing = topmostAt(x, y, (t) => t.type === 'text' || t.type === 'node');
      if (existing) {
        host.edit(existing);
        return;
      }
      const s = createShape('text', x, y);
      state.shapes.push(s);
      host.edit(s);
    },
    move() {},
    up() {},
  };
}
