'use strict';

const api = window.sketchover;
const $ = (s) => document.querySelector(s);
const canvas = $('#board');
const ctx = canvas.getContext('2d');
const editor = $('#editor');
const toolbar = $('#toolbar');

const TOOLS = [
  { id: 'select', icon: '↖', label: 'Выбор / перемещение (V)', key: 'v' },
  { id: 'pen', icon: '✎', label: 'Карандаш (P)', key: 'p' },
  { id: 'line', icon: '╱', label: 'Линия (L)', key: 'l' },
  { id: 'arrow', icon: '➜', label: 'Стрелка (A). Цепляется к нодам', key: 'a' },
  { id: 'rect', icon: '▭', label: 'Прямоугольник (R)', key: 'r' },
  { id: 'ellipse', icon: '◯', label: 'Эллипс (O)', key: 'o' },
  { id: 'node', icon: '▣', label: 'Нода с текстом (N)', key: 'n' },
  { id: 'text', icon: 'T', label: 'Текст (T)', key: 't' },
  { id: 'laser', icon: '◉', label: 'Лазерная указка (K)', key: 'k' },
  { id: 'eraser', icon: '⌫', label: 'Ластик (E)', key: 'e' },
];
const COLORS = ['#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#0a84ff', '#bf5af2', '#ffffff', '#111111'];
const WIDTHS = [3, 6, 10];
const LASER_LIFETIME_MS = 700;
const NODE_SIZE = { w: 150, h: 56 };

const state = { tool: 'pen', color: COLORS[0], width: WIDTHS[0], mode: 'draw', shapes: [], sel: null };
let nextId = 1;
let drag = null; // активное действие мыши
let editing = null; // shape, чей текст сейчас правится
let overToolbar = false;
const laser = [];

/* ---------- история ---------- */
let committed = '[]';
const undoStack = [];
const redoStack = [];

function commit() {
  const now = JSON.stringify(state.shapes);
  if (now === committed) return;
  undoStack.push(committed);
  if (undoStack.length > 200) undoStack.shift();
  redoStack.length = 0;
  committed = now;
}
function restore(json) {
  state.shapes = JSON.parse(json);
  committed = json;
  state.sel = null;
  render();
}
function undo() {
  if (editing) finishEdit();
  if (!undoStack.length) return;
  redoStack.push(committed);
  restore(undoStack.pop());
}
function redo() {
  if (editing) finishEdit();
  if (!redoStack.length) return;
  undoStack.push(committed);
  restore(redoStack.pop());
}
function clearAll() {
  if (editing) finishEdit();
  state.shapes = [];
  state.sel = null;
  commit();
  render();
}

/* ---------- геометрия ---------- */
const getShape = (id) => state.shapes.find((s) => s.id === id);
const selected = () => (state.sel == null ? null : getShape(state.sel));
const isLine = (s) => s.type === 'line' || s.type === 'arrow';
const isBox = (s) => s.type === 'rect' || s.type === 'ellipse' || s.type === 'node';

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// Точка на границе прямоугольника в направлении (tx, ty) из центра.
function rectEdge(n, tx, ty) {
  const cx = n.x + n.w / 2;
  const cy = n.y + n.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const k = Math.max(Math.abs(dx) / (n.w / 2), Math.abs(dy) / (n.h / 2));
  return { x: cx + dx / k, y: cy + dy / k };
}

function resolveLine(s) {
  const a = s.from != null ? getShape(s.from) : null;
  const b = s.to != null ? getShape(s.to) : null;
  const aim2 = b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : { x: s.x2, y: s.y2 };
  const aim1 = a ? { x: a.x + a.w / 2, y: a.y + a.h / 2 } : { x: s.x1, y: s.y1 };
  const p1 = a ? rectEdge(a, aim2.x, aim2.y) : { x: s.x1, y: s.y1 };
  const p2 = b ? rectEdge(b, aim1.x, aim1.y) : { x: s.x2, y: s.y2 };
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

function textLines(s) {
  return String(s.text || '').split('\n');
}
function textFont(s) {
  return `${s.size}px system-ui, sans-serif`;
}
function textSize(s) {
  ctx.font = textFont(s);
  const w = Math.max(...textLines(s).map((l) => ctx.measureText(l).width), 10);
  return { w, h: textLines(s).length * s.size * 1.25 };
}

function hit(s, x, y, tol = 7) {
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
    case 'text': {
      const t = textSize(s);
      return x >= s.x && x <= s.x + t.w && y >= s.y && y <= s.y + t.h;
    }
    default:
      return false;
  }
}
function topmostAt(x, y, filter = () => true) {
  for (let i = state.shapes.length - 1; i >= 0; i--) {
    if (filter(state.shapes[i]) && hit(state.shapes[i], x, y)) return state.shapes[i];
  }
  return null;
}

