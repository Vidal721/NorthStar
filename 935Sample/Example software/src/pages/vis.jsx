import { useState, useEffect, useRef } from "react";
import "./vis.css";

// ── Constants ──────────────────────────────────────────────
const DENSITY = {
  tight:       { label: "Tight",       paddingV: "6px",  rowHeight: "38px" },
  comfortable: { label: "Comfortable", paddingV: "10px", rowHeight: "48px" },
  loose:       { label: "Loose",       paddingV: "16px", rowHeight: "60px" },
};

// Default section colors — user-customizable
const DEFAULT_SECTION_COLORS = {
  meta:     "#8b5cf6",
  auto:     "#ef4444",
  teleop:   "#3b82f6",
  endgame:  "#10b981",
  totals:   "#f59e0b",
  metrics:  "#ec4899",
  _flat:    "#6b7280",
};

// ── Helpers ────────────────────────────────────────────────
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
        {value.map((t, i) => <span key={i} className="tag-pill">{String(t)}</span>)}
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
  if (colKey === "id" && String(value).length > 8) return `…${String(value).slice(-6)}`;
  if (typeof value === "number" && !Number.isInteger(value)) return value.toFixed(3);
  return String(value);
}

// Given a raw data row, produce flat column list with section metadata
// Returns: [{ flatKey, section, subKey, label }]
function buildColumnDefs(rows) {
  if (!rows || rows.length === 0) return [];
  const seen = new Set();
  const defs = [];
  for (const row of rows) {
    for (const [topKey, topVal] of Object.entries(row)) {
      if (topVal !== null && typeof topVal === "object" && !Array.isArray(topVal)) {
        // Nested section
        for (const subKey of Object.keys(topVal)) {
          const flatKey = `${topKey}.${subKey}`;
          if (!seen.has(flatKey)) {
            seen.add(flatKey);
            defs.push({ flatKey, section: topKey, subKey, label: formatHeader(subKey) });
          }
        }
      } else {
        const flatKey = `_flat.${topKey}`;
        if (!seen.has(flatKey)) {
          seen.add(flatKey);
          defs.push({ flatKey, section: "_flat", subKey: topKey, label: formatHeader(topKey) });
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

// ── Section Detail Modal ───────────────────────────────────
function SectionModal({ section, rowData, colDefs, color, onClose }) {
  const sectionDefs = colDefs.filter(d => d.section === section);
  const sectionData = rowData[section] ?? rowData; // flat fields live on row directly

  return (
    <div className="settings-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="section-modal" style={{ "--section-color": color }}>
        <div className="section-modal-header">
          <span className="section-modal-tag" style={{ background: color }}>{section.toUpperCase()}</span>
          <button className="settings-close" onClick={onClose}>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="14" y2="14"/><line x1="14" y1="2" x2="2" y2="14"/>
            </svg>
          </button>
        </div>
        <div className="section-modal-grid">
          {sectionDefs.map(def => {
            const val = section === "_flat" ? rowData[def.subKey] : rowData[def.section]?.[def.subKey];
            return (
              <div key={def.flatKey} className="section-kv">
                <div className="section-kv-key">{def.label}</div>
                <div className="section-kv-val">{renderCellValue(val, def.subKey)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Settings Modal ─────────────────────────────────────────
function SettingsModal({
  onClose, density, setDensity,
  freezeEnabled, setFreezeEnabled, frozenCols, toggleFreezeCol,
  columns, sectionColors, setSectionColors, knownSections,
}) {
  return (
    <div className="settings-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal">
        <div className="settings-header">
          <h2>⚙ Table Settings — Team 935</h2>
          <button className="settings-close" onClick={onClose}>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="14" y2="14"/><line x1="14" y1="2" x2="2" y2="14"/>
            </svg>
          </button>
        </div>
        <div className="settings-body">
          {/* Density */}
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

          {/* Section Colors */}
          <div>
            <div className="settings-section-label">Section Colors</div>
            <div className="section-color-list">
              {knownSections.map(sec => (
                <div key={sec} className="section-color-row">
                  <span className="section-color-label" style={{ borderLeft: `3px solid ${sectionColors[sec] || "#999"}`, paddingLeft: 8 }}>
                    {sec === "_flat" ? "Other" : sec.charAt(0).toUpperCase() + sec.slice(1)}
                  </span>
                  <input
                    type="color"
                    value={sectionColors[sec] || "#999999"}
                    onChange={e => setSectionColors(prev => ({ ...prev, [sec]: e.target.value }))}
                    className="color-swatch-input"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Column Freeze */}
          <div>
            <div className="freeze-toggle-row">
              <span>Column Freezing</span>
              <label className="toggle-switch">
                <input type="checkbox" checked={freezeEnabled} onChange={e => setFreezeEnabled(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
            {freezeEnabled && columns.length > 0 && (
              <>
                <div className="settings-section-label" style={{ marginBottom: 8 }}>Select columns to freeze</div>
                <div className="freeze-columns-list">
                  {columns.map(col => (
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

// ── App ────────────────────────────────────────────────────
export default function App() {
  const [data, setData]               = useState([]);
  const [sortField, setSortField]     = useState("");
  const [sortOrder, setSortOrder]     = useState("asc");
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [density, setDensity]         = useState("comfortable");
  const [freezeEnabled, setFreezeEnabled] = useState(false);
  const [frozenCols, setFrozenCols]   = useState([]);
  const [sectionColors, setSectionColors] = useState(DEFAULT_SECTION_COLORS);
  // { section, rowData } or null
  const [sectionFocus, setSectionFocus] = useState(null);

  const thRefs = useRef({});
  const [frozenOffsets, setFrozenOffsets] = useState({});

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const res = await fetch("http://localhost:3000/users");
        if (!res.ok) throw new Error("Failed to fetch data from server.");
        setData(await res.json());
      } catch (err) { setError(err.message); }
      finally { setIsLoading(false); }
    }
    fetchData();
  }, []);

  const colDefs = buildColumnDefs(data);

  // Grouped sections for header row
  const sectionGroups = colDefs.reduce((acc, def) => {
    if (!acc[def.section]) acc[def.section] = [];
    acc[def.section].push(def);
    return acc;
  }, {});
  const knownSections = Object.keys(sectionGroups);

  useEffect(() => {
    if (!freezeEnabled || frozenCols.length === 0) { setFrozenOffsets({}); return; }
    const offsets = {};
    let acc = 0;
    for (const fk of frozenCols) {
      offsets[fk] = acc;
      const el = thRefs.current[fk];
      if (el) acc += el.offsetWidth;
    }
    setFrozenOffsets(offsets);
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
    const def = colDefs.find(d => d.flatKey === flatKey);
    setData(prev =>
      [...prev].sort((a, b) => {
        const va = def ? String(getCellValue(a, def) ?? "") : "";
        const vb = def ? String(getCellValue(b, def) ?? "") : "";
        return va.localeCompare(vb, undefined, { numeric: true, sensitivity: "base" }) * (order === "asc" ? 1 : -1);
      })
    );
  };

  const toggleFreezeCol = fk =>
    setFrozenCols(prev => prev.includes(fk) ? prev.filter(c => c !== fk) : [...prev, fk]);

  const isFrozen = fk => freezeEnabled && frozenCols.includes(fk);
  const getStickyStyle = fk => isFrozen(fk) ? { position: "sticky", left: frozenOffsets[fk] ?? 0, zIndex: 4 } : {};

  if (isLoading) return <div className="table-container message-box">Loading server data...</div>;
  if (error)     return <div className="table-container message-box error">Error: {error}</div>;

  return (
    <>
      <div className="team-badge">935</div>

      <button className="settings-trigger" onClick={() => setShowSettings(true)} aria-label="Open settings">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="2.5"/>
          <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.22 4.22l1.06 1.06M14.72 14.72l1.06 1.06M4.22 15.78l1.06-1.06M14.72 5.28l1.06-1.06"/>
        </svg>
      </button>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          density={density} setDensity={setDensity}
          freezeEnabled={freezeEnabled} setFreezeEnabled={setFreezeEnabled}
          frozenCols={frozenCols} toggleFreezeCol={toggleFreezeCol}
          columns={colDefs}
          sectionColors={sectionColors} setSectionColors={setSectionColors}
          knownSections={knownSections}
        />
      )}

      {sectionFocus && (
        <SectionModal
          section={sectionFocus.section}
          rowData={sectionFocus.rowData}
          colDefs={colDefs}
          color={sectionColors[sectionFocus.section] || "#888"}
          onClose={() => setSectionFocus(null)}
        />
      )}

      <div className="table-wrapper">
        <div className="table-container">
          <table>
            <thead>
              {/* Row 1: Section group headers */}
              <tr className="section-header-row">
                {knownSections.map(sec => {
                  const color = sectionColors[sec] || "#888";
                  const count = sectionGroups[sec].length;
                  return (
                    <th
                      key={sec}
                      colSpan={count}
                      className="section-group-th"
                      style={{ "--sec-color": color }}
                      title={`Click any row to expand ${sec}`}
                    >
                      <span className="section-group-label">
                        {sec === "_flat" ? "Info" : sec.toUpperCase()}
                      </span>
                    </th>
                  );
                })}
              </tr>
              {/* Row 2: Individual column headers */}
              <tr className="col-header-row">
                {colDefs.map(def => {
                  const color = sectionColors[def.section] || "#888";
                  return (
                    <th
                      key={def.flatKey}
                      ref={el => { thRefs.current[def.flatKey] = el; }}
                      className={[
                        sortField === def.flatKey ? "sort-active" : "",
                        isFrozen(def.flatKey) ? "frozen" : "",
                      ].filter(Boolean).join(" ")}
                      style={{
                        ...getStickyStyle(def.flatKey),
                        "--sec-color": color,
                        borderTop: `3px solid ${color}`,
                      }}
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
                <tr><td colSpan={colDefs.length || 1} style={{ textAlign: "center", color: "#888" }}>No data available.</td></tr>
              ) : (
                data.map((row, rowIdx) => (
                  <tr key={row.id || rowIdx}>
                    {colDefs.map(def => {
                      const color = sectionColors[def.section] || "#888";
                      const val = getCellValue(row, def);
                      // Determine if this is first/last col in section for bracket border
                      const secDefs = sectionGroups[def.section];
                      const isFirst = secDefs[0].flatKey === def.flatKey;
                      const isLast  = secDefs[secDefs.length - 1].flatKey === def.flatKey;
                      return (
                        <td
                          key={def.flatKey}
                          className={[
                            "sectioned-cell",
                            isFrozen(def.flatKey) ? "frozen" : "",
                          ].filter(Boolean).join(" ")}
                          style={{
                            ...getStickyStyle(def.flatKey),
                            "--sec-color": color,
                            borderLeft:  isFirst ? `2px solid ${color}` : undefined,
                            borderRight: isLast  ? `2px solid ${color}` : undefined,
                          }}
                          onClick={() => setSectionFocus({ section: def.section, rowData: row })}
                        >
                          {renderCellValue(val, def.subKey)}
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
    </>
  );
}