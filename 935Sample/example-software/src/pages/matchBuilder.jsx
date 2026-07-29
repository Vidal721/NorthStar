import { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash,
  faPlus,
  faArrowUp,
  faArrowDown,
  faFloppyDisk,
  faCircleCheck,
  faTriangleExclamation,
  faArrowRight,
  faArrowLeft,
  faGamepad,
  faListCheck,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { resolveIcon, ICON_OPTIONS } from "../matchIcons.jsx";
import { getDefaultHeaders } from "../apiConfig";
import { useURL } from "../urlConfig.js";

// ============================================================
//  Match Builder — guided setup wizard + freeform dashboard for
//  the match scouting config (GET/POST /match/form). Whatever is
//  saved here is exactly what match.jsx renders, so this is the
//  entire "recode the form" workflow your team needed, as UI.
// ============================================================

const COLOR_OPTIONS = [
  { key: "action", label: "Indigo", var: "var(--scout-indigo, #6366f1)" },
  { key: "success", label: "Green", var: "var(--scout-green, #22c55e)" },
  { key: "warn", label: "Yellow", var: "var(--scout-yellow, #eab308)" },
  { key: "danger", label: "Red", var: "var(--scout-red, #ef4444)" },
  { key: "neutral", label: "Gray", var: "var(--scout-neutral-glow, #64748b)" },
  { key: "defend", label: "Blue", var: "var(--scout-blue, #3b82f6)" },
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
  { value: "offStat", label: "Score / Action Counter" },
  { value: "transitStat", label: "Score / Action Counter (transit)" },
];

const PHASE_KEYS = ["auto", "transit", "ourShift", "offShift"];
const PHASE_TITLES = {
  auto: "Autonomous",
  transit: "Transition Shift",
  ourShift: "Our Shift",
  offShift: "Their Shift",
};
const PHASE_COLORS = {
  auto: "var(--scout-indigo, #6366f1)",
  transit: "var(--scout-yellow, #eab308)",
  ourShift: "var(--scout-green, #22c55e)",
  offShift: "var(--scout-red, #ef4444)",
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

const LIVE_STEPS = [
  { key: "mode", label: "Mode" },
  { key: "timing", label: "Timing" },
  { key: "phases", label: "Buttons" },
  { key: "formulas", label: "Formulas" },
  { key: "review", label: "Review" },
];
const FORM_STEPS = [
  { key: "mode", label: "Mode" },
  { key: "fields", label: "Fields" },
  { key: "review", label: "Review" },
];

export default function MatchBuilder() {
  const apiUrl = useURL();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  const [uiMode, setUiMode] = useState("wizard"); // "wizard" | "dashboard"
  const [stepIdx, setStepIdx] = useState(0);
  const [dashTab, setDashTab] = useState("mode");
  const [activePhase, setActivePhase] = useState("auto");

  useEffect(() => {
    fetch(`${apiUrl}/match/form`, { headers: getDefaultHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => setConfig(cfg))
      .catch(() => setSaveMsg({ ok: false, text: "Could not reach server." }))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  const steps = config?.mode === "form" ? FORM_STEPS : LIVE_STEPS;
  const clampedStep = Math.min(stepIdx, steps.length - 1);

  const dashTabs = useMemo(() => {
    if (!config) return [];
    return config.mode === "form"
      ? [
          { key: "mode", label: "Mode" },
          { key: "fields", label: "Form Fields" },
        ]
      : [
          { key: "mode", label: "Mode" },
          { key: "timing", label: "Timing" },
          { key: "phases", label: "Buttons & Phases" },
          { key: "formulas", label: "Formulas" },
        ];
  }, [config?.mode]);

  useEffect(() => {
    if (dashTabs.length && !dashTabs.find((t) => t.key === dashTab)) {
      setDashTab(dashTabs[0].key);
    }
  }, [dashTabs, dashTab]);

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
      setSaveMsg({
        ok: true,
        text: "Saved — scouts will see this immediately.",
      });
      if (uiMode === "wizard") setUiMode("dashboard");
    } catch (err) {
      setSaveMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  };

  if (loading)
    return (
      <div className="mb-page">
        <div className="mb-empty">Loading match config…</div>
      </div>
    );
  if (!config)
    return (
      <div className="mb-page">
        <div className="mb-empty">
          Could not load match config from the server.
        </div>
      </div>
    );

  const phase = config.phases[activePhase];

  const renderStepBody = (key) => {
    switch (key) {
      case "mode":
        return <ModeStep config={config} update={update} />;
      case "timing":
        return <TimingStep config={config} update={update} />;
      case "phases":
        return (
          <PhasesStep
            config={config}
            update={update}
            activePhase={activePhase}
            setActivePhase={setActivePhase}
            phase={phase}
          />
        );
      case "formulas":
        return <FormulasStep config={config} update={update} />;
      case "fields":
        return <FieldsStep config={config} update={update} />;
      case "review":
        return <ReviewStep config={config} />;
      default:
        return null;
    }
  };

  return (
    <div className="mb-page">
      <div className="mb-header">
        <div className="mb-header-titles">
          <h1>Match Builder</h1>
          <p>Configure your team's match scouting form — no code required.</p>
        </div>
        <div className="mb-header-actions">
          {uiMode === "dashboard" && (
            <button
              className="mb-btn mb-btn-ghost mb-btn-sm"
              onClick={() => {
                setUiMode("wizard");
                setStepIdx(0);
              }}
            >
              <FontAwesomeIcon icon={faWandMagicSparkles} /> Guided Setup
            </button>
          )}
          <button
            className="mb-btn mb-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            <FontAwesomeIcon icon={faFloppyDisk} />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {saveMsg && (
        <div className={`mb-toast ${saveMsg.ok ? "ok" : "err"}`}>
          <FontAwesomeIcon
            icon={saveMsg.ok ? faCircleCheck : faTriangleExclamation}
          />
          {saveMsg.text}
        </div>
      )}

      {uiMode === "wizard" ? (
        <>
          <div className="mb-stepper">
            {steps.map((s, i) => (
              <div className="mb-step" key={s.key}>
                <div
                  className={`mb-step ${i < clampedStep ? "done" : i === clampedStep ? "active" : ""}`}
                >
                  <div className="mb-step-dot">
                    {i < clampedStep ? "✓" : i + 1}
                  </div>
                  <div className="mb-step-label">{s.label}</div>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`mb-step-line ${i < clampedStep ? "done" : ""}`}
                  />
                )}
              </div>
            ))}
          </div>

          {renderStepBody(steps[clampedStep].key)}

          <div className="mb-wizard-nav">
            <div>
              {clampedStep > 0 && (
                <button
                  className="mb-btn mb-btn-ghost"
                  onClick={() => setStepIdx((i) => i - 1)}
                >
                  <FontAwesomeIcon icon={faArrowLeft} /> Back
                </button>
              )}
            </div>
            <div className="mb-wizard-nav-right">
              <button
                className="mb-link-btn"
                onClick={() => setUiMode("dashboard")}
              >
                Skip to full editor
              </button>
              {clampedStep < steps.length - 1 ? (
                <button
                  className="mb-btn mb-btn-primary"
                  onClick={() => setStepIdx((i) => i + 1)}
                >
                  Next <FontAwesomeIcon icon={faArrowRight} />
                </button>
              ) : (
                <button
                  className="mb-btn mb-btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <FontAwesomeIcon icon={faFloppyDisk} />{" "}
                  {saving ? "Saving…" : "Finish & Save"}
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mb-tabs">
            {dashTabs.map((t) => (
              <button
                key={t.key}
                className={`mb-tab ${dashTab === t.key ? "active" : ""}`}
                onClick={() => setDashTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {renderStepBody(dashTab)}
        </>
      )}
    </div>
  );
}

// ============================================================
//  Step / panel components — shared between wizard & dashboard
// ============================================================

function ModeStep({ config, update }) {
  return (
    <div>
      <div className="mb-panel-title">How should scouts fill this out?</div>
      <p className="mb-panel-desc">
        Pick one — you can change this any time, and the editor below will
        switch to match whichever mode is selected.
      </p>
      <div className="mb-mode-grid">
        <button
          className={`mb-mode-card ${config.mode === "live" ? "active" : ""}`}
          onClick={() => update(["mode"], "live")}
        >
          <div className="mb-mode-card-icon">
            <FontAwesomeIcon icon={faGamepad} />
          </div>
          <div className="mb-mode-card-title">Live Button Scouting</div>
          <div className="mb-mode-card-desc">
            Real-time timer with tap-to-log buttons, auto/shift phases, and a
            live cycle tracker. What most competitive teams use courtside.
          </div>
        </button>
        <button
          className={`mb-mode-card ${config.mode === "form" ? "active" : ""}`}
          onClick={() => update(["mode"], "form")}
        >
          <div className="mb-mode-card-icon">
            <FontAwesomeIcon icon={faListCheck} />
          </div>
          <div className="mb-mode-card-title">Plain Form Scouting</div>
          <div className="mb-mode-card-desc">
            A simple form — numbers, text, dropdowns, checkboxes — filled in
            anytime after the match. No live timer required.
          </div>
        </button>
      </div>
    </div>
  );
}

function TimingStep({ config, update }) {
  const rows = [
    ["matchTotal", "Total match length", "seconds"],
    ["autoEnd", "Autonomous ends when", "sec. remaining"],
    ["transitEnd", "Transition shift ends when", "sec. remaining"],
    ["endgameStart", "Endgame starts when", "sec. remaining"],
    ["shiftLen", "Length of each alternating shift", "seconds"],
  ];
  return (
    <div>
      <div className="mb-panel-title">Match Timing</div>
      <p className="mb-panel-desc">
        These drive the live countdown, phase transitions, and the alternating
        our-shift / their-shift cycle.
      </p>
      <div className="mb-grid-2">
        {rows.map(([key, label, unit]) => (
          <div className="mb-timing-card" key={key}>
            <div className="mb-field">
              <div className="mb-field-label">{label}</div>
              <input
                type="number"
                className="mb-input"
                value={config.timing[key]}
                onChange={(e) =>
                  update(["timing", key], Number(e.target.value))
                }
              />
              <div className="mb-timing-hint">{unit}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhasesStep({ config, update, activePhase, setActivePhase, phase }) {
  return (
    <div>
      <div className="mb-panel-title">Buttons & Phases</div>
      <p className="mb-panel-desc">
        Each game stage gets its own set of sections and buttons. Add a button,
        pick an icon/color, and choose what it does — including brand-new score
        or action counters.
      </p>
      <div className="mb-phase-pills">
        {PHASE_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => setActivePhase(k)}
            className="mb-phase-pill"
            style={
              activePhase === k
                ? { background: PHASE_COLORS[k], color: "#fff" }
                : {}
            }
          >
            {PHASE_TITLES[k]}
          </button>
        ))}
      </div>

      <div className="mb-field" style={{ marginBottom: 18, maxWidth: 360 }}>
        <div className="mb-field-label">Phase label</div>
        <input
          className="mb-input"
          value={phase.label}
          onChange={(e) =>
            update(["phases", activePhase, "label"], e.target.value)
          }
        />
      </div>

      <SectionList
        title="Sections"
        sections={phase.sections}
        onChange={(next) => update(["phases", activePhase, "sections"], next)}
      />

      {(activePhase === "ourShift" || activePhase === "offShift") && (
        <>
          <div
            style={{
              height: 1,
              background: "var(--mb-border)",
              margin: "24px 0",
            }}
          />
          <SectionList
            title="Endgame Sections"
            sections={phase.endgameSections || []}
            onChange={(next) =>
              update(["phases", activePhase, "endgameSections"], next)
            }
          />
        </>
      )}
    </div>
  );
}

function FormulasStep({ config, update }) {
  return (
    <div>
      <div className="mb-panel-title">Formulas</div>
      <p className="mb-panel-desc">
        Turn raw counters into 0–1 metrics for the fit score. Formulas are plain
        JS expressions evaluated against the match's stats (e.g.{" "}
        <code>fullScores</code>, <code>totalCycles</code>,{" "}
        <code>defendedFails</code>). Weights don't need to sum to 1.
      </p>
      {config.equations.map((eq, i) => (
        <div className="mb-section-card" key={i}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              className="mb-input"
              placeholder="Label"
              value={eq.label}
              onChange={(e) => {
                const next = [...config.equations];
                next[i] = { ...eq, label: e.target.value };
                update(["equations"], next);
              }}
            />
            <input
              className="mb-input"
              type="number"
              step="0.01"
              placeholder="Weight"
              value={eq.weight}
              onChange={(e) => {
                const next = [...config.equations];
                next[i] = { ...eq, weight: Number(e.target.value) };
                update(["equations"], next);
              }}
              style={{ width: 90, flexShrink: 0 }}
            />
            <button
              className="mb-icon-btn danger"
              onClick={() =>
                update(
                  ["equations"],
                  config.equations.filter((_, idx) => idx !== i),
                )
              }
            >
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>
          <input
            className="mb-input mb-input-mono"
            placeholder="Formula, e.g. totalCycles > 0 ? fullScores / totalCycles : 0"
            value={eq.formula}
            onChange={(e) => {
              const next = [...config.equations];
              next[i] = { ...eq, formula: e.target.value };
              update(["equations"], next);
            }}
            style={{ marginBottom: 8 }}
          />
          <input
            className="mb-input"
            placeholder="Description (optional)"
            value={eq.desc || ""}
            onChange={(e) => {
              const next = [...config.equations];
              next[i] = { ...eq, desc: e.target.value };
              update(["equations"], next);
            }}
          />
        </div>
      ))}
      <button
        className="mb-btn mb-btn-ghost"
        onClick={() =>
          update(["equations"], [...config.equations, emptyEquation()])
        }
      >
        <FontAwesomeIcon icon={faPlus} /> Add Formula
      </button>
    </div>
  );
}

function FieldsStep({ config, update }) {
  const fields = config.formSchema.fields || [];
  return (
    <div>
      <div className="mb-panel-title">Form Fields</div>
      <p className="mb-panel-desc">
        What scouts see when Plain Form Scouting is active. Add, reorder, and
        set required fields.
      </p>
      {fields.length === 0 && (
        <div className="mb-empty" style={{ marginBottom: 14 }}>
          No fields yet — add your first one below.
        </div>
      )}
      {fields.map((f, i) => (
        <FieldRow
          key={f.id}
          field={f}
          onChange={(nf) => {
            const next = [...fields];
            next[i] = nf;
            update(["formSchema", "fields"], next);
          }}
          onRemove={() =>
            update(
              ["formSchema", "fields"],
              fields.filter((_, idx) => idx !== i),
            )
          }
          onMove={(dir) => {
            const next = [...fields];
            const j = i + dir;
            if (j < 0 || j >= next.length) return;
            [next[i], next[j]] = [next[j], next[i]];
            update(["formSchema", "fields"], next);
          }}
        />
      ))}
      <button
        className="mb-btn mb-btn-ghost"
        onClick={() =>
          update(["formSchema", "fields"], [...fields, emptyField()])
        }
      >
        <FontAwesomeIcon icon={faPlus} /> Add Field
      </button>
    </div>
  );
}

function ReviewStep({ config }) {
  const phaseCount = Object.values(config.phases).reduce(
    (acc, p) =>
      acc + (p.sections?.length || 0) + (p.endgameSections?.length || 0),
    0,
  );
  const buttonCount = Object.values(config.phases).reduce(
    (acc, p) =>
      acc +
      [...(p.sections || []), ...(p.endgameSections || [])].reduce(
        (a, s) => a + s.buttons.length,
        0,
      ),
    0,
  );
  return (
    <div>
      <div className="mb-panel-title">Review</div>
      <p className="mb-panel-desc">Double-check, then hit Finish & Save.</p>
      <div className="mb-section-card">
        <div className="mb-review-row">
          <span className="mb-review-label">Mode</span>
          <span className="mb-review-value">
            {config.mode === "form"
              ? "Plain Form Scouting"
              : "Live Button Scouting"}
          </span>
        </div>
        {config.mode === "live" ? (
          <>
            <div className="mb-review-row">
              <span className="mb-review-label">Match length</span>
              <span className="mb-review-value">
                {config.timing.matchTotal}s
              </span>
            </div>
            <div className="mb-review-row">
              <span className="mb-review-label">Sections configured</span>
              <span className="mb-review-value">{phaseCount}</span>
            </div>
            <div className="mb-review-row">
              <span className="mb-review-label">Buttons configured</span>
              <span className="mb-review-value">{buttonCount}</span>
            </div>
            <div className="mb-review-row">
              <span className="mb-review-label">Formulas</span>
              <span className="mb-review-value">{config.equations.length}</span>
            </div>
          </>
        ) : (
          <div className="mb-review-row">
            <span className="mb-review-label">Form fields</span>
            <span className="mb-review-value">
              {(config.formSchema.fields || []).length}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
//  Reusable editors
// ============================================================

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
      <div className="mb-field-label" style={{ marginBottom: 10 }}>
        {title}
      </div>
      {sections.length === 0 && (
        <div className="mb-empty" style={{ marginBottom: 14 }}>
          No sections yet.
        </div>
      )}
      {sections.map((sec, i) => (
        <div className="mb-section-card" key={i}>
          <div className="mb-section-toolbar">
            <input
              className="mb-input"
              value={sec.sectionLabel}
              onChange={(e) =>
                updateSection(i, { ...sec, sectionLabel: e.target.value })
              }
            />
            <input
              type="number"
              min={1}
              max={4}
              className="mb-input mb-cols-input"
              title="Columns"
              value={sec.cols}
              onChange={(e) =>
                updateSection(i, { ...sec, cols: Number(e.target.value) })
              }
            />
            <button className="mb-icon-btn" onClick={() => moveSection(i, -1)}>
              <FontAwesomeIcon icon={faArrowUp} />
            </button>
            <button className="mb-icon-btn" onClick={() => moveSection(i, 1)}>
              <FontAwesomeIcon icon={faArrowDown} />
            </button>
            <button
              className="mb-icon-btn danger"
              onClick={() => removeSection(i)}
            >
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
        className="mb-btn mb-btn-ghost mb-btn-sm"
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
    <div>
      {buttons.map((btn, i) => {
        const needsStatKey =
          btn.action === "offStat" || btn.action === "transitStat";
        const color =
          COLOR_OPTIONS.find((c) => c.key === btn.color) || COLOR_OPTIONS[0];
        return (
          <div className="mb-button-edit" key={i}>
            <div className="mb-icon-preview" style={{ background: color.var }}>
              {resolveIcon(btn.icon)}
            </div>
            <input
              className="mb-input"
              value={btn.label}
              onChange={(e) =>
                updateButton(i, { ...btn, label: e.target.value })
              }
              placeholder="Label"
            />
            <select
              className="mb-select"
              value={btn.icon}
              onChange={(e) =>
                updateButton(i, { ...btn, icon: e.target.value })
              }
            >
              {ICON_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              className="mb-select"
              value={btn.action}
              onChange={(e) => {
                const action = e.target.value;
                const patch = { ...btn, action };
                if (action === "offStat" || action === "transitStat")
                  patch.statKey = btn.statKey || "customStat";
                else delete patch.statKey;
                updateButton(i, patch);
              }}
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              className="mb-select"
              value={btn.color}
              onChange={(e) =>
                updateButton(i, { ...btn, color: e.target.value })
              }
            >
              {COLOR_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="mb-btn-edit-actions">
              <button className="mb-icon-btn" onClick={() => moveButton(i, -1)}>
                <FontAwesomeIcon icon={faArrowUp} />
              </button>
              <button
                className="mb-icon-btn danger"
                onClick={() => removeButton(i)}
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>

            {needsStatKey && (
              <div className="mb-button-edit-extra">
                <input
                  className="mb-input mb-input-mono"
                  value={btn.statKey || ""}
                  onChange={(e) =>
                    updateButton(i, { ...btn, statKey: e.target.value })
                  }
                  placeholder="Counter key, e.g. algaeCollected"
                />
              </div>
            )}
            <label className="mb-checkbox-row mb-button-edit-extra">
              <input
                type="checkbox"
                checked={!!btn.requiresCycle}
                onChange={(e) =>
                  updateButton(i, { ...btn, requiresCycle: e.target.checked })
                }
              />
              Requires an active cycle to be tappable
            </label>
          </div>
        );
      })}
      <button
        className="mb-btn mb-btn-ghost mb-btn-sm"
        onClick={() => onChange([...buttons, emptyButton()])}
      >
        <FontAwesomeIcon icon={faPlus} /> Add Button
      </button>
    </div>
  );
}

function FieldRow({ field, onChange, onRemove, onMove }) {
  return (
    <div className="mb-section-card">
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom:
            field.type === "select" || field.type !== "checkbox" ? 8 : 0,
        }}
      >
        <input
          className="mb-input"
          placeholder="Field label"
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          style={{ flex: 1 }}
        />
        <select
          className="mb-select"
          value={field.type}
          onChange={(e) => onChange({ ...field, type: e.target.value })}
          style={{ width: 130, flexShrink: 0 }}
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button className="mb-icon-btn" onClick={() => onMove(-1)}>
          <FontAwesomeIcon icon={faArrowUp} />
        </button>
        <button className="mb-icon-btn" onClick={() => onMove(1)}>
          <FontAwesomeIcon icon={faArrowDown} />
        </button>
        <button className="mb-icon-btn danger" onClick={onRemove}>
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>

      {field.type === "select" && (
        <input
          className="mb-input"
          placeholder="Comma-separated options, e.g. Red,Blue,Yellow"
          value={(field.options || []).join(",")}
          onChange={(e) =>
            onChange({
              ...field,
              options: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          style={{ marginBottom: 8 }}
        />
      )}
      {(field.type === "text" ||
        field.type === "number" ||
        field.type === "textarea") && (
        <input
          className="mb-input"
          placeholder="Placeholder text (optional)"
          value={field.placeholder || ""}
          onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
          style={{ marginBottom: 8 }}
        />
      )}

      <label className="mb-checkbox-row">
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
