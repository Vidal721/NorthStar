import { useState, useEffect } from "react";

//const PIT_FORM_URL = "http://localhost:3000/pit/form";
//const PIT_UPLOAD_URL = "http://localhost:3000/pit/upload";

const PIT_FORM_URL = "https://taco-childhood-jailbreak.ngrok-free.dev/pit/form";
const PIT_UPLOAD_URL =
  "https://taco-childhood-jailbreak.ngrok-free.dev/pit/upload";

// ─────────────────────────────────────────────
//  Field renderer
// ─────────────────────────────────────────────
function Field({ field, value, onChange }) {
  const { id, label, type, options, placeholder, required } = field;

  const lbl = (
    <label className="pit-label">
      {label}
      {required && <span className="required-star">*</span>}
    </label>
  );

  if (type === "text" || type === "number") {
    return (
      <div className="pit-field-wrap">
        {lbl}
        <input
          className="pit-input"
          type={type}
          value={value ?? ""}
          placeholder={placeholder || ""}
          onChange={(e) => onChange(id, e.target.value)}
        />
      </div>
    );
  }

  if (type === "textarea") {
    return (
      <div className="pit-field-wrap">
        {lbl}
        <textarea
          className="pit-textarea"
          value={value ?? ""}
          placeholder={placeholder || ""}
          onChange={(e) => onChange(id, e.target.value)}
        />
      </div>
    );
  }

  if (type === "select") {
    return (
      <div className="pit-field-wrap">
        {lbl}
        <select
          className="pit-select"
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
      <div className="pit-field-wrap">
        {lbl}
        <div className="pit-radio-group">
          {(options || []).map((o) => {
            const v = o.value ?? o;
            const checked = value === v;
            return (
              <button
                key={v}
                className={`pit-radio-btn${checked ? " checked" : ""}`}
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
      <div className="pit-field-wrap">
        {lbl}
        <div className="pit-checkbox-group">
          {(options || []).map((o) => {
            const v = o.value ?? o;
            const checked = arr.includes(v);
            return (
              <div
                key={v}
                className={`pit-check-row${checked ? " checked" : ""}`}
                onClick={() => {
                  const next = checked
                    ? arr.filter((x) => x !== v)
                    : [...arr, v];
                  onChange(id, next);
                }}
              >
                <div className={`pit-check-dot${checked ? " checked" : ""}`}>
                  {checked && (
                    <svg width="8" height="6" viewBox="0 0 8 6">
                      <path
                        d="M1 3l2 2 4-4"
                        stroke="var(--btn-accent-text)"
                        strokeWidth="1.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <span className="pit-check-label">{o.label ?? o}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="pit-field-wrap">
      {lbl}
      <input
        className="pit-input"
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
  const [submitStatus, setSubmitStatus] = useState(null);
  
  // Track the index of the currently open section (defaulting to 0 for the first section)
  const [openSectionIdx, setOpenSectionIdx] = useState(0);

  useEffect(() => {
    fetch(PIT_FORM_URL, {
      headers: { "ngrok-skip-browser-warning": "69420" },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((schema) => {
        setFormSchema(schema);
        // Ensure the first section is open when the form loads
        setOpenSectionIdx(0);
      })
      .catch((err) => setLoadError(err.message));
  }, []);

  const toggleSection = (idx) => {
    // If the clicked section is already open, close it (set to null), otherwise open it
    setOpenSectionIdx((prevIdx) => (prevIdx === idx ? null : idx));
  };

  const handleChange = (id, val) => {
    setValues((prev) => ({ ...prev, [id]: val }));
  };

  const handleSubmit = async () => {
    if (!formSchema) return;

    const missing = (formSchema.fields || [])
      .filter((f) => f.required && !values[f.id] && values[f.id] !== 0)
      .map((f) => f.label);

    if (missing.length > 0) {
      setSubmitStatus({
        type: "error",
        msg: `Required: ${missing.join(", ")}`,
      });
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
        setSubmitStatus({
          type: "error",
          msg: err.detail || `Server error ${res.status}`,
        });
      } else {
        setSubmitStatus({ type: "ok", msg: "Submitted! Ready for next team." });
        setValues({});
        // Reset to open the first section for the next team submission
        setOpenSectionIdx(0);
      }
    } catch {
      setSubmitStatus({
        type: "error",
        msg: "Backend unreachable — check server.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render states ──────────────────────────

  if (loadError) {
    return (
      <div className="pit-root">
        <div className="pit-error-card">
          <div className="pit-error-eyebrow">Failed to load form</div>
          <div className="pit-error-msg">{loadError}</div>
          <div className="pit-error-hint">
            Check that <code>/pit/form</code> is reachable.
          </div>
        </div>
      </div>
    );
  }

  if (!formSchema) {
    return (
      <div className="pit-root">
        <div className="pit-loading">
          <span className="pit-spinner" />
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.16em",
              color: "var(--text-muted)",
              marginTop: 12,
              textTransform: "uppercase",
            }}
          >
            Loading form…
          </div>
        </div>
      </div>
    );
  }

  const sections = formSchema.sections || [
    { label: null, fields: formSchema.fields || [] },
  ];

  return (
    <>
      {/* Header */}
      <div className="pit-card-header">
        <div>
          <div className="pit-header-eyebrow">Pit Scouting</div>
          <h1 className="pit-header-title">
            {formSchema.title || "Robot Inspection"}
          </h1>
        </div>
        {formSchema.event && (
          <div className="pit-header-event">{formSchema.event}</div>
        )}
      </div>
      <div className="pit-root">
        <div className="pit-card">
          {/* Fields */}
          <div className="pit-body">
            {sections.map((sec, si) => {
              const isExpanded = openSectionIdx === si;
              return (
                <div
                  key={si}
                  style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 10 }}
                >
                  {sec.label && (
                    <div 
                      className="pit-section-divider" 
                      onClick={() => toggleSection(si)}
                      style={{ 
                        cursor: "pointer", 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center",
                        userSelect: "none"
                      }}
                    >
                      <span>{sec.label}</span>
                      <svg 
                        width="30" 
                        height="30" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        style={{ 
                          transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                          transition: "transform 0.2s ease"
                        }}
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                  )}
                  
                  {/* Conditionally render fields based on active index state */}
                  {isExpanded && (sec.fields || []).map((field) => (
                    <Field
                      key={field.id}
                      field={field}
                      value={values[field.id]}
                      onChange={handleChange}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Footer */}
      <div className="pit-footer">
        {submitStatus && (
          <div className={`pit-status ${submitStatus.type}`}>
            {submitStatus.msg}
          </div>
        )}
        <button
          className="pit-submit-btn"
          disabled={isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting && <span className="pit-spinner" />}
          {isSubmitting ? "Submitting…" : "Submit Pit Data"}
        </button>
      </div>
    </>
  );
}
