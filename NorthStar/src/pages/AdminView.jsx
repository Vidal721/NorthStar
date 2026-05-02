import { useState, useEffect, createContext, useContext } from 'react'

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
`

// ── Theme Context ─────────────────────────────────────────────
const ThemeCtx = createContext({ dark: true })
const useTheme = () => useContext(ThemeCtx)

// ── Constants ─────────────────────────────────────────────────
const ROLE_LABELS = { coach: 'Coach', lead: 'Lead Scout', assistant: 'Asst. Scout', scouter: 'Scouter' }

const DEFAULT_SETTINGS = {
  teamNumber: '4028', teamName: 'Bravely Bold',
  adminRoles: ['coach', 'lead'],
  colors: { primary: '#0a84ff', secondary: '#bf5af2', accent: '#ffd60a' },
  display: { mode: 'Dark', fontSizePx: 14, cardStyle: 'Glass', density: 'Default' },
}
const DEFAULT_USERS = {
  members: [
    { id: 1, name: 'Jordan Davis',  username: 'jordan', role: 'lead',      mins: 312, matches: 21, status: 'active', email: 'jordan@team4028.com' },
    { id: 2, name: 'Alex Martinez', username: 'alex',   role: 'assistant', mins: 224, matches: 18, status: 'active', email: 'alex@team4028.com' },
    { id: 3, name: 'Casey Rivera',  username: 'casey',  role: 'scouter',   mins: 198, matches: 15, status: 'active', email: 'casey@team4028.com' },
    { id: 4, name: 'Morgan Chen',   username: 'morgan', role: 'coach',     mins: 89,  matches: 0,  status: 'active', email: 'morgan@team4028.com' },
  ],
  nextId: 5,
}
const DEFAULT_DATA = {
  games: [
    { id: 1, name: 'Reefscape 2025', year: 2025, matches: 37,  scouts: 6, status: 'active',   created: '2025-01-04' },
    { id: 2, name: 'Crescendo 2024', year: 2024, matches: 112, scouts: 8, status: 'archived', created: '2024-01-06' },
  ],
  activity: [
    { text: 'Alex M. logged 22 scouting minutes — Match 38 vs Team 1114', time: '12 min ago' },
    { text: 'Casey R. submitted form for Team 254 — Qualification round',  time: '38 min ago' },
    { text: 'Jordan D. flagged Team 973 data for review',                   time: '1 hr ago' },
  ],
  nextGameId: 3,
}

// ── Helpers ───────────────────────────────────────────────────
function initials(n) {
  return (n || '').trim().split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() || '??'
}

// ── SVG Icons ─────────────────────────────────────────────────
const Icon = ({ name, size = 16, color = 'currentColor' }) => {
  const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    games:     <><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></>,
    account:   <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    matchdata: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></>,
    analytics: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    exports:   <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    settings:  <><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></>,
    appmanager:<><rect x="2" y="3" width="7" height="7" rx="1"/><rect x="15" y="3" width="7" height="7" rx="1"/><rect x="2" y="14" width="7" height="7" rx="1"/><path d="M15 17.5h7M18.5 14v7"/></>,
    plus:      <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    logout:    <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    sun:       <><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></>,
    moon:      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>,
    trophy:    <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></>,
    check:     <polyline points="20,6 9,17 4,12"/>,
    trash:     <><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>,
    external:  <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></>,
    activity:  <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>,
    flag:      <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></>,
    users:     <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    clock:     <><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></>,
    dot:       <circle cx="12" cy="12" r="4" fill="currentColor"/>,
    x:         <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  )
}

// ── Theme tokens ──────────────────────────────────────────────
function tokens(dark) {
  return dark ? {
    bg:       '#0a0a0a',
    surface:  '#111111',
    surface2: '#181818',
    border:   '#222222',
    border2:  '#2a2a2a',
    text:     '#f0f0f0',
    textMid:  '#888888',
    textDim:  '#444444',
    accent:   '#f0f0f0',
    blue:     '#3b82f6',
    green:    '#22c55e',
    amber:    '#f59e0b',
    red:      '#ef4444',
    purple:   '#a78bfa',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #a78bfa 100%)',
  } : {
    bg:       '#f5f5f4',
    surface:  '#ffffff',
    surface2: '#fafaf9',
    border:   '#e5e5e5',
    border2:  '#d4d4d4',
    text:     '#111111',
    textMid:  '#737373',
    textDim:  '#a3a3a3',
    accent:   '#111111',
    blue:     '#2563eb',
    green:    '#16a34a',
    amber:    '#d97706',
    red:      '#dc2626',
    purple:   '#7c3aed',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
  }
}

// ── Nav config ────────────────────────────────────────────────
const NAV = [
  { section: 'Main', items: [
    { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
    { id: 'games',     icon: 'games',     label: 'Games' },
    { id: 'account',  icon: 'account',   label: 'Team & Accounts' },
  ]},
  { section: 'Scouting', items: [
    { id: 'matchdata',  icon: 'matchdata',  label: 'Match Data' },
    { id: 'analytics',  icon: 'analytics',  label: 'Analytics' },
    { id: 'exports',    icon: 'exports',    label: 'Exports' },
  ]},
  { section: 'Config', items: [
    { id: 'settings',    icon: 'settings',    label: 'Settings' },
    { id: 'appmanager',  icon: 'appmanager',  label: 'App Manager' },
  ]},
]

// ── Clock ─────────────────────────────────────────────────────
function Clock({ t }) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), 1000)
    return () => clearInterval(id)
  }, [])
  return <span style={{ fontSize: '12px', color: t.textDim, fontVariantNumeric: 'tabular-nums' }}>{time}</span>
}

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ name, size = 28, t }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: t.gradient, color: '#fff', fontSize: size * 0.38, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, letterSpacing: '-0.02em' }}>
      {initials(name)}
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────
function Toggle({ on, onChange, t }) {
  return (
    <div onClick={() => onChange(!on)} style={{ position: 'relative', width: 38, height: 22, cursor: 'pointer', flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 99, background: on ? t.blue : t.border2, transition: 'background 0.2s', border: `1px solid ${on ? t.blue : t.border}` }} />
      <div style={{ position: 'absolute', top: 3, left: on ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </div>
  )
}

// ── RoleBadge ─────────────────────────────────────────────────
function RoleBadge({ role, t }) {
  const styles = {
    lead:      { bg: `${t.blue}22`, color: t.blue },
    coach:     { bg: `${t.green}22`, color: t.green },
    assistant: { bg: `${t.purple}22`, color: t.purple },
    scouter:   { bg: t.surface2, color: t.textMid },
  }
  const s = styles[role] || styles.scouter
  return <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 9px', borderRadius: 99, background: s.bg, color: s.color, letterSpacing: '0.01em' }}>{ROLE_LABELS[role] || role}</span>
}

// ── ScoutRow ──────────────────────────────────────────────────
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

// ── ActRow ────────────────────────────────────────────────────
function ActRow({ a, t }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: `1px solid ${t.border}` }}>
      <div style={{ marginTop: 5, flexShrink: 0, color: t.blue }}><Icon name="dot" size={8} color={t.blue} /></div>
      <div>
        <div style={{ fontSize: 12.5, color: t.textMid, lineHeight: 1.5 }}>{a.text}</div>
        <div style={{ fontSize: 11, color: t.textDim, marginTop: 2 }}>{a.time}</div>
      </div>
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────
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

// ── MetricCard ────────────────────────────────────────────────
function MetricCard({ label, value, sub, subColor, t }) {
  return (
    <div style={{ borderRadius: 12, padding: '16px 18px', background: t.surface, border: `1px solid ${t.border}` }}>
      <div style={{ fontSize: 11, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: t.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: subColor || t.textDim, marginTop: 6 }}>{sub}</div>
    </div>
  )
}

// ── Pages ─────────────────────────────────────────────────────
function PageDashboard({ users, data, onOpenModal, onSwitchPage, t }) {
  const members = users.members
  const totalMins = members.reduce((s, x) => s + (x.mins || 0), 0)
  const activeCount = members.filter(x => x.status === 'active').length
  const activeGame = data.games.find(g => g.status === 'active')
  const topScouts = [...members].filter(m => m.role !== 'coach').sort((a, b) => b.mins - a.mins).slice(0, 4)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
        <MetricCard label="Total scout mins" value={totalMins.toLocaleString()} sub="this season" subColor={t.green} t={t} />
        <MetricCard label="Active scouts" value={activeCount} sub={`of ${members.length} members`} t={t} />
        <MetricCard label="Matches logged" value={activeGame ? activeGame.matches : 0} sub="current game" subColor={t.blue} t={t} />
        <MetricCard label="Flags pending" value={2} sub="Needs review" subColor={t.amber} t={t} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Panel title="Scout leaderboard" action="View all" onAction={() => onSwitchPage('account')} t={t}>
          {topScouts.length ? topScouts.map(m => <ScoutRow key={m.id} m={m} t={t} />) : <div style={{ fontSize: 12, color: t.textDim, padding: '8px 0' }}>No scouts yet.</div>}
        </Panel>
        <Panel title="Recent games" action="+ New" onAction={onOpenModal} t={t}>
          {data.games.slice(0, 3).map(g => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${t.border}` }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: t.surface2, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMid }}>
                <Icon name={g.status === 'active' ? 'trophy' : 'settings'} size={15} color={g.status === 'active' ? t.amber : t.textDim} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{g.name}</div>
                <div style={{ fontSize: 11.5, color: t.textDim }}>{g.matches} matches</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: g.status === 'active' ? `${t.green}22` : t.surface2, color: g.status === 'active' ? t.green : t.textDim }}>{g.status === 'active' ? 'Active' : 'Archived'}</span>
            </div>
          ))}
        </Panel>
      </div>
      <Panel title="Recent activity" t={t}>
        {data.activity.slice(0, 5).map((a, i) => <ActRow key={i} a={a} t={t} />)}
      </Panel>
    </div>
  )
}

