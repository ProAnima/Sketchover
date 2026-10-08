// Отображение клавиш с учётом системы: на macOS — значки ⌘ ⌥ ⇧ ⌃.
let mac = false;
export const setPlatform = (os) => { mac = os === 'macos'; };
export const isMac = () => mac;

const NAMES = {
  CommandOrControl: () => (mac ? '⌘' : 'Ctrl'),
  Control: () => (mac ? '⌃' : 'Ctrl'),
  Alt: () => (mac ? '⌥' : 'Alt'),
  Shift: () => (mac ? '⇧' : 'Shift'),
  Super: () => (mac ? '⌘' : 'Win'),
  Backquote: () => '`',
};

export const formatKeys = (accel) => accel.split('+').map((p) => (NAMES[p] ? NAMES[p]() : p)).join(' + ');
