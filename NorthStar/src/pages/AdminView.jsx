import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHouse, faUser, faGear, faGamepad, faGrip, faChartColumn, faSun, faMoon, faArrowUpFromBracket, faPlay, faPlus, faArrowRightFromBracket } from '@fortawesome/free-solid-svg-icons'

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;600&display=swap');
`

const ThemeCtx = createContext({ dark: true })
//const useTheme = () => useContext(ThemeCtx)

// ── Backend context ───────────────────────────────────────────
const BackendCtx = createContext({ isBackend: false, backendUrl: 'https://taco-childhood-jailbreak.ngrok-free.dev' })
const useBackend = () => useContext(BackendCtx)

async function apiFetch(backendUrl, path, options = {}) {
  const url = backendUrl.replace(/\/$/, '') + path
  const res = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } })
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json()
}

// ── Storage helpers ───────────────────────────────────────────
const STORAGE_KEY = 'northstar_data'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    console.error('Failed to load data from storage')
  }
  return null
}

function saveToStorage(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {
    console.error('Failed to save data to storage')
  }
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click()
  URL.revokeObjectURL(url)
}

// ── Constants ─────────────────────────────────────────────────
const ROLE_LABELS = { coach: 'Coach', lead: 'Lead Scout', assistant: 'Asst. Scout', scouter: 'Scouter' }

if(BackendCtx.isBackend == true) {
  console.log("Backend mode enabled - data will be fetched from backend API")
};
// TODO: Read these from backend or local JSON file
const DEFAULT_SETTINGS = {
  teamNumber: '935', teamName: 'RaileRobotics',
  adminRoles: ['coach', 'lead'],
  rpiEnabled: true,
  backendUrl: 'https://taco-childhood-jailbreak.ngrok-free.dev',
  mlBetaEnabled: false,
}

// TODO: Change this to work with RPI, and manage without backend
const DEFAULT_USERS = {
  members: [
    { id: 1, name: 'Jordan Davis', username: 'jordan', role: 'lead', mins: 312, matches: 21, status: 'active', email: 'jordan@team4028.com' },
    { id: 2, name: 'Alex Martinez', username: 'alex', role: 'assistant', mins: 224, matches: 18, status: 'active', email: 'alex@team4028.com' },
    { id: 3, name: 'Casey Rivera', username: 'casey', role: 'scouter', mins: 198, matches: 15, status: 'active', email: 'casey@team4028.com' },
    { id: 4, name: 'Morgan Chen', username: 'morgan', role: 'coach', mins: 89, matches: 0, status: 'active', email: 'morgan@team4028.com' },
  ],
  nextId: 5,
}

// TODO: Clean up default data or functional data between sessions
const DEFAULT_DATA = {
  games: [
    {
      id: 1, name: 'Reefscape 2025', year: 2025, matches: 37, scouts: 6, status: 'active', created: '2025-01-04',
      fieldImage: null,
      formSchema: { sections: [], version: 1 },
      formulas: [],
      collectionPoints: [],
    },
    {
      id: 2, name: 'Crescendo 2024', year: 2024, matches: 112, scouts: 8, status: 'archived', created: '2024-01-06',
      fieldImage: null,
      formSchema: { sections: [], version: 1 },
      formulas: [],
      collectionPoints: [],
    },
  ],
  activity: [
    { text: 'Alex M. logged 22 scouting minutes — Match 38 vs Team 1114', time: '12 min ago' },
    { text: 'Casey R. submitted form for Team 254 — Qualification round', time: '38 min ago' },
    { text: 'Jordan D. flagged Team 973 data for review', time: '1 hr ago' },
  ],
  nextGameId: 3,
}

// ── Helpers ───────────────────────────────────────────────────
// Returns the initials of the imported name
function initials(n) {
  return (n || '').trim().split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() || '??'
}

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function sanitizeVarName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
}

function ensureFormulaModel(raw) {
  const label = raw?.label || raw?.name || raw?.varName || 'New Formula'
  const formula = raw?.formula || raw?.expression || ''
  const varName = sanitizeVarName(raw?.varName || raw?.outputVar || label) || `metric_${uid()}`
  return {
    id: raw?.id || uid(),
    label,
    varName,
    formula,
    description: raw?.description || '',
  }
}

// ── SVG Icons ─────────────────────────────────────────────────
// TODO: replace the remaining hardcoded SVG icons with FontAwesome icons
const Icon = ({ name, size = 16, color = 'currentColor' }) => {
  const icons = {
    dashboard: faHouse,
    games: faGamepad,
    account: faUser,
    matchdata: faPlay,
    analytics: faChartColumn,
    exports: faArrowUpFromBracket,
    settings: faGear,
    appmanager: faGrip,
    plus: faPlus,
    logout: faArrowRightFromBracket,
    sun: faSun,
    moon: faMoon,
    trophy: <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2z" /></>,
    check: <polyline points="20,6 9,17 4,12" />,
    trash: <><polyline points="3,6 5,6 21,6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>,
    external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15,3 21,3 21,9" /><line x1="10" y1="14" x2="21" y2="3" /></>,
    activity: <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />,
    flag: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" /></>,
    dot: <circle cx="12" cy="12" r="4" fill="currentColor" />,
    x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17,21 17,13 7,13" /><polyline points="7,3 7,8 15,8" /></>,
    formula: <><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>,
    map: <><polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2 1,6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7,10 12,15 17,10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17,8 12,3 7,8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
  }
  return (
    <FontAwesomeIcon
      icon={icons[name]}
      style={{ fontSize: size, color: color }}
    />
  )
}

// ── Theme tokens ──────────────────────────────────────────────
function tokens(dark) {
  return dark ? {
    bg: '#0a0a0a', 
    surface: '#111111', 
    surface2: '#181818',
    border: '#222222', 
    border2: '#2a2a2a',
    text: '#f0f0f0', 
    textMid: '#888888', 
    textDim: '#444444', 
    accent: '#f0f0f0',
    blue: '#3b82f6', 
    green: '#22c55e', 
    amber: '#f59e0b',
    red: '#ef4444', 
    purple: '#a78bfa',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #a78bfa 100%)',
  } : {
    bg: '#f5f5f4', 
    surface: '#ffffff', 
    surface2: '#fafaf9',
    border: '#e5e5e5', 
    border2: '#d4d4d4',
    text: '#111111', 
    textMid: '#737373', 
    textDim: '#a3a3a3', 
    accent: '#111111',
    blue: '#2563eb', 
    green: '#16a34a', 
    amber: '#d97706',
    red: '#dc2626', 
    purple: '#7c3aed',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
  }
}

// ── Nav config ────────────────────────────────────────────────
const NAV = [
  {
    section: 'Main', items: [
      { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
      { id: 'games', icon: 'games', label: 'Games' },
      { id: 'account', icon: 'account', label: 'Team & Accounts' },
    ]
  },
  {
    section: 'Scouting', items: [
      { id: 'matchdata', icon: 'matchdata', label: 'Match Data' },
      { id: 'analytics', icon: 'analytics', label: 'Analytics' },
      { id: 'exports', icon: 'exports', label: 'Exports' },
    ]
  },
  {
    section: 'Config', items: [
      { id: 'settings', icon: 'settings', label: 'Settings' },
      { id: 'appmanager', icon: 'appmanager', label: 'App Manager' },
    ]
  },
]

// ── Reusable UI ───────────────────────────────────────────────
function Clock({ t }) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), 1000)
    return () => clearInterval(id)
  }, [])
  return <span style={{ fontSize: '12px', color: t.textDim, fontVariantNumeric: 'tabular-nums' }}>{time}</span>
}

function Avatar({ name, size = 28, t }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: t.gradient, color: '#fff', fontSize: size * 0.38, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, letterSpacing: '-0.02em' }}>
      {initials(name)}
    </div>
  )
}

function Toggle({ on, onChange, t }) {
  return (
    <div onClick={() => onChange(!on)} style={{ position: 'relative', width: 38, height: 22, cursor: 'pointer', flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 99, background: on ? t.blue : t.border2, transition: 'background 0.2s', border: `1px solid ${on ? t.blue : t.border}` }} />
      <div style={{ position: 'absolute', top: 3, left: on ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </div>
  )
}

function RoleBadge({ role, t }) {
  const styles = {
    lead: { bg: `${t.blue}22`, color: t.blue },
    coach: { bg: `${t.green}22`, color: t.green },
    assistant: { bg: `${t.purple}22`, color: t.purple },
    scouter: { bg: t.surface2, color: t.textMid },
  }
  const s = styles[role] || styles.scouter
  return <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 9px', borderRadius: 99, background: s.bg, color: s.color }}>{ROLE_LABELS[role] || role}</span>
}

function ScoutRow({ m, t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${t.border}` }}>
      <Avatar name={m.name} size={26} t={t} />
      <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: t.text }}>{m.name}</div>
      <div style={{ fontSize: 12, color: t.textDim, marginRight: 4 }}>{m.mins} min</div>
      <RoleBadge role={m.role} t={t} />
    </div>
  )
}

function ActRow({ a, t }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: `1px solid ${t.border}` }}>
      <div style={{ marginTop: 5, flexShrink: 0 }}><Icon name="dot" size={8} color={t.blue} /></div>
      <div>
        <div style={{ fontSize: 12.5, color: t.textMid, lineHeight: 1.5 }}>{a.text}</div>
        <div style={{ fontSize: 11, color: t.textDim, marginTop: 2 }}>{a.time}</div>
      </div>
    </div>
  )
}

function Panel({ title, action, onAction, children, t, style = {} }) {
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.border}`, background: t.surface, ...style }}>
      <div style={{ padding: '12px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{title}</span>
        {action && <span style={{ fontSize: 12, color: t.blue, cursor: 'pointer', fontWeight: 500 }} onClick={onAction}>{action}</span>}
      </div>
      <div style={{ padding: '4px 18px 10px' }}>{children}</div>
    </div>
  )
}

function MetricCard({ label, value, sub, subColor, t }) {
  return (
    <div style={{ borderRadius: 12, padding: '16px 18px', background: t.surface, border: `1px solid ${t.border}` }}>
      <div style={{ fontSize: 11, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: t.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: subColor || t.textDim, marginTop: 6 }}>{sub}</div>
    </div>
  )
}

// ── Form Builder (React) ──────────────────────────────────────
// TODO: Changed to FontAwsome icons
const FIELD_TYPES = [
  { type: 'counter', icon: '🔢', name: 'Counter', desc: '+/− integer value', color: '#3b82f6' },
  { type: 'slider', icon: '🎚', name: 'Slider', desc: 'Range with min/max', color: '#22c55e' },
  { type: 'rating', icon: '⭐', name: 'Star Rating', desc: '1–5 star scale', color: '#f59e0b' },
  { type: 'toggle', icon: '🔘', name: 'Toggle', desc: 'Boolean yes/no', color: '#a78bfa' },
  { type: 'text', icon: '📝', name: 'Text Area', desc: 'Free-form notes', color: '#f97316' },
  { type: 'dropdown', icon: '▾', name: 'Dropdown', desc: 'Select one option', color: '#06b6d4' },
  { type: 'checkboxes', icon: '☑', name: 'Checkboxes', desc: 'Multi-select chips', color: '#22c55e' },
  { type: 'button', icon: '⬡', name: 'Button Group', desc: 'Tap to log events', color: '#f43f5e' },
]

function mkField(type) {
  const base = { id: uid(), type, varName: `new_${type}`, label: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`, required: false, adminFillable: true, displayInTable: true, useForTraining: false }
  switch (type) {
    case 'counter': return { ...base, min: 0, max: 10, step: 1, color: 'blue' }
    case 'slider': return { ...base, min: 0, max: 10, step: 1 }
    case 'toggle': return { ...base, onLabel: 'Yes', offLabel: 'No' }
    case 'text': return { ...base, placeholder: 'Enter notes…', rows: 3 }
    case 'dropdown': return { ...base, options: ['Option A', 'Option B'] }
    case 'checkboxes': return { ...base, options: ['Option A', 'Option B', 'Option C'] }
    case 'button': return { ...base, buttons: [{ label: 'Scored', color: 'blue' }, { label: 'Missed', color: 'red' }], logEvents: true }
    case 'rating': return { ...base, max: 5 }
    default: return base
  }
}

