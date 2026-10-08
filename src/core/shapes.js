import { state, newId } from './state.js';
import { distToSegment, rectEdge } from './geometry.js';
import { parseLines } from './markdown.js';

// Измерение текста зависит от canvas — его подставляет слой отрисовки.
let measureWidth = () => 0;
export const setTextMeasurer = (fn) => { measureWidth = fn; };

export const getShape = (id) => state.shapes.find((s) => s.id === id);
export const selected = () => (state.sel == null ? null : getShape(state.sel));
export const isLine = (s) => s.type === 'line' || s.type === 'arrow';
export const isBox = (s) => s.type === 'rect' || s.type === 'ellipse' || s.type === 'node' || s.type === 'image';
// К чему цепляются концы стрелок и линий.
const canAttach = (s) => s.type === 'node' || s.type === 'image';
// Поворачивать можно скриншоты.
export const canRotate = (s) => s.type === 'image';

/* ---------- поворот вокруг центра фигуры ---------- */
const centerOf = (s) => ({ x: s.x + s.w / 2, y: s.y + s.h / 2 });

export function rotatePoint(px, py, cx, cy, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

// Точка в системе координат фигуры без поворота — и обратно.
export function toLocal(s, x, y) {
  const c = centerOf(s);
  return rotatePoint(x, y, c.x, c.y, -(s.rotation || 0));
}
export function toWorld(s, x, y) {
  const c = centerOf(s);
  return rotatePoint(x, y, c.x, c.y, s.rotation || 0);
}

// Ручки выделенной фигуры: масштаб — правый нижний угол, поворот — над серединой верхней стороны.
export const ROTATE_HANDLE_OFFSET = 24;
export function handles(s) {
  if (!isBox(s)) return null;
  return {
    resize: toWorld(s, s.x + s.w, s.y + s.h),
    rotate: canRotate(s) ? toWorld(s, s.x + s.w / 2, s.y - ROTATE_HANDLE_OFFSET) : null,
  };
}

// Точка на границе фигуры в направлении (tx, ty) с учётом поворота.
function edgePoint(n, tx, ty) {
  const t = toLocal(n, tx, ty);
  const p = rectEdge(n, t.x, t.y);
  return toWorld(n, p.x, p.y);
}

export const LINE_HEIGHT = 1.25;
// Отступ внутри фона `кода` с каждой стороны.
export const CODE_PAD = 4;
export const textFont = (s) => `${s.size}px system-ui, sans-serif`;

function runFont(px, run, lineBold) {
  const style = run.italic ? 'italic ' : '';
  const weight = run.bold || lineBold ? '700 ' : '';
  const family = run.code ? 'ui-monospace, Consolas, monospace' : 'system-ui, sans-serif';
  return `${style}${weight}${Math.round(px)}px ${family}`;
}

// Раскладка Markdown-текста: строки из кусков с шрифтом и шириной. Кэш — чтобы не мерить
// одно и то же каждый кадр; ключ — всё, от чего зависит результат.
const layoutCache = new Map();
export function layoutText(s) {
  const key = `${s.size}\u0000${s.text}`;
  const cached = layoutCache.get(key);
  if (cached) return cached;
  const lines = parseLines(s.text).map((line) => {
    const px = s.size * line.scale;
    const runs = (line.prefix ? [{ text: line.prefix }, ...line.runs] : line.runs).map((run) => {
      const font = runFont(px, run, line.bold);
      return { ...run, font, w: measureWidth(font, run.text) + (run.code ? CODE_PAD * 2 : 0) };
    });
    return { runs, size: px, w: runs.reduce((sum, r) => sum + r.w, 0), h: px * LINE_HEIGHT };
  });
  const layout = { lines, w: Math.max(10, ...lines.map((l) => l.w)), h: lines.reduce((sum, l) => sum + l.h, 0) };
  if (layoutCache.size > 500) layoutCache.clear();
  layoutCache.set(key, layout);
  return layout;
}

export function textSize(s) {
  const { w, h } = layoutText(s);
  return { w, h };
}

export function createShape(type, x, y) {
  const base = { id: newId(), type, color: state.color, width: state.width };
  switch (type) {
    case 'pen': return { ...base, points: [{ x, y }] };
    case 'line':
    case 'arrow': return { ...base, x1: x, y1: y, x2: x, y2: y, from: null, to: null };
    case 'text': return { ...base, x, y, text: '', size: 18 + state.width * 2 };
    case 'node': return { ...base, x, y, w: 0, h: 0, text: '', size: 18 };
    default: return { ...base, x, y, w: 0, h: 0 };
  }
}

export function createImageShape(imageId, x, y, w, h) {
  return { id: newId(), type: 'image', imageId, x, y, w, h, rotation: 0, color: state.color, width: state.width };
}

// Концы линии с учётом привязки к блокам и скриншотам.
export function resolveLine(s) {
  const a = s.from != null ? getShape(s.from) : null;
  const b = s.to != null ? getShape(s.to) : null;
  const aim2 = b ? centerOf(b) : { x: s.x2, y: s.y2 };
  const aim1 = a ? centerOf(a) : { x: s.x1, y: s.y1 };
  const p1 = a ? edgePoint(a, aim2.x, aim2.y) : { x: s.x1, y: s.y1 };
  const p2 = b ? edgePoint(b, aim1.x, aim1.y) : { x: s.x2, y: s.y2 };
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

export function hit(s, x, y, tol = 7) {
  switch (s.type) {
    case 'pen': {
      const r = tol + s.width / 2;
      const p = s.points;
      if (p.length === 1) return Math.hypot(x - p[0].x, y - p[0].y) <= r;
      for (let i = 1; i < p.length; i++) {
        if (distToSegment(x, y, p[i - 1].x, p[i - 1].y, p[i].x, p[i].y) <= r) return true;
      }
      return false;
    }
    case 'line':
    case 'arrow': {
      const l = resolveLine(s);
      return distToSegment(x, y, l.x1, l.y1, l.x2, l.y2) <= tol + s.width / 2;
    }
    case 'rect': {
      const inOuter = x >= s.x - tol && x <= s.x + s.w + tol && y >= s.y - tol && y <= s.y + s.h + tol;
      const inInner = x > s.x + tol && x < s.x + s.w - tol && y > s.y + tol && y < s.y + s.h - tol;
      return inOuter && !inInner;
    }
    case 'ellipse': {
      const rx = s.w / 2;
      const ry = s.h / 2;
      const r = Math.hypot((x - s.x - rx) / rx, (y - s.y - ry) / ry);
      return Math.abs(r - 1) <= tol / Math.max(1, Math.min(rx, ry));
    }
    case 'node':
      return x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;
    case 'image': {
      const p = toLocal(s, x, y);
      return p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h;
    }
    case 'text': {
      const t = textSize(s);
      return x >= s.x && x <= s.x + t.w && y >= s.y && y <= s.y + t.h;
    }
    default:
      return false;
  }
}

export function topmostAt(x, y, filter = () => true) {
  for (let i = state.shapes.length - 1; i >= 0; i--) {
    if (filter(state.shapes[i]) && hit(state.shapes[i], x, y)) return state.shapes[i];
  }
  return null;
}
export const attachAt = (x, y) => topmostAt(x, y, canAttach);

export function bounds(s) {
  if (isBox(s) && s.rotation) {
    const corners = [[s.x, s.y], [s.x + s.w, s.y], [s.x, s.y + s.h], [s.x + s.w, s.y + s.h]].map(([cx, cy]) => toWorld(s, cx, cy));
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  if (isBox(s)) return { x: s.x, y: s.y, w: s.w, h: s.h };
  if (s.type === 'text') return { x: s.x, y: s.y, ...textSize(s) };
  if (s.type === 'pen') {
    const xs = s.points.map((p) => p.x);
    const ys = s.points.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  const l = resolveLine(s);
  return { x: Math.min(l.x1, l.x2), y: Math.min(l.y1, l.y2), w: Math.abs(l.x2 - l.x1), h: Math.abs(l.y2 - l.y1) };
}

export function move(s, dx, dy) {
  if (s.type === 'pen') s.points.forEach((p) => { p.x += dx; p.y += dy; });
  else if (isLine(s)) {
    // Перемещённая линия отцепляется от нод, иначе она бы «вернулась» к ним.
    const l = resolveLine(s);
    Object.assign(s, { x1: l.x1 + dx, y1: l.y1 + dy, x2: l.x2 + dx, y2: l.y2 + dy, from: null, to: null });
  } else { s.x += dx; s.y += dy; }
}

export function removeShape(s) {
  for (const l of state.shapes) {
    if (!isLine(l) || (l.from !== s.id && l.to !== s.id)) continue;
    const r = resolveLine(l);
    Object.assign(l, { x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2 });
    if (l.from === s.id) l.from = null;
    if (l.to === s.id) l.to = null;
  }
  state.shapes = state.shapes.filter((x) => x !== s);
  if (state.sel === s.id) state.sel = null;
}
