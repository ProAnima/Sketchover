import { state } from '../core/state.js';
import { selected, isBox, canRotate, bounds, setTextMeasurer, ROTATE_HANDLE_OFFSET } from '../core/shapes.js';
import { drawShape, enterShape } from './shapes-draw.js';

export const canvas = document.querySelector('#board');
const ctx = canvas.getContext('2d');
const LASER_LIFETIME_MS = 700;

setTextMeasurer((font, line) => {
  ctx.font = font;
  return ctx.measureText(line).width;
});

function drawSelection(s) {
  ctx.save();
  ctx.strokeStyle = '#0a84ff';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  if (!isBox(s)) {
    const b = bounds(s);
    ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
    ctx.restore();
    return;
  }
  // Рамка и ручки — в системе фигуры: совпадают с handles() из core/shapes.js.
  enterShape(ctx, s);
  const hw = s.w / 2;
  const hh = s.h / 2;
  ctx.strokeRect(-hw - 6, -hh - 6, s.w + 12, s.h + 12);
  ctx.setLineDash([]);
  ctx.fillStyle = '#fff';
  ctx.fillRect(hw - 5, hh - 5, 10, 10);
  ctx.strokeRect(hw - 5, hh - 5, 10, 10);
  if (canRotate(s)) {
    ctx.beginPath();
    ctx.moveTo(0, -hh - 6);
    ctx.lineTo(0, -hh - ROTATE_HANDLE_OFFSET + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -hh - ROTATE_HANDLE_OFFSET, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawLaser(now) {
  const pts = state.laser.points;
  while (pts.length && now - pts[0].t > LASER_LIFETIME_MS) pts.shift();
  for (let i = 1; i < pts.length; i++) {
    const age = (now - pts[i].t) / LASER_LIFETIME_MS;
    ctx.save();
    ctx.strokeStyle = `rgba(255,59,48,${1 - age})`;
    ctx.lineWidth = 3 + 6 * (1 - age);
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(255,59,48,.9)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
    ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.restore();
  }
  if (pts.length && state.laser.active) {
    const p = pts[pts.length - 1];
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paint() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const s of state.shapes) drawShape(ctx, s, state.editing);
  const sel = selected();
  if (sel && state.tool === 'select' && sel !== state.editing) drawSelection(sel);
  if (state.laser.points.length) {
    drawLaser(performance.now());
    render(); // пока след лазера не угас — анимируем
  }
}

// Перерисовка не чаще одного раза за кадр; в простое кадры не рисуются.
let frame = 0;
export function render() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    paint();
  });
}

export function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}

