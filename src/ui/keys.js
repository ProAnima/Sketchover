// Отображение клавиш с учётом системы: на macOS — значки ⌘ ⌥ ⇧ ⌃.
let mac = false;
export const setPlatform = (os) => { mac = os === 'macos'; };
export const isMac = () => mac;

const NAMES = {
  CommandOrControl: () => (mac ? '⌘' : 'Ctrl'),
  Mod: () => (mac ? '⌘' : 'Ctrl'),
  Control: () => (mac ? '⌃' : 'Ctrl'),
  Ctrl: () => (mac ? '⌃' : 'Ctrl'),
  Alt: () => (mac ? '⌥' : 'Alt'),
  Shift: () => (mac ? '⇧' : 'Shift'),
  Super: () => (mac ? '⌘' : 'Win'),
  Backquote: () => '`',
};

export const formatModifier = (name) => NAMES[name]();

// Клавиша удержания или двойного тапа из настроек (keys::Modifier в Rust) → модификатор для показа.
const MODIFIER_KEYS = { alt: 'Alt', ctrl: 'Ctrl', shift: 'Shift', cmd: 'Mod' };
/** Какие модификаторы можно выбрать: ⌘ — только на macOS (Win на Windows держит система). */
export const modifierKeys = () => Object.keys(MODIFIER_KEYS).filter((k) => k !== 'cmd' || mac);
export const formatModifierKey = (key) => formatModifier(MODIFIER_KEYS[key]);
export const formatKeys = (accel) => accel.split('+').map((p) => (NAMES[p] ? NAMES[p]() : p)).join(' + ');

// Названия физических клавиш (e.code) — как на клавиатуре.
const CODES = {
  Escape: 'Esc', Delete: 'Del', Backspace: '⌫', Enter: '↵', Space: 'Space', Tab: 'Tab',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backquote: '`',
  PageUp: 'PgUp', PageDown: 'PgDn', Insert: 'Ins',
  NumpadAdd: 'Num +', NumpadSubtract: 'Num -', NumpadMultiply: 'Num *', NumpadDivide: 'Num /',
  NumpadDecimal: 'Num .', NumpadEnter: 'Num ↵', IntlBackslash: '\\',
};

const codeName = (code) => CODES[code] ?? code.replace(/^Key|^Digit/, '');

/** Сочетание из core/keymap.js («Mod+Shift+KeyC») — как его показать человеку. */
export const formatCombo = (combo) => combo.split('+').map((p, i, all) => (
  i === all.length - 1 ? codeName(p) : NAMES[p]()
)).join(' + ');
