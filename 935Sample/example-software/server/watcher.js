import https from "https"
import { execSync } from "child_process"

// --- CONFIGURATION ---
const OWNER = "Vidal721";
const REPO = "NorthStar";
const BRANCH = "main";
const CHECK_INTERVAL = 15000; // 15 seconds (in milliseconds)

// Recommended: Add a GitHub Personal Access Token (PAT) if the repo is private
// or to avoid public rate limits. Leave as empty string if public.
const GITHUB_TOKEN = "";
// ---------------------

let lastKnownSha = "";

function getLatestCommit() {
  const options = {
    hostname: "api.github.com",
    path: `/repos/${OWNER}/${REPO}/commits/${BRANCH}`,
    method: "GET",
    headers: {
      "User-Agent": "NodeJS-Repo-Watcher",
      Accept: "application/vnd.github.v3+json",
    },
  };

  if (GITHUB_TOKEN) {
    options.headers["Authorization"] = `token ${GITHUB_TOKEN}`;
  }

  const req = https.request(options, (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      if (res.statusCode !== 200) {
        console.error(`[Watcher] API Error: ${res.statusCode}`);
        return;
      }

      try {
        const commit = JSON.parse(data);
        const currentSha = commit.sha;

        // First run initialization
        if (!lastKnownSha) {
          lastKnownSha = currentSha;
          console.log(
            `[Watcher] Initialized. Monitoring ${BRANCH} at SHA: ${lastKnownSha.substring(0, 7)}`,
          );
          return;
        }

        // If SHA changed, trigger the update
        if (currentSha !== lastKnownSha) {
          console.log(
            `[Watcher] New commit detected: ${currentSha.substring(0, 7)}. Deploying...`,
          );

          // Run heavy operations ONLY when an update is actually present
          execSync(`git fetch origin && git reset --hard origin/${BRANCH}`, {
            stdio: "inherit",
          });
          execSync("npm install --production", { stdio: "inherit" });
          execSync("pm2 restart main-server", { stdio: "inherit" });

          lastKnownSha = currentSha;
          console.log("[Watcher] Deployment completed successfully.");
        }
      } catch (err) {
        console.error("[Watcher] Parsing error:", err.message);
      }
    });
  });

  req.on("error", (err) =>
    console.error("[Watcher] Network error:", err.message),
  );
  req.end();
}

// Start polling
getLatestCommit();
setInterval(getLatestCommit, CHECK_INTERVAL);
