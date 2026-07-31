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
import webpush from "web-push";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 1. Get the target subdirectory from the query string (default to root 'uploads')
    const relativePath = req.query.path || "";

    const baseUploadsDir = path.resolve(__dirname, "uploads");
    const targetDir = path.resolve(baseUploadsDir, relativePath);

    // 2. Security Check: Block directory traversal attempts (e.g., path: "../../../")
    if (
      targetDir !== baseUploadsDir &&
      !targetDir.startsWith(`${baseUploadsDir}${path.sep}`)
    ) {
      return cb(new Error("Access denied: Invalid upload path."));
    }

    // 3. Ensure the target directory exists before saving the file
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    cb(null, targetDir);
  },

  filename: (req, file, cb) => {
    // Keeps the original file name intact
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const MATCH_FORM_PATH = path.join(__dirname, 'data', 'matchFormConfig.json');
const PIT_FORM_PATH = path.join(__dirname, "pitForm.json");

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const webPushEnabled = Boolean(vapidPublicKey && vapidPrivateKey);
if (webPushEnabled) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:team935@example.com",
    vapidPublicKey,
    vapidPrivateKey,
  );
} else {
  console.warn("[push] Web Push is disabled: VAPID keys are not configured.");
}

const app = express();
const PORT = 3000;

// ==== JWT AUTH ==== //
// JWT_SECRET should live in your .env so tokens stay valid across restarts and
// deploys. If it's missing we generate one for this process only and warn loudly
// so it's obvious in the logs that sessions won't survive a restart.
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  JWT_SECRET = crypto.randomBytes(48).toString("hex");
  console.warn(
    "[auth] WARNING: JWT_SECRET is not set in .env. Using a temporary secret " +
      "for this run only \u2014 every existing login will be invalidated on the " +
      "next restart. Add JWT_SECRET=<long random string> to your .env file.",
  );
}
const TOKEN_TTL = "12h";

const signUserToken = (user) =>
  jwt.sign(
    {
      username: user.username,
      role: user.role,
      subgroup: user.subgroup || "none",
      competitionRole: user.competitionRole || "none",
      leadershipSubgroups: user.leadershipSubgroups || [],
    },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL },
  );

// Verifies the Authorization: Bearer <token> header (if present) and attaches
// the decoded, server-signed identity to req.user. This runs on every request
// but does NOT block routes on its own - it just makes sure req.user can only
// ever contain values we signed, never values a client typed into a form,
// query string, or devtools console.
function authenticateJWT(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    req.user = null;
  }
  next();
}

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Sign in required." });
  next();
};

const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Sign in required." });
    const normalized = roles.map((role) => role.toLowerCase());
    if (!normalized.includes(String(req.user.role || "").toLowerCase()))
      return res.status(403).json({ error: "Not authorized." });
    next();
  };

// CORS must run first so every response (including OPTIONS preflight) gets headers.
// Reflects request headers automatically, and explicitly allows headers the app sends.
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Origin",
      "X-Requested-With",
      "x-drive-user",
      "ngrok-skip-browser-warning",
    ],
    exposedHeaders: ["Content-Disposition"],
    optionsSuccessStatus: 204,
  }),
);
app.options(/.*/, cors());

app.use(express.json());
app.use(authenticateJWT);

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

// ==== User Storage (SQLite) ==== //
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT DEFAULT '',
    last_name TEXT DEFAULT '',
    role TEXT NOT NULL,
    subgroup TEXT DEFAULT 'none',
    competition_role TEXT DEFAULT 'none',
    leadership_subgroups TEXT DEFAULT '[]',
    created_at TEXT NOT NULL
  )
`);

const userColumns = db.prepare("PRAGMA table_info(users)").all();
const ensureUserColumn = (name, sql) => {
  if (!userColumns.some((column) => column.name === name)) db.exec(sql);
};
ensureUserColumn(
  "contact_email",
  "ALTER TABLE users ADD COLUMN contact_email TEXT DEFAULT ''",
);
ensureUserColumn(
  "phone_number",
  "ALTER TABLE users ADD COLUMN phone_number TEXT DEFAULT ''",
);
ensureUserColumn(
  "linked_students",
  "ALTER TABLE users ADD COLUMN linked_students TEXT DEFAULT '[]'",
);
ensureUserColumn(
  "linked_parents",
  "ALTER TABLE users ADD COLUMN linked_parents TEXT DEFAULT '[]'",
);

const rowToUser = (row) =>
  !row
    ? null
    : {
        username: row.username,
        passwordHash: row.password_hash,
        firstName: row.first_name || "",
        lastName: row.last_name || "",
        role: row.role,
        subgroup: row.subgroup || "none",
        competitionRole: row.competition_role || "none",
        leadershipSubgroups: JSON.parse(row.leadership_subgroups || "[]"),
        contactEmail: row.contact_email || "",
        phoneNumber: row.phone_number || "",
        linkedStudents: JSON.parse(row.linked_students || "[]"),
        linkedParents: JSON.parse(row.linked_parents || "[]"),
      };

function getUsers() {
  return db.prepare("SELECT * FROM users ORDER BY id").all().map(rowToUser);
}

function getUserByUsername(username) {
  return rowToUser(
    db.prepare("SELECT * FROM users WHERE username = ?").get(username),
  );
}

function createUser({
  username,
  passwordHash,
  firstName,
  lastName,
  role,
  subgroup,
  contactEmail,
  phoneNumber,
  linkedStudents = [],
  linkedParents = [],
}) {
  db.prepare(
    `INSERT INTO users
      (username, password_hash, first_name, last_name, role, subgroup, competition_role, leadership_subgroups, contact_email, phone_number, linked_students, linked_parents, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'none', '[]', ?, ?, ?, ?, ?)`,
  ).run(
    username,
    passwordHash,
    firstName || "",
    lastName || "",
    role,
    subgroup || "none",
    contactEmail || "",
    phoneNumber || "",
    JSON.stringify(linkedStudents),
    JSON.stringify(linkedParents),
    new Date().toISOString(),
  );
}

// Existing code edits whole user objects in place (role, subgroup,
// leadershipSubgroups, competitionRole) then calls saveUsers(list) to persist -
// keep that contract, just upsert each row into SQLite instead of rewriting JSON.
function saveUsers(users) {
  const update = db.prepare(
    `UPDATE users SET role = ?, subgroup = ?, competition_role = ?, leadership_subgroups = ? WHERE username = ?`,
  );
  const tx = db.transaction((list) => {
    list.forEach((user) => {
      update.run(
        user.role,
        user.subgroup || "none",
        user.competitionRole || "none",
        JSON.stringify(user.leadershipSubgroups || []),
        user.username,
      );
    });
  });
  tx(users);
}

// One-time migration: if the users table is empty and a legacy users.json
// exists, import it so nobody loses their accounts switching to the DB.
function migrateLegacyUsersJson() {
  const { c } = db.prepare("SELECT COUNT(*) AS c FROM users").get();
  if (c > 0 || !fs.existsSync("users.json")) return;
  const legacy = JSON.parse(fs.readFileSync("users.json", "utf8"));
  const insert = db.prepare(
    `INSERT INTO users
      (username, password_hash, first_name, last_name, role, subgroup, competition_role, leadership_subgroups, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction((list) => {
    list.forEach((user) => {
      insert.run(
        user.username,
        user.passwordHash,
        user.firstName || "",
        user.lastName || "",
        user.role,
        user.subgroup || "none",
        user.competitionRole || "none",
        JSON.stringify(user.leadershipSubgroups || []),
        new Date().toISOString(),
      );
    });
  });
  tx(legacy);
  console.log(
    `[migrate] Imported ${legacy.length} users from users.json into the database.`,
  );
  fs.renameSync("users.json", "users.json.migrated");
}
migrateLegacyUsersJson();

