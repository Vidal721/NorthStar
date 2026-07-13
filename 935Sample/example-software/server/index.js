import express from "express";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import { exec } from "child_process";
import bcrypt from "bcrypt";
import db, { getOrCreateRegional } from "./db.js";
import { fileURLToPath } from "url";
import path from "path";
import multer from "multer";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },

  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

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

const parseHelperForm = (row) => {
  const payload = JSON.parse(row.payload);
  return {
    ...payload,
    id: row.id,
    title: row.title,
    description: row.description || "",
    status: row.status,
    createdAt: row.created_at,
    sentAt: row.sent_at || payload.sentAt,
    updatedAt: row.updated_at,
    responseCount: row.response_count ?? 0,
  };
};

const saveHelperForm = (form) => {
  const now = new Date().toISOString();
  const createdAt = form.createdAt || now;
  const updatedAt = now;
  const sentAt = form.sentAt || null;
  const status = form.status === "sent" ? "sent" : "draft";
  const payload = {
    ...form,
    status,
    createdAt,
    sentAt,
    updatedAt,
  };

  db.prepare(
    `
    INSERT INTO helper_forms (id, title, description, status, payload, created_at, sent_at, updated_at)
    VALUES (@id, @title, @description, @status, @payload, @createdAt, @sentAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      status = excluded.status,
      payload = excluded.payload,
      sent_at = excluded.sent_at,
      updated_at = excluded.updated_at
  `,
  ).run({
    id: payload.id,
    title: payload.title || "Untitled form",
    description: payload.description || "",
    status,
    payload: JSON.stringify(payload),
    createdAt,
    sentAt,
    updatedAt,
  });

  return payload;
};

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
    console.log(
      `[auth] User ${username} logged in successfully as ${user.role}`,
    );
    res.json({
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    console.error("[auth] Login error:", err.message);
    res.status(500).json({ error: "Internal server authentication error" });
  }
});

