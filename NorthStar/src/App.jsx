import { useState } from "react"
import ScouterView from "./pages/ScouterView"
import AdminView from "./pages/AdminView"
import DriveView from "./pages/DriveView"

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
`

const credentials = { "1": "scouter", "2": "admin", "3": "drive" }

const ROLE_META = {
  admin:   { label: "Admin panel",  badge: "Admin",   badgeColor: "#ef4444", badgeBg: "rgba(239,68,68,0.12)" },
  scouter: { label: "Scouter view", badge: "Scouter", badgeColor: "#22c55e", badgeBg: "rgba(34,197,94,0.12)" },
  drive:   { label: "Drive team",   badge: "Drive",   badgeColor: "#3b82f6", badgeBg: "rgba(59,130,246,0.12)" },
  guest:   { label: "Guest view",   badge: "Guest",   badgeColor: "#737373", badgeBg: "rgba(115,115,115,0.12)" },
}

// Shell for non-admin views (scouter, drive, guest still use wrapper)
function ViewShell({ role, children, onLogout, dark, onToggleDark }) {
  const meta = ROLE_META[role] || ROLE_META.guest
  const t = dark ? darkTokens : lightTokens

  return (
    <>
      <style>{FONTS}</style>
      <style>{`* { box-sizing: border-box; } body { margin: 0; }`}</style>
      <div style={{ minHeight: "100vh", background: t.bg, fontFamily: "'Instrument Sans', sans-serif", color: t.text }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: `1px solid ${t.border}`, background: t.surface }}>
          <span style={{ fontSize: 16, fontFamily: "'Instrument Serif', serif", color: t.text }}>NorthStar</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 11px", borderRadius: 99, background: meta.badgeBg, color: meta.badgeColor }}>{meta.badge}</span>
            <button onClick={onToggleDark} style={{ padding: "5px 11px", background: "transparent", border: `1px solid ${t.border2}`, borderRadius: 8, fontSize: 12.5, color: t.textMid, cursor: "pointer", fontFamily: "inherit" }}>
              {dark ? "☀ Light" : "☾ Dark"}
            </button>
            <button onClick={onLogout} style={{ padding: "5px 11px", background: "transparent", border: `1px solid ${t.border2}`, borderRadius: 8, fontSize: 12.5, color: t.textMid, cursor: "pointer", fontFamily: "inherit" }}>
              Sign out
            </button>
          </div>
        </header>
        <main style={{ padding: "32px 28px" }}>{children}</main>
      </div>
    </>
  )
}

const darkTokens = {
  bg: "#0a0a0a", surface: "#111", surface2: "#181818",
  border: "#222", border2: "#2a2a2a",
  text: "#f0f0f0", textMid: "#888", textDim: "#444",
  inputBg: "#0f0f0f",
  blue: "#3b82f6",
}
const lightTokens = {
  bg: "#f5f5f4", surface: "#ffffff", surface2: "#fafaf9",
  border: "#e5e5e5", border2: "#d4d4d4",
  text: "#111", textMid: "#737373", textDim: "#a3a3a3",
  inputBg: "#f9f9f8",
  blue: "#2563eb",
}

export default function App() {
  const [userRole, setUserRole] = useState(null)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [focused, setFocused] = useState(false)
  const [dark, setDark] = useState(true)
  const t = dark ? darkTokens : lightTokens

  const logout = () => { setUserRole(null); setPassword(""); setError("") }
  const handleLogin = () => {
    const role = credentials[password]
    if (role) { setUserRole(role); setError("") }
    else setError("Incorrect access code.")
  }

  // Admin gets full-page treatment — no shell wrapper
  if (userRole === "admin") return <AdminView onLogout={logout} />

  if (userRole === "scouter") return (
    <ViewShell role="scouter" onLogout={logout} dark={dark} onToggleDark={() => setDark(d => !d)}>
      <ScouterView />
    </ViewShell>
  )

  if (userRole === "drive") return (
    <ViewShell role="drive" onLogout={logout} dark={dark} onToggleDark={() => setDark(d => !d)}>
      <DriveView />
    </ViewShell>
  )

  if (userRole === "guest") return (
    <ViewShell role="guest" onLogout={logout} dark={dark} onToggleDark={() => setDark(d => !d)}>
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "3rem", textAlign: "center", color: t.textMid, fontSize: 14 }}>
        Guest content renders here
      </div>
    </ViewShell>
  )

  // ── Login ─────────────────────────────────────────────────
  return (
    <>
      <style>{FONTS}</style>
      <style>{`* { box-sizing: border-box; } body { margin: 0; }`}</style>
      <div style={{ minHeight: "100vh", display: "flex", background: t.bg, fontFamily: "'Instrument Sans', sans-serif" }}>

        {/* Left panel — decorative */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "40px 48px", background: dark ? "#0f0f0f" : "#f0ece6", borderRight: `1px solid ${t.border}`, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontFamily: "'Instrument Serif', serif", color: t.text, letterSpacing: "-0.3px" }}>NorthStar</div>
          <div>
            <div style={{ fontSize: 38, fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: t.text, lineHeight: 1.2, marginBottom: 16, letterSpacing: "-0.5px" }}>
              Scout smarter.<br /><em>Win together.</em>
            </div>
            <p style={{ fontSize: 14, color: t.textMid, lineHeight: 1.7, maxWidth: 380, margin: 0 }}>
              Real-time scouting, match analytics, and team coordination — built for the competition floor.
            </p>
          </div>
          <div style={{ display: "flex", gap: 24, fontSize: 12.5, color: t.textDim }}>
            <span>FRC Scouting</span>
            <span>·</span>
            <span>Team 4028</span>
            <span>·</span>
            <span>Bravely Bold</span>
          </div>
        </div>

        {/* Right panel — login */}
        <div style={{ width: 420, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 40px", position: "relative" }}>
          {/* Theme toggle top-right */}
          <button
            onClick={() => setDark(d => !d)}
            style={{ position: "absolute", top: 20, right: 20, padding: "6px 12px", background: "transparent", border: `1px solid ${t.border2}`, borderRadius: 8, fontSize: 12.5, color: t.textMid, cursor: "pointer", fontFamily: "inherit" }}
          >
            {dark ? "☀ Light" : "☾ Dark"}
          </button>

          <div style={{ width: "100%" }}>
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ fontSize: 22, fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: t.text, margin: "0 0 6px", letterSpacing: "-0.4px" }}>Welcome back</h1>
              <p style={{ fontSize: 13.5, color: t.textMid, margin: 0 }}>Enter your access code to continue</p>
            </div>

            <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: t.textMid, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>
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
                width: "100%",
                padding: "12px 14px",
                fontSize: 15,
                background: t.inputBg,
                border: `1px solid ${focused ? t.blue : t.border2}`,
                borderRadius: 10,
                color: t.text,
                fontFamily: "inherit",
                outline: "none",
                transition: "border-color 0.15s",
              }}
            />
            {error && <p style={{ fontSize: 12.5, color: "#ef4444", marginTop: 8, marginBottom: 0 }}>{error}</p>}

            <button
              onClick={handleLogin}
              style={{ width: "100%", padding: "13px", marginTop: 16, background: dark ? "#fff" : "#111", color: dark ? "#0a0a0a" : "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "opacity 0.15s" }}
              onMouseEnter={e => e.target.style.opacity = "0.88"}
              onMouseLeave={e => e.target.style.opacity = "1"}
            >
              Access system
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
              <div style={{ flex: 1, height: 1, background: t.border }} />
              <span style={{ fontSize: 12, color: t.textDim }}>or</span>
              <div style={{ flex: 1, height: 1, background: t.border }} />
            </div>

            <button
              onClick={() => setUserRole("guest")}
              style={{ width: "100%", padding: "12px", background: "transparent", border: `1px solid ${t.border2}`, borderRadius: 10, fontSize: 13.5, color: t.textMid, fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { e.target.style.borderColor = t.border; e.target.style.color = t.text }}
              onMouseLeave={e => { e.target.style.borderColor = t.border2; e.target.style.color = t.textMid }}
            >
              Continue as guest
            </button>
          </div>
        </div>
      </div>
    </>
  )
}