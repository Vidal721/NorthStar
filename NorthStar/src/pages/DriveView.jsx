import { useState, useEffect, useRef, useCallback } from "react"

// ─────────────────────────────────────────────────────────────────────────────
//  FONTS & GLOBAL CSS — Liquid Glass Apple Style
// ─────────────────────────────────────────────────────────────────────────────
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=SF+Pro+Display:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');`

const GLOBAL_CSS = `
:root {
  --accent: #3B82F6; --accent2: #60A5FA; --accent3: rgba(59,130,246,0.15);
  --green: #22C55E; --red: #EF4444; --yellow: #EAB308;
  --orange: #F97316; --purple: #A855F7; --teal: #14B8A6;
  --text: #F1F5F9; --text2: rgba(241,245,249,0.55); --text3: rgba(241,245,249,0.28);
  --surface: #090B10; --surface2: #0D1018; --surface3: #121620; --surface4: #1A2030;
  --border: rgba(255,255,255,0.07); --border2: rgba(255,255,255,0.14); --border3: rgba(255,255,255,0.22);

  /* Liquid Glass */
  --glass-bg: rgba(14, 18, 28, 0.55);
  --glass-bg2: rgba(20, 26, 40, 0.72);
  --glass-bg3: rgba(30, 38, 58, 0.82);
  --glass-border: rgba(255,255,255,0.12);
  --glass-border-top: rgba(255,255,255,0.25);
  --glass-shadow: 0 32px 80px rgba(0,0,0,0.65), 0 8px 24px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.08) inset;
  --glass-shadow-lg: 0 48px 120px rgba(0,0,0,0.8), 0 16px 48px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.1) inset;
  --glass-highlight: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.06) 100%);
  --blur: blur(40px) saturate(180%);
  --blur-heavy: blur(60px) saturate(200%);
}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
html,body{width:100%;height:100%;overflow:hidden;background:var(--surface);font-family:'DM Sans',-apple-system,sans-serif;color:var(--text);}

/* ── GLASS WIDGET ── */
.gl-card {
  position:absolute; border-radius:20px; overflow:visible; touch-action:none;
  background: var(--glass-bg);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  border: 0.5px solid var(--glass-border);
  border-top-color: var(--glass-border-top);
  box-shadow: var(--glass-shadow);
  display:flex; flex-direction:column;
  transition: box-shadow 0.25s, transform 0.25s;
  width:320px;
}
.gl-card::before {
  content:''; position:absolute; inset:0; border-radius:20px; pointer-events:none;
  background: var(--glass-highlight); z-index:0;
}
.gl-card.lifted {
  box-shadow: var(--glass-shadow-lg);
  transform: scale(1.025) rotate(0.3deg) translateY(-4px);
  z-index:99!important;
}
.gl-card.focused-main {
  box-shadow: 0 0 0 1.5px var(--accent), var(--glass-shadow-lg);
  z-index:200!important;
}
.gl-card.node-selected {
  box-shadow: 0 0 0 1.5px var(--purple), var(--glass-shadow);
}
.gl-card.node-source {
  box-shadow: 0 0 0 2px var(--orange), var(--glass-shadow-lg);
}

/* ── GLASS HEADER ── */
.gl-wh {
  display:flex; align-items:center; padding:12px 14px 10px 16px; gap:8px;
  cursor:grab; flex-shrink:0;
  background: rgba(255,255,255,0.04);
  border-bottom: 0.5px solid var(--glass-border);
  border-radius:20px 20px 0 0;
  position:relative; z-index:1;
}
.gl-wh:active { cursor:grabbing; }
.gl-wh-title { font-size:13px; font-weight:600; letter-spacing:-.2px; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:'DM Sans',sans-serif; color:var(--text); }
.gl-wh-badge { font-size:9px; font-weight:700; padding:2px 7px; border-radius:20px; background:rgba(59,130,246,0.18); color:var(--accent2); font-family:'DM Mono',monospace; border:0.5px solid rgba(59,130,246,0.3); }
.gl-wh-btn {
  width:26px; height:26px; border-radius:8px;
  background:rgba(255,255,255,0.07);
  border:0.5px solid rgba(255,255,255,0.12);
  color:var(--text2); font-size:12px;
  display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;
  transition: background 0.15s, color 0.15s;
  backdrop-filter: blur(10px);
}
.gl-wh-btn:hover { background:rgba(255,255,255,0.14); color:var(--text); }
.gl-wh-btn.expand:hover { background:rgba(59,130,246,0.2); color:var(--accent2); }
.gl-wh-btn.close:hover { background:rgba(239,68,68,0.2); color:var(--red); }
.gl-wb { padding:0; overflow-y:auto; flex:1; touch-action:pan-y; overscroll-behavior:contain; position:relative; z-index:1; border-radius:0 0 20px 20px; }
.gl-wb::-webkit-scrollbar { width:3px; }
.gl-wb::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
.gl-resize {
  position:absolute; bottom:-1px; right:-1px; width:28px; height:28px;
  cursor:nwse-resize; z-index:20; display:flex; align-items:flex-end; justify-content:flex-end; padding:5px; touch-action:none;
}
.gl-resize::before { content:''; display:block; width:10px; height:10px; border-right:2px solid rgba(255,255,255,0.2); border-bottom:2px solid rgba(255,255,255,0.2); border-radius:0 0 3px 0; transition:border-color 0.15s; }
.gl-card:hover .gl-resize::before { border-color:rgba(255,255,255,0.45); }

/* ── DATA ROWS ── */
.kv-section { padding:0 16px; }
.kv-section-title { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.14em; color:var(--text3); padding:10px 0 6px; border-bottom:0.5px solid var(--border); font-family:'DM Mono',monospace; }
.kv { display:flex; justify-content:space-between; align-items:center; padding:7px 0; border-bottom:0.5px solid var(--border); gap:10px; }
.kv:last-child { border-bottom:none; }
.kk { font-size:11px; color:var(--text2); flex-shrink:0; text-transform:capitalize; }
.kv-v { font-size:14px; font-weight:700; text-align:right; font-family:'DM Mono',monospace; letter-spacing:-.3px; }
.kv-v.g{color:var(--green)}.kv-v.r{color:var(--red)}.kv-v.a{color:var(--accent)}.kv-v.y{color:var(--yellow)}.kv-v.p{color:var(--purple)}

/* ── TEAM CARDS ── */
.tc { padding:12px 16px; border-bottom:0.5px solid var(--border); display:flex; flex-direction:column; gap:8px; cursor:pointer; transition:background .15s; }
.tc:hover { background:rgba(255,255,255,0.04); }
.tc:last-child { border-bottom:none; }
.tc-top { display:flex; align-items:center; gap:10px; }
.tc-rank { font-size:11px; font-weight:700; color:var(--text3); min-width:24px; font-family:'DM Mono',monospace; }
.tc-num { font-size:17px; font-weight:800; color:var(--accent); font-family:'Syne',sans-serif; min-width:52px; }
.tc-name { font-size:12px; font-weight:600; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text); }
.tc-record { font-size:11px; font-family:'DM Mono',monospace; color:var(--text2); }
.tc-epa { font-size:13px; font-weight:700; font-family:'DM Mono',monospace; color:var(--text); }
.tc-bars { display:flex; flex-direction:column; gap:3px; }
.tc-bar-row { display:flex; align-items:center; gap:6px; }
.tc-bar-label { font-size:9px; font-weight:700; color:var(--text3); min-width:52px; font-family:'DM Mono',monospace; text-transform:uppercase; }
.tc-bar-track { flex:1; height:4px; border-radius:2px; background:rgba(255,255,255,0.06); overflow:hidden; }
.tc-bar-fill { height:100%; border-radius:2px; transition:width 0.6s cubic-bezier(0.4,0,0.2,1); }
.tc-bar-fill.auto{background:linear-gradient(90deg,var(--accent),var(--accent2));}
.tc-bar-fill.teleop{background:linear-gradient(90deg,var(--green),#4ade80);}
.tc-bar-fill.endgame{background:linear-gradient(90deg,var(--purple),#c084fc);}
.tc-bar-fill.cycles{background:linear-gradient(90deg,var(--teal),#2dd4bf);}
.tc-bar-fill.avgpts{background:linear-gradient(90deg,var(--orange),#fb923c);}
.tc-bar-val { font-size:10px; font-weight:700; font-family:'DM Mono',monospace; color:var(--text2); min-width:32px; text-align:right; }

/* ── EPA / COMPARE ── */
.epa-summary { display:grid; border-top:0.5px solid var(--border); }
.epa-cell { padding:9px 12px; display:flex; flex-direction:column; gap:2px; border-right:0.5px solid var(--border); }
.epa-cell:last-child { border-right:none; }
.epa-cell-label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--text3); font-family:'DM Mono',monospace; }
.epa-cell-val { font-size:15px; font-weight:800; font-family:'DM Mono',monospace; letter-spacing:-.5px; }
.epa-cell-val.total{color:var(--text)}.epa-cell-val.auto{color:var(--accent)}.epa-cell-val.teleop{color:var(--green)}.epa-cell-val.endgame{color:var(--purple)}
.breakdown-section { padding:10px 16px 14px; }
.breakdown-title { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.12em; color:var(--text3); margin-bottom:8px; font-family:'DM Mono',monospace; }
.bd-row { display:flex; align-items:center; gap:8px; margin-bottom:5px; }
.bd-label { font-size:10px; font-weight:600; color:var(--text2); min-width:100px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-transform:capitalize; }
.bd-track { flex:1; height:5px; border-radius:3px; background:rgba(255,255,255,0.06); overflow:hidden; }
.bd-fill { height:100%; border-radius:3px; background:linear-gradient(90deg,var(--accent),var(--accent2)); min-width:2px; }
.bd-val { font-size:10px; font-weight:700; font-family:'DM Mono',monospace; color:var(--text2); min-width:38px; text-align:right; }
.lb-controls { display:flex; align-items:center; gap:5px; padding:7px 12px; border-bottom:0.5px solid var(--border); background:rgba(255,255,255,0.02); flex-wrap:wrap; }
.lb-sort-btn { padding:3px 8px; border-radius:20px; border:0.5px solid var(--border); background:transparent; color:var(--text3); font-size:9px; font-weight:700; font-family:'DM Mono',monospace; cursor:pointer; text-transform:uppercase; letter-spacing:.05em; transition:all .15s; }
.lb-sort-btn.active { background:rgba(59,130,246,0.18); border-color:rgba(59,130,246,0.4); color:var(--accent2); }
.match-card { padding:10px 14px; border-bottom:0.5px solid var(--border); }
.match-card:last-child { border-bottom:none; }
.match-card-header { display:flex; align-items:center; gap:8px; margin-bottom:7px; flex-wrap:wrap; }
.match-title { font-size:13px; font-weight:800; font-family:'Syne',sans-serif; color:var(--text); }
.match-tag { display:inline-flex; align-items:center; padding:2px 7px; border-radius:20px; font-size:10px; font-weight:700; font-family:'DM Mono',monospace; }
.match-tag.red { background:rgba(239,68,68,0.12); color:var(--red); border:0.5px solid rgba(239,68,68,0.25); }
.match-tag.blue { background:rgba(59,130,246,0.12); color:var(--accent); border:0.5px solid rgba(59,130,246,0.25); }
.match-stats-grid { display:grid; gap:0; background:rgba(255,255,255,0.03); border-radius:10px; overflow:hidden; border:0.5px solid var(--border); margin-bottom:7px; }
.match-stat-cell { padding:7px 8px; display:flex; flex-direction:column; gap:1px; border-right:0.5px solid var(--border); }
.match-stat-cell:last-child { border-right:none; }
.match-stat-label { font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--text3); font-family:'DM Mono',monospace; }
.match-stat-val { font-size:14px; font-weight:800; font-family:'DM Mono',monospace; }
.match-notes { font-size:11px; color:var(--text2); font-style:italic; line-height:1.5; padding:4px 8px; background:rgba(255,255,255,0.03); border-radius:6px; border-left:2px solid var(--border2); }
.cmp-header { display:flex; align-items:center; justify-content:space-between; padding:10px 16px 8px; border-bottom:0.5px solid var(--border); background:rgba(255,255,255,0.02); }
.cmp-title { font-size:11px; font-weight:700; color:var(--text2); font-family:'DM Mono',monospace; }
.cmp-teams-row { display:flex; gap:0; border-bottom:0.5px solid var(--border); overflow-x:auto; }
.cmp-team-col { flex:1; min-width:100px; padding:10px 12px; border-right:0.5px solid var(--border); display:flex; flex-direction:column; gap:2px; }
.cmp-team-col:last-child { border-right:none; }
.cmp-team-num { font-size:16px; font-weight:800; font-family:'Syne',sans-serif; color:var(--accent); }
.cmp-team-name { font-size:10px; color:var(--text2); }
.cmp-metric-row { display:flex; margin-bottom:1px; }
.cmp-metric-label { font-size:10px; color:var(--text2); min-width:90px; flex-shrink:0; padding:4px 0; }
.cmp-metric-cells { display:flex; flex:1; }
.cmp-metric-cell { flex:1; min-width:0; padding:4px 8px; text-align:center; }
.cmp-metric-val { font-size:12px; font-weight:700; font-family:'DM Mono',monospace; }
.cmp-metric-val.best{color:var(--green)}.cmp-metric-val.worst{color:var(--red)}.cmp-metric-val.mid{color:var(--text)}
.notes-area { width:100%; background:transparent; border:none; resize:none; color:var(--text); font-size:12px; font-family:'DM Sans',sans-serif; line-height:1.6; padding:12px 16px; outline:none; -webkit-user-select:text; user-select:text; }
.notes-area::placeholder { color:var(--text3); }
.notes-footer { display:flex; justify-content:flex-end; padding:6px 14px; border-top:0.5px solid var(--border); }
.sr-empty { padding:20px 16px; font-size:12px; color:var(--text3); text-align:center; font-family:'DM Sans',sans-serif; }

/* ── NODE CONNECTOR LINE ── */
.node-svg { position:fixed; inset:0; pointer-events:none; z-index:50; }
.node-line { stroke:var(--purple); stroke-width:1.5; fill:none; opacity:0.7; stroke-dasharray:4 3; animation:dashAnim 1s linear infinite; }
.node-line.confirmed { stroke:var(--accent2); opacity:0.9; stroke-dasharray:none; animation:none; }
@keyframes dashAnim { to { stroke-dashoffset:-7; } }

/* ── FOCUSED MAIN PANEL ── */
.focus-overlay {
  position:fixed; inset:0; z-index:150;
  background:rgba(5,7,12,0.7);
  backdrop-filter:blur(8px);
  -webkit-backdrop-filter:blur(8px);
  pointer-events:none;
  opacity:0;
  transition:opacity 0.3s;
}
.focus-overlay.active { opacity:1; pointer-events:all; }
.focus-panel {
  position:fixed; z-index:160;
  left:50%; top:50%;
  transform:translate(-50%,-50%) scale(0.96);
  width:700px; max-width:92vw; max-height:85vh;
  border-radius:24px;
  background:rgba(10,14,22,0.92);
  backdrop-filter:blur(60px) saturate(200%);
  -webkit-backdrop-filter:blur(60px) saturate(200%);
  border:0.5px solid rgba(255,255,255,0.18);
  border-top-color:rgba(255,255,255,0.35);
  box-shadow:0 60px 140px rgba(0,0,0,0.9), 0 0 0 0.5px rgba(255,255,255,0.07) inset;
  display:flex; flex-direction:column;
  opacity:0;
  transition:transform 0.35s cubic-bezier(0.32,1.1,0.5,1), opacity 0.3s;
  overflow:hidden;
}
.focus-panel::before {
  content:''; position:absolute; inset:0; border-radius:24px; pointer-events:none;
  background:linear-gradient(135deg,rgba(255,255,255,0.1) 0%,rgba(255,255,255,0.01) 60%,rgba(255,255,255,0.05) 100%);
}
.focus-panel.active { transform:translate(-50%,-50%) scale(1); opacity:1; }
.focus-panel-header {
  display:flex; align-items:center; gap:12px; padding:18px 20px 14px;
  border-bottom:0.5px solid rgba(255,255,255,0.1);
  background:rgba(255,255,255,0.04);
  flex-shrink:0;
}
.focus-panel-title { font-size:17px; font-weight:700; font-family:'Syne',sans-serif; flex:1; }
.focus-panel-close {
  width:30px; height:30px; border-radius:50%;
  background:rgba(239,68,68,0.15); border:0.5px solid rgba(239,68,68,0.3);
  color:var(--red); font-size:14px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:background 0.15s;
}
.focus-panel-close:hover { background:rgba(239,68,68,0.3); }
.focus-panel-body { flex:1; overflow-y:auto; }
.focus-panel-body::-webkit-scrollbar { width:3px; }
.focus-panel-body::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.12); border-radius:2px; }

/* ── TOP BAR GLASS ── */
.top-bar {
  position:fixed; top:0; left:0; right:0; height:56px; z-index:300;
  display:flex; align-items:center; padding:0 16px; gap:10px;
  background:rgba(7,9,14,0.78);
  backdrop-filter:blur(40px) saturate(200%);
  -webkit-backdrop-filter:blur(40px) saturate(200%);
  border-bottom:0.5px solid rgba(255,255,255,0.1);
  border-bottom-color:rgba(255,255,255,0.1);
}
.top-bar::after {
  content:''; position:absolute; left:0; right:0; bottom:0; height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent);
  pointer-events:none;
}

/* ── TAB BAR ── */
.tab-bar {
  position:fixed; top:56px; left:0; right:0; height:44px; z-index:299;
  display:flex; align-items:center; padding:0 16px; gap:4px;
  background:rgba(7,9,14,0.72);
  backdrop-filter:blur(30px) saturate(180%);
  -webkit-backdrop-filter:blur(30px) saturate(180%);
  border-bottom:0.5px solid rgba(255,255,255,0.07);
}
.tab-btn {
  height:30px; padding:0 14px; border-radius:20px;
  border:none; background:transparent; color:var(--text3);
  font-size:11px; font-weight:600; font-family:'DM Sans',sans-serif; cursor:pointer;
  transition:all 0.2s;
  white-space:nowrap;
}
.tab-btn.active {
  background:rgba(59,130,246,0.18);
  border:0.5px solid rgba(59,130,246,0.35);
  color:var(--accent2);
  backdrop-filter:blur(10px);
}
.tab-btn:hover:not(.active) { color:var(--text2); background:rgba(255,255,255,0.06); }

/* ── PROCESS BANNER ── */
.process-banner {
  position:fixed; bottom:28px; left:50%; z-index:500;
  transform:translateX(-50%) translateY(80px);
  display:flex; align-items:center; gap:12px;
  padding:10px 16px 10px 14px;
  background:rgba(10,14,22,0.94);
  backdrop-filter:blur(40px) saturate(180%);
  -webkit-backdrop-filter:blur(40px) saturate(180%);
  border:0.5px solid rgba(255,255,255,0.15);
  border-top-color:rgba(255,255,255,0.28);
  border-radius:20px;
  box-shadow:0 24px 60px rgba(0,0,0,0.7);
  transition:transform 0.35s cubic-bezier(0.32,1.1,0.5,1);
  white-space:nowrap;
}
.process-banner.show { transform:translateX(-50%) translateY(0); }

/* ── PROCESS RESULT ── */
.process-result {
  position:fixed; z-index:500;
  left:50%; top:50%; transform:translate(-50%,-50%) scale(0.95);
  width:560px; max-width:90vw; max-height:70vh;
  border-radius:22px;
  background:rgba(8,11,18,0.97);
  backdrop-filter:blur(60px);
  -webkit-backdrop-filter:blur(60px);
  border:0.5px solid rgba(255,255,255,0.18);
  box-shadow:0 60px 120px rgba(0,0,0,0.9);
  overflow:hidden;
  opacity:0;
  transition:transform 0.35s cubic-bezier(0.32,1.1,0.5,1), opacity 0.3s;
  display:flex; flex-direction:column;
}
.process-result.show { transform:translate(-50%,-50%) scale(1); opacity:1; }

/* ── 3D SCENE ── */
.scene-3d-wrap {
  position:fixed; inset:0; top:100px; z-index:1;
  perspective:1200px;
  overflow:hidden;
}
.scene-3d {
  position:relative; width:100%; height:100%;
  transform-style:preserve-3d;
  transition:transform 0.6s cubic-bezier(0.4,0,0.2,1);
  cursor:grab;
}
.scene-3d:active { cursor:grabbing; }
.plane-label {
  position:fixed; top:108px; left:50%; transform:translateX(-50%);
  font-size:10px; font-weight:700; color:var(--text3);
  font-family:'DM Mono',monospace; text-transform:uppercase; letter-spacing:.15em;
  pointer-events:none; z-index:10;
}
.gl-3d-card {
  position:absolute;
  border-radius:18px;
  background:rgba(12,16,26,0.65);
  backdrop-filter:blur(30px) saturate(160%);
  -webkit-backdrop-filter:blur(30px) saturate(160%);
  border:0.5px solid rgba(255,255,255,0.12);
  border-top-color:rgba(255,255,255,0.25);
  box-shadow:0 24px 60px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.06) inset;
  overflow:hidden;
  transition:transform 0.5s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s;
  cursor:pointer;
  transform-style:preserve-3d;
}
.gl-3d-card::before {
  content:''; position:absolute; inset:0; border-radius:18px; pointer-events:none;
  background:linear-gradient(135deg,rgba(255,255,255,0.1) 0%,rgba(255,255,255,0.01) 60%);
}
.gl-3d-card:hover {
  box-shadow:0 40px 100px rgba(0,0,0,0.8), 0 0 30px rgba(59,130,246,0.15), 0 0 0 0.5px rgba(59,130,246,0.2) inset;
}
.plane-grid {
  position:absolute; inset:0; pointer-events:none;
  background-image:
    linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px);
  background-size:60px 60px;
}

/* ── SWIPE HINT ── */
.swipe-hint {
  position:fixed; right:20px; top:50%; transform:translateY(-50%);
  display:flex; flex-direction:column; gap:6px; z-index:10; pointer-events:none;
}
.swipe-dot { width:4px; height:4px; border-radius:50%; background:rgba(255,255,255,0.15); }
.swipe-dot.active { background:var(--accent2); }

/* ── MARKER MODE ── */
.marker-btn {
  width:34px; height:34px; border-radius:10px; border:none;
  display:flex; align-items:center; justify-content:center; cursor:pointer;
  font-size:16px; transition:all 0.2s;
}
.marker-btn.off { background:var(--surface4); color:var(--text2); border:0.5px solid var(--border2); }
.marker-btn.on {
  background:rgba(168,85,247,0.22); color:var(--purple); border:0.5px solid rgba(168,85,247,0.45);
  box-shadow:0 0 16px rgba(168,85,247,0.3);
  animation:markerPulse 1.8s ease-in-out infinite;
}
@keyframes markerPulse { 0%,100%{box-shadow:0 0 16px rgba(168,85,247,0.3)} 50%{box-shadow:0 0 28px rgba(168,85,247,0.55)} }

@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
@keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes slideIn { from{transform:translateX(100%)} to{transform:translateX(0)} }

.icon-btn {
  width:34px; height:34px; border-radius:10px; border:none;
  background:rgba(255,255,255,0.07); border:0.5px solid var(--border2);
  color:var(--text); font-size:16px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:background 0.15s, transform 0.1s;
  backdrop-filter:blur(10px);
}
.icon-btn:hover { background:rgba(255,255,255,0.12); }
.icon-btn:active { transform:scale(0.92); }

.add-btn {
  width:34px; height:34px; border-radius:10px; border:none;
  background:var(--accent); color:#fff; font-size:18px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 4px 14px rgba(59,130,246,0.35);
  transition:filter 0.15s, transform 0.1s;
}
.add-btn:hover { filter:brightness(1.1); }
.add-btn:active { transform:scale(0.92); }

.chip {
  display:flex; align-items:center; gap:5px; padding:5px 10px;
  border-radius:20px; font-size:11px; font-weight:600;
  background:rgba(255,255,255,0.05); color:var(--text2);
  border:0.5px solid var(--border);
  backdrop-filter:blur(10px);
}
`

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const API = ""
const LS_POS = "dv3_pos", LS_WIDGETS = "dv3_widgets"

