import { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Link } from "react-router-dom";
import {
  faGear,
  faArrowRightFromBracket,
  faChevronLeft,
} from "@fortawesome/free-solid-svg-icons";
import { getApiBaseUrl } from "../apiConfig";
import "./vis.css";

const DENSITY = {
  tight: { label: "Tight", paddingV: "6px", rowHeight: "38px" },
  comfortable: { label: "Comfortable", paddingV: "10px", rowHeight: "48px" },
  loose: { label: "Loose", paddingV: "16px", rowHeight: "60px" },
};

const DEFAULT_SECTION_COLORS = {
  meta: "#8b5cf6",
  auto: "#ef4444",
  teleop: "#3b82f6",
  endgame: "#10b981",
  totals: "#f59e0b",
  metrics: "#ec4899",
  _flat: "#6b7280",
};

const DEFAULT_SUMMARY_COLS = [];
function formatHeader(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function renderCellValue(value, colKey) {
  if (value === undefined || value === null) return "—";
  if (typeof value === "boolean")
    return <span className={`badge ${value}`}>{value ? "Yes" : "No"}</span>;
  if (Array.isArray(value))
    return (
      <div className="pill-container">
        {value.map((t, i) => (
          <span key={i} className="tag-pill">
            {String(t)}
          </span>
        ))}
      </div>
    );
  if (typeof value === "object")
    return (
      <div className="pill-container">
        {Object.entries(value).map(([k, v], i) => (
          <span key={i} className="tag-pill object-pill">
            <strong>{k}:</strong>&nbsp;{String(v)}
          </span>
        ))}
      </div>
    );
  if (colKey === "id" && String(value).length > 8)
    return `…${String(value).slice(-6)}`;
  if (typeof value === "number" && !Number.isInteger(value))
    return value.toFixed(1);
  if (typeof value == "string" && value.includes("T") && value.includes("Z")) {
    return (
      value.split("T")[0] +
      " " +
      value.split("T")[1].split(".")[0].replace("Z", "")
    );
  }
  return String(value);
}

function buildColumnDefs(rows) {
  if (!rows || rows.length === 0) return [];
  const seen = new Set();
  const defs = [];
  for (const row of rows) {
    for (const [topKey, topVal] of Object.entries(row)) {
      if (
        topVal !== null &&
        typeof topVal === "object" &&
        !Array.isArray(topVal)
      ) {
        for (const subKey of Object.keys(topVal)) {
          const flatKey = `${topKey}.${subKey}`;
          if (!seen.has(flatKey)) {
            seen.add(flatKey);
            defs.push({
              flatKey,
              section: topKey,
              subKey,
              label: formatHeader(subKey),
            });
          }
        }
      } else {
        const flatKey = `_flat.${topKey}`;
        if (!seen.has(flatKey)) {
          seen.add(flatKey);
          defs.push({
            flatKey,
            section: "_flat",
            subKey: topKey,
            label: formatHeader(topKey),
          });
        }
      }
    }
  }
  return defs;
}

function getCellValue(row, def) {
  if (def.section === "_flat") return row[def.subKey];
  return row[def.section]?.[def.subKey];
}

function computeProfile(teamRows) {
  const matchCount = teamRows.length;
  let totalCyclesSum = 0, scoringCyclesSum = 0, fitScoreSum = 0, autoFullScoresSum = 0;
  let teleopFullScoresSum = 0, climbSuccessesSum = 0, defenseFormulaScoreSum = 0;
  let autoPossessionsSum = 0, teleopPartialScoresSum = 0, transitScoreSum = 0, transitMissSum = 0;
  let ourShiftSecondsSum = 0, offShiftSecondsSum = 0, transitSecondsSum = 0, shiftsCompletedSum = 0;
  let defendedCyclesSum = 0, offActionsSum = 0, totalFailuresSum = 0;

  teamRows.forEach((match) => {
    const totalCycles = match.totals?.totalCycles || 0;
    const defendedFails = match.totals?.defendedFails || 0;
    const partialScores = match.totals?.partialScores || 0;

    totalCyclesSum += totalCycles;
    scoringCyclesSum += match.totals?.scoringCycles || 0;
    fitScoreSum += match.fitScore || 0;
    autoFullScoresSum += match.auto?.fullScores || 0;
    teleopFullScoresSum += match.teleop?.fullScores || 0;
    climbSuccessesSum += match.endgame?.climbSuccess || 0;
    autoPossessionsSum += match.auto?.possessions || 0;
    teleopPartialScoresSum += partialScores;
    transitScoreSum += match.teleop?.transitScore || 0;
    transitMissSum += match.teleop?.transitMiss || 0;
    ourShiftSecondsSum += match.teleop?.ourShiftSeconds || 0;
    offShiftSecondsSum += match.teleop?.offShiftSeconds || 0;
    transitSecondsSum += match.teleop?.transitSeconds || 0;
    shiftsCompletedSum += match.teleop?.shiftsCompleted || 0;
    defendedCyclesSum += match.teleop?.defendedCycles || 0;
    offActionsSum += match.totals?.offActions || 0;
    totalFailuresSum += (match.auto?.failures || 0) + (match.teleop?.failures || 0) + (match.endgame?.failures || 0);

    const matchResilienceScore = totalCycles > 0
      ? Math.max(0, 1 - (defendedFails / Math.max(totalCycles + (partialScores * 0.2), 1)) * 1.5)
      : 0.5;
    defenseFormulaScoreSum += matchResilienceScore;
  });

  return {
    matchesPlayed: matchCount,
    predictedCycles: matchCount > 0 ? Number((totalCyclesSum / matchCount).toFixed(1)) : 0,
    defenseResilienceRating: matchCount > 0 ? ((defenseFormulaScoreSum / matchCount) * 100).toFixed(1) + '%' : '50.0%',
    autoReliabilityIndex: autoPossessionsSum > 0 ? ((autoFullScoresSum / autoPossessionsSum) * 100).toFixed(1) + '%' : '0.0%',
    teleopOptimizationIndex: (teleopFullScoresSum + teleopPartialScoresSum) > 0 ? ((teleopFullScoresSum / (teleopFullScoresSum + teleopPartialScoresSum)) * 100).toFixed(1) + '%' : '0.0%',
    transitScoringSuccessRate: (transitScoreSum + transitMissSum) > 0 ? ((transitScoreSum / (transitScoreSum + transitMissSum)) * 100).toFixed(1) + '%' : '0.0%',
    cycleVelocitySeconds: totalCyclesSum > 0 ? Number(((ourShiftSecondsSum + offShiftSecondsSum + transitSecondsSum) / totalCyclesSum).toFixed(1)) : 0,
    shiftOutputEfficiency: shiftsCompletedSum > 0 ? Number((totalCyclesSum / shiftsCompletedSum).toFixed(1)) : 0,
    defendedVulnerabilityFactor: totalCyclesSum > 0 ? ((defendedCyclesSum / totalCyclesSum) * 100).toFixed(1) + '%' : '0.0%',
    offensiveActionDensity: matchCount > 0 ? Number((offActionsSum / matchCount).toFixed(1)) : 0,
    matchBreakdownRisk: matchCount > 0 ? ((totalFailuresSum / matchCount) * 100).toFixed(1) + '%' : '0.0%',
    scoringAccuracy: totalCyclesSum > 0 ? ((scoringCyclesSum / totalCyclesSum) * 100).toFixed(1) + '%' : '0.0%',
    climbRate: matchCount > 0 ? ((climbSuccessesSum / matchCount) * 100).toFixed(0) + '%' : '0%',
    avgFitScore: matchCount > 0 ? Math.round(fitScoreSum / matchCount) : 0,
  };
}

const OVERVIEW_STATS = [
  { key: "predictedCycles",           label: "Predicted Cycles",              target: "15.0+ Cycles",    def: "The expected total cycle completion output calculated for their upcoming match profile baseline.", fmt: (v) => v },
  { key: "defenseResilienceRating",   label: "Defense Resilience Rating",     target: "95.0%+",          def: "The capability score tracking how effectively a team holds onto items when physically contested by active defense.", fmt: (v) => v },
  { key: "scoringAccuracy",           label: "Scoring Accuracy",              target: "90.0%+",          def: "Percentage of initiated execution operations that resulted in successful alliance scores.", fmt: (v) => v },
  { key: "autoReliabilityIndex",      label: "Auto Reliability Index",        target: "90.0%+",          def: "Percentage of autonomous period placement possessions successfully converted into full value scores.", fmt: (v) => v },
  { key: "teleopOptimizationIndex",   label: "Teleop Optimization Index",     target: "80.0%+",          def: "Ratio tracking how frequently completed teleop cycles yield maximum-value full scores versus low-value partial items.", fmt: (v) => v },
  { key: "transitScoringSuccessRate", label: "Transit Scoring Success Rate",  target: "85.0%+",          def: "Accuracy rate tracking successful scoring iterations performed while cross-field on the move.", fmt: (v) => v },
  { key: "cycleVelocitySeconds",      label: "Cycle Velocity",                target: "Under 8.0s",      def: "The average time density in seconds required to close out an active system operation cycle.", fmt: (v) => v + "s" },
  { key: "shiftOutputEfficiency",     label: "Shift Output Efficiency",       target: "3.5+ Cycles",     def: "Average volume of system tasks fully completed per execution role shift iteration.", fmt: (v) => v },
  { key: "defendedVulnerabilityFactor", label: "Defended Vulnerability Factor", target: "Below 15.0%",  def: "The match time footprint percentage spent completely suppressed under heavy opposing team defense.", fmt: (v) => v },
  { key: "offensiveActionDensity",    label: "Offensive Action Density",      target: "8.0+ Actions",    def: "Volume metric counting non-scoring match contributions such as dynamic field pushes, interference blocks, or collections.", fmt: (v) => v },
  { key: "matchBreakdownRisk",        label: "Match Breakdown Risk",          target: "0.0%",            def: "The hazard rating reflecting the match incidence frequency of mechanical system failures or field execution faults.", fmt: (v) => v },
  { key: "climbRate",                 label: "Climb Rate",                    target: "100.0%",          def: "The ultimate success verification footprint tracking standard endgame climbing accomplishments.", fmt: (v) => v },
];

function StatTooltip({ label, def, target, anchorRef }) {
  const [pos, setPos] = useState(null);
  const tipRef = useRef(null);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const enter = () => { setPos(el.getBoundingClientRect()); };
    const leave = () => setPos(null);
    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", leave);
    return () => { el.removeEventListener("mouseenter", enter); el.removeEventListener("mouseleave", leave); };
  }, [anchorRef]);

  useEffect(() => {
    if (!pos || !tipRef.current) return;
    const tip = tipRef.current;
    const vw = window.innerWidth;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = pos.left;
    let top = pos.top - th - 8;
    if (left + tw > vw - 8) left = vw - tw - 8;
    if (left < 8) left = 8;
    if (top < 8) top = pos.bottom + 6;
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }, [pos]);

  if (!pos) return null;
  return ReactDOM.createPortal(
    <div ref={tipRef} className="team-kv-tooltip" style={{ position: "fixed", zIndex: 9999 }}>
      <p className="team-kv-tooltip-title">{label}</p>
      <p className="team-kv-tooltip-def">{def}</p>
      <p className="team-kv-tooltip-target"><span>Target:</span> {target}</p>
    </div>,
    document.body
  );
}

