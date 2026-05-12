import { useState, useRef, useEffect } from "react"
import ScouterView from "./pages/ScouterView"
import AdminView from "./pages/AdminView"
import DriveView from "./pages/DriveViewLite"


// ── Feature flags ──────────────────────────────────────────────────────────
const USE_SIDE_MENU = false   // true = admin access via slide-out side menu
const USE_HOLD_BUTTON = true  // true = admin access via hold-for-5s hidden button

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
`

const ADMIN_CODE = "2"

const darkTokens = {
  bg: "#0a0a0a", surface: "#111", surface2: "#181818",
  border: "#1e1e1e", border2: "#2a2a2a",
  text: "#f0f0f0", textMid: "#777", textDim: "#383838",
  inputBg: "#0d0d0d", blue: "#3b82f6",
}
const lightTokens = {
  bg: "#f2ede8", surface: "#ffffff", surface2: "#fafaf9",
  border: "#e5e5e5", border2: "#d4d4d4",
  text: "#111", textMid: "#737373", textDim: "#b0a89e",
  inputBg: "#f9f9f8", blue: "#2563eb",
}

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

// ── Admin login full-screen ────────────────────────────────────────────────
function AdminLogin({ onSuccess, onBack, dark, onToggleDark }) {
  const t = dark ? darkTokens : lightTokens
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [focused, setFocused] = useState(false)

  const handleLogin = () => {
    if (password === ADMIN_CODE) { onSuccess() }
    else { setError("Incorrect admin code.") }
  }

  return (
    <>
      <style>{FONTS}</style>
      <style>{`* { box-sizing: border-box; } body { margin: 0; }`}</style>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: t.bg, fontFamily: "'Instrument Sans', sans-serif", position: "relative" }}>

        {/* Top bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 28px" }}>
          <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: t.textMid, fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
            ← Back
          </button>
          <button onClick={onToggleDark} style={{ padding: "5px 12px", background: "transparent", border: `1px solid ${t.border2}`, borderRadius: 7, fontSize: 12, color: t.textMid, cursor: "pointer", fontFamily: "inherit" }}>
            {dark ? "☀ Light" : "☾ Dark"}
          </button>
        </div>

        {/* Login card */}
        <div style={{ width: 380, padding: "0 16px" }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Admin access</div>
            <h1 style={{ fontSize: 26, fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: t.text, margin: "0 0 6px", letterSpacing: "-0.4px" }}>Administrator login</h1>
            <p style={{ fontSize: 13, color: t.textMid, margin: 0, lineHeight: 1.6 }}>Enter your admin code to access the control panel.</p>
          </div>

          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "24px", marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.textMid, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
              Admin code
            </label>
            <input
              type="password"
              placeholder="••••••"
              value={password}
              autoFocus
              onChange={e => { setPassword(e.target.value); setError("") }}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{ width: "100%", padding: "11px 13px", fontSize: 15, background: t.inputBg, border: `1px solid ${focused ? "#ef4444" : t.border2}`, borderRadius: 8, color: t.text, fontFamily: "inherit", outline: "none", transition: "border-color 0.15s" }}
            />
            {error && <p style={{ fontSize: 12, color: "#ef4444", marginTop: 8, marginBottom: 0 }}>{error}</p>}
            <button
              onClick={handleLogin}
              style={{ width: "100%", padding: "12px", marginTop: 14, background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.01em" }}
            >
              Access admin panel →
            </button>
          </div>

          <button
            onClick={onBack}
            style={{ width: "100%", padding: "11px", background: "transparent", border: `1px solid ${t.border2}`, borderRadius: 8, fontSize: 13, color: t.textMid, fontFamily: "inherit", cursor: "pointer" }}
          >
            Continue as scouter instead
          </button>
        </div>
      </div>
    </>
  )
}

// ── Side menu (USE_SIDE_MENU = true) ──────────────────────────────────────
function SideMenu({ open, onClose, onAdminClick, dark }) {
  const t = dark ? darkTokens : lightTokens
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.2s", zIndex: 100 }}
      />
      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 280,
        background: t.surface, borderLeft: `1px solid ${t.border}`,
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        zIndex: 101, display: "flex", flexDirection: "column", padding: "24px 20px",
        fontFamily: "'Instrument Sans', sans-serif",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: t.textMid, letterSpacing: "0.08em", textTransform: "uppercase" }}>Menu</span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: t.textMid, fontSize: 18, cursor: "pointer", padding: 0 }}>✕</button>
        </div>
        <button
          onClick={onAdminClick}
          style={{ textAlign: "left", padding: "12px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#ef4444", cursor: "pointer", fontFamily: "inherit" }}
        >
          🔐 Admin login
        </button>
        <p style={{ fontSize: 11, color: t.textDim, marginTop: 12, lineHeight: 1.6 }}>Contact your team lead for credentials.</p>
      </div>
    </>
  )
}

// ── Hold button (USE_HOLD_BUTTON = true) ──────────────────────────────────
function HoldAdminButton({ onComplete, dark }) {
  const t = dark ? darkTokens : lightTokens
  const [holding, setHolding] = useState(false)
  const [progress, setProgress] = useState(0) // 0–100
  const [hint, setHint] = useState(false)     // show "keep holding" at 2s
  const intervalRef = useRef(null)
  const progressRef = useRef(0)
  const HOLD_MS = 5000

  const startHold = () => {
    setHolding(true)
    setHint(false)
    progressRef.current = 0
    const startTime = Date.now()
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const pct = Math.min((elapsed / HOLD_MS) * 100, 100)
      progressRef.current = pct
      setProgress(pct)
      if (elapsed >= 2000) setHint(true)
      if (elapsed >= HOLD_MS) {
        clearInterval(intervalRef.current)
        setHolding(false)
        setProgress(0)
        setHint(false)
        onComplete()
      }
    }, 30)
  }

  const cancelHold = () => {
    clearInterval(intervalRef.current)
    setHolding(false)
    setProgress(0)
    setHint(false)
  }

  useEffect(() => () => clearInterval(intervalRef.current), [])

  return (
    <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <button
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
        style={{
          position: "relative", overflow: "hidden",
          padding: "9px 18px", background: "transparent",
          border: `1px solid ${t.border2}`, borderRadius: 8,
          fontSize: 12, color: t.textDim, cursor: "pointer",
          fontFamily: "inherit", userSelect: "none", WebkitUserSelect: "none",
          transition: "border-color 0.2s, color 0.2s",
          ...(holding ? { borderColor: "#ef4444", color: "#ef4444" } : {}),
        }}
      >
        {/* Progress fill */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${progress}%`,
          background: "rgba(239,68,68,0.12)",
          transition: "none",
          borderRadius: 8,
        }} />
        <span style={{ position: "relative" }}>⚙ Admin</span>
      </button>
      <div style={{ fontSize: 11, color: "#ef4444", height: 16, transition: "opacity 0.2s", opacity: hint ? 1 : 0 }}>
        Keep holding…
      </div>
    </div>
  )
}