const getSubgroups = () =>
  db
    .prepare("SELECT name FROM subgroups ORDER BY name")
    .all()
    .map((row) => row.name);

const ensureSubgroupFolders = () => {
  getSubgroups().forEach((subgroup) => {
    fs.mkdirSync(path.resolve(__dirname, "uploads", subgroup), {
      recursive: true,
    });
  });
  fs.mkdirSync(path.resolve(__dirname, "uploads", "public"), {
    recursive: true,
  });
};
ensureSubgroupFolders();
const normalizeRole = (role) => String(role || "").toLowerCase();
const normalizeDrivePath = (relativePath) =>
  String(relativePath || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
const PUBLIC_DRIVE_FOLDER = "public";
const isPublicDrivePath = (relativePath) => {
  const normalizedPath = normalizeDrivePath(relativePath);
  return (
    normalizedPath === PUBLIC_DRIVE_FOLDER ||
    normalizedPath.startsWith(`${PUBLIC_DRIVE_FOLDER}/`)
  );
};
const subgroupFromPath = (relativePath) => {
  const firstSegment = normalizeDrivePath(relativePath).split("/")[0];
  return (
    getSubgroups().find(
      (group) => group.toLowerCase() === firstSegment.toLowerCase(),
    ) || null
  );
};
const getDriveUser = (req) =>
  getUsers().find((user) => user.username === req.get("x-drive-user"));
const canManageDrivePath = (user, relativePath) => {
  if (!user) return false;
  const role = normalizeRole(user.role);
  if (role === "admin" || role === "coach") return true;
  if (isPublicDrivePath(relativePath)) return true;
  const subgroup = subgroupFromPath(relativePath);
  if (!subgroup) return false;
  return Boolean((user.leadershipSubgroups || []).includes(subgroup));
};
const canReadDrivePath = (user, relativePath) => {
  if (!user) return false;
  if (isPublicDrivePath(relativePath)) return true;
  const subgroup = subgroupFromPath(relativePath);
  if (!subgroup) return true;
  const role = normalizeRole(user.role);
  if (
    role === "admin" ||
    role === "coach" ||
    role === "programmer" ||
    role === "programmers"
  ) {
    return true;
  }
  return (
    normalizeRole(user.subgroup) === normalizeRole(subgroup) ||
    (user.leadershipSubgroups || []).includes(subgroup)
  );
};

app.get("/leadership/users", (req, res) => {
  const actor = req.user;
  if (!actor || !["admin", "coach"].includes(normalizeRole(actor.role)))
    return res
      .status(403)
      .json({ error: "Only admins and coaches can manage leaders." });
  res.json(getUsers().map(({ passwordHash, ...user }) => user));
});

app.get("/directory", (req, res) => {
  if (!req.user)
    return res.status(401).json({ error: "Sign in to view the directory." });
  res.json(
    getUsers().map(({ username, role, subgroup }) => ({
      username,
      role,
      subgroup,
    })),
  );
});

app.get("/subgroups", (req, res) => res.json(getSubgroups()));

app.get("/students/public", (req, res) => {
  res.json(
    getUsers()
      .filter((user) =>
        ["student", "students", "programmer", "programmers"].includes(
          normalizeRole(user.role),
        ),
      )
      .map((user) => ({
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        subgroup: user.subgroup,
      })),
  );
});

app.post("/subgroups", (req, res) => {
  const actor = req.user;
  const name = String(req.body?.name || "").trim();
  if (!actor || !["admin", "coach"].includes(normalizeRole(actor.role)))
    return res
      .status(403)
      .json({ error: "Only admins and coaches can add subgroups." });
  if (!name || !/^[a-zA-Z0-9 _-]{2,40}$/.test(name))
    return res
      .status(400)
      .json({ error: "Use a 2–40 character subgroup name." });
  try {
    db.prepare("INSERT INTO subgroups (name, created_at) VALUES (?, ?)").run(
      name,
      new Date().toISOString(),
    );
    fs.mkdirSync(path.resolve(__dirname, "uploads", name), { recursive: true });
    res.status(201).json({ name });
  } catch (err) {
    res.status(409).json({ error: "That subgroup already exists." });
  }
});

app.delete("/subgroups/:name", (req, res) => {
  const users = getUsers();
  const actor = req.user;
  const name = req.params.name;
  if (!actor || normalizeRole(actor.role) !== "admin")
    return res.status(403).json({ error: "Only admins can delete subgroups." });
  if (!getSubgroups().includes(name))
    return res.status(404).json({ error: "Subgroup not found." });
  db.prepare("DELETE FROM subgroups WHERE name = ?").run(name);
  users.forEach((user) => {
    if (user.subgroup === name) user.subgroup = "none";
    user.leadershipSubgroups = (user.leadershipSubgroups || []).filter(
      (group) => group !== name,
    );
  });
  saveUsers(users);
  fs.rmSync(path.resolve(__dirname, "uploads", name), {
    recursive: true,
    force: true,
  });
  res.json({ success: true });
});

app.patch("/leadership/users/:username", (req, res) => {
  const users = getUsers();
  const actor = req.user;
  if (!actor || !["admin", "coach"].includes(normalizeRole(actor.role)))
    return res
      .status(403)
      .json({ error: "Only admins and coaches can manage leaders." });
  const target = users.find((user) => user.username === req.params.username);
  if (!target) return res.status(404).json({ error: "User not found." });
  if (req.body?.role !== undefined) {
    if (normalizeRole(actor.role) !== "admin")
      return res
        .status(403)
        .json({ error: "Only admins can change account roles." });
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
      "programmer",
      "programmers",
    ];
    if (!allowedRoles.includes(req.body.role))
      return res.status(400).json({ error: "Unsupported account role." });
    target.role = req.body.role;
  }
  const leadershipSubgroups = Array.isArray(req.body?.leadershipSubgroups)
    ? req.body.leadershipSubgroups.filter((group) =>
        getSubgroups().includes(group),
      )
    : [];
  target.leadershipSubgroups = leadershipSubgroups;
  if (req.body?.subgroup && getSubgroups().includes(req.body.subgroup))
    target.subgroup = req.body.subgroup;
  saveUsers(users);
  const { passwordHash, ...safeUser } = target;
  res.json(safeUser);
});

