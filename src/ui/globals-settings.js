// Глобальные хоткеи (работают из любой программы) и клавиши удержания и двойного тапа —
// в разделе «Клавиши». Всё сохраняет Rust-сторона; занятое другой программой видно у строки.
import { toAccelerator } from '../core/keymap.js';
import { t } from '../i18n/index.js';
import { api } from './api.js';
import { formatKeys, formatModifierKey, modifierKeys, isMac } from './keys.js';
import { dropWhere, labelOf } from './shortcuts.js';
import { el, recordButton, rowButton, showNote } from './key-recorder.js';

const GLOBALS = [['show', 'keys.globalShow'], ['mode', 'keys.globalMode'], ['hide', 'keys.globalHide']];
const DEFAULT_SHOW = 'Alt+Backquote';

const list = document.querySelector('#global-list');
const modifiers = document.querySelector('#modifier-list');

let info = null;
let onChange = () => {};

/** Действие, которому принадлежит глобальный хоткей, — его подпись; null — свободен. */
export function globalOwner(accelerator) {
  const found = GLOBALS.find(([action]) => info.globals[action].accelerator === accelerator);
  return found ? t(found[1]) : null;
}

async function setGlobal(action, accelerator) {
  try {
    await api.setGlobalHotkey(action, accelerator);
  } catch (code) {
    showNote(t(`settings.hotkey.${['used', 'taken'].includes(code) ? code : 'invalid'}`));
    return;
  }
  info.globals[action] = { accelerator, ok: true };
  if (action === 'show') { info.hotkey = accelerator; info.hotkeyOk = true; }
  // Глобальный хоткей перехватывает сочетание раньше холста — у клавиш холста его снимаем.
  const moved = accelerator ? dropWhere((combo) => toAccelerator(combo) === accelerator) : [];
  showNote(moved.length ? t('keys.moved', { action: moved.map(labelOf).join(', ') }) : null);
  onChange();
}

function globalRow(action, label) {
  const { accelerator, ok } = info.globals[action];
  const r = el('div', 'row key-row');
  r.append(el('span', 'key-label', t(label)));
  if (action === 'show' && accelerator !== DEFAULT_SHOW) {
    r.append(rowButton('↺', t('keys.resetOne'), () => setGlobal('show', DEFAULT_SHOW)));
  }
  if (action !== 'show' && accelerator) r.append(rowButton('✕', t('keys.clear'), () => setGlobal(action, '')));
  const button = recordButton(accelerator ? formatKeys(accelerator) : '—', (combo) => {
    const next = toAccelerator(combo);
    if (!next) { showNote(t('settings.hotkey.invalid')); return; }
    setGlobal(action, next);
  });
  // Сочетание держит другая программа — оно сохранено, но не работает.
  if (accelerator && !ok) {
    button.classList.add('warn');
    button.title = t('settings.hotkey.taken');
  }
  r.append(button);
  return r;
}

function modifierRow(label, value, onPick) {
  const r = el('div', 'row key-row');
  const select = el('select');
  select.append(new Option(t('settings.tap.off'), 'off'));
  for (const key of modifierKeys()) select.append(new Option(formatModifierKey(key), key));
  select.value = value;
  select.addEventListener('change', () => onPick(select.value).catch(() => { select.value = value; }));
  r.append(el('span', 'key-label', t(label)), select);
  return r;
}

async function setModifier(kind, key) {
  if (kind === 'hold') { await api.setHoldKey(key); info.holdKey = key; } else { await api.setTapKey(key); info.tapKey = key; }
  onChange();
}

export function renderGlobals() {
  list.replaceChildren(...GLOBALS.map(([action, label]) => globalRow(action, label)));
  // Удержание и двойной тап — опрос клавиш; его нет на Linux.
  modifiers.hidden = !info.holdSupported;
  modifiers.replaceChildren(
    el('h4', null, t('keys.modifiers')),
    modifierRow('settings.hold', info.holdKey, (key) => setModifier('hold', key)),
    modifierRow('settings.tap', info.tapKey, (key) => setModifier('tap', key)),
  );
}

/** «Сбросить все клавиши» — глобальные и модификаторы тоже. */
export async function resetGlobals() {
  const defaults = { show: DEFAULT_SHOW, mode: '', hide: '' };
  // Сначала необязательные: на них может стоять сочетание главного по умолчанию.
  for (const action of ['mode', 'hide', 'show']) {
    if (info.globals[action].accelerator !== defaults[action]) await setGlobal(action, defaults[action]);
  }
  if (info.holdKey !== 'alt') await setModifier('hold', 'alt');
  const tap = isMac() ? 'cmd' : 'alt';
  if (info.tapKey !== tap) await setModifier('tap', tap);
}

export function initGlobalsSettings(appInfo, { changed }) {
  info = appInfo;
  onChange = changed;
  renderGlobals();
}
