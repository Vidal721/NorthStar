import { useState, useEffect, useRef } from "react";
import "./vis.css";

// ── Constants ──────────────────────────────────────────────
const DENSITY = {
  tight:       { label: "Tight",       paddingV: "6px",  rowHeight: "38px" },
  comfortable: { label: "Comfortable", paddingV: "10px", rowHeight: "48px" },
  loose:       { label: "Loose",       paddingV: "16px", rowHeight: "60px" },
};

// ── Settings Modal ─────────────────────────────────────────
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
          {/* Row Density */}
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

          {/* Column Freeze */}
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
                  Select columns to freeze (left-anchored)
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

// ── Helpers ────────────────────────────────────────────────
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

  // Compute frozen column left-offsets after render
  const thRefs = useRef({});
  const [frozenOffsets, setFrozenOffsets] = useState({});

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
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

  // Recalculate frozen column left-offsets whenever frozen list changes
  useEffect(() => {
    if (!freezeEnabled || frozenCols.length === 0) { setFrozenOffsets({}); return; }
    const offsets = {};
    let acc = 0;
    for (const col of frozenCols) {
      offsets[col] = acc;
      const el = thRefs.current[col];
      if (el) acc += el.offsetWidth;
    }
    setFrozenOffsets(offsets);
  }, [frozenCols, freezeEnabled, data]);

  // Apply density CSS vars to root
  useEffect(() => {
    const d = DENSITY[density];
    document.documentElement.style.setProperty("--row-padding-v", d.paddingV);
    document.documentElement.style.setProperty("--row-height", d.rowHeight);
  }, [density]);

  const columns = data.length > 0
    ? Array.from(new Set(data.flatMap((item) => Object.keys(item))))
    : [];

  const handleSort = (field) => {
    const order = sortField === field && sortOrder === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortOrder(order);
    setData((prev) =>
      [...prev].sort((a, b) => {
        const va = a[field] != null ? String(a[field]) : "";
        const vb = b[field] != null ? String(b[field]) : "";
        return va.localeCompare(vb, undefined, { numeric: true, sensitivity: "base" }) * (order === "asc" ? 1 : -1);
      })
    );
  };

  const toggleFreezeCol = (col) => {
    setFrozenCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const isFrozen = (col) => freezeEnabled && frozenCols.includes(col);

  const getStickyStyle = (col) =>
    isFrozen(col) ? { position: "sticky", left: frozenOffsets[col] ?? 0, zIndex: 4 } : {};

  if (isLoading) return <div className="table-container message-box">Loading server data...</div>;
  if (error)     return <div className="table-container message-box error">Error: {error}</div>;

  return (
    <>
      {/* Team badge */}
      <div className="team-badge">935</div>

      {/* Settings trigger */}
      <button className="settings-trigger" onClick={() => setShowSettings(true)} aria-label="Open settings">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="2.5"/>
          <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.22 4.22l1.06 1.06M14.72 14.72l1.06 1.06M4.22 15.78l1.06-1.06M14.72 5.28l1.06-1.06"/>
        </svg>
      </button>

      {/* Settings modal */}
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

      {/* Table */}
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
                    {/* Absolutely positioned — NEVER shifts column width */}
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
                  <td colSpan={columns.length || 1} style={{ textAlign: "center", color: "#888" }}>
                    No data available.
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