function PageGames({ data, onOpenModal, onSetActiveGame, t }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
      <Panel title="Game library" action={null} t={t} style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 10, right: 18 }}>
          <button onClick={onOpenModal} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: t.accent, color: t.bg === '#0a0a0a' ? '#000' : '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Icon name="plus" size={13} color={t.bg === '#0a0a0a' ? '#000' : '#fff'} /> New game
          </button>
        </div>
        {data.games.length ? data.games.map(g => (
          <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `1px solid ${t.border}` }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: t.surface2, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={g.status === 'active' ? 'trophy' : 'settings'} size={16} color={g.status === 'active' ? t.amber : t.textDim} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{g.name}</div>
              <div style={{ fontSize: 12, color: t.textDim }}>{g.matches} matches · Created {g.created}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: g.status === 'active' ? `${t.green}22` : t.surface2, color: g.status === 'active' ? t.green : t.textDim }}>{g.status === 'active' ? 'Active' : 'Archived'}</span>
            {g.status !== 'active' && (
              <button onClick={() => onSetActiveGame(g.id)} style={{ padding: '5px 11px', background: 'transparent', border: `1px solid ${t.border2}`, borderRadius: 8, fontSize: 12, color: t.textMid, cursor: 'pointer', fontFamily: 'inherit' }}>Set active</button>
            )}
          </div>
        )) : <div style={{ fontSize: 13, color: t.textDim, padding: '12px 0' }}>No games yet.</div>}
      </Panel>
    </div>
  )
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
          {['name','username','email'].map(f => (
            <input key={f} style={inputStyle} placeholder={f.charAt(0).toUpperCase()+f.slice(1)} value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} />
          ))}
          <input style={inputStyle} placeholder="Password" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
          <select style={{ ...inputStyle, flex: '0 0 auto', minWidth: 130, cursor: 'pointer' }} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
            {['scouter','assistant','lead','coach'].map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <button onClick={handleAdd} style={{ padding: '8px 16px', background: t.accent, color: t.bg === '#0a0a0a' ? '#000' : '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Add member</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>{['Member','Username','Role','Scout mins','Matches','Status',''].map(h => (
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
                    {['coach','lead','assistant','scouter'].map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
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
  const [saved, setSaved] = useState(false)
  const inputStyle = { padding: '8px 12px', fontSize: 13, borderRadius: 9, border: `1px solid ${t.border2}`, background: t.surface2, color: t.text, outline: 'none', fontFamily: 'inherit', minWidth: 180 }

  function toggleRole(r) { setAdminRoles(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r]) }
  function handleSave() {
    onSave({ ...settings, teamNumber, teamName, adminRoles, perUserDashboard: perUser })
    setSaved(true); setTimeout(() => setSaved(false), 2500)
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
  const Row = ({ label, sub, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${t.border}`, gap: 16 }}>
      <div><div style={{ fontSize: 13.5, fontWeight: 500, color: t.text }}>{label}</div>{sub && <div style={{ fontSize: 12, color: t.textMid, marginTop: 2 }}>{sub}</div>}</div>
      {children}
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <Section title="Team info" sub="Core identity shown throughout NorthStar">
          <Row label="Team number" sub="Your FRC team number"><input style={inputStyle} placeholder="4028" value={teamNumber} onChange={e => setTeamNumber(e.target.value)} /></Row>
          <Row label="Team name" sub="Shown in the sidebar"><input style={inputStyle} placeholder="Bravely Bold" value={teamName} onChange={e => setTeamName(e.target.value)} /></Row>
        </Section>
        <Section title="Access control" sub="Which roles can access the admin dashboard">
          <Row label="Admin roles" sub="Users with these roles can access this panel">
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {['coach','lead','assistant','scouter'].map(r => {
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
          <Row label="Per-user dashboards" sub="Everyone logs in to their personal view"><Toggle on={perUser} onChange={setPerUser} t={t} /></Row>
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
        <div onClick={() => window.open('http://localhost:3000', '_blank')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}>
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
  const me = users.members[0]
  const ranked = [...users.members].filter(x => x.role !== 'coach').sort((a, b) => b.mins - a.mins)
  const rank = ranked.findIndex(x => x.id === me.id) + 1
  const activeGame = data.games.find(g => g.status === 'active')

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
        <MetricCard label="My scout mins" value={me.mins} sub="this season" t={t} />
        <MetricCard label="Matches logged" value={me.matches} sub="keep it up" subColor={t.green} t={t} />
        <MetricCard label="Team rank" value={rank > 0 ? `#${rank}` : '#—'} sub="by scout minutes" t={t} />
      </div>
      <Panel title="Active game" t={t} style={{ marginBottom: 14 }}>
        {activeGame ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: t.surface2, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="trophy" size={16} color={t.amber} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{activeGame.name}</div>
              <div style={{ fontSize: 12, color: t.textDim }}>{activeGame.matches} matches · Started {activeGame.created}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: `${t.green}22`, color: t.green }}>Active</span>
          </div>
        ) : <div style={{ fontSize: 13, color: t.textDim, padding: '8px 0' }}>No active game set.</div>}
      </Panel>
      <Panel title="Recent activity" t={t} style={{ marginBottom: 14 }}>
        {data.activity.slice(0, 5).map((a, i) => <ActRow key={i} a={a} t={t} />)}
      </Panel>
      <Panel title="Leaderboard" t={t}>
        {ranked.map(m => <ScoutRow key={m.id} m={m} t={t} />)}
      </Panel>
    </div>
  )
}

// ── Game Modal ────────────────────────────────────────────────
function GameModal({ onClose, onCreate, t }) {
  const [form, setForm] = useState({ name: '', year: '', event: '', date: '' })
  const inputStyle = { width: '100%', padding: '9px 12px', fontSize: 13, background: t.surface2, border: `1px solid ${t.border2}`, borderRadius: 9, color: t.text, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.textDim, marginBottom: 5 }

  function handleCreate() {
    if (!form.name) return
    onCreate({ name: form.name, year: parseInt(form.year) || new Date().getFullYear(), event: form.event || '', created: form.date || new Date().toISOString().slice(0, 10), matches: 0, scouts: 0, status: 'draft' })
  }
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '52px 20px', zIndex: 500, overflowY: 'auto' }}>
      <div style={{ background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 16, padding: 26, width: '100%', maxWidth: 440, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: '50%', background: t.surface2, border: `1px solid ${t.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMid }}>
          <Icon name="x" size={14} color={t.textMid} />
        </button>
        <div style={{ fontSize: 17, fontFamily: "'Instrument Serif', serif", color: t.text, marginBottom: 3 }}>Set up a new game</div>
        <div style={{ fontSize: 12.5, color: t.textMid, marginBottom: 20 }}>Basic details — custom fields can be added later</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[['Game name','text','name','Reefscape 2026'],['Season year','number','year','2026'],['Event','text','event','District Championship'],['Start date','date','date','']].map(([label,type,key,ph]) => (
            <div key={key}><label style={labelStyle}>{label}</label><input style={inputStyle} type={type} placeholder={ph} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} /></div>
          ))}
        </div>
        <div style={{ height: 1, background: t.border, margin: '18px 0' }} />
        <div style={{ fontSize: 11, fontWeight: 600, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Scouting form fields</div>
        {['Custom counters, toggles, sliders — coming soon','Scoring logic builder — coming soon'].map(txt => (
          <div key={txt} style={{ background: t.surface2, border: `1px dashed ${t.border2}`, borderRadius: 9, padding: 13, fontSize: 12.5, color: t.textDim, textAlign: 'center', marginBottom: 8 }}>{txt}</div>
        ))}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${t.border2}`, borderRadius: 9, fontSize: 13, color: t.textMid, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleCreate} style={{ padding: '8px 16px', background: t.accent, color: t.bg === '#0a0a0a' ? '#000' : '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Create game</button>
        </div>
      </div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────
export default function AdminView({ onLogout }) {
  const [dark, setDark] = useState(true)
  const t = tokens(dark)
  const [activePage, setActivePage] = useState('dashboard')
  const [dashTab, setDashTab] = useState('admin')
  const [modalOpen, setModalOpen] = useState(false)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [users, setUsers] = useState(DEFAULT_USERS)
  const [data, setData] = useState(DEFAULT_DATA)

  function handleAddMember(member) { setUsers(u => ({ members: [...u.members, { ...member, id: u.nextId }], nextId: u.nextId + 1 })) }
  function handleChangeRole(id, role) { setUsers(u => ({ ...u, members: u.members.map(m => m.id === id ? { ...m, role } : m) })) }
  function handleRemoveMember(id) { setUsers(u => ({ ...u, members: u.members.filter(m => m.id !== id) })) }
  function handleSetActiveGame(id) { setData(d => ({ ...d, games: d.games.map(g => ({ ...g, status: g.id === id ? 'active' : (g.status === 'active' ? 'archived' : g.status) })) })) }
  function handleCreateGame(game) { setData(d => ({ ...d, games: [...d.games, { ...game, id: d.nextGameId }], nextGameId: d.nextGameId + 1 })); setModalOpen(false) }

  function renderPage() {
    if (dashTab === 'comp') return <PageComp users={users} data={data} t={t} />
    switch (activePage) {
      case 'dashboard': return <PageDashboard users={users} data={data} onOpenModal={() => setModalOpen(true)} onSwitchPage={setActivePage} t={t} />
      case 'games':     return <PageGames data={data} onOpenModal={() => setModalOpen(true)} onSetActiveGame={handleSetActiveGame} t={t} />
      case 'account':   return <PageAccount users={users} onAddMember={handleAddMember} onChangeRole={handleChangeRole} onRemoveMember={handleRemoveMember} t={t} />
      case 'matchdata': return <PageEmpty icon="matchdata" title="Match Data" desc="Start logging matches to see data here." t={t} />
      case 'analytics': return <PageEmpty icon="analytics" title="Analytics" desc="Charts and performance breakdowns appear as data is collected." t={t} />
      case 'exports':   return <PageEmpty icon="exports" title="Exports" desc="Download match data as CSV or JSON to share with alliance partners." t={t} />
      case 'settings':  return <PageSettings settings={settings} onSave={setSettings} t={t} />
      case 'appmanager':return <PageAppManager t={t} />
      default:          return null
    }
  }

  return (
    <ThemeCtx.Provider value={{ dark }}>
      <style>{FONTS}</style>
      <style>{`* { box-sizing: border-box; } body { margin: 0; }`}</style>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: t.bg, fontFamily: "'Instrument Sans', sans-serif", fontSize: 14, color: t.text }}>

        {/* Sidebar */}
        <div style={{ width: 224, flexShrink: 0, display: 'flex', flexDirection: 'column', background: t.surface, borderRight: `1px solid ${t.border}` }}>
          {/* Team badge */}
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

          {/* Nav */}
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

          {/* User + logout */}
          <div style={{ padding: '12px 14px', borderTop: `1px solid ${t.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
              <Avatar name="Admin" size={32} t={t} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Admin</div>
                <div style={{ fontSize: 11.5, color: t.textDim }}>Coach</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setDark(d => !d)}
                title="Toggle theme"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 0', background: t.surface2, border: `1px solid ${t.border2}`, borderRadius: 9, fontSize: 12, color: t.textMid, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <Icon name={dark ? 'sun' : 'moon'} size={13} color={t.textMid} />
                {dark ? 'Light' : 'Dark'}
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 0', background: t.surface2, border: `1px solid ${t.border2}`, borderRadius: 9, fontSize: 12, color: t.textMid, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <Icon name="logout" size={13} color={t.textMid} /> Sign out
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Topbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: `1px solid ${t.border}`, background: t.surface, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <span style={{ fontSize: 16, fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: t.text, letterSpacing: '-0.3px' }}>NorthStar</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {[['admin','Admin dashboard'],['comp','Competition']].map(([id, label]) => {
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

          {/* Page content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: t.bg }}>
            {renderPage()}
          </div>
        </div>
      </div>
      {modalOpen && <GameModal onClose={() => setModalOpen(false)} onCreate={handleCreateGame} t={t} />}
    </ThemeCtx.Provider>
  )
}