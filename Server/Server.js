const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname)));        // files next to Server.js
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '../UI')));

// Named convenience routes — /admin and /scout always work
function sendFirst(res, ...candidates) {
  for (const f of candidates) {
    if (fs.existsSync(f)) return res.sendFile(f);
  }
  res.status(404).send('HTML file not found. Place index.html & scout.html in the same folder as Server.js.');
}
const dirs = [__dirname, path.join(__dirname, 'public'), path.join(__dirname, '../UI')];
app.get('/admin', (req, res) => sendFirst(res, ...dirs.map(d => path.join(d, 'index.html'))));
app.get('/scout', (req, res) => sendFirst(res, ...dirs.map(d => path.join(d, 'scout.html'))));

const DATA_FILE      = path.join(__dirname, 'data/scouting_database.json');
const SCHEMA_FILE    = path.join(__dirname, 'data/schema.json');
const EQUATIONS_FILE = path.join(__dirname, 'data/equations.json');

// ── In-Memory Real-Time State ────────────────────────────
const scouterProgress = {};  // scouter_id → { match, team, alliance, pct, fieldValues, lastSeen }
const pendingFills    = {};  // scouter_id → { varName: value, ... }
const chatLog         = [];  // [{ role, from, text, time }]  — last 100 msgs

// ── Helpers ──────────────────────────────────────────────
function readJSON(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { return fallback; }
}
function writeJSON(file, data) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function nowTime() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Safe equation evaluator
function evalEquation(formula, row) {
  try {
    const keys = Object.keys(row);
    const vals = Object.values(row);
    let body = formula.trim();
    if (!body.includes('return') && !body.includes('if') && !body.includes('let') && !body.includes(';')) {
      body = `return (${body});`;
    }
    return new Function(...keys, body)(...vals);
  } catch (e) { return null; }
}

// Apply all equations to a single data row (multi-pass for chained metrics)
function applyEquations(row, equations) {
  const result = { ...row };
  for (let pass = 0; pass < 2; pass++) {
    equations.forEach(eq => { result[eq.varName] = evalEquation(eq.formula, result); });
  }
  return result;
}

// ── Schema API ───────────────────────────────────────────

app.get('/api/schema', (req, res) => {
  const schema = readJSON(SCHEMA_FILE, {
    version: 1,
    fields: [
      { varName: 'auto_high',      label: 'Auto High Goals',   type: 'counter', min: 0, max: 6,  group: 'Autonomous' },
      { varName: 'auto_low',       label: 'Auto Low Goals',    type: 'counter', min: 0, max: 6,  group: 'Autonomous' },
      { varName: 'tele_cubes',     label: 'Teleop Cubes',      type: 'counter', min: 0, max: 20, group: 'Teleop' },
      { varName: 'tele_cones',     label: 'Teleop Cones',      type: 'counter', min: 0, max: 20, group: 'Teleop' },
      { varName: 'climb_level',    label: 'Climb Level (0–3)', type: 'counter', min: 0, max: 3,  group: 'Endgame' },
      { varName: 'defense_rating', label: 'Defense Rating',    type: 'slider',  min: 0, max: 5,  group: 'Teleop' },
    ]
  });
  res.json(schema);
});

app.put('/api/schema', (req, res) => {
  const newSchema = req.body;
  const oldSchema = readJSON(SCHEMA_FILE, { fields: [] });
  const rawData   = readJSON(DATA_FILE, []);

  const oldFields = new Set(oldSchema.fields.map(f => f.varName));
  const newFields = new Set(newSchema.fields.map(f => f.varName));
  const removed   = [...oldFields].filter(v => !newFields.has(v));
  const added     = newSchema.fields.filter(f => !oldFields.has(f.varName));

  const migrated = rawData.map(row => {
    const updated = { ...row };
    removed.forEach(v => delete updated[v]);
    added.forEach(f => { updated[f.varName] = 0; });
    return updated;
  });

  newSchema.version = (oldSchema.version || 1) + 1;
  writeJSON(SCHEMA_FILE, newSchema);
  writeJSON(DATA_FILE, migrated);

  console.log(`Schema → v${newSchema.version}. Removed: [${removed.join(', ')}] Added: [${added.map(f=>f.varName).join(', ')}]`);
  res.json({ ok: true, version: newSchema.version, removed, added: added.map(f=>f.varName), rowsUpdated: migrated.length });
});

