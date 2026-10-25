// Обучение при первом запуске: затемнение с «окном» вокруг элемента панели, которое плавно
// перетекает от шага к шагу, и карточка с объяснением. Клавиши в текстах — текущие
// (свои назначения, хоткей, клавиша двойного тапа). Пропустить можно на любом шаге;
// снова пройти — из настроек.
import { t, isRtl } from '../i18n/index.js';
import { formatKeys, formatModifierKey, isMac } from './keys.js';
import { firstKeyText, groupKeysText } from './shortcuts.js';

const $ = (s) => document.querySelector(s);

// target — что подсветить (несколько — общей рамкой); пусто — шаг посреди экрана.
const STEPS = [
  { id: 'welcome' },
  { id: 'tools', target: ['#tools'] },
  { id: 'style', target: ['#colors', '#widths'] },
  { id: 'capture', target: ['#shot-btn', '#copy-btn', '#save-btn', '#open-btn'] },
  { id: 'undo', target: ['#undo', '#redo', '#clear'] },
  { id: 'mode', target: ['#mode'] },
  { id: 'hide', target: ['#hide'] },
  { id: 'help', target: ['#help-toggle', '#help'] },
  { id: 'settings', target: ['#settings-toggle'] },
  { id: 'done' },
];

let info = null;
let onDone = () => {};
let root = null;
let index = 0;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Текст с клавишами: значения подставляются плашками <kbd> — так сочетание не рвётся на две строки
// и сразу видно, что нажимать.
function withKeys(key, keys) {
  const names = Object.keys(keys);
  const marks = Object.fromEntries(names.map((name, i) => [name, `\u0001${i}\u0001`]));
  return t(key, marks)
    .split(/\u0001(\d+)\u0001/)
    .map((part, i) => (i % 2 ? el('kbd', null, keys[names[Number(part)]]) : document.createTextNode(part)));
}

// Текст шага с клавишами, которые сейчас действуют на этой системе.
function stepText(id) {
  const tap = info.holdSupported && info.tapKey !== 'off' ? formatModifierKey(info.tapKey) : null;
  const hold = info.holdSupported && info.holdKey !== 'off' ? formatModifierKey(info.holdKey) : null;
  const params = {
    tools: `${firstKeyText('tool.select')} … ${firstKeyText('tool.eraser')}`,
    colors: groupKeysText('colors'),
    widths: groupKeysText('widths'),
    shot: firstKeyText('shot'),
    copy: firstKeyText('copy'),
    save: firstKeyText('save'),
    undo: firstKeyText('undo'),
    redo: firstKeyText('redo'),
    pass: firstKeyText('pass'),
    help: firstKeyText('help'),
    hotkey: formatKeys(info.hotkey),
  };
  // На macOS нет трея — программа живёт в строке меню.
  const key = id === 'hide' && isMac() ? 'tour.hide.textMac' : `tour.${id}.text`;
  const nodes = withKeys(key, params);
  if (id === 'mode') {
    if (tap) nodes.push(document.createTextNode(' '), ...withKeys('tour.mode.tap', { tap: `${tap} ${tap}` }));
    if (hold) nodes.push(document.createTextNode(' '), ...withKeys('tour.mode.hold', { alt: hold }));
  }
  return nodes;
}

// Общая рамка видимых элементов шага, с запасом; null — подсвечивать нечего.
function targetRect(selectors = []) {
  const rects = selectors
    .map((s) => $(s))
    .filter((node) => node && !node.hidden && node.offsetParent !== null)
    .map((node) => node.getBoundingClientRect());
  if (rects.length === 0) return null;
  const pad = 6;
  const left = Math.min(...rects.map((r) => r.left)) - pad;
  const top = Math.min(...rects.map((r) => r.top)) - pad;
  const right = Math.max(...rects.map((r) => r.right)) + pad;
  const bottom = Math.max(...rects.map((r) => r.bottom)) + pad;
  return { left, top, width: right - left, height: bottom - top };
}

