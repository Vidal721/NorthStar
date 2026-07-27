import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash,
  faPlus,
  faArrowUp,
  faArrowDown,
  faFloppyDisk,
  faCircleCheck,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { resolveIcon, ICON_OPTIONS } from "../matchIcons";
import { getDefaultHeaders } from "../apiConfig";
import { useURL } from "../urlConfig.js";
import "../App.css";

// ============================================================
//  Everything a scout lead needs to reconfigure the match
//  scouting form for a new game — without touching code. This
//  page reads/writes the exact same JSON blob match.jsx consumes
//  (GET/POST /match/form), so hitting Save here changes the live
//  scouting page immediately, for every scout, with no deploy.
// ============================================================

const COLOR_OPTIONS = [
  { key: "action", label: "Indigo", var: "var(--scout-indigo)" },
  { key: "success", label: "Green", var: "var(--scout-green)" },
  { key: "warn", label: "Yellow", var: "var(--scout-yellow)" },
  { key: "danger", label: "Red", var: "var(--scout-red)" },
  { key: "neutral", label: "Gray", var: "var(--scout-neutral-glow)" },
  { key: "defend", label: "Blue", var: "var(--scout-blue)" },
];

const ACTION_OPTIONS = [
  { value: "startCycle", label: "Start Cycle — gain possession" },
  { value: "startShooting", label: "Start Shooting (needs active cycle)" },
  { value: "finishFull", label: "Finish Cycle — Full Score" },
  { value: "finishPartial", label: "Finish Cycle — Partial Score" },
  { value: "finishFail", label: "Finish Cycle — Failed" },
  { value: "defend", label: "Mark Defended (needs active cycle)" },
  { value: "breakdown", label: "Log Breakdown" },
  { value: "climbOk", label: "Endgame — Climb Success" },
  { value: "climbFail", label: "Endgame — Climb Fail" },
  { value: "offStat", label: "Custom Counter (off-shift style)" },
  { value: "transitStat", label: "Custom Counter (transit style)" },
];

const PHASE_KEYS = ["auto", "transit", "ourShift", "offShift"];
const PHASE_TITLES = {
  auto: "Autonomous",
  transit: "Transition Shift",
  ourShift: "Our Shift",
  offShift: "Their Shift",
};

const FIELD_TYPES = ["text", "number", "textarea", "select", "checkbox"];

const emptyButton = () => ({
  id: `btn_${Math.random().toString(36).slice(2, 8)}`,
  label: "New Button",
  icon: "circle",
  color: "action",
  action: "offStat",
  statKey: "customStat",
});

const emptySection = () => ({
  sectionLabel: "New Section",
  cols: 2,
  buttons: [emptyButton()],
});

const emptyField = () => ({
  id: `field_${Math.random().toString(36).slice(2, 8)}`,
  label: "New Field",
  type: "text",
  required: false,
});

const emptyEquation = () => ({
  key: `metric_${Math.random().toString(36).slice(2, 6)}`,
  label: "New Metric",
  formula: "0",
  desc: "",
  weight: 0.1,
  builtin: false,
});