// ==== USER REGISTRATION ENDPOINT ==== //
app.post("/auth/register", async (req, res) => {
  try {
    const { username, password, role, subgroup } = req.body;

    // 1. Validate incoming data payload
    if (!username || !password || !role || !subgroup) {
      return res
        .status(400)
        .json({ error: "Missing username, password, or role" });
    }

    const allowedRoles = [
      "admin",
      "scouter",
      "family",
      "helper",
      "student",
      "students",
      "teamMember",
      "coach",
      "Mentor",
    ];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Unsupported account role" });
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
      role,
      subgroup,
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

// ==== Helper form endpoints ==== //
app.get("/helper/forms", (req, res) => {
  try {
    const rows = db
      .prepare(
        `
      SELECT helper_forms.*,
        COUNT(helper_form_responses.id) AS response_count
      FROM helper_forms
      LEFT JOIN helper_form_responses ON helper_form_responses.form_id = helper_forms.id
      GROUP BY helper_forms.id
      ORDER BY helper_forms.created_at DESC
    `,
      )
      .all();
    res.json(rows.map(parseHelperForm));
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to load forms", detail: err.message });
  }
});

app.post("/helper/forms", (req, res) => {
  try {
    const form = req.body;
    if (!form || !form.id) {
      return res.status(400).json({ error: "Invalid form payload" });
    }
    res.status(201).json(saveHelperForm(form));
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to create form", detail: err.message });
  }
});

app.patch("/helper/forms/:id", (req, res) => {
  try {
    const row = db
      .prepare("SELECT * FROM helper_forms WHERE id = ?")
      .get(req.params.id);
    if (!row) return res.status(404).json({ error: "Form not found" });

    const current = parseHelperForm(row);
    const next = { ...current, ...req.body, id: req.params.id };
    res.json(saveHelperForm(next));
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to update form", detail: err.message });
  }
});

app.delete("/helper/forms/:id", (req, res) => {
  try {
    const result = db
      .prepare("DELETE FROM helper_forms WHERE id = ?")
      .run(req.params.id);
    if (result.changes === 0)
      return res.status(404).json({ error: "Form not found" });
    res.status(204).send();
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to delete form", detail: err.message });
  }
});

app.get("/helper/forms/:id/responses", (req, res) => {
  try {
    const rows = db
      .prepare(
        `
      SELECT * FROM helper_form_responses
      WHERE form_id = ?
      ORDER BY submitted_at DESC
    `,
      )
      .all(req.params.id);
    res.json(rows.map((row) => ({ ...JSON.parse(row.payload), id: row.id })));
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to load responses", detail: err.message });
  }
});

app.get("/forms/sent", (req, res) => {
  try {
    const rows = db
      .prepare(
        `
      SELECT helper_forms.*,
        COUNT(helper_form_responses.id) AS response_count
      FROM helper_forms
      LEFT JOIN helper_form_responses ON helper_form_responses.form_id = helper_forms.id
      WHERE helper_forms.status = 'sent'
      GROUP BY helper_forms.id
      ORDER BY helper_forms.sent_at DESC, helper_forms.created_at DESC
    `,
      )
      .all();
    res.json(rows.map(parseHelperForm));
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to load sent forms", detail: err.message });
  }
});

app.get("/forms/:id", (req, res) => {
  try {
    const row = db
      .prepare("SELECT * FROM helper_forms WHERE id = ? AND status = 'sent'")
      .get(req.params.id);
    if (!row) return res.status(404).json({ error: "Form not found" });
    res.json(parseHelperForm(row));
  } catch (err) {
    res.status(500).json({ error: "Failed to load form", detail: err.message });
  }
});

app.post("/forms/:id/responses", (req, res) => {
  try {
    const form = db
      .prepare("SELECT * FROM helper_forms WHERE id = ? AND status = 'sent'")
      .get(req.params.id);
    if (!form) return res.status(404).json({ error: "Form not found" });

    const response = {
      id: req.body?.id || `response-${Date.now()}`,
      formId: req.params.id,
      respondent: req.body?.respondent || null,
      answers: req.body?.answers || {},
      submittedAt: new Date().toISOString(),
    };

    db.prepare(
      `
      INSERT INTO helper_form_responses (id, form_id, respondent, payload, submitted_at)
      VALUES (@id, @formId, @respondent, @payload, @submittedAt)
    `,
    ).run({
      id: response.id,
      formId: response.formId,
      respondent: response.respondent,
      payload: JSON.stringify(response),
      submittedAt: response.submittedAt,
    });

    res.status(201).json(response);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to submit response", detail: err.message });
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
  const rows = db
    .prepare(`SELECT payload FROM match_data ORDER BY created_at DESC`)
    .all();
  res.json(rows.map((r) => JSON.parse(r.payload)));
});

// All match data for a specific regional
app.get("/match/Data/regional/:name", (req, res) => {
  const regional = db
    .prepare(`SELECT id FROM regionals WHERE name = ?`)
    .get(req.params.name);
  if (!regional) return res.status(404).json({ error: "Regional not found" });
  const rows = db
    .prepare(
      `SELECT payload FROM match_data WHERE regional_id = ? ORDER BY created_at DESC`,
    )
    .all(regional.id);
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
        error: "No active regional configured",
      });
    }

    db.prepare(
      `
      INSERT INTO match_data (id, regional_id, team_number, match_number, scout_name, payload)
      VALUES (@id, @regionalId, @teamNumber, @matchNumber, @scoutName, @payload)
    `,
    ).run({
      id: newData.id,
      regionalId,
      teamNumber: newData.meta?.teamNumber ?? null,
      matchNumber: newData.meta?.matchNumber ?? null,
      scoutName: newData.meta?.scoutName ?? null,
      payload: JSON.stringify(newData),
    });

    console.log(
      `[upload] Match saved — team ${newData.meta?.teamNumber}, match ${newData.meta?.matchNumber}`,
    );

    res.status(201).json(newData);
  } catch (err) {
    console.error("[upload] Failed to save match data:", err.message);
    res.status(500).json({
      error: "Failed to save match data",
      detail: err.message,
    });
  }
});

