import express from "express";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import { exec } from "child_process";
import bcrypt from "bcrypt";
import db, { getOrCreateRegional } from "./db.js";

const app = express();
const PORT = 3000;

dotenv.config();

app.use(express.json());
app.use(cors());

// ==== GitHub Logic ==== //
console.log("Deploy key:", process.env.DEPLOY_KEY);

app.post("/deploy", (req, res) => {
  if (req.query.key !== process.env.DEPLOY_KEY) {
    return res.status(401).send("Unauthorized");
  }
  console.log("[deploy] Updating server...");
  exec(
    "git pull origin main && npm install && pm2 reload scouting",
    (error, stdout, stderr) => {
      if (error) {
        console.error(error);
        return res.status(500).send("Deploy failed");
      }
      console.log(stdout);
      console.error(stderr);
      res.send("Deploy successful");
    },
  );
});

// ==== JSON File Helpers ==== //
function getUsers() {
  // Read our new users tracking file
  if (!fs.existsSync("users.json")) return [];
  return JSON.parse(fs.readFileSync("users.json", "utf8"));
}

function getMatch() {
  return JSON.parse(fs.readFileSync("matchData.json", "utf8"));
}

function getPit() {
  return JSON.parse(fs.readFileSync("pitData.json", "utf8"));
}

function getPitForm() {
  return JSON.parse(fs.readFileSync("pitForm.json", "utf8"));
}

function getAdmin() {
  return JSON.parse(fs.readFileSync("adminData.json", "utf8"));
}

// ==== AUTH ENDPOINT ==== //
app.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Missing username or password" });
    }

    const users = getUsers();
    // Search the JSON structure for a matching username
    const user = users.find((u) => u.username === username);

    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Use bcrypt to check if the text password matches the stored scrambled hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Success! Return user identity and role to your React app
    console.log(`[auth] User ${username} logged in successfully as ${user.role}`);
    res.json({
      username: user.username,
      role: user.role
    });

  } catch (err) {
    console.error("[auth] Login error:", err.message);
    res.status(500).json({ error: "Internal server authentication error" });
  }
});

// ==== USER REGISTRATION ENDPOINT ==== //
app.post("/auth/register", async (req, res) => {
  try {
    const { username, password, role } = req.body;

    // 1. Validate incoming data payload
    if (!username || !password || !role) {
      return res.status(400).json({ error: "Missing username, password, or role" });
    }

    if (role !== "admin" && role !== "scouter" && role !== "family") {
      return res.status(400).json({ error: "Role must be either 'admin' or 'scouter'" });
    }

    const users = getUsers();

    // 2. Prevent duplicate usernames
    const userExists = users.some((u) => u.username === username);
    if (userExists) {
      return res.status(400).json({ error: "User already exists" });
    }

    // 3. Hash the password securely using bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 4. Construct user profile template and push to array
    const newUser = {
      username,
      passwordHash,
      role
    };
    users.push(newUser);

    // 5. Save back to users.json file sync
    fs.writeFileSync("users.json", JSON.stringify(users, null, 2));

    console.log(`[auth] Successfully created new ${role} account: ${username}`);
    res.status(201).json({ message: "User registered successfully!" });

  } catch (err) {
    console.error("[auth] Registration error:", err.message);
    res.status(500).json({ error: "Internal server registration error" });
  }
});

app.get("/users", (req, res) => {
  try {
    // REMOVED JSON.parse() from here. res.json() handles stringifying the array automatically.
    res.json(getUsers()); 
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve users memory grid." });
  }
});

