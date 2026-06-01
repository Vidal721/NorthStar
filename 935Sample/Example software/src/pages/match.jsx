import { useState, useRef, useCallback, useEffect } from "react";
import "../App.css";

// ============================================================
//  ⏱  MATCH TIMING
// ============================================================
const MATCH_CONFIG = {
  matchTotal: 160,
  autoStart: 160,
  autoEnd: 140,
  transitEnd: 130,
  endgameStart: 30,
  shiftLen: 25,
};

// ── Action button color palettes ────────────────────────────
// These map to CSS variable names; resolved at runtime so the
// CSS file is the single source of truth.
const C = {
  action:  { bg: "var(--scout-indigo-bg-alt)", fg: "var(--scout-indigo-soft)", glow: "var(--scout-indigo)" },
  success: { bg: "var(--scout-green-bg)",      fg: "var(--scout-green-soft)",  glow: "var(--scout-green)" },
  warn:    { bg: "var(--scout-yellow-bg)",     fg: "var(--scout-yellow-soft)", glow: "var(--scout-yellow)" },
  danger:  { bg: "var(--scout-red-bg)",        fg: "var(--scout-red-soft)",    glow: "var(--scout-red)" },
  neutral: { bg: "var(--scout-neutral-bg)",    fg: "var(--scout-neutral-fg)",  glow: "var(--scout-neutral-glow)" },
  defend:  { bg: "var(--scout-blue-bg)",       fg: "var(--scout-blue-soft)",   glow: "var(--scout-blue)" },
};

const BUTTON_GROUPS = {
  auto: {
    label: "Autonomous",
    accent: "var(--scout-indigo-soft)",
    sections: [
      {
        sectionLabel: "Start Cycle",
        cols: 1,
        buttons: [
          { id: "gain",    label: "Gain Possession", icon: "✊", color: C.action,  action: "startCycle" },
        ],
      },
      {
        sectionLabel: "Shooting",
        cols: 1,
        buttons: [
          { id: "shoot",   label: "Start Shooting",  icon: "🎯", color: C.neutral, action: "startShooting", requiresCycle: true },
        ],
      },
      {
        sectionLabel: "Finish Cycle",
        cols: 2,
        buttons: [
          { id: "full",    label: "Full Score",  icon: "✅", color: C.success, action: "finishFull",    requiresCycle: true },
          { id: "partial", label: "Partial",     icon: "⚡", color: C.warn,    action: "finishPartial", requiresCycle: true },
          { id: "fail",    label: "Failed",      icon: "✕", color: C.danger,  action: "finishFail",    requiresCycle: true },
          { id: "break",   label: "Breakdown",   icon: "⚠", color: C.danger,  action: "breakdown" },
        ],
      },
    ],
  },
  transit: {
    label: "Transition Shift",
    accent: "var(--scout-yellow-soft)",
    sections: [
      {
        sectionLabel: "Did They Score?",
        cols: 2,
        buttons: [
          { id: "txScore", label: "Scored", icon: "✅", color: C.success, action: "transitStat", statKey: "transitScore" },
          { id: "txFail",  label: "Missed", icon: "✕", color: C.danger,  action: "transitStat", statKey: "transitMiss" },
        ],
      },
      {
        sectionLabel: "What Did We Do?",
        cols: 3,
        buttons: [
          { id: "txCollect", label: "Collect",   icon: "🔵", color: C.action,  action: "transitStat", statKey: "transitCollect" },
          { id: "txDefend",  label: "Defend",    icon: "🛡", color: C.defend,  action: "transitStat", statKey: "transitDefend" },
          { id: "txScore2",  label: "We Scored", icon: "🎯", color: C.success, action: "transitStat", statKey: "transitWeScore" },
        ],
      },
      {
        sectionLabel: "Other",
        cols: 2,
        buttons: [
          { id: "txBreak", label: "Breakdown", icon: "⚠", color: C.danger,  action: "breakdown" },
          { id: "txNone",  label: "Nothing",   icon: "—",  color: C.neutral, action: "transitStat", statKey: "transitNothing" },
        ],
      },
    ],
  },
  ourShift: {
    label: "Our Shift",
    accent: "var(--scout-green-soft)",
    sections: [
      {
        sectionLabel: "Start Cycle",
        cols: 1,
        buttons: [
          { id: "gain", label: "Gain Possession", icon: "✊", color: C.action, action: "startCycle" },
        ],
      },
      {
        sectionLabel: "Shooting",
        cols: 1,
        buttons: [
          { id: "shoot", label: "Start Shooting", icon: "🎯", color: C.neutral, action: "startShooting", requiresCycle: true },
        ],
      },
      {
        sectionLabel: "Actions",
        cols: 2,
        buttons: [
          { id: "defend", label: "Defended",  icon: "🛡", color: C.defend, action: "defend",    requiresCycle: true },
          { id: "break",  label: "Breakdown", icon: "⚠", color: C.danger, action: "breakdown" },
        ],
      },
      {
        sectionLabel: "Finish Cycle",
        cols: 2,
        buttons: [
          { id: "full",    label: "Full Score", icon: "✅", color: C.success, action: "finishFull",    requiresCycle: true },
          { id: "partial", label: "Partial",    icon: "⚡", color: C.warn,    action: "finishPartial", requiresCycle: true },
          { id: "fail",    label: "Failed",     icon: "✕", color: C.danger,  action: "finishFail",    requiresCycle: true },
        ],
      },
    ],
    endgameSections: [
      {
        sectionLabel: "Endgame — Climb",
        cols: 2,
        buttons: [
          { id: "climbOk",   label: "Climb OK",   icon: "🚀", color: C.success, action: "climbOk" },
          { id: "climbFail", label: "Climb Fail", icon: "💥", color: C.danger,  action: "climbFail" },
        ],
      },
    ],
  },
  offShift: {
    label: "Their Shift",
    accent: "var(--scout-red-soft)",
    sections: [
      {
        sectionLabel: "Ball Interactions",
        cols: 3,
        buttons: [
          { id: "collect", label: "Collect", icon: "🔵", color: C.action, action: "offStat", statKey: "offCollect" },
          { id: "push",    label: "Push",    icon: "👉", color: C.action, action: "offStat", statKey: "offPush" },
          { id: "shoot",   label: "Shoot",   icon: "🎯", color: C.action, action: "offStat", statKey: "offShoot" },
        ],
      },
      {
        sectionLabel: "Other",
        cols: 3,
        buttons: [
          { id: "dispense",  label: "Dispense", sub: "to their side", icon: "↗", color: C.neutral, action: "offStat", statKey: "offDispense" },
          { id: "offdefend", label: "Defend",   icon: "🛡",            color: C.defend,  action: "offStat", statKey: "offDefend" },
          { id: "break",     label: "Breakdown",icon: "⚠",             color: C.danger,  action: "breakdown" },
        ],
      },
    ],
    endgameSections: [
      {
        sectionLabel: "Endgame — Climb",
        cols: 2,
        buttons: [
          { id: "climbOk",   label: "Climb OK",   icon: "🚀", color: C.success, action: "climbOk" },
          { id: "climbFail", label: "Climb Fail", icon: "💥", color: C.danger,  action: "climbFail" },
        ],
      },
    ],
  },
};

// ============================================================
//  📐 VARIABLES available in formulas
// ============================================================
export const FORMULA_VARIABLES = [
  { name: "fullScores",       desc: "Number of full scores",                      category: "scoring" },
  { name: "partialScores",    desc: "Number of partial scores",                   category: "scoring" },
  { name: "failedCycles",     desc: "Number of failed cycles",                    category: "scoring" },
  { name: "defendedCycles",   desc: "Cycles where robot was defended against",    category: "defense" },
  { name: "defendedFails",    desc: "Fails that occurred while being defended",   category: "defense" },
  { name: "possessions",      desc: "Total possessions gained",                   category: "scoring" },
  { name: "failures",         desc: "Total breakdowns",                           category: "reliability" },
  { name: "climbSuccess",     desc: "Successful climbs",                          category: "endgame" },
  { name: "climbFail",        desc: "Failed climbs",                              category: "endgame" },
  { name: "ourShiftSeconds",  desc: "Seconds in our shift",                       category: "time" },
  { name: "offShiftSeconds",  desc: "Seconds in their shift",                     category: "time" },
  { name: "transitSeconds",   desc: "Seconds in transition",                      category: "time" },
  { name: "shiftsCompleted",  desc: "Total shifts completed",                     category: "time" },
  { name: "offCollect",       desc: "Off-shift ball collects",                    category: "offshift" },
  { name: "offPush",          desc: "Off-shift ball pushes",                      category: "offshift" },
  { name: "offShoot",         desc: "Off-shift shots",                            category: "offshift" },
  { name: "offDispense",      desc: "Off-shift dispenses",                        category: "offshift" },
  { name: "offDefend",        desc: "Off-shift defenses",                         category: "offshift" },
  { name: "transitScore",     desc: "Transition: opponent scored",                category: "transition" },
  { name: "transitMiss",      desc: "Transition: opponent missed",                category: "transition" },
  { name: "transitCollect",   desc: "Transition: we collected",                   category: "transition" },
  { name: "transitDefend",    desc: "Transition: we defended",                    category: "transition" },
  { name: "transitWeScore",   desc: "Transition: we scored",                      category: "transition" },
  { name: "transitNothing",   desc: "Transition: nothing happened",               category: "transition" },
  { name: "timedShots",      desc: "Number of shots with timing data",             category: "scoring" },
  { name: "avgShotMs",      desc: "Average shot time in milliseconds (computed)",  category: "derived" },
  { name: "fastestShotMs",  desc: "Fastest recorded shot in ms (computed)",        category: "derived" },
  { name: "totalCycles",      desc: "fullScores + partialScores + failedCycles (computed)", category: "derived" },
  { name: "totalClimbs",      desc: "climbSuccess + climbFail (computed)",        category: "derived" },
  { name: "scoringCycles",    desc: "fullScores + partialScores (computed)",      category: "derived" },
  { name: "offActions",       desc: "offCollect + offPush + offShoot + offDispense + offDefend (computed)", category: "derived" },
  { name: "matchMinutes",     desc: "Total match time in minutes (2.667)",        category: "derived" },
];