const getActor = (name) => getUsers().find((user) => user.username === name);
const isLeader = (user) =>
  ["admin", "coach", "mentor", "programmer"].includes(
    normalizeRole(user?.role),
  );
const canLeadSubgroup = (user, subgroup) =>
  ["admin", "coach"].includes(normalizeRole(user?.role)) ||
  (user?.leadershipSubgroups || []).includes(subgroup);
const TASK_COMPLETION_RETENTION_MS = 30 * 1000;
const removeExpiredCompletedTasks = () => {
  const cutoff = new Date(
    Date.now() - TASK_COMPLETION_RETENTION_MS,
  ).toISOString();
  db.prepare(
    "DELETE FROM tasks WHERE status = 'complete' AND completed_at IS NOT NULL AND completed_at <= ?",
  ).run(cutoff);
};

const getMessageRecipients = (message) => {
  if (["everyone", "announcement"].includes(message.recipient_type)) {
    return getUsers().map((user) => user.username);
  }
  if (message.recipient_type === "parents") {
    return getUsers()
      .filter((user) => ["parent", "family"].includes(normalizeRole(user.role)))
      .map((user) => user.username);
  }
  if (message.recipient_type === "students") {
    return getUsers()
      .filter((user) =>
        ["student", "students", "programmer", "programmers"].includes(
          normalizeRole(user.role),
        ),
      )
      .map((user) => user.username);
  }
  if (message.recipient_type === "subgroup") {
    return getUsers()
      .filter((user) => user.subgroup === message.recipient_value)
      .map((user) => user.username);
  }
  if (message.recipient_type === "person") return [message.recipient_value];
  if (message.recipient_type === "group") {
    const group = db
      .prepare("SELECT members FROM message_groups WHERE id = ?")
      .get(message.recipient_value);
    if (!group) return [];
    try {
      return JSON.parse(group.members);
    } catch {
      return [];
    }
  }
  return [];
};

const notifyMessageRecipients = async (message) => {
  if (!webPushEnabled) return;
  const recipients = new Set(getMessageRecipients(message));
  recipients.delete(message.sender);
  if (!recipients.size) return;

  const subscriptions = db
    .prepare("SELECT endpoint, username, subscription FROM push_subscriptions")
    .all();
  const title =
    message.recipient_type === "announcement"
      ? `Announcement from ${message.sender}`
      : `New message from ${message.sender}`;
  const payload = JSON.stringify({
    title,
    body: message.body,
    url: "/",
    tag: `message-${message.id}`,
  });

  await Promise.allSettled(
    subscriptions
      .filter((row) => recipients.has(row.username))
      .map(async (row) => {
        try {
          await webpush.sendNotification(JSON.parse(row.subscription), payload);
        } catch (error) {
          if ([404, 410].includes(error.statusCode)) {
            db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(
              row.endpoint,
            );
            return;
          }
          console.error(
            "[push] Failed to deliver notification:",
            error.message,
          );
        }
      }),
  );
};

app.get("/push/vapid-public-key", (req, res) => {
  if (!req.user)
    return res.status(401).json({ error: "Sign in to enable notifications." });
  if (!webPushEnabled)
    return res
      .status(503)
      .json({ error: "Push notifications are not configured." });
  res.json({ publicKey: vapidPublicKey });
});