// TODO: Convert to fontawsome icons
function FieldInspector({ field, secId, sections, onUpdate, onUpdateSection, t }) {
  if (!field) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: t.textDim, gap: 10 }}>
      <div style={{ fontSize: 32, opacity: 0.3 }}>⚙</div>
      <div style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>Click any field to<br />edit its properties</div>
    </div>
  )

  const inp = (style = {}) => ({
    width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 8,
    border: `1px solid ${t.border2}`, background: t.surface2, color: t.text,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', ...style
  })
  const lbl = { fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.textDim, marginBottom: 3, display: 'block' }

  const upd = (k, v) => onUpdate(field.id, k, v)

  const COLORS = ['blue', 'green', 'purple', 'pink', 'orange', 'red', 'yellow', 'teal']
  const COLOR_HEX = { blue: '#3b82f6', green: '#22c55e', purple: '#a78bfa', pink: '#f43f5e', orange: '#f97316', red: '#ef4444', yellow: '#eab308', teal: '#06b6d4' }

  const divider = <div style={{ height: 1, background: t.border, margin: '12px 0' }} />

  function TypeOptions() {
    switch (field.type) {
      case 'counter': return (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div><label style={lbl}>Min</label><input style={inp()} type="number" value={field.min ?? 0} onChange={e => upd('min', +e.target.value)} /></div>
            <div><label style={lbl}>Max</label><input style={inp()} type="number" value={field.max ?? 10} onChange={e => upd('max', +e.target.value)} /></div>
          </div>
          <div><label style={lbl}>Step</label><input style={inp()} type="number" value={field.step ?? 1} min={1} onChange={e => upd('step', +e.target.value)} /></div>
          <div style={{ marginTop: 8 }}>
            <label style={lbl}>Color</label>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {COLORS.map(c => <div key={c} onClick={() => upd('color', c)} style={{ width: 20, height: 20, borderRadius: '50%', background: COLOR_HEX[c], cursor: 'pointer', border: field.color === c ? '2px solid white' : '2px solid transparent', outline: field.color === c ? `2px solid ${COLOR_HEX[c]}` : 'none' }} />)}
            </div>
          </div>
        </div>
      )
      case 'slider': return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><label style={lbl}>Min</label><input style={inp()} type="number" value={field.min ?? 0} onChange={e => upd('min', +e.target.value)} /></div>
          <div><label style={lbl}>Max</label><input style={inp()} type="number" value={field.max ?? 10} onChange={e => upd('max', +e.target.value)} /></div>
        </div>
      )
      case 'toggle': return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><label style={lbl}>ON label</label><input style={inp()} value={field.onLabel ?? 'Yes'} onChange={e => upd('onLabel', e.target.value)} /></div>
          <div><label style={lbl}>OFF label</label><input style={inp()} value={field.offLabel ?? 'No'} onChange={e => upd('offLabel', e.target.value)} /></div>
        </div>
      )
      case 'text': return (
        <div>
          <div style={{ marginBottom: 8 }}><label style={lbl}>Placeholder</label><input style={inp()} value={field.placeholder ?? ''} onChange={e => upd('placeholder', e.target.value)} /></div>
          <div><label style={lbl}>Rows</label><input style={inp()} type="number" min={1} max={10} value={field.rows ?? 3} onChange={e => upd('rows', +e.target.value)} /></div>
        </div>
      )
      case 'dropdown':
      case 'checkboxes': return (
        <div>
          <label style={lbl}>Options</label>
          {(field.options || []).map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
              <input style={inp({ flex: 1 })} value={o} onChange={e => { const opts = [...field.options]; opts[i] = e.target.value; upd('options', opts) }} />
              <button onClick={() => upd('options', field.options.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: t.red, cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>✕</button>
            </div>
          ))}
          <button onClick={() => upd('options', [...(field.options || []), 'New Option'])} style={{ fontSize: 11, color: t.blue, background: 'none', border: `1px dashed ${t.border2}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', marginTop: 2 }}>+ Add Option</button>
        </div>
      )
      case 'button': return (
        <div>
          <label style={lbl}>Buttons</label>
          {(field.buttons || []).map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 5, alignItems: 'center' }}>
              <input style={inp({ flex: 1 })} value={b.label} onChange={e => { const btns = field.buttons.map((x, j) => j === i ? { ...x, label: e.target.value } : x); upd('buttons', btns) }} />
              <select style={inp({ width: 70, flex: 'none' })} value={b.color} onChange={e => { const btns = field.buttons.map((x, j) => j === i ? { ...x, color: e.target.value } : x); upd('buttons', btns) }}>
                {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={() => upd('buttons', field.buttons.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: t.red, cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>✕</button>
            </div>
          ))}
          <button onClick={() => upd('buttons', [...(field.buttons || []), { label: 'New Button', color: 'blue' }])} style={{ fontSize: 11, color: t.blue, background: 'none', border: `1px dashed ${t.border2}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', marginTop: 2 }}>+ Add Button</button>
        </div>
      )
      case 'rating': return (
        <div><label style={lbl}>Max Stars</label><input style={inp()} type="number" min={1} max={10} value={field.max ?? 5} onChange={e => upd('max', +e.target.value)} /></div>
      )
      default: return null
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={lbl}>Field Label</label>
        <input style={inp()} value={field.label} onChange={e => upd('label', e.target.value)} />
      </div>
      <div>
        <label style={lbl}>Variable Name</label>
        <input style={{ ...inp(), fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: t.green }} value={field.varName} onChange={e => upd('varName', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} />
      </div>
      <div>
        <label style={lbl}>Section</label>
        <select style={inp()} value={secId} onChange={e => onUpdateSection(field.id, secId, e.target.value)}>
          {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {divider}
      <TypeOptions />
      {divider}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: t.textMid }}>Required field</span>
          <Toggle on={!!field.required} onChange={v => upd('required', v)} t={t} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: t.textMid }}>Admin can fill remotely</span>
          <Toggle on={field.adminFillable !== false} onChange={v => upd('adminFillable', v)} t={t} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: t.textMid }}>Display in tables</span>
          <Toggle on={field.displayInTable !== false} onChange={v => upd('displayInTable', v)} t={t} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: t.textMid }}>Use for ML training</span>
          <Toggle on={!!field.useForTraining} onChange={v => upd('useForTraining', v)} t={t} />
        </div>
      </div>
    </div>
  )
}

