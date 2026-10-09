import { state } from '../core/state.js';
import { handles, move, rotatePoint, selected, toWorld, topmostAt } from '../core/shapes.js';

const HANDLE_RADIUS = 10;
const near = (p, x, y) => p && Math.hypot(x - p.x, y - p.y) < HANDLE_RADIUS;

export function createSelectTool(meta, host) {
  let drag = null; // { kind: 'move' | 'resize' | 'rotate', shape, ... }

  function startHandleDrag(sel, x, y) {
    const h = handles(sel);
    if (!h) return null;
    if (near(h.rotate, x, y)) return { kind: 'rotate', shape: sel };
    if (!near(h.resize, x, y)) return null;
    // Масштаб от противоположного угла: он остаётся на месте и при повороте.
    // У скриншота сохраняем пропорции — иначе картинка искажается.
    return { kind: 'resize', shape: sel, anchor: toWorld(sel, sel.x, sel.y), aspect: sel.type === 'image' ? sel.h / sel.w : null };
  }

  function resize(d, x, y) {
    const s = d.shape;
    const angle = s.rotation || 0;
    const local = rotatePoint(x, y, d.anchor.x, d.anchor.y, -angle);
    const w = Math.max(20, local.x - d.anchor.x);
    const h = d.aspect ? w * d.aspect : Math.max(20, local.y - d.anchor.y);
    const center = rotatePoint(d.anchor.x + w / 2, d.anchor.y + h / 2, d.anchor.x, d.anchor.y, angle);
    Object.assign(s, { x: center.x - w / 2, y: center.y - h / 2, w, h });
  }

  function rotate(s, x, y) {
    const angle = Math.atan2(y - (s.y + s.h / 2), x - (s.x + s.w / 2)) + Math.PI / 2;
    // Прилипание к шагу 15°, если рядом: ровно поставить легче.
    const step = Math.PI / 12;
    const snapped = Math.round(angle / step) * step;
    s.rotation = Math.abs(angle - snapped) < 0.05 ? snapped : angle;
  }

  return {
    ...meta,
    down(x, y) {
      const sel = selected();
      drag = sel && startHandleDrag(sel, x, y);
      if (!drag) {
        const s = topmostAt(x, y);
        state.sel = s ? s.id : null;
        drag = s ? { kind: 'move', shape: s, x, y } : null;
      }
      host.render();
    },
    move(x, y) {
      if (!drag) return;
      if (drag.kind === 'move') {
        move(drag.shape, x - drag.x, y - drag.y);
        drag.x = x;
        drag.y = y;
      } else if (drag.kind === 'resize') resize(drag, x, y);
      else rotate(drag.shape, x, y);
      host.render();
    },
    up() {
      drag = null;
    },
  };
}