app.post("/push/subscriptions", (req, res) => {
  const actor = req.user;
  const subscription = req.body?.subscription;
  if (!actor)
    return res.status(401).json({ error: "Sign in to enable notifications." });
  if (
    !subscription?.endpoint ||
    !subscription?.keys?.p256dh ||
    !subscription?.keys?.auth
  ) {
    return res.status(400).json({ error: "Invalid push subscription." });
  }
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, username, subscription, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET username = excluded.username, subscription = excluded.subscription, created_at = excluded.created_at`,
  ).run(
    subscription.endpoint,
    actor.username,
    JSON.stringify(subscription),
    new Date().toISOString(),
  );
  res.status(201).json({ success: true });
});

app.get("/tasks", (req, res) => {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Sign in to view tasks." });
  removeExpiredCompletedTasks();
  const isManager = ["admin", "coach"].includes(normalizeRole(actor.role));
  const rows = db
    .prepare(
      "SELECT * FROM tasks ORDER BY status = 'open' DESC, created_at DESC",
    )
    .all();
  res.json(
    rows.filter(
      (task) =>
        isManager ||
        // A task with an assignee is private to that person. Tasks without an
        // assignee remain available to everyone in the selected subgroup.
        (task.assignee
          ? task.assignee === actor.username
          : task.subgroup === actor.subgroup) ||
        // Subgroup leaders can still review work for the subgroups they lead.
        (actor.leadershipSubgroups || []).includes(task.subgroup),
    ),
  );
});

app.post("/tasks", (req, res) => {
  const actor = req.user;
  const {
    title,
    description = "",
    subgroup = "",
    assignee = "",
  } = req.body || {};
  if (!actor || !title)
    return res
      .status(400)
      .json({ error: "A signed-in user and task title are required." });
  const targetUser = assignee && getActor(assignee);
  if (assignee && !targetUser)
    return res
      .status(400)
      .json({ error: "Choose a person from the directory." });
  const targetSubgroup = subgroup || targetUser?.subgroup;
  if (!targetSubgroup || !canLeadSubgroup(actor, targetSubgroup))
    return res
      .status(403)
      .json({ error: "You can assign tasks only within subgroups you lead." });
  if (
    targetUser &&
    targetUser.subgroup !== targetSubgroup &&
    !["admin", "coach"].includes(normalizeRole(actor.role))
  )
    return res
      .status(403)
      .json({ error: "Leaders can assign only people in their subgroup." });
  const task = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: String(title).slice(0, 120),
    description: String(description).slice(0, 1000),
    subgroup: targetSubgroup,
    assignee: assignee || null,
    assigned_by: actor.username,
    status: "open",
    created_at: new Date().toISOString(),
    completed_at: null,
  };
  db.prepare(
    "INSERT INTO tasks (id,title,description,subgroup,assignee,assigned_by,status,created_at,completed_at) VALUES (@id,@title,@description,@subgroup,@assignee,@assigned_by,@status,@created_at,@completed_at)",
  ).run(task);
  res.status(201).json(task);
});

app.patch("/tasks/:id", (req, res) => {
  const actor = req.user;
  const task = db
    .prepare("SELECT * FROM tasks WHERE id = ?")
    .get(req.params.id);
  if (!actor || !task)
    return res.status(404).json({ error: "Task not found." });
  if (
    task.assignee !== actor.username &&
    !canLeadSubgroup(actor, task.subgroup)
  )
    return res.status(403).json({ error: "You cannot update this task." });
  const status = req.body?.status === "complete" ? "complete" : "open";
  const completedAt = status === "complete" ? new Date().toISOString() : null;
  db.prepare("UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?").run(
    status,
    completedAt,
    task.id,
  );
  if (status === "complete") {
    setTimeout(() => {
      db.prepare(
        "DELETE FROM tasks WHERE id = ? AND status = 'complete' AND completed_at = ?",
      ).run(task.id, completedAt);
    }, TASK_COMPLETION_RETENTION_MS);
  }
  res.json({ ...task, status, completed_at: completedAt });
});

app.get("/messages", (req, res) => {
  const actor = req.user;
  if (!actor)
    return res.status(401).json({ error: "Sign in to view messages." });
  const groups = db
    .prepare("SELECT * FROM message_groups")
    .all()
    .filter((group) => JSON.parse(group.members).includes(actor.username))
    .map((group) => group.id);
  const isCoach = ["admin", "coach"].includes(normalizeRole(actor.role));
  const rows = db
    .prepare("SELECT * FROM messages ORDER BY created_at DESC LIMIT 100")
    .all();
  res.json(
    rows.filter(
      (message) =>
        isCoach ||
        message.sender === actor.username ||
        message.recipient_type === "everyone" ||
        message.recipient_type === "announcement" ||
        (message.recipient_type === "parents" &&
          ["parent", "family"].includes(normalizeRole(actor.role))) ||
        (message.recipient_type === "students" &&
          ["student", "students", "programmer", "programmers"].includes(
            normalizeRole(actor.role),
          )) ||
        (message.recipient_type === "subgroup" &&
          message.recipient_value === actor.subgroup) ||
        (message.recipient_type === "person" &&
          message.recipient_value === actor.username) ||
        (message.recipient_type === "group" &&
          groups.includes(message.recipient_value)),
    ),
  );
});

app.post("/messages", (req, res) => {
  const actor = req.user;
  const { recipientType, recipientValue = "", body } = req.body || {};
  if (
    !actor ||
    !body ||
    ![
      "everyone",
      "parents",
      "students",
      "subgroup",
      "person",
      "group",
      "announcement",
    ].includes(recipientType)
  )
    return res
      .status(400)
      .json({ error: "Choose recipients and write a message." });
  if (recipientType === "subgroup" && !getSubgroups().includes(recipientValue))
    return res.status(400).json({ error: "Unknown subgroup." });
  if (recipientType === "announcement" && !isLeader(actor))
    return res
      .status(403)
      .json({ error: "Only team leaders can make announcements." });
  if (
    ["parents", "students", "everyone"].includes(recipientType) &&
    !["admin", "coach", "helper", "mentor"].includes(normalizeRole(actor.role))
  ) {
    return res
      .status(403)
      .json({ error: "Only coaches and helpers can message this group." });
  }
  const message = {
    id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sender: actor.username,
    recipient_type: recipientType,
    recipient_value: recipientValue || null,
    body: String(body).slice(0, 2000),
    created_at: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO messages (id,sender,recipient_type,recipient_value,body,created_at) VALUES (@id,@sender,@recipient_type,@recipient_value,@body,@created_at)",
  ).run(message);
  void notifyMessageRecipients(message);
  res.status(201).json(message);
});

// ==== FEEDBACK ==== //
app.post("/feedback", (req, res) => {
  const actor = req.user;
  const { category, title, details } = req.body || {};
  const allowedCategories = ["bug", "feature", "improvement", "other"];
  if (
    !actor ||
    !allowedCategories.includes(category) ||
    !title?.trim() ||
    !details?.trim()
  ) {
    return res.status(400).json({
      error: "Choose a category and provide a title and description.",
    });
  }
  const feedback = {
    id: `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    submitted_by: actor.username,
    category,
    title: String(title).trim().slice(0, 160),
    details: String(details).trim().slice(0, 4000),
    status: "open",
    created_at: new Date().toISOString(),
    completed_at: null,
  };
  db.prepare(
    "INSERT INTO feedback (id,submitted_by,category,title,details,status,created_at,completed_at) VALUES (@id,@submitted_by,@category,@title,@details,@status,@created_at,@completed_at)",
  ).run(feedback);
  res.status(201).json(feedback);
});