function FormBuilder({ schema, onSchemaChange, t }) {
  const [sections, setSections] = useState(schema?.sections || [])
  const [selectedId, setSelectedId] = useState(null) // { fieldId, secId }
  //const [activeTab, setActiveTab] = useState('fields')

  useEffect(() => {
    if (schema?.sections) setSections(schema.sections)
  }, [schema])

  function emit(newSections) {
    setSections(newSections)
    onSchemaChange({ ...schema, sections: newSections, version: (schema?.version || 1) + 1 })
  }

  const selectedField = selectedId ? (() => {
    for (const s of sections) { const f = s.fields.find(f => f.id === selectedId.fieldId); if (f) return f }
    return null
  })() : null

  function addSection() {
    emit([...sections, { id: uid(), name: 'New Section', collapsed: false, fields: [] }])
  }

  function updateSection(secId, key, val) {
    emit(sections.map(s => s.id === secId ? { ...s, [key]: val } : s))
  }

  function deleteSection(secId) {
    emit(sections.filter(s => s.id !== secId))
  }

  function addField(type) {
    if (sections.length === 0) {
      const newSec = { id: uid(), name: 'Section 1', collapsed: false, fields: [mkField(type)] }
      const f = newSec.fields[0]
      emit([newSec])
      setSelectedId({ fieldId: f.id, secId: newSec.id })
      return
    }
    const last = sections[sections.length - 1]
    const f = mkField(type)
    emit(sections.map(s => s.id === last.id ? { ...s, fields: [...s.fields, f] } : s))
    setSelectedId({ fieldId: f.id, secId: last.id })
  }

  function updateField(fieldId, key, val) {
    emit(sections.map(s => ({ ...s, fields: s.fields.map(f => f.id === fieldId ? { ...f, [key]: val } : f) })))
  }

  function deleteField(fieldId) {
    emit(sections.map(s => ({ ...s, fields: s.fields.filter(f => f.id !== fieldId) })))
    if (selectedId?.fieldId === fieldId) setSelectedId(null)
  }

  function moveFieldSection(fieldId, fromSecId, toSecId) {
    if (fromSecId === toSecId) return
    let movedField = null
    const newSecs = sections.map(s => {
      if (s.id === fromSecId) { movedField = s.fields.find(f => f.id === fieldId); return { ...s, fields: s.fields.filter(f => f.id !== fieldId) } }
      if (s.id === toSecId && movedField) return { ...s, fields: [...s.fields, movedField] }
      return s
    })
    emit(newSecs)
    setSelectedId({ fieldId, secId: toSecId })
  }

  const typeColors = { counter: '#3b82f6', slider: '#22c55e', rating: '#f59e0b', toggle: '#a78bfa', text: '#f97316', dropdown: '#06b6d4', checkboxes: '#22c55e', button: '#f43f5e' }

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      {/* Left palette */}
      <div style={{ width: 200, flexShrink: 0, borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '10px 12px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textDim }}>Field Types</div>
        <div style={{ padding: '0 8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {FIELD_TYPES.map(ft => (
            <div key={ft.type} onClick={() => addField(ft.type)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 9, background: t.surface2, border: `1px solid ${t.border}`, cursor: 'pointer', transition: 'all 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = t.border2}
              onMouseLeave={e => e.currentTarget.style.borderColor = t.border}
            >
              <div style={{ width: 28, height: 28, borderRadius: 7, background: ft.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{ft.icon}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{ft.name}</div>
                <div style={{ fontSize: 10, color: t.textDim }}>{ft.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Center canvas */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {sections.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: t.textDim, gap: 8 }}>
            <div style={{ fontSize: 28, opacity: 0.3 }}>📋</div>
            <div style={{ fontSize: 13 }}>Click a field type to add it</div>
          </div>
        )}
        {sections.map(sec => (
          <div key={sec.id} style={{ marginBottom: 16, borderRadius: 10, border: `1px solid ${t.border}`, overflow: 'hidden', background: t.surface }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: `1px solid ${t.border}`, background: t.surface2 }}>
              <input
                value={sec.name}
                onChange={e => updateSection(sec.id, 'name', e.target.value)}
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: t.textMid, fontFamily: 'inherit' }}
              />
              <span style={{ fontSize: 11, color: t.textDim }}>{sec.fields.length} field{sec.fields.length !== 1 ? 's' : ''}</span>
              <button onClick={() => updateSection(sec.id, 'collapsed', !sec.collapsed)} style={{ background: 'none', border: 'none', color: t.textDim, cursor: 'pointer', fontSize: 13, padding: '0 4px', transform: sec.collapsed ? 'rotate(-90deg)' : 'none' }}>▾</button>
              <button onClick={() => deleteSection(sec.id)} style={{ background: 'none', border: 'none', color: t.textDim, cursor: 'pointer', fontSize: 13, padding: '0 4px' }}>✕</button>
            </div>
            {!sec.collapsed && (
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 48 }}>
                {sec.fields.length === 0 && <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: t.textDim, borderRadius: 8, border: `1px dashed ${t.border2}` }}>No fields yet — click a type to add</div>}
                {sec.fields.map(f => {
                  const isSelected = selectedId?.fieldId === f.id
                  const typeColor = typeColors[f.type] || t.blue
                  return (
                    <div key={f.id} onClick={() => setSelectedId({ fieldId: f.id, secId: sec.id })}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, border: `1px solid ${isSelected ? t.blue : t.border}`, background: isSelected ? `${t.blue}12` : t.surface2, cursor: 'pointer', transition: 'all 0.1s' }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: typeColor + '22', color: typeColor, flexShrink: 0 }}>{f.type}</span>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: t.text }}>{f.label}</span>
                      <span style={{ fontSize: 10, color: t.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{f.varName}</span>
                      <button onClick={e => { e.stopPropagation(); deleteField(f.id) }} style={{ background: 'none', border: 'none', color: t.textDim, cursor: 'pointer', fontSize: 13, padding: '0 2px', opacity: 0.5 }}>✕</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
        <button onClick={addSection} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 99, background: 'none', border: `1px dashed ${t.border2}`, color: t.textMid, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', margin: '4px auto' }}>
          + Add Section
        </button>
      </div>

      {/* Right inspector */}
      <div style={{ width: 220, flexShrink: 0, borderLeft: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${t.border}`, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textDim }}>Field Inspector</div>
        <FieldInspector field={selectedField} secId={selectedId?.secId} sections={sections} onUpdate={updateField} onUpdateSection={moveFieldSection} t={t} />
      </div>
    </div>
  )
}

// ── Collection Points editor ──────────────────────────────────
function CollectionPointsEditor({ points, onChange, t }) {
  const [form, setForm] = useState({ name: '', description: '', pointValue: '' })
  const inp = { padding: '7px 10px', fontSize: 12, borderRadius: 8, border: `1px solid ${t.border2}`, background: t.surface2, color: t.text, fontFamily: 'inherit', outline: 'none' }

  function add() {
    if (!form.name || !form.pointValue) return
    onChange([...points, { id: uid(), name: form.name, description: form.description, pointValue: Number(form.pointValue) }])
    setForm({ name: '', description: '', pointValue: '' })
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input style={inp} placeholder="Point name (e.g. Coral High)" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <input style={inp} placeholder="Description (optional)" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        <input style={{ ...inp, width: 80 }} type="number" placeholder="Points" value={form.pointValue} onChange={e => setForm(p => ({ ...p, pointValue: e.target.value }))} />
        <button onClick={add} style={{ padding: '7px 14px', background: t.blue, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>+ Add</button>
      </div>
      {points.length === 0 && <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: t.textDim, border: `1px dashed ${t.border2}`, borderRadius: 8 }}>No collection points yet. Define what actions score points in matches.</div>}
      {points.map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, background: t.surface2, border: `1px solid ${t.border}`, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{p.name}</div>
            {p.description && <div style={{ fontSize: 11.5, color: t.textDim, marginTop: 2 }}>{p.description}</div>}
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: `${t.green}22`, color: t.green }}>{p.pointValue > 0 ? '+' : ''}{p.pointValue} pts</span>
          <button onClick={() => onChange(points.filter(x => x.id !== p.id))} style={{ background: 'none', border: 'none', color: t.red, cursor: 'pointer', fontSize: 14, padding: '0 4px', opacity: 0.7 }}>✕</button>
        </div>
      ))}
    </div>
  )
}

// ── Field Scouting Editor ─────────────────────────────────────
const FS_COLORS_FS = ['blue', 'green', 'purple', 'pink', 'orange', 'teal', 'red', 'yellow', 'gray']
const FS_COLOR_HEX_FS = { blue: '#3b82f6', green: '#22c55e', purple: '#a78bfa', pink: '#f43f5e', orange: '#f97316', teal: '#06b6d4', red: '#ef4444', yellow: '#eab308', gray: '#6b7280' }
// TODO: Convert to fontawsome icons if possible
const FS_ICONS_FS = {
  'Arrows': ['⬆', '⬇', '⬅', '➡', '↗', '↘', '↙', '↖', '↑', '↓', '←', '→', '⟳', '⟲', '↺', '↻'],
  'Game': ['🎯', '🏆', '⭐', '💥', '🔥', '⚡', '✅', '❌', '🚀', '🎮', '🏅', '🎖', '⚽', '🏀', '🏈', '🎱'],
  'Shapes': ['●', '◆', '▲', '■', '★', '♦', '♠', '♣', '♥', '⬟', '⬠', '⬡', '▶', '◀', '▼', '△'],
  'Field': ['🤖', '🔧', '🔩', '⚙', '🛠', '📡', '🔋', '💡', '🔌', '🏗', '🏭', '🔲', '📍', '🗺', '🧲', '📏'],
  'Status': ['✓', '✗', '!', '?', '1', '2', '3', 'A', 'B', 'C', '→', '⊕', '⊖', '⊗', '⊘', '⊙'],
}

function fsUID() { return 'fs' + Math.random().toString(36).slice(2, 8) }

function FieldScoutingEditor({ fieldSchema, onChange, initialImage, t }) {
  const [schema, setSchema] = useState(() => {
    if (fieldSchema && fieldSchema.zones) return fieldSchema
    return { imageDataUrl: initialImage || null, imageW: 0, imageH: 0, zones: [], buttons: [] }
  })
  const [selectedZoneId, setSelectedZoneId] = useState(null)
  const [selectedBtnId, setSelectedBtnId] = useState(null)
  const [dragState, setDragState] = useState(null)
  const [iconPickerOpen, setIconPickerOpen] = useState(null)
  const imgRef = useRef(null)
  const overlayRef = useRef(null)
  const fileRef = useRef(null)
  const dragRef = useRef(null)

  // Sync schema up
  useEffect(() => { onChange(schema) }, [schema])

  // Seed field image from game if not already set
  useEffect(() => {
    if (initialImage && !schema.imageDataUrl) {
      setSchema(s => ({ ...s, imageDataUrl: initialImage }))
    }
  }, [initialImage])

  function handleImage(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target.result
      const img = new Image()
      img.onload = () => setSchema(s => ({ ...s, imageDataUrl: dataUrl, imageW: img.naturalWidth, imageH: img.naturalHeight }))
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  function addZone() {
    const order = schema.zones.length
    const id = fsUID()
    const newZone = { id, name: 'Zone ' + (order + 1), x: 0.1 + order * 0.05, y: 0.1 + order * 0.04, w: 0.3, h: 0.3, color: FS_COLORS_FS[order % FS_COLORS_FS.length], order }
    setSchema(s => ({ ...s, zones: [...s.zones, newZone] }))
    setSelectedZoneId(id); setSelectedBtnId(null)
  }

  function addButton(zoneId) {
    const zid = zoneId || (schema.zones[0]?.id)
    if (!zid) return
    const zone = schema.zones.find(z => z.id === zid)
    const id = fsUID()
    const newBtn = { id, zoneId: zid, label: 'Button', color: 'blue', action: 'log', logLabel: 'Event logged', nextZoneId: null, icon: '', x: zone ? zone.x + zone.w / 2 : 0.5, y: zone ? zone.y + zone.h / 2 : 0.5 }
    setSchema(s => ({ ...s, buttons: [...s.buttons, newBtn] }))
    setSelectedBtnId(id); setSelectedZoneId(null)
  }

  function deleteZone(id) {
    setSchema(s => ({ ...s, zones: s.zones.filter(z => z.id !== id), buttons: s.buttons.filter(b => b.zoneId !== id) }))
    if (selectedZoneId === id) { setSelectedZoneId(null); setSelectedBtnId(null) }
  }

  function deleteButton(id) {
    setSchema(s => ({ ...s, buttons: s.buttons.filter(b => b.id !== id) }))
    if (selectedBtnId === id) setSelectedBtnId(null)
  }

  function patchZone(id, key, val) { setSchema(s => ({ ...s, zones: s.zones.map(z => z.id === id ? { ...z, [key]: val } : z) })) }
  function patchBtn(id, key, val) { setSchema(s => ({ ...s, buttons: s.buttons.map(b => b.id === id ? { ...b, [key]: val } : b) })) }

  // Mouse drag for zones/buttons
  // Is this really needed?
  const onZoneMouseDown = useCallback((e, id, type) => {
    if (e.target.dataset.action) return
    e.preventDefault()
    const zone = schema.zones.find(z => z.id === id)
    const rect = imgRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = { type, id, startX: e.clientX, startY: e.clientY, iw: rect.width, ih: rect.height, origX: zone.x, origY: zone.y, origW: zone.w, origH: zone.h }
    setSelectedZoneId(id); setSelectedBtnId(null)
  }, [schema])

  const onBtnMouseDown = useCallback((e, id) => {
    e.preventDefault(); e.stopPropagation()
    const btn = schema.buttons.find(b => b.id === id)
    const rect = imgRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = { type: 'btn', id, startX: e.clientX, startY: e.clientY, iw: rect.width, ih: rect.height, origX: btn.x, origY: btn.y }
    setSelectedBtnId(id); setSelectedZoneId(null)
  }, [schema])

  useEffect(() => {
    function onMove(e) {
      const d = dragRef.current; if (!d) return
      const dx = (e.clientX - d.startX) / d.iw
      const dy = (e.clientY - d.startY) / d.ih
      if (d.type === 'zone-move') {
        patchZone(d.id, 'x', Math.max(0, Math.min(1 - (schema.zones.find(z => z.id === d.id)?.w || 0.3), d.origX + dx)))
        patchZone(d.id, 'y', Math.max(0, Math.min(1 - (schema.zones.find(z => z.id === d.id)?.h || 0.3), d.origY + dy)))
      } else if (d.type === 'zone-resize') {
        const zone = schema.zones.find(z => z.id === d.id)
        patchZone(d.id, 'w', Math.max(0.05, Math.min(1 - (zone?.x || 0), d.origW + dx)))
        patchZone(d.id, 'h', Math.max(0.05, Math.min(1 - (zone?.y || 0), d.origH + dy)))
      } else if (d.type === 'btn') {
        patchBtn(d.id, 'x', Math.max(0, Math.min(1, d.origX + dx)))
        patchBtn(d.id, 'y', Math.max(0, Math.min(1, d.origY + dy)))
      }
    }
    function onUp() { dragRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [schema])

  const selectedZone = schema.zones.find(z => z.id === selectedZoneId)
  const selectedBtn = schema.buttons.find(b => b.id === selectedBtnId)

  const inp = { padding: '6px 9px', fontSize: 12, borderRadius: 7, border: `1px solid ${t.border2}`, background: t.surface2, color: t.text, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }
  const lbl = { fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.textDim, marginBottom: 3, display: 'block' }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>
      {/* Left panel */}
      <div style={{ width: 220, flexShrink: 0, borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}`, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textDim }}>Field Image</div>
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}` }}>
          <div onClick={() => fileRef.current.click()} style={{ border: `1.5px dashed ${t.border2}`, borderRadius: 9, padding: '10px 8px', textAlign: 'center', cursor: 'pointer', fontSize: 12, color: t.textMid }}>
            {schema.imageDataUrl ? '📷 Change image' : '📷 Upload field image'}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
        </div>
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textDim, marginBottom: 8 }}>Zones & Buttons</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={addZone} style={{ flex: 1, padding: '6px 0', background: `${t.blue}20`, border: `1px solid ${t.blue}40`, borderRadius: 8, fontSize: 12, color: t.blue, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>+ Zone</button>
            <button onClick={() => addButton(selectedZoneId || schema.zones[0]?.id)} disabled={!schema.zones.length} style={{ flex: 1, padding: '6px 0', background: schema.zones.length ? `${t.green}20` : t.surface2, border: `1px solid ${schema.zones.length ? t.green + '40' : t.border}`, borderRadius: 8, fontSize: 12, color: schema.zones.length ? t.green : t.textDim, cursor: schema.zones.length ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontWeight: 600 }}>+ Button</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {!schema.zones.length && !schema.buttons.length && (
            <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: t.textDim }}>Upload a field image,<br />then add zones.</div>
          )}
          {schema.zones.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: t.textDim, padding: '4px 4px 6px' }}>Zones</div>
              {schema.zones.map(z => (
                <div key={z.id} onClick={() => { setSelectedZoneId(z.id); setSelectedBtnId(null) }}
                  style={{ padding: '8px 10px', borderRadius: 9, background: selectedZoneId === z.id ? `${t.blue}15` : t.surface2, border: `1px solid ${selectedZoneId === z.id ? t.blue : t.border}`, cursor: 'pointer', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: FS_COLOR_HEX_FS[z.color], flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: t.text }}>{z.name}</div>
                  </div>
                  <div style={{ fontSize: 10, color: t.textDim, marginTop: 2 }}>{schema.buttons.filter(b => b.zoneId === z.id).length} buttons</div>
                </div>
              ))}
            </>
          )}
          {schema.buttons.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: t.textDim, padding: '8px 4px 6px' }}>Buttons</div>
              {schema.buttons.map(b => {
                const zone = schema.zones.find(z => z.id === b.zoneId)
                return (
                  <div key={b.id} onClick={() => { setSelectedBtnId(b.id); setSelectedZoneId(null) }}
                    style={{ padding: '8px 10px', borderRadius: 9, background: selectedBtnId === b.id ? `${t.blue}15` : t.surface2, border: `1px solid ${selectedBtnId === b.id ? t.blue : t.border}`, cursor: 'pointer', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: FS_COLOR_HEX_FS[b.color], flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: t.text }}>{b.icon && <span style={{ marginRight: 4 }}>{b.icon}</span>}{b.label}</div>
                    </div>
                    <div style={{ fontSize: 10, color: t.textDim, marginTop: 2 }}>{b.action}{zone ? ' · ' + zone.name : ''}</div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* Center canvas */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg, position: 'relative' }}>
        {!schema.imageDataUrl ? (
          <div style={{ textAlign: 'center', color: t.textDim, fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>🗺</div>
            Upload a field image to begin
          </div>
        ) : (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img ref={imgRef} src={schema.imageDataUrl} alt="Field" style={{ display: 'block', maxWidth: '100%', maxHeight: 'calc(100vh - 200px)', objectFit: 'contain' }} />
            <div ref={overlayRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {schema.zones.map(z => {
                const c = FS_COLOR_HEX_FS[z.color] || '#3b82f6'
                const sel = selectedZoneId === z.id
                return (
                  <div key={z.id} style={{ position: 'absolute', left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.w * 100}%`, height: `${z.h * 100}%`, border: `2px solid ${c}${sel ? '' : '99'}`, background: sel ? `${c}22` : `${c}11`, pointerEvents: 'all', cursor: 'move', boxSizing: 'border-box' }}
                    onMouseDown={e => { e.preventDefault(); setSelectedZoneId(z.id); setSelectedBtnId(null); const rect = imgRef.current?.getBoundingClientRect(); if (rect) dragRef.current = { type: 'zone-move', id: z.id, startX: e.clientX, startY: e.clientY, iw: rect.width, ih: rect.height, origX: z.x, origY: z.y, origW: z.w, origH: z.h } }}
                  >
                    <div style={{ position: 'absolute', top: 2, left: 4, fontSize: 10, fontWeight: 700, color: c, pointerEvents: 'none', userSelect: 'none' }}>{z.name}</div>
                    <div data-action="del" onClick={e => { e.stopPropagation(); deleteZone(z.id) }} style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: 4, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', pointerEvents: 'all' }}>✕</div>
                    <div data-action="resize" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); const rect = imgRef.current?.getBoundingClientRect(); if (rect) dragRef.current = { type: 'zone-resize', id: z.id, startX: e.clientX, startY: e.clientY, iw: rect.width, ih: rect.height, origX: z.x, origY: z.y, origW: z.w, origH: z.h } }} style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, cursor: 'se-resize', background: c, opacity: 0.8, pointerEvents: 'all' }} />
                  </div>
                )
              })}
              {schema.buttons.map(b => {
                const c = FS_COLOR_HEX_FS[b.color] || '#3b82f6'
                const sel = selectedBtnId === b.id
                return (
                  <div key={b.id} style={{ position: 'absolute', left: `${b.x * 100}%`, top: `${b.y * 100}%`, transform: 'translate(-50%,-50%)', background: `${c}cc`, border: `2px solid ${sel ? '#eab308' : 'rgba(255,255,255,0.3)'}`, borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 9px', cursor: 'move', whiteSpace: 'nowrap', pointerEvents: 'all', userSelect: 'none', boxShadow: sel ? `0 0 0 2px #eab308` : '0 2px 10px rgba(0,0,0,0.4)' }}
                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); const rect = imgRef.current?.getBoundingClientRect(); if (rect) dragRef.current = { type: 'btn', id: b.id, startX: e.clientX, startY: e.clientY, iw: rect.width, ih: rect.height, origX: b.x, origY: b.y }; setSelectedBtnId(b.id); setSelectedZoneId(null) }}
                    onClick={e => e.stopPropagation()}
                  >
                    {b.icon && <span style={{ marginRight: 4 }}>{b.icon}</span>}{b.label}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right inspector */}
      <div style={{ width: 240, flexShrink: 0, borderLeft: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}`, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textDim }}>
          {selectedZone ? 'Zone Properties' : selectedBtn ? 'Button Properties' : 'Inspector'}
        </div>
        {!selectedZone && !selectedBtn && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: t.textDim, gap: 8, padding: 20 }}>
            <div style={{ fontSize: 32, opacity: 0.3 }}>🗺</div>
            <div style={{ fontSize: 12, textAlign: 'center' }}>Select a zone or button<br />to edit its properties</div>
          </div>
        )}
        {selectedZone && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={lbl}>Zone Name</label>
              <input style={inp} value={selectedZone.name} onChange={e => patchZone(selectedZone.id, 'name', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Color</label>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {FS_COLORS_FS.map(c => <div key={c} onClick={() => patchZone(selectedZone.id, 'color', c)} style={{ width: 20, height: 20, borderRadius: '50%', background: FS_COLOR_HEX_FS[c], cursor: 'pointer', border: selectedZone.color === c ? '2px solid white' : '2px solid transparent', outline: selectedZone.color === c ? `2px solid ${FS_COLOR_HEX_FS[c]}` : 'none' }} />)}
              </div>
            </div>
            <div>
              <label style={lbl}>Buttons in this Zone</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {schema.buttons.filter(b => b.zoneId === selectedZone.id).map(b => (
                  <div key={b.id} onClick={() => { setSelectedBtnId(b.id); setSelectedZoneId(null) }} style={{ padding: '7px 10px', borderRadius: 8, background: t.surface2, border: `1px solid ${t.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: FS_COLOR_HEX_FS[b.color] }} />
                    <div style={{ flex: 1, fontSize: 12, color: t.text }}>{b.label}</div>
                    <div style={{ fontSize: 10, color: t.textDim }}>{b.action}</div>
                  </div>
                ))}
                {!schema.buttons.filter(b => b.zoneId === selectedZone.id).length && <div style={{ fontSize: 11, color: t.textDim }}>No buttons yet</div>}
              </div>
              <button onClick={() => addButton(selectedZone.id)} style={{ marginTop: 8, padding: '5px 10px', background: 'none', border: `1px dashed ${t.border2}`, borderRadius: 7, fontSize: 11, color: t.textMid, cursor: 'pointer', fontFamily: 'inherit' }}>＋ Add Button to Zone</button>
            </div>
            <div style={{ height: 1, background: t.border, margin: '4px 0' }} />
            <button onClick={() => deleteZone(selectedZone.id)} style={{ padding: '7px 10px', background: `${t.red}15`, border: `1px solid ${t.red}30`, borderRadius: 8, fontSize: 12, color: t.red, cursor: 'pointer', fontFamily: 'inherit' }}>🗑 Delete Zone</button>
          </div>
        )}
        {selectedBtn && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={lbl}>Button Label</label>
              <input style={inp} value={selectedBtn.label} onChange={e => patchBtn(selectedBtn.id, 'label', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Icon</label>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setIconPickerOpen(iconPickerOpen === selectedBtn.id ? null : selectedBtn.id)} style={{ ...inp, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, width: '100%' }}>
                  <span style={{ fontSize: 16 }}>{selectedBtn.icon || '🔘'}</span>
                  <span style={{ flex: 1, textAlign: 'left', color: t.textMid, fontSize: 12 }}>{selectedBtn.icon || 'No icon'}</span>
                  <span style={{ color: t.textDim, fontSize: 10 }}>▾</span>
                </button>
                {iconPickerOpen === selectedBtn.id && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 999, background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', padding: 8, maxHeight: 200, overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 2, marginBottom: 4 }}>
                      <div onClick={() => { patchBtn(selectedBtn.id, 'icon', ''); setIconPickerOpen(null) }} style={{ width: 28, height: 28, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: t.surface2, fontSize: 13 }}>∅</div>
                    </div>
                    {Object.entries(FS_ICONS_FS).map(([cat, icons]) => (
                      <div key={cat}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: t.textDim, margin: '6px 2px 3px' }}>{cat}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 2 }}>
                          {icons.map(ic => <div key={ic} onClick={() => { patchBtn(selectedBtn.id, 'icon', ic); setIconPickerOpen(null) }} style={{ width: 28, height: 28, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: selectedBtn.icon === ic ? `${t.blue}20` : t.surface2, fontSize: 16 }}>{ic}</div>)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label style={lbl}>Zone</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={selectedBtn.zoneId} onChange={e => patchBtn(selectedBtn.id, 'zoneId', e.target.value)}>
                {schema.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Color</label>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {FS_COLORS_FS.map(c => <div key={c} onClick={() => patchBtn(selectedBtn.id, 'color', c)} style={{ width: 20, height: 20, borderRadius: '50%', background: FS_COLOR_HEX_FS[c], cursor: 'pointer', border: selectedBtn.color === c ? '2px solid white' : '2px solid transparent', outline: selectedBtn.color === c ? `2px solid ${FS_COLOR_HEX_FS[c]}` : 'none' }} />)}
              </div>
            </div>
            <div>
              <label style={lbl}>Action when tapped</label>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {['log', 'score', 'advance'].map(act => (
                  <div key={act} onClick={() => patchBtn(selectedBtn.id, 'action', act)} style={{ padding: '4px 10px', borderRadius: 99, border: `1px solid ${selectedBtn.action === act ? t.blue : t.border2}`, background: selectedBtn.action === act ? `${t.blue}20` : t.surface2, fontSize: 11, fontWeight: 600, color: selectedBtn.action === act ? t.blue : t.textMid, cursor: 'pointer' }}>
                    {act === 'log' ? '📝 Log' : act === 'score' ? '🎯 Score' : '➡ Advance'}
                  </div>
                ))}
              </div>
            </div>
            {selectedBtn.action === 'log' && (
              <div>
                <label style={lbl}>Event label</label>
                <input style={inp} value={selectedBtn.logLabel || selectedBtn.label} onChange={e => patchBtn(selectedBtn.id, 'logLabel', e.target.value)} />
              </div>
            )}
            {selectedBtn.action === 'score' && (
              <div>
                <label style={lbl}>Score field (varName)</label>
                <input style={{ ...inp, fontFamily: "'JetBrains Mono', monospace", color: t.purple }} value={selectedBtn.scoreField || ''} onChange={e => patchBtn(selectedBtn.id, 'scoreField', e.target.value)} placeholder="e.g. auto_high" />
              </div>
            )}
            {(selectedBtn.action === 'advance' || selectedBtn.action === 'log') && schema.zones.length > 1 && (
              <div>
                <label style={lbl}>Next zone (optional)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {schema.zones.filter(z => z.id !== selectedBtn.zoneId).map(z => (
                    <div key={z.id} onClick={() => patchBtn(selectedBtn.id, 'nextZoneId', selectedBtn.nextZoneId === z.id ? null : z.id)} style={{ padding: '6px 10px', borderRadius: 8, background: selectedBtn.nextZoneId === z.id ? `${t.green}15` : t.surface2, border: `1px solid ${selectedBtn.nextZoneId === z.id ? t.green : t.border}`, cursor: 'pointer', fontSize: 12, color: selectedBtn.nextZoneId === z.id ? t.green : t.textMid }}>{z.name}</div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ height: 1, background: t.border, margin: '4px 0' }} />
            <button onClick={() => deleteButton(selectedBtn.id)} style={{ padding: '7px 10px', background: `${t.red}15`, border: `1px solid ${t.red}30`, borderRadius: 8, fontSize: 12, color: t.red, cursor: 'pointer', fontFamily: 'inherit' }}>🗑 Delete Button</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Formulas editor ───────────────────────────────────────────
function FormulasEditor({ formulas, collectionPoints, schema, onChange, t }) {
  const [form, setForm] = useState({ label: '', varName: '', formula: '', description: '' })
  const [activeSuggestion, setActiveSuggestion] = useState(0)
  const [query, setQuery] = useState('')
  const [wordStart, setWordStart] = useState(null)
  const textareaRef = useRef(null)
  const inp = { padding: '7px 10px', fontSize: 12, borderRadius: 8, border: `1px solid ${t.border2}`, background: t.surface2, color: t.text, fontFamily: 'inherit', outline: 'none' }

  const schemaVars = (schema?.sections || []).flatMap(s => (s.fields || []).map(f => f.varName)).filter(Boolean)
  const pointVars = (collectionPoints || []).map(p => sanitizeVarName(p.name)).filter(Boolean)
  const formulaVars = (formulas || []).map(f => f.varName).filter(Boolean)
  const allVars = [...new Set([...schemaVars, ...pointVars, ...formulaVars])]

  const matches = query
    ? allVars.filter(v => v.startsWith(query.toLowerCase())).slice(0, 8)
    : []

  useEffect(() => {
    if (activeSuggestion >= matches.length) setActiveSuggestion(0)
  }, [matches.length, activeSuggestion])

  function updateComposerFormula(nextFormula, caretPos) {
    setForm(p => ({ ...p, formula: nextFormula }))
    const left = nextFormula.slice(0, caretPos)
    const match = left.match(/[a-zA-Z_][a-zA-Z0-9_]*$/)
    if (!match) {
      setQuery('')
      setWordStart(null)
      return
    }
    setQuery(match[0].toLowerCase())
    setWordStart(caretPos - match[0].length)
  }

  function insertSuggestion(varName) {
    const ta = textareaRef.current
    if (!ta || wordStart == null) return
    const start = wordStart
    const end = ta.selectionStart
    const next = form.formula.slice(0, start) + varName + form.formula.slice(end)
    const nextCaret = start + varName.length
    setForm(p => ({ ...p, formula: next }))
    setQuery('')
    setWordStart(null)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(nextCaret, nextCaret)
    })
  }

  function add() {
    const cleanVar = sanitizeVarName(form.varName || form.label)
    if (!form.label.trim() || !cleanVar || !form.formula.trim()) return
    onChange([...formulas, {
      id: uid(),
      label: form.label.trim(),
      varName: cleanVar,
      formula: form.formula.trim(),
      description: form.description.trim(),
    }])
    setForm({ label: '', varName: '', formula: '', description: '' })
    setQuery('')
    setWordStart(null)
  }

  return (
    <div>
      <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 9, background: `${t.blue}12`, border: `1px solid ${t.blue}30` }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: t.blue, marginBottom: 4 }}>Detected variables from form + points + formulas</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {allVars.length === 0 && <span style={{ fontSize: 11, color: t.textDim }}>None yet - add form fields or collection points first</span>}
          {allVars.map(v => <code key={v} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: t.surface2, border: `1px solid ${t.border2}`, color: t.green, fontFamily: "'JetBrains Mono', monospace" }}>{v}</code>)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <input style={inp} placeholder="Formula label (e.g. Auto Score)" value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value, varName: p.varName || sanitizeVarName(e.target.value) }))} />
        <input style={{ ...inp, fontFamily: "'JetBrains Mono', monospace", color: t.green }} placeholder="Output variable (e.g. auto_score)" value={form.varName} onChange={e => setForm(p => ({ ...p, varName: sanitizeVarName(e.target.value) }))} />
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: t.textDim, marginBottom: 6 }}>Equation editor</div>
        <div style={{ position: 'relative' }}>
          <textarea
            ref={textareaRef}
            style={{ ...inp, width: '100%', minHeight: 96, resize: 'vertical', fontFamily: "'JetBrains Mono', monospace", color: t.purple, lineHeight: 1.5 }}
            placeholder={'Type equation... Example:\n(auto_high * 4) + (tele_cubes * 2)'}
            value={form.formula}
            onChange={e => updateComposerFormula(e.target.value, e.target.selectionStart)}
            onClick={e => updateComposerFormula(form.formula, e.target.selectionStart)}
            onKeyUp={e => updateComposerFormula(form.formula, e.currentTarget.selectionStart)}
            onKeyDown={e => {
              if (!matches.length) return
              if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSuggestion(i => (i + 1) % matches.length) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSuggestion(i => (i - 1 + matches.length) % matches.length) }
              else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertSuggestion(matches[activeSuggestion]) }
              else if (e.key === 'Escape') { setQuery(''); setWordStart(null) }
            }}
          />
          {matches.length > 0 && (
            <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.25)', overflow: 'hidden', maxHeight: 180, overflowY: 'auto' }}>
              {matches.map((m, idx) => (
                <div
                  key={m}
                  onMouseDown={e => { e.preventDefault(); insertSuggestion(m) }}
                  style={{ padding: '6px 10px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: idx === activeSuggestion ? t.blue : t.textMid, background: idx === activeSuggestion ? `${t.blue}14` : 'transparent', cursor: 'pointer' }}
                >
                  {m}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input style={{ ...inp, flex: 1 }} placeholder="Description (optional)" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        <button onClick={add} style={{ padding: '7px 14px', background: t.purple, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>+ Add Formula</button>
      </div>

      {formulas.length === 0 && <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: t.textDim, border: `1px dashed ${t.border2}`, borderRadius: 8 }}>No formulas yet. Build scoring calculations from your configured form fields.</div>}
      {formulas.map(f => (
        <div key={f.id} style={{ padding: '10px 12px', borderRadius: 9, background: t.surface2, border: `1px solid ${t.border}`, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: f.description ? 4 : 0 }}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: t.text }}>{f.label}</div>
            <code style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: t.green, background: `${t.green}15`, padding: '2px 8px', borderRadius: 5 }}>{f.varName}</code>
            <button onClick={() => onChange(formulas.filter(x => x.id !== f.id))} style={{ background: 'none', border: 'none', color: t.red, cursor: 'pointer', fontSize: 14, padding: '0 4px', opacity: 0.7 }}>✕</button>
          </div>
          <code style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: t.purple, display: 'block', marginBottom: f.description ? 4 : 0 }}>{f.formula}</code>
          {f.description && <div style={{ fontSize: 11.5, color: t.textDim }}>{f.description}</div>}
        </div>
      ))}
    </div>
  )
}

