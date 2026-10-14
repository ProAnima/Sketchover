// «Клавиши холста» в настройках: клик по клавише, нажатие нового сочетания — и оно сохранено.
// Esc во время записи — отмена; ↺ — вернуть клавишу по умолчанию.
import { comboFromEvent } from '../core/keymap.js';
import { t } from '../i18n/index.js';
import { isMac } from './keys.js';
import { allActions, keysText, labelOf, isDefault, setCombo, resetCombo, resetAll } from './shortcuts.js';

const list = document.querySelector('#keys-list');
const note = document.querySelector('#keys-note');
const GROUPS = [['general', 'keys.general'], ['tools', 'help.tools'], ['colors', 'help.colors'], ['widths', 'help.widths']];

let recording = null; // кнопка, которая ждёт сочетание

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Сочетание, снятое с другого действия, — сказать, с какого: иначе оно «пропадёт» молча.
function showMoved(moved) {
  note.hidden = moved.length === 0;
  note.textContent = moved.length ? t('keys.moved', { action: moved.map(labelOf).join(', ') }) : '';
}

function stopRecording() {
  if (!recording) return;
  recording.classList.remove('recording');
  recording.textContent = keysText(recording.dataset.action);
  recording = null;
}

function keyButton(id) {
  const button = el('button', 'field key', keysText(id));
  button.dataset.action = id;
  button.addEventListener('click', () => {
    stopRecording();
    recording = button;
    button.classList.add('recording');
    button.textContent = t('settings.hotkey.prompt');
  });
  button.addEventListener('blur', stopRecording);
  button.addEventListener('keydown', (e) => {
    if (recording !== button) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') { stopRecording(); return; }
    const combo = comboFromEvent(e, isMac());
    if (!combo) return; // пока нажаты только модификаторы
    recording = null;
    showMoved(setCombo(id, combo)); // реестр сообщит об изменении — список перерисуется
  });
  return button;
}

function row(action) {
  const r = el('div', 'row key-row');
  const label = el('span', 'key-label', action.label());
  if (action.color) {
    const swatch = el('i', 'key-swatch');
    swatch.style.background = action.color;
    label.prepend(swatch);
  }
  const reset = el('button', 'text key-reset', '↺');
  reset.title = t('keys.resetOne');
  reset.hidden = isDefault(action.id);
  reset.addEventListener('click', () => showMoved(resetCombo(action.id)));
  r.append(label, reset, keyButton(action.id));
  return r;
}

export function renderKeys() {
  recording = null;
  const nodes = [];
  for (const [group, title] of GROUPS) {
    nodes.push(el('h4', null, t(title)));
    for (const action of allActions().filter((a) => a.group === group)) nodes.push(row(action));
  }
  list.replaceChildren(...nodes);
}

export function initKeysSettings() {
  document.querySelector('#keys-reset').addEventListener('click', () => { showMoved([]); resetAll(); });
  renderKeys();
}
