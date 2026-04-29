const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadAll: () => ipcRenderer.invoke('load-all'),
  setupComplete: (payload) => ipcRenderer.invoke('setup-complete', payload),
  login: (creds) => ipcRenderer.invoke('auth-login', creds),
  getUsers: () => ipcRenderer.invoke('users-get'),
  addUser: (member) => ipcRenderer.invoke('users-add', member),
  updateUser: (id, changes) => ipcRenderer.invoke('users-update', { id, changes }),
  removeUser: (id) => ipcRenderer.invoke('users-remove', id),
  getSettings: () => ipcRenderer.invoke('settings-get'),
  saveSettings: (s) => ipcRenderer.invoke('settings-save', s),
  getData: () => ipcRenderer.invoke('data-get'),
  addGame: (game) => ipcRenderer.invoke('data-add-game', game),
  setActiveGame: (id) => ipcRenderer.invoke('data-set-active-game', id),
});