// ── Game Editor (fullscreen) ──────────────────────────────────
function GameEditor({ game, onClose, onSave, t }) {
  const { isBackend, backendUrl } = useBackend()
  const [tab, setTab] = useState('form')
  const [schema, setSchema] = useState(game.formSchema || { sections: [], version: 1 })
  const [formulas, setFormulas] = useState((game.formulas || []).map(ensureFormulaModel))
  const [collectionPoints, setCollectionPoints] = useState(game.collectionPoints || [])
  const [fieldImage, setFieldImage] = useState(game.fieldImage || null)
  const [fieldSchema, setFieldSchema] = useState(game.fieldSchema || { imageDataUrl: game.fieldImage || null, imageW: 0, imageH: 0, zones: [], buttons: [] })
  const [saved, setSaved] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)

  async function handleSave() {
    const imgUrl = fieldSchema.imageDataUrl || fieldImage
    const updatedGame = { ...game, formSchema: schema, formulas, collectionPoints, fieldImage: imgUrl, fieldSchema: { ...fieldSchema, imageDataUrl: imgUrl } }
    onSave(updatedGame)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
    if (isBackend) {
      try {
        const flatFields = schema.sections.flatMap(s => s.fields.map(f => ({
          varName: f.varName, label: f.label, type: f.type,
          min: f.min, max: f.max, step: f.step, group: s.name,
          options: f.options, onLabel: f.onLabel, offLabel: f.offLabel,
          displayInTable: f.displayInTable !== false,
          useForTraining: !!f.useForTraining,
        })))
        const backendEquations = formulas.map(f => ({
          id: f.id,
          varName: f.varName,
          label: f.label,
          formula: f.formula,
        }))
        await apiFetch(backendUrl, '/api/sync', {
          method: 'POST',
          body: JSON.stringify({
            schema: { version: schema.version, fields: flatFields },
            equations: backendEquations,
            fieldSchema: { ...fieldSchema, imageDataUrl: imgUrl },
          })
        })
        setSyncMsg('✓ Synced to RPi'); setTimeout(() => setSyncMsg(null), 3000)
      } catch (e) {
        setSyncMsg('⚠ Sync failed: ' + e.message); setTimeout(() => setSyncMsg(null), 4000)
      }
    }
  }

  const tabs = [
    { id: 'form', label: '📋 Form Fields' },
    { id: 'field', label: '🗺 Field Scouting' },
    { id: 'points', label: '🎯 Collection Points' },
    { id: 'formula', label: '⚖ Formulas' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: t.bg, zIndex: 700, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${t.border}`, background: t.surface, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: t.surface2, border: `1px solid ${t.border2}`, borderRadius: 9, fontSize: 12, color: t.textMid, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Icon name="x" size={13} color={t.textMid} /> Close
        </button>
        <div style={{ width: 1, height: 24, background: t.border }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontFamily: "'Instrument Serif', serif", color: t.text }}>{game.name}</div>
          <div style={{ fontSize: 11.5, color: t.textMid }}>Game editor — season {game.year}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {saved && <span style={{ fontSize: 12, color: t.green, display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="check" size={13} color={t.green} /> Saved</span>}
          {syncMsg && <span style={{ fontSize: 12, color: syncMsg.startsWith('⚠') ? t.amber : t.green }}>{syncMsg}</span>}
          <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: t.blue, color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Icon name="save" size={13} color="#fff" /> Save changes
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 3, padding: '10px 20px 0', borderBottom: `1px solid ${t.border}`, background: t.surface, flexShrink: 0 }}>
        {tabs.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{ padding: '7px 16px', borderRadius: '8px 8px 0 0', fontSize: 12.5, fontWeight: tab === tb.id ? 600 : 400, cursor: 'pointer', border: tab === tb.id ? `1px solid ${t.border}` : '1px solid transparent', borderBottom: tab === tb.id ? `1px solid ${t.surface}` : '1px solid transparent', background: tab === tb.id ? t.surface : 'transparent', color: tab === tb.id ? t.text : t.textMid, fontFamily: 'inherit', marginBottom: -1 }}>
            {tb.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'form' && <FormBuilder schema={schema} onSchemaChange={setSchema} t={t} />}
        {tab === 'field' && (
          <FieldScoutingEditor
            fieldSchema={fieldSchema}
            onChange={fs => { setFieldSchema(fs); if (fs.imageDataUrl) setFieldImage(fs.imageDataUrl) }}
            initialImage={fieldImage}
            t={t}
          />
        )}
        {tab === 'points' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 4 }}>Collection Points</div>
            <div style={{ fontSize: 12, color: t.textMid, marginBottom: 16 }}>Define each scorable action and its point value. These become variables available in formulas.</div>
            <CollectionPointsEditor points={collectionPoints} onChange={setCollectionPoints} t={t} />
          </div>
        )}
        {tab === 'formula' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 4 }}>Scoring Formulas</div>
            <div style={{ fontSize: 12, color: t.textMid, marginBottom: 16 }}>Build calculated metrics from your collection point variables. Formulas are evaluated per match during analytics.</div>
            <FormulasEditor formulas={formulas} schema={schema} collectionPoints={collectionPoints} onChange={setFormulas} t={t} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Game Create Modal (simplified) ───────────────────────────
function GameModal({ onClose, onCreate, t }) {
  const backend = useBackend();

  const backendUrl = backend?.backendUrl;
  const isBackend = backend?.isBackend;
  const [name, setName] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [fieldImage, setFieldImage] = useState(null)
  const fileRef = useRef()

  const inputStyle = { width: '100%', padding: '9px 12px', fontSize: 13, background: t.surface2, border: `1px solid ${t.border2}`, borderRadius: 9, color: t.text, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.textDim, marginBottom: 5 }

  function handleImage(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setFieldImage(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return;

    const newGame = {
      name: name.trim(),
      year: parseInt(year) || new Date().getFullYear(),
      created: new Date().toISOString().slice(0, 10),
      matches: 0,
      scouts: 0,
      status: 'draft',
      fieldImage: fieldImage || null,
      formSchema: { sections: [], version: 1 },
      formulas: [],
      collectionPoints: [],
    };

    try {
      const data = await apiFetch(backendUrl, '/api/main', {
        method: 'POST',
        body: JSON.stringify(newGame)
      });

      onCreate(data.game || newGame);
      onClose();

    } catch (err) {
      console.error('Failed to create game:', err);
    }
  }


  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
      <div style={{ background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: '50%', background: t.surface2, border: `1px solid ${t.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={14} color={t.textMid} />
        </button>
        <div style={{ fontSize: 17, fontFamily: "'Instrument Serif', serif", color: t.text, marginBottom: 3 }}>New game</div>
        <div style={{ fontSize: 12.5, color: t.textMid, marginBottom: 22 }}>You can configure forms, formulas and collection points after creating.</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Game name *</label>
            <input style={inputStyle} placeholder="e.g. Reefscape 2026" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Season year</label>
            <input style={inputStyle} type="number" placeholder="2026" value={year} onChange={e => setYear(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Field image (optional)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => fileRef.current.click()} style={{ flex: 1, padding: '8px 12px', background: t.surface2, border: `1px dashed ${t.border2}`, borderRadius: 9, fontSize: 12, color: t.textMid, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
                {fieldImage ? '✓ Image selected' : '📷 Upload field image'}
              </button>
              {fieldImage && <button onClick={() => setFieldImage(null)} style={{ background: 'none', border: 'none', color: t.red, cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>✕</button>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${t.border2}`, borderRadius: 9, fontSize: 13, color: t.textMid, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleCreate} style={{ padding: '8px 16px', background: t.accent, color: t.bg === '#0a0a0a' ? '#fff' : '#000', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Create game</button>
        </div>
      </div>
    </div>
  )
}

// ── Pages ─────────────────────────────────────────────────────
function PageDashboard({ users, data, onOpenModal, onSwitchPage, t }) {
  const { isBackend, backendUrl } = useBackend()
  const members = users.members
  const localTotalMins = members.reduce((s, x) => s + (x.mins || 0), 0)
  const localActiveCount = members.filter(x => x.status === 'active').length
  const activeGame = data.games.find(g => g.status === 'active')
  const topScouts = [...members].filter(m => m.role !== 'coach').sort((a, b) => b.mins - a.mins).slice(0, 4)

  // Backend live state
  const [health, setHealth] = useState(null)
  const [scoutProgress, setScoutProgress] = useState([])
  const [submissionCount, setSubmissionCount] = useState(null)
  const [backendError, setBackendError] = useState(null)
  const [chatLog, setChatLog] = useState([])

  useEffect(() => {
    if (!isBackend) return
    let cancelled = false
    async function poll() {
      try {
        const [h, sp, sc, chat] = await Promise.all([
          apiFetch(backendUrl, '/api/health'),
          apiFetch(backendUrl, '/api/scout-progress'),
          apiFetch(backendUrl, '/api/data'),
          apiFetch(backendUrl, '/api/chat'),
        ])
        if (cancelled) return
        setHealth(h)
        setScoutProgress(sp)
        setSubmissionCount(sc.length)
        setChatLog(chat.slice(-5).reverse())
        setBackendError(null)
      } catch (e) {
        if (!cancelled) setBackendError(e.message)
      }
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => { cancelled = true; clearInterval(id) }
  }, [isBackend, backendUrl])

  const totalMins = isBackend
    ? (scoutProgress.reduce((s, x) => s + (x.mins || 0), 0) || localTotalMins)
    : localTotalMins
  const activeScouterCount = isBackend ? scoutProgress.length : localActiveCount
  const matchCount = isBackend ? (submissionCount ?? (activeGame ? activeGame.matches : 0)) : (activeGame ? activeGame.matches : 0)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

      {/* Backend status banner */}
      {isBackend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 16px', borderRadius: 10, background: backendError ? `${t.red}15` : `${t.green}15`, border: `1px solid ${backendError ? t.red + '40' : t.green + '40'}` }}>
          <Icon name="dot" size={8} color={backendError ? t.red : t.green} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: backendError ? t.red : t.green }}>
            RPi Backend {backendError ? `— Unreachable: ${backendError}` : `— Connected · ${health ? `up ${Math.floor(health.uptime / 60)}m` : '...'}`}
          </span>
          {!backendError && health && (
            <span style={{ fontSize: 11.5, color: t.textDim, marginLeft: 'auto' }}>
              {health.activeScouters} active scouter{health.activeScouters !== 1 ? 's' : ''} · {health.chatMessages} chat msgs · {health.submissions} total submissions
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
        <MetricCard label="Total scout mins" value={totalMins.toLocaleString()} sub={isBackend ? 'from RPi server' : 'this season'} subColor={t.green} t={t} />
        <MetricCard label={isBackend ? 'Live scouters' : 'Active scouts'} value={activeScouterCount} sub={isBackend ? 'currently online' : `of ${members.length} members`} t={t} />
        <MetricCard label="Forms submitted" value={matchCount} sub={isBackend ? 'stored on RPi' : 'current game'} subColor={t.blue} t={t} />
        <MetricCard label="Flags pending" value={2} sub="Needs review" subColor={t.amber} t={t} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* Scout leaderboard / live scouts */}
        <Panel title={isBackend ? 'Live scouters' : 'Scout leaderboard'} action={isBackend ? null : 'View all'} onAction={() => onSwitchPage('account')} t={t}>
          {isBackend ? (
            scoutProgress.length === 0 ? (
              <div style={{ fontSize: 12, color: t.textDim, padding: '12px 0' }}>No scouters currently active.</div>
            ) : (
              scoutProgress.map(s => (
                <div key={s.scouter_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${t.border}` }}>
                  <Avatar name={s.display_name || s.scouter_id} size={26} t={t} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{s.display_name || s.scouter_id}</div>
                    <div style={{ fontSize: 11.5, color: t.textDim }}>Match {s.match} · Team {s.team} · {s.alliance}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: `${t.green}20`, color: t.green }}>● Live</span>
                    <div style={{ width: 60, height: 4, borderRadius: 99, background: t.border2, overflow: 'hidden' }}>
                      <div style={{ width: `${s.pct || 0}%`, height: '100%', background: t.blue, borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: 10, color: t.textDim }}>{s.pct || 0}%</span>
                  </div>
                </div>
              ))
            )
          ) : (
            topScouts.length ? topScouts.map(m => <ScoutRow key={m.id} m={m} t={t} />) : <div style={{ fontSize: 12, color: t.textDim, padding: '8px 0' }}>No scouts yet.</div>
          )}
        </Panel>

        {/* Recent games / recent chat */}
        <Panel title={isBackend ? 'Recent chat' : 'Recent games'} action={isBackend ? null : '+ New'} onAction={onOpenModal} t={t}>
          {isBackend ? (
            chatLog.length === 0 ? (
              <div style={{ fontSize: 12, color: t.textDim, padding: '12px 0' }}>No chat messages yet.</div>
            ) : (
              chatLog.map((msg, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: `1px solid ${t.border}` }}>
                  <div style={{ marginTop: 3, flexShrink: 0 }}><Icon name="dot" size={8} color={msg.role === 'admin' ? t.purple : t.blue} /></div>
                  <div>
                    <div style={{ fontSize: 12.5, color: t.textMid, lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 600, color: msg.role === 'admin' ? t.purple : t.text }}>{msg.from}: </span>{msg.text}
                    </div>
                    <div style={{ fontSize: 11, color: t.textDim, marginTop: 2 }}>{msg.time}</div>
                  </div>
                </div>
              ))
            )
          ) : (
            data.games.slice(0, 3).map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${t.border}` }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: g.fieldImage ? 'transparent' : t.surface2, border: `1px solid ${t.border}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {g.fieldImage ? <img src={g.fieldImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <Icon name={g.status === 'active' ? 'trophy' : 'settings'} size={15} color={g.status === 'active' ? t.amber : t.textDim} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{g.name}</div>
                  <div style={{ fontSize: 11.5, color: t.textDim }}>{g.matches} matches</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: g.status === 'active' ? `${t.green}22` : t.surface2, color: g.status === 'active' ? t.green : t.textDim }}>{g.status === 'active' ? 'Active' : g.status}</span>
              </div>
            ))
          )}
        </Panel>
      </div>

      <Panel title={isBackend ? 'Recent activity (backend)' : 'Recent activity'} t={t}>
        {isBackend ? (
          scoutProgress.length === 0 && !health ? (
            <div style={{ fontSize: 12, color: t.textDim, padding: '8px 0' }}>{backendError ? 'Could not reach backend.' : 'Waiting for backend data…'}</div>
          ) : (
            scoutProgress.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: `1px solid ${t.border}` }}>
                <div style={{ marginTop: 5, flexShrink: 0 }}><Icon name="dot" size={8} color={t.blue} /></div>
                <div>
                  <div style={{ fontSize: 12.5, color: t.textMid, lineHeight: 1.5 }}>
                    {s.display_name || s.scouter_id} is scouting Team {s.team} — Match {s.match} ({s.alliance})
                  </div>
                  <div style={{ fontSize: 11, color: t.textDim, marginTop: 2 }}>Form {s.pct || 0}% complete</div>
                </div>
              </div>
            ))
          )
        ) : (
          data.activity.slice(0, 5).map((a, i) => <ActRow key={i} a={a} t={t} />)
        )}
      </Panel>
    </div>
  )
}