function fmtNum(v) {
  if (typeof v !== "number") return String(v ?? "")
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

// ─────────────────────────────────────────────────────────────────────────────
//  DOT GRID (liquid glass tinted)
// ─────────────────────────────────────────────────────────────────────────────
function DotGrid({ cx, cy, cz }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const g = c.getContext("2d")
    c.width = window.innerWidth; c.height = window.innerHeight
    const sp = 30 * cz, r = Math.max(0.5, cz * 0.7)
    const ox = ((cx % sp) + sp) % sp, oy = ((cy % sp) + sp) % sp
    g.clearRect(0, 0, c.width, c.height)
    g.fillStyle = "rgba(59,130,246,0.06)"
    for (let x = ox - sp; x < c.width + sp; x += sp)
      for (let y = oy - sp; y < c.height + sp; y += sp) {
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
      }
  }, [cx, cy, cz])
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }} />
}

// ─────────────────────────────────────────────────────────────────────────────
//  DATA POLLING
// ─────────────────────────────────────────────────────────────────────────────
function usePoll(url, ms = 5000) {
  const [data, setData] = useState(null)
  useEffect(() => {
    let alive = true
    const run = async () => { try { const r = await fetch(url); if (r.ok && alive) setData(await r.json()) } catch {} }
    run(); const id = setInterval(run, ms)
    return () => { alive = false; clearInterval(id) }
  }, [url, ms])
  return data
}

