// Сцена для файла: фигуры + картинки (PNG в base64). Файл приходит извне — не доверяем ему:
// оставляем только известные фигуры с корректными полями, остальное отбрасываем.

export const SCENE_KEY = 'sketchover';
const VERSION = 1;

const TYPES = new Set(['pen', 'line', 'arrow', 'rect', 'ellipse', 'node', 'text', 'image']);
const BOX = ['x', 'y', 'w', 'h'];
const FIELDS = {
  pen: [],
  line: ['x1', 'y1', 'x2', 'y2'],
  arrow: ['x1', 'y1', 'x2', 'y2'],
  rect: BOX,
  ellipse: BOX,
  node: [...BOX, 'size'],
  text: ['x', 'y', 'size'],
  image: [...BOX],
};

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

export function packScene(shapes, images) {
  return JSON.stringify({ app: SCENE_KEY, version: VERSION, shapes, images });
}

function validShape(s) {
  if (!s || typeof s !== 'object' || !TYPES.has(s.type)) return false;
  if (!Number.isSafeInteger(s.id) || s.id <= 0 || !isColor(s.color) || !isNum(s.width)) return false;
  if (!FIELDS[s.type].every((f) => isNum(s[f]))) return false;
  if (s.type === 'pen') return Array.isArray(s.points) && s.points.length > 0 && s.points.every((p) => isNum(p?.x) && isNum(p?.y));
  if (s.type === 'node' || s.type === 'text') return typeof s.text === 'string';
  if (s.type === 'image') return typeof s.imageId === 'string' && (s.rotation === undefined || isNum(s.rotation));
  if (s.type === 'line' || s.type === 'arrow') return [s.from, s.to].every((v) => v === null || v === undefined || Number.isSafeInteger(v));
  return true;
}

// JSON сцены → { shapes, images } или null, если это не сцена Sketchover.
export function unpackScene(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (data?.app !== SCENE_KEY || !Array.isArray(data.shapes)) return null;
  const images = data.images && typeof data.images === 'object' ? data.images : {};
  const shapes = data.shapes.filter(validShape)
    .filter((s) => s.type !== 'image' || typeof images[s.imageId] === 'string');
  // Ссылки стрелок — только на фигуры, которые остались.
  const ids = new Set(shapes.map((s) => s.id));
  for (const s of shapes) {
    if (s.type !== 'line' && s.type !== 'arrow') continue;
    if (!ids.has(s.from)) s.from = null;
    if (!ids.has(s.to)) s.to = null;
  }
  return { shapes, images };
}