function PageGames({ data, onOpenModal, onSetActiveGame, onEditGame, onDeleteGame, t }) {
  const games = data?.games || []
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function handleDelete(id) {
    try {
      await onDeleteGame(id)
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setConfirmDelete(null)
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
      <Panel title="Game library" t={t} style={{ position: 'relative' }}>

        {/* New Game Button */}
        <div style={{ position: 'absolute', top: 10, right: 18 }}>
          <button
            onClick={onOpenModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: t.accent,
              color: t.bg === '#0a0a0a' ? '#000' : '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            <Icon name="plus" size={13} color={t.bg === '#0a0a0a' ? '#000' : '#fff'} />
            New game
          </button>
        </div>

        {/* Game List */}
        {games.length ? games.map(g => (
          <div
            key={g.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '11px 0',
              borderBottom: `1px solid ${t.border}`
            }}
          >

            {/* Icon / Image */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: g.fieldImage ? 'transparent' : t.surface2,
                border: `1px solid ${t.border}`,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {g.fieldImage ? (
                <img src={g.fieldImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              ) : (
                <Icon
                  name={g.status === 'active' ? 'trophy' : 'settings'}
                  size={16}
                  color={g.status === 'active' ? t.amber : t.textDim}
                />
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                {g.name}
              </div>
              <div style={{ fontSize: 12, color: t.textDim }}>
                {g.matches || 0} matches · {g.year}
              </div>
            </div>

            {/* Status */}
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 99,
                background: g.status === 'active' ? `${t.green}22` : t.surface2,
                color: g.status === 'active' ? t.green : t.textDim
              }}
            >
              {g.status === 'active' ? 'Active' : (g.status || 'draft')}
            </span>

            {/* Edit */}
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEditGame(g.id) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 11px',
                background: `${t.blue}18`,
                border: `1px solid ${t.blue}30`,
                borderRadius: 8,
                fontSize: 12,
                color: t.blue,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              <Icon name="edit" size={12} color={t.blue} />
              Launch editor
            </button>

            {/* Set Active */}
            {g.status !== 'active' && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSetActiveGame(g.id) }}
                style={{
                  padding: '5px 11px',
                  background: 'transparent',
                  border: `1px solid ${t.border2}`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: t.textMid,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Set active
              </button>
            )}

            {/* Delete */}
            {confirmDelete === g.id ? (
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: t.red }}>Delete?</span>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(g.id) }}
                  style={{
                    padding: '4px 10px',
                    background: `${t.red}20`,
                    border: `1px solid ${t.red}40`,
                    borderRadius: 7,
                    fontSize: 11,
                    color: t.red,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontWeight: 600
                  }}
                >
                  Yes
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(null) }}
                  style={{
                    padding: '4px 10px',
                    background: t.surface2,
                    border: `1px solid ${t.border2}`,
                    borderRadius: 7,
                    fontSize: 11,
                    color: t.textMid,
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(g.id) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 9px',
                  background: `${t.red}12`,
                  border: `1px solid ${t.red}25`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: t.red,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  opacity: 0.8
                }}
              >
                <Icon name="trash" size={12} color={t.red} />
              </button>
            )}

          </div>
        )) : (
          <div style={{ fontSize: 13, color: t.textDim, padding: '12px 0' }}>
            No games yet.
          </div>
        )}

      </Panel>
    </div>
  );
}

