import { useState, useEffect, useRef } from "react";
import "./vis.css";

// Density Presets Map
const DENSITY = {
  tight:       { label: "Tight",       paddingV: "6px",  rowHeight: "36px" },
  comfortable: { label: "Comfortable", paddingV: "10px", rowHeight: "48px" },
  loose:       { label: "Loose",       paddingV: "16px", rowHeight: "60px" },
};

// ── Settings Modal Component ──
function SettingsModal({ onClose, density, setDensity, freezeEnabled, setFreezeEnabled, frozenCols, toggleFreezeCol, columns }) {
  return (
    <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal" role="dialog" aria-modal="true" aria-label="Table Settings">
        <div className="settings-header">
          <h2>⚙ Table Settings — Team 935</h2>
          <button className="settings-close" onClick={onClose} aria-label="Close settings">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="14" y2="14"/><line x1="14" y1="2" x2="2" y2="14"/>
            </svg>
          </button>
        </div>
        <div className="settings-body">
          {/* Row Density Selection */}
          <div>
            <div className="settings-section-label">Row Density</div>
            <div className="density-options">
              {Object.entries(DENSITY).map(([key, val]) => (
                <button
                  key={key}
                  className={`density-btn${density === key ? " active" : ""}`}
                  onClick={() => setDensity(key)}
                >
                  {val.label}
                </button>
              ))}
            </div>
          </div>

          {/* Column Freeze Controls */}
          <div>
            <div className="freeze-toggle-row">
              <span>Column Freezing</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={freezeEnabled}
                  onChange={(e) => setFreezeEnabled(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
            {freezeEnabled && columns.length > 0 && (
              <>
                <div className="settings-section-label" style={{ marginBottom: 8 }}>
                  Select columns to freeze (Left Anchored)
                </div>
                <div className="freeze-columns-list">
                  {columns.map((col) => (
                    <button
                      key={col}
                      className={`freeze-col-chip${frozenCols.includes(col) ? " frozen" : ""}`}
                      onClick={() => toggleFreezeCol(col)}
                    >
                      {formatHeader(col)}
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

// ── Text Formatting Helpers ──
function formatHeader(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function renderCellValue(value, columnName) {
  if (value === undefined || value === null) return "";

  if (typeof value === "boolean") {
    return <span className={`badge ${value ? "true" : "false"}`}>{value ? "Active" : "Inactive"}</span>;
  }

  if (Array.isArray(value)) {
    return (
      <div className="pill-container">
        {value.map((tag, idx) => (
          <span key={idx} className="tag-pill">
            {String(tag).charAt(0).toUpperCase() + String(tag).slice(1)}
          </span>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    return (
      <div className="pill-container">
        {Object.entries(value).map(([k, v], idx) => (
          <span key={idx} className="tag-pill object-pill">
            <strong>{k.charAt(0).toUpperCase() + k.slice(1)}:</strong>&nbsp;{String(v)}
          </span>
        ))}
      </div>
    );
  }

  if (columnName === "id" && String(value).length > 8) {
    return `...${String(value).slice(-6)}`;
  }

  return String(value);
}

// ── Main Table View Implementation ──
export default function App() {
  const [data, setData] = useState([]);
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [density, setDensity] = useState("comfortable");
  const [freezeEnabled, setFreezeEnabled] = useState(false);
  const [frozenCols, setFrozenCols] = useState([]);

  // Setup DOM structural measurement tracking for sticky left positions
  const thRefs = useRef({});
  const [frozenOffsets, setFrozenOffsets] = useState({});

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        // Mocking client framework load sequence matching your local target route
        const res = await fetch("http://localhost:3000/users");
        if (!res.ok) throw new Error("Failed to fetch data from server.");
        setData(await res.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Compute sticky structural alignment metrics whenever freeze state shifts
  useEffect(() => {
    if (!freezeEnabled || frozenCols.length === 0) { 
      setFrozenOffsets({}); 
      return; 
    }
    const offsets = {};
    let currentAccumulatedOffset = 0;
    
    for (const col of frozenCols) {
      offsets[col] = currentAccumulatedOffset;
      const elementalHeadingNode = thRefs.current[col];
      if (elementalHeadingNode) {
        currentAccumulatedOffset += elementalHeadingNode.offsetWidth;
      }
    }
    setFrozenOffsets(offsets);
  }, [frozenCols, freezeEnabled, data]);

  // Bind CSS token assignments directly onto layout root DOM variables
  useEffect(() => {
    const activeDensityMetrics = DENSITY[density];
    document.documentElement.style.setProperty("--row-padding-v", activeDensityMetrics.paddingV);
    document.documentElement.style.setProperty("--row-height", activeDensityMetrics.rowHeight);
  }, [density]);

  const columns = data.length > 0
    ? Array.from(new Set(data.flatMap((item) => Object.keys(item))))
    : [];

  const handleSort = (field) => {
    const nextOrder = sortField === field && sortOrder === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortOrder(nextOrder);
    setData((prev) =>
      [...prev].sort((a, b) => {
        const valueA = a[field] != null ? String(a[field]) : "";
        const valueB = b[field] != null ? String(b[field]) : "";
        return valueA.localeCompare(valueB, undefined, { numeric: true, sensitivity: "base" }) * (nextOrder === "asc" ? 1 : -1);
      })
    );
  };

  const toggleFreezeCol = (col) => {
    setFrozenCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const isFrozen = (col) => freezeEnabled && frozenCols.includes(col);

  const getStickyStyle = (col) => {
    if (!isFrozen(col)) return {};
    return {
      position: "sticky",
      left: `${frozenOffsets[col] ?? 0}px`
    };
  };

  if (isLoading) return <div className="table-container message-box">Loading data grid telemetry...</div>;
  if (error)     return <div className="table-container message-box error">Error: {error}</div>;

  return (
    <>
      {/* Team 935 Floating Badge */}
      <div className="team-badge">TEAM 935</div>

      {/* Floating Settings Gear Trigger */}
      <button className="settings-trigger" onClick={() => setShowSettings(true)} aria-label="Open settings panel">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>

      {/* Configuration Settings Modal Portal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          density={density}
          setDensity={setDensity}
          freezeEnabled={freezeEnabled}
          setFreezeEnabled={setFreezeEnabled}
          frozenCols={frozenCols}
          toggleFreezeCol={toggleFreezeCol}
          columns={columns}
        />
      )}

      {/* Main Container Wrapper */}
      <div className="table-wrapper">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    ref={(el) => { thRefs.current[col] = el; }}
                    className={[
                      sortField === col ? "sort-active" : "",
                      isFrozen(col) ? "frozen" : "",
                    ].filter(Boolean).join(" ")}
                    style={getStickyStyle(col)}
                    onClick={() => handleSort(col)}
                  >
                    {formatHeader(col)}
                    <span className="sort-indicator">
                      {sortField === col ? (sortOrder === "asc" ? "▲" : "▼") : "⇅"}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length || 1} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                    No dataset fields available.
                  </td>
                </tr>
              ) : (
                data.map((item, rowIndex) => (
                  <tr key={item.id || rowIndex}>
                    {columns.map((col) => (
                      <td
                        key={col}
                        className={isFrozen(col) ? "frozen" : ""}
                        style={getStickyStyle(col)}
                      >
                        {renderCellValue(item[col], col)}
                      </td>
                    ))}
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