import { useState } from "react"
import ScouterView from "./pages/ScouterView"
import AdminView from "./pages/AdminView"
import DriveView from "./pages/DriveView"

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
`

const credentials = { "1": "scouter", "2": "admin", "3": "drive" }

const ROLE_META = {
  admin:   { label: "Admin panel",  badge: "Admin",   badgeColor: "#ef4444", badgeBg: "rgba(239,68,68,0.12)" },
  scouter: { label: "Scouter view", badge: "Scouter", badgeColor: "#22c55e", badgeBg: "rgba(34,197,94,0.12)" },
  drive:   { label: "Drive team",   badge: "Drive",   badgeColor: "#3b82f6", badgeBg: "rgba(59,130,246,0.12)" },
  guest:   { label: "Guest view",   badge: "Guest",   badgeColor: "#737373", badgeBg: "rgba(115,115,115,0.12)" },
}

function ViewShell({ role, children, onLogout, dark, onToggleDark }) {
  const meta = ROLE_META[role] || ROLE_META.guest
  const t = dark ? darkTokens : lightTokens

  return (
    <>
      <style>{FONTS}</style>
      <style>{`* { box-sizing: border-box; } body { margin: 0; }`}</style>
      <div style={{ minHeight: "100vh", background: t.bg, fontFamily: "'Instrument Sans', sans-serif", color: t.text }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 28px", borderBottom: `1px solid ${t.border}`, background: t.surface }}>
          <span style={{ fontSize: 22, fontFamily: "'Bebas Neue', sans-serif", color: t.text, letterSpacing: "0.04em" }}>NorthStar</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: meta.badgeBg, color: meta.badgeColor, letterSpacing: "0.04em" }}>{meta.badge}</span>
            <button onClick={onToggleDark} style={{ padding: "5px 11px", background: "transparent", border: `1px solid ${t.border2}`, borderRadius: 7, fontSize: 12, color: t.textMid, cursor: "pointer", fontFamily: "inherit" }}>
              {dark ? "☀ Light" : "☾ Dark"}
            </button>
            <button onClick={onLogout} style={{ padding: "5px 11px", background: "transparent", border: `1px solid ${t.border2}`, borderRadius: 7, fontSize: 12, color: t.textMid, cursor: "pointer", fontFamily: "inherit" }}>
              Sign out
            </button>
          </div>
        </header>
        <main style={{ padding: "28px" }}>{children}</main>
      </div>
    </>
  )
}

const darkTokens = {
  bg: "#0a0a0a", surface: "#111", surface2: "#181818",
  border: "#1e1e1e", border2: "#2a2a2a",
  text: "#f0f0f0", textMid: "#777", textDim: "#383838",
  inputBg: "#0d0d0d",
  blue: "#3b82f6",
}
const lightTokens = {
  bg: "#f2ede8", surface: "#ffffff", surface2: "#fafaf9",
  border: "#e5e5e5", border2: "#d4d4d4",
  text: "#111", textMid: "#737373", textDim: "#b0a89e",
  inputBg: "#f9f9f8",
  blue: "#2563eb",
}

export default function App() {
  const [userRole, setUserRole] = useState(() => {
    try { return sessionStorage.getItem('northstar_role') || null } catch { return null }
  })
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [focused, setFocused] = useState(false)
  const [dark, setDark] = useState(() => {
    try { const s = localStorage.getItem('northstar_dark'); return s === null ? true : s === 'true' } catch { return true }
  })
  const t = dark ? darkTokens : lightTokens

  const setDarkPersist = (val) => {
    setDark(val)
    try { localStorage.setItem('northstar_dark', val) } catch {}
  }

  const logout = () => {
    try { sessionStorage.removeItem('northstar_role') } catch {}
    setUserRole(null); setPassword(""); setError("")
  }
  const handleLogin = () => {
    const role = credentials[password]
    if (role) {
      try { sessionStorage.setItem('northstar_role', role) } catch {}
      setUserRole(role); setError("")
    } else setError("Incorrect access code.")
  }
  const setGuestRole = () => {
    try { sessionStorage.setItem('northstar_role', 'guest') } catch {}
    setUserRole('guest')
  }

  if (userRole === "admin") return <AdminView onLogout={logout} />

  if (userRole === "scouter") return (
    <ViewShell role="scouter" onLogout={logout} dark={dark} onToggleDark={() => setDarkPersist(!dark)}>
      <ScouterView />
    </ViewShell>
  )

  if (userRole === "drive") return (
    <ViewShell role="drive" onLogout={logout} dark={dark} onToggleDark={() => setDarkPersist(!dark)}>
      <DriveView />
    </ViewShell>
  )

  if (userRole === "guest") return (
    <ViewShell role="guest" onLogout={logout} dark={dark} onToggleDark={() => setDarkPersist(!dark)}>
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: "3rem", textAlign: "center", color: t.textMid, fontSize: 14 }}>
        Guest content renders here
      </div>
    </ViewShell>
  )

  // ── Login ──────────────────────────────────────────────────────────────
  return (
    <>
      <style>{FONTS}</style>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        .grid-bg {
          position: absolute; inset: 0; pointer-events: none;
          background-image: linear-gradient(${dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)"} 1px, transparent 1px),
                            linear-gradient(90deg, ${dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)"} 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .stat-row { display: flex; gap: 0; border-top: 1px solid ${dark ? "#1e1e1e" : "#e5e5e5"}; }
        .stat { flex: 1; padding: 18px 0; border-right: 1px solid ${dark ? "#1e1e1e" : "#e5e5e5"}; }
        .stat:last-child { border-right: none; }
      `}</style>

      <div style={{ minHeight: "100vh", display: "flex", background: t.bg, fontFamily: "'Instrument Sans', sans-serif" }}>

        {/* Left panel */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "36px 44px", background: dark ? "#0c0c0c" : "#ece8e1",
          borderRight: `1px solid ${t.border}`, minWidth: 0, position: "relative", overflow: "hidden"
        }}>
          <div className="grid-bg" />

          {/* Top: logo + tag */}
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 32, fontFamily: "'Bebas Neue', sans-serif", color: t.text, letterSpacing: "0.06em", lineHeight: 1 }}>
              NorthStar
            </div>
            <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 5, border: `1px solid ${t.border2}`, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
              <span style={{ fontSize: 10.5, fontWeight: 600, color: t.textMid, letterSpacing: "0.08em", textTransform: "uppercase" }}>FRC Scouting · Live</span>
            </div>
          </div>

          {/* Center: headline */}
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.textMid, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
              Built for the floor
            </div>
            <div style={{ fontSize: 46, fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: t.text, lineHeight: 1.15, letterSpacing: "-0.5px", marginBottom: 20 }}>
              Scout smarter.<br /><em>Win together.</em>
            </div>
            <p style={{ fontSize: 13.5, color: t.textMid, lineHeight: 1.75, maxWidth: 360, margin: "0 0 32px" }}>
              Real-time scouting, match analytics, and team coordination — built for the competition floor.
            </p>

            {/* Stats strip */}
            <div style={{ border: `1px solid ${dark ? "#1e1e1e" : "#e0d9d0"}`, borderRadius: 10, overflow: "hidden", background: dark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.02)" }}>
              <div className="stat-row">
                {[["3 Roles", "access tiers"], ["Live", "match data"], ["Team 4028", "Bravely Bold"]].map(([val, lbl]) => (
                  <div key={lbl} className="stat" style={{ padding: "16px 0 16px 20px" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{val}</div>
                    <div style={{ fontSize: 11, color: t.textMid, marginTop: 2, letterSpacing: "0.02em" }}>{lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom: footer note */}
          <div style={{ position: "relative", fontSize: 11.5, color: t.textDim, letterSpacing: "0.02em" }}>
            NorthStar · FRC Scouting Platform
          </div>
        </div>

        {/* Right panel — login */}
        <div style={{ width: 420, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 40px", position: "relative", background: t.bg }}>
          <button
            onClick={() => setDarkPersist(!dark)}
            style={{ position: "absolute", top: 20, right: 20, padding: "5px 12px", background: "transparent", border: `1px solid ${t.border2}`, borderRadius: 7, fontSize: 12, color: t.textMid, cursor: "pointer", fontFamily: "inherit" }}
          >
            {dark ? "☀ Light" : "☾ Dark"}
          </button>

          <div style={{ width: "100%" }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: t.blue, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Secure access</div>
              <h1 style={{ fontSize: 24, fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: t.text, margin: "0 0 6px", letterSpacing: "-0.4px" }}>Welcome back</h1>
              <p style={{ fontSize: 13, color: t.textMid, margin: 0, lineHeight: 1.6 }}>Enter your access code to continue to the system.</p>
            </div>

            {/* Card */}
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "24px", marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.textMid, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                Access code
              </label>
              <input
                type="password"
                placeholder="••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setError("") }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={{
                  width: "100%", padding: "11px 13px", fontSize: 15,
                  background: t.inputBg, border: `1px solid ${focused ? t.blue : t.border2}`,
                  borderRadius: 8, color: t.text, fontFamily: "inherit", outline: "none",
                  transition: "border-color 0.15s",
                }}
              />
              {error && <p style={{ fontSize: 12, color: "#ef4444", marginTop: 8, marginBottom: 0 }}>{error}</p>}

              <button
                onClick={handleLogin}
                style={{ width: "100%", padding: "12px", marginTop: 14, background: dark ? "#f0f0f0" : "#111", color: dark ? "#0a0a0a" : "#fff", border: "none", borderRadius: 8, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "opacity 0.15s", letterSpacing: "0.01em" }}
                onMouseEnter={e => e.target.style.opacity = "0.85"}
                onMouseLeave={e => e.target.style.opacity = "1"}
              >
                Access system →
              </button>
            </div>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
              <div style={{ flex: 1, height: 1, background: t.border }} />
              <span style={{ fontSize: 11.5, color: t.textDim, fontWeight: 500 }}>or continue as</span>
              <div style={{ flex: 1, height: 1, background: t.border }} />
            </div>

            <button
              onClick={() => setGuestRole()}
              style={{ width: "100%", padding: "11px", background: "transparent", border: `1px solid ${t.border2}`, borderRadius: 8, fontSize: 13, color: t.textMid, fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { e.target.style.borderColor = t.border; e.target.style.color = t.text }}
              onMouseLeave={e => { e.target.style.borderColor = t.border2; e.target.style.color = t.textMid }}
            >
              Guest viewer
            </button>

            <p style={{ fontSize: 11, color: t.textDim, textAlign: "center", margin: "20px 0 0", lineHeight: 1.6 }}>
              Access codes are role-specific.<br />Contact your team lead for credentials.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}