// ==== Match endpoints ==== //
app.get("/match/Data/:id", (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT payload FROM match_data WHERE id = ?`).get(id);
  if (!row) return res.status(404).json({ error: "Match not found" });
  res.json(JSON.parse(row.payload));
});

app.get("/match/Data", (req, res) => {
  const rows = db.prepare(`SELECT payload FROM match_data ORDER BY created_at DESC`).all();
  res.json(rows.map((r) => JSON.parse(r.payload)));
});

// All match data for a specific regional
app.get("/match/Data/regional/:name", (req, res) => {
  const regional = db.prepare(`SELECT id FROM regionals WHERE name = ?`).get(req.params.name);
  if (!regional) return res.status(404).json({ error: "Regional not found" });
  const rows = db.prepare(`SELECT payload FROM match_data WHERE regional_id = ? ORDER BY created_at DESC`).all(regional.id);
  res.json(rows.map((r) => JSON.parse(r.payload)));
});

app.post("/match/upload", (req, res) => {
  try {
    const newData = req.body;

    if (!newData || typeof newData !== "object") {
      return res.status(400).json({ error: "Invalid request body" });
    }

    newData.id = Date.now();

    let regionalId = null;

    try {
      const schema = getPitForm();
      console.log("[upload] Active event:", schema.event);

      regionalId = getOrCreateRegional(schema.event);

      console.log("[upload] Regional ID:", regionalId);
    } catch (err) {
      console.error("[upload] Failed to load pit form:", err);
    }

    if (!regionalId) {
      return res.status(400).json({
        error: "No active regional configured"
      });
    }

    db.prepare(`
      INSERT INTO match_data (id, regional_id, team_number, match_number, scout_name, payload)
      VALUES (@id, @regionalId, @teamNumber, @matchNumber, @scoutName, @payload)
    `).run({
      id: newData.id,
      regionalId,
      teamNumber: newData.meta?.teamNumber ?? null,
      matchNumber: newData.meta?.matchNumber ?? null,
      scoutName: newData.meta?.scoutName ?? null,
      payload: JSON.stringify(newData),
    });

    console.log(
      `[upload] Match saved — team ${newData.meta?.teamNumber}, match ${newData.meta?.matchNumber}`
    );

    res.status(201).json(newData);
  } catch (err) {
    console.error("[upload] Failed to save match data:", err.message);
    res.status(500).json({
      error: "Failed to save match data",
      detail: err.message
    });
  }
});

app.delete("/delete/match/:id", (req, res) => {
  const matchId = parseInt(req.params.id);
  const result = db.prepare(`DELETE FROM match_data WHERE id = ?`).run(matchId);
  if (result.changes === 0) return res.status(404).json({ error: "Match not found" });
  return res.status(204).send();
});

// ==== Pit endpoints ==== //
app.post("/pit/upload", (req, res) => {
  try {
    const newData = req.body;

    if (!newData || typeof newData !== "object") {
      return res.status(400).json({ error: "Invalid request body" });
    }

    newData.id = Date.now();

    // Resolve regional from the active pit form schema
    let regionalId = null;
    try {
      const schema = JSON.parse(fs.readFileSync("pitForm.json", "utf8"));
      regionalId = getOrCreateRegional(schema.event);
    } catch {}

    db.prepare(`
      INSERT INTO pit_data (id, regional_id, form_id, payload)
      VALUES (@id, @regionalId, @formId, @payload)
    `).run({
      id: newData.id,
      regionalId,
      formId: newData.meta?.formId ?? null,
      payload: JSON.stringify(newData),
    });

    console.log(`[upload] Pit data saved`);
    res.status(201).json(newData);
  } catch (err) {
    console.error("[upload] Failed to save pit data:", err.message);
    res.status(500).json({ error: "Failed to save pit data", detail: err.message });
  }
});

app.get("/pit/form", (req, res) => {
  res.json(getPitForm());
});

// All pit data for a specific regional
app.get("/pit/data/regional/:name", (req, res) => {
  const regional = db.prepare(`SELECT id FROM regionals WHERE name = ?`).get(req.params.name);
  if (!regional) return res.status(404).json({ error: "Regional not found" });
  const rows = db.prepare(`SELECT payload FROM pit_data WHERE regional_id = ? ORDER BY created_at DESC`).all(regional.id);
  res.json(rows.map((r) => JSON.parse(r.payload)));
});

app.post('/pit/save', (req, res) => {
  const schema = req.body;

  if (!schema || !schema.id) {
    return res.status(400).json({ error: 'Invalid schema — missing id' });
  }

  try {
    fs.writeFileSync('pitForm.json', JSON.stringify(schema, null, 2), 'utf-8');

    // Auto-register the regional in the DB whenever the form is saved
    if (schema.event) {
      getOrCreateRegional(schema.event);
      console.log(`[form] Regional ensured in DB: ${schema.event}`);
    }

    console.log(`[form] Pit form schema saved — id: ${schema.id}`);
    res.json({ success: true, file: 'pitForm.json' });
  } catch (err) {
    console.error('[form] Failed to save schema:', err.message);
    res.status(500).json({ error: 'Failed to save schema', detail: err.message });
  }
});

// ==== Admin endpoints ==== //
app.get("/admin/data", (req, res) => {
  res.json(getAdmin());
});

app.post("/admin/upload", (req, res) => {
  try {
    const data = getAdmin();
    const newData = req.body;

    if (!newData || typeof newData !== "object") {
      return res.status(400).json({ error: "Invalid request body" });
    }

    data.push(newData);
    // Fixed file reference here from 'users' to 'data' to prevent runtime crash
    fs.writeFileSync("adminData.json", JSON.stringify(data, null, 2));

    console.log(`[upload] Admin layout saved successfully`);
    res.status(201).json(newData);
  } catch (err) {
    console.error("[upload] Failed to save admin data:", err.message);
    res.status(500).json({ error: "Failed to save admin data", detail: err.message });
  }
});

// List all regionals
app.get("/regionals", (req, res) => {
  res.json(db.prepare(`SELECT * FROM regionals ORDER BY id DESC`).all());
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});