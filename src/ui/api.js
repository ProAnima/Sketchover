// Единственная точка доступа к ОС из интерфейса: команды Rust-стороны (src-tauri) и её события.
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

export const api = {
  getSettings: () => invoke('get_settings'),
  setLanguage: (lang, labels) => invoke('set_language', { lang, labels }),
  setHotkey: (accelerator) => invoke('set_hotkey', { accelerator }),
  setAutostart: (enabled) => invoke('set_autostart', { enabled }),
  setAutoUpdate: (enabled) => invoke('set_auto_update', { enabled }),
  setPassThrough: (enabled, panel) => invoke('set_pass_through', { enabled, panel }),
  focus: () => invoke('focus_window'),
  hide: () => invoke('hide_overlay'),
  quit: () => invoke('quit'),
  checkUpdate: () => invoke('check_update'),
  installUpdate: () => invoke('install_update'),
  captureScreen: () => invoke('capture_screen'),
  // Байты PNG — телом запроса (без JSON); имя — подсказка для диалога, в заголовке только ASCII.
  savePng: (bytes, name) => invoke('save_png', bytes, { headers: { 'x-file-name': encodeURIComponent(name) } }),
  openPng: () => invoke('open_png'),
  copyImage: (rgba, width, height) => invoke('copy_image', rgba, { headers: { 'x-width': String(width), 'x-height': String(height) } }),
  on: (event, handler) => listen(event, (e) => handler(e.payload)),
};
