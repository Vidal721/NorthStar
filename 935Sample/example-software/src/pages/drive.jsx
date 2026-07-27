import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRotateLeft,
  faArrowRotateRight,
  faTrash,
  faCirclePlay,
} from "@fortawesome/free-solid-svg-icons";
import bgImage from "../assets/field.png";

const TBA_BASE = "https://www.thebluealliance.com/api/v3";
const TEAM_COLORS = [
  "#FF375F",
  "#FF9F0A",
  "#FFD60A",
  "#30D158",
  "#0A84FF",
  "#BF5AF2",
];
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 500;
const COMP_ORDER = { qm: 0, ef: 1, qf: 2, sf: 3, f: 4 };
const COMP_NAMES = { ef: "Eighth", qf: "Quarter", sf: "Semi", f: "Final" };

function tbaFetch(path, key) {
  return fetch(`${TBA_BASE}${path}`, { headers: { "X-TBA-Auth-Key": key } });
}

function matchLabel(m) {
  if (m.comp_level === "qm") return `Qual ${m.match_number}`;
  const set = m.set_number ? `${m.set_number}-` : "";
  return `${COMP_NAMES[m.comp_level] || m.comp_level.toUpperCase()} ${set}${m.match_number}`;
}

function matchSortKey(m) {
  return (
    (COMP_ORDER[m.comp_level] ?? 5) * 100000 +
    (m.set_number || 0) * 1000 +
    m.match_number
  );
}

function myAlliance(match, teamKey) {
  if (match.alliances?.red?.team_keys?.includes(teamKey)) return "red";
  if (match.alliances?.blue?.team_keys?.includes(teamKey)) return "blue";
  return null;
}

/* ---------- Offline cache helpers (stale-while-revalidate via localStorage) ---------- */
const REFRESH_INTERVAL_MS = 3 * 60 * 1000; // keep matches fresh every few minutes

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ data: value, cachedAt: Date.now() }),
    );
  } catch (err) {
    console.error("Cache write failed:", err);
  }
}

/* ---------- Hold-to-perfect-shape recognition ----------
   Classifies a freehand stroke as a line, rectangle/square, or circle
   if it closely matches one, otherwise returns null (keep freehand). */
const HOLD_MS = 2000;
const HOLD_MOVE_TOLERANCE = 6; // px (canvas space) movement allowed while "holding"

function pointDist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function recognizeShape(points) {
  if (!points || points.length < 6) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  const diag = Math.hypot(w, h);
  if (diag < 20) return null; // too small / a tap

  const first = points[0];
  const last = points[points.length - 1];
  const closed = pointDist(first, last) < Math.max(24, diag * 0.18);

  // ---- Line check: low deviation from the straight first->last segment ----
  const lineLen = pointDist(first, last);
  if (lineLen > diag * 0.7) {
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const len = Math.hypot(dx, dy) || 1;
    let maxDev = 0;
    for (const p of points) {
      const t = ((p.x - first.x) * dx + (p.y - first.y) * dy) / (len * len);
      const projX = first.x + t * dx;
      const projY = first.y + t * dy;
      maxDev = Math.max(maxDev, pointDist(p, { x: projX, y: projY }));
    }
    if (maxDev < Math.max(10, len * 0.06)) {
      return { type: "line", x1: first.x, y1: first.y, x2: last.x, y2: last.y };
    }
  }

  if (!closed) return null;

  // ---- Circle check: low variance of radius from centroid ----
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const radii = points.map((p) => pointDist(p, { x: cx, y: cy }));
  const avgR = radii.reduce((a, b) => a + b, 0) / radii.length;
  const variance =
    radii.reduce((a, r) => a + (r - avgR) * (r - avgR), 0) / radii.length;
  const stdDev = Math.sqrt(variance);
  const aspect = w / h || 1;
  if (stdDev / avgR < 0.16 && aspect > 0.7 && aspect < 1.4) {
    return { type: "circle", cx, cy, r: avgR };
  }

  // ---- Rectangle/square check: points hug the bounding-box perimeter ----
  const edgeTolerance = Math.max(14, diag * 0.08);
  let onEdge = 0;
  for (const p of points) {
    const nearLeft = Math.abs(p.x - minX) < edgeTolerance;
    const nearRight = Math.abs(p.x - maxX) < edgeTolerance;
    const nearTop = Math.abs(p.y - minY) < edgeTolerance;
    const nearBottom = Math.abs(p.y - maxY) < edgeTolerance;
    if (nearLeft || nearRight || nearTop || nearBottom) onEdge++;
  }
  if (onEdge / points.length > 0.75 && w > 20 && h > 20) {
    return { type: "rect", x: minX, y: minY, w, h };
  }

  return null;
}

