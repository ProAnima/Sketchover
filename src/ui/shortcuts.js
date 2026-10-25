// Реестр клавиш холста: какие есть действия, их клавиши по умолчанию и текущие назначения.
// Обработку нажатий делает keyboard.js, показ — памятка, панель и настройки.
import { COLORS, WIDTHS } from '../core/state.js';
import { resolve, toOverrides, assign, lookup, digitRun } from '../core/keymap.js';
import { t } from '../i18n/index.js';
import { formatCombo, formatModifier } from './keys.js';

const GENERAL = [
  { id: 'pass', label: 'toolbar.mode', keys: ['Escape'] },
  { id: 'help', label: 'toolbar.help', keys: ['F1'] },
  { id: 'shot', label: 'toolbar.shot', keys: ['KeyS'] },
  { id: 'undo', label: 'toolbar.undo', keys: ['Mod+KeyZ'] },
  { id: 'redo', label: 'toolbar.redo', keys: ['Mod+KeyY', 'Mod+Shift+KeyZ'] },
  { id: 'copy', label: 'toolbar.copy', keys: ['Mod+Shift+KeyC'] },
  { id: 'save', label: 'toolbar.save', keys: ['Mod+KeyS'] },
  { id: 'open', label: 'toolbar.open', keys: ['Mod+KeyO'] },
  { id: 'delete', label: 'keys.delete', keys: ['Delete', 'Backspace'] },
  { id: 'clear', label: 'toolbar.clear', keys: ['Shift+Delete'] },
];

let actions = [];
let defaults = {};
let bindings = {};
let byCombo = new Map();
let save = () => {};
const listeners = [];

/** Действия по группам: general, tools, colors, widths. label() — подпись на текущем языке. */
export const allActions = () => actions;

export function initShortcuts(tools, overrides, { onSave }) {
  save = onSave;
  actions = [
    ...GENERAL.map((a) => ({ id: a.id, group: 'general', label: () => t(a.label), keys: a.keys })),
    // Инструменты — по порядку панели: 1…9, затем 0.
    ...tools.map((tool, i) => ({ id: `tool.${tool.id}`, group: 'tools', label: () => t(tool.label), keys: [`Digit${(i + 1) % 10}`] })),
    ...COLORS.map((color, i) => ({ id: `color.${i + 1}`, group: 'colors', color, label: () => t('toolbar.color', { n: i + 1 }), keys: [`Alt+Digit${i + 1}`] })),
    ...WIDTHS.map((w, i) => ({ id: `width.${i + 1}`, group: 'widths', label: () => t('toolbar.width', { n: w }), keys: [`Shift+Digit${i + 1}`] })),
  ];
  defaults = Object.fromEntries(actions.map((a) => [a.id, a.keys]));
  apply(resolve(defaults, overrides ?? {}));
}

function apply(next) {
  bindings = next;
  byCombo = lookup(bindings);
  listeners.forEach((fn) => fn());
}

function store(next) {
  apply(next);
  save(toOverrides(defaults, bindings));
}

export const labelOf = (id) => actions.find((a) => a.id === id)?.label() ?? id;
export const onShortcutsChange = (fn) => listeners.push(fn);
export const actionFor = (combo) => byCombo.get(combo);
export const combosOf = (id) => bindings[id] ?? [];
export const isDefault = (id) => combosOf(id).join(',') === (defaults[id] ?? []).join(',');

/** Клавиши действия для подсказок: «Ctrl + Y / Ctrl + Shift + Z», «—», если нет. */
export const keysText = (id) => combosOf(id).map(formatCombo).join(' / ') || '—';

// Для памятки и обучения — первая клавиша действия: вторые («Ctrl + Shift + Z» для повтора) не помещаются.
export const firstKeyText = (id) => (combosOf(id)[0] ? formatCombo(combosOf(id)[0]) : '—');

/**
 * Группа действий (цвета, толщины) одной строкой: «Alt + 1…8», если клавиши идут подряд,
 * иначе — через «·».
 */
export function groupKeysText(group) {
  const combos = actions.filter((a) => a.group === group).map((a) => combosOf(a.id)[0]);
  const run = combos.every(Boolean) && digitRun(combos);
  if (run) return [...run.prefix.map(formatModifier), `1…${run.last}`].join(' + ');
  return combos.map((c) => (c ? formatCombo(c) : '—')).join(' · ');
}

/** Новое сочетание действия. Возвращает действия, у которых его пришлось снять. */
export function setCombo(id, combo) {
  const { bindings: next, moved } = assign(bindings, id, [combo]);
  store(next);
  return moved;
}

export function resetCombo(id) {
  const { bindings: next, moved } = assign(bindings, id, defaults[id]);
  store(next);
  return moved;
}

export const resetAll = () => store(resolve(defaults, {}));