app.get("/feedback", (req, res) => {
  const actor = req.user;
  if (!actor || !["admin", "coach"].includes(normalizeRole(actor.role))) {
    return res
      .status(403)
      .json({ error: "Only administrators can review feedback." });
  }
  res.json(
    db
      .prepare(
        "SELECT * FROM feedback ORDER BY status = 'open' DESC, created_at DESC",
      )
      .all(),
  );
});

app.patch("/feedback/:id", (req, res) => {
  const actor = req.user;
  if (!actor || !["admin", "coach"].includes(normalizeRole(actor.role))) {
    return res
      .status(403)
      .json({ error: "Only administrators can update feedback." });
  }
  const feedback = db
    .prepare("SELECT * FROM feedback WHERE id = ?")
    .get(req.params.id);
  if (!feedback) return res.status(404).json({ error: "Feedback not found." });
  const status = req.body?.status === "complete" ? "complete" : "open";
  const completedAt = status === "complete" ? new Date().toISOString() : null;
  db.prepare(
    "UPDATE feedback SET status = ?, completed_at = ? WHERE id = ?",
  ).run(status, completedAt, feedback.id);

  if (status === "complete" && feedback.status !== "complete") {
    db.prepare(
      "INSERT INTO messages (id,sender,recipient_type,recipient_value,body,created_at) VALUES (@id,@sender,@recipient_type,@recipient_value,@body,@created_at)",
    ).run({
      id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender: "North Star Feedback",
      recipient_type: "person",
      recipient_value: feedback.submitted_by,
      body: `Your ${feedback.category} feedback, “${feedback.title}”, has been marked implemented. Thank you for helping improve North Star!`,
      created_at: completedAt,
    });
  }
  res.json({ ...feedback, status, completed_at: completedAt });
});

app.get("/message-groups", (req, res) => {
  const actor = req.user;
  if (!actor) return res.status(401).json({ error: "Sign in to view groups." });
  res.json(
    db
      .prepare("SELECT * FROM message_groups ORDER BY created_at DESC")
      .all()
      .filter(
        (group) =>
          ["admin", "coach"].includes(normalizeRole(actor.role)) ||
          group.owner === actor.username ||
          JSON.parse(group.members).includes(actor.username),
      )
      .map((group) => ({ ...group, members: JSON.parse(group.members) })),
  );
});

app.post("/message-groups", (req, res) => {
  const actor = req.user;
  const { name, members = [] } = req.body || {};
  if (!actor || !name || !Array.isArray(members))
    return res
      .status(400)
      .json({ error: "A group name and members are required." });
  const group = {
    id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: String(name).slice(0, 60),
    owner: actor.username,
    members: JSON.stringify([...new Set([...members, actor.username])]),
    created_at: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO message_groups (id,name,owner,members,created_at) VALUES (@id,@name,@owner,@members,@created_at)",
  ).run(group);
  res.status(201).json({ ...group, members: JSON.parse(group.members) });
});

function getMatch() {
  return JSON.parse(fs.readFileSync("matchData.json", "utf8"));
}

function getPit() {
  return JSON.parse(fs.readFileSync("pitData.json", "utf8"));
}

function getPitForm() {
  return JSON.parse(fs.readFileSync(PIT_FORM_PATH, "utf8"));
}

function getMatchForm() {
  try {
    return JSON.parse(fs.readFileSync("matchForm.json", "utf8"));
  } catch {
    const seed = JSON.parse(fs.readFileSync("matchForm.default.json", "utf8"));
    fs.writeFileSync("matchForm.json", JSON.stringify(seed, null, 2), "utf-8");
    return seed;
  }
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
    audiences: payload.audiences?.length ? payload.audiences : ["students"],
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

    const user = getUserByUsername(username);

    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Use bcrypt to check if the text password matches the stored scrambled hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Success! Sign a token containing the role/subgroup/etc as WE know them
    // (from the DB), not whatever the client claims. This is what the frontend
    // stores and sends back on every request afterwards - editing it in
    // localStorage or devtools just breaks the signature and logs you out.
    const token = signUserToken(user);

    console.log(
      `[auth] User ${username} logged in successfully as ${user.role}`,
    );
    res.json({
      token,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      subgroup: user.subgroup || "",
      competitionRole: user.competitionRole || "none",
    });
  } catch (err) {
    console.error("[auth] Login error:", err.message);
    res.status(500).json({ error: "Internal server authentication error" });
  }
});