// ── Equations API ────────────────────────────────────────

app.get('/api/equations', (req, res) => {
  res.json(readJSON(EQUATIONS_FILE, [
    { id: 'eq1', varName: 'total_score',  label: 'Total Score',  formula: '(auto_high * 4) + (auto_low * 2) + (tele_cubes * 2) + (tele_cones * 1)' },
    { id: 'eq2', varName: 'climb_pts',   label: 'Climb Points', formula: 'climb_level * 6' },
    { id: 'eq3', varName: 'climb_status',label: 'Climb Status', formula: 'if (climb_level === 0) return "None"; if (climb_level === 1) return "Low"; if (climb_level === 2) return "Mid"; return "High";' },
  ]));
});

app.put('/api/equations', (req, res) => {
  writeJSON(EQUATIONS_FILE, req.body);
  res.json({ ok: true });
});

// ── Scouting Data API ────────────────────────────────────

app.get('/api/data', (req, res) => {
  const raw       = readJSON(DATA_FILE, []);
  const equations = readJSON(EQUATIONS_FILE, []);
  res.json(raw.map(row => applyEquations(row, equations)));
});

app.post('/api/data', (req, res) => {
  const raw       = readJSON(DATA_FILE, []);
  const schema    = readJSON(SCHEMA_FILE, { fields: [] });
  const submission = req.body;

  const validFields = new Set(['team', 'match', 'alliance', 'notes', 'scouter_id', ...schema.fields.map(f => f.varName)]);
  const cleaned = {};
  Object.entries(submission).forEach(([k, v]) => { if (validFields.has(k)) cleaned[k] = v; });

  raw.push(cleaned);
  writeJSON(DATA_FILE, raw);
  console.log(`[DATA] New submission: Team ${cleaned.team}, Match ${cleaned.match}, Scouter: ${cleaned.scouter_id}`);
  res.json({ ok: true, id: raw.length - 1 });
});

// DELETE a single submission by index
app.delete('/api/data/:id', (req, res) => {
  const raw = readJSON(DATA_FILE, []);
  const id  = parseInt(req.params.id);
  if (isNaN(id) || id < 0 || id >= raw.length) return res.status(404).json({ error: 'Not found' });
  raw.splice(id, 1);
  writeJSON(DATA_FILE, raw);
  res.json({ ok: true });
});

// ── Picklist API ─────────────────────────────────────────

app.get('/api/picklist', (req, res) => {
  const raw            = readJSON(DATA_FILE, []);
  const equations      = readJSON(EQUATIONS_FILE, []);
  const equations_list = equations;

  const teamMap = {};
  raw.forEach(row => {
    const processed = applyEquations(row, equations);
    const t = processed.team;
    if (!teamMap[t]) teamMap[t] = { team: t, matches: 0, _rows: [] };
    teamMap[t].matches++;
    teamMap[t]._rows.push(processed);
  });

  const list = Object.values(teamMap).map(entry => {
    const { team, matches, _rows } = entry;
    const agg = { team, matches };
    if (_rows.length > 0) {
      const numKeys = Object.keys(_rows[0]).filter(k => typeof _rows[0][k] === 'number' && k !== 'team' && k !== 'match');
      numKeys.forEach(k => {
        agg[k] = parseFloat((_rows.reduce((s, r) => s + (r[k] || 0), 0) / _rows.length).toFixed(2));
      });
    }
    return agg;
  });

  const scoreKey = equations_list.find(e => raw[0] && typeof applyEquations(raw[0], equations_list)[e.varName] === 'number')?.varName || 'matches';
  list.sort((a, b) => (b[scoreKey] || 0) - (a[scoreKey] || 0));
  res.json(list);
});

