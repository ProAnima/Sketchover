// Клавиши холста в разделе «Клавиши»: клик по клавише, нажатие нового сочетания — и оно сохранено.
// ↺ — вернуть клавишу по умолчанию. Сочетание глобального хоткея холсту не отдаём: его
// перехватывает система раньше, и клавиша холста просто не сработала бы.
import { toAccelerator } from '../core/keymap.js';
import { t } from '../i18n/index.js';
import { allActions, keysText, labelOf, isDefault, setCombo, resetCombo, resetAll } from './shortcuts.js';
import { el, recordButton, rowButton, showNote } from './key-recorder.js';
import { globalOwner, resetGlobals } from './globals-settings.js';

const list = document.querySelector('#keys-list');
const GROUPS = [['general', 'keys.general'], ['tools', 'help.tools'], ['colors', 'help.colors'], ['widths', 'help.widths']];

// Сочетание, снятое с другого действия, — сказать, с какого: иначе оно «пропадёт» молча.
const showMoved = (moved) => showNote(moved.length ? t('keys.moved', { action: moved.map(labelOf).join(', ') }) : null);

function assign(id, combo) {
  const accelerator = toAccelerator(combo);
  const owner = accelerator && globalOwner(accelerator);
  if (owner) { showNote(t('keys.globalTaken', { action: owner })); return; }
  showMoved(setCombo(id, combo)); // реестр сообщит об изменении — список перерисуется
}

function row(action) {
  const r = el('div', 'row key-row');
  const label = el('span', 'key-label', action.label());
  if (action.color) {
    const swatch = el('i', 'key-swatch');
    swatch.style.background = action.color;
    label.prepend(swatch);
  }
  r.append(label);
  if (!isDefault(action.id)) r.append(rowButton('↺', t('keys.resetOne'), () => showMoved(resetCombo(action.id))));
  r.append(recordButton(keysText(action.id), (combo) => assign(action.id, combo)));
  return r;
}

export function renderKeys() {
  const nodes = [el('h4', 'keys-heading', t('keys.canvas'))];
  for (const [group, title] of GROUPS) {
    nodes.push(el('h4', null, t(title)));
    for (const action of allActions().filter((a) => a.group === group)) nodes.push(row(action));
  }
  list.replaceChildren(...nodes);
}

export function initKeysSettings() {
  // «Сбросить все клавиши» — и холста, и глобальные, и удержание с тапом.
  document.querySelector('#keys-reset').addEventListener('click', async () => {
    showNote(null);
    await resetGlobals();
    resetAll();
  });
  renderKeys();
}
