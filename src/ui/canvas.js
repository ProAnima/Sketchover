import { state } from '../core/state.js';
import { selected, isBox, canRotate, resolveLine, bounds, layoutText, setTextMeasurer, ROTATE_HANDLE_OFFSET, CODE_PAD } from '../core/shapes.js';
import { getImage } from '../core/images.js';

export const canvas = document.querySelector('#board');
const ctx = canvas.getContext('2d');
const LASER_LIFETIME_MS = 700;

setTextMeasurer((font, line) => {
  ctx.font = font;
  return ctx.measureText(line).width;
});

function drawArrowHead(x1, y1, x2, y2, width) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const len = 12 + width * 2.5;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - len * Math.cos(ang - 0.4), y2 - len * Math.sin(ang - 0.4));
  ctx.lineTo(x2 - len * Math.cos(ang + 0.4), y2 - len * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fill();
}

// Markdown-текст: цвет берётся из ctx.fillStyle; свободный текст обводится для читаемости на любом фоне.
function drawText(s, x, y, align) {
  const layout = layoutText(s);
  const fill = ctx.fillStyle;
  const outline = s.type === 'text' ? (s.color === '#111111' ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.55)') : null;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let ly = y;
  for (const line of layout.lines) {
    // По центру — весь текст как целое; строки внутри выровнены по левому краю (так ровнее списки).
    let lx = align === 'center' ? x - layout.w / 2 : x;
    for (const run of line.runs) {
      const pad = run.code ? CODE_PAD : 0;
      if (run.code) {
        ctx.fillStyle = 'rgba(127,127,127,.3)';
        ctx.beginPath();
        ctx.roundRect(lx, ly - 1, run.w, line.size * 1.15, 4);
        ctx.fill();
        ctx.fillStyle = fill;
      }
      ctx.font = run.font;
      if (outline) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = outline;
        ctx.strokeText(run.text, lx + pad, ly);
      }
      ctx.fillText(run.text, lx + pad, ly);
      if (run.strike) ctx.fillRect(lx + pad, ly + line.size * 0.55, run.w - pad * 2, Math.max(1, line.size / 14));
      lx += run.w;
    }
    ly += line.h;
  }
}

function drawPen(s) {
  const p = s.points;
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  if (p.length === 1) ctx.lineTo(p[0].x + 0.01, p[0].y);
  for (let i = 1; i < p.length - 1; i++) {
    ctx.quadraticCurveTo(p[i].x, p[i].y, (p[i].x + p[i + 1].x) / 2, (p[i].y + p[i + 1].y) / 2);
  }
  if (p.length > 1) ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
  ctx.stroke();
}

function drawShape(s) {
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (s.type) {
    case 'pen':
      drawPen(s);
      break;
    case 'line':
    case 'arrow': {
      const l = resolveLine(s);
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
      if (s.type === 'arrow') drawArrowHead(l.x1, l.y1, l.x2, l.y2, s.width);
      break;
    }
    case 'rect':
      ctx.strokeRect(s.x, s.y, s.w, s.h);
      break;
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'node':
      ctx.beginPath();
      ctx.roundRect(s.x, s.y, s.w, s.h, 12);
      ctx.fillStyle = 'rgba(20,20,24,.9)';
      ctx.fill();
      ctx.stroke();
      if (s !== state.editing) {
        ctx.fillStyle = '#fff';
        drawText(s, s.x + s.w / 2, s.y + (s.h - layoutText(s).h) / 2, 'center');
      }
      break;
    case 'text':
      if (s !== state.editing) drawText(s, s.x, s.y, 'left');
      break;
    case 'image':
      drawImageShape(s);
      break;
    default:
  }
  ctx.restore();
}

// Начало координат — в центре фигуры, оси повёрнуты вместе с ней.
function enterShape(s) {
  ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
  ctx.rotate(s.rotation || 0);
}

function drawImageShape(s) {
  const image = getImage(s.imageId);
  if (!image) return;
  enterShape(s);
  ctx.shadowColor = 'rgba(0,0,0,.45)';
  ctx.shadowBlur = 14;
  ctx.drawImage(image, -s.w / 2, -s.h / 2, s.w, s.h);
}

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
  enterShape(s);
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
  state.shapes.forEach(drawShape);
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