app.delete("/delete/match/:id", (req, res) => {
  const matchId = parseInt(req.params.id);
  const result = db.prepare(`DELETE FROM match_data WHERE id = ?`).run(matchId);
  if (result.changes === 0)
    return res.status(404).json({ error: "Match not found" });
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

    db.prepare(
      `
      INSERT INTO pit_data (id, regional_id, form_id, payload)
      VALUES (@id, @regionalId, @formId, @payload)
    `,
    ).run({
      id: newData.id,
      regionalId,
      formId: newData.meta?.formId ?? null,
      payload: JSON.stringify(newData),
    });

    console.log(`[upload] Pit data saved`);
    res.status(201).json(newData);
  } catch (err) {
    console.error("[upload] Failed to save pit data:", err.message);
    res
      .status(500)
      .json({ error: "Failed to save pit data", detail: err.message });
  }
});

app.get("/pit/form", (req, res) => {
  res.json(getPitForm());
});

// All pit data for a specific regional
app.get("/pit/data/regional/:name", (req, res) => {
  const regional = db
    .prepare(`SELECT id FROM regionals WHERE name = ?`)
    .get(req.params.name);
  if (!regional) return res.status(404).json({ error: "Regional not found" });
  const rows = db
    .prepare(
      `SELECT payload FROM pit_data WHERE regional_id = ? ORDER BY created_at DESC`,
    )
    .all(regional.id);
  res.json(rows.map((r) => JSON.parse(r.payload)));
});

app.post("/pit/save", (req, res) => {
  const schema = req.body;

  if (!schema || !schema.id) {
    return res.status(400).json({ error: "Invalid schema — missing id" });
  }

  try {
    fs.writeFileSync("pitForm.json", JSON.stringify(schema, null, 2), "utf-8");

    // Auto-register the regional in the DB whenever the form is saved
    if (schema.event) {
      getOrCreateRegional(schema.event);
      console.log(`[form] Regional ensured in DB: ${schema.event}`);
    }

    console.log(`[form] Pit form schema saved — id: ${schema.id}`);
    res.json({ success: true, file: "pitForm.json" });
  } catch (err) {
    console.error("[form] Failed to save schema:", err.message);
    res
      .status(500)
      .json({ error: "Failed to save schema", detail: err.message });
  }
});

// ==== REGIONALS GATEWAY ==== //
app.get("/api/regionals", (req, res) => {
  try {
    const rows = db
      .prepare("SELECT * FROM regionals ORDER BY year DESC, name ASC")
      .all();
    res.json(rows);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch regionals", detail: err.message });
  }
});

app.patch("/api/regionals/:id/visibility", (req, res) => {
  try {
    const id = Number(req.params.id);
    const visible = req.body?.visible;

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid regional id" });
    }

    if (typeof visible !== "boolean") {
      return res
        .status(400)
        .json({ error: "Visibility must be true or false" });
    }

    const result = db
      .prepare("UPDATE regionals SET visible_in_vis = ? WHERE id = ?")
      .run(visible ? 1 : 0, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Regional not found" });
    }

    const updated = db.prepare("SELECT * FROM regionals WHERE id = ?").get(id);
    res.json(updated);
  } catch (err) {
    res
      .status(500)
      .json({
        error: "Failed to update regional visibility",
        detail: err.message,
      });
  }
});

