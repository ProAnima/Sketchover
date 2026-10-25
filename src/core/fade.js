// Исчезающие рисунки: новая фигура видна HOLD_MS, затем за FADE_MS гаснет и пропадает.
// Угасающие фигуры живут отдельно от холста — в историю отмены и в файл не попадают.

export const HOLD_MS = 2500;
export const FADE_MS = 800;

// Текст, блоки и скриншоты не гаснут: их правят и двигают, им нужно оставаться.
const FADABLE = new Set(['pen', 'marker', 'line', 'arrow', 'rect', 'ellipse']);
export const canFade = (s) => FADABLE.has(s.type);

/** Непрозрачность угасающей фигуры: 1 — ещё видна целиком, 0 — пора убрать. */
export function fadeAlpha(since, now) {
  const age = now - since;
  if (age <= HOLD_MS) return 1;
  return Math.max(0, 1 - (age - HOLD_MS) / FADE_MS);
}

/** Новые фигуры жеста (их id нет в before), которые умеют гаснуть, — отдельно от остальных. */
export function splitFading(shapes, before) {
  const kept = [];
  const fading = [];
  for (const s of shapes) (canFade(s) && !before.has(s.id) ? fading : kept).push(s);
  return { kept, fading };
}