// ============================================================
//  📐 DEFAULT EQUATIONS  (editable)
// ============================================================
const DEFAULT_EQUATIONS = [
  {
    key: "csr",
    label: "Cycle Success Rate",
    formula: "totalCycles > 0 ? (fullScores + partialScores * 0.6) / totalCycles : 0",
    desc: "Weighted scoring efficiency over all cycles. Full=1pt, Partial=0.6pt. Safe divide guard.",
    weight: 0.25,
    builtin: true,
  },
  {
    key: "quality",
    label: "Scoring Quality",
    formula: "scoringCycles > 0 ? fullScores / scoringCycles : 0",
    desc: "Proportion of successful cycles that were full scores. High = robot consistently scores full.",
    weight: 0.18,
    builtin: true,
  },
  {
    key: "dr",
    label: "Defense Resistance",
    formula: "totalCycles > 0 ? 1 - (defendedFails / Math.max(totalCycles, 1)) * 1.5 : 0.5",
    desc: "Penalizes defended fails weighted 1.5x against total cycles. Neutral (0.5) when no data.",
    weight: 0.18,
    builtin: true,
  },
  {
    key: "rs",
    label: "Reliability",
    formula: "Math.max(0, 1 - (failures / Math.max(shiftsCompleted, 1)) * 0.4)",
    desc: "Breakdown rate per completed shift, weighted at 0.4 impact per breakdown. Floors at 0.",
    weight: 0.15,
    builtin: true,
  },
  {
    key: "cr",
    label: "Climb Rate",
    formula: "totalClimbs > 0 ? climbSuccess / totalClimbs : 0.5",
    desc: "Successful climbs / total attempts. Neutral 0.5 when no climb data (no penalty, no bonus).",
    weight: 0.12,
    builtin: true,
  },
  {
    key: "offUtil",
    label: "Off-Shift Utility",
    formula: "offShiftSeconds > 0 ? Math.min(1, (offActions / (offShiftSeconds / 60)) / 5) : 0",
    desc: "Off-shift actions per minute normalized to 5 actions/min ceiling. Capped at 1.",
    weight: 0.12,
    builtin: true,
  },
];

// ============================================================
//  Formula evaluator — safe math sandbox
// ============================================================
function buildDerivedVars(s) {
  const times = s.shootingTimes || [];
  return {
    ...s,
    totalCycles:  s.fullScores + s.partialScores + s.failedCycles,
    totalClimbs:  s.climbSuccess + s.climbFail,
    scoringCycles:s.fullScores + s.partialScores,
    offActions:   s.offCollect + s.offPush + s.offShoot + s.offDispense + s.offDefend,
    matchMinutes: 160 / 60,
    timedShots:   times.length,
    avgShotMs:    times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
    fastestShotMs:times.length > 0 ? Math.min(...times) : 0,
  };
}

function evaluateFormula(formula, stats) {
  const vars = buildDerivedVars(stats);
  try {
    const keys = Object.keys(vars);
    const vals = keys.map((k) => vars[k]);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...keys, `"use strict"; return (${formula});`);
    const result = fn(...vals);
    if (!isFinite(result) || isNaN(result)) return 0;
    return Math.max(0, Math.min(1, result));
  } catch {
    return null;
  }
}

function computeFit(equations, stats) {
  let totalWeight = 0, weightedSum = 0;
  equations.forEach((eq) => {
    const val = evaluateFormula(eq.formula, stats);
    if (val !== null) {
      weightedSum += eq.weight * val;
      totalWeight += eq.weight;
    }
  });
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
}

function getRoles(metrics, stats) {
  const scoring = [], offShift = [];
  if ((metrics.csr || 0) > 0.6 && (metrics.quality || 0) > 0.75) scoring.push("Primary Scorer");
  if ((metrics.quality || 0) < 0.5 && (metrics.csr || 0) > 0.5)  scoring.push("Low Capacity Scorer");
  if ((metrics.dr || 0) > 0.8)                                     scoring.push("Defense Resistant");
  if ((metrics.dr || 0) > 0.7 && (metrics.csr || 0) < 0.4)        scoring.push("Defender");
  if (scoring.length === 0 && (metrics.csr || 0) > 0)              scoring.push("Utility Robot");
  if (stats.offDefend > 2)                                          offShift.push("Off-Shift Defender");
  if (stats.offCollect > 3)                                         offShift.push("Ball Collector");
  if (stats.offPush + stats.offShoot + stats.offDispense > 3)      offShift.push("Ball Distributor");
  return { scoring, offShift };
}

const fmtTime = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

const initialStats = () => ({
  // aggregate (used for fit score / metrics, unchanged)
  possessions: 0, fullScores: 0, partialScores: 0, failedCycles: 0,
  defendedCycles: 0, defendedFails: 0, failures: 0, climbSuccess: 0,
  climbFail: 0, ourShiftSeconds: 0, offShiftSeconds: 0, transitSeconds: 0,
  shiftsCompleted: 0, offCollect: 0, offPush: 0, offShoot: 0,
  offDispense: 0, offDefend: 0, transitScore: 0, transitMiss: 0,
  transitCollect: 0, transitDefend: 0, transitWeScore: 0, transitNothing: 0,
  // shot timing — ms from "Start Shooting" to full/partial score
  shootingTimes: [],       // array of milliseconds per timed shot
  // per-phase breakdowns
  auto: { possessions: 0, fullScores: 0, partialScores: 0, failedCycles: 0, failures: 0 },
  teleop: { possessions: 0, fullScores: 0, partialScores: 0, failedCycles: 0, defendedCycles: 0, defendedFails: 0, failures: 0 },
  endgame: { climbSuccess: 0, climbFail: 0, failures: 0 },
});

const initialMeta = () => ({ teamNumber: "", matchNumber: "", scoutName: "" });