// ── Per-team match history ───────────────────────────────
app.get('/api/team/:team/history', (req, res) => {
  const raw       = readJSON(DATA_FILE, []);
  const equations = readJSON(EQUATIONS_FILE, []);
  const teamRows  = raw
    .filter(r => String(r.team) === String(req.params.team))
    .map(r => applyEquations(r, equations))
    .sort((a, b) => a.match - b.match);
  res.json(teamRows);
});

// ── Scout Progress ───────────────────────────────────────

// Scouter pushes their live form state
app.post('/api/scout-progress', (req, res) => {
  const { scouter_id, display_name, match, team, alliance, pct, fieldValues } = req.body;
  if (!scouter_id) return res.status(400).json({ error: 'scouter_id required' });
  // If scouter now has a real name, migrate any pending fills from old key
  const entry = scouterProgress[scouter_id] || {};
  if (display_name && display_name !== scouter_id && pendingFills[scouter_id]) {
    pendingFills[display_name] = Object.assign({}, pendingFills[display_name] || {}, pendingFills[scouter_id]);
    delete pendingFills[scouter_id];
  }
  scouterProgress[scouter_id] = { scouter_id, display_name: display_name || scouter_id, match, team, alliance, pct, fieldValues, lastSeen: Date.now() };
  res.json({ ok: true });
});

// Admin fetches all active scouter states
app.get('/api/scout-progress', (req, res) => {
  const now = Date.now();
  // Prune scouters idle > 5 min
  Object.keys(scouterProgress).forEach(id => {
    if (now - scouterProgress[id].lastSeen > 5 * 60 * 1000) delete scouterProgress[id];
  });
  res.json(Object.values(scouterProgress));
});

// ── Admin Fill ───────────────────────────────────────────

// Admin queues field fills for a specific scouter
app.post('/api/admin-fill', (req, res) => {
  const { scouter_id, fieldValues } = req.body;
  if (!scouter_id || !fieldValues) return res.status(400).json({ error: 'scouter_id and fieldValues required' });
  if (!pendingFills[scouter_id]) pendingFills[scouter_id] = {};
  Object.assign(pendingFills[scouter_id], fieldValues);
  console.log(`[ADMIN-FILL] → ${scouter_id}:`, fieldValues);
  res.json({ ok: true });
});

// ── Scout Updates Poll ───────────────────────────────────

// Scouter polls this every few seconds — gets pending fills + recent chat
app.get('/api/scout-updates', (req, res) => {
  const { scouter_id } = req.query;
  // Collect fills addressed to this scouter_id OR their display_name
  const entry = Object.values(scouterProgress).find(e => e.scouter_id === scouter_id);
  const displayName = entry?.display_name;
  const fills = {};
  if (scouter_id && pendingFills[scouter_id]) { Object.assign(fills, pendingFills[scouter_id]); delete pendingFills[scouter_id]; }
  if (displayName && displayName !== scouter_id && pendingFills[displayName]) { Object.assign(fills, pendingFills[displayName]); delete pendingFills[displayName]; }
  res.json({ fillFields: fills, messages: chatLog.slice(-60) });
});

// ── Chat API ─────────────────────────────────────────────

app.get('/api/chat', (req, res) => {
  res.json(chatLog.slice(-60));
});

app.post('/api/chat', (req, res) => {
  const msg = {
    ...req.body,
    time: req.body.time || nowTime()
  };
  if (!msg.text || !msg.from) return res.status(400).json({ error: 'from and text required' });
  chatLog.push(msg);
  if (chatLog.length > 100) chatLog.shift();
  console.log(`[CHAT] [${msg.role || 'scouter'}] ${msg.from}: ${msg.text}`);
  res.json({ ok: true });
});

// DELETE all chat history (admin)
app.delete('/api/chat', (req, res) => {
  chatLog.length = 0;
  res.json({ ok: true });
});

// ── Health Check ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    time: nowTime(),
    submissions: readJSON(DATA_FILE, []).length,
    activeScouters: Object.keys(scouterProgress).length,
    chatMessages: chatLog.length,
  });
});

// ── Server ───────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║   NorthStar · Team 935 Scout Hub     ║`);
  console.log(`  ║   http://localhost:${PORT}              ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);
  // Ensure data directory exists
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
});