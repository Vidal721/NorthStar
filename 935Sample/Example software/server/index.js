import express from "express";
import fs from "fs";
import cors from "cors";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

function getMatch() {
  return JSON.parse(fs.readFileSync("matchData.json", "utf8"));
}

function getPit() {
  return JSON.parse(fs.readFileSync("pitData.json", "utf8"));
}

function getAdmin() {
  return JSON.parse(fs.readFileSync("adminData.json", "utf8"));
}

app.get("/users/:id", (req, res) => {
  const id = Number(req.params.id);
  const user = getMatch().find((user) => user.id === id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

app.get("/users", (req, res) => {
  res.json(getMatch());
});

app.post("/api/upload", (req, res) => {
  try {
    const users = getMatch();
    const newData = req.body;

    if (!newData || typeof newData !== "object") {
      return res.status(400).json({ error: "Invalid request body" });
    }

    newData.id = Date.now(); // unique id for each submission
    users.push(newData);

    fs.writeFileSync("matchData.json", JSON.stringify(users, null, 2));

    console.log(`[upload] Match saved — team ${newData.meta?.teamNumber}, match ${newData.meta?.matchNumber}, scout ${newData.meta?.scoutName}`);
    res.status(201).json(newData);
  } catch (err) {
    console.error("[upload] Failed to save match data:", err.message);
    res.status(500).json({ error: "Failed to save match data", detail: err.message });
  }
});

app.post("/pit/upload", (req, res) => {
    try {
    const users = getPit();
    const newData = req.body;

    if (!newData || typeof newData !== "object") {
      return res.status(400).json({ error: "Invalid request body" });
    }

    newData.id = Date.now(); // unique id for each submission
    users.push(newData);

    fs.writeFileSync("pitData.json", JSON.stringify(users, null, 2));

    console.log(`[upload] Pit data saved`);
    res.status(201).json(newData);
  } catch (err) {
    console.error("[upload] Failed to save pit data:", err.message);
    res.status(500).json({ error: "Failed to save pit data", detail: err.message });
  }
});

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

    console.log(`[upload] Match saved — team ${newData.meta?.teamNumber}, match ${newData.meta?.matchNumber}, scout ${newData.meta?.scoutName}`);
    res.status(201).json(newData);
  } catch (err) {
    console.error("[upload] Failed to save match data:", err.message);
    res.status(500).json({ error: "Failed to save match data", detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});