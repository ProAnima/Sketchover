import { render, resize } from './ui/canvas.js';
import { editText } from './ui/editor.js';
import { setMode, toggleMode } from './ui/mode.js';
import { initToolbar, relabelToolbar } from './ui/toolbar.js';
import { initHelp, renderHelp } from './ui/help.js';
import { setPlatform, formatKeys } from './ui/keys.js';
import { initKeyboard } from './ui/keyboard.js';
import { initShortcuts, onShortcutsChange } from './ui/shortcuts.js';
import { initKeysSettings, renderKeys } from './ui/keys-settings.js';
import { initPointer } from './ui/pointer.js';
import { initSettings } from './ui/settings.js';
import { initOnboarding, startTour, closeTour } from './ui/onboarding.js';
import { initScreenshot, cancelScreenshot } from './ui/screenshot.js';
import { selectTool } from './ui/toolbar.js';
import { state } from './core/state.js';
import { createTools } from './tools/index.js';
import { api } from './ui/api.js';
import { showToast } from './ui/toast.js';
import { t } from './i18n/index.js';

const tools = createTools({ render, edit: editText });
const info = await api.getSettings();

setPlatform(info.os);
// Клавиши — до панели и памятки: их подписи показывают текущие назначения.
initShortcuts(tools, info.keys, { onSave: (keys) => api.setKeys(keys).catch((e) => showToast(String(e))) });
initToolbar(tools);
initHelp(tools, info);
initKeysSettings();
const relabel = () => { relabelToolbar(); renderHelp(); renderKeys(); };
onShortcutsChange(relabel);
// Пройти обучение — отмечаем сразу, и при пропуске тоже: показывать его снова решает человек.
initOnboarding(info, { done: () => { info.onboarded = true; api.setOnboarded(true).catch((e) => showToast(String(e))); } });
initSettings(info, { relabel, tour: () => { setMode('draw'); startTour(); } });
// Скриншот сразу выделен: его можно двигать, тянуть за угол и вращать.
initScreenshot({ placed: (shape) => { selectTool('select'); state.sel = shape.id; render(); } });
initKeyboard();
initPointer(tools);
addEventListener('resize', resize);
api.on('overlay:show', () => {
  setMode('draw');
  // Глобальный хоткей занят другой программой — без подсказки не понять, почему он не работает.
  if (!info.hotkeyOk) showToast(`${formatKeys(info.hotkey)} — ${t('settings.hotkey.taken')}`);
  // Первый показ после установки — обучение.
  if (!info.onboarded) startTour();
});
api.on('overlay:toggle', () => {
  cancelScreenshot();
  // В сквозном режиме карточка обучения не кликается — закрываем, покажется в следующий раз.
  closeTour();
  toggleMode();
});
// Зажат Alt: мышь уходит окнам под холстом, рисунок полупрозрачный.
api.on('overlay:peek', (held) => document.body.classList.toggle('peek', held));
// Окно стартует спрятанным; режим рисования включится событием overlay:show при первом показе.
resize();
