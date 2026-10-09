// Рисование фигур в любой 2D-контекст: экранный холст (canvas.js) и картинку для экспорта (export.js).
import { resolveLine, layoutText, CODE_PAD } from '../core/shapes.js';
import { getImage } from '../core/images.js';

function drawArrowHead(c, x1, y1, x2, y2, width) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const len = 12 + width * 2.5;
  c.beginPath();
  c.moveTo(x2, y2);
  c.lineTo(x2 - len * Math.cos(ang - 0.4), y2 - len * Math.sin(ang - 0.4));
  c.lineTo(x2 - len * Math.cos(ang + 0.4), y2 - len * Math.sin(ang + 0.4));
  c.closePath();
  c.fill();
}

// Markdown-текст: цвет берётся из c.fillStyle; свободный текст обводится для читаемости на любом фоне.
function drawText(c, s, x, y, align) {
  const layout = layoutText(s);
  const fill = c.fillStyle;
  const outline = s.type === 'text' ? (s.color === '#111111' ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.55)') : null;
  c.textAlign = 'left';
  c.textBaseline = 'top';
  let ly = y;
  for (const line of layout.lines) {
    // По центру — весь текст как целое; строки внутри выровнены по левому краю (так ровнее списки).
    let lx = align === 'center' ? x - layout.w / 2 : x;
    for (const run of line.runs) {
      const pad = run.code ? CODE_PAD : 0;
      if (run.code) {
        c.fillStyle = 'rgba(127,127,127,.3)';
        c.beginPath();
        c.roundRect(lx, ly - 1, run.w, line.size * 1.15, 4);
        c.fill();
        c.fillStyle = fill;
      }
      c.font = run.font;
      if (outline) {
        c.lineWidth = 4;
        c.strokeStyle = outline;
        c.strokeText(run.text, lx + pad, ly);
      }
      c.fillText(run.text, lx + pad, ly);
      if (run.strike) c.fillRect(lx + pad, ly + line.size * 0.55, run.w - pad * 2, Math.max(1, line.size / 14));
      lx += run.w;
    }
    ly += line.h;
  }
}

function drawPen(c, s) {
  const p = s.points;
  c.beginPath();
  c.moveTo(p[0].x, p[0].y);
  if (p.length === 1) c.lineTo(p[0].x + 0.01, p[0].y);
  for (let i = 1; i < p.length - 1; i++) {
    c.quadraticCurveTo(p[i].x, p[i].y, (p[i].x + p[i + 1].x) / 2, (p[i].y + p[i + 1].y) / 2);
  }
  if (p.length > 1) c.lineTo(p[p.length - 1].x, p[p.length - 1].y);
  c.stroke();
}

// Начало координат — в центре фигуры, оси повёрнуты вместе с ней.
export function enterShape(c, s) {
  c.translate(s.x + s.w / 2, s.y + s.h / 2);
  c.rotate(s.rotation || 0);
}

function drawImageShape(c, s) {
  const image = getImage(s.imageId);
  if (!image) return;
  enterShape(c, s);
  c.shadowColor = 'rgba(0,0,0,.45)';
  c.shadowBlur = 14;
  c.drawImage(image, -s.w / 2, -s.h / 2, s.w, s.h);
}

// editing — фигура, чей текст сейчас в поле ввода: её текст не рисуем, чтобы не двоился.
export function drawShape(c, s, editing = null) {
  c.save();
  c.strokeStyle = s.color;
  c.fillStyle = s.color;
  c.lineWidth = s.width;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  switch (s.type) {
    case 'pen':
      drawPen(c, s);
      break;
    case 'line':
    case 'arrow': {
      const l = resolveLine(s);
      c.beginPath();
      c.moveTo(l.x1, l.y1);
      c.lineTo(l.x2, l.y2);
      c.stroke();
      if (s.type === 'arrow') drawArrowHead(c, l.x1, l.y1, l.x2, l.y2, s.width);
      break;
    }
    case 'rect':
      c.strokeRect(s.x, s.y, s.w, s.h);
      break;
    case 'ellipse':
      c.beginPath();
      c.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
      c.stroke();
      break;
    case 'node':
      c.beginPath();
      c.roundRect(s.x, s.y, s.w, s.h, 12);
      c.fillStyle = 'rgba(20,20,24,.9)';
      c.fill();
      c.stroke();
      if (s !== editing) {
        c.fillStyle = '#fff';
        drawText(c, s, s.x + s.w / 2, s.y + (s.h - layoutText(s).h) / 2, 'center');
      }
      break;
    case 'text':
      if (s !== editing) drawText(c, s, s.x, s.y, 'left');
      break;
    case 'image':
      drawImageShape(c, s);
      break;
    default:
  }
  c.restore();
}
