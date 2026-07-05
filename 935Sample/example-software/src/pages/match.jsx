import { useState, useRef, useCallback, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHandFist,
  faCrosshairs,
  faCircleCheck,
  faBolt,
  faXmark,
  faTriangleExclamation,
  faCircle,
  faShield,
  faMinus,
  faRocket,
  faBomb,
  faHandPointRight,
  faArrowTurnUp,
} from "@fortawesome/free-solid-svg-icons";
import { getApiBaseUrl, getDefaultHeaders } from "../apiConfig";
import { useURL } from "../urlConfig.js"
import "../App.css";

// ============================================================
//    MATCH TIMING
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
  action: {
    bg: "var(--scout-indigo-bg-alt)",
    fg: "var(--scout-indigo-soft)",
    glow: "var(--scout-indigo)",
  },
  success: {
    bg: "var(--scout-green-bg)",
    fg: "var(--scout-green-soft)",
    glow: "var(--scout-green)",
  },
  warn: {
    bg: "var(--scout-yellow-bg)",
    fg: "var(--scout-yellow-soft)",
    glow: "var(--scout-yellow)",
  },
  danger: {
    bg: "var(--scout-red-bg)",
    fg: "var(--scout-red-soft)",
    glow: "var(--scout-red)",
  },
  neutral: {
    bg: "var(--scout-neutral-bg)",
    fg: "var(--scout-neutral-fg)",
    glow: "var(--scout-neutral-glow)",
  },
  defend: {
    bg: "var(--scout-blue-bg)",
    fg: "var(--scout-blue-soft)",
    glow: "var(--scout-blue)",
  },
};

// ============================================================
//  🔘 BUTTON CONFIG  ← EDIT YOUR BUTTONS HERE
// ============================================================
//  Each button object supports:
//    label    – Text shown on the button
//    icon     – Emoji fallback (used when faIcon is not set)
//    faIcon   – Font Awesome class string, e.g. "fa-solid fa-hand-fist"
//               Set this to replace the emoji with an FA icon.
//               Leave undefined (or delete the line) to use emoji instead.
//    color    – One of: C.action  C.success  C.warn  C.danger  C.neutral  C.defend
//    sub      – (optional) Small subtitle text under the label
//  DO NOT change: id, action, statKey, requiresCycle — those are logic hooks.
// ============================================================

const BUTTON_GROUPS = {
  // ----------------------------------------------------------
  //  AUTO  (Autonomous period)
  // ----------------------------------------------------------
  auto: {
    label: "Autonomous",
    accent: "var(--scout-indigo-soft)",
    sections: [
      {
        sectionLabel: "Start Cycle",
        cols: 1,
        buttons: [
          {
            id: "gain",
            label: "Gain Possession",   // ← edit label
            icon: <FontAwesomeIcon icon={faHandFist} />,
            color: C.action,
            action: "startCycle",
          },
        ],
      },
      {
        sectionLabel: "Shooting",
        cols: 1,
        buttons: [
          {
            id: "shoot",
            label: "Start Shooting",
            icon: <FontAwesomeIcon icon={faCrosshairs} />,
            color: C.neutral,
            action: "startShooting",
            requiresCycle: true,
          },
        ],
      },
      {
        sectionLabel: "Finish Cycle",
        cols: 2,
        buttons: [
          {
            id: "full",
            label: "Full Score",
            icon: <FontAwesomeIcon icon={faCircleCheck} />,
            color: C.success,
            action: "finishFull",
            requiresCycle: true,
          },
          {
            id: "partial",
            label: "Partial",
            icon: <FontAwesomeIcon icon={faBolt} />,
            color: C.warn,
            action: "finishPartial",
            requiresCycle: true,
          },
          {
            id: "fail",
            label: "Failed",
            icon: <FontAwesomeIcon icon={faXmark} />,
            color: C.danger,
            action: "finishFail",
            requiresCycle: true,
          },
          {
            id: "break",
            label: "Breakdown",
            icon: <FontAwesomeIcon icon={faTriangleExclamation} />,
            color: C.danger,
            action: "breakdown",
          },
        ],
      },
    ],
  },
  // ----------------------------------------------------------
  //  TRANSIT  (Transition shift)
  // ----------------------------------------------------------
  transit: {
    label: "Transition Shift",
    accent: "var(--scout-yellow-soft)",
    sections: [
      {
        sectionLabel: "Did They Score?",
        cols: 2,
        buttons: [
          {
            id: "txScore",
            label: "Scored",
            icon: <FontAwesomeIcon icon={faCircleCheck} />,
            color: C.success,
            action: "transitStat",
            statKey: "transitScore",
          },
          {
            id: "txFail",
            label: "Missed",
            icon: <FontAwesomeIcon icon={faXmark} />,
            color: C.danger,
            action: "transitStat",
            statKey: "transitMiss",
          },
        ],
      },
      {
        sectionLabel: "What Did We Do?",
        cols: 3,
        buttons: [
          {
            id: "txCollect",
            label: "Collect",
            icon: <FontAwesomeIcon icon={faCircle} />,
            color: C.action,
            action: "transitStat",
            statKey: "transitCollect",
          },
          {
            id: "txDefend",
            label: "Defend",
            icon: <FontAwesomeIcon icon={faShield} />,
            color: C.defend,
            action: "transitStat",
            statKey: "transitDefend",
          },
          {
            id: "txScore2",
            label: "We Scored",
            icon: <FontAwesomeIcon icon={faCrosshairs} />,
            color: C.success,
            action: "transitStat",
            statKey: "transitWeScore",
          },
        ],
      },
      {
        sectionLabel: "Other",
        cols: 2,
        buttons: [
          {
            id: "txBreak",
            label: "Breakdown",
            icon: <FontAwesomeIcon icon={faTriangleExclamation} />,
            color: C.danger,
            action: "breakdown",
          },
          {
            id: "txNone",
            label: "Nothing",
            icon: <FontAwesomeIcon icon={faMinus} />,
            color: C.neutral,
            action: "transitStat",
            statKey: "transitNothing",
          },
        ],
      },
    ],
  },
  // ----------------------------------------------------------
  //  OUR SHIFT
  // ----------------------------------------------------------
  ourShift: {
    label: "Our Shift",
    accent: "var(--scout-green-soft)",
    sections: [
      {
        sectionLabel: "Start Cycle",
        cols: 1,
        buttons: [
          {
            id: "gain",
            label: "Gain Possession",
            icon: <FontAwesomeIcon icon={faHandFist} />,
            color: C.action,
            action: "startCycle",
          },
        ],
      },
      {
        sectionLabel: "Shooting",
        cols: 1,
        buttons: [
          {
            id: "shoot",
            label: "Start Shooting",
            icon: <FontAwesomeIcon icon={faCrosshairs} />,
            color: C.neutral,
            action: "startShooting",
            requiresCycle: true,
          },
        ],
      },
      {
        sectionLabel: "Actions",
        cols: 2,
        buttons: [
          {
            id: "defend",
            label: "Defended",
            icon: <FontAwesomeIcon icon={faShield} />,
            color: C.defend,
            action: "defend",
            requiresCycle: true,
          },
          {
            id: "break",
            label: "Breakdown",
            icon: <FontAwesomeIcon icon={faTriangleExclamation} />,
            color: C.danger,
            action: "breakdown",
          },
        ],
      },
      {
        sectionLabel: "Finish Cycle",
        cols: 2,
        buttons: [
          {
            id: "full",
            label: "Full Score",
            icon: <FontAwesomeIcon icon={faCircleCheck} />,
            color: C.success,
            action: "finishFull",
            requiresCycle: true,
          },
          {
            id: "partial",
            label: "Partial",
            icon: <FontAwesomeIcon icon={faBolt} />,
            color: C.warn,
            action: "finishPartial",
            requiresCycle: true,
          },
          {
            id: "fail",
            label: "Failed",
            icon: <FontAwesomeIcon icon={faXmark} />,
            color: C.danger,
            action: "finishFail",
            requiresCycle: true,
          },
        ],
      },
    ],
    endgameSections: [
      {
        sectionLabel: "Endgame — Climb",
        cols: 2,
        buttons: [
          {
            id: "climbOk",
            label: "Climb OK",
            icon: <FontAwesomeIcon icon={faRocket} />,
            color: C.success,
            action: "climbOk",
          },
          {
            id: "climbFail",
            label: "Climb Fail",
            icon: <FontAwesomeIcon icon={faBomb} />,
            color: C.danger,
            action: "climbFail",
          },
        ],
      },
    ],
  },
  // ----------------------------------------------------------
  //  OFF SHIFT  (Their Shift — observing the opponent)
  // ----------------------------------------------------------
  offShift: {
    label: "Their Shift",
    accent: "var(--scout-red-soft)",
    sections: [
      {
        sectionLabel: "Ball Interactions",
        cols: 3,
        buttons: [
          {
            id: "collect",
            label: "Collect",
            icon: <FontAwesomeIcon icon={faCircle} />,
            color: C.action,
            action: "offStat",
            statKey: "offCollect",
          },
          {
            id: "push",
            label: "Push",
            icon: <FontAwesomeIcon icon={faHandPointRight} />,
            color: C.action,
            action: "offStat",
            statKey: "offPush",
          },
          {
            id: "shoot",
            label: "Shoot",
            icon: <FontAwesomeIcon icon={faCrosshairs} />,
            color: C.action,
            action: "offStat",
            statKey: "offShoot",
          },
        ],
      },
      {
        sectionLabel: "Other",
        cols: 3,
        buttons: [
          {
            id: "dispense",
            label: "Dispense",
            sub: "to their side",
            icon: <FontAwesomeIcon icon={faArrowTurnUp} />,
            color: C.neutral,
            action: "offStat",
            statKey: "offDispense",
          },
          {
            id: "offdefend",
            label: "Defend",
            icon: <FontAwesomeIcon icon={faShield} />,
            color: C.defend,
            action: "offStat",
            statKey: "offDefend",
          },
          {
            id: "break",
            label: "Breakdown",
            icon: <FontAwesomeIcon icon={faTriangleExclamation} />,
            color: C.danger,
            action: "breakdown",
          },
        ],
      },
    ],
    endgameSections: [
      {
        sectionLabel: "Endgame — Climb",
        cols: 2,
        buttons: [
          {
            id: "climbOk",
            label: "Climb OK",
            icon: <FontAwesomeIcon icon={faRocket} />,
            color: C.success,
            action: "climbOk",
          },
          {
            id: "climbFail",
            label: "Climb Fail",
            icon: <FontAwesomeIcon icon={faBomb} />,
            color: C.danger,
            action: "climbFail",
          },
        ],
      },
    ],
  },
};

