// Раскрываемая панель: язык, хоткей, автозапуск, обновления, «О программе».
import { LANGS, lang, setLang, isRtl, t, translatePage } from '../i18n/index.js';
import { api } from './api.js';
import { formatKeys, isMac } from './keys.js';

const $ = (s) => document.querySelector(s);
const panel = $('#settings');
const toggle = $('#settings-toggle');
const hotkeyButton = $('#hotkey');
const hotkeyError = $('#hotkey-error');
const updateStatus = $('#update-status');
const updateAction = $('#update-action');
const updateProgress = $('#update-progress');

let info = null; // ответ get_settings
let onRelabel = () => {};
let status = { key: '', params: {} }; // последний статус обновлений — чтобы перевести при смене языка
let found = null; // найденное обновление

/* ---------- хоткей ---------- */
// Только клавиши, одинаково понятные всем раскладкам: буквы, цифры, F1–F12, пробел, ` (Ё).
function keyName(code) {
  const m = /^Key([A-Z])$/.exec(code) || /^Digit(\d)$/.exec(code);
  if (m) return m[1];
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;
  return code === 'Space' || code === 'Backquote' ? code : null;
}

function accelerator(e) {
  const parts = [];
  if (isMac() ? e.metaKey : e.ctrlKey) parts.push('CommandOrControl');
  if (isMac() && e.ctrlKey) parts.push('Control');
  if (!isMac() && e.metaKey) parts.push('Super');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  const key = keyName(e.code);
  return key ? { parts, accel: [...parts, key].join('+') } : null;
}

function showHotkeyError(code) {
  hotkeyError.hidden = !code;
  hotkeyError.textContent = code ? t(`settings.hotkey.${code}`) : '';
}

function stopRecording() {
  hotkeyButton.classList.remove('recording');
  hotkeyButton.textContent = formatKeys(info.hotkey);
}

hotkeyButton.addEventListener('click', () => {
  hotkeyButton.classList.add('recording');
  hotkeyButton.textContent = t('settings.hotkey.prompt');
});
hotkeyButton.addEventListener('blur', stopRecording);
hotkeyButton.addEventListener('keydown', async (e) => {
  if (!hotkeyButton.classList.contains('recording')) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key === 'Escape') { stopRecording(); return; }
  const combo = accelerator(e);
  if (!combo) return; // пока нажаты только модификаторы
  if (combo.parts.length === 0 || combo.parts.length > 2) { showHotkeyError('invalid'); return; }
  try {
    await api.setHotkey(combo.accel);
    info.hotkey = combo.accel;
    showHotkeyError(null);
    onRelabel();
  } catch (code) {
    showHotkeyError(code === 'taken' ? 'taken' : 'invalid');
  }
  stopRecording();
});

/* ---------- язык ---------- */
function applyLanguage() {
  translatePage();
  panel.dir = isRtl() ? 'rtl' : 'ltr';
  hotkeyButton.textContent = formatKeys(info.hotkey);
  $('#version').textContent = t('about.version', { version: info.version });
  setStatus(status.key, status.params);
  onRelabel();
  api.setLanguage(info.lang, { show: t('tray.show'), quit: t('tray.quit') });
}

function buildLanguageList() {
  const select = $('#lang');
  const system = document.createElement('option');
  system.value = '';
  system.dataset.i18n = 'settings.system';
  select.append(system);
  for (const [code, { name }] of Object.entries(LANGS)) select.append(new Option(name, code));
  select.value = info.lang ?? '';
  select.addEventListener('change', () => {
    info.lang = select.value || null;
    setLang(info.lang);
    applyLanguage();
  });
}

/* ---------- обновления ---------- */
function setStatus(key, params = {}) {
  status = { key, params };
  updateStatus.textContent = key ? t(key, params) : '';
}

function setAction(key, handler) {
  updateAction.hidden = !key;
  if (!key) return;
  updateAction.dataset.i18n = key;
  updateAction.textContent = t(key);
  updateAction.onclick = handler;
}

async function checkUpdate() {
  setStatus('update.checking');
  setAction(null);
  try {
    found = await api.checkUpdate();
  } catch {
    setStatus('update.failed');
    setAction('update.check', checkUpdate);
    return;
  }
  toggle.classList.toggle('has-update', Boolean(found));
  if (found) {
    setStatus('update.available', { version: found.version });
    setAction('update.install', installUpdate);
  } else {
    setStatus('update.current');
    setAction('update.check', checkUpdate);
  }
}

async function installUpdate() {
  setAction(null);
  updateProgress.hidden = false;
  updateProgress.removeAttribute('value');
  try {
    await api.installUpdate(); // при успехе приложение перезапустится
  } catch {
    updateProgress.hidden = true;
    setStatus('update.failed');
    setAction('update.check', checkUpdate);
  }
}

api.on('update:progress', ({ received, total }) => {
  if (!total) return;
  const percent = Math.floor((received / total) * 100);
  updateProgress.value = percent;
  setStatus('update.downloading', { percent });
});
api.on('update:installing', () => setStatus('update.installing'));

/* ---------- панель ---------- */
function setOpen(open) {
  panel.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  if (open && !status.key) checkUpdate();
}
export const isSettingsOpen = () => !panel.hidden;

export function initSettings(appInfo, { relabel }) {
  info = appInfo;
  onRelabel = relabel;
  setLang(info.lang);
  buildLanguageList();

  $('#autostart').checked = info.autostart;
  $('#autostart').addEventListener('change', (e) => {
    api.setAutostart(e.target.checked).catch(() => { e.target.checked = !e.target.checked; });
  });
  $('#auto-update').checked = info.autoUpdate;
  $('#auto-update').addEventListener('change', (e) => api.setAutoUpdate(e.target.checked));
  $('#quit').addEventListener('click', () => api.quit());

  toggle.addEventListener('click', () => setOpen(panel.hidden));
  // Клавиши внутри панели не должны переключать инструменты; Esc сворачивает панель.
  panel.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { setOpen(false); toggle.focus(); }
  });

  showHotkeyError(info.hotkeyOk ? null : 'taken');
  applyLanguage();
  if (info.autoUpdate) checkUpdate();
}
