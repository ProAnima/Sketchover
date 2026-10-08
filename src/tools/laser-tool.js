import { state } from '../core/state.js';

export function createLaserTool(meta, host) {
  const point = (x, y) => state.laser.points.push({ x, y, t: performance.now() });
  return {
    ...meta,
    down(x, y) { state.laser.active = true; point(x, y); host.render(); },
    move(x, y) { if (state.laser.active) { point(x, y); host.render(); } },
    up() { state.laser.active = false; },
  };
}