export { FORMULA_VARIABLES } from "./formulaVariables.js";

// ============================================================
//  📐 DEFAULT EQUATIONS  (editable)
// ============================================================
const DEFAULT_EQUATIONS = [
  {
    key: "csr",
    label: "Cycle Success Rate",
    formula:
      "totalCycles > 0 ? (fullScores + partialScores * 0.6) / totalCycles : 0",
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
    formula:
      "totalCycles > 0 ? 1 - (defendedFails / Math.max(totalCycles, 1)) * 1.5 : 0.5",
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
    formula:
      "offShiftSeconds > 0 ? Math.min(1, (offActions / (offShiftSeconds / 60)) / 5) : 0",
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
    totalCycles: s.fullScores + s.partialScores + s.failedCycles,
    totalClimbs: s.climbSuccess + s.climbFail,
    scoringCycles: s.fullScores + s.partialScores,
    offActions:
      s.offCollect + s.offPush + s.offShoot + s.offDispense + s.offDefend,
    matchMinutes: 160 / 60,
    timedShots: times.length,
    avgShotMs:
      times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
    fastestShotMs: times.length > 0 ? Math.min(...times) : 0,
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
  let totalWeight = 0,
    weightedSum = 0;
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
  const scoring = [],
    offShift = [];
  if ((metrics.csr || 0) > 0.6 && (metrics.quality || 0) > 0.75)
    scoring.push("Primary Scorer");
  if ((metrics.quality || 0) < 0.5 && (metrics.csr || 0) > 0.5)
    scoring.push("Low Capacity Scorer");
  if ((metrics.dr || 0) > 0.8) scoring.push("Defense Resistant");
  if ((metrics.dr || 0) > 0.7 && (metrics.csr || 0) < 0.4)
    scoring.push("Defender");
  if (scoring.length === 0 && (metrics.csr || 0) > 0)
    scoring.push("Utility Robot");
  if (stats.offDefend > 2) offShift.push("Off-Shift Defender");
  if (stats.offCollect > 3) offShift.push("Ball Collector");
  if (stats.offPush + stats.offShoot + stats.offDispense > 3)
    offShift.push("Ball Distributor");
  return { scoring, offShift };
}

const fmtTime = (t) =>
  `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

const initialStats = () => ({
  // aggregate (used for fit score / metrics, unchanged)
  possessions: 0,
  fullScores: 0,
  partialScores: 0,
  failedCycles: 0,
  defendedCycles: 0,
  defendedFails: 0,
  failures: 0,
  climbSuccess: 0,
  climbFail: 0,
  ourShiftSeconds: 0,
  offShiftSeconds: 0,
  transitSeconds: 0,
  shiftsCompleted: 0,
  offCollect: 0,
  offPush: 0,
  offShoot: 0,
  offDispense: 0,
  offDefend: 0,
  transitScore: 0,
  transitMiss: 0,
  transitCollect: 0,
  transitDefend: 0,
  transitWeScore: 0,
  transitNothing: 0,
  // shot timing — ms from "Start Shooting" to full/partial score
  shootingTimes: [], // array of milliseconds per timed shot
  // per-phase breakdowns
  auto: {
    possessions: 0,
    fullScores: 0,
    partialScores: 0,
    failedCycles: 0,
    failures: 0,
  },
  teleop: {
    possessions: 0,
    fullScores: 0,
    partialScores: 0,
    failedCycles: 0,
    defendedCycles: 0,
    defendedFails: 0,
    failures: 0,
  },
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
      id="action-btn"
      style={{
        backgroundColor: flash
          ? (activeColor || btn.color).glow
          : (activeColor || btn.color).bg,
        color: (activeColor || btn.color).fg,
        opacity: disabled ? 0.22 : 1,
        pointerEvents: disabled ? "none" : "auto",
        transform: pressed ? "scale(0.91)" : "scale(1)",
        boxShadow:
          pressed && !disabled
            ? `0 0 18px ${(activeColor || btn.color).glow}66`
            : isActive
              ? `0 0 12px ${C.warn.glow}55`
              : "none",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <span id="action-btn-icon">{btn.icon}</span>
      <span id="action-btn-label">
        {btn.label}
      </span>
      {btn.sub && (
        <span id="action-btn-sub">
          {btn.sub}
        </span>
      )}
    </button>
  );
}

function ButtonSection({ section, activeCycle, isShooting, onAction }) {
  return (
    <div>
      <div
        id="btn-section-header"
        className="scout-overline"
      >
        <span className="scout-section-divider scout-section-divider--left" />
        {section.sectionLabel}
        <span className="scout-section-divider scout-section-divider--right" />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${section.cols}, 1fr)`,
          gap: 8,
        }}
      >
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

function RadialProgress({
  value,
  size = 80,
  strokeWidth = 6,
  color = "var(--scout-indigo)",
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--scout-border-card)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - Math.max(0, Math.min(1, value / 100)))}
        style={{ transition: "stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)" }}
      />
    </svg>
  );
}

function SectionHeader({ children }) {
  return (
    <div id="section-header">
      <span className="scout-section-divider scout-section-divider--left" />
      <span id="section-header-text">{children}</span>
      <span className="scout-section-divider scout-section-divider--right" />
    </div>
  );
}