// ── Main app ───────────────────────────────────────────────────────────────
export default function App() {
  const [userRole, setUserRole] = useState(() => {
    try { return sessionStorage.getItem('northstar_role') || null } catch { return null }
  })
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dark, setDark] = useState(() => {
    try { const s = localStorage.getItem('northstar_dark'); return s === null ? true : s === 'true' } catch { return true }
  })
  const t = dark ? darkTokens : lightTokens

  const setDarkPersist = (val) => {
    setDark(val)
    try { localStorage.setItem('northstar_dark', val) } catch {}
  }

  const setRole = (role) => {
    try { sessionStorage.setItem('northstar_role', role) } catch {}
    setUserRole(role)
    setShowAdminLogin(false)
  }

  const logout = () => {
    try { sessionStorage.removeItem('northstar_role') } catch {}
    setUserRole(null)
    setShowAdminLogin(false)
  }

  // Routed views
  if (userRole === "admin") return <AdminView onLogout={logout} />
  if (userRole === "scouter") return <ScouterView onLogout={logout} dark={dark} />
  if (userRole === "drive") return <DriveView />
  if (userRole === "guest") return (
    <ViewShell role="guest" onLogout={logout} dark={dark} onToggleDark={() => setDarkPersist(!dark)}>
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: "3rem", textAlign: "center", color: t.textMid, fontSize: 14 }}>
        Guest content renders here
      </div>
    </ViewShell>
  )

  // Admin login screen
  if (showAdminLogin) return (
    <AdminLogin
      dark={dark}
      onToggleDark={() => setDarkPersist(!dark)}
      onSuccess={() => setRole("admin")}
      onBack={() => setShowAdminLogin(false)}
    />
  )

  // ── Main landing ────────────────────────────────────────────────────────
  return (
    <>
      <style>{FONTS}</style>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        .grid-bg {
          position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(${dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)"} 1px, transparent 1px),
            linear-gradient(90deg, ${dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)"} 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .stat-row { display: flex; gap: 0; border-top: 1px solid ${dark ? "#1e1e1e" : "#e5e5e5"}; }
        .stat { flex: 1; padding: 18px 0; border-right: 1px solid ${dark ? "#1e1e1e" : "#e5e5e5"}; }
        .stat:last-child { border-right: none; }
      `}</style>

      {/* Side menu (flag-gated) */}
      {USE_SIDE_MENU && (
        <SideMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onAdminClick={() => { setMenuOpen(false); setShowAdminLogin(true) }}
          dark={dark}
        />
      )}

      <div style={{ minHeight: "100vh", display: "flex", background: t.bg, fontFamily: "'Instrument Sans', sans-serif" }}>

        {/* Left panel */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "36px 44px", background: dark ? "#0c0c0c" : "#ece8e1",
          borderRight: `1px solid ${t.border}`, minWidth: 0, position: "relative", overflow: "hidden"
        }}>
          <div className="grid-bg" />

          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 32, fontFamily: "'Bebas Neue', sans-serif", color: t.text, letterSpacing: "0.06em", lineHeight: 1 }}>NorthStar</div>
            <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 5, border: `1px solid ${t.border2}`, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
              <span style={{ fontSize: 10.5, fontWeight: 600, color: t.textMid, letterSpacing: "0.08em", textTransform: "uppercase" }}>FRC Scouting · Live</span>
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.textMid, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Built for the floor</div>
            <div style={{ fontSize: 46, fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: t.text, lineHeight: 1.15, letterSpacing: "-0.5px", marginBottom: 20 }}>
              Scout smarter.<br /><em>Win together.</em>
            </div>
            <p style={{ fontSize: 13.5, color: t.textMid, lineHeight: 1.75, maxWidth: 360, margin: "0 0 32px" }}>
              Real-time scouting, match analytics, and team coordination — built for the competition floor.
            </p>
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

          <div style={{ position: "relative", fontSize: 11.5, color: t.textDim, letterSpacing: "0.02em" }}>
            NorthStar · FRC Scouting Platform
          </div>
        </div>

        {/* Right panel */}
        <div style={{ width: 420, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 40px", position: "relative", background: t.bg }}>

          {/* Top-right controls */}
          <div style={{ position: "absolute", top: 20, right: 20, display: "flex", gap: 8 }}>
            <button onClick={() => setDarkPersist(!dark)} style={{ padding: "5px 12px", background: "transparent", border: `1px solid ${t.border2}`, borderRadius: 7, fontSize: 12, color: t.textMid, cursor: "pointer", fontFamily: "inherit" }}>
              {dark ? "☀ Light" : "☾ Dark"}
            </button>
            {/* Hamburger for side menu (flag-gated) */}
            {USE_SIDE_MENU && (
              <button onClick={() => setMenuOpen(true)} style={{ padding: "5px 12px", background: "transparent", border: `1px solid ${t.border2}`, borderRadius: 7, fontSize: 12, color: t.textMid, cursor: "pointer", fontFamily: "inherit" }}>
                ☰
              </button>
            )}
          </div>

          <div style={{ width: "100%" }}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: t.blue, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>FRC Scouting</div>
              <h1 style={{ fontSize: 24, fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: t.text, margin: "0 0 6px", letterSpacing: "-0.4px" }}>Ready to scout?</h1>
              <p style={{ fontSize: 13, color: t.textMid, margin: 0, lineHeight: 1.6 }}>Jump right in — no login needed.</p>
            </div>

            {/* Primary CTA */}
            <button
              onClick={() => setRole("guest")}
              style={{ width: "100%", padding: "16px", background: dark ? "#f0f0f0" : "#111", color: dark ? "#0a0a0a" : "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.01em", marginBottom: 12 }}
              onMouseEnter={e => e.target.style.opacity = "0.88"}
              onMouseLeave={e => e.target.style.opacity = "1"}
            >
              Start scouting →
            </button>

            <p style={{ fontSize: 11, color: t.textDim, textAlign: "center", margin: "16px 0 0", lineHeight: 1.6 }}>
              Scouter or drive team? Contact your lead for an access code.
            </p>

            {/* Hold-to-reveal admin button (flag-gated) */}
            {USE_HOLD_BUTTON && (
              <HoldAdminButton dark={dark} onComplete={() => setShowAdminLogin(true)} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}