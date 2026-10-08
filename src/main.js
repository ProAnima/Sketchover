'use strict';
const path = require('node:path');
const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');

let win = null;

function createWindow() {
  const { bounds } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    ...bounds,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  // 'screen-saver' держит окно выше полноэкранных приложений и окон звонка.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'index.html'));
}

function registerShortcuts() {
  const send = (channel) => win && win.webContents.send(channel);
  globalShortcut.register('CommandOrControl+Alt+D', () => send('toggle-mode'));
  globalShortcut.register('CommandOrControl+Alt+C', () => send('clear'));
  globalShortcut.register('CommandOrControl+Alt+H', () => {
    if (!win) return;
    if (win.isVisible()) win.hide();
    else win.showInactive();
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(() => {
    createWindow();
    registerShortcuts();
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => app.quit());
}

ipcMain.on('set-ignore', (_e, ignore) => {
  if (!win) return;
  // forward: окно получает mousemove, пока клики уходят в нижние окна.
  if (ignore) win.setIgnoreMouseEvents(true, { forward: true });
  else win.setIgnoreMouseEvents(false);
});
ipcMain.on('focus', () => win && win.focus());
ipcMain.on('quit', () => app.quit());
