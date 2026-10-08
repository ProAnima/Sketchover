'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sketchover', {
  setIgnore: (ignore) => ipcRenderer.send('set-ignore', Boolean(ignore)),
  focus: () => ipcRenderer.send('focus'),
  quit: () => ipcRenderer.send('quit'),
  onToggleMode: (cb) => ipcRenderer.on('toggle-mode', () => cb()),
  onClear: (cb) => ipcRenderer.on('clear', () => cb()),
});