// ==== COMBINED SCOUTING DATA GATEWAY ==== //
app.get("/admin/data", (req, res) => {
  try {
    const regionalId = req.query.regional_id;

    let matchQuery = `
      SELECT match_data.*, regionals.name as regional_name 
      FROM match_data 
      JOIN regionals ON match_data.regional_id = regionals.id
    `;
    let pitQuery = `
      SELECT pit_data.*, regionals.name as regional_name 
      FROM pit_data 
      JOIN regionals ON pit_data.regional_id = regionals.id
    `;

    const matchRows = regionalId
      ? db
          .prepare(
            `${matchQuery} WHERE match_data.regional_id = ? ORDER BY match_data.created_at DESC`,
          )
          .all(regionalId)
      : db.prepare(`${matchQuery} ORDER BY match_data.created_at DESC`).all();

    const pitRows = regionalId
      ? db
          .prepare(
            `${pitQuery} WHERE pit_data.regional_id = ? ORDER BY pit_data.created_at DESC`,
          )
          .all(regionalId)
      : db.prepare(`${pitQuery} ORDER BY pit_data.created_at DESC`).all();

    // Parse JSON text payloads for client app processing
    const matches = matchRows.map((row) => ({
      ...row,
      payload: JSON.parse(row.payload),
    }));
    const pits = pitRows.map((row) => ({
      ...row,
      payload: JSON.parse(row.payload),
    }));

    res.json({ matches, pits });
  } catch (err) {
    res
      .status(500)
      .json({
        error: "Failed to compile admin telemetry metrics.",
        detail: err.message,
      });
  }
});

// ==== SINGLE DELETE ROUTERS ==== //
app.delete("/delete/match/:id", (req, res) => {
  try {
    const result = db
      .prepare("DELETE FROM match_data WHERE id = ?")
      .run(req.params.id);
    if (result.changes > 0) res.json({ success: true });
    else res.status(404).json({ error: "Match entity records not found" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/delete/pit/:id", (req, res) => {
  try {
    const result = db
      .prepare("DELETE FROM pit_data WHERE id = ?")
      .run(req.params.id);
    if (result.changes > 0) res.json({ success: true });
    else res.status(404).json({ error: "Pit template records not found" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==== WIPE EVERYTHING ENDPOINT ==== //
app.delete("/admin/wipe-all", (req, res) => {
  try {
    const delMatches = db.prepare("DELETE FROM match_data").run();
    const delPits = db.prepare("DELETE FROM pit_data").run();
    res.json({
      success: true,
      message: `Cleared ${delMatches.changes} match telemetry entries and ${delPits.changes} pit configurations.`,
    });
  } catch (err) {
    res
      .status(500)
      .json({
        error: "Database purge transaction failed",
        detail: err.message,
      });
  }
});

// List all regionals
app.get("/regionals", (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT * FROM regionals WHERE visible_in_vis = 1 ORDER BY id DESC`,
      )
      .all(),
  );
});

// Drive endpoints
app.post("/upload", upload.single("file"), (req, res) => {
  console.log(req.file);

  res.json({
    success: true,
    file: req.file,
  });
});

app.post("/folder", (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      message: "Folder name required",
    });
  }

  const folderPath = path.join("uploads", name);

  if (fs.existsSync(folderPath)) {
    return res.status(400).json({
      success: false,
      message: "Folder already exists",
    });
  }

  fs.mkdirSync(folderPath);

  res.json({
    success: true,
  });
});

app.get("/drive", (req, res) => {
  try {
    // 1. Grab the path parameter sent from the frontend (?path=subfolder)
    // If it doesn't exist, default to an empty string (the root of uploads)
    const relativePath = req.query.path || "";

    // 2. Safe path resolution to prevent users from escaping the uploads directory
    const baseUploadsDir = path.resolve(__dirname, "uploads");
    const targetDir = path.resolve(baseUploadsDir, relativePath);

    // Security check: Ensure the target directory is still inside the base uploads folder
    if (!targetDir.startsWith(baseUploadsDir)) {
      return res.status(403).json({ error: "Access denied." });
    }

    // Check if the directory actually exists
    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: "Directory not found." });
    }

    // 3. Read the contents of the specific target directory
    const items = fs.readdirSync(targetDir);
    let folders = [];
    let files = [];

    items.forEach((item) => {
      // Get stats using the full path to the file/folder
      const fullPath = path.join(targetDir, item);
      const stats = fs.lstatSync(fullPath);

      if (stats.isDirectory()) {
        folders.push(item);
      } else {
        files.push(item);
      }
    });

    // 4. Send back the arrays
    res.json({
      folders,
      files,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error reading directory." });
  }
});

app.listen(PORT, () => {
  console.log(
    `Server is running at https://taco-childhood-jailbreak.ngrok-free.dev`,
  );
});