// ============================================================
//  FORMULA EDITOR
// ============================================================
const MATH_OPS = [
  { label: "( )", insert: "()", desc: "Parentheses", key: "(" },
  { label: "+", insert: " + ", desc: "Add", key: "+" },
  { label: "−", insert: " - ", desc: "Subtract", key: "-" },
  { label: "×", insert: " * ", desc: "Multiply", key: "*" },
  { label: "÷", insert: " / ", desc: "Divide", key: "/" },
  { label: "^", insert: " ** ", desc: "Power / Exponent", key: "p" },
  { label: "%", insert: " % ", desc: "Modulo", key: "m" },
  { label: "√", insert: "Math.sqrt()", desc: "Square root", key: "s" },
  { label: "π", insert: "Math.PI", desc: "Pi ≈ 3.14159", key: "i" },
  { label: "abs", insert: "Math.abs()", desc: "Absolute value", key: "a" },
  {
    label: "min",
    insert: "Math.min(,)",
    desc: "Minimum of two values",
    key: "n",
  },
  {
    label: "max",
    insert: "Math.max(,)",
    desc: "Maximum of two values",
    key: "x",
  },
  { label: "floor", insert: "Math.floor()", desc: "Round down", key: "f" },
  { label: "ceil", insert: "Math.ceil()", desc: "Round up", key: "c" },
  { label: "round", insert: "Math.round()", desc: "Round nearest", key: "r" },
  { label: "log", insert: "Math.log()", desc: "Natural log (ln)", key: "l" },
  { label: "log10", insert: "Math.log10()", desc: "Log base 10", key: "o" },
  { label: "sin", insert: "Math.sin()", desc: "Sine", key: "q" },
  { label: "cos", insert: "Math.cos()", desc: "Cosine", key: "w" },
  { label: "e", insert: "Math.E", desc: "Euler's number ≈ 2.718", key: "e" },
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
    dummy.fullScores = 3;
    dummy.partialScores = 2;
    dummy.failedCycles = 1;
    dummy.totalCycles = 6;
    dummy.scoringCycles = 5;
    dummy.climbSuccess = 1;
    dummy.totalClimbs = 1;
    dummy.offShiftSeconds = 30;
    dummy.offActions = 8;
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
    const updated = eqs.map((e, i) =>
      i === activeIdx ? { ...e, formula: val } : e,
    );
    setEqs(updated);
    setTestResult(evalTest(val));
    const before = val.slice(0, inputRef.current?.selectionStart ?? val.length);
    const match = before.match(/([a-zA-Z_]\w*)$/);
    if (match && match[1].length >= 2) {
      const query = match[1].toLowerCase();
      const matches = FORMULA_VARIABLES.filter((v) =>
        v.name.toLowerCase().startsWith(query),
      ).slice(0, 6);
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
    const end = el.selectionEnd;
    const current = eqs[activeIdx].formula;
    const newVal = current.slice(0, start) + text + current.slice(end);
    const parenIdx = text.indexOf("(");
    const cursorOffset =
      parenIdx !== -1 && text.endsWith(")")
        ? start + parenIdx + 1
        : start + text.length;
    handleFormulaChange(newVal);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursorOffset, cursorOffset);
    });
  };

  const acceptAutocomplete = (varName) => {
    const el = inputRef.current;
    if (!el) return;
    const before = eqs[activeIdx].formula.slice(0, el.selectionStart);
    const after = eqs[activeIdx].formula.slice(el.selectionStart);
    const match = before.match(/([a-zA-Z_]\w*)$/);
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
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAcSelected((s) => Math.min(s + 1, autocomplete.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAcSelected((s) => Math.max(s - 1, 0));
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        acceptAutocomplete(autocomplete[acSelected].name);
        return;
      }
      if (e.key === "Escape") {
        setAutocomplete([]);
        return;
      }
    }
  };

  const addFormula = () => {
    if (!newLabel.trim()) return;
    const key = newLabel
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    if (eqs.find((e) => e.key === key)) return;
    const newEq = {
      key,
      label: newLabel.trim(),
      formula: "0",
      desc: "",
      weight: 0.1,
      builtin: false,
    };
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
          <div id="editor-header-title">
            Scoring Equations
          </div>
        </div>
        <div id="editor-header-actions">
          <button
            className="scout-btn-ghost"
            onClick={() => setShowOpsHelp((h) => !h)}
          >
            {showOpsHelp ? "HIDE HELP" : "? HELP"}
          </button>
          <button
            className="scout-btn-ghost"
            id="editor-btn-save"
            onClick={() => onSave(eqs)}
          >
            SAVE
          </button>
          <button className="scout-btn-danger" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <div className="scout-editor__body">
        {/* Sidebar */}
        <div className="scout-editor__sidebar">
          <div id="editor-sidebar-overline" className="scout-overline">
            Equations
          </div>
          {eqs.map((eq, i) => {
            const result = evalTest(eq.formula);
            return (
              <div
                key={eq.key}
                onClick={() => setActiveIdx(i)}
                className={`scout-eq-item ${i === activeIdx ? "scout-eq-item--active" : ""}`}
              >
                <div id="eq-item-row">
                  <span
                    id="eq-item-label"
                    style={{
                      color:
                        i === activeIdx
                          ? "var(--scout-indigo-soft)"
                          : "var(--scout-text-secondary)",
                    }}
                  >
                    {eq.label}
                  </span>
                  <span
                    id="eq-item-status"
                    style={{
                      color: result.ok
                        ? "var(--scout-green-soft)"
                        : "var(--scout-red-soft)",
                    }}
                  >
                    {result.ok ? "✓" : "✗"}
                  </span>
                </div>
                <div id="eq-item-weight">
                  w: {(eq.weight * 100).toFixed(0)}%
                </div>
              </div>
            );
          })}

          {/* Weight total */}
          {(() => {
            const totalW = eqs.reduce((sum, e) => sum + (e.weight || 0), 0);
            const pct = Math.round(totalW * 100);
            const over = pct > 100,
              under = pct < 100;
            const col = over
              ? "var(--scout-red-soft)"
              : under
                ? "var(--scout-yellow-soft)"
                : "var(--scout-green-soft)";
            return (
              <div id="eq-weight-total">
                <div className="scout-overline" style={{ marginBottom: 4 }}>
                  Total Weight
                </div>
                <div id="eq-weight-bar-wrap">
                  <div
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 999,
                      background: "var(--scout-border)",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 999,
                        width: `${Math.min(pct, 100)}%`,
                        background: col,
                        transition: "width 0.3s, background 0.3s",
                      }}
                    />
                  </div>
                  <span id="eq-weight-pct" style={{ color: col }}>
                    {pct}%
                  </span>
                </div>
                {(over || under) && (
                  <div id="eq-weight-warning" style={{ color: col }}>
                    {over
                      ? `▲ ${pct - 100}% over — fit score will normalise`
                      : `▼ ${100 - pct}% under — weights don't sum to 100%`}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Add formula */}
          <div id="editor-add-formula">
            <div id="editor-add-formula-overline" className="scout-overline">
              New Formula
            </div>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFormula()}
              placeholder="Label..."
              className="scout-input"
              style={{ fontSize: 10 }}
            />
            <button
              id="editor-add-btn"
              className="scout-btn-ghost"
              onClick={addFormula}
            >
              + ADD
            </button>
          </div>
        </div>

        {/* Main editor panel */}
        <div className="scout-editor__main">
          {active && (
            <>
              {/* Formula name & weight */}
              <div id="editor-meta-row">
                <div id="editor-label-col">
                  <div id="editor-label-overline" className="scout-overline">
                    Label
                  </div>
                  <input
                    value={active.label}
                    onChange={(e) =>
                      setEqs(
                        eqs.map((eq, i) =>
                          i === activeIdx
                            ? { ...eq, label: e.target.value }
                            : eq,
                        ),
                      )
                    }
                    className="scout-input"
                  />
                </div>
                <div id="editor-weight-col">
                  <div id="editor-weight-overline" className="scout-overline">
                    Weight (0–1)
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={active.weight}
                    onChange={(e) =>
                      setEqs(
                        eqs.map((eq, i) =>
                          i === activeIdx
                            ? { ...eq, weight: parseFloat(e.target.value) || 0 }
                            : eq,
                        ),
                      )
                    }
                    id="editor-weight-input"
                    className="scout-input"
                  />
                </div>
                {!active.builtin && (
                  <button
                    id="editor-delete-btn"
                    className="scout-btn-danger"
                    onClick={() => removeFormula(activeIdx)}
                  >
                    DELETE
                  </button>
                )}
              </div>

              {/* Description */}
              <div id="editor-desc-row">
                <div className="scout-overline" style={{ marginBottom: 4 }}>
                  Description
                </div>
                <input
                  value={active.desc}
                  onChange={(e) =>
                    setEqs(
                      eqs.map((eq, i) =>
                        i === activeIdx ? { ...eq, desc: e.target.value } : eq,
                      ),
                    )
                  }
                  id="editor-desc-input"
                  placeholder="What does this measure?"
                  className="scout-input"
                />
              </div>

              {/* Math ops toolbar */}
              <div className="scout-ops-bar">
                {MATH_OPS.map((op) => (
                  <button
                    key={op.label}
                    title={`${op.desc} (Alt+${op.key})`}
                    onClick={() => insertAtCursor(op.insert)}
                    className="scout-op-btn"
                  >
                    {op.label}
                  </button>
                ))}
              </div>

              {/* Formula input with autocomplete */}
              <div id="editor-formula-section">
                <div id="editor-formula-overline" className="scout-overline">
                  Formula — result clamped to [0, 1] · type 2+ chars for
                  variable autocomplete
                </div>
                <div id="editor-formula-wrap">
                  <input
                    ref={inputRef}
                    value={active.formula}
                    onChange={(e) => handleFormulaChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => setTimeout(() => setAutocomplete([]), 150)}
                    spellCheck={false}
                    className="scout-input scout-input--formula"
                    style={{
                      border:
                        testResult && !testResult.ok
                          ? "1px solid var(--scout-red)"
                          : "1px solid var(--scout-border-subtle)",
                    }}
                  />
                  {autocomplete.length > 0 && (
                    <div className="scout-autocomplete">
                      <div className="scout-autocomplete__header">
                        TAB or ENTER to insert · ↑↓ to navigate
                      </div>
                      {autocomplete.map((v, i) => (
                        <div
                          key={v.name}
                          onMouseDown={() => acceptAutocomplete(v.name)}
                          className={`scout-autocomplete__item ${i === acSelected ? "scout-autocomplete__item--selected" : ""}`}
                        >
                          <div>
                            <span id="autocomplete-var-name">
                              {v.name}
                            </span>
                            <span id="autocomplete-var-desc">
                              {v.desc}
                            </span>
                          </div>
                          <span className="scout-category-badge">
                            {v.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {testResult && (
                  <div id="editor-test-result">
                    {testResult.ok ? (
                      <span id="editor-test-ok">
                        ✓ test result:{" "}
                        <strong>
                          {typeof testResult.value === "number"
                            ? testResult.value.toFixed(4)
                            : testResult.value}
                        </strong>{" "}
                        (with sample data)
                      </span>
                    ) : (
                      <span id="editor-test-err">
                        ✗ error: {testResult.error}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Variables reference */}
              <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px" }}>
                <div id="editor-vars-overline" className="scout-overline">
                  Available Variables
                </div>
                {[
                  "scoring",
                  "defense",
                  "endgame",
                  "reliability",
                  "time",
                  "offshift",
                  "transition",
                  "derived",
                ].map((cat) => {
                  const vars = FORMULA_VARIABLES.filter(
                    (v) => v.category === cat,
                  );
                  return (
                    <div key={cat} style={{ marginBottom: 10 }}>
                      <div id="var-category-header">
                        {cat}
                      </div>
                      <div id="var-category-chips">
                        {vars.map((v) => (
                          <button
                            key={v.name}
                            title={v.desc}
                            onClick={() => insertAtCursor(v.name)}
                            className="scout-var-chip"
                          >
                            {v.name}
                          </button>
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
        <div id="help-overlay">
          <div id="help-overlay-header">
            <div id="help-overlay-title">
              Formula Reference
            </div>
            <button
              id="help-overlay-close"
              className="scout-btn-danger"
              onClick={() => setShowOpsHelp(false)}
            >
              CLOSE
            </button>
          </div>
          <div id="help-ops-grid">
            {MATH_OPS.map((op) => (
              <div
                key={op.label}
                id="help-op-card"
                className="scout-card scout-card--alt"
              >
                <span id="help-op-label">
                  {op.label}
                </span>
                <span id="help-op-desc">
                  {op.desc}
                </span>
                <div id="help-op-insert">
                  inserts:{" "}
                  <span id="help-op-insert-val">
                    {op.insert}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div id="help-rules-card" className="scout-card scout-card--alt">
            <div id="help-rules-title">
              Formula Rules
            </div>
            <div id="help-rules-body">
              • Result is automatically clamped to [0, 1]
              <br />
              • Division by zero returns 0<br />
              • Infinity / NaN returns 0<br />
              • Use Math.max(x, 1) to avoid divide-by-zero
              <br />
              • Use parentheses to control order: (a + b) * c<br />
              • Ternary: condition ? value_if_true : value_if_false
              <br />• Example: totalCycles &gt; 0 ? fullScores / totalCycles : 0
            </div>
          </div>
          <div id="help-examples-card" className="scout-card scout-card--alt">
            <div id="help-examples-title">
              Example Formulas
            </div>
            {[
              ["Full score rate", "fullScores / Math.max(totalCycles, 1)"],
              [
                "Partial-adjusted score",
                "(fullScores * 2 + partialScores) / (totalCycles * 2)",
              ],
              [
                "Defense-adjusted CSR",
                "(fullScores + partialScores * 0.5) / Math.max(totalCycles - defendedCycles * 0.5, 1)",
              ],
              [
                "Actions per minute",
                "offActions / Math.max(matchMinutes, 1) / 10",
              ],
              [
                "Combined endgame+score",
                "climbSuccess / Math.max(totalClimbs, 1) * 0.4 + fullScores / Math.max(totalCycles, 1) * 0.6",
              ],
            ].map(([name, formula]) => (
              <div key={name} id="help-example-item">
                <div id="help-example-name">
                  {name}
                </div>
                <div id="help-example-formula">
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
  const { matchTotal, autoEnd, transitEnd, endgameStart, shiftLen } =
    MATCH_CONFIG;

  // Sync theme from localStorage (set by main menu)
  useEffect(() => {
    const saved = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  // Pull event name from pit form schema
  const [eventName, setEventName] = useState("");
  useEffect(() => {
    fetch(`${useURL()}/pit/form`, {
      headers: getDefaultHeaders(),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((schema) => { if (schema?.event) setEventName(schema.event); })
      .catch(() => {});
  }, []);

  const [screen, setScreen] = useState("start");
  const [matchTime, setMatchTime] = useState(matchTotal);
  const matchTimeRef = useRef(matchTotal);
  const intervalRef = useRef(null);

  const [phase, setPhase] = useState("auto");
  const phaseRef = useRef("auto");

  const [currentShift, setCurrentShift] = useState(null);
  const currentShiftRef = useRef(null);
  const [shiftTimeLeft, setShiftTimeLeft] = useState(0);
  const shiftTimeLeftRef = useRef(0);

  const [showAutoOverlay, setShowAutoOverlay] = useState(false);
  const autoWinnerSetRef = useRef(false);
  const [transitTimeLeft, setTransitTimeLeft] = useState(0);

  const [activeCycle, setActiveCycle] = useState(false);
  const activeCycleRef = useRef(false);
  const cycleDefendedRef = useRef(false);
  const [isShooting, setIsShooting] = useState(false);
  const isShootingRef = useRef(false);
  const shootStartTimeRef = useRef(null);
  const [carryover, setCarryover] = useState(null);
  const [matchNotes, setMatchNotes] = useState("");
  const [earlyEndReason, setEarlyEndReason] = useState("");
  const [showEarlyEndOverlay, setShowEarlyEndOverlay] = useState(false);
  const earlyEndReasonDraftRef = useRef("");
  const holdTimerRef = useRef(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [matchOver, setMatchOver] = useState(false);
  const [stats, setStats] = useState(initialStats());
  const statsRef = useRef(initialStats());
  const [metrics, setMetrics] = useState(null);

  const [equations, setEquations] = useState(() =>
    DEFAULT_EQUATIONS.map((e) => ({ ...e })),
  );
  const [showEditor, setShowEditor] = useState(false);
  const [matchMeta, setMatchMeta] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("scoutMeta") || "{}");
      return {
        teamNumber: saved.teamNumber || "",
        matchNumber: saved.matchNumber || "",
        scoutName: saved.scoutName || "",
      };
    } catch {
      return initialMeta();
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sampleProgress, setSampleProgress] = useState(null); // null | { pct: 0-100, label: "" }

  // Persist teamNumber and scoutName to localStorage whenever they change
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("scoutMeta") || "{}");
      localStorage.setItem(
        "scoutMeta",
        JSON.stringify({
          ...saved,
          teamNumber: matchMeta.teamNumber,
          scoutName: matchMeta.scoutName,
          matchNumber: matchMeta.matchNumber,
        }),
      );
    } catch {}
  }, [matchMeta.teamNumber, matchMeta.scoutName, matchMeta.matchNumber]);

  const tick = useCallback(() => {
    matchTimeRef.current--;
    const t = matchTimeRef.current;
    setMatchTime(t);
    const ph = phaseRef.current;

    if (ph === "auto" && t <= autoEnd && !autoWinnerSetRef.current) {
      setShowAutoOverlay(true);
      clearInterval(intervalRef.current);
      return;
    }

    if (ph === "transit") {
      statsRef.current.transitSeconds++;
      setTransitTimeLeft(t - transitEnd);
      if (t <= transitEnd) {
        if (!autoWinnerSetRef.current) {
          autoWinnerSetRef.current = true;
          currentShiftRef.current = "theirs";
          setCurrentShift("theirs");
        }
        // Detect carryover from transit into first shift
        if (activeCycleRef.current) {
          setCarryover(isShootingRef.current ? "shooting" : "possession");
          shootStartTimeRef.current = null;
          isShootingRef.current = false;
          setIsShooting(false);
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
      if (currentShiftRef.current === "ours")
        statsRef.current.ourShiftSeconds++;
      else statsRef.current.offShiftSeconds++;

      if (shiftTimeLeftRef.current <= 0 && t > endgameStart) {
        const next = currentShiftRef.current === "ours" ? "theirs" : "ours";
        // Detect carryover from the ending shift
        if (activeCycleRef.current) {
          const co = isShootingRef.current ? "shooting" : "possession";
          setCarryover(co);
          // Carryover: robot still has the ball / is mid-shot going into new shift
          // Reset shooting timer since we're crossing a shift boundary
          shootStartTimeRef.current = null;
          isShootingRef.current = false;
          setIsShooting(false);
          // activeCycle stays true — possession carries over
        } else {
          setCarryover(null);
        }
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


  const HOLD_DURATION = 3000;

  const startHold = () => {
    if (holdTimerRef.current) return;
    setHoldProgress(0);
    const startTime = Date.now();
    const animTick = () => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / HOLD_DURATION) * 100);
      setHoldProgress(pct);
      if (elapsed >= HOLD_DURATION) {
        cancelHold();
        clearInterval(intervalRef.current);
        setMatchOver(true);
        setStats({ ...statsRef.current });
        earlyEndReasonDraftRef.current = "";
        setShowEarlyEndOverlay(true);
      } else {
        holdTimerRef.current = requestAnimationFrame(animTick);
      }
    };
    holdTimerRef.current = requestAnimationFrame(animTick);
  };

  const cancelHold = () => {
    if (holdTimerRef.current) {
      cancelAnimationFrame(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHoldProgress(0);
  };

  const confirmEarlyEnd = () => {
    setEarlyEndReason(earlyEndReasonDraftRef.current);
    setShowEarlyEndOverlay(false);
    goToResults();
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
    intervalRef.current = setInterval(tick, 1000);
  };

  const handleAction = (btn) => {
    const s = statsRef.current;
    const ph = phaseRef.current; // "auto" | "transit" | "shift" | "endgame"
    switch (btn.action) {
      case "startCycle":
        if (activeCycle) return;
        setActiveCycle(true);
        activeCycleRef.current = true;
        cycleDefendedRef.current = false;
        shootStartTimeRef.current = null;
        setIsShooting(false);
        isShootingRef.current = false;
        s.possessions++;
        if (ph === "auto") s.auto.possessions++;
        else if (ph === "shift" || ph === "transit") s.teleop.possessions++;
        break;
      case "startShooting":
        if (!activeCycle) return;
        shootStartTimeRef.current = performance.now();
        setIsShooting(true);
        isShootingRef.current = true;
        break;
      case "finishFull": {
        if (!activeCycle) return;
        if (shootStartTimeRef.current !== null) {
          s.shootingTimes = [
            ...s.shootingTimes,
            Math.round(performance.now() - shootStartTimeRef.current),
          ];
          shootStartTimeRef.current = null;
        }
        setIsShooting(false);
        isShootingRef.current = false;
        s.fullScores++;
        if (ph === "auto") s.auto.fullScores++;
        else s.teleop.fullScores++;
        setActiveCycle(false);
        activeCycleRef.current = false;
        cycleDefendedRef.current = false;
        setCarryover(null);
        break;
      }
      case "finishPartial": {
        if (!activeCycle) return;
        if (shootStartTimeRef.current !== null) {
          s.shootingTimes = [
            ...s.shootingTimes,
            Math.round(performance.now() - shootStartTimeRef.current),
          ];
          shootStartTimeRef.current = null;
        }
        setIsShooting(false);
        isShootingRef.current = false;
        s.partialScores++;
        if (ph === "auto") s.auto.partialScores++;
        else s.teleop.partialScores++;
        setActiveCycle(false);
        activeCycleRef.current = false;
        cycleDefendedRef.current = false;
        setCarryover(null);
        break;
      }
      case "finishFail":
        if (!activeCycle) return;
        shootStartTimeRef.current = null;
        setIsShooting(false);
        isShootingRef.current = false;
        s.failedCycles++;
        if (ph === "auto") s.auto.failedCycles++;
        else s.teleop.failedCycles++;
        if (cycleDefendedRef.current) {
          s.defendedFails++;
          s.teleop.defendedFails++;
        }
        setActiveCycle(false);
        activeCycleRef.current = false;
        cycleDefendedRef.current = false;
        setCarryover(null);
        break;
      case "defend":
        if (!activeCycle) return;
        s.defendedCycles++;
        s.teleop.defendedCycles++;
        cycleDefendedRef.current = true;
        break;
      case "breakdown":
        s.failures++;
        if (ph === "auto") s.auto.failures++;
        else if (ph === "endgame") s.endgame.failures++;
        else s.teleop.failures++;
        break;
      case "climbOk":
        s.climbSuccess++;
        s.endgame.climbSuccess++;
        break;
      case "climbFail":
        s.climbFail++;
        s.endgame.climbFail++;
        break;
      case "offStat":
        s[btn.statKey]++;
        break;
      case "transitStat":
        s[btn.statKey]++;
        break;
      default:
        break;
    }
    setStats({ ...s });
  };

  const goToResults = () => {
    const s = statsRef.current;
    const computed = {};
    equations.forEach((eq) => {
      computed[eq.key] = evaluateFormula(eq.formula, s);
    });
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
    activeCycleRef.current = false;
    isShootingRef.current = false;
    setMatchTime(matchTotal);
    setPhase("auto");
    setCurrentShift(null);
    setShiftTimeLeft(0);
    setTransitTimeLeft(0);
    setActiveCycle(false);
    setIsShooting(false);
    setCarryover(null);
    setShowAutoOverlay(false);
    setMatchOver(false);
    setStats(initialStats());
    setMetrics(null);
    setMatchNotes("");
    setEarlyEndReason("");
    setShowEarlyEndOverlay(false);
    // Keep scout name + team, increment match number
    const meta = prevMeta || matchMeta;
    const nextMatch = meta.matchNumber
      ? String(parseInt(meta.matchNumber, 10) + 1)
      : "";
    setMatchMeta({
      teamNumber: meta.teamNumber,
      scoutName: meta.scoutName,
      matchNumber: nextMatch,
    });
    setScreen("start");
  };

  const handleSubmit = async () => {
    const s = statsRef.current;
    const derived = buildDerivedVars(s);
    const computedMetrics = {};
    equations.forEach((eq) => {
      computedMetrics[eq.key] = evaluateFormula(eq.formula, s);
    });
    const fitScore = computeFit(equations, s);

    console.log(equations);

    const matchData = {
      meta: {
        teamNumber: matchMeta.teamNumber,
        matchNumber: matchMeta.matchNumber,
        scoutName: matchMeta.scoutName,
        eventName: eventName || null,
        timestamp: new Date().toISOString(),
      },
      auto: {
        possessions: s.auto.possessions,
        fullScores: s.auto.fullScores,
        partialScores: s.auto.partialScores,
        failedCycles: s.auto.failedCycles,
        failures: s.auto.failures,
      },
      teleop: {
        possessions: s.teleop.possessions,
        fullScores: s.teleop.fullScores,
        partialScores: s.teleop.partialScores,
        failedCycles: s.teleop.failedCycles,
        defendedCycles: s.teleop.defendedCycles,
        defendedFails: s.teleop.defendedFails,
        failures: s.teleop.failures,
        offCollect: s.offCollect,
        offPush: s.offPush,
        offShoot: s.offShoot,
        offDispense: s.offDispense,
        offDefend: s.offDefend,
        transitScore: s.transitScore,
        transitMiss: s.transitMiss,
        transitCollect: s.transitCollect,
        transitDefend: s.transitDefend,
        transitWeScore: s.transitWeScore,
        transitNothing: s.transitNothing,
        ourShiftSeconds: s.ourShiftSeconds,
        offShiftSeconds: s.offShiftSeconds,
        transitSeconds: s.transitSeconds,
        shiftsCompleted: s.shiftsCompleted,
      },
      endgame: {
        climbSuccess: s.endgame.climbSuccess,
        climbFail: s.endgame.climbFail,
        failures: s.endgame.failures,
      },
      totals: {
        possessions: s.possessions,
        fullScores: s.fullScores,
        partialScores: s.partialScores,
        failedCycles: s.failedCycles,
        defendedCycles: s.defendedCycles,
        defendedFails: s.defendedFails,
        failures: s.failures,
        climbSuccess: s.climbSuccess,
        climbFail: s.climbFail,
        totalCycles: derived.totalCycles,
        scoringCycles: derived.scoringCycles,
        totalClimbs: derived.totalClimbs,
        offActions: derived.offActions,
        shootingTimes: s.shootingTimes,
        avgShotMs:
          s.shootingTimes.length > 0
            ? Math.round(
                s.shootingTimes.reduce((a, b) => a + b, 0) /
                  s.shootingTimes.length,
              )
            : null,
        fastestShotMs:
          s.shootingTimes.length > 0 ? Math.min(...s.shootingTimes) : null,
        timedShots: s.shootingTimes.length,
      },
      fitScore,
      notes: matchNotes || null,
      earlyEnd: earlyEndReason ? { reason: earlyEndReason } : null,
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
      const res = await fetch(`${useURL()}/match/upload`, {
        method: "POST",
        headers: getDefaultHeaders({ "Content-Type": "application/json" }),
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
      console.warn(
        `${label} — backend unreachable, data logged below. Start server with: node server.js`,
      );
      console.log("Unsaved match data:", JSON.stringify(matchData, null, 2));
    }
  };

  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const handleSampleData = async () => {
    const steps = [
      { pct: 10, label: "Seeding autonomous phase…" },
      { pct: 25, label: "Simulating auto cycles…" },
      { pct: 40, label: "Running transition shift…" },
      { pct: 55, label: "Generating teleop actions…" },
      { pct: 70, label: "Recording off-shift activity…" },
      { pct: 82, label: "Simulating endgame climb…" },
      { pct: 92, label: "Computing metrics & fit score…" },
      { pct: 100, label: "Packaging match data…" },
    ];

    for (const step of steps) {
      setSampleProgress(step);
      await new Promise((r) => setTimeout(r, 280));
    }

    // Build realistic random stats
    const autoFull = rand(1, 4);
    const autoPartial = rand(0, 2);
    const autoFail = rand(0, 2);
    const telFull = rand(2, 8);
    const telPartial = rand(1, 5);
    const telFail = rand(0, 4);
    const telDefCyc = rand(0, 3);
    const telDefFail = rand(0, Math.min(telDefCyc, 2));
    const climbOk = rand(0, 1);
    const climbFail = climbOk === 1 ? 0 : rand(0, 1);

    const s = initialStats();
    // auto
    s.auto.possessions = autoFull + autoPartial + autoFail;
    s.auto.fullScores = autoFull;
    s.auto.partialScores = autoPartial;
    s.auto.failedCycles = autoFail;
    s.auto.failures = rand(0, 1);
    // teleop
    s.teleop.possessions = telFull + telPartial + telFail;
    s.teleop.fullScores = telFull;
    s.teleop.partialScores = telPartial;
    s.teleop.failedCycles = telFail;
    s.teleop.defendedCycles = telDefCyc;
    s.teleop.defendedFails = telDefFail;
    s.teleop.failures = rand(0, 2);
    // endgame
    s.endgame.climbSuccess = climbOk;
    s.endgame.climbFail = climbFail;
    // off-shift / transit
    s.offCollect = rand(0, 5);
    s.offPush = rand(0, 3);
    s.offShoot = rand(0, 4);
    s.offDispense = rand(0, 2);
    s.offDefend = rand(0, 3);
    s.transitScore = rand(0, 3);
    s.transitMiss = rand(0, 3);
    s.transitCollect = rand(0, 2);
    s.transitDefend = rand(0, 2);
    s.transitWeScore = rand(0, 2);
    s.transitNothing = rand(0, 1);
    s.ourShiftSeconds = rand(40, 70);
    s.offShiftSeconds = rand(40, 70);
    s.transitSeconds = rand(8, 12);
    s.shiftsCompleted = rand(3, 6);
    // aggregate totals
    s.possessions = s.auto.possessions + s.teleop.possessions;
    s.fullScores = autoFull + telFull;
    s.partialScores = autoPartial + telPartial;
    s.failedCycles = autoFail + telFail;
    s.defendedCycles = telDefCyc;
    s.defendedFails = telDefFail;
    s.failures = s.auto.failures + s.teleop.failures + s.endgame.failures;
    s.climbSuccess = climbOk;
    s.climbFail = climbFail;

    // Inject into refs/state directlya (bypass live match flow)
    statsRef.current = s;
    setStats({ ...s });

    const computed = {};
    equations.forEach((eq) => {
      computed[eq.key] = evaluateFormula(eq.formula, s);
    });
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
      auto: {
        possessions: s.auto.possessions,
        fullScores: s.auto.fullScores,
        partialScores: s.auto.partialScores,
        failedCycles: s.auto.failedCycles,
        failures: s.auto.failures,
      },
      teleop: {
        possessions: s.teleop.possessions,
        fullScores: s.teleop.fullScores,
        partialScores: s.teleop.partialScores,
        failedCycles: s.teleop.failedCycles,
        defendedCycles: s.teleop.defendedCycles,
        defendedFails: s.teleop.defendedFails,
        failures: s.teleop.failures,
        offCollect: s.offCollect,
        offPush: s.offPush,
        offShoot: s.offShoot,
        offDispense: s.offDispense,
        offDefend: s.offDefend,
        transitScore: s.transitScore,
        transitMiss: s.transitMiss,
        transitCollect: s.transitCollect,
        transitDefend: s.transitDefend,
        transitWeScore: s.transitWeScore,
        transitNothing: s.transitNothing,
        ourShiftSeconds: s.ourShiftSeconds,
        offShiftSeconds: s.offShiftSeconds,
        transitSeconds: s.transitSeconds,
        shiftsCompleted: s.shiftsCompleted,
      },
      endgame: {
        climbSuccess: s.endgame.climbSuccess,
        climbFail: s.endgame.climbFail,
        failures: s.endgame.failures,
      },
      totals: {
        possessions: s.possessions,
        fullScores: s.fullScores,
        partialScores: s.partialScores,
        failedCycles: s.failedCycles,
        defendedCycles: s.defendedCycles,
        defendedFails: s.defendedFails,
        failures: s.failures,
        climbSuccess: s.climbSuccess,
        climbFail: s.climbFail,
        totalCycles: derived.totalCycles,
        scoringCycles: derived.scoringCycles,
        totalClimbs: derived.totalClimbs,
        offActions: derived.offActions,
      },
      metrics: computedMetrics2,
      fitScore: fitScore2,
      equations: equations.map((eq) => ({
        key: eq.key,
        label: eq.label,
        formula: eq.formula,
        weight: eq.weight,
        desc: eq.desc,
      })),
    };

    setSampleProgress(null);
    try {
      await submitMatchData(matchData);
    } finally {
      reset(metaSnapshot);
    }
  };

  const activeGroupKey = (() => {
    if (phase === "auto") return "auto";
    if (phase === "transit") return "transit";
    if (currentShift === "ours") return "ourShift";
    return "offShift";
  })();
  const activeGroup = BUTTON_GROUPS[activeGroupKey];
  const showEndgame = phase === "endgame";

  // Phase-specific dynamic tokens (these are truly runtime-dynamic; they stay inline)
  const phaseInfo = (() => {
    if (phase === "auto")
      return {
        label: "AUTO",
        accent: "var(--scout-indigo-soft)",
        bg: "var(--scout-indigo-bg)",
      };
    if (phase === "transit")
      return {
        label: "TRANSITION",
        accent: "var(--scout-yellow-soft)",
        bg: "#451a03",
      };
    if (phase === "endgame")
      return { label: "ENDGAME", accent: "#f97316", bg: "#431407" };
    return {
      label: "TELEOP",
      accent: "var(--scout-green-soft)",
      bg: "#022c22",
    };
  })();

  const shiftAccent = (() => {
    if (phase === "auto") return null;
    if (phase === "transit")
      return {
        color: "var(--scout-yellow-soft)",
        label: "TRANSITION SHIFT",
        time: Math.max(0, matchTime - transitEnd),
      };
    if (currentShift === "ours")
      return {
        color: "var(--scout-green-soft)",
        label: "OUR SHIFT",
        time: shiftTimeLeft,
      };
    if (currentShift === "theirs")
      return {
        color: "var(--scout-red-soft)",
        label: "THEIR SHIFT",
        time: shiftTimeLeft,
      };
    return null;
  })();

  const fitScore = metrics ? computeFit(equations, statsRef.current) : 0;
  const fitColor =
    fitScore >= 70
      ? "var(--scout-green-soft)"
      : fitScore >= 40
        ? "var(--scout-yellow-soft)"
        : "var(--scout-red-soft)";
  const timeProgress = ((matchTotal - matchTime) / matchTotal) * 100;

  if (showEditor) {
    return (
      <FormulaEditor
        equations={equations}
        onSave={(eqs) => {
          setEquations(eqs);
          setShowEditor(false);
        }}
        onClose={() => setShowEditor(false)}
      />
    );
  }

  return (
    <div
      id="scout-root"
      className="scout-root"
    >
      {/* ── START ─────────────────────────────────────────────── */}
      <div
        id="screen-start"
        className="scout-screen"
        style={{
          transform: screen === "start" ? "translateX(0)" : "translateX(-100%)",
          opacity: screen === "start" ? 1 : 0,
          pointerEvents: screen === "start" ? "auto" : "none",
          background:
            "radial-gradient(ellipse at 50% 60%, var(--scout-indigo-bg) 0%, transparent 70%), var(--scout-bg-app)",
        }}
      >
        {/* Decorative rings */}
        <div id="start-ring-sm" />
        <div id="start-ring-lg" />

        <div id="start-content">
          <div id="start-eyebrow">
            FRC Scouting · Team 935
          </div>
          <div id="start-title">
            Match
            <br />
            <span id="start-title-accent">Scout</span>
          </div>
          <div id="start-subtitle">
            REBUILT · Real-time match tracker
          </div>
          {/* Match metadata */}
          <div id="start-meta-fields">
            <div>
              <div id="start-field-team-overline" className="scout-overline">
                Team Number
              </div>
              <input
                className="scout-input"
                type="number"
                placeholder="e.g. 935"
                value={matchMeta.teamNumber}
                onFocus={() => setMatchMeta((m) => ({ ...m, teamNumber: "" }))}
                onChange={(e) =>
                  setMatchMeta((m) => ({ ...m, teamNumber: e.target.value }))
                }
              />
            </div>
            <div>
              <div id="start-field-match-overline" className="scout-overline">
                Match Number
              </div>
              <input
                className="scout-input"
                type="number"
                placeholder="e.g. 12"
                value={matchMeta.matchNumber}
                onFocus={() => setMatchMeta((m) => ({ ...m, matchNumber: "" }))}
                onChange={(e) =>
                  setMatchMeta((m) => ({ ...m, matchNumber: e.target.value }))
                }
              />
            </div>
            <div>
              <div id="start-field-scout-overline" className="scout-overline">
                Scout Name
              </div>
              <input
                className="scout-input"
                placeholder="Your name"
                value={matchMeta.scoutName}
                onFocus={() => setMatchMeta((m) => ({ ...m, scoutName: "" }))}
                onChange={(e) =>
                  setMatchMeta((m) => ({ ...m, scoutName: e.target.value }))
                }
              />
            </div>
          </div>
          {/* Sample data progress overlay */}
          {sampleProgress && (
            <div id="sample-progress-card">
              <div id="sample-progress-header">
                <span id="sample-progress-label">
                  GENERATING SAMPLE DATA
                </span>
                <span id="sample-progress-pct">
                  {sampleProgress.pct}%
                </span>
              </div>
              <div
                id="sample-progress-track"
                className="scout-progress-track"
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    width: `${sampleProgress.pct}%`,
                    background:
                      "linear-gradient(90deg, var(--scout-indigo), #7c3aed)",
                    transition: "width 0.25s ease",
                  }}
                />
              </div>
              <div id="sample-progress-msg">
                {sampleProgress.label}
              </div>
            </div>
          )}
          <button
            id="btn-start-match"
            onClick={startMatch}
          >
            START SCOUTING
          </button>
            <button
              id="sampleDataSubmit"
              onClick={handleSampleData}
              disabled={!!sampleProgress}
              className="scout-btn-ghost"
              style={{ opacity: sampleProgress ? 0.5 : 1 }}
            >
              ⚡ SAMPLE DATA SUBMIT
            </button>
        </div>
      </div>

      {/* ── SCOUT ─────────────────────────────────────────────── */}
      <div
        id="screen-scout"
        className="scout-screen"
        style={{
          transform:
            screen === "scout"
              ? "translateX(0)"
              : screen === "start"
                ? "translateX(100%)"
                : "translateX(-100%)",
          opacity: screen === "scout" ? 1 : 0,
          pointerEvents: screen === "scout" ? "auto" : "none",
          position: "relative",
        }}
      >
        {/* All scout content — blurred when overlay is active */}
        <div
          id="scout-content"
          style={{
            filter: showAutoOverlay ? "blur(4px)" : "none",
            transition: "filter 0.2s ease",
            pointerEvents: showAutoOverlay ? "none" : "auto",
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
        {/* Scout header */}
        <div className="scout-header" style={{ paddingBottom: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <div
              id="phase-badge"
              style={{
                background: phaseInfo.bg,
                color: phaseInfo.accent,
                border: `1px solid ${phaseInfo.accent}33`,
              }}
            >
              {phaseInfo.label}
            </div>
            <div id="match-id-label">
              MATCH {matchMeta.matchNumber} / TEAM {matchMeta.teamNumber}
            </div>
            <div
              id="match-timer"
              style={{
                color:
                  matchTime <= endgameStart
                    ? "#fb923c"
                    : phase === "auto"
                      ? "var(--scout-indigo-soft)"
                      : phase === "transit"
                        ? "var(--scout-yellow-soft)"
                        : "var(--scout-text-primary)",
                textShadow:
                  matchTime <= 10 ? "0 0 20px rgba(248,113,113,.67)" : "none",
              }}
            >
              {fmtTime(matchTime)}
            </div>
          </div>

          {/* Progress bar */}
          <div
            className="scout-progress-track scout-progress-track--thick"
            style={{ marginBottom: shiftAccent ? 8 : 0 }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 999,
                width: `${timeProgress}%`,
                background: `linear-gradient(90deg, var(--scout-indigo), ${phaseInfo.accent})`,
                transition: "width 1s linear",
              }}
            />
          </div>

          {shiftAccent && (
            <div
              id="shift-accent-bar"
              style={{
                background: `${shiftAccent.color}15`,
                border: `1px solid ${shiftAccent.color}30`,
              }}
            >
              <div id="shift-accent-inner">
                <div
                  id="shift-accent-dot"
                  style={{
                    background: shiftAccent.color,
                    boxShadow: `0 0 6px ${shiftAccent.color}`,
                  }}
                />
                <span id="shift-accent-label" style={{ color: shiftAccent.color }}>
                  {shiftAccent.label}
                </span>
              </div>
              <span id="shift-accent-time" style={{ color: shiftAccent.color }}>
                {shiftAccent.time}s
              </span>
            </div>
          )}
        </div>

        {/* Scout body */}
        <div className="scout-body">
          {phase !== "transit" && (
            <div
              id="cycle-status-card"
              style={{
                background:
                  activeGroupKey === "offShift"
                    ? "#1a0a0a"
                    : "var(--scout-bg-card-alt)",
                border: `1px solid ${activeCycle ? "rgba(34,197,94,.13)" : activeGroupKey === "offShift" ? "rgba(127,29,29,.13)" : "var(--scout-border-subtle)"}`,
              }}
            >
              <div
                id="cycle-status-dot"
                style={{
                  background: activeCycle
                    ? "var(--scout-green)"
                    : activeGroupKey === "offShift"
                      ? "#ef4444"
                      : "var(--scout-neutral-glow)",
                  boxShadow: activeCycle
                    ? "0 0 0 3px rgba(34,197,94,.2)"
                    : "none",
                }}
              />
              <div id="cycle-status-text">
                {activeGroupKey === "offShift" ? (
                  <>
                    <span id="cycle-status-offshift-label">Their shift</span>{" "}
                    — log off-shift activity
                  </>
                ) : activeCycle && isShooting ? (
                  <>
                    <span id="cycle-status-aiming-label">🎯 Aiming</span>{" "}
                    — tap Full Score or Partial to stop timer
                  </>
                ) : activeCycle ? (
                  <>
                    <span id="cycle-status-active-label">Cycle active</span>{" "}
                    — finish the cycle
                    {cycleDefendedRef.current ? (
                      <span id="cycle-status-defended-badge">🛡 defended</span>
                    ) : (
                      ""
                    )}
                  </>
                ) : (
                  <>
                    <span id="cycle-status-idle-label">{phase === "auto" ? "Autonomous" : "Waiting"}</span>{" "}
                    — tap Gain Possession
                  </>
                )}
              </div>
            </div>
          )}

          {phase === "transit" && (
            <div id="transit-notice">
              <div id="transit-notice-dot" />
              <div id="transit-notice-text">
                <span id="transit-notice-accent">Both hubs open</span>{" "}
                — log what's happening
              </div>
            </div>
          )}

          {carryover && (
            <div
              id="carryover-banner"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 8,
                background: carryover === "shooting"
                  ? "var(--scout-yellow-bg)"
                  : "var(--scout-indigo-bg-alt)",
                border: `1px solid ${carryover === "shooting" ? "var(--scout-yellow)" : "var(--scout-indigo)"}`,
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 18 }}>
                {carryover === "shooting" ? "🎯" : "⚡"}
              </span>
              <div style={{ flex: 1, fontSize: 12, color: carryover === "shooting" ? "var(--scout-yellow-soft)" : "var(--scout-indigo-soft)" }}>
                <strong>Carryover from last shift</strong>
                {" — "}
                {carryover === "shooting"
                  ? "robot was mid-shot at shift end, cycle is active"
                  : "robot had possession at shift end, cycle is active"}
              </div>
              <button
                onClick={() => { setCarryover(null); setActiveCycle(false); activeCycleRef.current = false; }}
                style={{ background: "none", border: "none", color: "var(--scout-neutral-fg)", cursor: "pointer", fontSize: 16, padding: 2 }}
              >✕</button>
            </div>
          )}

          {activeGroup.sections.map((sec, i) => (
            <ButtonSection
              key={i}
              section={sec}
              activeCycle={activeCycle}
              isShooting={isShooting}
              onAction={handleAction}
            />
          ))}
          {showEndgame &&
            activeGroup.endgameSections?.map((sec, i) => (
              <ButtonSection
                key={"eg" + i}
                section={sec}
                activeCycle={activeCycle}
                isShooting={isShooting}
                onAction={handleAction}
              />
            ))}
        </div>

        {/* Hold-to-end bar — always visible during scouting */}
        {!matchOver && (
          <div id="match-over-bar" style={{ padding: "10px 16px" }}>
            <button
              id="btn-hold-end"
              className="scout-btn-danger"
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              style={{ position: "relative", overflow: "hidden", userSelect: "none", width: "100%" }}
            >
              {holdProgress > 0 && (
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: `${holdProgress}%`,
                  background: "rgba(255,255,255,0.18)",
                  transition: "none",
                  pointerEvents: "none",
                }} />
              )}
              {holdProgress > 0 ? `ENDING MATCH… ${Math.round(holdProgress)}%` : "HOLD 3s TO END MATCH EARLY"}
            </button>
          </div>
        )}
        {matchOver && (
          <div id="match-over-bar">
            <button
              onClick={goToResults}
              id="btn-view-results"
              className="scout-btn-primary"
            >
              VIEW RESULTS →
            </button>
          </div>
        )}
        </div>{/* end scout-content */}

        {showEarlyEndOverlay && (
          <div
            style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 16, zIndex: 50,
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(3px)",
              padding: 24,
            }}
          >
            <div style={{ fontSize: 36 }}>⚠️</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--scout-red-soft)", textAlign: "center" }}>
              Match Ended Early
            </div>
            <div style={{ fontSize: 13, color: "var(--scout-neutral-fg)", textAlign: "center" }}>
              Briefly describe what happened (lost connection, breakdown, etc.)
            </div>
            <textarea
              autoFocus
              rows={3}
              placeholder="e.g. Robot lost connection at 45s remaining"
              defaultValue=""
              onChange={(e) => { earlyEndReasonDraftRef.current = e.target.value; }}
              className="scout-input"
              style={{ width: "100%", maxWidth: 380, resize: "vertical", fontSize: 14 }}
            />
            <button
              onClick={confirmEarlyEnd}
              className="scout-btn-primary"
              style={{ width: "100%", maxWidth: 380 }}
            >
              CONTINUE TO NOTES →
            </button>
          </div>
        )}

        {showAutoOverlay && (
          <div
            id="auto-overlay"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
              zIndex: 50,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(2px)",
            }}
          >
            <div id="auto-overlay-icon">🏁</div>
            <div>
              <div id="auto-overlay-title">
                Auto Phase Over
              </div>
              <div id="auto-overlay-subtitle">
                Who won autonomous?
              </div>
            </div>
            <div
              id="auto-overlay-choices"
            >
              <button
                id="btn-we-won"
                onClick={() => setAutoWinner(true)}
              >
                WE WON
              </button>
              <button
                id="btn-they-won"
                onClick={() => setAutoWinner(false)}
              >
                THEY WON
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── RESULTS ─────────────────────────────────────────────── */}
      <div
        id="screen-results"
        className="scout-screen"
        style={{
          transform:
            screen === "results" ? "translateX(0)" : "translateX(100%)",
          opacity: screen === "results" ? 1 : 0,
          pointerEvents: screen === "results" ? "auto" : "none",
        }}
      >
        {/* Results header */}
        <div
          id="results-header"
        >
          <div>
            <div id="results-eyebrow">
              MATCH COMPLETE
            </div>
            <div id="results-title">
              Match Summary
            </div>
            <div
              id="results-meta"
            >
              {eventName ? eventName : "Match Scouting"}
            </div>
          </div>
          <button
            id="results-formulas-btn"
            className="scout-btn-ghost"
            onClick={() => setShowEditor(true)}
          >
            ⚙ FORMULAS
          </button>
        </div>

        {/* Early end notice */}
        {earlyEndReason && (
          <div style={{
            margin: "12px 16px 0",
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--scout-red-bg)",
            border: "1px solid var(--scout-red)",
            display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--scout-red-soft)", marginBottom: 2 }}>MATCH ENDED EARLY</div>
              <div style={{ fontSize: 13, color: "var(--scout-neutral-fg)" }}>{earlyEndReason}</div>
            </div>
          </div>
        )}

        {/* Scouter notes */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 16px 8px" }}>
          <div className="scout-overline" style={{ marginBottom: 8 }}>Match Notes</div>
          <div style={{ fontSize: 13, color: "var(--scout-neutral-fg)", marginBottom: 10 }}>
            Anything worth noting — strategy, fouls, unusual behavior, etc.
          </div>
          <textarea
            rows={6}
            placeholder="e.g. Drove under the stage consistently, seemed to target alliance partners for defense…"
            value={matchNotes}
            onChange={(e) => setMatchNotes(e.target.value)}
            className="scout-input"
            style={{ flex: 1, resize: "vertical", fontSize: 14, minHeight: 120 }}
          />
        </div>

        <div
          id="results-submit-bar"
        >
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="scout-btn-primary"
          >
            {isSubmitting ? "SUBMITTING…" : "SUBMIT & SCOUT NEXT MATCH"}
          </button>
        </div>
      </div>
    </div>
  );
}