function drawRecognizedShape(ctx, shape, color, lineWidth) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  if (shape.type === "line") {
    ctx.moveTo(shape.x1, shape.y1);
    ctx.lineTo(shape.x2, shape.y2);
  } else if (shape.type === "circle") {
    ctx.arc(shape.cx, shape.cy, shape.r, 0, Math.PI * 2);
  } else if (shape.type === "rect") {
    ctx.rect(shape.x, shape.y, shape.w, shape.h);
  }
  ctx.stroke();
  ctx.restore();
}

function drawFreehand(ctx, points, color, lineWidth) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.restore();
}

/* ============================== Onboarding (first run) ============================== */
function OnboardingScreen({ onComplete }) {
  const [team, setTeam] = useState("");
  const [key, setKey] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const teamTrimmed = team.trim();
    const keyTrimmed = key.trim();
    if (!/^[0-9]{1,5}$/.test(teamTrimmed)) {
      setError("Enter a valid team number.");
      return;
    }
    if (!keyTrimmed) {
      setError("Enter your TBA API key.");
      return;
    }
    setChecking(true);
    try {
      const res = await tbaFetch("/status", keyTrimmed);
      if (!res.ok) throw new Error("bad key");
      const data = await res.json();
      if (!data || data.Error) throw new Error("bad key");
      onComplete(teamTrimmed, keyTrimmed);
    } catch {
      setError(
        "That API key couldn't be verified. Double-check it and try again.",
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h1>Welcome</h1>
        <p className="setup-sub">Set up your team to get started.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="team-input">Team Number</label>
          <input
            id="team-input"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            placeholder="935"
            inputMode="numeric"
            autoFocus
          />
          <label htmlFor="key-input">TBA API Key</label>
          <input
            id="key-input"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste your Read API Key"
            type="password"
          />
          <div className="setup-hint">
            Get a key at{" "}
            <a
              href="https://www.thebluealliance.com/account"
              target="_blank"
              rel="noreferrer"
            >
              thebluealliance.com/account
            </a>
          </div>
          {error && <div className="setup-error">{error}</div>}
          <button type="submit" className="primary-btn" disabled={checking}>
            {checking ? "Verifying…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ============================== Settings sheet ============================== */
function SettingsSheet({
  teamNumber,
  tbaKey,
  year,
  event,
  onClose,
  onSave,
  onFetchEvents,
  events,
  loadingEvents,
  onDeleteAllDrawings,
}) {
  const [team, setTeam] = useState(teamNumber);
  const [key, setKey] = useState(tbaKey);
  const [pendingYear, setPendingYear] = useState(year);
  const [search, setSearch] = useState("");
  const [pendingEvent, setPendingEvent] = useState(event);
  const [error, setError] = useState("");

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const arr = [];
    for (let y = current + 1; y >= current - 4; y--) arr.push(y);
    return arr;
  }, []);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (ev) =>
        ev.name.toLowerCase().includes(q) ||
        (ev.city || "").toLowerCase().includes(q),
    );
  }, [events, search]);

  const handleSave = () => {
    if (!/^[0-9]{1,5}$/.test(team.trim())) {
      setError("Enter a valid team number.");
      return;
    }
    if (!key.trim()) {
      setError("Enter your TBA API key.");
      return;
    }
    onSave({
      team: team.trim(),
      key: key.trim(),
      year: pendingYear,
      event: pendingEvent,
    });
  };

  return (
    <div className="sb-sheet-overlay">
      <div className="sb-sheet">
        <div className="sb-sheet-header">
          <button className="sb-sheet-btn cancel" onClick={onClose}>
            Cancel
          </button>
          <h3>Settings</h3>
          <button className="sb-sheet-btn save" onClick={handleSave}>
            Save
          </button>
        </div>
        <div className="sb-sheet-body">
          <div className="sb-sheet-group-label">Account</div>
          <div className="sb-sheet-row">
            <label>Team Number</label>
            <input
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div className="sb-sheet-row">
            <label>TBA API Key</label>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              type="password"
              placeholder="Paste your key here"
            />
            <div className="sb-sheet-hint">
              Get a key at{" "}
              <a
                href="https://www.thebluealliance.com/account"
                target="_blank"
                rel="noreferrer"
              >
                thebluealliance.com
              </a>
            </div>
          </div>
          {error && <div className="setup-error">{error}</div>}

          <div className="sb-sheet-group-label">Event</div>
          <div className="sb-sheet-row">
            <label>Season</label>
            <select
              value={pendingYear}
              onChange={(e) => setPendingYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <input
            className="sb-sheet-event-search"
            placeholder="Search events…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="sb-sheet-event-list">
            {loadingEvents && <div className="sb-loading">Loading events…</div>}
            {!loadingEvents && filteredEvents.length === 0 && (
              <div className="sb-empty">
                No events yet — try Fetch Events below.
              </div>
            )}
            {!loadingEvents &&
              filteredEvents.map((ev) => (
                <div
                  key={ev.key}
                  className={`sb-sheet-event-item${pendingEvent?.key === ev.key ? " active" : ""}`}
                  onClick={() => setPendingEvent(ev)}
                >
                  {ev.name}
                  <div className="sub">
                    {ev.city ? `${ev.city}, ${ev.state_prov || ""}` : ""}
                  </div>
                </div>
              ))}
          </div>
          <button
            className="sb-sheet-btn save"
            style={{ marginTop: 8 }}
            onClick={() =>
              onFetchEvents(
                team.trim() || teamNumber,
                key.trim() || tbaKey,
                pendingYear,
              )
            }
          >
            ↓ Fetch Events for {pendingYear}
          </button>

          <div className="sb-sheet-group-label">Data</div>
          <button className="sb-sheet-danger-btn" onClick={onDeleteAllDrawings}>
            Delete All Match Drawings
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================== Video Modal ============================== */
function VideoModal({ videoKey, onClose }) {
  return (
    <div className="sb-modal-overlay" onClick={onClose}>
      <button className="sb-modal-close" onClick={onClose}>
        ✕
      </button>
      <div className="sb-modal" onClick={(e) => e.stopPropagation()}>
        <iframe
          src={`https://www.youtube.com/embed/${videoKey}?autoplay=1`}
          title="Match video"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}

/* ============================== Sidebar (matches column) ============================== */
function Sidebar({
  collapsed,
  onToggle,
  teamNumber,
  event,
  onOpenSettings,
  onRefresh,
  matches,
  loadingMatches,
  onOpenMatch,
  selectedMatchKey,
  isOnline,
  lastSynced,
}) {
  const teamKey = `frc${teamNumber}`;
  const sorted = useMemo(
    () => [...matches].sort((a, b) => matchSortKey(a) - matchSortKey(b)),
    [matches],
  );

  return (
    <div className={`sb-sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sb-sidebar-header">
        <button
          className="sb-iconbtn"
          onClick={onOpenSettings}
          title="Settings"
        >
          ⚙
        </button>
        <div className="sb-sidebar-title">
          <div className="name">{event ? event.name : "No event selected"}</div>
          <div className="sub">Team {teamNumber}</div>
        </div>
        <button
          className="sb-iconbtn"
          onClick={onRefresh}
          title="Refresh matches"
        >
          ⟳
        </button>
        <button className="sb-iconbtn" onClick={onToggle} title="Collapse">
          ◧
        </button>
      </div>
      <div className={`sb-sync-pill${isOnline ? "" : " offline"}`}>
        <span className="sb-sync-dot" />
        {isOnline
          ? lastSynced
            ? `Synced ${lastSynced}`
            : "Online"
          : "Offline — showing saved data"}
      </div>
      <div className="sb-section-label">Qualifications &amp; Playoffs</div>
      <div className="sb-match-list">
        {!event && (
          <div className="sb-empty">Open Settings to choose a regional.</div>
        )}
        {event && loadingMatches && (
          <div className="sb-loading">Loading matches…</div>
        )}
        {event && !loadingMatches && sorted.length === 0 && (
          <div className="sb-empty">
            No matches found yet for team {teamNumber}.
          </div>
        )}
        {event &&
          sorted.map((m) => {
            const mine = myAlliance(m, teamKey);
            const redScore = m.alliances?.red?.score;
            const blueScore = m.alliances?.blue?.score;
            const played =
              m.winning_alliance !== undefined &&
              m.winning_alliance !== null &&
              redScore != null &&
              redScore >= 0 &&
              m.comp_level &&
              m.winning_alliance !== "";
            const won = played && m.winning_alliance === mine;
            return (
              <div
                key={m.key}
                className={`sb-match-row${mine ? ` mine-${mine}` : ""}${m.key === selectedMatchKey ? " active" : ""}`}
                onClick={() => onOpenMatch(m)}
              >
                <SidebarMatchRow
                  m={m}
                  mine={mine}
                  played={played}
                  won={won}
                  teamKey={teamKey}
                />
              </div>
            );
          })}
      </div>
    </div>
  );
}

function SidebarMatchRow({ m, mine, played, won, teamKey }) {
  return (
    <MatchRowInner
      m={m}
      mine={mine}
      played={played}
      won={won}
      teamKey={teamKey}
    />
  );
}

function MatchRowInner({ m, mine, played, won, teamKey }) {
  const redTeams = m.alliances.red.team_keys.map((t) => t.replace("frc", ""));
  const blueTeams = m.alliances.blue.team_keys.map((t) => t.replace("frc", ""));
  return (
    <>
      <div className="sb-match-row-top">
        <span className="label">{matchLabel(m)}</span>
        {played && (
          <span className="score">
            <span
              className={`sb-score-part ${m.winning_alliance === "red" ? "win" : "lose"}`}
            >
              {m.alliances.red.score}
            </span>
            –
            <span
              className={`sb-score-part ${m.winning_alliance === "blue" ? "win" : "lose"}`}
            >
              {m.alliances.blue.score}
            </span>
            {mine && (
              <span className={`sb-result-dot ${won ? "win" : "lose"}`}>
                {won ? "✓" : "✕"}
              </span>
            )}
          </span>
        )}
      </div>
      <div className="sb-team-line">
        <span className="swatch red" />
        {redTeams.map((t, i) => (
          <React.Fragment key={t}>
            {i > 0 && <span>·</span>}
            {`frc${t}` === teamKey ? <b>{t}</b> : t}
          </React.Fragment>
        ))}
      </div>
      <div className="sb-team-line">
        <span className="swatch blue" />
        {blueTeams.map((t, i) => (
          <React.Fragment key={t}>
            {i > 0 && <span>·</span>}
            {`frc${t}` === teamKey ? <b>{t}</b> : t}
          </React.Fragment>
        ))}
      </div>
    </>
  );
}

/* ============================== Strategy Board ============================== */
function StrategyBoard({
  match,
  teamNumber,
  onWatchVideo,
  onOpenSidebar,
  sidebarCollapsed,
}) {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const historyRef = useRef([]);
  const historyStepRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [brushColor, setBrushColor] = useState(TEAM_COLORS[0]);
  const [brushSize, setBrushSize] = useState(5);
  const [armedTeam, setArmedTeam] = useState(null);
  const [shapeAssist, setShapeAssist] = useState(true);
  const [shapeToast, setShapeToast] = useState(null);
  const [holdProgress, setHoldProgress] = useState(null); // {x, y, pct} in screen space

  // Live stroke state (kept in refs so handlers stay cheap/synchronous)
  const pointsRef = useRef([]);
  const preStrokeSnapshotRef = useRef(null);
  const holdTimerRef = useRef(null);
  const holdRafRef = useRef(null);
  const holdStartRef = useRef(0);
  const lastMovePointRef = useRef(null);
  const shapeLockedRef = useRef(false);
  const [slots, setSlots] = useState({
    red: [null, null, null],
    blue: [null, null, null],
  });

  const storageKey = `sb_board_${match.key}`;
  const teamKeyMine = `frc${teamNumber}`;
  const mine = myAlliance(match, teamKeyMine);
  const redTeams = match.alliances.red.team_keys.map((t) =>
    t.replace("frc", ""),
  );
  const blueTeams = match.alliances.blue.team_keys.map((t) =>
    t.replace("frc", ""),
  );
  const allTeamsOrdered = [...redTeams, ...blueTeams];
  const colorFor = (team) =>
    TEAM_COLORS[allTeamsOrdered.indexOf(team) % TEAM_COLORS.length];
  const video = (match.videos || []).find((v) => v.type === "youtube");

  const updateHistoryState = () => {
    setCanUndo(historyStepRef.current > 0);
    setCanRedo(historyStepRef.current < historyRef.current.length - 1);
  };

  const persist = useCallback(
    (slotsOverride) => {
      try {
        const canvas = canvasRef.current;
        const dataUrl = canvas ? canvas.toDataURL("image/png") : null;
        localStorage.setItem(
          storageKey,
          JSON.stringify({ drawing: dataUrl, slots: slotsOverride || slots }),
        );
      } catch (err) {
        console.error("Could not save strategy board:", err);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [slots, storageKey],
  );

  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current = historyRef.current.slice(
      0,
      historyStepRef.current + 1,
    );
    historyRef.current.push(data);
    historyStepRef.current += 1;
    updateHistoryState();
    persist();
  }, [persist]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    historyRef.current = [];
    historyStepRef.current = -1;
    setArmedTeam(null);

    let saved = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) saved = JSON.parse(raw);
    } catch {
      saved = null;
    }
    setSlots(
      saved?.slots || { red: [null, null, null], blue: [null, null, null] },
    );

    const drawBaseline = () => {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      historyRef.current = [data];
      historyStepRef.current = 0;
      updateHistoryState();
    };

    if (saved?.drawing) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawBaseline();
      };
      img.src = saved.drawing;
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(
        CANVAS_WIDTH / img.width,
        CANVAS_HEIGHT / img.height,
      );
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (CANVAS_WIDTH - w) / 2, (CANVAS_HEIGHT - h) / 2, w, h);
      drawBaseline();
    };
    img.onerror = () => drawBaseline();
    img.src = bgImage;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.key]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const getScreenPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const clearHoldTimer = () => {
    if (holdRafRef.current) cancelAnimationFrame(holdRafRef.current);
    holdRafRef.current = null;
  };

  const triggerShapeRecognition = () => {
    clearHoldTimer();
    setHoldProgress(null);
    const shape = recognizeShape(pointsRef.current);
    if (!shape) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (preStrokeSnapshotRef.current) {
      ctx.putImageData(preStrokeSnapshotRef.current, 0, 0);
    }
    drawRecognizedShape(ctx, shape, brushColor, brushSize);
    shapeLockedRef.current = true;
    const label =
      shape.type === "rect"
        ? "Rectangle"
        : shape.type === "circle"
          ? "Circle"
          : "Straight line";
    setShapeToast(label);
    if (navigator.vibrate) navigator.vibrate(15);
    setTimeout(() => setShapeToast(null), 1300);
  };

  const armHoldTimer = (e) => {
    clearHoldTimer();
    const screenPt = getScreenPoint(e);
    holdStartRef.current = performance.now();
    setHoldProgress({ x: screenPt.x, y: screenPt.y, pct: 0 });
    const tick = () => {
      const elapsed = performance.now() - holdStartRef.current;
      const pct = Math.min(1, elapsed / HOLD_MS);
      setHoldProgress((prev) => (prev ? { ...prev, pct } : prev));
      if (pct >= 1) {
        triggerShapeRecognition();
        return;
      }
      holdRafRef.current = requestAnimationFrame(tick);
    };
    holdRafRef.current = requestAnimationFrame(tick);
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { x, y } = getCoordinates(e);
    preStrokeSnapshotRef.current = ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );
    pointsRef.current = [{ x, y }];
    lastMovePointRef.current = { x, y };
    shapeLockedRef.current = false;
    isDrawingRef.current = true;
    drawFreehand(ctx, pointsRef.current, brushColor, brushSize);
    if (shapeAssist) armHoldTimer(e);
  };

  const draw = (e) => {
    if (!isDrawingRef.current || shapeLockedRef.current) return;
    if (e.cancelable && e.type === "touchmove") e.preventDefault();
    const { x, y } = getCoordinates(e);
    pointsRef.current.push({ x, y });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (preStrokeSnapshotRef.current) {
      ctx.putImageData(preStrokeSnapshotRef.current, 0, 0);
    }
    drawFreehand(ctx, pointsRef.current, brushColor, brushSize);
    if (shapeAssist) {
      const last = lastMovePointRef.current;
      if (!last || pointDist(last, { x, y }) > HOLD_MOVE_TOLERANCE) {
        lastMovePointRef.current = { x, y };
        armHoldTimer(e);
      }
    }
  };

  const stopDrawing = () => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      clearHoldTimer();
      setHoldProgress(null);
      saveState();
      pointsRef.current = [];
      preStrokeSnapshotRef.current = null;
      shapeLockedRef.current = false;
    }
  };

  useEffect(() => {
    return () => clearHoldTimer();
  }, []);

  const handleUndo = () => {
    if (historyStepRef.current > 0) {
      historyStepRef.current -= 1;
      canvasRef.current
        .getContext("2d")
        .putImageData(historyRef.current[historyStepRef.current], 0, 0);
      updateHistoryState();
      persist();
    }
  };

  const handleRedo = () => {
    if (historyStepRef.current < historyRef.current.length - 1) {
      historyStepRef.current += 1;
      canvasRef.current
        .getContext("2d")
        .putImageData(historyRef.current[historyStepRef.current], 0, 0);
      updateHistoryState();
      persist();
    }
  };

  const handleClear = () => {
    if (historyRef.current.length > 0) {
      canvasRef.current
        .getContext("2d")
        .putImageData(historyRef.current[0], 0, 0);
      saveState();
    }
  };

  const exportImage = () => {
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `${match.key}-strategy.png`;
    link.href = dataUrl;
    link.click();
  };

  const selectTeam = (team) => {
    setArmedTeam(team);
    setBrushColor(colorFor(team));
  };

  const assignSlot = (alliance, index, team) => {
    setSlots((prev) => {
      const next = { red: [...prev.red], blue: [...prev.blue] };
      next[alliance][index] = team;
      persist(next);
      return next;
    });
  };

  const handleSlotClick = (alliance, index) => {
    if (slots[alliance][index]) {
      assignSlot(alliance, index, null);
    } else if (armedTeam) {
      assignSlot(alliance, index, armedTeam);
    }
  };

  const TeamPill = ({ team }) => (
    <div
      className={`sb-team-pill${armedTeam === team ? " armed" : ""}${team === teamNumber ? " mine" : ""}`}
      style={{ background: colorFor(team) }}
      onClick={() => selectTeam(team)}
      title={`Team ${team}`}
    >
      {team}
    </div>
  );

  const SlotStack = ({ alliance }) => (
    <div className="sb-slot-row">
      {[0, 1, 2].map((i) => {
        const assigned = slots[alliance][i];
        return (
          <div
            key={i}
            className={`sb-slot${assigned ? " filled" : ""}`}
            style={
              assigned
                ? {
                    background: colorFor(assigned),
                    borderColor: colorFor(assigned),
                  }
                : {}
            }
            onClick={() => handleSlotClick(alliance, i)}
            title={
              assigned
                ? `Team ${assigned} — tap to clear`
                : `Starting spot ${i + 1}`
            }
          >
            {assigned || i + 1}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="sb-topbar">
        {sidebarCollapsed && (
          <button
            className="sb-iconbtn"
            onClick={onOpenSidebar}
            title="Show matches"
          >
            ☰
          </button>
        )}
        <h3>{matchLabel(match)}</h3>
        {mine && (
          <span className="my-alliance">
            <span className={`sb-dot ${mine}`} />
            with{" "}
            {(mine === "red" ? redTeams : blueTeams)
              .filter((t) => t !== teamNumber)
              .join(", ")}
          </span>
        )}
        {video && (
          <button
            className="sb-video-btn"
            onClick={() => onWatchVideo(video.key)}
          >
            <FontAwesomeIcon icon={faCirclePlay} />
          </button>
        )}
      </div>
      <div className="sb-board-wrap">
        <div className="sb-edge-col1">
          {redTeams.map((t) => (
            <TeamPill key={t} team={t} />
          ))}
        </div>
        <div className="sb-edge-col3">
          <SlotStack alliance="red" />
        </div>

        <div className="sb-canvas-area">
          <div className="sb-toolbar">
            <div className="sb-tool-group">
              <input
                type="color"
                value={brushColor}
                onChange={(e) => {
                  setArmedTeam(null);
                  setBrushColor(e.target.value);
                }}
              />
            </div>
            <div className="sb-tool-group">
              <span>{brushSize}px</span>
              <input
                type="range"
                min="1"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
              />
            </div>
            <div className="sb-divider" />
            <button
              className="sb-icon-btn"
              disabled={!canUndo}
              onClick={handleUndo}
            >
              <FontAwesomeIcon icon={faArrowRotateLeft} />
            </button>
            <button
              className="sb-icon-btn"
              disabled={!canRedo}
              onClick={handleRedo}
            >
              <FontAwesomeIcon icon={faArrowRotateRight} />
            </button>
            <button className="sb-icon-btn danger" onClick={handleClear}>
              <FontAwesomeIcon icon={faTrash} />
            </button>
            <div className="sb-divider" />
            <button className="sb-icon-btn primary" onClick={exportImage}>
              Export
            </button>
          </div>
          <div className="sb-canvas-frame">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              onTouchCancel={stopDrawing}
            />
          </div>
        </div>

        <div className="sb-edge-col2">
          {blueTeams.map((t) => (
            <TeamPill key={t} team={t} />
          ))}
        </div>
        <div className="sb-edge-col4">
          <SlotStack alliance="blue" />
        </div>
      </div>
    </>
  );
}

/* ============================== App Root ============================== */
export default function StrategyApp() {
  const [teamNumber, setTeamNumber] = useState(
    () => localStorage.getItem("sb_team_number") || "",
  );
  const [tbaKey, setTbaKey] = useState(
    () => localStorage.getItem("sb_tba_key") || "",
  );
  const [ready, setReady] = useState(false);

  const [year, setYear] = useState(new Date().getFullYear());
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(() => {
    try {
      const raw = localStorage.getItem("sb_selected_event");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [videoKey, setVideoKey] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (teamNumber && tbaKey) setReady(true);
    else setSettingsOpen(false);
  }, [teamNumber, tbaKey]);

  const fetchEvents = useCallback((team, key, forYear) => {
    if (!team || !key) return;
    setLoadingEvents(true);
    tbaFetch(`/team/frc${team}/events/${forYear}/simple`, key)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
  }, []);

  const fetchMatches = useCallback((event, team, key) => {
    if (!event) return;
    setLoadingMatches(true);
    const teamKey = `frc${team}`;
    tbaFetch(`/event/${event.key}/matches`, key)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const ours = (Array.isArray(data) ? data : []).filter(
          (m) =>
            m.alliances?.red?.team_keys?.includes(teamKey) ||
            m.alliances?.blue?.team_keys?.includes(teamKey),
        );
        setMatches(ours);
      })
      .catch(() => setMatches([]))
      .finally(() => setLoadingMatches(false));
  }, []);

  useEffect(() => {
    if (ready && teamNumber && tbaKey) fetchEvents(teamNumber, tbaKey, year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (ready && selectedEvent) fetchMatches(selectedEvent, teamNumber, tbaKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectedEvent]);

  const handleOnboardingComplete = (team, key) => {
    localStorage.setItem("sb_team_number", team);
    localStorage.setItem("sb_tba_key", key);
    setTeamNumber(team);
    setTbaKey(key);
    setReady(true);
    fetchEvents(team, key, year);
  };

  const handleSettingsSave = ({ team, key, year: newYear, event }) => {
    localStorage.setItem("sb_team_number", team);
    localStorage.setItem("sb_tba_key", key);
    setTeamNumber(team);
    setTbaKey(key);
    setYear(newYear);
    if (event && event.key !== selectedEvent?.key) {
      setSelectedEvent(event);
      localStorage.setItem("sb_selected_event", JSON.stringify(event));
      setSelectedMatch(null);
    }
    setSettingsOpen(false);
  };

  const handleDeleteAllDrawings = () => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb_board_"))
      .forEach((k) => localStorage.removeItem(k));
    setSettingsOpen(false);
  };

  if (!ready) return <OnboardingScreen onComplete={handleOnboardingComplete} />;

  return (
    <div className="sb-root">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        teamNumber={teamNumber}
        event={selectedEvent}
        onOpenSettings={() => setSettingsOpen(true)}
        onRefresh={() =>
          selectedEvent && fetchMatches(selectedEvent, teamNumber, tbaKey)
        }
        matches={matches}
        loadingMatches={loadingMatches}
        onOpenMatch={setSelectedMatch}
        selectedMatchKey={selectedMatch?.key}
      />
      <div className="sb-main">
        {!selectedMatch && (
          <div className="sb-empty-state">
            {selectedEvent
              ? "Select a match from the sidebar to open its strategy board."
              : "Open Settings to choose your regional."}
          </div>
        )}
        {selectedMatch && (
          <StrategyBoard
            match={selectedMatch}
            teamNumber={teamNumber}
            onWatchVideo={setVideoKey}
            onOpenSidebar={() => setSidebarCollapsed(false)}
            sidebarCollapsed={sidebarCollapsed}
          />
        )}
      </div>
      {settingsOpen && (
        <SettingsSheet
          teamNumber={teamNumber}
          tbaKey={tbaKey}
          year={year}
          event={selectedEvent}
          events={events}
          loadingEvents={loadingEvents}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSettingsSave}
          onFetchEvents={fetchEvents}
          onDeleteAllDrawings={handleDeleteAllDrawings}
        />
      )}
      {videoKey && (
        <VideoModal videoKey={videoKey} onClose={() => setVideoKey(null)} />
      )}
    </div>
  );
}