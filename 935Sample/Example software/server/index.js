import express from "express";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import { exec } from "child_process";

const app = express();
const PORT = 3000;

dotenv.config();

app.use(express.json());
app.use(cors());

// ==== GitHub Logic ==== //
console.log("Deploy key:", process.env.DEPLOY_KEY);

// Allows github to auto pull code
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

// ==== Example code ==== //
app.get("/match/data/:id", (req, res) => {
  const id = Number(req.params.id);
  const team = getMatch().find((team) => team.id === id);
  if (!team) return res.status(404).json({ error: "User not found" });
  res.json(team);
});

app.get("/match/data", (req, res) => {
  res.json(getMatch());
});

// ==== Match endpoints ==== //
app.post("/match/upload", (req, res) => {
  try {
    const users = getMatch();
    const newData = req.body;

    if (!newData || typeof newData !== "object") {
      return res.status(400).json({ error: "Invalid request body" });
    }

    newData.id = Date.now(); // unique id for each submission
    users.push(newData);

    fs.writeFileSync("matchData.json", JSON.stringify(users, null, 2));

    console.log(
      `[upload] Match saved — team ${newData.meta?.teamNumber}, match ${newData.meta?.matchNumber}, scout ${newData.meta?.scoutName}`,
    );
    res.status(201).json(newData);
  } catch (err) {
    console.error("[upload] Failed to save match data:", err.message);
    res
      .status(500)
      .json({ error: "Failed to save match data", detail: err.message });
  }
});

app.delete("/delete/match/:id", (req, res) => {
  const matchData = getMatch();
  const matchId = parseInt(req.params.id);
  
  // FIX 1: Change matchData.id to match.id (checking the individual item)
  const matchIndex = matchData.findIndex(match => match.id === matchId);
  
  // If the item wasn't found, let the client know immediately
  if (matchIndex === -1) {
    return res.status(404).json({ error: "Match not found" });
  }

  // Remove the item from the array
  matchData.splice(matchIndex, 1);
  
  // FIX 2: Move file saving inside or alongside the success path
  fs.writeFileSync("matchData.json", JSON.stringify(matchData, null, 2));
  
  // Send the success response back to curl
  return res.status(204).send(); 
});


// ==== Pit endpoints ==== //
app.post("/pit/upload", (req, res) => {
  try {
    const users = getPit();
    const newData = req.body;

    if (!newData || typeof newData !== "object") {
      return res.status(400).json({ error: "Invalid request body" });
    }

    newData.id = Date.now();
    users.push(newData);

    fs.writeFileSync("pitData.json", JSON.stringify(users, null, 2));

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

app.post('/pit/save', (req, res) => {
  const schema = req.body;

  if (!schema || !schema.id) {
    return res.status(400).json({ error: 'Invalid schema — missing id' });
  }

  try {
    fs.writeFileSync('pitForm.json', JSON.stringify(schema, null, 2), 'utf-8');
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

    fs.writeFileSync("matchData.json", JSON.stringify(users, null, 2));

    console.log(
      `[upload] Match saved — team ${newData.meta?.teamNumber}, match ${newData.meta?.matchNumber}, scout ${newData.meta?.scoutName}`,
    );
    res.status(201).json(newData);
  } catch (err) {
    console.error("[upload] Failed to save match data:", err.message);
    res
      .status(500)
      .json({ error: "Failed to save match data", detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