// ==== USER REGISTRATION ENDPOINT ==== //
app.post("/auth/register", async (req, res) => {
  try {
    const {
      username,
      password,
      role,
      subgroup,
      firstName,
      lastName,
      contactEmail,
      phoneNumber,
      selectedStudent,
    } = req.body;

    // 1. Validate incoming data payload
    if (!username || !password || !role || !firstName || !lastName) {
      return res
        .status(400)
        .json({ error: "Missing username, password, name, or role" });
    }

    const allowedRoles = [
      "admin",
      "scouter",
      "family",
      "helper",
      "parent",
      "student",
      "students",
      "teamMember",
      "coach",
      "Mentor",
    ];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Un-verified account role" });
    }
    // Note: competitionRole is intentionally NOT accepted here. It always
    // starts at "none" and can only be set afterwards by a coach/admin via
    // PATCH /users/:username/competition-role.

    // 2. Prevent duplicate usernames
    if (getUserByUsername(username)) {
      return res.status(400).json({ error: "User already exists check" });
    }

    // 3. Hash the password securely using bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const normalizedRole = normalizeRole(role);
    const isParent = ["parent", "family"].includes(normalizedRole);
    if (isParent && (!contactEmail || !phoneNumber)) {
      return res
        .status(400)
        .json({ error: "Parents need an email and phone number." });
    }
    if (isParent && !selectedStudent) {
      return res
        .status(400)
        .json({ error: "Choose the student you want to connect with." });
    }
    const selectedStudentUser = selectedStudent
      ? getUserByUsername(selectedStudent)
      : null;
    if (
      isParent &&
      (!selectedStudentUser ||
        !["student", "students", "programmer", "programmers"].includes(
          normalizeRole(selectedStudentUser.role),
        ))
    ) {
      return res.status(400).json({ error: "Choose a valid student." });
    }

    // 4. Persist the new user in the database
    createUser({
      username,
      passwordHash,
      firstName,
      lastName,
      role,
      subgroup: isParent ? "none" : subgroup || "none",
      contactEmail,
      phoneNumber,
    });

    if (isParent && selectedStudent) {
      if (selectedStudentUser) {
        const request = {
          id: `parent-request-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          parent_username: username,
          student_username: selectedStudent,
          status: "pending",
          created_at: new Date().toISOString(),
          resolved_at: null,
        };
        db.prepare(
          `INSERT INTO parent_student_requests
            (id,parent_username,student_username,status,created_at,resolved_at)
           VALUES (@id,@parent_username,@student_username,@status,@created_at,@resolved_at)`,
        ).run(request);
        const message = {
          id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          sender: username,
          recipient_type: "person",
          recipient_value: selectedStudent,
          body: `${firstName} ${lastName} requested to connect as your parent/guardian.`,
          metadata: JSON.stringify({
            kind: "parent_request",
            requestId: request.id,
            parentUsername: username,
          }),
          created_at: request.created_at,
        };
        db.prepare(
          "INSERT INTO messages (id,sender,recipient_type,recipient_value,body,metadata,created_at) VALUES (@id,@sender,@recipient_type,@recipient_value,@body,@metadata,@created_at)",
        ).run(message);
        void notifyMessageRecipients(message);
      }
    }

    console.log(`[auth] Successfully created new ${role} account: ${username}`);
    res.status(201).json({ message: "User registered successfully!" });
  } catch (err) {
    console.error("[auth] Registration error:", err.message);
    res.status(500).json({ error: "Internal server registration error" });
  }
});

app.get("/users", requireAuth, (req, res) => {
  try {
    // Never send passwordHash to the client - this used to leak every
    // password hash in the system to anyone who called this endpoint.
    res.json(getUsers().map(({ passwordHash, ...safeUser }) => safeUser));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve users memory grid." });
  }
});

// ==== COMPETITION ROLE ==== //
// Set at signup time nothing is chosen (defaults to "none"). Only a coach or
// admin can assign it, and only via this endpoint - never via the register
// form or by editing localStorage.
const ALLOWED_COMPETITION_ROLES = [
  "none",
  "scouter",
  "lead scouter",
  "drive team",
  "pit boss",
  "strategist",
];

app.get("/competition-roles", (req, res) =>
  res.json(ALLOWED_COMPETITION_ROLES),
);

app.patch(
  "/users/:username/competition-role",
  requireRole("admin", "coach"),
  (req, res) => {
    const target = getUserByUsername(req.params.username);
    if (!target) return res.status(404).json({ error: "User not found." });

    const competitionRole = String(req.body?.competitionRole || "").trim();
    if (!ALLOWED_COMPETITION_ROLES.includes(competitionRole)) {
      return res.status(400).json({ error: "Unsupported competition role." });
    }

    db.prepare("UPDATE users SET competition_role = ? WHERE username = ?").run(
      competitionRole,
      target.username,
    );

    console.log(
      `[auth] ${req.user.username} set ${target.username}'s competition role to ${competitionRole}`,
    );
    res.json({ username: target.username, competitionRole });
  },
);

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
    const role = String(req.query.role || "students").toLowerCase();
    const subgroup = String(req.query.subgroup || "");
    const matchingForms = rows.map(parseHelperForm).filter((form) => {
      const audiences = form.audiences || ["students"];
      return (
        audiences.includes("everyone") ||
        audiences.includes(role) ||
        (role === "student" && audiences.includes("students")) ||
        (subgroup && audiences.includes(`subgroup:${subgroup}`))
      );
    });
    res.json(matchingForms);
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
      const schema = JSON.parse(fs.readFileSync(PIT_FORM_PATH, "utf8"));
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
  try {
    res.json(getPitForm());
  } catch (err) {
    console.error("[form] Failed to load pit form schema:", err.message);
    res
      .status(500)
      .json({ error: "Failed to load pit form schema", detail: err.message });
  }
});

app.get("/parent/dashboard", requireAuth, (req, res) => {
  const actor = getUserByUsername(req.user.username);
  if (!actor || !["parent", "family"].includes(normalizeRole(actor.role))) {
    return res.status(403).json({ error: "Parent account required." });
  }
  const sentForms = db
    .prepare("SELECT * FROM helper_forms WHERE status = 'sent' ORDER BY sent_at DESC")
    .all()
    .map(parseHelperForm);
  const formsForUser = (user) =>
    sentForms.filter((form) => {
      const audiences = form.audiences || ["students"];
      const role = normalizeRole(user.role);
      return (
        audiences.includes("everyone") ||
        audiences.includes(role) ||
        (["parent", "family"].includes(role) && audiences.includes("parents")) ||
        (role === "student" && audiences.includes("students")) ||
        (user.subgroup && audiences.includes(`subgroup:${user.subgroup}`))
      );
    });
  const students = (actor.linkedStudents || [])
    .map(getUserByUsername)
    .filter(Boolean)
    .map(({ passwordHash, ...student }) => ({
      ...student,
      assignedForms: formsForUser(student),
    }));
  const forms = sentForms
    .filter((form) => {
      const audiences = form.audiences || [];
      return audiences.includes("everyone") || audiences.includes("parents");
    });
  const events = db
    .prepare("SELECT * FROM team_events ORDER BY starts_at ASC")
    .all()
    .filter((event) => ["everyone", "parents"].includes(event.audience));
  res.json({ parent: actor, students, forms, events });
});

