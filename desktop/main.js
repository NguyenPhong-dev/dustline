/* Dustline desktop - main.js: an Electron window around the browser game. MIT License.
 *
 * The game itself is unchanged web code in ./game. This file only opens the window,
 * remembers its size, adds native menus and fullscreen, and keeps navigation inside the app.
 * Run with --selftest=<folder> to play a bot-only round, save screenshots and quit. */
'use strict';
const { app, BrowserWindow, Menu, ipcMain, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const VERSION = require('./package.json').version;
const selftestArg = process.argv.find((a) => a.startsWith('--selftest='));
const selftestDir = selftestArg ? selftestArg.slice('--selftest='.length) : null;

app.setName('Dustline');
app.setAboutPanelOptions({
  applicationName: 'Dustline',
  applicationVersion: VERSION,
  copyright: 'MIT License',
  credits: 'A free, open-source 5v5 bomb-defusal shooter. Built with three.js and Electron.',
});

let win = null;

// ---------- Window size and position, remembered between launches ----------
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
function readState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch (e) { return {}; }
}
function writeState() {
  if (!win || selftestDir) return;
  try {
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify({ bounds: win.getNormalBounds(), fullscreen: win.isFullScreen(), maximized: win.isMaximized() }));
  } catch (e) { /* not fatal */ }
}
// Ignore saved bounds that would put the window off every connected screen.
function visible(b) {
  return !!b && screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return b.x < a.x + a.width - 100 && b.x + b.width > a.x + 100 && b.y < a.y + a.height - 60 && b.y + b.height > a.y + 30;
  });
}

function createWindow() {
  const st = selftestDir ? {} : readState();
  const area = screen.getPrimaryDisplay().workAreaSize;
  const fallback = { width: Math.min(1600, Math.round(area.width * 0.85)), height: Math.min(900, Math.round(area.height * 0.85)) };
  win = new BrowserWindow({
    ...(visible(st.bounds) ? st.bounds : fallback),
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Dustline',
    backgroundColor: '#0d0f12',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  if (st.maximized) win.maximize();
  win.loadFile(path.join(__dirname, 'game', 'index.html'));
  win.once('ready-to-show', () => {
    win.show();
    if (st.fullscreen) win.setFullScreen(true);
  });

  // Keep the game in this window; real web links open in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });
  const sendFullscreen = () => win && win.webContents.send('dl:fullscreen-changed', win.isFullScreen());
  win.on('enter-full-screen', sendFullscreen);
  win.on('leave-full-screen', sendFullscreen);
  let saveTimer = null;
  for (const ev of ['resize', 'move', 'enter-full-screen', 'leave-full-screen']) {
    win.on(ev, () => { clearTimeout(saveTimer); saveTimer = setTimeout(writeState, 400); });
  }
  win.on('close', writeState);
  win.on('closed', () => { win = null; });
  if (selftestDir) runSelftest();
}

function buildMenu() {
  const mac = process.platform === 'darwin';
  // No Close Window or Reload shortcuts, so a stray Cmd+W or Cmd+R cannot end a match.
  const template = [
    ...(mac ? [{
      label: 'Dustline',
      submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }],
    }] : [{ label: 'Game', submenu: [{ role: 'quit' }] }]),
    { label: 'View', submenu: [{ role: 'togglefullscreen' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, ...(mac ? [{ role: 'zoom' }] : [])] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.on('dl:quit', () => app.quit());
ipcMain.on('dl:fullscreen', (_e, on) => { if (win) win.setFullScreen(!!on); });
ipcMain.handle('dl:isFullscreen', () => !!win && win.isFullScreen());

if (!selftestDir && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(() => {
    buildMenu();
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}

// ---------- Self-test: proves the packaged game boots, renders and plays ----------
function runSelftest() {
  const out = path.resolve(selftestDir);
  fs.mkdirSync(out, { recursive: true });
  const log = [];
  win.webContents.on('console-message', (...args) => {
    const e = args[0] || {};
    log.push((e.level !== undefined ? e.level : args[1]) + ': ' + (e.message !== undefined ? e.message : args[2]));
  });
  win.webContents.on('render-process-gone', (_e, details) => log.push('renderer gone: ' + JSON.stringify(details)));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const save = (name, data) => fs.writeFileSync(path.join(out, name), data);
  win.webContents.once('did-finish-load', async () => {
    try {
      await wait(5000);
      save('menu.png', (await win.webContents.capturePage()).toPNG());
      const result = await win.webContents.executeJavaScript(`(() => {
        const G = DL.game;
        DL.input.noLock = true;
        G.startMatch('CT');
        G.me.isBot = true;
        DL.ai.planRound(G);
        const t0 = performance.now();
        G.simulate(45);
        window.__frames = 0;
        (function count() { window.__frames++; requestAnimationFrame(count); })();
        window.__t0 = performance.now();
        return {
          simulatedSecondsCostMs: Math.round(performance.now() - t0),
          round: G.round, score: G.score, state: G.state,
          desktopBridge: !!window.dustlineDesktop,
          fontsLoaded: document.fonts.check('40px "Saira Stencil One"') && document.fonts.check('600 16px "Saira Condensed"'),
          renderer: DL.three.renderer.getContext().getParameter(DL.three.renderer.getContext().VERSION),
        };
      })()`);
      await wait(8000);
      const live = await win.webContents.executeJavaScript(`({
        fps: Math.round(window.__frames / ((performance.now() - window.__t0) / 1000)),
        round: DL.game.round, state: DL.game.state, score: DL.game.score,
        kills: DL.game.soldiers.reduce((n, s) => n + s.kills, 0),
      })`);
      save('game.png', (await win.webContents.capturePage()).toPNG());
      save('result.json', JSON.stringify({ ok: true, version: VERSION, electron: process.versions.electron, result, live, gpu: app.getGPUFeatureStatus(), log }, null, 2));
    } catch (err) {
      save('result.json', JSON.stringify({ ok: false, error: String((err && err.stack) || err), log }, null, 2));
    }
    app.quit();
  });
}
