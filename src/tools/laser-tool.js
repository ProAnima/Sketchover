import { state } from '../core/state.js';

export function createLaserTool(meta, host) {
  // start — первая точка штриха: с предыдущим (ещё угасающим) штрихом её не соединяем.
  const point = (x, y, start = false) => state.laser.points.push({ x, y, t: performance.now(), start });
  return {
    ...meta,
    down(x, y) { state.laser.active = true; point(x, y, true); host.render(); },
    move(x, y) { if (state.laser.active) { point(x, y); host.render(); } },
    up() { state.laser.active = false; },
  };
}
