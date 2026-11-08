'use strict';
const { app, BrowserWindow, ipcMain, shell, screen } = require('electron');
const path = require('path');
const { execFile } = require('child_process');

const PS = 'powershell.exe';
const SCRIPTS = path.join(__dirname, 'scripts');

function runPowerShell(file, args = []) {
  return new Promise((resolve, reject) => {
    const full = [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', path.join(SCRIPTS, file),
      ...args,
    ];
    execFile(PS, full, { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

// --- Окно-виджет ------------------------------------------------------------
let win;
function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const width = 380;
  const height = 560;
  win = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - 24,
    y: workArea.y + 24,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.setAlwaysOnTop(true, 'floating');
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

// --- IPC: аудит разрешений --------------------------------------------------
ipcMain.handle('audit:list', async () => {
  try {
    const out = await runPowerShell('location-audit.ps1');
    const trimmed = (out || '').trim();
    if (!trimmed) return { ok: true, items: [] };
    let data = JSON.parse(trimmed);
    if (!Array.isArray(data)) data = [data];
    return { ok: true, items: data };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
});

ipcMain.handle('audit:set', async (_evt, regPath, value) => {
  if (value !== 'Allow' && value !== 'Deny') {
    return { ok: false, error: 'value должен быть Allow или Deny' };
  }
  try {
    const out = await runPowerShell('location-set.ps1', ['-RegPath', regPath, '-Value', value]);
    return JSON.parse((out || '').trim());
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
});

// Открыть штатную страницу настроек расположения Windows
ipcMain.handle('system:openLocationSettings', async () => {
  await shell.openExternal('ms-settings:privacy-location');
  return { ok: true };
});

// --- IPC: страна / таймзона (без правки системных часов) ---------------------
const TZ_COUNTRY = require('./src/tz-country.js');

ipcMain.handle('geo:local', async () => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const now = new Date();
  const offsetMin = -now.getTimezoneOffset();
  const country = TZ_COUNTRY[tz] || null;
  return {
    ok: true,
    timeZone: tz,
    offsetMinutes: offsetMin,
    country, // { code, name, flag } | null
    source: 'system-timezone',
    iso: now.toISOString(),
  };
});

// По желанию пользователя — уточнить страну по публичному IP (внешний запрос)
ipcMain.handle('geo:byIp', async () => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch('https://ipwho.is/?fields=success,country,country_code,timezone,flag', { signal: ctrl.signal });
    clearTimeout(t);
    const j = await r.json();
    if (!j || j.success === false) throw new Error('lookup failed');
    return {
      ok: true,
      country: { code: j.country_code, name: j.country, flag: (j.flag && j.flag.emoji) || '' },
      timeZone: (j.timezone && j.timezone.id) || null,
      source: 'ip',
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
});

// --- IPC: управление окном --------------------------------------------------
ipcMain.on('win:close', () => win && win.close());
ipcMain.on('win:minimize', () => win && win.minimize());
ipcMain.handle('win:togglePin', () => {
  const next = !win.isAlwaysOnTop();
  win.setAlwaysOnTop(next, 'floating');
  return next;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