function StatCard({ label, target, def, value }) {
  const triggerRef = useRef(null);
  return (
    <div className="team-kv-card team-kv-card--stat">
      <div className="team-kv-stat-label">
        <span ref={triggerRef} className="team-kv-stat-label-text">{label}</span>
        <StatTooltip label={label} def={def} target={target} anchorRef={triggerRef} />
      </div>
      <div className="team-kv-stat-value">{value}</div>
    </div>
  );
}

function TeamModal({ teamRows, colDefs, sectionColors, onClose }) {
  const [tab, setTab] = useState("overview"); 
  const [selectedMatchIdx, setSelectedMatchIdx] = useState(0);

  const teamId = teamRows[0]?.meta?.teamNumber ?? teamRows[0]?.team ?? teamRows[0]?.id;
  const profile = computeProfile(teamRows);
  const selectedMatch = teamRows[selectedMatchIdx];

  return (
    <div className="settings-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}> 
      <div className="team-modal">
        <div className="team-modal-header">
          <div className="team-modal-title">
            <span className="team-modal-number">Team {teamId}</span>
            <span className="team-modal-subtitle">
              {teamRows.length} match{teamRows.length !== 1 ? "es" : ""}
            </span>
          </div>
          <div className="team-modal-actions">
            <button className={`team-modal-toggle${tab === "overview" ? " active" : ""}`} onClick={() => setTab("overview")}>Overview</button>
            <button className={`team-modal-toggle${tab === "detail" ? " active" : ""}`} onClick={() => setTab("detail")}>Match Detail</button>
            <button className="settings-close" onClick={onClose}>
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="2" y1="2" x2="14" y2="14" />
                <line x1="14" y1="2" x2="2" y2="14" />
              </svg>
            </button>
          </div>
        </div>

        <div className="team-modal-body">
          {tab === "overview" && (
            <div className="team-overview-panel">
              <div className="team-overview-fitscore">
                <span className="team-overview-fitscore-label">Avg FitScore</span>
                <span className="team-overview-fitscore-value">{profile.avgFitScore}</span>
              </div>
              <div className="team-kv-grid">
                {OVERVIEW_STATS.map(({ key, label, target, def, fmt }) => (
                  <StatCard key={key} label={label} target={target} def={def} value={fmt(profile[key])} />
                ))}
              </div>
            </div>
          )}

          {tab === "detail" && (
            <div className="team-detail-panel">
              <div className="team-match-selector">
                {teamRows.map((r, i) => {
                  const matchNum = r.meta?.matchNumber ?? r.match ?? `#${i + 1}`;
                  return (
                    <button key={i} className={`team-match-chip${selectedMatchIdx === i ? " active" : ""}`} onClick={() => setSelectedMatchIdx(i)}>
                      Match {matchNum}
                    </button>
                  );
                })}
              </div>

              {selectedMatch && (
                <div className="team-kv-grid">
                  {colDefs.map((def) => {
                    const color = sectionColors[def.section] || "#888";
                    const val = getCellValue(selectedMatch, def);
                    return (
                      <div key={def.flatKey} className="team-kv-card" style={{ "--card-color": color }}>
                        <div className="team-kv-section" style={{ color }}>
                          {def.section === "_flat" ? "Info" : def.section.toUpperCase()}
                        </div>
                        <div className="team-kv-key">{def.label}</div>
                        <div className="team-kv-vals">
                          <span className="team-kv-val">{renderCellValue(val, def.subKey)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsModal({
  onClose, density, setDensity, freezeEnabled, setFreezeEnabled, frozenCols,
  toggleFreezeCol, columns, sectionColors, setSectionColors, knownSections,
  summaryCols, setSummaryCols,
}) {
  const toggleSummaryCol = (fk) =>
    setSummaryCols((prev) =>
      prev.includes(fk) ? prev.filter((c) => c !== fk) : [...prev, fk],
    );

  const grouped = columns.reduce((acc, col) => {
    const sec = col.section === "_flat" ? "Info" : col.section;
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(col);
    return acc;
  }, {});

  return (
    <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal">
        <div className="settings-header">
          <h2><FontAwesomeIcon icon={faGear} /> Table Settings</h2>
          <button className="settings-close" onClick={onClose}>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="14" y2="14" /><line x1="14" y1="2" x2="2" y2="14" />
            </svg>
          </button>
        </div>
        <div className="settings-body">
          <div>
            <div className="settings-section-label">Row Density</div>
            <div className="density-options">
              {Object.entries(DENSITY).map(([key, val]) => (
                <button key={key} className={`density-btn${density === key ? " active" : ""}`} onClick={() => setDensity(key)}>
                  {val.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="settings-section-label">Section Colors</div>
            <div className="section-color-list">
              {knownSections.map((sec) => (
                <div key={sec} className="section-color-row">
                  <span className="section-color-label" style={{ borderLeft: `3px solid ${sectionColors[sec] || "#999"}`, paddingLeft: 8 }}>
                    {sec === "_flat" ? "Other" : sec.charAt(0).toUpperCase() + sec.slice(1)}
                  </span>
                  <input
                    type="color"
                    value={sectionColors[sec] || "#999999"}
                    onChange={(e) => setSectionColors((prev) => ({ ...prev, [sec]: e.target.value }))}
                    className="color-swatch-input"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="settings-section-label">Summary Columns</div>
            <p className="settings-hint">These appear in the team overview. Click to toggle.</p>
            <div className="summary-col-sections">
              {Object.entries(grouped).map(([sec, cols]) => {
                const color = sectionColors[cols[0].section] || "#888";
                return (
                  <div key={sec} className="summary-col-group">
                    <div className="summary-col-group-label" style={{ color }}>{sec}</div>
                    <div className="freeze-columns-list">
                      {cols.map((col) => (
                        <button key={col.flatKey} className={`freeze-col-chip${summaryCols.includes(col.flatKey) ? " frozen" : ""}`} onClick={() => toggleSummaryCol(col.flatKey)}>
                          {col.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="freeze-toggle-row">
              <span>Column Freezing</span>
              <label className="toggle-switch">
                <input type="checkbox" checked={freezeEnabled} onChange={(e) => setFreezeEnabled(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
            {freezeEnabled && columns.length > 0 && (
              <>
                <div className="settings-section-label" style={{ marginBottom: 8 }}>Select columns to freeze</div>
                <div className="freeze-columns-list">
                  {columns.map((col) => (
                    <button key={col.flatKey} className={`freeze-col-chip${frozenCols.includes(col.flatKey) ? " frozen" : ""}`} onClick={() => toggleFreezeCol(col.flatKey)}>
                      {col.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState([]);
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [density, setDensity] = useState("comfortable");
  const [freezeEnabled, setFreezeEnabled] = useState(false);
  const [frozenCols, setFrozenCols] = useState([]);
  const [sectionColors, setSectionColors] = useState(DEFAULT_SECTION_COLORS);
  const [summaryCols, setSummaryCols] = useState(DEFAULT_SUMMARY_COLS);
  const [teamFocus, setTeamFocus] = useState(null); 
  const [regionals, setRegionals] = useState([]);
  const [selectedRegional, setSelectedRegional] = useState("");

  const thRefs = useRef({});
  const secThRefs = useRef({});
  const tableContainerRef = useRef(null);
  const [frozenOffsets, setFrozenOffsets] = useState({});

  // 1. Initial Load: Fetch List of Regionals
  useEffect(() => {
    async function loadRegionals() {
      try {
        const res = await fetch(`${getApiBaseUrl()}/regionals`);
        if (!res.ok) throw new Error("Failed to load regionals list.");
        const regionalData = await res.json();
        setRegionals(regionalData);
      } catch (err) {
        setError(err.message);
      } finally {
        setInitialLoading(false);
      }
    }
    loadRegionals();
  }, []);

  // 2. Load Match Data whenever selectedRegional becomes populated
  useEffect(() => {
    if (!selectedRegional) {
      setData([]);
      return;
    }

    async function loadMatchData() {
      setIsLoading(true);
      try {
        const encodedName = encodeURIComponent(selectedRegional);
        const res = await fetch(`${getApiBaseUrl()}/match/Data/regional/${encodedName}`);
        if (!res.ok) throw new Error(`Failed to load data for regional: ${selectedRegional}`);
        
        const matchRows = await res.json();
        setData(matchRows);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadMatchData();
  }, [selectedRegional]);

  const colDefs = buildColumnDefs(data);

  const sectionGroups = colDefs.reduce((acc, def) => {
    if (!acc[def.section]) acc[def.section] = [];
    acc[def.section].push(def);
    return acc;
  }, {});
  const knownSections = Object.keys(sectionGroups);

  useEffect(() => {
    if (!freezeEnabled || frozenCols.length === 0) {
      setFrozenOffsets({});
      return;
    }
    const compute = () => {
      const offsets = {};
      let acc = 0;
      for (const fk of frozenCols) {
        offsets[fk] = acc;
        const el = thRefs.current[fk];
        if (el) acc += el.offsetWidth;
      }
      setFrozenOffsets(offsets);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [frozenCols, freezeEnabled, data]);

  useEffect(() => {
    const d = DENSITY[density];
    document.documentElement.style.setProperty("--row-padding-v", d.paddingV);
    document.documentElement.style.setProperty("--row-height", d.rowHeight);
  }, [density]);

  const handleSort = (flatKey) => {
    const order = sortField === flatKey && sortOrder === "asc" ? "desc" : "asc";
    setSortField(flatKey);
    setSortOrder(order);
    const def = colDefs.find((d) => d.flatKey === flatKey);
    setData((prev) =>
      [...prev].sort((a, b) => {
        const va = def ? String(getCellValue(a, def) ?? "") : "";
        const vb = def ? String(getCellValue(b, def) ?? "") : "";
        return (
          va.localeCompare(vb, undefined, { numeric: true, sensitivity: "base" }) * (order === "asc" ? 1 : -1)
        );
      }),
    );
  };

  const toggleFreezeCol = (fk) =>
    setFrozenCols((prev) =>
      prev.includes(fk) ? prev.filter((c) => c !== fk) : [...prev, fk],
    );

  const isFrozen = (fk) => freezeEnabled && frozenCols.includes(fk);

  const getStickyStyle = (fk) => {
    if (!isFrozen(fk)) return {};
    return { position: "sticky", left: frozenOffsets[fk] ?? 0, zIndex: 4 };
  };

  const teamColDef =
    colDefs.find((d) => d.section === "meta" && d.subKey === "teamNumber") ??
    colDefs.find((d) => d.section === "_flat");

  const handleTeamClick = (e, row) => {
    e.stopPropagation();
    if (!teamColDef) return;
    const teamId = getCellValue(row, teamColDef);
    const teamRows = data.filter((r) => getCellValue(r, teamColDef) === teamId);
    setTeamFocus({ teamId, rows: teamRows });
  };

  // ── SCREEN A: FULL-SCREEN REGIONAL SELECTION VIEW ──
  if (initialLoading) {
    return <div className="regional-loading-screen">Loading system resources...</div>;
  }

  if (!selectedRegional) {
    return (
      <div className="regional-picker-screen">
        <div className="regional-picker-card">
          <h1>Select a Regional</h1>
          <p className="picker-subtitle">Choose a regional to view the accociated data</p>
          
          {error && <div className="picker-error-msg">Error: {error}</div>}

          <div className="regional-pills-grid">
            {regionals.length === 0 ? (
              <div className="no-regionals-alert">No regionals are currently enabled for the data page.</div>
            ) : (
              regionals.map((r) => (
                <button
                  key={r.id}
                  className="regional-pill-btn"
                  onClick={() => setSelectedRegional(r.name)}
                >
                  <span className="pill-name">{r.name}</span>
                  {r.year && <span className="pill-year">{r.year}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── SCREEN B: TRADITIONAL METRIC DATA VIEW ──
  return (
    <>
      <div className="team-badge">935</div>

      {/* Control Actions & Navigation Toolbar */}
      <div className="action-header-bar">
        <button className="back-to-picker-btn" onClick={() => setSelectedRegional("")}>
          <FontAwesomeIcon icon={faChevronLeft} /> Change Regional
        </button>
        
        <span className="current-regional-header-label">
          {selectedRegional} Data Matrix
        </span>

        <div className="headerButtons">
          <button className="settings-trigger">
            <Link to="/" style={{ color: "#888", textDecoration: "none" }}>
              <FontAwesomeIcon icon={faArrowRightFromBracket} />
            </Link>
          </button>

          <button
            className="settings-trigger"
            onClick={() => setShowSettings(true)}
            aria-label="Open settings"
            id="settingsIcon"
          >
            <FontAwesomeIcon icon={faGear} />
          </button>
        </div>
      </div>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          density={density}
          setDensity={setDensity}
          freezeEnabled={freezeEnabled}
          setFreezeEnabled={setFreezeEnabled}
          frozenCols={frozenCols}
          toggleFreezeCol={toggleFreezeCol}
          columns={colDefs}
          sectionColors={sectionColors}
          setSectionColors={setSectionColors}
          knownSections={knownSections}
          summaryCols={summaryCols}
          setSummaryCols={setSummaryCols}
        />
      )}

      {teamFocus && (
        <TeamModal
          teamRows={teamFocus.rows}
          colDefs={colDefs}
          sectionColors={sectionColors}
          onClose={() => setTeamFocus(null)}
        />
      )}

      {/* Internal loading states inside data grid view */}
      {isLoading ? (
        <div className="table-container message-box">Querying target metrics matrix...</div>
      ) : error ? (
        <div className="table-container message-box error">Error: {error}</div>
      ) : (
        <div className="table-wrapper">
          <div className="table-container" ref={tableContainerRef}>
            <table>
              <thead>
                <tr className="section-header-row">
                  {knownSections.map((sec) => {
                    const color = sectionColors[sec] || "#888";
                    const count = sectionGroups[sec].length;
                    return (
                      <th
                        key={sec}
                        colSpan={count}
                        ref={(el) => { secThRefs.current[sec] = el; }}
                        className="section-group-th"
                        style={{ "--sec-color": color }}
                      >
                        <span className="section-group-label">
                          {sec === "_flat" ? "Info" : sec.toUpperCase()}
                        </span>
                      </th>
                    );
                  })}
                </tr>
                <tr className="col-header-row">
                  {colDefs.map((def) => {
                    const color = sectionColors[def.section] || "#888";
                    return (
                      <th
                        key={def.flatKey}
                        ref={(el) => { thRefs.current[def.flatKey] = el; }}
                        className={[
                          sortField === def.flatKey ? "sort-active" : "",
                          isFrozen(def.flatKey) ? "frozen" : "",
                        ].filter(Boolean).join(" ")}
                        style={{ ...getStickyStyle(def.flatKey), "--sec-color": color }}
                        onClick={() => handleSort(def.flatKey)}
                      >
                        {def.label}
                        <span className="sort-indicator">
                          {sortField === def.flatKey ? (sortOrder === "asc" ? "▲" : "▼") : "⇅"}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={colDefs.length || 1} style={{ textAlign: "center", color: "#888", padding: '30px' }}>
                      No match data entries saved for {selectedRegional}.
                    </td>
                  </tr>
                ) : (
                  data.map((row, rowIdx) => (
                    <tr key={row.id || rowIdx}>
                      {colDefs.map((def) => {
                        const color = sectionColors[def.section] || "#888";
                        const val = getCellValue(row, def);
                        const secDefs = sectionGroups[def.section];
                        const isFirst = secDefs[0].flatKey === def.flatKey;
                        const isLast = secDefs[secDefs.length - 1].flatKey === def.flatKey;
                        const isTeamCol = def === teamColDef;

                        return (
                          <td
                            key={def.flatKey}
                            className={[
                              "sectioned-cell",
                              isFrozen(def.flatKey) ? "frozen" : "",
                              isTeamCol ? "team-cell" : "",
                            ].filter(Boolean).join(" ")}
                            style={{
                              ...getStickyStyle(def.flatKey),
                              "--sec-color": color,
                              borderLeft: isFirst ? `2px solid ${color}20` : undefined,
                              borderRight: isLast ? `2px solid ${color}20` : undefined,
                            }}
                          >
                            {isTeamCol ? (
                              <button className="team-link" onClick={(e) => handleTeamClick(e, row)}>
                                {renderCellValue(val, def.subKey)}
                              </button>
                            ) : (
                              renderCellValue(val, def.subKey)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