function PageAccount({ users, onAddMember, onChangeRole, onRemoveMember, t }) {
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', role: 'scouter' })
  const sorted = [...users.members].sort((a, b) => b.mins - a.mins)
  const inputStyle = { flex: 1, minWidth: 100, padding: '8px 12px', fontSize: 13, background: t.surface2, border: `1px solid ${t.border2}`, borderRadius: 9, color: t.text, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }

  function handleAdd() {
    if (!form.name || !form.username) return
    onAddMember({ ...form, email: form.email || '—', password: form.password || 'scout1234', mins: 0, matches: 0, status: 'active' })
    setForm({ name: '', username: '', email: '', password: '', role: 'scouter' })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '20px 28px 18px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
        <h2 style={{ fontSize: 17, fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: t.text, margin: '0 0 2px' }}>Team &amp; Accounts</h2>
        <p style={{ fontSize: 12.5, color: t.textMid, margin: 0 }}>Manage members, roles, and scouting minutes</p>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {['name', 'username', 'email'].map(f => (
            <input key={f} style={inputStyle} placeholder={f.charAt(0).toUpperCase() + f.slice(1)} value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} />
          ))}
          <input style={inputStyle} placeholder="Password" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
          <select style={{ ...inputStyle, flex: '0 0 auto', minWidth: 130, cursor: 'pointer' }} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
            {['scouter', 'assistant', 'lead', 'coach'].map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <button onClick={handleAdd} style={{ padding: '8px 16px', background: t.accent, color: t.bg === '#0a0a0a' ? '#fff' : '#000', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Add member</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>{['Member', 'Username', 'Role', 'Scout mins', 'Matches', 'Status', ''].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1px solid ${t.border}` }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {sorted.map(m => (
              <tr key={m.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                <td style={{ padding: '12px', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <Avatar name={m.name} size={28} t={t} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{m.name}</div>
                      <div style={{ fontSize: 11.5, color: t.textDim }}>{m.email || '—'}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px', color: t.textDim, fontSize: 12 }}>{m.username || '—'}</td>
                <td style={{ padding: '12px' }}>
                  <select style={{ fontSize: 12, padding: '5px 9px', borderRadius: 8, border: `1px solid ${t.border2}`, background: t.surface2, color: t.text, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }} value={m.role} onChange={e => onChangeRole(m.id, e.target.value)}>
                    {['coach', 'lead', 'assistant', 'scouter'].map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </td>
                <td style={{ padding: '12px' }}><span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: t.surface2, border: `1px solid ${t.border}`, color: t.textMid }}>{m.mins} min</span></td>
                <td style={{ padding: '12px', color: t.textMid, fontSize: 12.5 }}>{m.matches}</td>
                <td style={{ padding: '12px' }}>{m.status === 'active' ? <span style={{ color: t.green, fontSize: 12, fontWeight: 600 }}>● Active</span> : <span style={{ color: t.textDim, fontSize: 12 }}>● Idle</span>}</td>
                <td style={{ padding: '12px' }}>
                  <button onClick={() => onRemoveMember(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: `${t.red}15`, border: `1px solid ${t.red}30`, borderRadius: 8, fontSize: 12, color: t.red, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Icon name="trash" size={13} color={t.red} /> Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PageSettings({ settings, onSave, t }) {
  const [teamNumber, setTeamNumber] = useState(settings.teamNumber || '')
  const [teamName, setTeamName] = useState(settings.teamName || '')
  const [adminRoles, setAdminRoles] = useState(settings.adminRoles || [])
  const [perUser, setPerUser] = useState(!!settings.perUserDashboard)
  const [rpiEnabled, setRpiEnabled] = useState(!!settings.rpiEnabled)
  const [backendUrl, setBackendUrl] = useState(settings.backendUrl || 'https://taco-childhood-jailbreak.ngrok-free.dev')
  const [mlBetaEnabled, setMlBetaEnabled] = useState(!!settings.mlBetaEnabled)
  const [saved, setSaved] = useState(false)
  const [testStatus, setTestStatus] = useState(null) // null | 'testing' | 'ok' | 'fail'
  const inputStyle = { padding: '8px 12px', fontSize: 13, borderRadius: 9, border: `1px solid ${t.border2}`, background: t.surface2, color: t.text, outline: 'none', fontFamily: 'inherit', minWidth: 180 }

  function toggleRole(r) { setAdminRoles(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r]) }
  function handleSave() {
    onSave({ ...settings, teamNumber, teamName, adminRoles, perUserDashboard: perUser, rpiEnabled, backendUrl, mlBetaEnabled })
    setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  async function testConnection() {
    setTestStatus('testing')
    try {
      const res = await fetch(backendUrl.replace(/\/$/, '') + '/api/health')
      if (res.ok) { setTestStatus('ok'); setTimeout(() => setTestStatus(null), 3000) }
      else { setTestStatus('fail') }
    } catch { setTestStatus('fail') }
  }

  const Section = ({ title, sub, children }) => (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: t.textMid, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  )
  const Row = ({ label, sub, children, last }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: last ? 'none' : `1px solid ${t.border}`, gap: 16 }}>
      <div><div style={{ fontSize: 13.5, fontWeight: 500, color: t.text }}>{label}</div>{sub && <div style={{ fontSize: 12, color: t.textMid, marginTop: 2 }}>{sub}</div>}</div>
      {children}
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <Section title="Team info" sub="Core identity shown throughout NorthStar">
          <Row label="Team number" sub="Your FRC team number"><input style={inputStyle} placeholder="4028" value={teamNumber} onChange={e => setTeamNumber(e.target.value)} /></Row>
          <Row label="Team name" sub="Shown in the sidebar" last><input style={inputStyle} placeholder="Bravely Bold" value={teamName} onChange={e => setTeamName(e.target.value)} /></Row>
        </Section>

        <Section title="Access control" sub="Which roles can access the admin dashboard">
          <Row label="Admin roles" sub="Users with these roles can access this panel">
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {['coach', 'lead', 'assistant', 'scouter'].map(r => {
                const on = adminRoles.includes(r)
                return (
                  <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 13px', borderRadius: 99, border: `1px solid ${on ? t.blue : t.border2}`, background: on ? `${t.blue}20` : t.surface2, cursor: 'pointer', fontSize: 12.5, fontWeight: 500, color: on ? t.blue : t.textMid, userSelect: 'none' }}>
                    <input type="checkbox" style={{ display: 'none' }} checked={on} onChange={() => toggleRole(r)} />
                    {ROLE_LABELS[r]}
                  </label>
                )
              })}
            </div>
          </Row>
          <Row label="Per-user dashboards" sub="Everyone logs in to their personal view" last><Toggle on={perUser} onChange={setPerUser} t={t} /></Row>
        </Section>

        {/* ── RPi Scouting ───────────────────────────── */}
        <Section
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              RPi Scouting
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${t.amber}25`, color: t.amber, letterSpacing: '0.06em' }}>BETA</span>
            </span>
          }
          sub="Store scouting data on a local Raspberry Pi server instead of the browser"
        >
          <Row label="Enable RPi backend" sub="Sync all data through the NorthStar server running on your RPi">
            <Toggle on={rpiEnabled} onChange={v => { setRpiEnabled(v); if (!v) setTestStatus(null) }} t={t} />
          </Row>
          {rpiEnabled && (
            <div style={{ padding: '14px 18px', borderTop: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: t.text, marginBottom: 8 }}>Backend URL</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  style={{ ...inputStyle, flex: 1, minWidth: 220 }}
                  placeholder="https://taco-childhood-jailbreak.ngrok-free.dev"
                  value={backendUrl}
                  onChange={e => { setBackendUrl(e.target.value); setTestStatus(null) }}
                  spellCheck={false}
                />
                <button
                  onClick={testConnection}
                  disabled={testStatus === 'testing'}
                  style={{ padding: '8px 14px', background: t.surface2, border: `1px solid ${t.border2}`, borderRadius: 9, fontSize: 12.5, color: t.textMid, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                >
                  {testStatus === 'testing' ? '…' : <Icon name="activity" size={13} color={t.textMid} />}
                  {testStatus === 'testing' ? 'Testing…' : 'Test connection'}
                </button>
                {testStatus === 'ok' && (
                  <span style={{ fontSize: 12.5, color: t.green, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Icon name="check" size={14} color={t.green} /> Connected
                  </span>
                )}
                {testStatus === 'fail' && (
                  <span style={{ fontSize: 12.5, color: t.red, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Icon name="x" size={14} color={t.red} /> Unreachable
                  </span>
                )}
              </div>
              <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 9, background: `${t.amber}12`, border: `1px solid ${t.amber}30` }}>
                <div style={{ fontSize: 12, color: t.amber, fontWeight: 600, marginBottom: 4 }}>How to start the server</div>
                <code style={{ fontSize: 11.5, color: t.textMid, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.7, display: 'block' }}>
                  # On your RPi or local machine:<br />
                  node Server.js<br /><br />
                  # Then set the URL above to:<br />
                  http://&lt;raspberry-pi-ip&gt;:3000
                </code>
              </div>
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Scouting data', desc: 'Forms → JSON files on disk' },
                  { label: 'Live progress', desc: 'Real-time scout tracking' },
                  { label: 'Chat & fills', desc: 'Admin ↔ scouter comms' },
                ].map(f => (
                  <div key={f.label} style={{ padding: '10px 12px', borderRadius: 9, background: t.surface2, border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 3 }}>{f.label}</div>
                    <div style={{ fontSize: 11.5, color: t.textDim }}>{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section title="Data management" sub="Export or import your NorthStar data">
          <Row label="ML (Beta)" sub="Enable data pipelines, prediction tools, and data chat in Drive view">
            <Toggle on={mlBetaEnabled} onChange={setMlBetaEnabled} t={t} />
          </Row>
          <Row label="Export all data" sub="Downloads games, users, and settings as JSON" last>
            <button onClick={() => downloadJSON({ settings, users: 'see separate export', games: 'see localStorage' }, 'northstar-export.json')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: t.surface2, border: `1px solid ${t.border2}`, borderRadius: 9, fontSize: 12, color: t.textMid, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Icon name="download" size={14} color={t.textMid} /> Export JSON
            </button>
          </Row>
        </Section>
      </div>
      <div style={{ padding: '14px 28px', borderTop: `1px solid ${t.border}`, background: t.surface, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={handleSave} style={{ padding: '8px 18px', background: t.accent, color: t.bg === '#0a0a0a' ? '#000' : '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Save settings</button>
        {saved && <span style={{ fontSize: 13, color: t.green, display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="check" size={14} color={t.green} />Saved</span>}
      </div>
    </div>
  )
}

function PageAppManager({ t }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Admin Panel</div>
          <div style={{ fontSize: 12, color: t.textMid, marginTop: 2 }}>External tools and integrations</div>
        </div>
        <div onClick={() => window.open('https://localhost:3000', '_blank')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}>
          <div><div style={{ fontSize: 13.5, fontWeight: 500, color: t.text }}>Open Admin Panel</div><div style={{ fontSize: 12, color: t.textMid }}>Opens in a new tab</div></div>
          <Icon name="external" size={16} color={t.textDim} />
        </div>
      </div>
    </div>
  )
}

function PageEmpty({ icon, title, desc, t }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: t.textDim, padding: '60px 0' }}>
        <div style={{ opacity: 0.3, marginBottom: 4 }}><Icon name={icon} size={36} color={t.textDim} /></div>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.textMid }}>{title}</div>
        <p style={{ fontSize: 13, color: t.textDim, textAlign: 'center', maxWidth: 280, lineHeight: 1.6, margin: 0 }}>{desc}</p>
      </div>
    </div>
  )
}

function PageComp({ users, data, t }) {
  const { isBackend, backendUrl } = useBackend()
  const [compTab, setCompTab] = useState('live')   // 'live' | 'data' | 'picklist' | 'chat'
  const [scoutProgress, setScoutProgress] = useState([])
  const [matchData, setMatchData] = useState([])
  const [picklist, setPicklist] = useState([])
  const [chatLog, setChatLog] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [backendError, setBackendError] = useState(null)
  const [health, setHealth] = useState(null)
  const [currentMatch, setCurrentMatchState] = useState(1)
  const [matchInput, setMatchInput] = useState('1')
  const [adminFillScouter, setAdminFillScouter] = useState(null) // scouter_id being filled
  const [fillValues, setFillValues] = useState({})
  const [sortKey, setSortKey] = useState('rank')
  const [searchTerm, setSearchTerm] = useState('')
  const [toast, setToast] = useState(null)
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const chatEndRef = useRef(null)

  const activeGame = data.games.find(g => g.status === 'active')
  const schemaFields = activeGame?.formSchema?.sections?.flatMap(s => s.fields) || []
  const visibleTableFields = schemaFields.filter(f => f.displayInTable !== false)
  const hiddenTableFields = schemaFields.filter(f => f.displayInTable === false)
  const me = users.members[0]

  function showToast(msg, color) {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3000)
  }

  // Poll backend
  useEffect(() => {
    if (!isBackend) return
    let cancelled = false
    async function poll() {
      try {
        const [sp, md, pl, chat, h] = await Promise.all([
          apiFetch(backendUrl, '/api/scout-progress'),
          apiFetch(backendUrl, '/api/data'),
          apiFetch(backendUrl, '/api/picklist'),
          apiFetch(backendUrl, '/api/chat'),
          apiFetch(backendUrl, '/api/health'),
        ])
        if (cancelled) return
        setScoutProgress(sp)
        setMatchData(md)
        setPicklist(pl)
        setChatLog(chat.slice(-60))
        setHealth(h)
        setBackendError(null)
      } catch (e) {
        if (!cancelled) setBackendError(e.message)
      }
    }
    poll()
    const id = setInterval(poll, 4000)
    return () => { cancelled = true; clearInterval(id) }
  }, [isBackend, backendUrl])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatLog])

  async function sendChat() {
    if (!chatInput.trim() || !isBackend) return
    const msg = { role: 'admin', from: me?.name || 'Admin', text: chatInput.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    try {
      await apiFetch(backendUrl, '/api/chat', { method: 'POST', body: JSON.stringify(msg) })
      setChatInput('')
    } catch { }
  }

  async function clearChat() {
    if (!isBackend || !confirm('Clear all chat history?')) return
    await apiFetch(backendUrl, '/api/chat', { method: 'DELETE' })
    setChatLog([])
  }

  async function setCurrentMatch() {
    const n = parseInt(matchInput)
    if (!n || isNaN(n)) return
    setCurrentMatchState(n)
    if (!isBackend) return
    const msg = { role: 'broadcast', from: 'BROADCAST', text: `📢 Current match set to Match ${n}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    try { await apiFetch(backendUrl, '/api/chat', { method: 'POST', body: JSON.stringify(msg) }) } catch { }
  }

  async function deleteSubmission(idx) {
    if (!isBackend) return
    try {
      await apiFetch(backendUrl, `/api/data/${idx}`, { method: 'DELETE' })
      setMatchData(d => d.filter((_, i) => i !== idx))
    } catch { }
  }

  function openAdminFill(scouterId, currentVals) {
    const init = {}
    schemaFields.forEach(f => { init[f.varName] = currentVals?.[f.varName] ?? (f.min ?? 0) })
    setFillValues(init)
    setAdminFillScouter(scouterId)
  }

  async function submitAdminFill() {
    if (!adminFillScouter || !isBackend) return
    try {
      await apiFetch(backendUrl, '/api/admin-fill', { method: 'POST', body: JSON.stringify({ scouter_id: adminFillScouter, fieldValues: fillValues }) })
      showToast(`✓ Pushed ${Object.keys(fillValues).length} field(s) to ${adminFillScouter}`, t.green)
    } catch (e) {
      showToast('⚠ Push failed: ' + e.message, t.amber)
    }
    setAdminFillScouter(null)
    setFillValues({})
  }

  function exportPicklistCSV() {
    if (!picklist.length) return
    const keys = Object.keys(picklist[0]).filter(k => k !== '_rows')
    const csv = [keys.join(','), ...picklist.map(r => keys.map(k => r[k] ?? '').join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'picklist.csv'; a.click()
  }

  const inp = { padding: '7px 10px', fontSize: 12, borderRadius: 8, border: `1px solid ${t.border2}`, background: t.surface2, color: t.text, fontFamily: 'inherit', outline: 'none' }

  // ── Sorted/filtered picklist
  const sortedPL = [...picklist]
    .filter(r => !searchTerm || String(r.team).includes(searchTerm))
    .sort((a, b) => sortKey === 'rank' ? (picklist.indexOf(a) - picklist.indexOf(b)) : ((b[sortKey] || 0) - (a[sortKey] || 0)))

  const plNumKeys = picklist[0] ? Object.keys(picklist[0]).filter(k => typeof picklist[0][k] === 'number' && k !== 'team') : []

  // ── Tab button helper
  function TabBtn({ id, label }) {
    const on = compTab === id
    return (
      <button onClick={() => setCompTab(id)} style={{ padding: '5px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: on ? 600 : 400, cursor: 'pointer', border: on ? `1px solid ${t.border}` : '1px solid transparent', background: on ? t.surface : 'transparent', color: on ? t.text : t.textMid, fontFamily: 'inherit' }}>
        {label}
      </button>
    )
  }

  if (!isBackend) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: t.textDim, maxWidth: 320 }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>📡</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.textMid, marginBottom: 8 }}>RPi Backend not connected</div>
          <p style={{ fontSize: 13, lineHeight: 1.6, margin: '0 0 16px' }}>Enable RPi backend in Settings and enter your server URL to use the Competition tab.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header bar */}
      <div style={{ padding: '10px 24px', borderBottom: `1px solid ${t.border}`, background: t.surface, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {[['live', '🔴 Live'], ['data', '📊 Match Data'], ['picklist', '🏆 Picklist'], ['chat', '💬 Chat']].map(([id, label]) => (
            <TabBtn key={id} id={id} label={label} />
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: backendError ? t.red : t.green, padding: '3px 10px', borderRadius: 99, border: `1px solid ${backendError ? t.red + '40' : t.green + '40'}`, background: backendError ? `${t.red}10` : `${t.green}10` }}>
            <Icon name="dot" size={8} color={backendError ? t.red : t.green} />
            {backendError ? 'Disconnected' : `Connected · ${health ? Math.floor(health.uptime / 60) + 'm up' : '...'}`}
          </span>
          {health && <span style={{ fontSize: 11.5, color: t.textDim }}>{health.submissions} submissions · {health.activeScouters} live</span>}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ── LIVE TAB ── */}
        {compTab === 'live' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {/* Match control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '12px 16px', borderRadius: 10, background: t.surface, border: `1px solid ${t.border}` }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: t.text }}>Match Control</span>
              <input type="number" value={matchInput} onChange={e => setMatchInput(e.target.value)} style={{ ...inp, width: 70, textAlign: 'center', fontWeight: 700 }} min={1} max={200} />
              <button type="button" onClick={setCurrentMatch} style={{ padding: '7px 14px', background: t.blue, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Set Match</button>
              <span style={{ fontSize: 11.5, color: t.textDim }}>Current: Match {currentMatch} · broadcasts to all scouters</span>
            </div>

            {/* Live scouters */}
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 }}>Live Scouters ({scoutProgress.length})</div>
            {scoutProgress.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: 12.5, color: t.textDim, border: `1px dashed ${t.border2}`, borderRadius: 10, marginBottom: 16 }}>No scouters currently active.</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {scoutProgress.map(s => (
                <div key={s.scouter_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: t.surface, border: `1px solid ${t.border}` }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.green, flexShrink: 0, boxShadow: `0 0 6px ${t.green}` }} />
                  <Avatar name={s.display_name || s.scouter_id} size={28} t={t} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{s.display_name || s.scouter_id}</div>
                    <div style={{ fontSize: 11.5, color: t.textDim }}>Match {s.match || '?'} · Team {s.team || '?'} · {s.alliance || '?'} alliance</div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ width: 100 }}>
                    <div style={{ height: 4, borderRadius: 99, background: t.surface2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${s.pct || 0}%`, background: t.blue, borderRadius: 99, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ fontSize: 10.5, color: t.textDim, marginTop: 2, textAlign: 'right' }}>{s.pct || 0}%</div>
                  </div>
                  <button type="button" onClick={() => openAdminFill(s.scouter_id, s.fieldValues)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: `${t.blue}18`, border: `1px solid ${t.blue}40`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: t.blue, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                    ✦ Fill
                  </button>
                </div>
              ))}
            </div>

            {/* Recent submissions */}
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 }}>Recent Submissions</div>
            <div style={{ borderRadius: 10, border: `1px solid ${t.border}`, overflow: 'hidden', background: t.surface }}>
              {matchData.length === 0 && <div style={{ padding: 20, fontSize: 12.5, color: t.textDim, textAlign: 'center' }}>No submissions yet.</div>}
              {matchData.slice(-5).reverse().map((row, i) => (
                <div key={i} onClick={() => setSelectedSubmission(row)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < Math.min(matchData.length, 5) - 1 ? `1px solid ${t.border}` : 'none', cursor: 'pointer' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: row.alliance === 'red' ? `${t.red}20` : `${t.blue}20`, color: row.alliance === 'red' ? t.red : t.blue }}>{row.alliance || '?'}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Team {row.team}</span>
                  <span style={{ fontSize: 12, color: t.textDim }}>Match {row.match}</span>
                  <span style={{ fontSize: 12, color: t.textDim }}>{row.scouter_id}</span>
                  {typeof row.total_score === 'number' && <span style={{ fontSize: 12, fontWeight: 700, color: t.blue, marginLeft: 'auto' }}>{row.total_score} pts</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MATCH DATA TAB ── */}
        {compTab === 'data' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: t.surface }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{matchData.length} submissions</span>
              <button type="button" onClick={() => downloadJSON(matchData, 'match-data.json')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: t.surface2, border: `1px solid ${t.border2}`, borderRadius: 8, fontSize: 12, color: t.textMid, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Icon name="download" size={13} color={t.textMid} /> Export JSON
              </button>
            </div>
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
              {matchData.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: t.textDim, fontSize: 13 }}>No match data yet.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, background: t.surface, zIndex: 1 }}>
                    <tr>
                      {['#', 'Team', 'Match', 'Alliance', 'Scouter', ...schemaFields.map(f => f.label), ''].map((h, i) => (
                        <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matchData.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: `1px solid ${t.border}`, cursor: 'pointer' }} onClick={() => setSelectedSubmission(row)}>
                        <td style={{ padding: '9px 12px', color: t.textDim, fontSize: 11 }}>{idx + 1}</td>
                        <td style={{ padding: '9px 12px', fontWeight: 700, color: t.text }}>{row.team}</td>
                        <td style={{ padding: '9px 12px', color: t.textMid }}>{row.match}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: row.alliance === 'red' ? `${t.red}20` : `${t.blue}20`, color: row.alliance === 'red' ? t.red : t.blue }}>{row.alliance || '?'}</span>
                        </td>
                        <td style={{ padding: '9px 12px', color: t.textDim, fontSize: 11 }}>{row.scouter_id}</td>
                        {schemaFields.map(f => (
                          <td key={f.varName} style={{ padding: '9px 12px', color: t.text, fontVariantNumeric: 'tabular-nums' }}>
                            {f.displayInTable === false ? '...' : (row[f.varName] ?? '—')}
                          </td>
                        ))}
                        <td style={{ padding: '9px 12px' }}>
                          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (confirm('Delete this submission?')) deleteSubmission(idx) }} style={{ background: 'none', border: 'none', color: t.red, cursor: 'pointer', opacity: 0.6, padding: '2px 4px' }}>
                            <Icon name="trash" size={13} color={t.red} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── PICKLIST TAB ── */}
        {compTab === 'picklist' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, background: t.surface, flexWrap: 'wrap' }}>
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search team…" style={{ ...inp, width: 140 }} />
              <div style={{ display: 'flex', gap: 4 }}>
                {['rank', ...plNumKeys].slice(0, 6).map(k => (
                  <button key={k} onClick={() => setSortKey(k)} style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: sortKey === k ? 700 : 400, cursor: 'pointer', border: `1px solid ${sortKey === k ? t.blue : t.border2}`, background: sortKey === k ? `${t.blue}18` : t.surface2, color: sortKey === k ? t.blue : t.textMid, fontFamily: 'inherit' }}>
                    {k}
                  </button>
                ))}
              </div>
              <button onClick={exportPicklistCSV} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: t.surface2, border: `1px solid ${t.border2}`, borderRadius: 8, fontSize: 12, color: t.textMid, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Icon name="download" size={13} color={t.textMid} /> CSV
              </button>
            </div>
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
              {sortedPL.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: t.textDim, fontSize: 13 }}>No data yet.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, background: t.surface, zIndex: 1 }}>
                    <tr>
                      {['Rank', 'Team', 'Matches', ...plNumKeys].map((h, i) => (
                        <th key={i} onClick={() => i > 2 && setSortKey(plNumKeys[i - 3])} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap', cursor: i > 2 ? 'pointer' : 'default', userSelect: 'none' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPL.map((row, i) => (
                      <tr key={row.team} style={{ borderBottom: `1px solid ${t.border}`, background: i === 0 ? `${t.amber}08` : 'transparent' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: i === 0 ? t.amber : t.textDim }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13.5, color: t.text }}>{row.team}</td>
                        <td style={{ padding: '10px 14px', color: t.textMid }}>{row.matches}</td>
                        {plNumKeys.map(k => (
                          <td key={k} style={{ padding: '10px 14px', fontVariantNumeric: 'tabular-nums', fontWeight: k === sortKey ? 700 : 400, color: k === sortKey ? t.blue : t.text }}>{row[k] ?? '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── CHAT TAB ── */}
        {compTab === 'chat' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {chatLog.length === 0 && <div style={{ textAlign: 'center', color: t.textDim, fontSize: 12.5, marginTop: 40 }}>No messages yet.</div>}
              {chatLog.map((msg, i) => {
                const isAdmin = msg.role === 'admin'
                const isBroadcast = msg.role === 'broadcast'
                if (isBroadcast) return (
                  <div key={i} style={{ textAlign: 'center', fontSize: 11.5, color: t.amber, padding: '4px 0' }}>{msg.text}</div>
                )
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: isAdmin ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-end' }}>
                    <Avatar name={msg.from} size={24} t={t} />
                    <div style={{ maxWidth: '68%' }}>
                      <div style={{ fontSize: 10.5, color: t.textDim, marginBottom: 2, textAlign: isAdmin ? 'right' : 'left' }}>{msg.from} · {msg.time}</div>
                      <div style={{ padding: '8px 12px', borderRadius: isAdmin ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: isAdmin ? t.blue : t.surface, border: `1px solid ${isAdmin ? t.blue : t.border}`, fontSize: 13, color: isAdmin ? '#fff' : t.text, lineHeight: 1.5 }}>{msg.text}</div>
                    </div>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>
            <div style={{ padding: '12px 24px', borderTop: `1px solid ${t.border}`, background: t.surface, display: 'flex', gap: 8, flexShrink: 0 }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Message all scouters…"
                style={{ flex: 1, ...inp, fontSize: 13, padding: '9px 12px' }}
              />
              <button onClick={sendChat} style={{ padding: '9px 16px', background: t.blue, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Send</button>
              <button onClick={clearChat} title="Clear chat" style={{ padding: '9px 12px', background: `${t.red}15`, border: `1px solid ${t.red}30`, borderRadius: 8, cursor: 'pointer' }}>
                <Icon name="trash" size={14} color={t.red} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Submission Detail Modal ── */}
      {selectedSubmission && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 780 }} onClick={() => setSelectedSubmission(null)}>
          <div style={{ background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 14, width: '100%', maxWidth: 760, maxHeight: '82vh', overflow: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 16, fontFamily: "'Instrument Serif', serif", color: t.text }}>Submission Detail</div>
                <div style={{ fontSize: 12, color: t.textMid }}>Team {selectedSubmission.team || '—'} · Match {selectedSubmission.match || '—'} · {selectedSubmission.scouter_id || 'Unknown'}</div>
              </div>
              <button onClick={() => setSelectedSubmission(null)} style={{ width: 28, height: 28, borderRadius: '50%', background: t.surface2, border: `1px solid ${t.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="x" size={14} color={t.textMid} />
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: t.textDim, textTransform: 'uppercase', marginBottom: 8 }}>Shown In Table</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
                {visibleTableFields.map(f => (
                  <div key={f.varName} style={{ border: `1px solid ${t.border}`, borderRadius: 8, background: t.surface2, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10.5, color: t.textDim, marginBottom: 2 }}>{f.label}</div>
                    <div style={{ fontSize: 12.5, color: t.text }}>{String(selectedSubmission[f.varName] ?? '—')}</div>
                  </div>
                ))}
                {visibleTableFields.length === 0 && <div style={{ fontSize: 12, color: t.textDim }}>No fields configured for table display.</div>}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: t.textDim, textTransform: 'uppercase', marginBottom: 8 }}>Hidden In Table (Detailed View)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
                {hiddenTableFields.map(f => (
                  <div key={f.varName} style={{ border: `1px solid ${t.border}`, borderRadius: 8, background: t.surface2, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10.5, color: t.textDim, marginBottom: 2 }}>{f.label}</div>
                    <div style={{ fontSize: 12.5, color: t.text }}>{String(selectedSubmission[f.varName] ?? '—')}</div>
                  </div>
                ))}
                {hiddenTableFields.length === 0 && <div style={{ fontSize: 12, color: t.textDim }}>No hidden fields.</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Admin Fill Modal ── */}
      {adminFillScouter && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 800 }}>
          <div style={{ background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '80vh', overflow: 'auto', position: 'relative' }}>
            <button onClick={() => setAdminFillScouter(null)} style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: '50%', background: t.surface2, border: `1px solid ${t.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size={14} color={t.textMid} />
            </button>
            <div style={{ fontSize: 15, fontFamily: "'Instrument Serif', serif", color: t.text, marginBottom: 4 }}>Admin Fill</div>
            <div style={{ fontSize: 12, color: t.textMid, marginBottom: 18 }}>Push field values to <strong>{adminFillScouter}</strong></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {schemaFields.filter(f => f.adminFillable !== false).map(f => (
                <div key={f.varName} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: t.text }}>{f.label}</label>
                  {f.type === 'counter' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: `1px solid ${t.border2}`, borderRadius: 9, overflow: 'hidden', background: t.surface2 }}>
                      <button onClick={() => setFillValues(v => ({ ...v, [f.varName]: Math.max(f.min ?? 0, (v[f.varName] ?? 0) - 1) }))} style={{ width: 32, height: 32, background: 'none', border: 'none', color: t.text, fontSize: 18, cursor: 'pointer' }}>−</button>
                      <span style={{ minWidth: 32, textAlign: 'center', fontSize: 14, fontWeight: 700, color: t.text }}>{fillValues[f.varName] ?? 0}</span>
                      <button onClick={() => setFillValues(v => ({ ...v, [f.varName]: Math.min(f.max ?? 99, (v[f.varName] ?? 0) + 1) }))} style={{ width: 32, height: 32, background: 'none', border: 'none', color: t.text, fontSize: 18, cursor: 'pointer' }}>+</button>
                    </div>
                  )}
                  {f.type === 'slider' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="range" min={f.min ?? 0} max={f.max ?? 10} value={fillValues[f.varName] ?? 0} onChange={e => setFillValues(v => ({ ...v, [f.varName]: +e.target.value }))} style={{ width: 100, accentColor: t.blue }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.blue, minWidth: 20 }}>{fillValues[f.varName] ?? 0}</span>
                    </div>
                  )}
                  {f.type === 'toggle' && (
                    <Toggle on={!!fillValues[f.varName]} onChange={v => setFillValues(fv => ({ ...fv, [f.varName]: v }))} t={t} />
                  )}
                  {f.type === 'dropdown' && (
                    <select value={fillValues[f.varName] ?? ''} onChange={e => setFillValues(v => ({ ...v, [f.varName]: e.target.value }))} style={{ ...inp, width: 140 }}>
                      <option value="">— select —</option>
                      {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                  {(f.type === 'text' || !['counter', 'slider', 'toggle', 'dropdown'].includes(f.type)) && (
                    <input value={fillValues[f.varName] ?? ''} onChange={e => setFillValues(v => ({ ...v, [f.varName]: e.target.value }))} style={{ ...inp, width: 140 }} />
                  )}
                </div>
              ))}
              {schemaFields.length === 0 && <div style={{ fontSize: 12, color: t.textDim }}>No schema fields defined. Add fields in the Game Editor.</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setAdminFillScouter(null)} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${t.border2}`, borderRadius: 9, fontSize: 13, color: t.textMid, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={submitAdminFill} style={{ padding: '8px 18px', background: t.blue, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Push to Scouter</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', borderRadius: 12, background: `${toast.color}25`, border: `1px solid ${toast.color}50`, color: toast.color, fontSize: 13, fontWeight: 600, zIndex: 900, pointerEvents: 'none', fontFamily: 'inherit' }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────
export default function AdminView({ onLogout }) {
  const [dark, setDark] = useState(() => {
    try { const s = localStorage.getItem('northstar_dark'); return s === null ? true : s === 'true' } catch { return true }
  })
  const t = tokens(dark)
  const [activePage, setActivePage] = useState('dashboard')
  const [dashTab, setDashTab] = useState('admin')
  const [modalOpen, setModalOpen] = useState(false)
  const [editGameId, setEditGameId] = useState(null)

  // Load from localStorage on mount. We call loadFromStorage() once and share
  // the result across all three state initialisers via a ref captured in a closure.
  const [settings, setSettings] = useState(() => {
    const stored = loadFromStorage()
    return stored?.settings || DEFAULT_SETTINGS
  })
  const [users, setUsers] = useState(() => {
    const stored = loadFromStorage()
    return stored?.users || DEFAULT_USERS
  })
  const [data, setData] = useState(() => {
    const stored = loadFromStorage()
    return stored?.data || DEFAULT_DATA
  })

  const onDeleteGame = async (id, e) => {
    if (e) e.preventDefault()
    // Update local state immediately (no reload)
    setData(d => ({ ...d, games: d.games.filter(g => g.id !== id) }))
    if (editGameId === id) setEditGameId(null)
    // Also sync to backend if connected
    try {
      await apiFetch(settings.backendUrl || 'https://taco-childhood-jailbreak.ngrok-free.dev', `/api/main/${id}`, { method: 'DELETE' })
    } catch { /* backend not required */ }
  }
  // Auto-save on any state change
  useEffect(() => {
    saveToStorage({ settings, users, data })
  }, [settings, users, data])

  // Persist theme
  useEffect(() => {
    try { localStorage.setItem('northstar_dark', dark) } catch { }
  }, [dark])

  function handleAddMember(member) { setUsers(u => ({ members: [...u.members, { ...member, id: u.nextId }], nextId: u.nextId + 1 })) }
  function handleChangeRole(id, role) { setUsers(u => ({ ...u, members: u.members.map(m => m.id === id ? { ...m, role } : m) })) }
  function handleRemoveMember(id) { setUsers(u => ({ ...u, members: u.members.filter(m => m.id !== id) })) }
  function handleSetActiveGame(id) { setData(d => ({ ...d, games: d.games.map(g => ({ ...g, status: g.id === id ? 'active' : (g.status === 'active' ? 'archived' : g.status) })) })) }
  function handleCreateGame(game) { setData(d => ({ ...d, games: [...d.games, { ...game, id: d.nextGameId }], nextGameId: d.nextGameId + 1 })); setModalOpen(false) }
  function handleSaveGame(updatedGame) { setData(d => ({ ...d, games: d.games.map(g => g.id === updatedGame.id ? updatedGame : g) })) }
  function handleDeleteGame(id) { setData(d => ({ ...d, games: d.games.filter(g => g.id !== id) })); if (editGameId === id) setEditGameId(null) }

  const editGame = editGameId ? data.games.find(g => g.id === editGameId) : null

  function handleExportData() {
    downloadJSON({ settings, users, data, exportedAt: new Date().toISOString() }, `northstar-export-${new Date().toISOString().slice(0, 10)}.json`)
  }

  function renderPage() {
    if (dashTab === 'comp') return <PageComp users={users} data={data} t={t} />
    switch (activePage) {
      case 'dashboard': return <PageDashboard users={users} data={data} onOpenModal={() => setModalOpen(true)} onSwitchPage={setActivePage} t={t} />
      case 'games': return <PageGames data={data} onOpenModal={() => setModalOpen(true)} onSetActiveGame={handleSetActiveGame} onEditGame={setEditGameId} onDeleteGame={onDeleteGame} t={t} />
      case 'account': return <PageAccount users={users} onAddMember={handleAddMember} onChangeRole={handleChangeRole} onRemoveMember={handleRemoveMember} t={t} />
      case 'matchdata': return <PageEmpty icon="matchdata" title="Match Data" desc="Start logging matches to see data here." t={t} />
      case 'analytics': return <PageEmpty icon="analytics" title="Analytics" desc="Charts and performance breakdowns appear as data is collected." t={t} />
      case 'exports': return <PageEmpty icon="exports" title="Exports" desc="Download match data as CSV or JSON to share with alliance partners." t={t} />
      case 'settings': return <PageSettings settings={settings} onSave={setSettings} t={t} />
      case 'appmanager': return <PageAppManager t={t} />
      default: return null
    }
  }

  return (
    <BackendCtx.Provider value={{ isBackend: !!settings.rpiEnabled, backendUrl: settings.backendUrl || 'https://taco-childhood-jailbreak.ngrok-free.dev' }}>
      <ThemeCtx.Provider value={{ dark }}>
        <style>{FONTS}</style>
        <style>{`* { box-sizing: border-box; } body { margin: 0; }`}</style>
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: t.bg, fontFamily: "'Instrument Sans', sans-serif", fontSize: 14, color: t.text }}>

          {/* Sidebar */}
          <div style={{ width: 224, flexShrink: 0, display: 'flex', flexDirection: 'column', background: t.surface, borderRight: `1px solid ${t.border}` }}>
            <div style={{ padding: '18px 14px 14px', borderBottom: `1px solid ${t.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: t.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {settings.teamNumber || 'NS'}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text, letterSpacing: '-0.2px' }}>Team {settings.teamNumber || '????'}</div>
                  <div style={{ fontSize: 11.5, color: t.textDim }}>{settings.teamName || 'NorthStar'}</div>
                </div>
              </div>
              <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '7px 11px', borderRadius: 9, background: t.surface2, border: `1px solid ${t.border2}`, color: t.textMid, fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${t.blue}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="plus" size={12} color={t.blue} />
                </div>
                New game setup
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {NAV.map(group => (
                <div key={group.section}>
                  <div style={{ padding: '12px 16px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textDim }}>{group.section}</div>
                  {group.items.map(item => {
                    const isActive = activePage === item.id && dashTab === 'admin'
                    return (
                      <div key={item.id} onClick={() => { setActivePage(item.id); setDashTab('admin') }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', margin: '1px 8px', borderRadius: 9, cursor: 'pointer', fontSize: 13, color: isActive ? t.text : t.textMid, fontWeight: isActive ? 600 : 400, background: isActive ? t.surface2 : 'transparent', border: isActive ? `1px solid ${t.border}` : '1px solid transparent', transition: 'all 0.12s' }}>
                        <Icon name={item.icon} size={15} color={isActive ? t.text : t.textDim} />
                        {item.label}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            <div style={{ padding: '12px 14px', borderTop: `1px solid ${t.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                <Avatar name="Admin" size={32} t={t} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Admin</div>
                  <div style={{ fontSize: 11.5, color: t.textDim }}>Coach</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <button onClick={() => setDark(d => !d)} title="Toggle theme" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 0', background: t.surface2, border: `1px solid ${t.border2}`, borderRadius: 9, fontSize: 12, color: t.textMid, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Icon name={dark ? 'sun' : 'moon'} size={13} color={t.textMid} />
                  {dark ? 'Light' : 'Dark'}
                </button>
                {onLogout && (
                  <button onClick={onLogout} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 0', background: t.surface2, border: `1px solid ${t.border2}`, borderRadius: 9, fontSize: 12, color: t.textMid, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Icon name="logout" size={13} color={t.textMid} /> Sign out
                  </button>
                )}
              </div>
              <button onClick={handleExportData} title="Export all data as JSON" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 0', background: t.surface2, border: `1px solid ${t.border2}`, borderRadius: 9, fontSize: 12, color: t.textMid, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Icon name="download" size={13} color={t.textMid} /> Export data
              </button>
            </div>
          </div>

          {/* Main area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: `1px solid ${t.border}`, background: t.surface, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <span style={{ fontSize: 16, fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: t.text, letterSpacing: '-0.3px' }}>NorthStar</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[['admin', 'Admin dashboard'], ['comp', 'Competition']].map(([id, label]) => {
                    const on = dashTab === id
                    return (
                      <button key={id} onClick={() => setDashTab(id)} style={{ padding: '5px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: on ? 600 : 400, cursor: 'pointer', border: on ? `1px solid ${t.border}` : '1px solid transparent', background: on ? t.surface2 : 'transparent', color: on ? t.text : t.textMid, fontFamily: 'inherit', transition: 'all 0.12s' }}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.textMid, padding: '4px 10px', borderRadius: 99, border: `1px solid ${t.border}` }}>
                  <Icon name="dot" size={8} color={t.green} /> Season active
                </span>
                <Clock t={t} />
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: t.bg }}>
              {renderPage()}
            </div>
          </div>
        </div>

        {modalOpen && <GameModal onClose={() => setModalOpen(false)} onCreate={handleCreateGame} t={t} />}
        {editGame && <GameEditor game={editGame} onClose={() => setEditGameId(null)} onSave={game => { handleSaveGame(game); }} t={t} />}
      </ThemeCtx.Provider>
    </BackendCtx.Provider>
  )
}