function bounds(s) {
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

function move(s, dx, dy) {
  if (s.type === 'pen') s.points.forEach((p) => { p.x += dx; p.y += dy; });
  else if (isLine(s)) {
    // Перемещённая линия отцепляется от нод, иначе она бы «вернулась» к ним.
    const l = resolveLine(s);
    Object.assign(s, { x1: l.x1 + dx, y1: l.y1 + dy, x2: l.x2 + dx, y2: l.y2 + dy, from: null, to: null });
  } else { s.x += dx; s.y += dy; }
}

function removeShape(s) {
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

/* ---------- отрисовка ---------- */
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

function drawText(s, x, y, align) {
  ctx.font = textFont(s);
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  textLines(s).forEach((line, i) => {
    const ly = y + i * s.size * 1.25;
    if (s.type === 'text') {
      ctx.lineWidth = 4;
      ctx.strokeStyle = s.color === '#111111' ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.55)';
      ctx.strokeText(line, x, ly);
    }
    ctx.fillText(line, x, ly);
  });
}

function drawShape(s) {
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (s.type) {
    case 'pen': {
      const p = s.points;
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      if (p.length === 1) ctx.lineTo(p[0].x + 0.01, p[0].y);
      for (let i = 1; i < p.length - 1; i++) {
        ctx.quadraticCurveTo(p[i].x, p[i].y, (p[i].x + p[i + 1].x) / 2, (p[i].y + p[i + 1].y) / 2);
      }
      if (p.length > 1) ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
      ctx.stroke();
      break;
    }
    case 'line':
    case 'arrow': {
      const l = resolveLine(s);
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
      if (s.type === 'arrow') drawArrowHead(ctx, l.x1, l.y1, l.x2, l.y2, s.width);
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
      if (s !== editing) {
        ctx.fillStyle = '#fff';
        const t = textSize(s);
        drawText(s, s.x + s.w / 2, s.y + (s.h - t.h) / 2, 'center');
      }
      break;
    case 'text':
      if (s !== editing) drawText(s, s.x, s.y, 'left');
      break;
    default:
  }
  ctx.restore();
}

function drawSelection(s) {
  const b = bounds(s);
  ctx.save();
  ctx.strokeStyle = '#0a84ff';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
  if (isBox(s)) {
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    ctx.fillRect(s.x + s.w - 5, s.y + s.h - 5, 10, 10);
    ctx.strokeRect(s.x + s.w - 5, s.y + s.h - 5, 10, 10);
  }
  ctx.restore();
}

function drawLaser(now) {
  while (laser.length && now - laser[0].t > LASER_LIFETIME_MS) laser.shift();
  for (let i = 1; i < laser.length; i++) {
    const age = (now - laser[i].t) / LASER_LIFETIME_MS;
    ctx.save();
    ctx.strokeStyle = `rgba(255,59,48,${1 - age})`;
    ctx.lineWidth = 3 + 6 * (1 - age);
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(255,59,48,.9)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(laser[i - 1].x, laser[i - 1].y);
    ctx.lineTo(laser[i].x, laser[i].y);
    ctx.stroke();
    ctx.restore();
  }
  if (laser.length && drag && drag.kind === 'laser') {
    const p = laser[laser.length - 1];
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  state.shapes.forEach(drawShape);
  const sel = selected();
  if (sel && state.tool === 'select' && sel !== editing) drawSelection(sel);
  if (laser.length) {
    drawLaser(performance.now());
    requestAnimationFrame(render);
  }
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}

/* ---------- редактирование текста ---------- */
function editText(s) {
  editing = s;
  state.sel = s.id;
  const box = s.type === 'node' ? { x: s.x, y: s.y, w: s.w, h: s.h } : { x: s.x, y: s.y, w: Math.max(160, textSize(s).w + 24), h: textSize(s).h + 12 };
  Object.assign(editor.style, {
    left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px`,
    font: textFont(s), color: s.type === 'node' ? '#fff' : s.color,
    textAlign: s.type === 'node' ? 'center' : 'left',
  });
  editor.value = s.text;
  editor.hidden = false;
  api.focus();
  editor.focus();
  editor.select();
  render();
}
function finishEdit() {
  const s = editing;
  if (!s) return;
  editing = null;
  s.text = editor.value;
  editor.hidden = true;
  if (s.type === 'text' && !s.text.trim()) removeShape(s);
  if (s.type === 'node') s.w = Math.max(s.w, Math.ceil(textSize(s).w) + 28);
  commit();
  render();
}
editor.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
    e.preventDefault();
    finishEdit();
  }
});
editor.addEventListener('blur', finishEdit);

/* ---------- мышь ---------- */
function newShape(type, x, y) {
  const base = { id: nextId++, type, color: state.color, width: state.width };
  switch (type) {
    case 'pen': return { ...base, points: [{ x, y }] };
    case 'line':
    case 'arrow': return { ...base, x1: x, y1: y, x2: x, y2: y, from: null, to: null };
    case 'text': return { ...base, x, y, text: '', size: 18 + state.width * 2 };
    case 'node': return { ...base, x, y, w: 0, h: 0, text: '', size: 18 };
    default: return { ...base, x, y, w: 0, h: 0 };
  }
}
const nodeAt = (x, y) => topmostAt(x, y, (s) => s.type === 'node');

canvas.addEventListener('pointerdown', (e) => {
  if (state.mode !== 'draw' || e.button !== 0) return;
  if (editing) finishEdit();
  canvas.setPointerCapture(e.pointerId);
  const { clientX: x, clientY: y } = e;
  const tool = state.tool;

  if (tool === 'laser') {
    drag = { kind: 'laser' };
    laser.push({ x, y, t: performance.now() });
    render();
  } else if (tool === 'eraser') {
    drag = { kind: 'erase' };
    eraseAt(x, y);
  } else if (tool === 'select') {
    const sel = selected();
    if (sel && isBox(sel) && Math.abs(x - (sel.x + sel.w)) < 10 && Math.abs(y - (sel.y + sel.h)) < 10) {
      drag = { kind: 'resize', shape: sel };
    } else {
      const s = topmostAt(x, y);
      state.sel = s ? s.id : null;
      drag = s ? { kind: 'move', shape: s, x, y } : null;
    }
    render();
  } else if (tool === 'text') {
    const s = newShape('text', x, y);
    state.shapes.push(s);
    editText(s);
  } else {
    const s = newShape(tool, x, y);
    if (isLine(s)) s.from = nodeAt(x, y)?.id ?? null;
    state.shapes.push(s);
    drag = { kind: 'draw', shape: s, x, y };
    render();
  }
});

function eraseAt(x, y) {
  const s = topmostAt(x, y);
  if (s) {
    removeShape(s);
    render();
  }
}

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { clientX: x, clientY: y } = e;
  const s = drag.shape;
  if (drag.kind === 'laser') laser.push({ x, y, t: performance.now() });
  else if (drag.kind === 'erase') eraseAt(x, y);
  else if (drag.kind === 'move') {
    move(s, x - drag.x, y - drag.y);
    drag.x = x;
    drag.y = y;
  } else if (drag.kind === 'resize') {
    s.w = Math.max(20, x - s.x);
    s.h = Math.max(20, y - s.y);
  } else if (s.type === 'pen') s.points.push({ x, y });
  else if (isLine(s)) {
    s.x2 = x;
    s.y2 = y;
  } else {
    Object.assign(s, { x: Math.min(drag.x, x), y: Math.min(drag.y, y), w: Math.abs(x - drag.x), h: Math.abs(y - drag.y) });
  }
  render();
});

function finishDraw(s, x, y) {
  if (isLine(s)) {
    s.to = nodeAt(x, y)?.id ?? null;
    if (s.to === s.from && Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < 20) s.to = null;
    const tiny = !s.to && !s.from && Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < 4;
    if (tiny) removeShape(s);
  } else if (s.type === 'node') {
    if (s.w < 10 || s.h < 10) Object.assign(s, { x: s.x - NODE_SIZE.w / 2, y: s.y - NODE_SIZE.h / 2, ...NODE_SIZE });
    editText(s);
    return; // commit произойдёт по завершении правки
  } else if ((s.type === 'rect' || s.type === 'ellipse') && (s.w < 4 || s.h < 4)) removeShape(s);
}

canvas.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.kind === 'draw') finishDraw(d.shape, e.clientX, e.clientY);
  if (!editing) commit();
  render();
});

canvas.addEventListener('dblclick', (e) => {
  if (state.tool !== 'select') return;
  const s = topmostAt(e.clientX, e.clientY, (x) => x.type === 'node' || x.type === 'text');
  if (s) editText(s);
});

/* ---------- режимы и панель ---------- */
function applyIgnore() {
  api.setIgnore(state.mode === 'pass' && !overToolbar);
}
function setMode(mode) {
  if (editing) finishEdit();
  state.mode = mode;
  document.body.className = `mode-${mode}`;
  $('#mode').textContent = mode === 'draw' ? '✏ Рисую' : '👆 Сквозные клики';
  if (mode === 'draw') api.focus();
  applyIgnore();
}
const toggleMode = () => setMode(state.mode === 'draw' ? 'pass' : 'draw');

toolbar.addEventListener('mouseenter', () => { overToolbar = true; applyIgnore(); });
toolbar.addEventListener('mouseleave', () => { overToolbar = false; applyIgnore(); });

function selectTool(id) {
  if (editing) finishEdit();
  state.tool = id;
  if (id !== 'select') state.sel = null;
  if (state.mode !== 'draw') setMode('draw');
  refreshToolbar();
  render();
}

function applyStyle(patch) {
  Object.assign(state, patch);
  const s = selected();
  if (s) {
    if (patch.color) s.color = patch.color;
    if (patch.width && s.type !== 'text') s.width = patch.width;
    commit();
  }
  refreshToolbar();
  render();
}

function buildToolbar() {
  for (const t of TOOLS) {
    const b = document.createElement('button');
    b.textContent = t.icon;
    b.title = t.label;
    b.dataset.tool = t.id;
    b.addEventListener('click', () => selectTool(t.id));
    $('#tools').append(b);
  }
  for (const c of COLORS) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = c;
    b.dataset.color = c;
    b.title = `Цвет ${COLORS.indexOf(c) + 1}`;
    b.addEventListener('click', () => applyStyle({ color: c }));
    $('#colors').append(b);
  }
  for (const w of WIDTHS) {
    const b = document.createElement('button');
    b.className = 'width';
    b.dataset.width = String(w);
    b.title = `Толщина ${w}`;
    b.innerHTML = `<i style="height:${Math.max(2, w / 1.5)}px"></i>`;
    b.addEventListener('click', () => applyStyle({ width: w }));
    $('#widths').append(b);
  }
  refreshToolbar();
}
function refreshToolbar() {
  document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === state.tool));
  document.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('active', b.dataset.color === state.color));
  document.querySelectorAll('[data-width]').forEach((b) => b.classList.toggle('active', Number(b.dataset.width) === state.width));
}

$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);
$('#clear').addEventListener('click', clearAll);
$('#mode').addEventListener('click', toggleMode);
$('#quit').addEventListener('click', () => api.quit());

// Перетаскивание панели за «ручку».
$('#grip').addEventListener('pointerdown', (e) => {
  const r = toolbar.getBoundingClientRect();
  const dx = e.clientX - r.left;
  const dy = e.clientY - r.top;
  toolbar.style.transform = 'none';
  const onMove = (ev) => {
    toolbar.style.left = `${Math.max(0, Math.min(innerWidth - r.width, ev.clientX - dx))}px`;
    toolbar.style.top = `${Math.max(0, Math.min(innerHeight - r.height, ev.clientY - dy))}px`;
  };
  const onUp = () => {
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerup', onUp);
  };
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
});

/* ---------- клавиатура ---------- */
addEventListener('keydown', (e) => {
  if (editing) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && key === 'y') { e.preventDefault(); redo(); return; }
  if (mod || e.altKey) return;
  if (e.key === 'Escape') { if (state.sel != null) { state.sel = null; render(); } else setMode('pass'); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const s = selected();
    if (s) { removeShape(s); commit(); render(); }
    return;
  }
  const idx = Number(e.key) - 1;
  if (idx >= 0 && idx < COLORS.length) { applyStyle({ color: COLORS[idx] }); return; }
  const tool = TOOLS.find((t) => t.key === key);
  if (tool) selectTool(tool.id);
});

addEventListener('resize', resize);
api.onToggleMode(toggleMode);
api.onClear(clearAll);
buildToolbar();
setMode('draw');
resize();
