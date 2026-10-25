// Кнопка записи сочетания для раздела «Клавиши»: клик → «Нажмите комбинацию…» → нажатие.
// Esc — отмена. Одна на все строки — глобальные хоткеи и клавиши холста записываются одинаково.
import { comboFromEvent } from '../core/keymap.js';
import { t } from '../i18n/index.js';
import { isMac } from './keys.js';

const note = document.querySelector('#keys-note');
let recording = null; // кнопка, которая ждёт сочетание

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** Подсказка над списком (что сняли, почему не записали); пусто — скрыть. */
export function showNote(text) {
  note.hidden = !text;
  note.textContent = text || '';
}

function stopRecording() {
  if (!recording) return;
  const button = recording;
  recording = null;
  button.classList.remove('recording');
  button.textContent = button.dataset.label;
}

/** label — текущие клавиши; onCombo получает сочетание из core/keymap.js («Mod+Shift+KeyC»). */
export function recordButton(label, onCombo) {
  const button = el('button', 'field key', label);
  button.dataset.label = label;
  button.addEventListener('click', () => {
    stopRecording();
    recording = button;
    button.classList.add('recording');
    button.textContent = t('settings.hotkey.prompt');
  });
  button.addEventListener('blur', () => { if (recording === button) stopRecording(); });
  button.addEventListener('keydown', (e) => {
    if (recording !== button) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') { stopRecording(); return; }
    const combo = comboFromEvent(e, isMac());
    if (!combo) return; // пока нажаты только модификаторы
    stopRecording();
    onCombo(combo);
  });
  return button;
}

/** Маленькая кнопка в строке: ↺ — вернуть по умолчанию, ✕ — убрать клавишу. */
export function rowButton(text, title, onClick) {
  const b = el('button', 'text key-reset', text);
  b.title = title;
  b.addEventListener('click', onClick);
  return b;
}