app.post("/parent-requests/:id/respond", requireAuth, (req, res) => {
  const actor = req.user;
  const status = req.body?.status === "accepted" ? "accepted" : "denied";
  const request = db
    .prepare("SELECT * FROM parent_student_requests WHERE id = ?")
    .get(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found." });
  if (request.student_username !== actor.username) {
    return res.status(403).json({ error: "Only that student can respond." });
  }
  if (request.status !== "pending") {
    return res.status(400).json({ error: "This request is already resolved." });
  }
  const resolvedAt = new Date().toISOString();
  db.prepare(
    "UPDATE parent_student_requests SET status = ?, resolved_at = ? WHERE id = ?",
  ).run(status, resolvedAt, request.id);

  if (status === "accepted") {
    const parent = getUserByUsername(request.parent_username);
    const student = getUserByUsername(request.student_username);
    const linkedStudents = [
      ...new Set([...(parent?.linkedStudents || []), request.student_username]),
    ];
    const linkedParents = [
      ...new Set([...(student?.linkedParents || []), request.parent_username]),
    ];
    db.prepare("UPDATE users SET linked_students = ? WHERE username = ?").run(
      JSON.stringify(linkedStudents),
      request.parent_username,
    );
    db.prepare("UPDATE users SET linked_parents = ? WHERE username = ?").run(
      JSON.stringify(linkedParents),
      request.student_username,
    );
  }

  const message = {
    id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sender: actor.username,
    recipient_type: "person",
    recipient_value: request.parent_username,
    body:
      status === "accepted"
        ? `${actor.username} accepted your parent connection request.`
        : `${actor.username} denied your parent connection request.`,
    created_at: resolvedAt,
  };
  db.prepare(
    "INSERT INTO messages (id,sender,recipient_type,recipient_value,body,created_at) VALUES (@id,@sender,@recipient_type,@recipient_value,@body,@created_at)",
  ).run(message);
  void notifyMessageRecipients(message);
  res.json({ success: true, status });
});

app.get("/team-events", requireAuth, (req, res) => {
  const actor = req.user;
  const rows = db.prepare("SELECT * FROM team_events ORDER BY starts_at ASC").all();
  res.json(
    rows.filter(
      (event) =>
        event.audience === "everyone" ||
        (event.audience === "parents" &&
          ["parent", "family"].includes(normalizeRole(actor.role))) ||
        (event.audience === "students" &&
          ["student", "students", "programmer", "programmers"].includes(
            normalizeRole(actor.role),
          )),
    ),
  );
});

app.post("/team-events", requireAuth, (req, res) => {
  const actor = req.user;
  if (!["admin", "coach", "helper"].includes(normalizeRole(actor.role))) {
    return res
      .status(403)
      .json({ error: "Only coaches and parent helpers can add events." });
  }
  const { title, startsAt, location = "", audience = "everyone", notes = "" } =
    req.body || {};
  if (!title?.trim() || !startsAt) {
    return res.status(400).json({ error: "Add an event title and date." });
  }
  if (!["everyone", "parents", "students"].includes(audience)) {
    return res.status(400).json({ error: "Choose a valid audience." });
  }
  const event = {
    id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: String(title).trim().slice(0, 120),
    starts_at: startsAt,
    location: String(location).trim().slice(0, 120),
    audience,
    notes: String(notes).trim().slice(0, 1000),
    created_by: actor.username,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO team_events
      (id,title,starts_at,location,audience,notes,created_by,created_at)
     VALUES (@id,@title,@starts_at,@location,@audience,@notes,@created_by,@created_at)`,
  ).run(event);
  res.status(201).json(event);
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
    fs.writeFileSync(PIT_FORM_PATH, JSON.stringify(schema, null, 2), "utf-8");

    // Auto-register the regional in the DB whenever the form is saved
    if (schema.event) {
      getOrCreateRegional(schema.event);
      console.log(`[form] Regional ensured in DB: ${schema.event}`);
    }

    console.log(`[form] Pit form schema saved — id: ${schema.id}`);
    res.json({ success: true, file: PIT_FORM_PATH });
  } catch (err) {
    console.error("[form] Failed to save schema:", err.message);
    res
      .status(500)
      .json({ error: "Failed to save schema", detail: err.message });
  }
});

// ---- 2. Add near the /pit/form routes ----
app.get("/match/form", (req, res) => {
  try {
    if (fs.existsSync(MATCH_FORM_PATH)) {
      const data = fs.readFileSync(MATCH_FORM_PATH, "utf8");
      return res.json(JSON.parse(data));
    }
    // Return null or default config if not uploaded yet
    res.json(null);
  } catch (err) {
    console.error("Failed to load match form config:", err);
    res.status(500).json({ error: "Failed to load match form config." });
  }
});

app.post(
  "/match/form/upload",
  authenticateJWT,
  requireRole("admin", "coach", "lead"),
  (req, res) => {
    try {
      const formConfig = req.body;
      if (!formConfig) {
        return res
          .status(400)
          .json({ error: "Form configuration payload is missing." });
      }

      // Ensure the directory for the match form file exists
      const dir = path.dirname(MATCH_FORM_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(MATCH_FORM_PATH, JSON.stringify(formConfig, null, 2));
      res.json({
        success: true,
        message: "Match form successfully uploaded and saved!",
      });
    } catch (err) {
      console.error("Failed to save match form config:", err);
      res
        .status(500)
        .json({ error: "Failed to save match form configuration." });
    }
  },
);

app.post("/match/form/save", (req, res) => {
  const config = req.body;

  if (!config || !config.timing || !config.phases) {
    return res
      .status(400)
      .json({ error: "Invalid match config — missing timing/phases" });
  }

  try {
    fs.writeFileSync(
      "matchForm.json",
      JSON.stringify(config, null, 2),
      "utf-8",
    );
    console.log("[match/form] Match config saved.");
    res.json({ success: true, file: "matchForm.json" });
  } catch (err) {
    console.error("[match/form] Failed to save config:", err.message);
    res
      .status(500)
      .json({ error: "Failed to save match config", detail: err.message });
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
    res.status(500).json({
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
    res.status(500).json({
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

app.delete("/messages/:id", (req, res) => {
  const actor = req.user;
  if (!actor) {
    return res.status(401).json({ error: "Sign in to delete messages." });
  }
  const isLeader = ["admin", "coach"].includes(normalizeRole(actor.role));
  // Fetch the message first to check ownership
  const message = db
    .prepare("SELECT * FROM messages WHERE id = ?")
    .get(req.params.id);
  if (!message) {
    return res.status(404).json({ error: "Message not found." });
  }
  const isOwner = message.sender === actor.username;
  if (!isLeader && !isOwner) {
    return res
      .status(403)
      .json({ error: "You can only delete your own messages." });
  }
  try {
    db.prepare("DELETE FROM messages WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/users/:username", (req, res) => {
  const actor = req.user;
  if (!actor) {
    return res.status(401).json({ error: "Sign in to delete users." });
  }
  const isLeader = ["admin", "coach"].includes(normalizeRole(actor.role));
  if (!isLeader) {
    return res
      .status(403)
      .json({ error: "Only admins and coaches can delete users." });
  }
  try {
    // Tell SQLite to directly delete the row matching the username
    const result = db
      .prepare("DELETE FROM users WHERE username = ?")
      .run(req.params.username);

    // SQLite's .run() returns a 'changes' property showing how many rows were affected
    if (result.changes === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({ success: true });
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
    res.status(500).json({
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
app.post("/upload", (req, res, next) => {
  if (!canManageDrivePath(getDriveUser(req), req.query.path || "")) {
    return res.status(403).json({
      success: false,
      message: "You can only add files as a leader of this subgroup.",
    });
  }
  upload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded.",
      });
    }

    console.log(`Uploaded ${req.file.filename} to ${req.file.destination}`);

    res.json({
      success: true,
      file: req.file,
    });
  });
});

app.post("/folder", (req, res) => {
  const { name, path: relativePath = "" } = req.body;

  if (!canManageDrivePath(getDriveUser(req), relativePath)) {
    return res.status(403).json({
      success: false,
      message: "You can only create folders as a leader of this subgroup.",
    });
  }

  if (
    !name ||
    name === "." ||
    name === ".." ||
    name.includes("/") ||
    name.includes("\\\\")
  ) {
    return res.status(400).json({
      success: false,
      message: "Folder name required",
    });
  }

  const baseUploadsDir = path.resolve(__dirname, "uploads");
  const folderPath = path.resolve(baseUploadsDir, relativePath, name);

  if (!folderPath.startsWith(`${baseUploadsDir}${path.sep}`)) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  if (fs.existsSync(folderPath)) {
    return res.status(400).json({
      success: false,
      message: "Folder already exists",
    });
  }

  fs.mkdirSync(folderPath, { recursive: true });

  res.json({
    success: true,
  });
});

app.delete("/drive/file", (req, res) => {
  try {
    const relativePath = req.query.path || "";
    if (!canManageDrivePath(getDriveUser(req), relativePath)) {
      return res
        .status(403)
        .json({ error: "You can only delete files in subgroups you lead." });
    }
    const baseUploadsDir = path.resolve(__dirname, "uploads");
    const targetFile = path.resolve(baseUploadsDir, relativePath);

    if (
      !relativePath ||
      !targetFile.startsWith(`${baseUploadsDir}${path.sep}`)
    ) {
      return res.status(403).json({ error: "Access denied." });
    }
    if (!fs.existsSync(targetFile)) {
      return res.status(404).json({ error: "File not found." });
    }
    if (!fs.lstatSync(targetFile).isFile()) {
      return res.status(400).json({ error: "Only files can be deleted." });
    }

    fs.unlinkSync(targetFile);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not delete file." });
  }
});

app.delete("/drive/folder", (req, res) => {
  try {
    const relativePath = req.query.path || "";
    const baseUploadsDir = path.resolve(__dirname, "uploads");
    const targetFolder = path.resolve(baseUploadsDir, relativePath);
    if (!relativePath || !canManageDrivePath(getDriveUser(req), relativePath)) {
      return res
        .status(403)
        .json({ error: "You can only delete folders in subgroups you lead." });
    }
    if (!targetFolder.startsWith(`${baseUploadsDir}${path.sep}`)) {
      return res.status(403).json({ error: "Access denied." });
    }
    if (!fs.existsSync(targetFolder))
      return res.status(404).json({ error: "Folder not found." });
    if (!fs.lstatSync(targetFolder).isDirectory())
      return res.status(400).json({ error: "That item is not a folder." });
    fs.rmSync(targetFolder, { recursive: true, force: true });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not delete folder." });
  }
});

app.get("/drive", (req, res) => {
  try {
    const relativePath = req.query.path || "";

    const baseUploadsDir = path.resolve(__dirname, "uploads");
    const targetDir = path.resolve(baseUploadsDir, relativePath);
    const user = getDriveUser(req);

    if (
      targetDir !== baseUploadsDir &&
      !targetDir.startsWith(`${baseUploadsDir}${path.sep}`)
    ) {
      return res.status(403).json({ error: "Access denied." });
    }

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: "Directory not found." });
    }

    // NOTE: allow read access for listing files — do not block by subgroup.
    // The UI already hides folders a user shouldn't see, so serving file
    // contents for visible folders is allowed.

    const items = fs.readdirSync(targetDir);
    let folders = [];
    let files = [];

    items.forEach((item) => {
      const fullPath = path.join(targetDir, item);
      const stats = fs.lstatSync(fullPath);
      const childPath = relativePath ? path.join(relativePath, item) : item;

      // Do not filter child items by subgroup permissions; return all items
      // inside the requested directory.

      if (stats.isDirectory()) {
        folders.push(item);
      } else {
        files.push(item);
      }
    });

    res.json({
      folders,
      files,
      permissions: { canWrite: canManageDrivePath(user, relativePath) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error reading directory." });
  }
});

// Serve a single file from the uploads drive after performing access checks.
app.get("/drive/file", (req, res) => {
  try {
    const relativePath = req.query.path || "";
    const baseUploadsDir = path.resolve(__dirname, "uploads");
    const targetFile = path.resolve(baseUploadsDir, relativePath);
    const user = getDriveUser(req);

    // Ensure the requested path is inside the uploads directory.
    if (
      !relativePath ||
      !(
        targetFile === baseUploadsDir ||
        targetFile.startsWith(`${baseUploadsDir}${path.sep}`)
      )
    ) {
      return res.status(403).json({ error: "Access denied." });
    }

    if (!fs.existsSync(targetFile))
      return res.status(404).json({ error: "File not found." });
    if (!fs.lstatSync(targetFile).isFile())
      return res.status(400).json({ error: "That item is not a file." });

    // Allow file reads without subgroup permission checks; directory path
    // membership is enough to locate the file.

    // Downloads must use an attachment header; otherwise send inline so browsers
    // can preview media, PDFs, and other formats they support.
    const send =
      req.query.download === "1"
        ? (callback) =>
            res.download(targetFile, path.basename(targetFile), callback)
        : (callback) => res.sendFile(targetFile, callback);

    send((err) => {
      if (err) {
        console.error(err);
        if (!res.headersSent)
          res.status(500).json({ error: "Could not read file." });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error reading file." });
  }
});

app.listen(PORT, () => {
  console.log(
    `Server is running at https://taco-childhood-jailbreak.ngrok-free.dev`,
  );
});
