// Клавиши холста: сочетание — строка вида «Mod+Shift+KeyC». Mod — Ctrl на Windows и Linux,
// ⌘ на macOS; Ctrl — клавиша Control на macOS. Клавиша — физическая (e.code), поэтому
// сочетания одинаково работают на любой раскладке. Назначения — { действие: [сочетания] };
// в настройках хранятся только отличия от значений по умолчанию.

const MODIFIER_CODES = /^(Shift|Control|Alt|Meta|OS)(Left|Right)?$|^(CapsLock|Fn|FnLock)$/;

// Цифры цифрового блока — те же цифры: «Alt+1» срабатывает с любой единицы.
const normalizeCode = (code) => code.replace(/^Numpad(\d)$/, 'Digit$1');

/** Сочетание из события клавиатуры, или null, пока нажаты одни модификаторы (и для клавиши Win). */
export function comboFromEvent(e, mac) {
  if (!e.code || MODIFIER_CODES.test(e.code)) return null;
  if (!mac && e.metaKey) return null; // Win держит система
  const parts = [];
  if (mac ? e.metaKey : e.ctrlKey) parts.push('Mod');
  if (mac && e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(normalizeCode(e.code));
  return parts.join('+');
}

/** Назначения: значения по умолчанию, поверх — сохранённые отличия («» — клавиши нет). */
export function resolve(defaults, overrides = {}) {
  const bindings = {};
  for (const [action, combos] of Object.entries(defaults)) {
    const saved = overrides[action];
    bindings[action] = typeof saved === 'string' ? saved.split(',').filter(Boolean) : [...combos];
  }
  return bindings;
}

/** Только то, что отличается от значений по умолчанию, — для сохранения. */
export function toOverrides(defaults, bindings) {
  const overrides = {};
  for (const [action, combos] of Object.entries(bindings)) {
    if (combos.join(',') !== (defaults[action] ?? []).join(',')) overrides[action] = combos.join(',');
  }
  return overrides;
}

/**
 * Назначить действию сочетания. Сочетание у другого действия снимается с него:
 * одна клавиша — одно действие. Возвращает новые назначения и действия, у которых его сняли.
 */
export function assign(bindings, action, combos) {
  const next = {};
  const moved = [];
  for (const [other, list] of Object.entries(bindings)) {
    if (other === action) { next[other] = [...combos]; continue; }
    const kept = list.filter((c) => !combos.includes(c));
    if (kept.length !== list.length) moved.push(other);
    next[other] = kept;
  }
  return { bindings: next, moved };
}

/** Сочетание → действие, для обработки нажатий. */
export function lookup(bindings) {
  const map = new Map();
  for (const [action, combos] of Object.entries(bindings)) {
    for (const combo of combos) if (!map.has(combo)) map.set(combo, action);
  }
  return map;
}

/**
 * Ряд «модификаторы + 1, 2, 3…» — для памятки одной строкой («Alt + 1…8»).
 * { prefix: ['Alt'], last: 8 } или null, если ряд не такой.
 */
export function digitRun(combos) {
  if (combos.length < 2) return null;
  const split = combos.map((c) => /^(?:(.+)\+)?Digit(\d)$/.exec(c));
  if (split.some((m) => !m)) return null;
  const prefix = split[0][1] ?? '';
  const ok = split.every((m, i) => (m[1] ?? '') === prefix && Number(m[2]) === i + 1);
  return ok ? { prefix: prefix ? prefix.split('+') : [], last: combos.length } : null;
}

const ACCEL_MODIFIERS = { Mod: 'CommandOrControl', Ctrl: 'Control', Alt: 'Alt', Shift: 'Shift' };

/**
 * Сочетание → глобальный хоткей в формате Tauri («Mod+Backquote» → «CommandOrControl+Backquote»),
 * или null. У глобального нужен модификатор (иначе он перехватит обычный ввод во всех
 * программах), не больше трёх клавиш, а клавиша — понятная любой раскладке: буква, цифра,
 * F1–F12, пробел или ` (Ё).
 */
export function toAccelerator(combo) {
  const parts = combo.split('+');
  const code = parts.pop();
  const letter = /^Key([A-Z])$/.exec(code) || /^Digit(\d)$/.exec(code);
  const plain = /^F([1-9]|1[0-2])$/.test(code) || code === 'Space' || code === 'Backquote';
  const key = letter ? letter[1] : plain ? code : null;
  if (!key || parts.length === 0 || parts.length > 2) return null;
  return [...parts.map((p) => ACCEL_MODIFIERS[p]), key].join('+');
}