export default function MatchBuilder() {
  const apiUrl = useURL();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [tab, setTab] = useState("mode");
  const [activePhase, setActivePhase] = useState("auto");

  useEffect(() => {
    fetch(`${apiUrl}/match/form`, { headers: getDefaultHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => setConfig(cfg))
      .catch(() => setSaveMsg({ ok: false, text: "Could not reach server." }))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  const update = (path, value) => {
    setConfig((prev) => {
      const next = structuredClone(prev);
      let ref = next;
      for (let i = 0; i < path.length - 1; i++) ref = ref[path[i]];
      ref[path[path.length - 1]] = value;
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const payload = { ...config, id: Date.now() };
      const res = await fetch(`${apiUrl}/match/form/save`, {
        method: "POST",
        headers: getDefaultHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Save failed");
      }
      setConfig(payload);
      setSaveMsg({ ok: true, text: "Saved — the scouting page will use this immediately." });
    } catch (err) {
      setSaveMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  };

  if (loading) {
    return <div className="p-lg text-muted">Loading match config…</div>;
  }
  if (!config) {
    return <div className="p-lg text-muted">Could not load match config from the server.</div>;
  }

  const phase = config.phases[activePhase];

  return (
    <div className="admin-regionals-panel" style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <div className="admin-regionals-panel-header" style={{ marginBottom: 16 }}>
        <div>
          <span className="scout-overline">Admin</span>
          <h3 style={{ margin: 0 }}>Match Builder</h3>
          <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
            Configure the match scouting form — no code required. Changes only
            take effect once you hit Save.
          </div>
        </div>
        <button
          className="scout-btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "auto", padding: "10px 18px" }}
        >
          <FontAwesomeIcon icon={faFloppyDisk} />
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {saveMsg && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 8,
            marginBottom: 16,
            background: saveMsg.ok ? "var(--scout-green-bg)" : "var(--scout-red-bg)",
            color: saveMsg.ok ? "var(--scout-green-soft)" : "var(--scout-red-soft)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <FontAwesomeIcon icon={saveMsg.ok ? faCircleCheck : faTriangleExclamation} />
          {saveMsg.text}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          ["mode", "Mode"],
          ["timing", "Timing"],
          ["phases", "Buttons & Phases"],
          ["formulas", "Formulas"],
          ["form", "Form Fields"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={tab === key ? "scout-btn-primary" : "scout-btn-ghost"}
            style={{ width: "auto", padding: "8px 16px", fontSize: 13 }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── MODE ─────────────────────────────────────────── */}
      {tab === "mode" && (
        <div>
          <div className="scout-overline" style={{ marginBottom: 10 }}>
            Scouting Mode
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <ModeCard
              active={config.mode === "live"}
              title="Live Button Scouting"
              desc="Real-time timer with tap-to-log buttons, phases, and shifts. What the app currently does."
              onClick={() => update(["mode"], "live")}
            />
            <ModeCard
              active={config.mode === "form"}
              title="Plain Form Scouting"
              desc="A simple field-based form (numbers, text, dropdowns, checkboxes) filled in anytime — no live timer."
              onClick={() => update(["mode"], "form")}
            />
          </div>
          <div className="text-muted" style={{ fontSize: 13, marginTop: 14 }}>
            You can build both the buttons/phases and the form fields below
            regardless of which mode is active — switching modes just changes
            which one scouts see on the /match page.
          </div>
        </div>
      )}

      {/* ── TIMING ───────────────────────────────────────── */}
      {tab === "timing" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 420 }}>
          {[
            ["matchTotal", "Total match length (seconds)"],
            ["autoEnd", "Autonomous ends at (seconds remaining)"],
            ["transitEnd", "Transition shift ends at (seconds remaining)"],
            ["endgameStart", "Endgame starts at (seconds remaining)"],
            ["shiftLen", "Length of each alternating shift (seconds)"],
          ].map(([key, label]) => (
            <div key={key}>
              <div className="scout-overline" style={{ marginBottom: 4 }}>{label}</div>
              <input
                type="number"
                className="scout-input"
                value={config.timing[key]}
                onChange={(e) => update(["timing", key], Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── PHASES / BUTTONS ─────────────────────────────── */}
      {tab === "phases" && (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {PHASE_KEYS.map((k) => (
              <button
                key={k}
                onClick={() => setActivePhase(k)}
                className={activePhase === k ? "scout-btn-primary" : "scout-btn-ghost"}
                style={{ width: "auto", padding: "6px 14px", fontSize: 13 }}
              >
                {PHASE_TITLES[k]}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 1 }}>
              <div className="scout-overline" style={{ marginBottom: 4 }}>Phase label</div>
              <input
                className="scout-input"
                value={phase.label}
                onChange={(e) => update(["phases", activePhase, "label"], e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <SectionList
            title="Sections"
            sections={phase.sections}
            onChange={(next) => update(["phases", activePhase, "sections"], next)}
          />

          {(activePhase === "ourShift" || activePhase === "offShift") && (
            <>
              <div style={{ height: 1, background: "var(--scout-border-subtle)", margin: "22px 0" }} />
              <SectionList
                title="Endgame Sections"
                sections={phase.endgameSections || []}
                onChange={(next) => update(["phases", activePhase, "endgameSections"], next)}
              />
            </>
          )}
        </div>
      )}

      {/* ── FORMULAS ─────────────────────────────────────── */}
      {tab === "formulas" && (
        <div>
          <div className="text-muted" style={{ fontSize: 13, marginBottom: 14 }}>
            Formulas turn raw counters into 0–1 metrics used for the fit score.
            They're plain JS expressions evaluated against the match's stats
            (e.g. <code>fullScores</code>, <code>totalCycles</code>,
            <code> defendedFails</code>). Weights don't need to sum to 1 —
            they're normalized automatically.
          </div>
          {config.equations.map((eq, i) => (
            <div
              key={i}
              style={{
                border: "1px solid var(--scout-border-subtle)",
                borderRadius: 10,
                padding: 14,
                marginBottom: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="scout-input"
                  placeholder="Label"
                  value={eq.label}
                  onChange={(e) => {
                    const next = [...config.equations];
                    next[i] = { ...eq, label: e.target.value };
                    update(["equations"], next);
                  }}
                  style={{ flex: 1 }}
                />
                <input
                  className="scout-input"
                  type="number"
                  step="0.01"
                  placeholder="Weight"
                  value={eq.weight}
                  onChange={(e) => {
                    const next = [...config.equations];
                    next[i] = { ...eq, weight: Number(e.target.value) };
                    update(["equations"], next);
                  }}
                  style={{ width: 90 }}
                />
                <button
                  className="admin-row-delete-btn"
                  onClick={() => update(["equations"], config.equations.filter((_, idx) => idx !== i))}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
              <input
                className="scout-input"
                placeholder="Formula, e.g. totalCycles > 0 ? fullScores / totalCycles : 0"
                value={eq.formula}
                onChange={(e) => {
                  const next = [...config.equations];
                  next[i] = { ...eq, formula: e.target.value };
                  update(["equations"], next);
                }}
                style={{ fontFamily: "monospace", fontSize: 13 }}
              />
              <input
                className="scout-input"
                placeholder="Description (optional)"
                value={eq.desc || ""}
                onChange={(e) => {
                  const next = [...config.equations];
                  next[i] = { ...eq, desc: e.target.value };
                  update(["equations"], next);
                }}
                style={{ fontSize: 13 }}
              />
            </div>
          ))}
          <button
            className="scout-btn-ghost"
            style={{ width: "auto", padding: "8px 16px" }}
            onClick={() => update(["equations"], [...config.equations, emptyEquation()])}
          >
            <FontAwesomeIcon icon={faPlus} /> Add Formula
          </button>
        </div>
      )}

      {/* ── FORM FIELDS ──────────────────────────────────── */}
      {tab === "form" && (
        <div>
          <div className="text-muted" style={{ fontSize: 13, marginBottom: 14 }}>
            These fields are what scouts see when the mode is set to "Plain
            Form Scouting" above.
          </div>
          {(config.formSchema.fields || []).map((f, i) => (
            <FieldRow
              key={f.id}
              field={f}
              onChange={(nf) => {
                const next = [...config.formSchema.fields];
                next[i] = nf;
                update(["formSchema", "fields"], next);
              }}
              onRemove={() =>
                update(
                  ["formSchema", "fields"],
                  config.formSchema.fields.filter((_, idx) => idx !== i),
                )
              }
              onMove={(dir) => {
                const next = [...config.formSchema.fields];
                const j = i + dir;
                if (j < 0 || j >= next.length) return;
                [next[i], next[j]] = [next[j], next[i]];
                update(["formSchema", "fields"], next);
              }}
            />
          ))}
          <button
            className="scout-btn-ghost"
            style={{ width: "auto", padding: "8px 16px" }}
            onClick={() =>
              update(["formSchema", "fields"], [...(config.formSchema.fields || []), emptyField()])
            }
          >
            <FontAwesomeIcon icon={faPlus} /> Add Field
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
//  Sub-components
// ============================================================

function ModeCard({ active, title, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        textAlign: "left",
        padding: 16,
        borderRadius: 12,
        cursor: "pointer",
        border: active ? "2px solid var(--scout-indigo)" : "1px solid var(--scout-border-subtle)",
        background: active ? "var(--scout-indigo-bg-alt)" : "var(--scout-bg-card-alt)",
        color: "var(--scout-text-primary)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--scout-neutral-fg)" }}>{desc}</div>
    </button>
  );
}

function SectionList({ title, sections, onChange }) {
  const updateSection = (i, next) => {
    const copy = [...sections];
    copy[i] = next;
    onChange(copy);
  };
  const removeSection = (i) => onChange(sections.filter((_, idx) => idx !== i));
  const moveSection = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const copy = [...sections];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };

  return (
    <div>
      <div className="scout-overline" style={{ marginBottom: 8 }}>{title}</div>
      {sections.map((sec, i) => (
        <div
          key={i}
          style={{
            border: "1px solid var(--scout-border-subtle)",
            borderRadius: 10,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
            <input
              className="scout-input"
              value={sec.sectionLabel}
              onChange={(e) => updateSection(i, { ...sec, sectionLabel: e.target.value })}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min={1}
              max={4}
              className="scout-input"
              title="Columns"
              value={sec.cols}
              onChange={(e) => updateSection(i, { ...sec, cols: Number(e.target.value) })}
              style={{ width: 60 }}
            />
            <button className="admin-row-delete-btn" onClick={() => moveSection(i, -1)}>
              <FontAwesomeIcon icon={faArrowUp} />
            </button>
            <button className="admin-row-delete-btn" onClick={() => moveSection(i, 1)}>
              <FontAwesomeIcon icon={faArrowDown} />
            </button>
            <button className="admin-row-delete-btn" onClick={() => removeSection(i)}>
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>

          <ButtonList
            buttons={sec.buttons}
            onChange={(next) => updateSection(i, { ...sec, buttons: next })}
          />
        </div>
      ))}
      <button
        className="scout-btn-ghost"
        style={{ width: "auto", padding: "8px 16px" }}
        onClick={() => onChange([...sections, emptySection()])}
      >
        <FontAwesomeIcon icon={faPlus} /> Add Section
      </button>
    </div>
  );
}

function ButtonList({ buttons, onChange }) {
  const updateButton = (i, next) => {
    const copy = [...buttons];
    copy[i] = next;
    onChange(copy);
  };
  const removeButton = (i) => onChange(buttons.filter((_, idx) => idx !== i));
  const moveButton = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= buttons.length) return;
    const copy = [...buttons];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {buttons.map((btn, i) => {
        const needsStatKey = btn.action === "offStat" || btn.action === "transitStat";
        const color = COLOR_OPTIONS.find((c) => c.key === btn.color) || COLOR_OPTIONS[0];
        return (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "36px 1fr 140px 170px auto auto auto",
              gap: 8,
              alignItems: "center",
              background: "var(--scout-bg-card-alt)",
              borderRadius: 8,
              padding: 8,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: color.var,
                color: "#fff",
              }}
            >
              {resolveIcon(btn.icon)}
            </div>

            <input
              className="scout-input"
              value={btn.label}
              onChange={(e) => updateButton(i, { ...btn, label: e.target.value })}
              placeholder="Label"
            />

            <select
              className="scout-input"
              value={btn.icon}
              onChange={(e) => updateButton(i, { ...btn, icon: e.target.value })}
            >
              {ICON_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>

            <select
              className="scout-input"
              value={btn.action}
              onChange={(e) => {
                const action = e.target.value;
                const patch = { ...btn, action };
                if (action === "offStat" || action === "transitStat") {
                  patch.statKey = btn.statKey || "customStat";
                } else {
                  delete patch.statKey;
                }
                updateButton(i, patch);
              }}
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <select
              className="scout-input"
              value={btn.color}
              onChange={(e) => updateButton(i, { ...btn, color: e.target.value })}
            >
              {COLOR_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>

            <button className="admin-row-delete-btn" onClick={() => moveButton(i, -1)}>
              <FontAwesomeIcon icon={faArrowUp} />
            </button>
            <button className="admin-row-delete-btn" onClick={() => removeButton(i)}>
              <FontAwesomeIcon icon={faTrash} />
            </button>

            {needsStatKey && (
              <input
                className="scout-input"
                value={btn.statKey || ""}
                onChange={(e) => updateButton(i, { ...btn, statKey: e.target.value })}
                placeholder="Counter key, e.g. algaeCollected"
                style={{ gridColumn: "2 / 5", fontFamily: "monospace", fontSize: 12 }}
              />
            )}

            <label
              style={{
                gridColumn: needsStatKey ? "5 / 8" : "2 / 8",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "var(--scout-neutral-fg)",
              }}
            >
              <input
                type="checkbox"
                checked={!!btn.requiresCycle}
                onChange={(e) => updateButton(i, { ...btn, requiresCycle: e.target.checked })}
              />
              Requires an active cycle to be tappable
            </label>
          </div>
        );
      })}
      <button
        className="scout-btn-ghost"
        style={{ width: "auto", padding: "6px 14px", fontSize: 13, alignSelf: "flex-start" }}
        onClick={() => onChange([...buttons, emptyButton()])}
      >
        <FontAwesomeIcon icon={faPlus} /> Add Button
      </button>
    </div>
  );
}

function FieldRow({ field, onChange, onRemove, onMove }) {
  return (
    <div
      style={{
        border: "1px solid var(--scout-border-subtle)",
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="scout-input"
          placeholder="Field label"
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          style={{ flex: 1 }}
        />
        <select
          className="scout-input"
          value={field.type}
          onChange={(e) => onChange({ ...field, type: e.target.value })}
          style={{ width: 130 }}
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button className="admin-row-delete-btn" onClick={() => onMove(-1)}>
          <FontAwesomeIcon icon={faArrowUp} />
        </button>
        <button className="admin-row-delete-btn" onClick={() => onMove(1)}>
          <FontAwesomeIcon icon={faArrowDown} />
        </button>
        <button className="admin-row-delete-btn" onClick={onRemove}>
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>

      {field.type === "select" && (
        <input
          className="scout-input"
          placeholder="Comma-separated options, e.g. Red,Blue,Yellow"
          value={(field.options || []).join(",")}
          onChange={(e) =>
            onChange({ ...field, options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
          }
        />
      )}

      {(field.type === "text" || field.type === "number" || field.type === "textarea") && (
        <input
          className="scout-input"
          placeholder="Placeholder text (optional)"
          value={field.placeholder || ""}
          onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
        />
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--scout-neutral-fg)" }}>
        <input
          type="checkbox"
          checked={!!field.required}
          onChange={(e) => onChange({ ...field, required: e.target.checked })}
        />
        Required
      </label>
    </div>
  );
}