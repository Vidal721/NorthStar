const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
require('../Server/Server.js');

// ── Data directory ────────────────────────────────────────────────────────────
const DATA_DIR = app.isPackaged
  ? path.join(app.getPath('userData'), 'data')
  : path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const PATHS = {
  users: path.join(DATA_DIR, 'users.json'),
  data: path.join(DATA_DIR, 'data.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
};

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  setupComplete: false,
  teamNumber: '',
  teamName: '',
  school: '',
  city: '',
  state: '',
  yearsInFirst: 0,
  theme: { id: 'bluepurple', css: 'radial-gradient(ellipse 80% 80% at 20% 20%,rgba(10,132,255,0.18),transparent),radial-gradient(ellipse 60% 60% at 80% 80%,rgba(191,90,242,0.20),transparent),#060a18' },
  colors: { primary: '#0a84ff', secondary: '#bf5af2', accent: '#ffd60a' },
  display: { mode: 'Dark', fontSize: 'Medium', fontSizePx: 15, cardStyle: 'Glass', radius: 'Rounded', density: 'Default' },
  scouting: { system: '', priority: '', events: '', device: 'Phone' },
  adminRoles: ['coach', 'lead'],
  perUserDashboard: false,
  activeGame: '',
};

const DEFAULT_USERS = { members: [], nextId: 1 };
const DEFAULT_DATA = { games: [], matchLogs: [], activity: [], nextGameId: 1 };

// ── Helpers ───────────────────────────────────────────────────────────────────
function readFile(key) {
  try {
    if (!fs.existsSync(PATHS[key])) {
      const def = key === 'settings' ? DEFAULT_SETTINGS : key === 'users' ? DEFAULT_USERS : DEFAULT_DATA;
      fs.writeFileSync(PATHS[key], JSON.stringify(def, null, 2));
      return JSON.parse(JSON.stringify(def));
    }
    return JSON.parse(fs.readFileSync(PATHS[key], 'utf8'));
  } catch (e) {
    console.error(`Error reading ${key}:`, e);
    return key === 'settings' ? DEFAULT_SETTINGS : key === 'users' ? DEFAULT_USERS : DEFAULT_DATA;
  }
}

function writeFile(key, data) {
  try {
    fs.writeFileSync(PATHS[key], JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error(`Error writing ${key}:`, e);
    return false;
  }
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.handle('load-all', () => {
  const settings = readFile('settings');
  const users = readFile('users');
  const data = readFile('data');
  return { firstRun: !settings.setupComplete, settings, users, data };
});

ipcMain.handle('setup-complete', (_, { config, adminUser }) => {
  const settings = {
    ...DEFAULT_SETTINGS,
    setupComplete: true,
    teamNumber: config.team.number,
    teamName: config.team.name,
    school: config.team.school,
    city: config.team.city,
    state: config.team.state,
    yearsInFirst: config.team.yearsInFirst,
    theme: config.theme,
    colors: config.colors,
    display: config.display,
    scouting: config.scouting,
    adminRoles: ['coach', 'lead'],
    perUserDashboard: false,
    activeGame: '',
  };
  writeFile('settings', settings);

  const users = readFile('users');
  adminUser.id = users.nextId++;
  adminUser.mins = 0;
  adminUser.matches = 0;
  adminUser.status = 'active';
  users.members.push(adminUser);
  writeFile('users', users);

  return { ok: true };
});

ipcMain.handle('auth-login', (_, { username, password }) => {
  const users = readFile('users');
  const settings = readFile('settings');
  const member = users.members.find(m => m.username === username && m.password === password);
  if (!member) return { ok: false, error: 'Invalid username or password.' };
  const isAdmin = (settings.adminRoles || []).includes(member.role);
  return { ok: true, member, isAdmin };
});

ipcMain.handle('users-get', () => readFile('users'));
ipcMain.handle('settings-get', () => readFile('settings'));
ipcMain.handle('data-get', () => readFile('data'));

ipcMain.handle('users-add', (_, member) => {
  const users = readFile('users');
  member.id = users.nextId++;
  users.members.push(member);
  return writeFile('users', users);
});

ipcMain.handle('users-update', (_, { id, changes }) => {
  const users = readFile('users');
  users.members = users.members.map(m => m.id === id ? { ...m, ...changes } : m);
  return writeFile('users', users);
});

ipcMain.handle('users-remove', (_, id) => {
  const users = readFile('users');
  users.members = users.members.filter(m => m.id !== id);
  return writeFile('users', users);
});

ipcMain.handle('settings-save', (_, newSettings) => {
  const current = readFile('settings');
  return writeFile('settings', { ...current, ...newSettings });
});

ipcMain.handle('data-add-game', (_, game) => {
  const data = readFile('data');
  game.id = data.nextGameId++;
  data.games.push(game);
  return writeFile('data', data);
});

ipcMain.handle('data-set-active-game', (_, gameId) => {
  const data = readFile('data');
  data.games = data.games.map(g => ({
    ...g,
    status: g.id === gameId ? 'active' : (g.status === 'active' ? 'archived' : g.status),
  }));
  writeFile('data', data);
  const settings = readFile('settings');
  const game = data.games.find(g => g.id === gameId);
  if (game) { settings.activeGame = game.name; writeFile('settings', settings); }
  return true;
});

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    icon: path.join(__dirname, '../build/icon.png'),
    backgroundColor: '#060a18',
    show: false,
  });
  win.loadFile('Laptop-Setup/index.html');
  win.once('ready-to-show', () => win.show());
}




app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });