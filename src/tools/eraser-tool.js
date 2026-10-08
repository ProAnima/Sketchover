import { removeShape, topmostAt } from '../core/shapes.js';

export function createEraserTool(meta, host) {
  let erasing = false;
  function eraseAt(x, y) {
    const s = topmostAt(x, y);
    if (!s) return;
    removeShape(s);
    host.render();
  }
  return {
    ...meta,
    down(x, y) { erasing = true; eraseAt(x, y); },
    move(x, y) { if (erasing) eraseAt(x, y); },
    up() { erasing = false; },
  };
}