// ============================================================
//  COMPONENTS
// ============================================================
function ActionButton({ btn, disabled, onClick, isActive }) {
  const [pressed, setPressed] = useState(false);
  const [flash, setFlash] = useState(false);
  const activeColor = isActive ? C.warn : null;
  return (
    <button
      onPointerDown={() => !disabled && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={() => {
        if (disabled) return;
        setFlash(true);
        setTimeout(() => setFlash(false), 160);
        onClick();
      }}
      style={{
        backgroundColor: flash ? (activeColor || btn.color).glow : (activeColor || btn.color).bg,
        color: (activeColor || btn.color).fg,
        border: "1px solid rgba(255,255,255,0.06)",
        opacity: disabled ? 0.22 : 1,
        pointerEvents: disabled ? "none" : "auto",
        transform: pressed ? "scale(0.91)" : "scale(1)",
        boxShadow: pressed && !disabled ? `0 0 18px ${(activeColor || btn.color).glow}66` : isActive ? `0 0 12px ${C.warn.glow}55` : "none",
        transition: "transform 0.1s, box-shadow 0.12s, background-color 0.1s",
        borderRadius: 14,
        padding: "14px 8px",
        fontWeight: 700,
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        lineHeight: 1.2,
        width: "100%",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
      }}
    >
      <span style={{ fontSize: 20 }}>{btn.icon}</span>
      <span style={{ fontSize: 11, fontWeight: 800, textAlign: "center", lineHeight: 1.2, letterSpacing: "0.02em" }}>
        {btn.label}
      </span>
      {btn.sub && (
        <span style={{ fontSize: 9, opacity: 0.65, textAlign: "center" }}>{btn.sub}</span>
      )}
    </button>
  );
}

function ButtonSection({ section, activeCycle, isShooting, onAction }) {
  return (
    <div>
      <div className="scout-overline" style={{ marginBottom: 7, display: "flex", alignItems: "center", gap: 8 }}>
        <span className="scout-section-divider scout-section-divider--left" />
        {section.sectionLabel}
        <span className="scout-section-divider scout-section-divider--right" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${section.cols}, 1fr)`, gap: 8 }}>
        {section.buttons.map((btn) => (
          <ActionButton
            key={btn.id}
            btn={btn}
            disabled={btn.requiresCycle && !activeCycle}
            isActive={btn.action === "startShooting" && isShooting}
            onClick={() => onAction(btn)}
          />
        ))}
      </div>
    </div>
  );
}

function RadialProgress({ value, size = 80, strokeWidth = 6, color = "var(--scout-indigo)" }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--scout-border-card)" strokeWidth={strokeWidth} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - Math.max(0, Math.min(1, value / 100)))}
        style={{ transition: "stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)" }}
      />
    </svg>
  );
}

function SectionHeader({ children }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 10 }}>
      <span className="scout-section-divider scout-section-divider--left" />
      <span style={{ color: "var(--scout-text-faint)" }}>{children}</span>
      <span className="scout-section-divider scout-section-divider--right" />
    </div>
  );
}

// ============================================================
//  FORMULA EDITOR
// ============================================================
const MATH_OPS = [
  { label: "( )", insert: "()",       desc: "Parentheses",        key: "(" },
  { label: "+",   insert: " + ",      desc: "Add",                key: "+" },
  { label: "−",   insert: " - ",      desc: "Subtract",           key: "-" },
  { label: "×",   insert: " * ",      desc: "Multiply",           key: "*" },
  { label: "÷",   insert: " / ",      desc: "Divide",             key: "/" },
  { label: "^",   insert: " ** ",     desc: "Power / Exponent",   key: "p" },
  { label: "%",   insert: " % ",      desc: "Modulo",             key: "m" },
  { label: "√",   insert: "Math.sqrt()", desc: "Square root",     key: "s" },
  { label: "π",   insert: "Math.PI",  desc: "Pi ≈ 3.14159",       key: "i" },
  { label: "abs", insert: "Math.abs()",  desc: "Absolute value",  key: "a" },
  { label: "min", insert: "Math.min(,)", desc: "Minimum of two values", key: "n" },
  { label: "max", insert: "Math.max(,)", desc: "Maximum of two values", key: "x" },
  { label: "floor",insert: "Math.floor()", desc: "Round down",    key: "f" },
  { label: "ceil", insert: "Math.ceil()",  desc: "Round up",      key: "c" },
  { label: "round",insert: "Math.round()", desc: "Round nearest", key: "r" },
  { label: "log",  insert: "Math.log()",   desc: "Natural log (ln)", key: "l" },
  { label: "log10",insert: "Math.log10()", desc: "Log base 10",   key: "o" },
  { label: "sin",  insert: "Math.sin()",   desc: "Sine",          key: "q" },
  { label: "cos",  insert: "Math.cos()",   desc: "Cosine",        key: "w" },
  { label: "e",    insert: "Math.E",       desc: "Euler's number ≈ 2.718", key: "e" },
];

function FormulaEditor({ equations, onSave, onClose }) {
  const [eqs, setEqs] = useState(() => equations.map((e) => ({ ...e })));
  const [activeIdx, setActiveIdx] = useState(0);
  const [cursorPos, setCursorPos] = useState(null);
  const [autocomplete, setAutocomplete] = useState([]);
  const [acSelected, setAcSelected] = useState(0);
  const [showOpsHelp, setShowOpsHelp] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [newLabel, setNewLabel] = useState("");
  const inputRef = useRef(null);

  const active = eqs[activeIdx];

  const evalTest = (formula) => {
    const dummy = buildDerivedVars(initialStats());
    dummy.fullScores = 3; dummy.partialScores = 2; dummy.failedCycles = 1;
    dummy.totalCycles = 6; dummy.scoringCycles = 5; dummy.climbSuccess = 1;
    dummy.totalClimbs = 1; dummy.offShiftSeconds = 30; dummy.offActions = 8;
    dummy.shiftsCompleted = 3;
    try {
      const keys = Object.keys(dummy);
      const vals = keys.map((k) => dummy[k]);
      // eslint-disable-next-line no-new-func
      const fn = new Function(...keys, `"use strict"; return (${formula});`);
      const r = fn(...vals);
      return { ok: true, value: isFinite(r) ? r : "∞/NaN → returns 0" };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  const handleFormulaChange = (val) => {
    const updated = eqs.map((e, i) => i === activeIdx ? { ...e, formula: val } : e);
    setEqs(updated);
    setTestResult(evalTest(val));
    const before = val.slice(0, inputRef.current?.selectionStart ?? val.length);
    const match = before.match(/([a-zA-Z_]\w*)$/);
    if (match && match[1].length >= 2) {
      const query = match[1].toLowerCase();
      const matches = FORMULA_VARIABLES.filter((v) => v.name.toLowerCase().startsWith(query)).slice(0, 6);
      setAutocomplete(matches);
      setAcSelected(0);
    } else {
      setAutocomplete([]);
    }
  };

  const insertAtCursor = (text) => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const current = eqs[activeIdx].formula;
    const newVal = current.slice(0, start) + text + current.slice(end);
    const parenIdx = text.indexOf("(");
    const cursorOffset = parenIdx !== -1 && text.endsWith(")") ? start + parenIdx + 1 : start + text.length;
    handleFormulaChange(newVal);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(cursorOffset, cursorOffset); });
  };

  const acceptAutocomplete = (varName) => {
    const el = inputRef.current;
    if (!el) return;
    const before = eqs[activeIdx].formula.slice(0, el.selectionStart);
    const after  = eqs[activeIdx].formula.slice(el.selectionStart);
    const match  = before.match(/([a-zA-Z_]\w*)$/);
    if (!match) return;
    const prefix = before.slice(0, before.length - match[1].length);
    const newVal = prefix + varName + after;
    handleFormulaChange(newVal);
    setAutocomplete([]);
    requestAnimationFrame(() => {
      el.focus();
      const pos = prefix.length + varName.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e) => {
    if (autocomplete.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setAcSelected((s) => Math.min(s + 1, autocomplete.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setAcSelected((s) => Math.max(s - 1, 0)); return; }
      if (e.key === "Tab" || e.key === "Enter") { e.preventDefault(); acceptAutocomplete(autocomplete[acSelected].name); return; }
      if (e.key === "Escape") { setAutocomplete([]); return; }
    }
  };

  const addFormula = () => {
    if (!newLabel.trim()) return;
    const key = newLabel.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (eqs.find((e) => e.key === key)) return;
    const newEq = { key, label: newLabel.trim(), formula: "0", desc: "", weight: 0.1, builtin: false };
    setEqs([...eqs, newEq]);
    setActiveIdx(eqs.length);
    setNewLabel("");
  };

  const removeFormula = (idx) => {
    if (eqs[idx].builtin) return;
    const updated = eqs.filter((_, i) => i !== idx);
    setEqs(updated);
    setActiveIdx(Math.min(activeIdx, updated.length - 1));
  };

  return (
    <div className="scout-editor">
      {/* Header */}
      <div className="scout-editor__header">
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", color: "var(--scout-indigo)" }}>FORMULA EDITOR</div>
          <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.02em", marginTop: 2, color: "var(--scout-text-body)" }}>Scoring Equations</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="scout-btn-ghost" onClick={() => setShowOpsHelp((h) => !h)}>
            {showOpsHelp ? "HIDE HELP" : "? HELP"}
          </button>
          <button className="scout-btn-ghost" style={{ background: "linear-gradient(135deg,#3730a3,#4f46e5)", color: "#fff", border: "none" }} onClick={() => onSave(eqs)}>
            SAVE
          </button>
          <button className="scout-btn-danger" onClick={onClose}>✕</button>
        </div>
      </div>

      <div className="scout-editor__body">
        {/* Sidebar */}
        <div className="scout-editor__sidebar">
          <div className="scout-overline" style={{ padding: "8px 10px" }}>Equations</div>
          {eqs.map((eq, i) => {
            const result = evalTest(eq.formula);
            return (
              <div
                key={eq.key}
                onClick={() => setActiveIdx(i)}
                className={`scout-eq-item ${i === activeIdx ? "scout-eq-item--active" : ""}`}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: i === activeIdx ? "var(--scout-indigo-soft)" : "var(--scout-text-secondary)", lineHeight: 1.3 }}>
                    {eq.label}
                  </span>
                  <span style={{ fontSize: 9, color: result.ok ? "var(--scout-green-soft)" : "var(--scout-red-soft)", fontWeight: 800 }}>
                    {result.ok ? "✓" : "✗"}
                  </span>
                </div>
                <div style={{ fontSize: 8, color: "var(--scout-text-ghost)", marginTop: 2 }}>w: {(eq.weight * 100).toFixed(0)}%</div>
              </div>
            );
          })}

          {/* Weight total */}
          {(() => {
            const totalW = eqs.reduce((sum, e) => sum + (e.weight || 0), 0);
            const pct = Math.round(totalW * 100);
            const over = pct > 100, under = pct < 100;
            const col = over ? "var(--scout-red-soft)" : under ? "var(--scout-yellow-soft)" : "var(--scout-green-soft)";
            return (
              <div style={{ padding: "8px 10px", borderTop: "1px solid var(--scout-border)", background: "rgba(0,0,0,0.15)" }}>
                <div className="scout-overline" style={{ marginBottom: 4 }}>Total Weight</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--scout-border)" }}>
                    <div style={{ height: "100%", borderRadius: 999, width: `${Math.min(pct, 100)}%`, background: col, transition: "width 0.3s, background 0.3s" }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 900, color: col, minWidth: 36, textAlign: "right" }}>{pct}%</span>
                </div>
                {(over || under) && (
                  <div style={{ fontSize: 8, color: col, marginTop: 3, lineHeight: 1.4 }}>
                    {over ? `▲ ${pct - 100}% over — fit score will normalise` : `▼ ${100 - pct}% under — weights don't sum to 100%`}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Add formula */}
          <div style={{ padding: 10, borderTop: "1px solid var(--scout-border)", marginTop: "auto" }}>
            <div className="scout-overline" style={{ marginBottom: 6 }}>New Formula</div>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFormula()}
              placeholder="Label..."
              className="scout-input"
              style={{ fontSize: 10 }}
            />
            <button className="scout-btn-ghost" style={{ marginTop: 6, width: "100%", borderRadius: 7, padding: "6px", fontSize: 10 }} onClick={addFormula}>
              + ADD
            </button>
          </div>
        </div>

        {/* Main editor panel */}
        <div className="scout-editor__main">
          {active && (
            <>
              {/* Formula name & weight */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--scout-border)", display: "flex", gap: 12, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <div className="scout-overline" style={{ marginBottom: 4 }}>Label</div>
                  <input
                    value={active.label}
                    onChange={(e) => setEqs(eqs.map((eq, i) => i === activeIdx ? { ...eq, label: e.target.value } : eq))}
                    className="scout-input"
                  />
                </div>
                <div style={{ width: 80 }}>
                  <div className="scout-overline" style={{ marginBottom: 4 }}>Weight (0–1)</div>
                  <input
                    type="number" min="0" max="1" step="0.01"
                    value={active.weight}
                    onChange={(e) => setEqs(eqs.map((eq, i) => i === activeIdx ? { ...eq, weight: parseFloat(e.target.value) || 0 } : eq))}
                    className="scout-input"
                    style={{ color: "var(--scout-yellow-soft)" }}
                  />
                </div>
                {!active.builtin && (
                  <button className="scout-btn-danger" style={{ borderRadius: 7, padding: "6px 10px", fontSize: 10 }} onClick={() => removeFormula(activeIdx)}>
                    DELETE
                  </button>
                )}
              </div>

              {/* Description */}
              <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--scout-border)" }}>
                <div className="scout-overline" style={{ marginBottom: 4 }}>Description</div>
                <input
                  value={active.desc}
                  onChange={(e) => setEqs(eqs.map((eq, i) => i === activeIdx ? { ...eq, desc: e.target.value } : eq))}
                  placeholder="What does this measure?"
                  className="scout-input"
                  style={{ fontSize: 11, color: "var(--scout-text-secondary)" }}
                />
              </div>

              {/* Math ops toolbar */}
              <div className="scout-ops-bar">
                {MATH_OPS.map((op) => (
                  <button key={op.label} title={`${op.desc} (Alt+${op.key})`} onClick={() => insertAtCursor(op.insert)} className="scout-op-btn">
                    {op.label}
                  </button>
                ))}
              </div>

              {/* Formula input with autocomplete */}
              <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--scout-border)", position: "relative" }}>
                <div className="scout-overline" style={{ marginBottom: 6 }}>
                  Formula — result clamped to [0, 1] · type 2+ chars for variable autocomplete
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    ref={inputRef}
                    value={active.formula}
                    onChange={(e) => handleFormulaChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => setTimeout(() => setAutocomplete([]), 150)}
                    spellCheck={false}
                    className="scout-input scout-input--formula"
                    style={{ border: testResult && !testResult.ok ? "1px solid var(--scout-red)" : "1px solid var(--scout-border-subtle)" }}
                  />
                  {autocomplete.length > 0 && (
                    <div className="scout-autocomplete">
                      <div className="scout-autocomplete__header">TAB or ENTER to insert · ↑↓ to navigate</div>
                      {autocomplete.map((v, i) => (
                        <div
                          key={v.name}
                          onMouseDown={() => acceptAutocomplete(v.name)}
                          className={`scout-autocomplete__item ${i === acSelected ? "scout-autocomplete__item--selected" : ""}`}
                        >
                          <div>
                            <span style={{ fontSize: 11, color: "var(--scout-indigo-soft)", fontFamily: "monospace", fontWeight: 700 }}>{v.name}</span>
                            <span style={{ fontSize: 9, color: "var(--scout-text-ghost)", marginLeft: 8 }}>{v.desc}</span>
                          </div>
                          <span className="scout-category-badge">{v.category}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {testResult && (
                  <div style={{ marginTop: 6, fontSize: 10, fontFamily: "monospace" }}>
                    {testResult.ok
                      ? <span style={{ color: "var(--scout-green-soft)" }}>✓ test result: <strong>{typeof testResult.value === "number" ? testResult.value.toFixed(4) : testResult.value}</strong> (with sample data)</span>
                      : <span style={{ color: "var(--scout-red-soft)" }}>✗ error: {testResult.error}</span>
                    }
                  </div>
                )}
              </div>

              {/* Variables reference */}
              <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px" }}>
                <div className="scout-overline" style={{ marginBottom: 8 }}>Available Variables</div>
                {["scoring","defense","endgame","reliability","time","offshift","transition","derived"].map((cat) => {
                  const vars = FORMULA_VARIABLES.filter((v) => v.category === cat);
                  return (
                    <div key={cat} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 8, color: "var(--scout-text-darker)", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{cat}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {vars.map((v) => (
                          <button key={v.name} title={v.desc} onClick={() => insertAtCursor(v.name)} className="scout-var-chip">{v.name}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Help overlay */}
      {showOpsHelp && (
        <div style={{ position: "absolute", inset: 0, background: "var(--scout-bg-overlay)", zIndex: 200, overflowY: "auto", padding: "20px 20px 40px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "var(--scout-text-body)" }}>Formula Reference</div>
            <button className="scout-btn-danger" style={{ borderRadius: 8, padding: "6px 14px", fontSize: 11 }} onClick={() => setShowOpsHelp(false)}>CLOSE</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
            {MATH_OPS.map((op) => (
              <div key={op.label} className="scout-card scout-card--alt" style={{ borderRadius: 8, padding: "10px 12px" }}>
                <span style={{ color: "var(--scout-indigo-soft)", fontFamily: "monospace", fontWeight: 800, fontSize: 13 }}>{op.label}</span>
                <span style={{ color: "var(--scout-text-secondary)", fontSize: 10, marginLeft: 10 }}>{op.desc}</span>
                <div style={{ fontSize: 9, color: "var(--scout-text-ghost)", marginTop: 3, fontFamily: "monospace" }}>
                  inserts: <span style={{ color: "var(--scout-text-faint)" }}>{op.insert}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="scout-card scout-card--alt" style={{ borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--scout-yellow-soft)", marginBottom: 8 }}>Formula Rules</div>
            <div style={{ fontSize: 10, color: "var(--scout-text-secondary)", lineHeight: 1.7, fontFamily: "monospace" }}>
              • Result is automatically clamped to [0, 1]<br />
              • Division by zero returns 0<br />
              • Infinity / NaN returns 0<br />
              • Use Math.max(x, 1) to avoid divide-by-zero<br />
              • Use parentheses to control order: (a + b) * c<br />
              • Ternary: condition ? value_if_true : value_if_false<br />
              • Example: totalCycles &gt; 0 ? fullScores / totalCycles : 0
            </div>
          </div>
          <div className="scout-card scout-card--alt" style={{ borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--scout-green-soft)", marginBottom: 8 }}>Example Formulas</div>
            {[
              ["Full score rate",          "fullScores / Math.max(totalCycles, 1)"],
              ["Partial-adjusted score",   "(fullScores * 2 + partialScores) / (totalCycles * 2)"],
              ["Defense-adjusted CSR",     "(fullScores + partialScores * 0.5) / Math.max(totalCycles - defendedCycles * 0.5, 1)"],
              ["Actions per minute",       "offActions / Math.max(matchMinutes, 1) / 10"],
              ["Combined endgame+score",   "climbSuccess / Math.max(totalClimbs, 1) * 0.4 + fullScores / Math.max(totalCycles, 1) * 0.6"],
            ].map(([name, formula]) => (
              <div key={name} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: "var(--scout-text-faint)", fontWeight: 700 }}>{name}</div>
                <div style={{ fontSize: 10, color: "var(--scout-green-soft)", fontFamily: "monospace", background: "var(--scout-bg-app)", padding: "5px 8px", borderRadius: 5, marginTop: 3 }}>
                  {formula}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
//  MAIN APP
// ============================================================
export default function App() {
  const { matchTotal, autoEnd, transitEnd, endgameStart, shiftLen } = MATCH_CONFIG;

  // Sync theme from localStorage (set by main menu)
  useEffect(() => {
    const saved = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const [screen, setScreen]               = useState("start");
  const [matchTime, setMatchTime]         = useState(matchTotal);
  const matchTimeRef                       = useRef(matchTotal);
  const intervalRef                        = useRef(null);

  const [phase, setPhase]                 = useState("auto");
  const phaseRef                           = useRef("auto");

  const [currentShift, setCurrentShift]   = useState(null);
  const currentShiftRef                    = useRef(null);
  const [shiftTimeLeft, setShiftTimeLeft] = useState(0);
  const shiftTimeLeftRef                   = useRef(0);

  const [showAutoOverlay, setShowAutoOverlay] = useState(false);
  const autoWinnerSetRef                       = useRef(false);
  const [transitTimeLeft, setTransitTimeLeft] = useState(0);

  const [activeCycle, setActiveCycle]     = useState(false);
  const cycleDefendedRef                   = useRef(false);
  const [isShooting, setIsShooting]       = useState(false);
  const shootStartTimeRef                  = useRef(null);
  const [matchOver, setMatchOver]         = useState(false);
  const [stats, setStats]                 = useState(initialStats());
  const statsRef                           = useRef(initialStats());
  const [metrics, setMetrics]             = useState(null);

  const [equations, setEquations] = useState(() => DEFAULT_EQUATIONS.map((e) => ({ ...e })));
  const [showEditor, setShowEditor] = useState(false);
  const [matchMeta, setMatchMeta] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("scoutMeta") || "{}");
      return {
        teamNumber: saved.teamNumber || "",
        matchNumber: saved.matchNumber || "",
        scoutName: saved.scoutName || "",
      };
    } catch { return initialMeta(); }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sampleProgress, setSampleProgress] = useState(null); // null | { pct: 0-100, label: "" }

  // Persist teamNumber and scoutName to localStorage whenever they change
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("scoutMeta") || "{}");
      localStorage.setItem("scoutMeta", JSON.stringify({
        ...saved,
        teamNumber: matchMeta.teamNumber,
        scoutName: matchMeta.scoutName,
        matchNumber: matchMeta.matchNumber,
      }));
    } catch {}
  }, [matchMeta.teamNumber, matchMeta.scoutName, matchMeta.matchNumber]);

  const tick = useCallback(() => {
    matchTimeRef.current--;
    const t  = matchTimeRef.current;
    setMatchTime(t);
    const ph = phaseRef.current;

    if (ph === "auto" && t <= autoEnd && !autoWinnerSetRef.current) setShowAutoOverlay(true);

    if (ph === "transit") {
      statsRef.current.transitSeconds++;
      setTransitTimeLeft(t - transitEnd);
      if (t <= transitEnd) {
        if (!autoWinnerSetRef.current) {
          autoWinnerSetRef.current = true;
          currentShiftRef.current = "theirs";
          setCurrentShift("theirs");
        }
        phaseRef.current = "shift";
        setPhase("shift");
        shiftTimeLeftRef.current = shiftLen;
        setShiftTimeLeft(shiftLen);
        statsRef.current.shiftsCompleted++;
      }
    }

    if (ph === "shift") {
      shiftTimeLeftRef.current--;
      setShiftTimeLeft(shiftTimeLeftRef.current);
      if (currentShiftRef.current === "ours") statsRef.current.ourShiftSeconds++;
      else statsRef.current.offShiftSeconds++;

      if (shiftTimeLeftRef.current <= 0 && t > endgameStart) {
        const next = currentShiftRef.current === "ours" ? "theirs" : "ours";
        currentShiftRef.current = next;
        setCurrentShift(next);
        shiftTimeLeftRef.current = shiftLen;
        setShiftTimeLeft(shiftLen);
        statsRef.current.shiftsCompleted++;
      }
    }

    if (t <= endgameStart && ph !== "endgame" && ph !== "auto") {
      phaseRef.current = "endgame";
      setPhase("endgame");
    }

    if (t <= 0) {
      clearInterval(intervalRef.current);
      setMatchOver(true);
      setStats({ ...statsRef.current });
    }
  }, [autoEnd, transitEnd, endgameStart, shiftLen]);

  const startMatch = () => {
    setScreen("scout");
    intervalRef.current = setInterval(tick, 1000);
  };

  const setAutoWinner = (weWon) => {
    setShowAutoOverlay(false);
    autoWinnerSetRef.current = true;
    const firstShift = weWon ? "theirs" : "ours";
    currentShiftRef.current = firstShift;
    setCurrentShift(firstShift);
    const t = matchTimeRef.current;
    if (t > transitEnd) {
      phaseRef.current = "transit";
      setPhase("transit");
      setTransitTimeLeft(t - transitEnd);
    } else {
      phaseRef.current = "shift";
      setPhase("shift");
      shiftTimeLeftRef.current = shiftLen;
      setShiftTimeLeft(shiftLen);
      statsRef.current.shiftsCompleted++;
    }
  };

  const handleAction = (btn) => {
    const s = statsRef.current;
    const ph = phaseRef.current; // "auto" | "transit" | "shift" | "endgame"
    switch (btn.action) {
      case "startCycle":
        if (activeCycle) return;
        setActiveCycle(true);
        cycleDefendedRef.current = false;
        shootStartTimeRef.current = null;
        setIsShooting(false);
        s.possessions++;
        if (ph === "auto") s.auto.possessions++;
        else if (ph === "shift" || ph === "transit") s.teleop.possessions++;
        break;
      case "startShooting":
        if (!activeCycle) return;
        shootStartTimeRef.current = performance.now();
        setIsShooting(true);
        break;
      case "finishFull": {
        if (!activeCycle) return;
        if (shootStartTimeRef.current !== null) {
          s.shootingTimes = [...s.shootingTimes, Math.round(performance.now() - shootStartTimeRef.current)];
          shootStartTimeRef.current = null;
        }
        setIsShooting(false);
        s.fullScores++;
        if (ph === "auto") s.auto.fullScores++;
        else s.teleop.fullScores++;
        setActiveCycle(false); cycleDefendedRef.current = false;
        break;
      }
      case "finishPartial": {
        if (!activeCycle) return;
        if (shootStartTimeRef.current !== null) {
          s.shootingTimes = [...s.shootingTimes, Math.round(performance.now() - shootStartTimeRef.current)];
          shootStartTimeRef.current = null;
        }
        setIsShooting(false);
        s.partialScores++;
        if (ph === "auto") s.auto.partialScores++;
        else s.teleop.partialScores++;
        setActiveCycle(false); cycleDefendedRef.current = false;
        break;
      }
      case "finishFail":
        if (!activeCycle) return;
        shootStartTimeRef.current = null;
        setIsShooting(false);
        s.failedCycles++;
        if (ph === "auto") s.auto.failedCycles++;
        else s.teleop.failedCycles++;
        if (cycleDefendedRef.current) { s.defendedFails++; s.teleop.defendedFails++; }
        setActiveCycle(false); cycleDefendedRef.current = false;
        break;
      case "defend":
        if (!activeCycle) return;
        s.defendedCycles++; s.teleop.defendedCycles++;
        cycleDefendedRef.current = true;
        break;
      case "breakdown":
        s.failures++;
        if (ph === "auto") s.auto.failures++;
        else if (ph === "endgame") s.endgame.failures++;
        else s.teleop.failures++;
        break;
      case "climbOk":   s.climbSuccess++; s.endgame.climbSuccess++; break;
      case "climbFail": s.climbFail++;    s.endgame.climbFail++;    break;
      case "offStat":      s[btn.statKey]++; break;
      case "transitStat":  s[btn.statKey]++; break;
      default: break;
    }
    setStats({ ...s });
  };

  const goToResults = () => {
    const s = statsRef.current;
    const computed = {};
    equations.forEach((eq) => { computed[eq.key] = evaluateFormula(eq.formula, s); });
    setMetrics(computed);
    setScreen("results");
  };

  const reset = (prevMeta) => {
    clearInterval(intervalRef.current);
    matchTimeRef.current = matchTotal;
    autoWinnerSetRef.current = false;
    phaseRef.current = "auto";
    currentShiftRef.current = null;
    shiftTimeLeftRef.current = 0;
    statsRef.current = initialStats();
    cycleDefendedRef.current = false;
    shootStartTimeRef.current = null;
    setMatchTime(matchTotal); setPhase("auto"); setCurrentShift(null);
    setShiftTimeLeft(0); setTransitTimeLeft(0); setActiveCycle(false);
    setIsShooting(false);
    setShowAutoOverlay(false); setMatchOver(false); setStats(initialStats());
    setMetrics(null);
    // Keep scout name + team, increment match number
    const meta = prevMeta || matchMeta;
    const nextMatch = meta.matchNumber ? String(parseInt(meta.matchNumber, 10) + 1) : "";
    setMatchMeta({ teamNumber: meta.teamNumber, scoutName: meta.scoutName, matchNumber: nextMatch });
    setScreen("start");
  };

  const handleSubmit = async () => {
    const s = statsRef.current;
    const derived = buildDerivedVars(s);
    const computedMetrics = {};
    equations.forEach((eq) => { computedMetrics[eq.key] = evaluateFormula(eq.formula, s); });
    const fitScore = computeFit(equations, s);

    console.log(equations)

    const matchData = {
      meta: {
        teamNumber: matchMeta.teamNumber,
        matchNumber: matchMeta.matchNumber,
        scoutName: matchMeta.scoutName,
        timestamp: new Date().toISOString(),
      },
      auto: {
        possessions:   s.auto.possessions,
        fullScores:    s.auto.fullScores,
        partialScores: s.auto.partialScores,
        failedCycles:  s.auto.failedCycles,
        failures:      s.auto.failures,
      },
      teleop: {
        possessions:    s.teleop.possessions,
        fullScores:     s.teleop.fullScores,
        partialScores:  s.teleop.partialScores,
        failedCycles:   s.teleop.failedCycles,
        defendedCycles: s.teleop.defendedCycles,
        defendedFails:  s.teleop.defendedFails,
        failures:       s.teleop.failures,
        offCollect:     s.offCollect,
        offPush:        s.offPush,
        offShoot:       s.offShoot,
        offDispense:    s.offDispense,
        offDefend:      s.offDefend,
        transitScore:   s.transitScore,
        transitMiss:    s.transitMiss,
        transitCollect: s.transitCollect,
        transitDefend:  s.transitDefend,
        transitWeScore: s.transitWeScore,
        transitNothing: s.transitNothing,
        ourShiftSeconds:  s.ourShiftSeconds,
        offShiftSeconds:  s.offShiftSeconds,
        transitSeconds:   s.transitSeconds,
        shiftsCompleted:  s.shiftsCompleted,
      },
      endgame: {
        climbSuccess: s.endgame.climbSuccess,
        climbFail:    s.endgame.climbFail,
        failures:     s.endgame.failures,
      },
      totals: {
        possessions:    s.possessions,
        fullScores:     s.fullScores,
        partialScores:  s.partialScores,
        failedCycles:   s.failedCycles,
        defendedCycles: s.defendedCycles,
        defendedFails:  s.defendedFails,
        failures:       s.failures,
        climbSuccess:   s.climbSuccess,
        climbFail:      s.climbFail,
        totalCycles:    derived.totalCycles,
        scoringCycles:  derived.scoringCycles,
        totalClimbs:    derived.totalClimbs,
        offActions:     derived.offActions,
        shootingTimes:  s.shootingTimes,
        avgShotMs:      s.shootingTimes.length > 0 ? Math.round(s.shootingTimes.reduce((a, b) => a + b, 0) / s.shootingTimes.length) : null,
        fastestShotMs:  s.shootingTimes.length > 0 ? Math.min(...s.shootingTimes) : null,
        timedShots:     s.shootingTimes.length,
      },
      metrics: computedMetrics,
      fitScore,
      equations: equations.map((eq) => ({ key: eq.key, label: eq.label, formula: eq.formula, weight: eq.weight, desc: eq.desc })),
    };

    setIsSubmitting(true);
    const metaSnapshot = { ...matchMeta };
    try {
      await submitMatchData(matchData);
    } finally {
      setIsSubmitting(false);
      reset(metaSnapshot);
    }
  };

  const submitMatchData = async (matchData) => {
    const label = `[submit] team=${matchData.meta?.teamNumber} match=${matchData.meta?.matchNumber}`;
    console.log(`${label} — sending`, matchData);
    try {
      const res = await fetch("https://tries-hiv-formula-medline.trycloudflare.com/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matchData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        console.error(`${label} — server error ${res.status}:`, err);
      } else {
        const saved = await res.json();
        console.log(`${label} — saved OK, id=${saved.id}`, saved);
      }
    } catch (err) {
      console.warn(`${label} — backend unreachable, data logged below. Start server with: node server.js`);
      console.log("Unsaved match data:", JSON.stringify(matchData, null, 2));
    }
  };

  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const handleSampleData = async () => {
    const steps = [
      { pct: 10,  label: "Seeding autonomous phase…" },
      { pct: 25,  label: "Simulating auto cycles…" },
      { pct: 40,  label: "Running transition shift…" },
      { pct: 55,  label: "Generating teleop actions…" },
      { pct: 70,  label: "Recording off-shift activity…" },
      { pct: 82,  label: "Simulating endgame climb…" },
      { pct: 92,  label: "Computing metrics & fit score…" },
      { pct: 100, label: "Packaging match data…" },
    ];

    for (const step of steps) {
      setSampleProgress(step);
      await new Promise((r) => setTimeout(r, 280));
    }

    // Build realistic random stats
    const autoFull    = rand(1, 4);
    const autoPartial = rand(0, 2);
    const autoFail    = rand(0, 2);
    const telFull     = rand(2, 8);
    const telPartial  = rand(1, 5);
    const telFail     = rand(0, 4);
    const telDefCyc   = rand(0, 3);
    const telDefFail  = rand(0, Math.min(telDefCyc, 2));
    const climbOk     = rand(0, 1);
    const climbFail   = climbOk === 1 ? 0 : rand(0, 1);

    const s = initialStats();
    // auto
    s.auto.possessions  = autoFull + autoPartial + autoFail;
    s.auto.fullScores   = autoFull;
    s.auto.partialScores= autoPartial;
    s.auto.failedCycles = autoFail;
    s.auto.failures     = rand(0, 1);
    // teleop
    s.teleop.possessions   = telFull + telPartial + telFail;
    s.teleop.fullScores    = telFull;
    s.teleop.partialScores = telPartial;
    s.teleop.failedCycles  = telFail;
    s.teleop.defendedCycles= telDefCyc;
    s.teleop.defendedFails = telDefFail;
    s.teleop.failures      = rand(0, 2);
    // endgame
    s.endgame.climbSuccess = climbOk;
    s.endgame.climbFail    = climbFail;
    // off-shift / transit
    s.offCollect   = rand(0, 5); s.offPush = rand(0, 3); s.offShoot = rand(0, 4);
    s.offDispense  = rand(0, 2); s.offDefend = rand(0, 3);
    s.transitScore = rand(0, 3); s.transitMiss = rand(0, 3);
    s.transitCollect = rand(0, 2); s.transitDefend = rand(0, 2);
    s.transitWeScore = rand(0, 2); s.transitNothing = rand(0, 1);
    s.ourShiftSeconds  = rand(40, 70); s.offShiftSeconds = rand(40, 70);
    s.transitSeconds   = rand(8, 12);  s.shiftsCompleted = rand(3, 6);
    // aggregate totals
    s.possessions    = s.auto.possessions + s.teleop.possessions;
    s.fullScores     = autoFull + telFull;
    s.partialScores  = autoPartial + telPartial;
    s.failedCycles   = autoFail + telFail;
    s.defendedCycles = telDefCyc;
    s.defendedFails  = telDefFail;
    s.failures       = s.auto.failures + s.teleop.failures + s.endgame.failures;
    s.climbSuccess   = climbOk;
    s.climbFail      = climbFail;

    // Inject into refs/state directly (bypass live match flow)
    statsRef.current = s;
    setStats({ ...s });

    const computed = {};
    equations.forEach((eq) => { computed[eq.key] = evaluateFormula(eq.formula, s); });
    setMetrics(computed);

    const metaSnapshot = { ...matchMeta };

    const derived = buildDerivedVars(s);
    const computedMetrics2 = { ...computed };
    const fitScore2 = computeFit(equations, s);

    const matchData = {
      meta: {
        teamNumber: matchMeta.teamNumber,
        matchNumber: matchMeta.matchNumber,
        scoutName: matchMeta.scoutName,
        timestamp: new Date().toISOString(),
        sampleData: true,
      },
      auto: { possessions: s.auto.possessions, fullScores: s.auto.fullScores, partialScores: s.auto.partialScores, failedCycles: s.auto.failedCycles, failures: s.auto.failures },
      teleop: {
        possessions: s.teleop.possessions, fullScores: s.teleop.fullScores, partialScores: s.teleop.partialScores,
        failedCycles: s.teleop.failedCycles, defendedCycles: s.teleop.defendedCycles, defendedFails: s.teleop.defendedFails,
        failures: s.teleop.failures, offCollect: s.offCollect, offPush: s.offPush, offShoot: s.offShoot,
        offDispense: s.offDispense, offDefend: s.offDefend, transitScore: s.transitScore, transitMiss: s.transitMiss,
        transitCollect: s.transitCollect, transitDefend: s.transitDefend, transitWeScore: s.transitWeScore,
        transitNothing: s.transitNothing, ourShiftSeconds: s.ourShiftSeconds, offShiftSeconds: s.offShiftSeconds,
        transitSeconds: s.transitSeconds, shiftsCompleted: s.shiftsCompleted,
      },
      endgame: { climbSuccess: s.endgame.climbSuccess, climbFail: s.endgame.climbFail, failures: s.endgame.failures },
      totals: {
        possessions: s.possessions, fullScores: s.fullScores, partialScores: s.partialScores,
        failedCycles: s.failedCycles, defendedCycles: s.defendedCycles, defendedFails: s.defendedFails,
        failures: s.failures, climbSuccess: s.climbSuccess, climbFail: s.climbFail,
        totalCycles: derived.totalCycles, scoringCycles: derived.scoringCycles,
        totalClimbs: derived.totalClimbs, offActions: derived.offActions,
      },
      metrics: computedMetrics2,
      fitScore: fitScore2,
      equations: equations.map((eq) => ({ key: eq.key, label: eq.label, formula: eq.formula, weight: eq.weight, desc: eq.desc })),
    };

    setSampleProgress(null);
    try {
      await submitMatchData(matchData);
    } finally {
      reset(metaSnapshot);
    }
  };

  const activeGroupKey = (() => {
    if (phase === "auto")    return "auto";
    if (phase === "transit") return "transit";
    if (currentShift === "ours") return "ourShift";
    return "offShift";
  })();
  const activeGroup  = BUTTON_GROUPS[activeGroupKey];
  const showEndgame  = phase === "endgame";

  // Phase-specific dynamic tokens (these are truly runtime-dynamic; they stay inline)
  const phaseInfo = (() => {
    if (phase === "auto")    return { label: "AUTO",       accent: "var(--scout-indigo-soft)", bg: "var(--scout-indigo-bg)" };
    if (phase === "transit") return { label: "TRANSITION", accent: "var(--scout-yellow-soft)", bg: "#451a03" };
    if (phase === "endgame") return { label: "ENDGAME",    accent: "#f97316",                  bg: "#431407" };
    return                          { label: "TELEOP",     accent: "var(--scout-green-soft)",  bg: "#022c22" };
  })();

  const shiftAccent = (() => {
    if (phase === "auto")    return null;
    if (phase === "transit") return { color: "var(--scout-yellow-soft)", label: "TRANSITION SHIFT", time: Math.max(0, matchTime - transitEnd) };
    if (currentShift === "ours")   return { color: "var(--scout-green-soft)",  label: "OUR SHIFT",   time: shiftTimeLeft };
    if (currentShift === "theirs") return { color: "var(--scout-red-soft)",    label: "THEIR SHIFT", time: shiftTimeLeft };
    return null;
  })();

  const fitScore   = metrics ? computeFit(equations, statsRef.current) : 0;
  const fitColor   = fitScore >= 70 ? "var(--scout-green-soft)" : fitScore >= 40 ? "var(--scout-yellow-soft)" : "var(--scout-red-soft)";
  const timeProgress = ((matchTotal - matchTime) / matchTotal) * 100;

  if (showEditor) {
    return <FormulaEditor equations={equations} onSave={(eqs) => { setEquations(eqs); setShowEditor(false); }} onClose={() => setShowEditor(false)} />;
  }

  return (
    <div className="scout-root" style={{ position: "fixed", inset: 0, overflow: "hidden" }}>

      {/* ── START ─────────────────────────────────────────────── */}
      <div
        className="scout-screen"
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh",
          transform: screen === "start" ? "translateX(0)" : "translateX(-100%)",
          opacity: screen === "start" ? 1 : 0,
          pointerEvents: screen === "start" ? "auto" : "none",
          background: "radial-gradient(ellipse at 50% 60%, var(--scout-indigo-bg) 0%, transparent 70%), var(--scout-bg-app)",
        }}
      >
        {/* Decorative rings */}
        <div style={{ position: "absolute", width: 340, height: 340, borderRadius: "50%", border: "1px solid #1e1e2e", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", border: "1px solid #1e1e2e44", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", textAlign: "center", padding: "0 32px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.25em", color: "var(--scout-indigo)", textTransform: "uppercase", marginBottom: 20 }}>
            FRC Scouting · Team 935
          </div>
          <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1, marginBottom: 8, letterSpacing: "-0.03em", color: "var(--scout-text-primary)" }}>
            Match<br /><span style={{ color: "var(--scout-indigo)" }}>Scout</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--scout-text-faint)", marginBottom: 44, fontWeight: 500 }}>
            REBUILT · Real-time match tracker
          </div>
          {/* Match metadata */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24, textAlign: "left" }}>
            <div>
              <div className="scout-overline" style={{ marginBottom: 4 }}>Team Number</div>
              <input
                className="scout-input"
                type="number"
                placeholder="e.g. 935"
                value={matchMeta.teamNumber}
                onFocus={() => setMatchMeta((m) => ({ ...m, teamNumber: "" }))}
                onChange={(e) => setMatchMeta((m) => ({ ...m, teamNumber: e.target.value }))}
              />
            </div>
            <div>
              <div className="scout-overline" style={{ marginBottom: 4 }}>Match Number</div>
              <input
                className="scout-input"
                type="number"
                placeholder="e.g. 12"
                value={matchMeta.matchNumber}
                onFocus={() => setMatchMeta((m) => ({ ...m, matchNumber: "" }))}
                onChange={(e) => setMatchMeta((m) => ({ ...m, matchNumber: e.target.value }))}
              />
            </div>
            <div>
              <div className="scout-overline" style={{ marginBottom: 4 }}>Scout Name</div>
              <input
                className="scout-input"
                placeholder="Your name"
                value={matchMeta.scoutName}
                onFocus={() => setMatchMeta((m) => ({ ...m, scoutName: "" }))}
                onChange={(e) => setMatchMeta((m) => ({ ...m, scoutName: e.target.value }))}
              />
            </div>
          </div>
          {/* Sample data progress overlay */}
          {sampleProgress && (
            <div style={{ marginBottom: 18, background: "var(--scout-bg-card)", border: "1px solid var(--scout-border-card)", borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "var(--scout-indigo-soft)", letterSpacing: "0.1em" }}>GENERATING SAMPLE DATA</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: "var(--scout-text-faint)" }}>{sampleProgress.pct}%</span>
              </div>
              <div className="scout-progress-track" style={{ height: 6, marginBottom: 8 }}>
                <div style={{ height: "100%", borderRadius: 999, width: `${sampleProgress.pct}%`, background: "linear-gradient(90deg, var(--scout-indigo), #7c3aed)", transition: "width 0.25s ease" }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--scout-text-faint)", fontStyle: "italic" }}>{sampleProgress.label}</div>
            </div>
          )}
          <button
            onClick={startMatch}
            style={{
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "#fff", border: "none",
              borderRadius: 18, padding: "18px 52px", fontSize: 16, fontWeight: 800,
              cursor: "pointer", letterSpacing: "0.04em",
              boxShadow: "0 0 40px rgba(99,102,241,.27), 0 4px 20px rgba(0,0,0,.5)",
              WebkitTapHighlightColor: "transparent", display: "block", width: "100%", marginBottom: 12,
            }}
          >
            START SCOUTING
          </button>
          <div id="buttonCombo">
          <button
            onClick={() => setShowEditor(true)}
            className="scout-btn-ghost"
            style={{ borderRadius: 14, padding: "12px 52px", fontSize: 13, letterSpacing: "0.04em", WebkitTapHighlightColor: "transparent", width: "100%", marginBottom: 10 }}
          >
            ⚙ FORMULA EDITOR
          </button>
          <button
            id="sampleDataSubmit"
            onClick={handleSampleData}
            disabled={!!sampleProgress}
            className="scout-btn-ghost"
            style={{ borderRadius: 14, padding: "12px 52px", fontSize: 13, letterSpacing: "0.04em", WebkitTapHighlightColor: "transparent", width: "100%", opacity: sampleProgress ? 0.5 : 1, border: "1px dashed var(--scout-indigo)", color: "var(--scout-indigo-soft)" }}
          >
            ⚡ SAMPLE DATA SUBMIT
          </button>
          </div>
        </div>
      </div>

      {/* ── SCOUT ─────────────────────────────────────────────── */}
      <div
        className="scout-screen"
        style={{
          display: "flex", flexDirection: "column", height: "100vh",
          transform: screen === "scout" ? "translateX(0)" : screen === "start" ? "translateX(100%)" : "translateX(-100%)",
          opacity: screen === "scout" ? 1 : 0,
          pointerEvents: screen === "scout" ? "auto" : "none",
        }}
      >
        {/* Scout header */}
        <div className="scout-header" style={{ paddingBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", padding: "4px 10px", borderRadius: 6, background: phaseInfo.bg, color: phaseInfo.accent, border: `1px solid ${phaseInfo.accent}33` }}>
              {phaseInfo.label}
            </div>
            <div style={{
              fontSize: 30, fontWeight: 900, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em",
              color: matchTime <= endgameStart ? "#fb923c" : phase === "auto" ? "var(--scout-indigo-soft)" : phase === "transit" ? "var(--scout-yellow-soft)" : "var(--scout-text-primary)",
              textShadow: matchTime <= 10 ? "0 0 20px rgba(248,113,113,.67)" : "none",
              transition: "color 0.3s",
            }}>
              {fmtTime(matchTime)}
            </div>
          </div>

          {/* Progress bar */}
          <div className="scout-progress-track scout-progress-track--thick" style={{ marginBottom: shiftAccent ? 8 : 0 }}>
            <div style={{ height: "100%", borderRadius: 999, width: `${timeProgress}%`, background: `linear-gradient(90deg, var(--scout-indigo), ${phaseInfo.accent})`, transition: "width 1s linear" }} />
          </div>

          {shiftAccent && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: 9, background: `${shiftAccent.color}15`, border: `1px solid ${shiftAccent.color}30` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: shiftAccent.color, boxShadow: `0 0 6px ${shiftAccent.color}` }} />
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: shiftAccent.color }}>{shiftAccent.label}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: shiftAccent.color, fontVariantNumeric: "tabular-nums" }}>{shiftAccent.time}s</span>
            </div>
          )}
        </div>

        {/* Scout body */}
        <div className="scout-body">
          {phase !== "transit" && (
            <div style={{
              borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
              background: activeGroupKey === "offShift" ? "#1a0a0a" : "var(--scout-bg-card-alt)",
              border: `1px solid ${activeCycle ? "rgba(34,197,94,.13)" : activeGroupKey === "offShift" ? "rgba(127,29,29,.13)" : "var(--scout-border-subtle)"}`,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: activeCycle ? "var(--scout-green)" : activeGroupKey === "offShift" ? "#ef4444" : "var(--scout-neutral-glow)", boxShadow: activeCycle ? "0 0 0 3px rgba(34,197,94,.2)" : "none", transition: "all 0.2s" }} />
              <div style={{ fontSize: 11, color: "var(--scout-text-muted)", fontWeight: 600 }}>
                {activeGroupKey === "offShift" ? (
                  <><span style={{ color: "var(--scout-red-soft)", fontWeight: 800 }}>Their shift</span> — log off-shift activity</>
                ) : activeCycle && isShooting ? (
                  <><span style={{ color: "var(--scout-yellow-soft)", fontWeight: 800 }}>🎯 Aiming</span> — tap Full Score or Partial to stop timer</>
                ) : activeCycle ? (
                  <><span style={{ color: "var(--scout-text-body)", fontWeight: 800 }}>Cycle active</span> — finish the cycle{cycleDefendedRef.current ? <span style={{ color: "var(--scout-blue-soft)", marginLeft: 6 }}>🛡 defended</span> : ""}</>
                ) : (
                  <><span style={{ color: "var(--scout-text-body)", fontWeight: 800 }}>{phase === "auto" ? "Autonomous" : "Waiting"}</span> — tap Gain Possession</>
                )}
              </div>
            </div>
          )}

          {phase === "transit" && (
            <div style={{ borderRadius: 12, padding: "10px 14px", background: "#1c1205", border: "1px solid rgba(251,191,36,.13)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--scout-yellow-soft)", boxShadow: "0 0 6px #fbbf24", flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: "#92400e", fontWeight: 700 }}>
                <span style={{ color: "var(--scout-yellow-soft)" }}>Both hubs open</span> — log what's happening
              </div>
            </div>
          )}

          {activeGroup.sections.map((sec, i) => (
            <ButtonSection key={i} section={sec} activeCycle={activeCycle} isShooting={isShooting} onAction={handleAction} />
          ))}
          {showEndgame && activeGroup.endgameSections?.map((sec, i) => (
            <ButtonSection key={"eg" + i} section={sec} activeCycle={activeCycle} isShooting={isShooting} onAction={handleAction} />
          ))}
        </div>

        {matchOver && (
          <div style={{ padding: "0 14px 20px", flexShrink: 0 }}>
            <button
              onClick={goToResults}
              className="scout-btn-primary"
              style={{ background: "linear-gradient(135deg,#7f1d1d,#9f1239)", boxShadow: "0 0 30px rgba(239,68,68,.2)" }}
            >
              VIEW RESULTS →
            </button>
          </div>
        )}

        {showAutoOverlay && (
          <div style={{ position: "absolute", inset: 0, background: "var(--scout-bg-overlay)", backdropFilter: "blur(8px)", zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 28 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--scout-indigo-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🏁</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, textAlign: "center", marginBottom: 6, color: "var(--scout-text-body)" }}>Auto Phase Over</div>
              <div style={{ fontSize: 13, color: "var(--scout-text-faint)", textAlign: "center", fontWeight: 500 }}>Who won autonomous?</div>
            </div>
            <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 300 }}>
              <button onClick={() => setAutoWinner(true)} style={{ flex: 1, border: "1px solid rgba(22,163,74,.33)", borderRadius: 16, padding: "20px 10px", fontSize: 13, fontWeight: 800, cursor: "pointer", background: "rgba(20,83,45,.13)", color: "var(--scout-green-soft)", letterSpacing: "0.04em", WebkitTapHighlightColor: "transparent" }}>WE WON</button>
              <button onClick={() => setAutoWinner(false)} style={{ flex: 1, border: "1px solid rgba(185,28,28,.33)", borderRadius: 16, padding: "20px 10px", fontSize: 13, fontWeight: 800, cursor: "pointer", background: "rgba(127,29,29,.13)", color: "var(--scout-red-soft)", letterSpacing: "0.04em", WebkitTapHighlightColor: "transparent" }}>THEY WON</button>
            </div>
          </div>
        )}
      </div>

      {/* ── RESULTS ─────────────────────────────────────────────── */}
      <div
        className="scout-screen"
        style={{
          display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden",
          transform: screen === "results" ? "translateX(0)" : "translateX(100%)",
          opacity: screen === "results" ? 1 : 0,
          pointerEvents: screen === "results" ? "auto" : "none",
          background: "var(--scout-bg-app)",
        }}
      >
        {/* Results header */}
        <div style={{ padding: "20px 18px 16px", background: "var(--scout-bg-surface)", borderBottom: "1px solid var(--scout-border)", flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.2em", color: "var(--scout-indigo)", marginBottom: 4 }}>MATCH COMPLETE</div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em", color: "var(--scout-text-body)" }}>Match Summary</div>
            <div style={{ fontSize: 12, color: "var(--scout-text-faint)", marginTop: 2, fontWeight: 500 }}>Drive team preview · Team 935</div>
          </div>
          <button className="scout-btn-ghost" style={{ borderRadius: 10, padding: "7px 12px", fontSize: 10, flexShrink: 0, marginTop: 4 }} onClick={() => setShowEditor(true)}>
            ⚙ FORMULAS
          </button>
        </div>

        {metrics && (() => {
          const roles   = getRoles(metrics, statsRef.current);
          const s       = statsRef.current;
          const derived = buildDerivedVars(s);
          return (
            <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 18, flex: 1, overflowY: "auto", paddingBottom: 8 }}>

              {/* Fit score */}
              <div style={{ borderRadius: 20, padding: "22px 20px", background: "linear-gradient(135deg, var(--scout-bg-card), rgba(26,29,46,.13))", border: "1px solid var(--scout-border-card)", display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <RadialProgress value={fitScore} size={88} strokeWidth={7} color={fitColor} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: fitColor, lineHeight: 1 }}>{fitScore}</span>
                    <span style={{ fontSize: 8, color: "var(--scout-text-faint)", fontWeight: 700, letterSpacing: "0.1em" }}>FIT</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: "var(--scout-text-secondary)", fontWeight: 600, marginBottom: 4 }}>Alliance Fit Score</div>
                  <div style={{ fontSize: 11, color: "var(--scout-text-faint)", lineHeight: 1.6 }}>
                    {fitScore >= 70 ? "Strong alliance candidate" : fitScore >= 40 ? "Moderate fit" : "Limited match potential"}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    {[["Full", s.fullScores],["Part", s.partialScores],["Fail", s.failedCycles],["Def'd", s.defendedCycles]].map(([l, v]) => (
                      <span key={l} style={{ fontSize: 10, fontWeight: 800, background: "var(--scout-border-subtle)", color: "var(--scout-text-secondary)", padding: "3px 8px", borderRadius: 6, letterSpacing: "0.04em" }}>{v} {l}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scoring metrics */}
              <div>
                <SectionHeader>Scoring Metrics</SectionHeader>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  {equations.map((eq) => {
                    const rawVal = metrics[eq.key];
                    const val    = rawVal !== null && rawVal !== undefined ? Math.round(rawVal * 100) : null;
                    const c      = val === null ? "var(--scout-text-faint)" : val >= 70 ? "var(--scout-green-soft)" : val >= 40 ? "var(--scout-yellow-soft)" : "var(--scout-red-soft)";
                    let substituted = eq.formula;
                    Object.entries(derived).forEach(([k, v]) => {
                      substituted = substituted.replace(new RegExp(`\\b${k}\\b`, "g"), `[${v}]`);
                    });
                    return (
                      <div key={eq.key} className="scout-card">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <div style={{ fontSize: 10, color: "var(--scout-text-faint)", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>{eq.label}</div>
                          <div style={{ display: "flex", alignItems: "flex-end", gap: 3 }}>
                            {val !== null
                              ? <><span style={{ fontSize: 22, fontWeight: 900, color: c, lineHeight: 1 }}>{val}</span><span style={{ fontSize: 11, color: "var(--scout-text-faint)", fontWeight: 700, marginBottom: 2 }}>%</span></>
                              : <span style={{ fontSize: 12, color: "var(--scout-text-faint)", fontWeight: 700 }}>ERR</span>
                            }
                          </div>
                        </div>
                        <div className="scout-progress-track">
                          <div style={{ height: "100%", borderRadius: 999, width: `${val ?? 0}%`, background: c, transition: "width 1s" }} />
                        </div>
                        <div style={{ fontSize: 9, color: "var(--scout-text-ghost)", lineHeight: 1.5, fontFamily: "monospace" }}>
                          <span style={{ color: "var(--scout-text-darker)", fontWeight: 800 }}>f = </span>
                          <span style={{ color: "var(--scout-text-dim)" }}>{eq.formula}</span>
                        </div>
                        <div style={{ fontSize: 9, color: "var(--scout-border-subtle)", lineHeight: 1.5, fontFamily: "monospace", marginTop: 2 }}>
                          <span style={{ color: "var(--scout-text-darker)", fontWeight: 800 }}>= </span>
                          <span style={{ color: "var(--scout-neutral-glow)" }}>{substituted}</span>
                        </div>
                        {eq.desc && <div style={{ fontSize: 9, color: "var(--scout-text-ghost)", marginTop: 4, lineHeight: 1.4 }}>{eq.desc}</div>}
                        <div style={{ fontSize: 8, color: "var(--scout-text-darker)", marginTop: 3 }}>weight: {(eq.weight * 100).toFixed(0)}% of fit score</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Shot timing */}
              {s.shootingTimes.length > 0 && (
                <div>
                  <SectionHeader>Shot Timing</SectionHeader>
                  <div className="scout-stat-grid-3" style={{ marginTop: 10 }}>
                    {[
                      ["Timed Shots",  s.shootingTimes.length,                                                                         "var(--scout-indigo-soft)"],
                      ["Avg Time",     `${(s.shootingTimes.reduce((a,b)=>a+b,0)/s.shootingTimes.length/1000).toFixed(2)}s`,            "var(--scout-yellow-soft)"],
                      ["Fastest",      `${(Math.min(...s.shootingTimes)/1000).toFixed(2)}s`,                                           "var(--scout-green-soft)"],
                      ["Slowest",      `${(Math.max(...s.shootingTimes)/1000).toFixed(2)}s`,                                           "var(--scout-red-soft)"],
                    ].map(([lbl, val, color]) => (
                      <div key={lbl} className="scout-stat-tile">
                        <div className="scout-stat-label">{lbl}</div>
                        <div className="scout-stat-value" style={{ color }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw stats */}
              <div>
                <SectionHeader>Raw Stats</SectionHeader>
                <div className="scout-stat-grid-3">
                  {[
                    ["Cycles",      derived.totalCycles,    "var(--scout-indigo-soft)"],
                    ["Full",        s.fullScores,           "var(--scout-green-soft)"],
                    ["Partial",     s.partialScores,        "var(--scout-yellow-soft)"],
                    ["Failed",      s.failedCycles,         "var(--scout-red-soft)"],
                    ["Def'd Cycles",s.defendedCycles,       "var(--scout-blue-soft)"],
                    ["Def'd Fails", s.defendedFails,        "#f87171"],
                    ["Breakdowns",  s.failures,             "var(--scout-red-soft)"],
                    ["Climb ✓",     s.climbSuccess,         "var(--scout-green-soft)"],
                    ["Climb ✗",     s.climbFail,            "var(--scout-red-soft)"],
                  ].map(([lbl, val, color]) => (
                    <div key={lbl} className="scout-stat-tile">
                      <div className="scout-stat-label">{lbl}</div>
                      <div className="scout-stat-value" style={{ color: val > 0 ? color : "var(--scout-neutral-glow)" }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transition shift */}
              <div>
                <SectionHeader>Transition Shift</SectionHeader>
                <div className="scout-stat-grid-3" style={{ gap: 8 }}>
                  {[
                    ["They Scored",   s.transitScore,   "var(--scout-green-soft)"],
                    ["They Missed",   s.transitMiss,    "var(--scout-red-soft)"],
                    ["We Scored",     s.transitWeScore, "var(--scout-green-soft)"],
                    ["We Collected",  s.transitCollect, "var(--scout-indigo-soft)"],
                    ["We Defended",   s.transitDefend,  "var(--scout-blue)"],
                    ["Nothing",       s.transitNothing, "var(--scout-neutral-glow)"],
                  ].map(([lbl, val, color]) => (
                    <div key={lbl} className="scout-stat-tile scout-stat-tile--lg">
                      <div className="scout-stat-label scout-stat-label--lg">{lbl}</div>
                      <div className="scout-stat-value scout-stat-value--lg" style={{ color: val > 0 ? color : "var(--scout-neutral-glow)" }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Off-shift */}
              <div>
                <SectionHeader>Off-Shift Activity</SectionHeader>
                <div className="scout-stat-grid-3" style={{ gap: 8 }}>
                  {[
                    ["Collect",  s.offCollect,  "var(--scout-indigo-soft)"],
                    ["Push",     s.offPush,     "var(--scout-indigo-soft)"],
                    ["Shoot",    s.offShoot,    "var(--scout-indigo-soft)"],
                    ["Dispense", s.offDispense, "#78716c"],
                    ["Defend",   s.offDefend,   "var(--scout-blue)"],
                  ].map(([lbl, val, color]) => (
                    <div key={lbl} className="scout-stat-tile scout-stat-tile--lg">
                      <div className="scout-stat-label scout-stat-label--lg">{lbl}</div>
                      <div className="scout-stat-value scout-stat-value--lg" style={{ color: val > 0 ? color : "var(--scout-neutral-glow)" }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Roles */}
              <div>
                <SectionHeader>Robot Roles</SectionHeader>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
                  {roles.scoring.map((r)  => <span key={r} className="scout-role-badge--scoring">{r}</span>)}
                  {roles.offShift.map((r) => <span key={r} className="scout-role-badge--offshift">{r}</span>)}
                  {roles.scoring.length === 0 && roles.offShift.length === 0 && (
                    <span style={{ color: "var(--scout-neutral-glow)", fontSize: 12 }}>No roles assigned</span>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        <div style={{ padding: "12px 14px 32px", flexShrink: 0, background: "var(--scout-bg-surface)", borderTop: "1px solid var(--scout-border)" }}>
          <button onClick={handleSubmit} disabled={isSubmitting} className="scout-btn-primary">
            {isSubmitting ? "SUBMITTING…" : "SUBMIT & SCOUT NEXT MATCH"}
          </button>
        </div>
      </div>
    </div>
  );
}