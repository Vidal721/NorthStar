const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '../UI')));

const DATA_FILE = path.join(__dirname, 'data/scouting_database.json');
const SCHEMA_FILE = path.join(__dirname, 'data/schema.json');
const EQUATIONS_FILE = path.join(__dirname, 'data/equations.json');

// ── Helpers ─────────────────────────────────────────────
function readJSON(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Safe equation evaluator — runs JS formula string against a data row
function evalEquation(formula, row) {
  try {
    const keys = Object.keys(row);
    const vals = Object.values(row);
    let body = formula.trim();
    if (!body.includes('return') && !body.includes('if') && !body.includes('let') && !body.includes(';')) {
      body = `return (${body});`;
    }
    const fn = new Function(...keys, body);
    const result = fn(...vals);
    return result;
  } catch (e) {
    return null;
  }
}

// Apply all equations to a single data row (multi-pass for chained metrics)
function applyEquations(row, equations) {
  const result = { ...row };
  for (let pass = 0; pass < 2; pass++) {
    equations.forEach(eq => {
      const val = evalEquation(eq.formula, result);
      result[eq.varName] = val;
    });
  }
  return result;
}

// ── Schema API ───────────────────────────────────────────

// GET current schema
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

// PUT updated schema — migrates existing data
app.put('/api/schema', (req, res) => {
  const newSchema = req.body;
  const oldSchema = readJSON(SCHEMA_FILE, { fields: [] });
  const rawData = readJSON(DATA_FILE, []);

  const oldFields = new Set(oldSchema.fields.map(f => f.varName));
  const newFields = new Set(newSchema.fields.map(f => f.varName));

  // Fields removed from schema
  const removed = [...oldFields].filter(v => !newFields.has(v));
  // Fields added to schema
  const added = newSchema.fields.filter(f => !oldFields.has(f.varName));

  const migrated = rawData.map(row => {
    const updated = { ...row };
    // Remove dropped fields
    removed.forEach(v => delete updated[v]);
    // Add new fields with default value 0
    added.forEach(f => { updated[f.varName] = 0; });
    return updated;
  });

  newSchema.version = (oldSchema.version || 1) + 1;
  writeJSON(SCHEMA_FILE, newSchema);
  writeJSON(DATA_FILE, migrated);

  console.log(`Schema updated to v${newSchema.version}. Removed: [${removed.join(', ')}], Added: [${added.map(f=>f.varName).join(', ')}]`);
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
  const raw = readJSON(DATA_FILE, []);
  const equations = readJSON(EQUATIONS_FILE, []);
  const processed = raw.map(row => applyEquations(row, equations));
  res.json(processed);
});

// POST a new scouting submission
app.post('/api/data', (req, res) => {
  const raw = readJSON(DATA_FILE, []);
  const schema = readJSON(SCHEMA_FILE, { fields: [] });
  const submission = req.body;

  // Validate required fields exist in schema
  const validFields = new Set(['team', 'match', 'alliance', 'notes', ...schema.fields.map(f => f.varName)]);
  const cleaned = {};
  Object.entries(submission).forEach(([k, v]) => {
    if (validFields.has(k)) cleaned[k] = v;
  });

  raw.push(cleaned);
  writeJSON(DATA_FILE, raw);
  console.log(`New submission: Team ${cleaned.team}, Match ${cleaned.match}`);
  res.json({ ok: true, id: raw.length - 1 });
});

// ── Picklist API ─────────────────────────────────────────

app.get('/api/picklist', (req, res) => {
  const raw = readJSON(DATA_FILE, []);
  const equations = readJSON(EQUATIONS_FILE, []);

  // Group by team, apply equations, aggregate
  const teamMap = {};
  raw.forEach(row => {
    const processed = applyEquations(row, equations);
    const t = processed.team;
    if (!teamMap[t]) {
      teamMap[t] = { team: t, matches: 0, _rows: [] };
    }
    teamMap[t].matches++;
    teamMap[t]._rows.push(processed);
  });

  const list = Object.values(teamMap).map(entry => {
    const { team, matches, _rows } = entry;
    const agg = { team, matches };

    // Average all numeric fields
    if (_rows.length > 0) {
      const numKeys = Object.keys(_rows[0]).filter(k => typeof _rows[0][k] === 'number' && k !== 'team' && k !== 'match');
      numKeys.forEach(k => {
        agg[k] = parseFloat((_rows.reduce((s, r) => s + (r[k] || 0), 0) / _rows.length).toFixed(2));
      });
    }

    return agg;
  });

  // Sort by total_score if available, else by first numeric equation
  const equations_list = readJSON(EQUATIONS_FILE, []);
  const scoreKey = equations_list.find(e => typeof applyEquations(raw[0] || {}, equations_list)[e.varName] === 'number')?.varName || 'matches';
  list.sort((a, b) => (b[scoreKey] || 0) - (a[scoreKey] || 0));

  res.json(list);
});

// ── Per-team match history (for charts) ─────────────────
app.get('/api/team/:team/history', (req, res) => {
  const raw = readJSON(DATA_FILE, []);
  const equations = readJSON(EQUATIONS_FILE, []);
  const teamRows = raw
    .filter(r => String(r.team) === String(req.params.team))
    .map(r => applyEquations(r, equations))
    .sort((a, b) => a.match - b.match);
  res.json(teamRows);
});

// ── Server ───────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  935 USC Hub running at http://localhost:${PORT}\n`);
});