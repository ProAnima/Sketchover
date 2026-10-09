// Памятка по клавишам сбоку экрана. Открыта по умолчанию, F1 или «?» — свернуть/развернуть.
import { COLORS, WIDTHS } from '../core/state.js';
import { t } from '../i18n/index.js';
import { formatKeys } from './keys.js';
import { toolIcon } from './icons.js';

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

// Клавиши инструментов — по порядку панели: 1…9, затем 0.
const toolKey = (i) => String((i + 1) % 10);

export function renderHelp() {
  aside.replaceChildren(el('h3', null, t('help.title')));
  aside.append(row(formatKeys(info.hotkey), t('help.toggle')));
  if (info.holdSupported) aside.append(row(`${formatKeys('Alt')} (${t('help.hold')})`, t('help.peek')));
  const alt = formatKeys('Alt');
  aside.append(row(info.holdSupported ? `Esc · ${alt} ${alt}` : 'Esc', t('help.pass')));

  aside.append(el('h4', null, t('help.tools')));
  const grid = el('div', 'help-tools');
  tools.forEach((tool, i) => {
    const chip = el('span', 'help-tool');
    chip.title = t(tool.label);
    chip.append(el('kbd', null, toolKey(i)), toolIcon(tool));
    grid.append(chip);
  });
  aside.append(grid);

  aside.append(row('S', t('help.shot')));
  aside.append(row(`${formatKeys('Alt')} + 1…${COLORS.length}`, t('help.colors')));
  aside.append(row(`${formatKeys('Shift')} + 1…${WIDTHS.length}`, t('help.widths')));
  aside.append(row(`${formatKeys('CommandOrControl')} + Z / Y`, t('help.undo')));
  aside.append(row('Del / Shift + Del', t('help.delete')));
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
