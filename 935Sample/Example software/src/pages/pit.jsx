import { useState, useEffect } from "react";

const PIT_FORM_URL = "http://localhost:3000/pit/form";
const PIT_UPLOAD_URL = "http://localhost:3000/pit/upload";

// ── Minimal shared styles matching the scout app's dark palette ──
const s = {
  root: {
    minHeight: "100vh",
    background: "var(--scout-bg, #0f1117)",
    color: "var(--scout-text-body, #e2e8f0)",
    fontFamily: "'DM Mono', 'Fira Mono', monospace",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px 12px 40px",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    background: "var(--scout-bg-surface, #181c27)",
    border: "1px solid var(--scout-border, #2a2f3e)",
    borderRadius: 14,
    overflow: "scroll",
  },
  header: {
    padding: "14px 18px",
    borderBottom: "1px solid var(--scout-border, #2a2f3e)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "var(--scout-bg-raised, #1e2233)",
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.18em",
    color: "var(--scout-indigo, #818cf8)",
    textTransform: "uppercase",
  },
  headerSub: {
    fontSize: 17,
    fontWeight: 900,
    color: "var(--scout-text-body, #e2e8f0)",
    marginTop: 2,
    letterSpacing: "-0.02em",
  },
  body: { padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 5 },
  label: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--scout-text-secondary, #94a3b8)",
  },
  input: {
    background: "var(--scout-bg, #0f1117)",
    border: "1px solid var(--scout-border, #2a2f3e)",
    borderRadius: 8,
    color: "var(--scout-text-body, #e2e8f0)",
    fontSize: 13,
    padding: "9px 12px",
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color 0.15s",
    width: "100%",
    boxSizing: "border-box",
  },
  select: {
    background: "var(--scout-bg, #0f1117)",
    border: "1px solid var(--scout-border, #2a2f3e)",
    borderRadius: 8,
    color: "var(--scout-text-body, #e2e8f0)",
    fontSize: 13,
    padding: "9px 12px",
    outline: "none",
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2394a3b8' d='M6 8L0 0h12z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: 32,
  },
  radioGroup: { display: "flex", gap: 7, flexWrap: "wrap" },
  radioBtn: (checked) => ({
    padding: "7px 13px",
    borderRadius: 8,
    border: `1px solid ${checked ? "var(--scout-indigo, #818cf8)" : "var(--scout-border, #2a2f3e)"}`,
    background: checked ? "rgba(129,140,248,0.13)" : "var(--scout-bg, #0f1117)",
    color: checked ? "var(--scout-indigo-soft, #c7d2fe)" : "var(--scout-text-secondary, #94a3b8)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.12s",
    letterSpacing: "0.04em",
  }),
  checkboxGroup: { display: "flex", flexDirection: "column", gap: 7 },
  checkRow: (checked) => ({
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${checked ? "var(--scout-indigo, #818cf8)" : "var(--scout-border, #2a2f3e)"}`,
    background: checked ? "rgba(129,140,248,0.09)" : "transparent",
    cursor: "pointer",
    transition: "all 0.12s",
  }),
  checkDot: (checked) => ({
    width: 16,
    height: 16,
    borderRadius: 4,
    border: `2px solid ${checked ? "var(--scout-indigo, #818cf8)" : "#374151"}`,
    background: checked ? "var(--scout-indigo, #818cf8)" : "transparent",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.12s",
  }),
  textarea: {
    background: "var(--scout-bg, #0f1117)",
    border: "1px solid var(--scout-border, #2a2f3e)",
    borderRadius: 8,
    color: "var(--scout-text-body, #e2e8f0)",
    fontSize: 13,
    padding: "9px 12px",
    outline: "none",
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    minHeight: 72,
  },
  footer: {
    padding: "12px 18px 18px",
    borderTop: "1px solid var(--scout-border, #2a2f3e)",
  },
  submitBtn: (disabled) => ({
    width: "100%",
    padding: "13px",
    borderRadius: 10,
    border: "none",
    background: disabled
      ? "#1e2233"
      : "linear-gradient(135deg, #4f46e5, #818cf8)",
    color: disabled ? "#4a5568" : "#fff",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    transition: "all 0.15s",
  }),
  status: (type) => ({
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 10,
    background: type === "error" ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
    border: `1px solid ${type === "error" ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
    color: type === "error" ? "#f87171" : "#4ade80",
  }),
  spinner: {
    display: "inline-block",
    width: 14,
    height: 14,
    border: "2px solid rgba(255,255,255,0.2)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
    marginRight: 8,
    verticalAlign: "middle",
  },
  divider: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: "var(--scout-text-faint, #4a5568)",
    padding: "4px 0 2px",
    borderBottom: "1px solid var(--scout-border-subtle, #1e2233)",
    marginBottom: 4,
  },
};

// ─────────────────────────────────────────────
//  Field renderer
// ─────────────────────────────────────────────
function Field({ field, value, onChange }) {
  const { id, label, type, options, placeholder, required } = field;

  const lbl = (
    <label style={s.label}>
      {label}
      {required && <span style={{ color: "#f87171", marginLeft: 3 }}>*</span>}
    </label>
  );

  if (type === "text" || type === "number") {
    return (
      <div style={s.fieldWrap}>
        {lbl}
        <input
          style={s.input}
          type={type}
          value={value ?? ""}
          placeholder={placeholder || ""}
          onChange={(e) => onChange(id, e.target.value)}
          onFocus={(e) => (e.target.style.borderColor = "var(--scout-indigo, #818cf8)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--scout-border, #2a2f3e)")}
        />
      </div>
    );
  }

  if (type === "textarea") {
    return (
      <div style={s.fieldWrap}>
        {lbl}
        <textarea
          style={s.textarea}
          value={value ?? ""}
          placeholder={placeholder || ""}
          onChange={(e) => onChange(id, e.target.value)}
          onFocus={(e) => (e.target.style.borderColor = "var(--scout-indigo, #818cf8)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--scout-border, #2a2f3e)")}
        />
      </div>
    );
  }

  if (type === "select") {
    return (
      <div style={s.fieldWrap}>
        {lbl}
        <select
          style={s.select}
          value={value ?? ""}
          onChange={(e) => onChange(id, e.target.value)}
        >
          <option value="">— select —</option>
          {(options || []).map((o) => (
            <option key={o.value ?? o} value={o.value ?? o}>
              {o.label ?? o}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (type === "radio") {
    return (
      <div style={s.fieldWrap}>
        {lbl}
        <div style={s.radioGroup}>
          {(options || []).map((o) => {
            const v = o.value ?? o;
            const checked = value === v;
            return (
              <button
                key={v}
                style={s.radioBtn(checked)}
                onClick={() => onChange(id, v)}
              >
                {o.label ?? o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === "checkbox") {
    const arr = Array.isArray(value) ? value : [];
    return (
      <div style={s.fieldWrap}>
        {lbl}
        <div style={s.checkboxGroup}>
          {(options || []).map((o) => {
            const v = o.value ?? o;
            const checked = arr.includes(v);
            return (
              <div
                key={v}
                style={s.checkRow(checked)}
                onClick={() => {
                  const next = checked ? arr.filter((x) => x !== v) : [...arr, v];
                  onChange(id, next);
                }}
              >
                <div style={s.checkDot(checked)}>
                  {checked && (
                    <svg width="8" height="6" viewBox="0 0 8 6">
                      <path d="M1 3l2 2 4-4" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: checked ? "var(--scout-text-body, #e2e8f0)" : "var(--scout-text-secondary, #94a3b8)" }}>
                  {o.label ?? o}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback: plain text input
  return (
    <div style={s.fieldWrap}>
      {lbl}
      <input
        style={s.input}
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(id, e.target.value)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────
export default function PitScouting() {
  const [formSchema, setFormSchema] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [values, setValues] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // { type: "ok"|"error", msg }

  // Fetch form schema on mount
  useEffect(() => {
    fetch(PIT_FORM_URL, {
      headers: { "ngrok-skip-browser-warning": "69420" },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setFormSchema(data);
      })
      .catch((err) => {
        setLoadError(err.message);
      });
  }, []);

  const handleChange = (id, val) => {
    setValues((prev) => ({ ...prev, [id]: val }));
  };

  const handleSubmit = async () => {
    if (!formSchema) return;

    // Basic required-field check
    const missing = (formSchema.fields || [])
      .filter((f) => f.required && !values[f.id] && values[f.id] !== 0)
      .map((f) => f.label);

    if (missing.length > 0) {
      setSubmitStatus({ type: "error", msg: `Required: ${missing.join(", ")}` });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    const payload = {
      meta: {
        formId: formSchema.id,
        timestamp: new Date().toISOString(),
      },
      data: values,
    };

    try {
      const res = await fetch(PIT_UPLOAD_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        setSubmitStatus({ type: "error", msg: err.detail || `Server error ${res.status}` });
      } else {
        setSubmitStatus({ type: "ok", msg: "Submitted! Ready for next team." });
        setValues({});
      }
    } catch {
      setSubmitStatus({ type: "error", msg: "Backend unreachable — check server." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render states ──────────────────────────

  if (loadError) {
    return (
      <div style={s.root}>
        <div style={{ ...s.card, padding: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", color: "#f87171", textTransform: "uppercase" }}>
            FAILED TO LOAD FORM
          </div>
          <div style={{ fontSize: 13, marginTop: 8, color: "#94a3b8" }}>{loadError}</div>
          <div style={{ fontSize: 11, marginTop: 6, color: "#4a5568" }}>Check that <code>/pit/form</code> is reachable.</div>
        </div>
      </div>
    );
  }

  if (!formSchema) {
    return (
      <div style={s.root}>
        <div style={{ ...s.card, padding: 28, textAlign: "center" }}>
          <div style={{ display: "inline-block", width: 20, height: 20, border: "2px solid #4f46e5", borderTopColor: "#818cf8", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", color: "#4a5568", marginTop: 10, textTransform: "uppercase" }}>Loading form…</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const sections = formSchema.sections || [{ label: null, fields: formSchema.fields || [] }];

  return (
    <div style={s.root}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={s.card}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.headerTitle}>Pit Scouting</div>
            <div style={s.headerSub}>{formSchema.title || "Robot Inspection"}</div>
          </div>
          {formSchema.event && (
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--scout-text-faint, #4a5568)", textAlign: "right" }}>
              {formSchema.event}
            </div>
          )}
        </div>

        {/* Fields */}
        <div style={s.body}>
          {sections.map((sec, si) => (
            <div key={si} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sec.label && <div style={s.divider}>{sec.label}</div>}
              {(sec.fields || []).map((field) => (
                <Field
                  key={field.id}
                  field={field}
                  value={values[field.id]}
                  onChange={handleChange}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Footer / Submit */}
        <div style={s.footer}>
          {submitStatus && (
            <div style={s.status(submitStatus.type)}>{submitStatus.msg}</div>
          )}
          <button
            style={s.submitBtn(isSubmitting)}
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting && <span style={s.spinner} />}
            {isSubmitting ? "Submitting…" : "Submit Pit Data"}
          </button>
        </div>
      </div>
    </div>
  );
}