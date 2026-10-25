// Памятка по клавишам сбоку экрана. Открыта по умолчанию, F1 или «?» — свернуть/развернуть.
import { t } from '../i18n/index.js';
import { formatKeys, formatCombo, formatModifierKey } from './keys.js';
import { toolIcon } from './icons.js';
import { combosOf, firstKeyText as firstKey, groupKeysText as groupKeys } from './shortcuts.js';

const aside = document.querySelector('#help');
const toggle = document.querySelector('#help-toggle');
const STORAGE_KEY = 'sketchover.help';

let tools = [];
let info = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function row(keys, label) {
  const r = el('div', 'help-row');
  r.append(el('kbd', null, keys), el('span', null, label));
  return r;
}

const pair = (a, b) => `${firstKey(a)} · ${firstKey(b)}`;

export function renderHelp() {
  aside.replaceChildren(el('h3', null, t('help.title')));
  aside.append(row(formatKeys(info.hotkey), t('help.toggle')));
  const hold = info.holdSupported && info.holdKey !== 'off' ? formatModifierKey(info.holdKey) : null;
  if (hold) aside.append(row(`${hold} (${t('help.hold')})`, t('help.peek')));
  const tap = info.holdSupported && info.tapKey !== 'off' ? formatModifierKey(info.tapKey) : null;
  aside.append(row(tap ? `${firstKey('pass')} · ${tap} ${tap}` : firstKey('pass'), t('help.pass')));
  // Необязательные глобальные хоткеи — только если назначены.
  for (const [action, label] of [['mode', 'keys.globalMode'], ['hide', 'keys.globalHide']]) {
    const accelerator = info.globals?.[action]?.accelerator;
    if (accelerator) aside.append(row(formatKeys(accelerator), t(label)));
  }

  aside.append(el('h4', null, t('help.tools')));
  const grid = el('div', 'help-tools');
  tools.forEach((tool) => {
    const chip = el('span', 'help-tool');
    chip.title = t(tool.label);
    const combo = combosOf(`tool.${tool.id}`)[0];
    chip.append(el('kbd', null, combo ? formatCombo(combo) : '—'), toolIcon(tool));
    grid.append(chip);
  });
  aside.append(grid);

  aside.append(row(firstKey('shot'), t('help.shot')));
  aside.append(row(groupKeys('colors'), t('help.colors')));
  aside.append(row(groupKeys('widths'), t('help.widths')));
  aside.append(row(pair('undo', 'redo'), t('help.undo')));
  aside.append(row(firstKey('copy'), t('help.copy')));
  aside.append(row(pair('save', 'open'), t('help.save')));
  aside.append(row(pair('delete', 'clear'), t('help.delete')));
}

function setOpen(open) {
  aside.hidden = !open;
  toggle.classList.toggle('active', open);
  try { localStorage.setItem(STORAGE_KEY, open ? '1' : '0'); } catch { /* без памяти — не страшно */ }
}

export const toggleHelp = () => setOpen(aside.hidden);

export function initHelp(toolList, appInfo) {
  tools = toolList;
  info = appInfo;
  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* приватный режим и т. п. */ }
  setOpen(saved !== '0');
  toggle.addEventListener('click', toggleHelp);
  renderHelp();
}