function placeSpot(spot, rect) {
  // Без цели «окно» схлопывается в центр экрана — остаётся ровное затемнение.
  const r = rect ?? { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  spot.classList.toggle('empty', !rect);
  spot.style.left = `${r.left}px`;
  spot.style.top = `${r.top}px`;
  spot.style.width = `${r.width}px`;
  spot.style.height = `${r.height}px`;
}

// Карточка — под целью, если там есть место, иначе над ней; по горизонтали — в пределах экрана.
function placeCard(card, rect) {
  const gap = 14;
  const margin = 12;
  const { width, height } = card.getBoundingClientRect();
  if (!rect) {
    card.style.left = `${(innerWidth - width) / 2}px`;
    card.style.top = `${(innerHeight - height) / 2}px`;
    return;
  }
  const below = rect.top + rect.height + gap;
  const top = below + height + margin <= innerHeight ? below : Math.max(margin, rect.top - gap - height);
  const centered = rect.left + rect.width / 2 - width / 2;
  const left = Math.min(Math.max(margin, centered), innerWidth - width - margin);
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

function button(className, text, onClick) {
  const b = el('button', className, text);
  b.addEventListener('click', onClick);
  return b;
}

function render() {
  const step = STEPS[index];
  const first = index === 0;
  const last = index === STEPS.length - 1;
  const card = root.querySelector('.tour-card');

  const actions = el('div', 'tour-actions');
  if (!last) actions.append(button('text tour-skip', t('tour.skip'), finish));
  actions.append(el('span', 'tour-gap'));
  if (!first && !last) actions.append(button('text', t('tour.back'), () => go(index - 1)));
  const nextLabel = first ? t('tour.start') : last ? t('tour.finish') : t('tour.next');
  const next = button('primary', nextLabel, () => (last ? finish() : go(index + 1)));
  actions.append(next);

  const counter = first || last ? null : el('span', 'tour-step', t('tour.step', { n: index, total: STEPS.length - 2 }));
  card.dir = isRtl() ? 'rtl' : 'ltr';
  const text = el('p');
  text.append(...stepText(step.id));
  card.replaceChildren(...[counter, el('h3', null, t(`tour.${step.id}.title`)), text, actions].filter(Boolean));
  // Перезапуск анимации появления карточки на каждом шаге.
  card.classList.remove('show');
  void card.offsetWidth;
  card.classList.add('show');

  place();
  next.focus();
}

// Рамка и карточка — по текущему положению панели. При изменении размера окна только это:
// без повторной анимации и без перехвата фокуса.
function place() {
  const rect = targetRect(STEPS[index].target);
  placeSpot(root.querySelector('.tour-spot'), rect);
  placeCard(root.querySelector('.tour-card'), rect);
}

function go(i) {
  index = Math.max(0, Math.min(STEPS.length - 1, i));
  render();
}

// Пока идёт обучение, клавиши холста не срабатывают: обработчик стоит раньше (capture).
function onKey(e) {
  e.stopImmediatePropagation();
  if (e.key === 'Escape') { e.preventDefault(); finish(); return; }
  if (e.key === 'ArrowRight' || e.key === 'Enter') {
    e.preventDefault();
    if (index === STEPS.length - 1) finish(); else go(index + 1);
    return;
  }
  if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
}

const onResize = () => place();

export function startTour() {
  if (root) return;
  root = el('div', null);
  root.id = 'tour';
  root.append(el('div', 'tour-spot empty'), el('div', 'tour-card'));
  document.body.append(root);
  index = 0;
  addEventListener('keydown', onKey, true);
  addEventListener('resize', onResize);
  render();
}

/** Закрыть, не отмечая пройденным: покажется при следующем показе холста. */
export function closeTour() {
  if (!root) return;
  removeEventListener('keydown', onKey, true);
  removeEventListener('resize', onResize);
  root.remove();
  root = null;
}

function finish() {
  closeTour();
  onDone();
}

export function initOnboarding(appInfo, { done }) {
  info = appInfo;
  onDone = done;
}
