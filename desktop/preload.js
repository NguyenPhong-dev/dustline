/* Dustline desktop - preload.js: the small bridge the game uses to talk to the app window. */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dustlineDesktop', {
  platform: process.platform,
  quit: () => ipcRenderer.send('dl:quit'),
  setFullscreen: (on) => ipcRenderer.send('dl:fullscreen', !!on),
  isFullscreen: () => ipcRenderer.invoke('dl:isFullscreen'),
  onFullscreenChange: (cb) => {
    ipcRenderer.on('dl:fullscreen-changed', (_e, on) => cb(!!on));
  },
});
