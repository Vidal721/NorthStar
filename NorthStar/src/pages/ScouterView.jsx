import { useState, useEffect } from 'react'

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;600&display=swap');
`

// ── Theme tokens ──────────────────────────────────────────────
function tokens(dark) {
  return dark ? {
    bg: '#0a0a0a', surface: '#111111', surface2: '#181818',
    border: '#222222', border2: '#2a2a2a',
    text: '#f0f0f0', textMid: '#888888', textDim: '#444444', accent: '#f0f0f0',
    blue: '#3b82f6', green: '#22c55e', amber: '#f59e0b',
    red: '#ef4444', purple: '#a78bfa',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #a78bfa 100%)',
  } : {
    bg: '#f5f5f4', surface: '#ffffff', surface2: '#fafaf9',
    border: '#e5e5e5', border2: '#d4d4d4',
    text: '#111111', textMid: '#737373', textDim: '#a3a3a3', accent: '#111111',
    blue: '#2563eb', green: '#16a34a', amber: '#d97706',
    red: '#dc2626', purple: '#7c3aed',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
  }
}

function initials(n) {
  return (n || '').trim().split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() || '??'
}

// ── Clock ─────────────────────────────────────────────────────
function Clock({ t }) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), 1000)
    return () => clearInterval(id)
  }, [])
  return <span style={{ fontSize: 12, color: t.textDim, fontVariantNumeric: 'tabular-nums' }}>{time}</span>
}

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ name, size = 28, t }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: t.gradient, color: '#fff', fontSize: size * 0.38, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, letterSpacing: '-0.02em' }}>
      {initials(name)}
    </div>
  )
}

// ── Icon ──────────────────────────────────────────────────────
const Icon = ({ name, size = 16, color = 'currentColor' }) => {
  const icons = {
    sun:     <><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></>,
    moon:    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>,
    logout:  <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    x:       <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    dot:     <circle cx="12" cy="12" r="4" fill="currentColor"/>,
    target:  <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
    robot:   <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M12 2v4"/><path d="M8 6h8"/><circle cx="9" cy="16" r="1" fill="currentColor"/><circle cx="15" cy="16" r="1" fill="currentColor"/><line x1="9" y1="19" x2="15" y2="19"/></>,
    clipboard:<><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></>,
    trophy:  <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></>,
    clock:   <><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></>,
    map:     <><polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2 1,6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></>,
    activity:<polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>,
    flag:    <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></>,
    chevronRight: <polyline points="9,18 15,12 9,6"/>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  )
}

// ── Stat pill ─────────────────────────────────────────────────
function StatPill({ icon, label, value, t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10 }}>
      <Icon name={icon} size={14} color={t.textDim} />
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text, lineHeight: 1.2 }}>{value}</div>
      </div>
    </div>
  )
}

// ── Launch card ───────────────────────────────────────────────
function LaunchCard({ icon, title, subtitle, description, accentColor, badgeLabel, onClick, t }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        minWidth: 0,
        borderRadius: 16,
        border: `1px solid ${hovered ? accentColor + '60' : t.border}`,
        background: hovered ? accentColor + '08' : t.surface,
        padding: '28px 28px 24px',
        cursor: 'pointer',
        transition: 'all 0.16s cubic-bezier(0.16,1,0.3,1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: hovered ? `0 8px 32px ${accentColor}18` : 'none',
      }}
    >
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 140, height: 140, borderRadius: '50%',
        background: accentColor + (hovered ? '12' : '06'),
        transition: 'background 0.2s',
        pointerEvents: 'none',
      }} />

      {/* Badge */}
      {badgeLabel && (
        <div style={{
          position: 'absolute', top: 16, right: 16,
          fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
          background: accentColor + '22', color: accentColor, letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>{badgeLabel}</div>
      )}

      {/* Icon */}
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: accentColor + '18',
        border: `1px solid ${accentColor}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
        transition: 'all 0.16s',
        transform: hovered ? 'scale(1.06)' : 'scale(1)',
      }}>
        <Icon name={icon} size={24} color={accentColor} />
      </div>

      {/* Text */}
      <div style={{ fontSize: 20, fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: t.text, marginBottom: 6, letterSpacing: '-0.3px' }}>{title}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: accentColor, marginBottom: 10 }}>{subtitle}</div>
      <div style={{ fontSize: 12.5, color: t.textMid, lineHeight: 1.6, flex: 1 }}>{description}</div>

      {/* Footer arrow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 20, fontSize: 12, fontWeight: 600, color: accentColor, opacity: hovered ? 1 : 0.5, transition: 'opacity 0.15s' }}>
        Open scouting form <Icon name="chevronRight" size={13} color={accentColor} />
      </div>
    </div>
  )
}

// ── Recent session row ────────────────────────────────────────
function SessionRow({ session, t }) {
  const typeColor = session.type === 'match' ? t.blue : t.purple
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${t.border}` }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: typeColor + '18', border: `1px solid ${typeColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={session.type === 'match' ? 'clipboard' : 'robot'} size={13} color={typeColor} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{session.label}</div>
        <div style={{ fontSize: 11, color: t.textDim }}>{session.time}</div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: typeColor + '18', color: typeColor }}>
        {session.type === 'match' ? 'Match' : 'Pit'}
      </span>
    </div>
  )
}

// ── Main ScouterView ──────────────────────────────────────────
export default function ScouterView({ user, dark: initialDark = true, onLogout }) {
  const [dark, setDark] = useState(initialDark)
  const t = tokens(dark)

  const currentUser = user || { name: 'Casey Rivera', role: 'scouter', mins: 198, matches: 15 }
  const launch = (url) => { window.location.href = url }

  const recentSessions = [
    { type: 'match', label: 'Team 254 — Qualification 38', time: '12 min ago' },
    { type: 'match', label: 'Team 1114 — Qualification 37', time: '38 min ago' },
    { type: 'pit',   label: 'Team 971 — Pit inspection',   time: '1 hr ago' },
    { type: 'match', label: 'Team 118 — Qualification 35',  time: '2 hr ago' },
    { type: 'pit',   label: 'Team 1678 — Pit inspection',   time: '3 hr ago' },
  ]

  return (
    <>
      <style>{FONTS}</style>
      <style>{`* { box-sizing: border-box; } body { margin: 0; }`}</style>

      <div style={{
        minHeight: '100vh',
        background: t.bg,
        fontFamily: "'Instrument Sans', sans-serif",
        fontSize: 14,
        color: t.text,
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '11px 24px',
          background: t.surface,
          borderBottom: `1px solid ${t.border}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: t.text, letterSpacing: '-0.3px' }}>NorthStar</span>
          <div style={{ width: 1, height: 18, background: t.border }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: t.textMid }}>Scouter</span>
          <div style={{ flex: 1 }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.textMid, padding: '4px 10px', borderRadius: 99, border: `1px solid ${t.border}` }}>
            <Icon name="dot" size={8} color={t.green} /> Season active
          </span>
          <Clock t={t} />
          <button onClick={() => setDark(d => !d)} style={{ width: 32, height: 32, borderRadius: 9, background: t.surface2, border: `1px solid ${t.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textMid }}>
            <Icon name={dark ? 'sun' : 'moon'} size={14} color={t.textMid} />
          </button>
          {onLogout && (
            <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: t.surface2, border: `1px solid ${t.border2}`, borderRadius: 9, fontSize: 12, color: t.textMid, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Icon name="logout" size={13} color={t.textMid} /> Sign out
            </button>
          )}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 28px', maxWidth: 920, margin: '0 auto', width: '100%' }}>

          {/* Greeting */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Avatar name={currentUser.name} size={40} t={t} />
              <div>
                <div style={{ fontSize: 22, fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: t.text, letterSpacing: '-0.4px' }}>
                  Hey, {currentUser.name.split(' ')[0]} 👋
                </div>
                <div style={{ fontSize: 12.5, color: t.textMid, marginTop: 1 }}>Ready to scout? Choose a mode below.</div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
            <StatPill icon="trophy" label="Matches scouted" value={currentUser.matches} t={t} />
            <StatPill icon="clock" label="Scout minutes" value={currentUser.mins} t={t} />
            <StatPill icon="activity" label="Today's sessions" value="2" t={t} />
            <StatPill icon="flag" label="Pending flags" value="0" t={t} />
          </div>

          {/* Launch cards */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 32, flexWrap: 'wrap' }}>
            <LaunchCard
              icon="clipboard"
              title="Match Scouting"
              subtitle="Track robot performance"
              description="Log field actions, auto & teleop scoring, endgame results, and driver ratings during live matches."
              accentColor={t.blue}
              badgeLabel="Active"
              onClick={() => launch('https://taco-childhood-jailbreak.ngrok-free.dev/scout.html')}
              t={t}
            />
            <LaunchCard
              icon="robot"
              title="Pit Scouting"
              subtitle="Inspect robots in the pits"
              description="Record robot specs, drivetrain type, capabilities, and team notes between matches in the pit area."
              accentColor={t.purple}
              onClick={() => launch('https://taco-childhood-jailbreak.ngrok-free.dev')}
              t={t}
            />
          </div>

          {/* Recent sessions */}
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Recent sessions</span>
              <span style={{ fontSize: 11.5, color: t.textDim }}>{recentSessions.length} entries</span>
            </div>
            <div style={{ padding: '4px 18px 10px' }}>
              {recentSessions.map((s, i) => <SessionRow key={i} session={s} t={t} />)}
            </div>
          </div>

        </div>
      </div>

    </>
  )
}