// ─────────────────────────────────────────────────────────────────────────────
//  NODE CONNECTOR SVG OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
function NodeLines({ connections, widgets, positions, cam, pendingSource, mousePos }) {
  function getCenter(wid) {
    const pos = positions[wid] || { x: 0, y: 0 }
    const w = positions[wid]?.customW ?? 320
    const cx = pos.x * cam.cz + cam.cx + (w * cam.cz) / 2
    const cy = pos.y * cam.cz + cam.cy + 56 + 44 + 30
    return { x: cx, y: cy }
  }
  return (
    <svg className="node-svg" style={{ zIndex: 50 }}>
      <defs>
        <marker id="arrowBlue" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="rgba(96,165,250,0.8)" />
        </marker>
        <marker id="arrowPurple" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="rgba(168,85,247,0.8)" />
        </marker>
      </defs>
      {connections.map((conn, i) => {
        const a = getCenter(conn.from), b = getCenter(conn.to)
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 40
        return (
          <path key={i} className="node-line confirmed"
            d={`M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`}
            markerEnd="url(#arrowBlue)" />
        )
      })}
      {pendingSource && mousePos && (() => {
        const a = getCenter(pendingSource)
        return <line className="node-line" x1={a.x} y1={a.y} x2={mousePos.x} y2={mousePos.y} markerEnd="url(#arrowPurple)" />
      })()}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  LEADERBOARD
// ─────────────────────────────────────────────────────────────────────────────
function Leaderboard({ picklist, schema, equations, onOpenTeam }) {
  const [sortKey, setSortKey] = useState(null)
  const fields = schema?.fields || []
  const eqs = equations || []
  const scoreKey = eqs.find(e => picklist?.[0] && typeof picklist[0][e.varName] === "number")?.varName || "matches"
  const activeSort = sortKey || scoreKey
  const SORTS = [[scoreKey, "Score"], ["matches", "Matches"], ...fields.slice(0, 5).map(f => [f.varName, f.label.slice(0, 6)])]
  const teams = [...(picklist || [])].sort((a, b) => (b[activeSort] || 0) - (a[activeSort] || 0))
  const maxVals = {}
  SORTS.forEach(([k]) => { maxVals[k] = Math.max(...teams.map(t => t[k] || 0), 1) })
  const BAR_CLASSES = ["auto", "teleop", "endgame", "cycles", "avgpts"]
  return (
    <>
      <div className="lb-controls">
        {SORTS.map(([k, l]) => (
          <button key={k} className={`lb-sort-btn${activeSort === k ? " active" : ""}`} onClick={() => setSortKey(k)}>{l}</button>
        ))}
      </div>
      {!teams.length && <div className="sr-empty">No team data. Waiting for server…</div>}
      {teams.map((t, i) => (
        <div key={t.team} className="tc" onClick={() => onOpenTeam(t.team)}>
          <div className="tc-top">
            <div className="tc-rank">#{i + 1}</div>
            <div className="tc-num">{t.team}</div>
            <div className="tc-name">Team {t.team}</div>
            <div className="tc-record">{t.matches}m</div>
            {t[scoreKey] != null && <div className="tc-epa">{fmtNum(t[scoreKey])}</div>}
          </div>
          <div className="tc-bars">
            {fields.slice(0, 4).map((f, fi) => {
              if (t[f.varName] == null) return null
              const mx = Math.max(...teams.map(x => x[f.varName] || 0), 1)
              return (
                <div key={f.varName} className="tc-bar-row">
                  <div className="tc-bar-label">{f.label.slice(0, 7)}</div>
                  <div className="tc-bar-track"><div className={`tc-bar-fill ${BAR_CLASSES[fi] || "auto"}`} style={{ width: `${((t[f.varName] || 0) / mx) * 100}%` }} /></div>
                  <div className="tc-bar-val">{fmtNum(t[f.varName])}</div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  TEAM DETAIL
// ─────────────────────────────────────────────────────────────────────────────
function TeamDetail({ teamNum, picklist, schema, equations }) {
  const [history, setHistory] = useState([])
  const [notes, setNotes] = useState("")
  const fields = schema?.fields || []
  const eqs = equations || []
  const scoreKey = eqs.find(e => picklist?.[0] && typeof picklist[0][e.varName] === "number")?.varName || "matches"
  useEffect(() => {
    if (!teamNum) return
    let alive = true
    fetch(`${API}/api/team/${teamNum}/history`).then(r => r.json()).then(d => { if (alive) setHistory(d) }).catch(() => {})
    return () => { alive = false }
  }, [teamNum])
  const t = picklist?.find(x => String(x.team) === String(teamNum))
  const rank = picklist ? picklist.findIndex(x => String(x.team) === String(teamNum)) + 1 : null
  const rankBg = rank <= 3 ? "rgba(234,179,8,0.15)" : rank <= 10 ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.06)"
  const rankColor = rank <= 3 ? "var(--yellow)" : rank <= 10 ? "var(--accent)" : "var(--text2)"
  if (!t && !history.length) return <div className="sr-empty">No data for team {teamNum}.<br />Ensure this team has been scouted.</div>
  return (
    <>
      <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.02)", borderBottom: "0.5px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: "var(--accent)", lineHeight: 1 }}>{teamNum}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginTop: 2 }}>Team {teamNum}</div>
          </div>
          {rank && <div style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, fontFamily: "'DM Mono',monospace", background: rankBg, color: rankColor, border: "0.5px solid currentColor", opacity: 0.9 }}>Rank #{rank}</div>}
        </div>
        {t?.[scoreKey] != null && <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "'DM Mono',monospace" }}>
          {scoreKey}: <span style={{ color: "var(--accent2)", fontWeight: 700 }}>{fmtNum(t[scoreKey])}</span>
          {" · "}{t.matches} matches scouted
        </div>}
      </div>
      {t && fields.length > 0 && (
        <div className="epa-summary" style={{ gridTemplateColumns: `repeat(${Math.min(4, fields.length)}, 1fr)` }}>
          {fields.slice(0, 4).map((f, i) => {
            const cls = ["total", "auto", "teleop", "endgame"][i] || "total"
            return <div key={f.varName} className="epa-cell"><div className="epa-cell-label">{f.label.slice(0, 7)}</div><div className={`epa-cell-val ${cls}`}>{fmtNum(t[f.varName] ?? 0)}</div></div>
          })}
        </div>
      )}
      {t && fields.length > 0 && (
        <div className="breakdown-section">
          <div className="breakdown-title">Avg Stats</div>
          {fields.map(f => {
            const mx = Math.max(...(picklist || []).map(x => x[f.varName] || 0), 1)
            return <div key={f.varName} className="bd-row"><div className="bd-label">{f.label}</div><div className="bd-track"><div className="bd-fill" style={{ width: `${Math.max(2, ((t[f.varName] || 0) / mx) * 100)}%` }} /></div><div className="bd-val">{fmtNum(t[f.varName] ?? 0)}</div></div>
          })}
        </div>
      )}
      {history.length > 0 && (
        <>
          <div className="kv-section" style={{ paddingBottom: 0 }}>
            <div className="kv-section-title">Match History ({history.length})</div>
          </div>
          {history.map((m, i) => {
            const allianceCls = String(m.alliance || "").toLowerCase().includes("red") ? "red" : "blue"
            const statFields = fields.filter(f => m[f.varName] != null).slice(0, 4)
            return (
              <div key={i} className="match-card">
                <div className="match-card-header">
                  <span className="match-title">Match {m.match ?? "?"}</span>
                  {m.alliance && <span className={`match-tag ${allianceCls}`}>{m.alliance}</span>}
                  {m.scouter_id && <span style={{ fontSize: 9, color: "var(--text3)" }}>👤 {m.scouter_id}</span>}
                </div>
                {statFields.length > 0 && (
                  <div className="match-stats-grid" style={{ gridTemplateColumns: `repeat(${statFields.length}, 1fr)` }}>
                    {statFields.map(f => <div key={f.varName} className="match-stat-cell"><div className="match-stat-label">{f.label.slice(0, 5)}</div><div className="match-stat-val" style={{ color: "var(--accent)" }}>{fmtNum(m[f.varName])}</div></div>)}
                  </div>
                )}
                {m.notes && <div className="match-notes">{m.notes}</div>}
              </div>
            )
          })}
        </>
      )}
      <div className="kv-section" style={{ paddingBottom: 4, paddingTop: 10 }}>
        <div className="kv-section-title">Notes</div>
      </div>
      <textarea className="notes-area" placeholder="Add notes…" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
      <div className="notes-footer">
        <button style={{ padding: "5px 12px", background: "rgba(59,130,246,0.15)", border: "0.5px solid rgba(59,130,246,0.35)", borderRadius: 20, fontSize: 12, color: "var(--accent2)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Save</button>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPARE
// ─────────────────────────────────────────────────────────────────────────────
function Compare({ cfg, picklist, schema, equations, onUpdate }) {
  const [input, setInput] = useState("")
  const fields = schema?.fields || []
  const eqs = equations || []
  const scoreKey = eqs.find(e => picklist?.[0] && typeof picklist[0][e.varName] === "number")?.varName || "matches"
  const teamNums = cfg.teams || []
  const teams = teamNums.map(n => picklist?.find(t => String(t.team) === String(n))).filter(Boolean)
  const METRICS = [{ label: scoreKey, key: scoreKey }, { label: "Matches", key: "matches" }, ...fields.map(f => ({ label: f.label, key: f.varName }))]
  function add() { const n = input.trim(); if (!n) return; onUpdate({ ...cfg, teams: [...teamNums, n] }); setInput("") }
  return (
    <>
      <div className="cmp-header">
        <span className="cmp-title">COMPARE · {teams.length} teams</span>
        <div style={{ display: "flex", gap: 5 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="Team #"
            style={{ width: 70, padding: "4px 8px", borderRadius: 20, border: "0.5px solid var(--border2)", background: "rgba(255,255,255,0.05)", color: "var(--text)", fontSize: 11, fontFamily: "'DM Mono',monospace", outline: "none" }} />
          <button onClick={add} style={{ padding: "4px 10px", borderRadius: 20, border: "0.5px dashed var(--border2)", background: "transparent", color: "var(--text3)", fontSize: 11, cursor: "pointer" }}>＋</button>
        </div>
      </div>
      {!teams.length ? <div className="sr-empty">Add teams to compare.</div> : (
        <>
          <div className="cmp-teams-row">
            {teams.map(t => (
              <div key={t.team} className="cmp-team-col">
                <div className="cmp-team-num">{t.team}</div>
                <div className="cmp-team-name">Team {t.team}</div>
                <button style={{ fontSize: 10, color: "var(--text3)", cursor: "pointer", background: "none", border: "none", textAlign: "left", padding: 0, fontFamily: "'DM Sans',sans-serif", marginTop: 2 }}
                  onClick={() => onUpdate({ ...cfg, teams: teamNums.filter(n => String(n) !== String(t.team)) })}>✕ remove</button>
              </div>
            ))}
          </div>
          <div style={{ padding: "8px 16px 4px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: "var(--text3)", marginBottom: 6, fontFamily: "'DM Mono',monospace" }}>Metrics</div>
            {METRICS.slice(0, 10).map(m => {
              const vals = teams.map(t => Number(t[m.key] ?? 0))
              const maxV = Math.max(...vals, 0.001)
              return (
                <div key={m.key} className="cmp-metric-row">
                  <div className="cmp-metric-label">{m.label}</div>
                  <div className="cmp-metric-cells">
                    {vals.map((v, i) => {
                      const isBest = vals.length > 1 && v === Math.max(...vals)
                      const isWorst = vals.length > 1 && v === Math.min(...vals)
                      return (
                        <div key={i} className="cmp-metric-cell">
                          <div className={`cmp-metric-val${isBest ? " best" : isWorst ? " worst" : " mid"}`}>{fmtNum(v)}</div>
                          <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", marginTop: 3 }}>
                            <div style={{ width: `${(v / maxV) * 100}%`, height: "100%", borderRadius: 2, background: isBest ? "var(--green)" : "var(--accent)" }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  LIVE SCOUTERS
// ─────────────────────────────────────────────────────────────────────────────
function LiveScouters({ scouters, health }) {
  const list = scouters || []
  return (
    <>
      <div style={{ padding: "9px 14px 8px", background: "rgba(255,255,255,0.02)", borderBottom: "0.5px solid var(--border)", display: "flex", gap: 14, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: health?.ok ? "var(--green)" : "var(--red)", boxShadow: health?.ok ? "0 0 8px var(--green)" : "none" }} />
          <span style={{ fontSize: 11, color: "var(--text2)", fontFamily: "'DM Mono',monospace" }}>{health?.ok ? "Live" : "Offline"}</span>
        </div>
        <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "'DM Mono',monospace" }}>{list.length} active</span>
        {health?.time && <span style={{ fontSize: 10, color: "var(--text3)", fontFamily: "'DM Mono',monospace", marginLeft: "auto" }}>{health.time}</span>}
      </div>
      {!list.length && <div className="sr-empty">No active scouters.</div>}
      {list.map(s => {
        const pct = s.pct || 0
        const dotColor = pct > 75 ? "var(--green)" : pct > 40 ? "var(--yellow)" : "var(--text3)"
        return (
          <div key={s.scouter_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "0.5px solid var(--border)" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, boxShadow: pct > 40 ? `0 0 8px ${dotColor}` : "none", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.display_name || s.scouter_id}</div>
              <div style={{ fontSize: 10, color: "var(--text3)", fontFamily: "'DM Mono',monospace" }}>M{s.match || "—"} · #{s.team || "—"} · {s.alliance || "—"}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: dotColor }}>{pct}%</div>
              <div style={{ width: 48, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)", marginTop: 3 }}>
                <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: dotColor, transition: "width 0.5s" }} />
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  GLASS WIDGET CARD
// ─────────────────────────────────────────────────────────────────────────────
function GlCard({ widget, pos, cz, zIndex, onBringToFront, onPosChange, onRemove, onToggleWide, onFocus, markerMode, nodeSelected, nodeSource, onNodeClick, children }) {
  const ref = useRef(null)
  const drag = useRef(null)
  const resize = useRef(null)
  const [lifted, setLifted] = useState(false)

  const p = pos || { x: 100, y: 100 }
  const w = pos?.customW ?? (pos?.xwide ? 900 : pos?.wide ? 640 : 320)
  const h = pos?.customH

  function onHeaderDown(e) {
    if (e.button !== 0) return
    e.stopPropagation()
    onBringToFront()
    ref.current.setPointerCapture(e.pointerId)
    drag.current = { sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y }
    setLifted(true)
  }
  function onResizeDown(e) {
    e.stopPropagation(); e.preventDefault()
    ref.current.setPointerCapture(e.pointerId)
    resize.current = { sx: e.clientX, sy: e.clientY, ow: w, oh: h || 400 }
  }
  function onMove(e) {
    if (drag.current) {
      const dx = (e.clientX - drag.current.sx) / cz
      const dy = (e.clientY - drag.current.sy) / cz
      onPosChange({ ...pos, x: drag.current.ox + dx, y: drag.current.oy + dy })
    }
    if (resize.current) {
      const dx = (e.clientX - resize.current.sx) / cz
      const dy = (e.clientY - resize.current.sy) / cz
      onPosChange({ ...pos, customW: Math.max(220, resize.current.ow + dx), customH: Math.max(160, resize.current.oh + dy) })
    }
  }
  function onUp() { drag.current = null; resize.current = null; setLifted(false) }

  const cls = `gl-card${lifted ? " lifted" : ""}${nodeSelected ? " node-selected" : ""}${nodeSource ? " node-source" : ""}`

  return (
    <div ref={ref} className={cls}
      style={{ left: p.x, top: p.y, zIndex, width: w, ...(h ? { height: h } : {}), cursor: markerMode ? "crosshair" : undefined }}
      onPointerMove={onMove} onPointerUp={onUp}
      onClick={markerMode ? (e) => { e.stopPropagation(); onNodeClick(widget.id) } : undefined}>
      <div style={{ borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column", flex: 1 }}>
        <div className="gl-wh" onPointerDown={markerMode ? undefined : onHeaderDown}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>{widget.icon || "◈"}</span>
          <span className="gl-wh-title">{widget.title}</span>
          {widget.badge && <span className="gl-wh-badge">{widget.badge}</span>}
          {markerMode && (
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: nodeSource ? "var(--orange)" : nodeSelected ? "var(--purple)" : "rgba(255,255,255,0.2)", boxShadow: nodeSource ? "0 0 8px var(--orange)" : nodeSelected ? "0 0 8px var(--purple)" : "none", flexShrink: 0 }} />
          )}
          {!markerMode && (
            <>
              <button className="gl-wh-btn expand" onClick={() => onToggleWide()} title="Toggle wide">⇔</button>
              <button className="gl-wh-btn expand" onClick={() => onFocus(widget.id)} title="Focus">⊕</button>
              <button className="gl-wh-btn close" onClick={onRemove} title="Remove">✕</button>
            </>
          )}
        </div>
        <div className="gl-wb" style={h ? { maxHeight: h - 46 } : {}}>
          {children}
        </div>
      </div>
      {!markerMode && <div className="gl-resize" onPointerDown={onResizeDown} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  FOCUS PANEL (full-screen detail when widget is clicked)
// ─────────────────────────────────────────────────────────────────────────────
function FocusPanel({ widget, picklist, schema, equations, scouters, health, onClose }) {
  const active = !!widget
  return (
    <>
      <div className={`focus-overlay${active ? " active" : ""}`} onClick={onClose} />
      <div className={`focus-panel${active ? " active" : ""}`}>
        {widget && (
          <>
            <div className="focus-panel-header">
              <span style={{ fontSize: 18, flexShrink: 0 }}>{widget.icon || "◈"}</span>
              <span className="focus-panel-title">{widget.title}</span>
              <button className="focus-panel-close" onClick={onClose}>✕</button>
            </div>
            <div className="focus-panel-body">
              {widget.type === "leaderboard" && <Leaderboard picklist={picklist} schema={schema} equations={equations} onOpenTeam={() => {}} />}
              {widget.type === "teamDetail" && <TeamDetail teamNum={widget.teamNumber} picklist={picklist} schema={schema} equations={equations} />}
              {widget.type === "compare" && <Compare cfg={widget} picklist={picklist} schema={schema} equations={equations} onUpdate={() => {}} />}
              {widget.type === "live" && <LiveScouters scouters={scouters} health={health} />}
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  PROCESS RESULT MODAL
// ─────────────────────────────────────────────────────────────────────────────
function ProcessResult({ result, onClose }) {
  const show = !!result
  return (
    <div className={`process-result${show ? " show" : ""}`} style={{ pointerEvents: show ? "all" : "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--purple)", boxShadow: "0 0 10px var(--purple)" }} />
        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Syne',sans-serif", flex: 1, color: "var(--text)" }}>Connection Analysis</span>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "0.5px solid var(--border2)", borderRadius: 8, color: "var(--text2)", fontSize: 12, padding: "4px 10px", cursor: "pointer" }}>Close</button>
      </div>
      <div style={{ padding: "16px 18px", overflow: "auto", flex: 1 }}>
        {result?.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "0.5px solid var(--border)", alignItems: "flex-start" }}>
            <div style={{ minWidth: 24, height: 24, borderRadius: "50%", background: "rgba(168,85,247,0.15)", border: "0.5px solid rgba(168,85,247,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--purple)", fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>{i + 1}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{item.label}</div>
              <div style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.5 }}>{item.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  ADD WIDGET MODAL
// ─────────────────────────────────────────────────────────────────────────────
function AddModal({ onAdd, onClose }) {
  const [type, setType] = useState("leaderboard")
  const [teamNum, setTeamNum] = useState("")
  const [cmpTeams, setCmpTeams] = useState("")
  const TYPES = [
    { id: "leaderboard", label: "📋 Leaderboard" },
    { id: "teamDetail", label: "🤖 Team Detail" },
    { id: "compare", label: "⚖️ Compare" },
    { id: "live", label: "🟢 Live Scouters" },
  ]
  function submit() {
    let cfg = {}
    if (type === "leaderboard") cfg = { type, title: "Leaderboard", icon: "📋" }
    else if (type === "teamDetail") { if (!teamNum.trim()) return; cfg = { type, title: `Team ${teamNum}`, icon: "🤖", teamNumber: teamNum.trim() } }
    else if (type === "compare") cfg = { type, title: "Compare", icon: "⚖️", teams: cmpTeams.split(",").map(s => s.trim()).filter(Boolean) }
    else if (type === "live") cfg = { type, title: "Live Scouters", icon: "🟢" }
    onAdd(cfg); onClose()
  }
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(16px)", zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "rgba(10,14,22,0.97)", border: "0.5px solid rgba(255,255,255,0.16)", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto", padding: "0 20px 48px", fontFamily: "'DM Sans',sans-serif", backdropFilter: "blur(40px)" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)", margin: "12px auto 20px" }} />
        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: "var(--text)", marginBottom: 4 }}>Add Widget</div>
        <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 20 }}>Choose a panel for the canvas.</div>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: "var(--text3)", marginBottom: 8, fontFamily: "'DM Mono',monospace" }}>Widget Type</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)}
              style={{ padding: "8px 14px", borderRadius: 20, border: `0.5px solid ${type === t.id ? "rgba(59,130,246,0.5)" : "var(--border)"}`, background: type === t.id ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.05)", color: type === t.id ? "var(--accent2)" : "var(--text2)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>
        {type === "teamDetail" && (
          <>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: "var(--text3)", marginBottom: 7, fontFamily: "'DM Mono',monospace" }}>Team Number</div>
            <input value={teamNum} onChange={e => setTeamNum(e.target.value)} placeholder="e.g. 4028"
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "0.5px solid var(--border2)", borderRadius: 12, padding: "11px 13px", fontSize: 14, color: "var(--text)", outline: "none", fontFamily: "'DM Sans',sans-serif", marginBottom: 16 }} />
          </>
        )}
        {type === "compare" && (
          <>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: "var(--text3)", marginBottom: 7, fontFamily: "'DM Mono',monospace" }}>Teams (comma separated)</div>
            <input value={cmpTeams} onChange={e => setCmpTeams(e.target.value)} placeholder="4028, 254, 1114"
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "0.5px solid var(--border2)", borderRadius: 12, padding: "11px 13px", fontSize: 14, color: "var(--text)", outline: "none", fontFamily: "'DM Sans',sans-serif", marginBottom: 16 }} />
          </>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, borderRadius: 14, border: "0.5px solid var(--border2)", background: "rgba(255,255,255,0.05)", color: "var(--text2)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={submit} style={{ flex: 1, padding: 13, borderRadius: 14, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 14px rgba(59,130,246,0.35)" }}>Add Widget</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────────────────────────────────────
function Toast({ msg }) {
  return (
    <div style={{
      position: "fixed", bottom: 28, left: "50%",
      transform: `translateX(-50%) translateY(${msg ? 0 : 60}px)`,
      background: "rgba(10,14,22,0.97)", backdropFilter: "blur(30px)",
      border: "0.5px solid rgba(255,255,255,0.15)", borderTopColor: "rgba(255,255,255,0.28)",
      borderRadius: 14, padding: "9px 18px", fontSize: 12, fontWeight: 600, color: "var(--text)",
      zIndex: 700, transition: "transform .35s cubic-bezier(.32,1.1,.5,1)",
      whiteSpace: "nowrap", pointerEvents: "none",
      boxShadow: "0 16px 48px rgba(0,0,0,0.65)", fontFamily: "'DM Sans',sans-serif",
    }}>{msg}</div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  3D SCENE TAB
// ─────────────────────────────────────────────────────────────────────────────
const PLANES = [
  { label: "OVERVIEW", rotY: 0, rotX: 0 },
  { label: "ANALYTICS", rotY: -25, rotX: 5 },
  { label: "COMPARE", rotY: 25, rotX: -5 },
]

const DEMO_3D_CARDS = [
  { id: "3d-lb", title: "Leaderboard", icon: "📋", color: "#3B82F6", x: -380, y: -80, z: 0, w: 280, h: 200 },
  { id: "3d-live", title: "Live Scouters", icon: "🟢", color: "#22C55E", x: -60, y: -140, z: 40, w: 220, h: 160 },
  { id: "3d-team", title: "Team 9035", icon: "🤖", color: "#A855F7", x: 200, y: -60, z: 20, w: 240, h: 180 },
  { id: "3d-cmp", title: "Compare", icon: "⚖️", color: "#F97316", x: -300, y: 100, z: -20, w: 200, h: 150 },
  { id: "3d-stats", title: "Match Stats", icon: "📊", color: "#14B8A6", x: 80, y: 120, z: 60, w: 260, h: 170 },
  { id: "3d-rank", title: "Rankings", icon: "🏆", color: "#EAB308", x: 340, y: 80, z: -10, w: 220, h: 160 },
]

function Scene3D({ picklist, schema, equations, scouters, health }) {
  const [planeIdx, setPlaneIdx] = useState(0)
  const [rotX, setRotX] = useState(15)
  const [rotY, setRotY] = useState(-8)
  const [dragging, setDragging] = useState(false)
  const [focused3d, setFocused3d] = useState(null)
  const dragStart = useRef(null)
  const sceneRef = useRef(null)

  // Mouse drag to orbit
  function onMouseDown(e) {
    if (e.target.closest(".gl-3d-card")) return
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, rx: rotX, ry: rotY }
  }
  function onMouseMove(e) {
    if (!dragging || !dragStart.current) return
    const dx = (e.clientX - dragStart.current.x) * 0.35
    const dy = (e.clientY - dragStart.current.y) * 0.25
    setRotY(dragStart.current.ry + dx)
    setRotX(Math.max(-35, Math.min(35, dragStart.current.rx + dy)))
  }
  function onMouseUp() { setDragging(false) }

  // Keyboard plane swipe
  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowLeft") setPlaneIdx(i => Math.max(0, i - 1))
      if (e.key === "ArrowRight") setPlaneIdx(i => Math.min(PLANES.length - 1, i + 1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const plane = PLANES[planeIdx]

  return (
    <div style={{ position: "fixed", inset: 0, top: 100, zIndex: 1, overflow: "hidden" }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>

      {/* Background grid plane */}
      <div style={{ position: "absolute", inset: 0, perspective: "1200px", pointerEvents: "none" }}>
        <div style={{ position: "absolute", inset: "-50%", transform: `rotateX(65deg) rotateZ(${rotY * 0.1}deg) translateZ(-200px)`, transformOrigin: "center center", backgroundImage: "linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)", backgroundSize: "80px 80px", opacity: 0.6 }} />
      </div>

      {/* Plane label */}
      <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 20, display: "flex", alignItems: "center", gap: 12 }}>
        {PLANES.map((p, i) => (
          <button key={i} onClick={() => setPlaneIdx(i)}
            style={{ padding: "4px 14px", borderRadius: 20, border: `0.5px solid ${i === planeIdx ? "rgba(59,130,246,0.45)" : "var(--border)"}`, background: i === planeIdx ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.04)", backdropFilter: "blur(10px)", color: i === planeIdx ? "var(--accent2)" : "var(--text3)", fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono',monospace", cursor: "pointer", letterSpacing: ".12em" }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Swipe indicators */}
      <div style={{ position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 6, zIndex: 20, pointerEvents: "none" }}>
        {PLANES.map((_, i) => (
          <div key={i} style={{ width: 4, height: i === planeIdx ? 20 : 4, borderRadius: 2, background: i === planeIdx ? "var(--accent2)" : "rgba(255,255,255,0.15)", transition: "height 0.3s, background 0.3s" }} />
        ))}
        <div style={{ fontSize: 9, color: "var(--text3)", fontFamily: "'DM Mono',monospace", marginTop: 8, writingMode: "vertical-rl", letterSpacing: ".1em" }}>← →</div>
      </div>

      {/* 3D Scene */}
      <div ref={sceneRef} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", perspective: "1200px", cursor: dragging ? "grabbing" : "grab" }}>
        <div style={{
          position: "relative",
          transformStyle: "preserve-3d",
          transform: `rotateX(${rotX + plane.rotX}deg) rotateY(${rotY + plane.rotY}deg)`,
          transition: dragging ? "none" : "transform 0.7s cubic-bezier(0.4,0,0.2,1)",
          width: 0, height: 0,
        }}>
          {DEMO_3D_CARDS.map((card, i) => {
            const isFocused = focused3d === card.id
            return (
              <div key={card.id} className="gl-3d-card"
                style={{
                  width: card.w, height: card.h,
                  transform: `translate3d(${card.x}px,${card.y}px,${card.z}px)${isFocused ? " scale(1.06)" : ""}`,
                  zIndex: isFocused ? 10 : 1,
                  pointerEvents: "all",
                }}
                onClick={e => { e.stopPropagation(); setFocused3d(focused3d === card.id ? null : card.id) }}>

                {/* Glass header */}
                <div style={{ padding: "10px 14px 8px", background: `rgba(${hexToRgb(card.color)},0.08)`, borderBottom: "0.5px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13 }}>{card.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", fontFamily: "'Syne',sans-serif", flex: 1 }}>{card.title}</span>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: card.color, boxShadow: `0 0 8px ${card.color}` }} />
                </div>

                {/* Mini content */}
                <div style={{ padding: "10px 14px", flex: 1 }}>
                  {i === 0 && picklist?.slice(0, 3).map((t, ti) => (
                    <div key={t.team} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                      <span style={{ fontSize: 9, color: "var(--text3)", minWidth: 16, fontFamily: "'DM Mono',monospace" }}>#{ti + 1}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: card.color, fontFamily: "'Syne',sans-serif" }}>{t.team}</span>
                      <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.05)" }}>
                        <div style={{ width: `${70 - ti * 20}%`, height: "100%", borderRadius: 2, background: card.color, opacity: 0.7 }} />
                      </div>
                    </div>
                  ))}
                  {i !== 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ height: 6, borderRadius: 3, background: `rgba(${hexToRgb(card.color)},0.2)`, width: "85%" }} />
                      <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.04)", width: "65%" }} />
                      <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.04)", width: "75%" }} />
                    </div>
                  )}
                </div>

                {/* Expand hint */}
                {isFocused && (
                  <div style={{ position: "absolute", bottom: 8, right: 10, fontSize: 10, color: "var(--text3)", fontFamily: "'DM Mono',monospace" }}>click to collapse</div>
                )}
              </div>
            )
          })}

          {/* Connecting lines between cards (visual) */}
          <svg style={{ position: "absolute", left: "-500px", top: "-300px", width: "1000px", height: "600px", pointerEvents: "none", overflow: "visible" }}>
            <line x1="500" y1="300" x2="640" y2="260" stroke="rgba(59,130,246,0.12)" strokeWidth="1" />
            <line x1="500" y1="300" x2="560" y2="200" stroke="rgba(168,85,247,0.12)" strokeWidth="1" />
            <line x1="500" y1="300" x2="700" y2="290" stroke="rgba(20,184,166,0.12)" strokeWidth="1" />
            <line x1="500" y1="300" x2="580" y2="400" stroke="rgba(234,179,8,0.12)" strokeWidth="1" />
          </svg>
        </div>
      </div>

      {/* Controls hint */}
      <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: "var(--text3)", fontFamily: "'DM Mono',monospace", letterSpacing: ".1em", display: "flex", gap: 16, pointerEvents: "none" }}>
        <span>DRAG TO ORBIT</span>
        <span>← → PLANES</span>
        <span>CLICK CARD TO FOCUS</span>
      </div>
    </div>
  )
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

// ─────────────────────────────────────────────────────────────────────────────
//  DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_WIDGETS = [
  { id: "lb1", type: "leaderboard", title: "Leaderboard", icon: "📋" },
  { id: "live1", type: "live", title: "Live Scouters", icon: "🟢" },
]
const DEFAULT_POS = {
  lb1: { x: 40, y: 20 },
  live1: { x: 400, y: 20 },
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function DriveView() {
  const [activeTab, setActiveTab] = useState("canvas") // canvas | scene3d
  const [cam, setCam] = useState({ cx: 60, cy: 60, cz: 1 })
  const camRef = useRef(cam); camRef.current = cam
  const wrapRef = useRef(null)
  const panning = useRef(false)
  const panStart = useRef({})
  const pinching = useRef(false)
  const pinchDist = useRef(0)
  const pinchMid = useRef({})

  const [widgets, setWidgets] = useState(() => { try { return JSON.parse(localStorage.getItem(LS_WIDGETS)) || DEFAULT_WIDGETS } catch { return DEFAULT_WIDGETS } })
  const [positions, setPositions] = useState(() => { try { return JSON.parse(localStorage.getItem(LS_POS)) || DEFAULT_POS } catch { return DEFAULT_POS } })
  const [zOrders, setZOrders] = useState({})
  const zTop = useRef(10)

  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState("")
  const toastTimer = useRef(null)
  const [search, setSearch] = useState("")

  // Focus panel
  const [focusedWidget, setFocusedWidget] = useState(null)

  // Marker / node mode
  const [markerMode, setMarkerMode] = useState(false)
  const [connections, setConnections] = useState([])
  const [pendingSource, setPendingSource] = useState(null)
  const [mousePos, setMousePos] = useState(null)
  const [processResult, setProcessResult] = useState(null)
  const [processing, setProcessing] = useState(false)

  const picklist = usePoll(`${API}/api/picklist`, 5000)
  const scouters = usePoll(`${API}/api/scout-progress`, 3000)
  const health = usePoll(`${API}/api/health`, 5000)
  const schema = usePoll(`${API}/api/schema`, 30000)
  const equations = usePoll(`${API}/api/equations`, 30000)

  useEffect(() => { try { localStorage.setItem(LS_WIDGETS, JSON.stringify(widgets)) } catch {} }, [widgets])
  useEffect(() => { try { localStorage.setItem(LS_POS, JSON.stringify(positions)) } catch {} }, [positions])

  function showToast(msg) {
    setToast(msg); clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(""), 2500)
  }

  function zoomAt(f, mx, my) {
    setCam(prev => {
      const nz = Math.min(3, Math.max(0.15, prev.cz * f))
      return { cx: mx - (mx - prev.cx) * (nz / prev.cz), cy: my - (my - prev.cy) * (nz / prev.cz), cz: nz }
    })
  }

  function onWrapDown(e) {
    if (e.target.closest(".gl-card")) return
    if (markerMode) return
    panning.current = true
    panStart.current = { px: e.clientX, py: e.clientY, cx: camRef.current.cx, cy: camRef.current.cy }
    if (wrapRef.current) wrapRef.current.style.cursor = "grabbing"
  }
  function onWrapMove(e) {
    setMousePos({ x: e.clientX, y: e.clientY })
    if (!panning.current) return
    setCam(prev => ({ ...prev, cx: panStart.current.cx + (e.clientX - panStart.current.px), cy: panStart.current.cy + (e.clientY - panStart.current.py) }))
  }
  function onWrapUp() { panning.current = false; if (wrapRef.current) wrapRef.current.style.cursor = "grab" }
  function onWheel(e) {
    if (e.target.closest(".gl-wb")) return
    e.preventDefault()
    zoomAt(e.deltaY < 0 ? 1.09 : 0.92, e.clientX, e.clientY)
  }
  function onTouchStart(e) {
    if (e.touches.length === 2) {
      pinching.current = true; panning.current = false
      const [t1, t2] = e.touches
      pinchDist.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      pinchMid.current = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 }
    } else if (!e.target.closest(".gl-card")) {
      panning.current = true
      panStart.current = { px: e.touches[0].clientX, py: e.touches[0].clientY, cx: camRef.current.cx, cy: camRef.current.cy }
    }
  }
  function onTouchMove(e) {
    if (e.touches.length === 2 && pinching.current) {
      e.preventDefault()
      const [t1, t2] = e.touches
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      zoomAt(dist / pinchDist.current, pinchMid.current.x, pinchMid.current.y)
      pinchDist.current = dist
    } else if (panning.current) {
      e.preventDefault()
      setCam(prev => ({ ...prev, cx: panStart.current.cx + (e.touches[0].clientX - panStart.current.px), cy: panStart.current.cy + (e.touches[0].clientY - panStart.current.py) }))
    }
  }
  function onTouchEnd() { pinching.current = false; panning.current = false }

  function addWidget(cfg) {
    const id = Date.now().toString()
    setWidgets(prev => [...prev, { id, ...cfg }])
    const vx = (-camRef.current.cx + window.innerWidth / 2) / camRef.current.cz - 160
    const vy = (-camRef.current.cy + window.innerHeight / 2) / camRef.current.cz - 200
    setPositions(prev => ({ ...prev, [id]: { x: vx, y: vy } }))
    showToast("Widget added!")
  }
  function removeWidget(id) {
    setWidgets(prev => prev.filter(w => w.id !== id))
    setPositions(prev => { const n = { ...prev }; delete n[id]; return n })
    setConnections(prev => prev.filter(c => c.from !== id && c.to !== id))
    showToast("Widget removed")
  }
  function updatePos(id, p) { setPositions(prev => ({ ...prev, [id]: p })) }
  function updateWidget(id, data) { setWidgets(prev => prev.map(w => w.id === id ? { ...w, ...data } : w)) }
  function bringToFront(id) { zTop.current++; setZOrders(prev => ({ ...prev, [id]: zTop.current })) }
  function openTeamDetail(num) {
    const existing = widgets.find(w => w.type === "teamDetail" && String(w.teamNumber) === String(num))
    if (existing) { bringToFront(existing.id); showToast(`Team ${num}`); return }
    addWidget({ type: "teamDetail", title: `Team ${num}`, icon: "🤖", teamNumber: String(num) })
  }

  // Node mode
  function handleNodeClick(widgetId) {
    if (!markerMode) return
    if (!pendingSource) {
      setPendingSource(widgetId)
      showToast("Source selected — click a target widget")
    } else if (pendingSource !== widgetId) {
      const exists = connections.find(c => c.from === pendingSource && c.to === widgetId)
      if (!exists) {
        setConnections(prev => [...prev, { from: pendingSource, to: widgetId }])
        showToast("Connection made!")
      }
      setPendingSource(null)
    } else {
      setPendingSource(null)
    }
  }

  function toggleMarkerMode() {
    setMarkerMode(m => {
      if (m) { setPendingSource(null) }
      return !m
    })
  }

  function clearConnections() {
    setConnections([])
    setPendingSource(null)
    showToast("Connections cleared")
  }

  async function processConnections() {
    if (!connections.length) { showToast("No connections to process"); return }
    setProcessing(true)
    await new Promise(r => setTimeout(r, 900))
    const results = connections.map((conn, i) => {
      const from = widgets.find(w => w.id === conn.from)
      const to = widgets.find(w => w.id === conn.to)
      return {
        label: `${from?.title || conn.from} → ${to?.title || conn.to}`,
        description: generateDescription(from, to, i),
      }
    })
    setProcessResult(results)
    setProcessing(false)
  }

  function generateDescription(from, to, i) {
    const pairs = [
      ["Leaderboard", "Team Detail", "Rankings flow into team detail — highest-ranked teams are prime candidates for deep analysis."],
      ["Team Detail", "Compare", "Individual team insights feed directly into comparative view for side-by-side benchmarking."],
      ["Live Scouters", "Leaderboard", "Real-time scouting updates propagate to leaderboard scoring immediately."],
      ["Compare", "Team Detail", "Comparison highlights recommend focused inspection of outlier performers."],
    ]
    const fromType = from?.type || ""
    const toType = to?.type || ""
    const pair = pairs.find(p => fromType.includes(p[0].toLowerCase().replace(" ", "")) || p[0].toLowerCase().includes(fromType))
    return pair ? pair[2] : `Data flows from ${from?.title || "source"} into ${to?.title || "target"}, enabling downstream analysis and ranked evaluation in step ${i + 1}.`
  }

  const isLive = health?.ok
  const activeScouters = scouters?.length || 0
  const TAB_IDS = ["canvas", "scene3d"]
  const TAB_LABELS = ["Canvas", "3D Scene"]

  return (
    <>
      <style>{FONTS}</style>
      <style>{GLOBAL_CSS}</style>

      {/* Ambient background glow */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse 80% 50% at 20% 30%, rgba(59,130,246,0.04) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 70%, rgba(168,85,247,0.03) 0%, transparent 60%)" }} />

      {/* ── TOP BAR ── */}
      <div className="top-bar">
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800, letterSpacing: "-.5px", color: "var(--text)", flexShrink: 0 }}>
          935<span style={{ color: "var(--accent)" }}>//</span>DC
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && search.trim()) { openTeamDetail(search.trim()); setSearch("") } }}
            placeholder="Team #" inputMode="numeric"
            style={{ width: 90, padding: "6px 10px", borderRadius: 20, border: "0.5px solid var(--border2)", background: "rgba(255,255,255,0.05)", color: "var(--text)", fontSize: 12, fontFamily: "'DM Mono',monospace", outline: "none", backdropFilter: "blur(10px)" }} />
          <button onClick={() => { if (search.trim()) { openTeamDetail(search.trim()); setSearch("") } }}
            style={{ padding: "5px 12px", borderRadius: 20, border: "0.5px solid var(--border2)", background: "rgba(255,255,255,0.07)", color: "var(--text2)", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", backdropFilter: "blur(10px)" }}>Go</button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Status chips */}
        <div className="chip">
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: isLive ? "var(--green)" : "var(--red)", boxShadow: isLive ? "0 0 6px var(--green)" : "none" }} />
          <span style={{ fontFamily: "'DM Mono',monospace" }}>{isLive ? "Live" : "Offline"}</span>
        </div>
        {activeScouters > 0 && (
          <div className="chip" style={{ background: "rgba(34,197,94,0.08)", color: "var(--green)", border: "0.5px solid rgba(34,197,94,0.2)" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 6px var(--green)", animation: "blink 1.4s infinite" }} />
            <span style={{ fontFamily: "'DM Mono',monospace" }}>{activeScouters} scouts</span>
          </div>
        )}

        {activeTab === "canvas" && (
          <>
            {[["＋", () => zoomAt(1.15, window.innerWidth / 2, window.innerHeight / 2)],
              ["−", () => zoomAt(0.87, window.innerWidth / 2, window.innerHeight / 2)],
              ["⊙", () => setCam({ cx: 60, cy: 60, cz: 1 })]
            ].map(([lbl, fn]) => (
              <button key={lbl} onClick={fn} className="icon-btn" style={{ fontSize: 14 }}>{lbl}</button>
            ))}

            {/* Marker mode button */}
            <button className={`marker-btn ${markerMode ? "on" : "off"}`} onClick={toggleMarkerMode} title="Draw connections between widgets">
              ✏️
            </button>

            <button className="add-btn" onClick={() => setShowAdd(true)}>＋</button>
          </>
        )}
      </div>

      {/* ── TAB BAR ── */}
      <div className="tab-bar">
        {TAB_IDS.map((id, i) => (
          <button key={id} className={`tab-btn${activeTab === id ? " active" : ""}`} onClick={() => setActiveTab(id)}>
            {TAB_LABELS[i]}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {activeTab === "canvas" && (
          <span style={{ fontSize: 10, color: "var(--text3)", fontFamily: "'DM Mono',monospace" }}>
            {Math.round(cam.cz * 100)}%
          </span>
        )}
        {activeTab === "canvas" && markerMode && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--purple)", boxShadow: "0 0 8px var(--purple)", animation: "blink 1.2s infinite" }} />
            <span style={{ fontSize: 10, color: "var(--purple)", fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>
              {pendingSource ? "SELECT TARGET" : "SELECT SOURCE"}
            </span>
            <button onClick={clearConnections} style={{ fontSize: 10, color: "var(--text3)", cursor: "pointer", background: "none", border: "none", fontFamily: "'DM Mono',monospace" }}>clear</button>
          </div>
        )}
      </div>

      {/* ── CANVAS TAB ── */}
      {activeTab === "canvas" && (
        <>
          <DotGrid cx={cam.cx} cy={cam.cy} cz={cam.cz} />

          {/* Node lines */}
          <NodeLines connections={connections} widgets={widgets} positions={positions} cam={cam} pendingSource={pendingSource} mousePos={markerMode ? mousePos : null} />

          <div ref={wrapRef}
            style={{ position: "fixed", inset: 0, top: 100, overflow: "hidden", zIndex: 1, cursor: markerMode ? "crosshair" : "grab" }}
            onPointerDown={onWrapDown} onPointerMove={onWrapMove} onPointerUp={onWrapUp}
            onWheel={onWheel} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <div style={{
              position: "absolute", width: 10000, height: 10000,
              transformOrigin: "0 0",
              transform: `translate3d(${cam.cx}px,${cam.cy}px,0) scale(${cam.cz})`,
              willChange: "transform",
            }}>
              {widgets.map(w => (
                <GlCard key={w.id} widget={w} pos={positions[w.id]} cz={cam.cz}
                  zIndex={zOrders[w.id] || 10}
                  onBringToFront={() => bringToFront(w.id)}
                  onPosChange={p => updatePos(w.id, p)}
                  onRemove={() => removeWidget(w.id)}
                  onToggleWide={() => updatePos(w.id, { ...positions[w.id], wide: !positions[w.id]?.wide, xwide: false, customW: undefined })}
                  onFocus={() => { setFocusedWidget(w); bringToFront(w.id) }}
                  markerMode={markerMode}
                  nodeSelected={connections.some(c => c.from === w.id || c.to === w.id)}
                  nodeSource={pendingSource === w.id}
                  onNodeClick={handleNodeClick}>
                  {w.type === "leaderboard" && <Leaderboard picklist={picklist} schema={schema} equations={equations} onOpenTeam={openTeamDetail} />}
                  {w.type === "teamDetail" && <TeamDetail teamNum={w.teamNumber} picklist={picklist} schema={schema} equations={equations} />}
                  {w.type === "compare" && <Compare cfg={w} picklist={picklist} schema={schema} equations={equations} onUpdate={data => updateWidget(w.id, data)} />}
                  {w.type === "live" && <LiveScouters scouters={scouters} health={health} />}
                </GlCard>
              ))}
            </div>
          </div>

          {/* Process banner */}
          <div className={`process-banner${connections.length > 0 && !markerMode ? " show" : ""}`}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", gap: 3 }}>
                {connections.slice(0, 5).map((_, i) => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--purple)", opacity: 0.6 + i * 0.1 }} />
                ))}
              </div>
              <span style={{ fontSize: 12, color: "var(--text2)", fontFamily: "'DM Sans',sans-serif" }}>
                <span style={{ color: "var(--purple)", fontWeight: 700 }}>{connections.length}</span> connection{connections.length !== 1 ? "s" : ""} drawn
              </span>
            </div>
            <button onClick={processConnections}
              style={{ padding: "7px 16px", borderRadius: 20, border: "none", background: "linear-gradient(135deg,var(--purple),#7c3aed)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", boxShadow: "0 4px 14px rgba(168,85,247,0.35)", display: "flex", alignItems: "center", gap: 6 }}>
              {processing ? <><span style={{ animation: "blink 0.8s infinite" }}>⟳</span> Processing…</> : "⚡ Process"}
            </button>
            <button onClick={clearConnections} style={{ width: 28, height: 28, borderRadius: 20, background: "rgba(239,68,68,0.12)", border: "0.5px solid rgba(239,68,68,0.3)", color: "var(--red)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>

          {/* Process result */}
          <div style={{ position: "fixed", inset: 0, zIndex: 490, pointerEvents: processResult ? "all" : "none" }}
            onClick={() => setProcessResult(null)}>
            <ProcessResult result={processResult} onClose={() => setProcessResult(null)} />
          </div>
        </>
      )}

      {/* ── 3D SCENE TAB ── */}
      {activeTab === "scene3d" && (
        <Scene3D picklist={picklist} schema={schema} equations={equations} scouters={scouters} health={health} />
      )}

      {/* ── FOCUS PANEL (widget clicked → bring to front big) ── */}
      <FocusPanel
        widget={focusedWidget}
        picklist={picklist} schema={schema} equations={equations}
        scouters={scouters} health={health}
        onClose={() => setFocusedWidget(null)}
      />

      {showAdd && <AddModal onAdd={addWidget} onClose={() => setShowAdd(false)} />}
      <Toast msg={toast} />

      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}} @keyframes markerPulse{0%,100%{box-shadow:0 0 16px rgba(168,85,247,0.3)}50%{box-shadow:0 0 28px rgba(168,85,247,0.55)}}`}</style>
    </>
  )
}