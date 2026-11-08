'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('geoWidget', {
  // Аудит разрешений (чтение штатного журнала Windows)
  listAudit: () => ipcRenderer.invoke('audit:list'),
  // Разрешить / запретить приложению геолокацию (штатный механизм, HKCU)
  setPermission: (regPath, value) => ipcRenderer.invoke('audit:set', regPath, value),
  openLocationSettings: () => ipcRenderer.invoke('system:openLocationSettings'),
  // Страна / таймзона
  localGeo: () => ipcRenderer.invoke('geo:local'),
  ipGeo: () => ipcRenderer.invoke('geo:byIp'),
  // Управление окном
  close: () => ipcRenderer.send('win:close'),
  minimize: () => ipcRenderer.send('win:minimize'),
  togglePin: () => ipcRenderer.invoke('win:togglePin'),
});
