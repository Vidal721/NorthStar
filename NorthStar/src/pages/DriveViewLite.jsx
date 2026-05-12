import { useMemo, useState, useEffect, useRef, useCallback } from "react"

// ── FONTS ──────────────────────────────────────────────────────────
const fontLink = document.createElement("link")
fontLink.rel = "stylesheet"
fontLink.href = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;700&family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap"
document.head.appendChild(fontLink)

const style = document.createElement("style")
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --accent: #3B82F6; --accent2: #60A5FA;
    --green: #22C55E; --red: #EF4444; --yellow: #EAB308;
    --orange: #F97316; --purple: #A855F7; --teal: #14B8A6; --pink: #EC4899;
    --text: #F1F5F9; --text2: rgba(241,245,249,0.55); --text3: rgba(241,245,249,0.28);
    --surface: #0B0D13; --surface2: #111622; --surface3: #1A2033; --surface4: #232D42;
    --border: rgba(255,255,255,0.07); --border2: rgba(255,255,255,0.13);
    --font-mono: 'DM Mono', monospace;
    --font-display: 'Syne', sans-serif;
    --font-body: 'DM Sans', sans-serif;
  }
  html, body, #root { width: 100%; height: 100%; overflow: hidden; background: var(--surface); color: var(--text); font-family: var(--font-body); }
  ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }

  @keyframes blink { 0%,100% { opacity:1 } 50% { opacity:.2 } }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
  @keyframes slideIn { from { opacity:0; transform:translateX(16px) } to { opacity:1; transform:translateX(0) } }
  @keyframes popIn { from { opacity:0; transform:scale(.92) } to { opacity:1; transform:scale(1) } }
  @keyframes toastIn { from { opacity:0; transform:translateX(60px) } to { opacity:1; transform:translateX(0) } }
  @keyframes toastOut { from { opacity:1; } to { opacity:0; transform:translateX(60px) } }
  @keyframes pulse { 0%,100% { box-shadow:0 0 0 0 rgba(59,130,246,.4) } 50% { box-shadow:0 0 0 6px rgba(59,130,246,0) } }

  .ns-app { display:flex; flex-direction:column; height:100vh; overflow:hidden; }

  /* ── TOP BAR ── */
  .ns-bar { display:flex; align-items:center; padding:0 14px; height:54px; gap:10px; background:rgba(11,13,19,0.9); backdrop-filter:blur(32px); border-bottom:.5px solid var(--border); flex-shrink:0; z-index:50; position:relative; }
  .ns-logo { font-family:var(--font-display); font-size:18px; font-weight:800; letter-spacing:-.5px; flex-shrink:0; }
  .ns-logo em { color:var(--accent); font-style:normal; }
  .ns-ev { font-size:11px; color:var(--text3); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:var(--font-mono); }
  .ns-bar-r { display:flex; align-items:center; gap:8px; flex-shrink:0; }
  .ns-chip { display:flex; align-items:center; gap:5px; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:600; background:var(--surface3); color:var(--text2); border:.5px solid var(--border); font-family:var(--font-mono); }
  .ns-dot { width:5px; height:5px; border-radius:50%; background:var(--text3); }
  .ns-dot.live { background:var(--green); box-shadow:0 0 6px var(--green); animation:pulse 2s infinite; }
  .ns-dot.syncing { background:var(--yellow); animation:blink 1s infinite; }
  .ns-dot.offline { background:var(--red); }
  .ns-btn { display:flex; align-items:center; justify-content:center; gap:5px; padding:7px 14px; border-radius:10px; border:none; font-size:13px; font-weight:600; font-family:var(--font-body); cursor:pointer; white-space:nowrap; transition:filter .15s,transform .1s; }
  .ns-btn:active { filter:brightness(.8); transform:scale(.96); }
  .ns-btn.blue { background:var(--accent); color:#fff; }
  .ns-btn.glass { background:var(--surface3); color:var(--text); border:.5px solid var(--border2); }
  .ns-btn.green { background:#16A34A; color:#fff; }
  .ns-btn.red { background:#DC2626; color:#fff; }
  .ns-btn.sm { padding:5px 10px; font-size:12px; border-radius:8px; }
  .ns-btn.icon { width:34px; height:34px; padding:0; border-radius:10px; font-size:17px; }

  /* ── TAB NAV ── */
  .ns-tabs { display:flex; gap:2px; padding:8px 14px 0; background:var(--surface2); border-bottom:.5px solid var(--border); flex-shrink:0; overflow-x:auto; }
  .ns-tab { display:flex; align-items:center; gap:6px; padding:8px 14px 9px; border-radius:8px 8px 0 0; font-size:12px; font-weight:600; cursor:pointer; border:none; background:transparent; color:var(--text2); white-space:nowrap; transition:all .15s; border-bottom:2px solid transparent; margin-bottom:-1px; }
  .ns-tab:hover { color:var(--text); background:var(--surface3); }
  .ns-tab.active { color:var(--accent); background:var(--surface3); border-bottom:2px solid var(--accent); }
  .ns-tab .tab-icon { font-size:14px; }

  /* ── MAIN CONTENT ── */
  .ns-main { flex:1; overflow:hidden; display:flex; flex-direction:column; }

  /* ── OVERVIEW TAB ── */
  .overview-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; padding:14px; }
  .stat-card { background:var(--surface2); border:.5px solid var(--border2); border-radius:14px; padding:16px 18px; animation:popIn .3s ease both; }
  .stat-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--text3); font-family:var(--font-mono); margin-bottom:6px; }
  .stat-val { font-size:28px; font-weight:800; font-family:var(--font-display); letter-spacing:-.5px; }
  .stat-val.green { color:var(--green); } .stat-val.blue { color:var(--accent); } .stat-val.yellow { color:var(--yellow); }
  .stat-sub { font-size:11px; color:var(--text3); margin-top:4px; font-family:var(--font-mono); }

  /* ── PICKLIST / LEADERBOARD ── */
  .lb-wrap { flex:1; overflow-y:auto; padding:0 14px 14px; }
  .lb-controls { display:flex; flex-wrap:wrap; gap:5px; padding:10px 0; }
  .lb-sort-btn { padding:4px 10px; border-radius:7px; border:.5px solid var(--border); background:var(--surface3); color:var(--text2); font-size:11px; font-weight:600; cursor:pointer; font-family:var(--font-mono); transition:all .15s; }
  .lb-sort-btn.active { background:rgba(59,130,246,.15); color:var(--accent); border-color:rgba(59,130,246,.3); }
  .tc { padding:12px 14px; border-bottom:.5px solid var(--border); display:flex; flex-direction:column; gap:8px; cursor:pointer; transition:background .12s; animation:fadeIn .2s ease both; }
  .tc:hover { background:var(--surface3); }
  .tc-top { display:flex; align-items:center; gap:10px; }
  .tc-rank { font-size:11px; font-weight:700; color:var(--text3); min-width:24px; font-family:var(--font-mono); }
  .tc-num { font-size:17px; font-weight:800; color:var(--accent); font-family:var(--font-display); min-width:52px; }
  .tc-name { font-size:12px; font-weight:600; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .tc-record { font-size:11px; font-family:var(--font-mono); color:var(--text2); }
  .tc-epa { font-size:13px; font-weight:700; font-family:var(--font-mono); }
  .tc-bars { display:flex; flex-direction:column; gap:3px; }
  .tc-bar-row { display:flex; align-items:center; gap:6px; }
  .tc-bar-label { font-size:9px; font-weight:700; color:var(--text3); min-width:52px; font-family:var(--font-mono); text-transform:uppercase; }
  .tc-bar-track { flex:1; height:4px; border-radius:2px; background:rgba(255,255,255,0.06); overflow:hidden; }
  .tc-bar-fill { height:100%; border-radius:2px; }
  .tc-bar-fill.auto { background:var(--accent); } .tc-bar-fill.teleop { background:var(--green); } .tc-bar-fill.endgame { background:var(--purple); } .tc-bar-fill.cycles { background:var(--teal); } .tc-bar-fill.pts { background:var(--orange); }
  .tc-bar-val { font-size:10px; font-weight:700; font-family:var(--font-mono); color:var(--text2); min-width:32px; text-align:right; }

  /* ── TEAM DETAIL ── */
  .td-header { padding:14px 16px; background:var(--surface3); border-bottom:.5px solid var(--border); }
  .td-num { font-size:28px; font-weight:800; font-family:var(--font-display); color:var(--accent); }
  .td-name { font-size:14px; font-weight:700; }
  .epa-grid { display:grid; grid-template-columns:repeat(4,1fr); border-top:.5px solid var(--border); }
  .epa-cell { padding:9px 12px; border-right:.5px solid var(--border); }
  .epa-cell:last-child { border-right:none; }
  .epa-label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--text3); font-family:var(--font-mono); }
  .epa-val { font-size:16px; font-weight:800; font-family:var(--font-mono); }
  .epa-val.total { color:var(--text); } .epa-val.auto { color:var(--accent); } .epa-val.teleop { color:var(--green); } .epa-val.endgame { color:var(--purple); }
  .kv-section { padding:0 16px; }
  .kv-section-title { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.12em; color:var(--text3); padding:10px 0 6px; border-bottom:.5px solid var(--border); font-family:var(--font-mono); }
  .kv { display:flex; justify-content:space-between; align-items:center; padding:7px 0; border-bottom:.5px solid var(--border); gap:10px; }
  .kv:last-child { border-bottom:none; }
  .kk { font-size:11px; color:var(--text2); }
  .kv-v { font-size:13px; font-weight:700; text-align:right; font-family:var(--font-mono); }
  .kv-v.g { color:var(--green); } .kv-v.r { color:var(--red); } .kv-v.a { color:var(--accent); }
  .bd-row { display:flex; align-items:center; gap:8px; margin-bottom:5px; }
  .bd-label { font-size:10px; font-weight:600; color:var(--text2); min-width:120px; }
  .bd-track { flex:1; height:5px; border-radius:3px; background:rgba(255,255,255,.06); overflow:hidden; }
  .bd-fill { height:100%; border-radius:3px; background:linear-gradient(90deg,var(--accent),var(--accent2)); }
  .bd-val { font-size:10px; font-weight:700; font-family:var(--font-mono); color:var(--text2); min-width:38px; text-align:right; }

  /* ── PIPELINE TAB ── */
  .pipeline-layout { display:grid; grid-template-columns:250px 1fr 300px; gap:10px; padding:10px; height:100%; overflow:hidden; }
  .pipe-panel { background:var(--surface2); border:.5px solid var(--border2); border-radius:12px; overflow:hidden; display:flex; flex-direction:column; }
  .pipe-panel-head { font-size:12px; font-weight:700; padding:10px 14px; background:var(--surface3); border-bottom:.5px solid var(--border); flex-shrink:0; letter-spacing:-.2px; }
  .pipe-panel-body { flex:1; overflow-y:auto; padding:8px; }
  .var-chip { border:.5px solid var(--border); border-radius:8px; padding:8px; margin-bottom:6px; background:var(--surface3); cursor:grab; transition:border-color .15s; }
  .var-chip:active { cursor:grabbing; }
  .var-chip:hover { border-color:var(--border2); }
  .var-chip-name { font-size:12px; font-weight:600; }
  .var-chip-key { font-size:10px; color:var(--text3); font-family:var(--font-mono); margin-top:2px; }
  .var-chip-desc { font-size:10px; color:var(--text2); margin-top:4px; line-height:1.4; }
  .var-chip-badge { font-size:9px; color:var(--green); margin-top:4px; font-family:var(--font-mono); }
  .pipe-canvas { position:relative; flex:1; background:repeating-linear-gradient(0deg,rgba(255,255,255,.02) 0px,rgba(255,255,255,.02) 1px,transparent 1px,transparent 32px),repeating-linear-gradient(90deg,rgba(255,255,255,.02) 0px,rgba(255,255,255,.02) 1px,transparent 1px,transparent 32px); }
  .pipe-node { position:absolute; width:140px; padding:8px 10px; background:var(--surface3); border:.5px solid var(--border2); border-radius:8px; cursor:pointer; text-align:left; color:var(--text); transition:border-color .15s,box-shadow .15s; }
  .pipe-node:hover { border-color:var(--accent); }
  .pipe-node.selected { border-color:var(--accent); box-shadow:0 0 0 2px rgba(59,130,246,.3); }
  .pipe-node-title { font-size:12px; font-weight:700; }
  .pipe-node-key { font-size:9px; opacity:.6; font-family:var(--font-mono); margin-top:2px; }
  .pipe-hint { position:absolute; bottom:10px; left:50%; transform:translateX(-50%); font-size:10px; color:var(--text3); text-align:center; pointer-events:none; font-family:var(--font-mono); white-space:nowrap; }
  .pipe-result { font-size:12px; color:var(--text2); margin-bottom:10px; line-height:1.7; }
  .pipe-result strong { color:var(--text); }
  .pipe-section-head { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--text3); font-family:var(--font-mono); margin:10px 0 6px; }
  .pipe-inp { width:100%; padding:8px 10px; border-radius:8px; background:var(--surface); border:.5px solid var(--border2); color:var(--text); font-size:12px; font-family:var(--font-body); margin-bottom:8px; outline:none; }
  .pipe-inp:focus { border-color:var(--accent); }
  .pipe-sel { width:100%; padding:8px 10px; border-radius:8px; background:var(--surface); border:.5px solid var(--border2); color:var(--text); font-size:12px; font-family:var(--font-body); margin-bottom:8px; outline:none; }
  .pipe-ta { width:100%; padding:8px 10px; border-radius:8px; background:var(--surface); border:.5px solid var(--border2); color:var(--text); font-size:12px; font-family:var(--font-body); resize:vertical; outline:none; margin-bottom:8px; }
  .pipe-ta:focus { border-color:var(--accent); }

  /* ── STRATEGY BOARD ── */
  .strat-wrap { display:flex; height:100%; overflow:hidden; }
  .strat-main { flex:1; position:relative; display:flex; flex-direction:column; }
  .strat-toolbar { display:flex; align-items:center; gap:4px; padding:8px 12px; background:var(--surface2); border-bottom:.5px solid var(--border); flex-wrap:wrap; }
  .strat-tool-btn { width:34px; height:34px; border-radius:8px; background:var(--surface3); border:.5px solid var(--border); color:var(--text); font-size:15px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .15s; }
  .strat-tool-btn:hover { background:var(--surface4); }
  .strat-tool-btn.active { background:rgba(59,130,246,.2); border-color:rgba(59,130,246,.4); color:var(--accent); }
  .strat-tool-btn.exit { background:rgba(239,68,68,.15); border-color:rgba(239,68,68,.3); color:var(--red); }
  .strat-sep { width:.5px; height:24px; background:var(--border); margin:0 2px; }
  .strat-swatch { width:20px; height:20px; border-radius:50%; cursor:pointer; border:2px solid transparent; transition:border-color .15s; }
  .strat-swatch.active { border-color:#fff; }
  .strat-size-btn { width:28px; height:28px; border-radius:6px; background:var(--surface3); border:.5px solid var(--border); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .15s; }
  .strat-size-btn.active { background:rgba(59,130,246,.2); border-color:rgba(59,130,246,.4); }
  .strat-canvas-wrap { flex:1; position:relative; overflow:hidden; background:#0a1018; }
  .strat-canvas-wrap canvas { position:absolute; top:0; left:0; width:100%; height:100%; }
  .strat-base { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); max-width:100%; max-height:100%; object-fit:contain; pointer-events:none; user-select:none; opacity:.9; }
  .strat-robot-layer { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; }
  .strat-side { width:220px; background:var(--surface2); border-left:.5px solid var(--border); display:flex; flex-direction:column; overflow:hidden; }
  .strat-side-head { padding:12px 14px; font-size:12px; font-weight:700; background:var(--surface3); border-bottom:.5px solid var(--border); flex-shrink:0; }
  .strat-side-body { flex:1; overflow-y:auto; padding:10px; }
  .strat-gallery-item { border:.5px solid var(--border); border-radius:8px; margin-bottom:8px; overflow:hidden; cursor:pointer; transition:border-color .15s; }
  .strat-gallery-item:hover { border-color:var(--border2); }
  .strat-gallery-thumb { height:70px; background:var(--surface3); overflow:hidden; }
  .strat-gallery-thumb img { width:100%; height:100%; object-fit:cover; }
  .strat-gallery-info { padding:6px 8px; }
  .strat-gallery-name { font-size:11px; font-weight:600; }
  .strat-gallery-meta { font-size:9px; color:var(--text3); font-family:var(--font-mono); margin-top:2px; }
  .strat-gallery-actions { display:flex; gap:4px; padding:4px 8px 8px; }

  /* ── ROBOT PROMPT ── */
  .robot-prompt-overlay { position:fixed; inset:0; background:rgba(0,0,0,.6); backdrop-filter:blur(6px); z-index:100; display:flex; align-items:center; justify-content:center; animation:fadeIn .15s; }
  .robot-prompt-box { background:var(--surface2); border:.5px solid var(--border2); border-radius:16px; padding:20px; width:260px; }
  .robot-prompt-title { font-size:14px; font-weight:700; font-family:var(--font-display); margin-bottom:12px; }
  .robot-prompt-colors { display:flex; gap:8px; margin-bottom:12px; }
  .rp-color { width:26px; height:26px; border-radius:50%; cursor:pointer; border:2px solid transparent; transition:border-color .15s; }
  .rp-color.active { border-color:#fff; }
  .robot-prompt-actions { display:flex; gap:8px; }

  /* ── CHAT ── */
  .chat-btn { position:fixed; bottom:20px; right:20px; width:48px; height:48px; border-radius:50%; background:var(--accent); border:none; color:#fff; font-size:20px; cursor:pointer; box-shadow:0 4px 20px rgba(59,130,246,.5); z-index:80; display:flex; align-items:center; justify-content:center; transition:transform .2s,box-shadow .2s; }
  .chat-btn:hover { transform:scale(1.08); box-shadow:0 6px 28px rgba(59,130,246,.6); }
  .chat-panel { position:fixed; bottom:80px; right:20px; width:340px; max-height:480px; background:rgba(17,22,34,0.97); border:.5px solid var(--border2); border-radius:16px; box-shadow:0 24px 60px rgba(0,0,0,.7); z-index:80; display:flex; flex-direction:column; overflow:hidden; animation:slideIn .2s ease; }
  .chat-head { display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:var(--surface3); border-bottom:.5px solid var(--border); flex-shrink:0; }
  .chat-head-title { font-size:13px; font-weight:700; font-family:var(--font-display); }
  .chat-msgs { flex:1; overflow-y:auto; padding:10px; display:flex; flex-direction:column; gap:8px; }
  .chat-msg { padding:8px 10px; border-radius:10px; font-size:12px; line-height:1.55; max-width:90%; animation:fadeIn .2s ease; }
  .chat-msg.user { background:rgba(59,130,246,.18); color:var(--text); align-self:flex-end; }
  .chat-msg.assistant { background:var(--surface3); color:var(--text2); align-self:flex-start; }
  .chat-msg.loading { color:var(--text3); }
  .chat-foot { display:flex; gap:6px; padding:10px; border-top:.5px solid var(--border); flex-shrink:0; }
  .chat-input { flex:1; padding:8px 10px; border-radius:8px; background:var(--surface); border:.5px solid var(--border2); color:var(--text); font-size:12px; font-family:var(--font-body); outline:none; }
  .chat-input:focus { border-color:var(--accent); }

  /* ── TOAST ── */
  .toast { position:fixed; top:68px; right:16px; background:var(--surface3); border:.5px solid var(--border2); border-radius:10px; padding:10px 14px; font-size:12px; font-weight:600; z-index:999; box-shadow:0 8px 32px rgba(0,0,0,.5); animation:toastIn .25s ease; pointer-events:none; }
  .toast.out { animation:toastOut .25s ease forwards; }

  /* ── SEARCH PANEL ── */
  .search-panel { position:fixed; bottom:0; left:0; right:0; max-height:70vh; background:rgba(17,22,34,0.99); border-top:.5px solid var(--border2); border-radius:16px 16px 0 0; z-index:90; display:flex; flex-direction:column; animation:popIn .25s ease; backdrop-filter:blur(20px); }
  .search-head { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:.5px solid var(--border); flex-shrink:0; }
  .search-body { flex:1; overflow-y:auto; }

  /* ── COMPARE ── */
  .cmp-header { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:.5px solid var(--border); }
  .cmp-teams-row { display:flex; overflow-x:auto; border-bottom:.5px solid var(--border); }
  .cmp-team-col { min-width:100px; padding:10px 12px; border-right:.5px solid var(--border); flex-shrink:0; }
  .cmp-team-col:last-child { border-right:none; }
  .cmp-team-num { font-size:18px; font-weight:800; color:var(--accent); font-family:var(--font-display); }
  .cmp-team-name { font-size:11px; color:var(--text2); margin-top:2px; }
  .cmp-metric-section { border-bottom:.5px solid var(--border); }
  .cmp-section-title { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.12em; color:var(--text3); font-family:var(--font-mono); padding:8px 14px 4px; }
  .cmp-row { display:flex; border-bottom:.5px solid var(--border); }
  .cmp-row:last-child { border-bottom:none; }
  .cmp-label { font-size:11px; color:var(--text2); padding:8px 14px; min-width:120px; flex-shrink:0; }
  .cmp-cell { flex:1; padding:8px 10px; font-size:13px; font-weight:700; font-family:var(--font-mono); text-align:center; border-left:.5px solid var(--border); }
  .cmp-cell.best { color:var(--green); } .cmp-cell.worst { color:var(--red); } .cmp-cell.mid { color:var(--text2); }

  /* ── MISC ── */
  .empty { padding:20px; text-align:center; color:var(--text3); font-size:12px; }
  .section-title { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.12em; color:var(--text3); font-family:var(--font-mono); }
  .badge { font-size:10px; font-weight:700; padding:2px 8px; border-radius:6px; font-family:var(--font-mono); }
  .badge.blue { background:rgba(59,130,246,.15); color:var(--accent); }
  .badge.green { background:rgba(34,197,94,.15); color:var(--green); }
  .badge.yellow { background:rgba(234,179,8,.15); color:var(--yellow); }
`
document.head.appendChild(style)

// ── CONSTANTS ─────────────────────────────────────────────────────
const API = ""
const KCACHE = "frc3_cache"
const KLAYOUT = "frc3_layout"
const KCUSTOM = "frc3_custom"
const KSETTINGS = "frc3_settings"
const KGALLERY = "canvasGallery"
const KFEEDBACK = "ns_ml_feedback"
const KML = "northstar_data"
const KPIPELOCAL = "ns_pipeline_analysis"

// ── HELPERS ────────────────────────────────────────────────────────
function ls(key, val) {
  try {
    if (val === undefined) {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : null
    }
    localStorage.setItem(key, JSON.stringify(val))
  } catch { return null }
}

function esc(s) { return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;") }
function fmtNum(v) { if (typeof v !== "number") return String(v ?? ""); if (Number.isInteger(v)) return String(v); return v.toFixed(2) }
function asNum(v) { const n = Number(v); return Number.isFinite(n) ? n : null }
function niceLabel(k) { return k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim().toLowerCase() }
function deepGet(obj, path) {
  return path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj)
}

function getMlEnabled() {
  try { return !!ls(KML)?.settings?.mlBetaEnabled } catch { return false }
}

async function savePipelineArtifact(payload) {
  const prev = ls(KPIPELOCAL) || { runs: [], feedback: [] }
  const next = {
    runs: payload.run ? [...(prev.runs || []), payload.run].slice(-200) : (prev.runs || []),
    feedback: payload.feedback ? [...(prev.feedback || []), payload.feedback].slice(-500) : (prev.feedback || []),
  }
  ls(KPIPELOCAL, next)
  try {
    await fetch(`${API}/api/pipeline-analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  } catch {}
}

// ── POLLING HOOK ───────────────────────────────────────────────────
function usePoll(url, ms = 5000) {
  const [data, setData] = useState(null)
  useEffect(() => {
    if (!url) return
    let alive = true
    const run = async () => {
      try {
        const r = await fetch(url)
        if (r.ok && alive) setData(await r.json())
      } catch {}
    }
    run()
    const id = setInterval(run, ms)
    return () => { alive = false; clearInterval(id) }
  }, [url, ms])
  return data
}

// ── TOAST ──────────────────────────────────────────────────────────
function ToastHost({ toasts }) {
  return (
    <div style={{ position: "fixed", top: 68, right: 16, zIndex: 999, display: "flex", flexDirection: "column", gap: 6 }}>
      {toasts.map(t => (
        <div key={t.id} className={`toast${t.out ? " out" : ""}`}>{t.msg}</div>
      ))}
    </div>
  )
}

function useToast() {
  const [toasts, setToasts] = useState([])
  const toast = useCallback((msg) => {
    const id = Date.now()
    setToasts(p => [...p, { id, msg }])
    setTimeout(() => setToasts(p => p.map(t => t.id === id ? { ...t, out: true } : t)), 2500)
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 2800)
  }, [])
  return { toasts, toast }
}

// ── SORT UTILS ─────────────────────────────────────────────────────
const SORT_OPTIONS = [
  ["epa.total", "EPA"], ["rank", "Rank"], ["wins", "Wins"],
  ["epa.auto", "Auto"], ["epa.teleop", "Teleop"], ["epa.endgame", "End"],
  ["scoutingSummary.avgCycles", "Cycles"], ["scoutingSummary.avgPoints", "Avg Pts"],
]

function sortTeams(teams, field) {
  return [...teams].sort((a, b) => {
    const av = deepGet(a, field) ?? (field === "rank" ? 9999 : -9999)
    const bv = deepGet(b, field) ?? (field === "rank" ? 9999 : -9999)
    return field === "rank" ? av - bv : bv - av
  })
}

// ── LEADERBOARD ────────────────────────────────────────────────────
function Leaderboard({ teams, onSelect }) {
  const [sortField, setSortField] = useState("epa.total")
  const sorted = useMemo(() => sortTeams(teams, sortField), [teams, sortField])
  const maxAuto = Math.max(...teams.map(t => t.epa?.auto ?? 0), 1)
  const maxTeleop = Math.max(...teams.map(t => t.epa?.teleop ?? 0), 1)
  const maxEnd = Math.max(...teams.map(t => t.epa?.endgame ?? 0), 1)
  const maxCycles = Math.max(...teams.map(t => t.scoutingSummary?.avgCycles ?? 0), 1)
  const maxPts = Math.max(...teams.map(t => t.scoutingSummary?.avgPoints ?? 0), 1)
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div className="lb-controls">
        {SORT_OPTIONS.map(([f, l]) => (
          <button key={f} className={`lb-sort-btn${sortField === f ? " active" : ""}`} onClick={() => setSortField(f)}>{l}</button>
        ))}
      </div>
      <div className="lb-wrap">
        {!sorted.length && <div className="empty">No team data loaded. Connect online or load offline data.</div>}
        {sorted.map((t, i) => {
          const epa = t.epa || {}
          const sc = t.scoutingSummary || {}
          return (
            <div key={t.number} className="tc" onClick={() => onSelect(t)}>
              <div className="tc-top">
                <div className="tc-rank">#{t.rank ?? i + 1}</div>
                <div className="tc-num">{t.number}</div>
                <div className="tc-name">{t.name || ""}</div>
                <div className="tc-record">{t.record || `${t.wins ?? 0}-${t.losses ?? 0}`}</div>
                {epa.total != null && <div className="tc-epa">{fmtNum(epa.total)}</div>}
              </div>
              <div className="tc-bars">
                {epa.auto != null && <div className="tc-bar-row"><div className="tc-bar-label">Auto EPA</div><div className="tc-bar-track"><div className="tc-bar-fill auto" style={{ width: `${(epa.auto / maxAuto) * 100}%` }} /></div><div className="tc-bar-val">{fmtNum(epa.auto)}</div></div>}
                {epa.teleop != null && <div className="tc-bar-row"><div className="tc-bar-label">Tel EPA</div><div className="tc-bar-track"><div className="tc-bar-fill teleop" style={{ width: `${(epa.teleop / maxTeleop) * 100}%` }} /></div><div className="tc-bar-val">{fmtNum(epa.teleop)}</div></div>}
                {epa.endgame != null && <div className="tc-bar-row"><div className="tc-bar-label">End EPA</div><div className="tc-bar-track"><div className="tc-bar-fill endgame" style={{ width: `${(epa.endgame / maxEnd) * 100}%` }} /></div><div className="tc-bar-val">{fmtNum(epa.endgame)}</div></div>}
                {sc.avgCycles > 0 && <div className="tc-bar-row"><div className="tc-bar-label">Cycles</div><div className="tc-bar-track"><div className="tc-bar-fill cycles" style={{ width: `${(sc.avgCycles / maxCycles) * 100}%` }} /></div><div className="tc-bar-val">{fmtNum(sc.avgCycles)}</div></div>}
                {sc.avgPoints > 0 && <div className="tc-bar-row"><div className="tc-bar-label">Avg Pts</div><div className="tc-bar-track"><div className="tc-bar-fill pts" style={{ width: `${(sc.avgPoints / maxPts) * 100}%` }} /></div><div className="tc-bar-val">{fmtNum(sc.avgPoints)}</div></div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── TEAM DETAIL ────────────────────────────────────────────────────
function TeamDetail({ team, onClose }) {
  if (!team) return <div className="empty">Select a team from the Picklist.</div>
  const epa = team.epa || {}
  const sc = team.scoutingSummary || {}
  const bd = epa.breakdown || {}
  const rankCls = team.rank <= 3 ? "yellow" : team.rank <= 10 ? "blue" : ""
  return (
    <div style={{ animation: "fadeIn .25s ease" }}>
      <div className="td-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div className="td-num">{team.number}</div>
            <div className="td-name">{team.name || ""}</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {team.rank != null && <span className={`badge ${rankCls || "blue"}`}>Rank #{team.rank}</span>}
            {onClose && <button className="ns-btn glass sm" onClick={onClose}>←</button>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          {team.wins != null && <span style={{ fontSize: 12, color: "var(--green)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{team.wins}W</span>}
          {team.losses != null && <span style={{ fontSize: 12, color: "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{team.losses}L</span>}
          {team.ties != null && <span style={{ fontSize: 12, color: "var(--yellow)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{team.ties}T</span>}
        </div>
      </div>
      {(epa.total != null || epa.auto != null) && (
        <div className="epa-grid">
          {epa.total != null && <div className="epa-cell"><div className="epa-label">EPA Total</div><div className="epa-val total">{fmtNum(epa.total)}</div></div>}
          {epa.auto != null && <div className="epa-cell"><div className="epa-label">Auto</div><div className="epa-val auto">{fmtNum(epa.auto)}</div></div>}
          {epa.teleop != null && <div className="epa-cell"><div className="epa-label">Teleop</div><div className="epa-val teleop">{fmtNum(epa.teleop)}</div></div>}
          {epa.endgame != null && <div className="epa-cell"><div className="epa-label">Endgame</div><div className="epa-val endgame">{fmtNum(epa.endgame)}</div></div>}
        </div>
      )}
      {(sc.avgCycles > 0 || sc.avgPoints != null) && (
        <div className="kv-section">
          <div className="kv-section-title">Scouting Summary</div>
          {sc.avgCycles > 0 && <div className="kv"><span className="kk">Avg Cycles</span><span className="kv-v a">{fmtNum(sc.avgCycles)}</span></div>}
          {sc.avgPoints != null && <div className="kv"><span className="kk">Avg Points</span><span className="kv-v a">{fmtNum(sc.avgPoints)}</span></div>}
          {sc.avgAutoScore != null && <div className="kv"><span className="kk">Avg Auto Score</span><span className="kv-v a">{fmtNum(sc.avgAutoScore)}</span></div>}
          {sc.avgTeleopScore != null && <div className="kv"><span className="kk">Avg Teleop Score</span><span className="kv-v a">{fmtNum(sc.avgTeleopScore)}</span></div>}
          {sc.matchesScouted != null && <div className="kv"><span className="kk">Matches Scouted</span><span className="kv-v">{sc.matchesScouted}</span></div>}
        </div>
      )}
      {Object.keys(bd).length > 0 && (
        <div style={{ padding: "10px 16px 14px" }}>
          <div className="section-title" style={{ marginBottom: 8 }}>EPA Breakdown</div>
          {Object.entries(bd).filter(([, v]) => typeof v === "number").map(([k, v]) => {
            const max = Math.max(...Object.values(bd).filter(x => typeof x === "number").map(Math.abs), 1)
            return (
              <div key={k} className="bd-row">
                <div className="bd-label">{niceLabel(k)}</div>
                <div className="bd-track"><div className="bd-fill" style={{ width: `${(Math.abs(v) / max) * 100}%` }} /></div>
                <div className="bd-val">{fmtNum(v)}</div>
              </div>
            )
          })}
        </div>
      )}
      {Array.isArray(team.matches) && team.matches.length > 0 && (
        <div className="kv-section">
          <div className="kv-section-title">Match History ({team.matches.length})</div>
          {team.matches.slice(0, 8).map((m, i) => (
            <div key={i} className="kv">
              <span className="kk" style={{ fontFamily: "var(--font-mono)" }}>{m.match || `Q${i + 1}`}</span>
              <div style={{ display: "flex", gap: 8, fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                {m.points != null && <span style={{ color: "var(--green)" }}>{m.points}pts</span>}
                {m.cycles != null && <span style={{ color: "var(--teal)" }}>{m.cycles}cyc</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── COMPARE ────────────────────────────────────────────────────────
function Compare({ allTeams }) {
  const [nums, setNums] = useState([])
  const [input, setInput] = useState("")
  const teams = nums.map(n => allTeams.find(t => String(t.number) === n)).filter(Boolean)
  const addTeam = () => {
    const n = input.trim()
    if (n && !nums.includes(n)) setNums(p => [...p, n])
    setInput("")
  }
  const GROUPS = [
    { title: "Core", metrics: [["Rank", "rank"], ["Wins", "wins"], ["Losses", "losses"]] },
    { title: "EPA", metrics: [["EPA Total", "epa.total"], ["Auto EPA", "epa.auto"], ["Teleop EPA", "epa.teleop"], ["Endgame EPA", "epa.endgame"]] },
    { title: "Scouting", metrics: [["Avg Pts", "scoutingSummary.avgPoints"], ["Avg Cycles", "scoutingSummary.avgCycles"], ["Matches Scouted", "scoutingSummary.matchesScouted"]] },
  ]
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div className="cmp-header">
        <span style={{ fontSize: 12, fontWeight: 700 }}>Compare · {teams.length} teams</span>
        <div style={{ display: "flex", gap: 6 }}>
          <input className="pipe-inp" style={{ margin: 0, width: 80 }} placeholder="Team #" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addTeam()} />
          <button className="ns-btn blue sm" onClick={addTeam}>+ Add</button>
        </div>
      </div>
      {!teams.length ? (
        <div className="empty">Add team numbers above to compare them.</div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div className="cmp-teams-row">
            <div className="cmp-label" />
            {teams.map(t => (
              <div key={t.number} className="cmp-team-col">
                <div className="cmp-team-num">{t.number}</div>
                <div className="cmp-team-name">{t.name || ""}</div>
                <button className="ns-btn glass sm" style={{ marginTop: 4, fontSize: 10, padding: "2px 6px" }} onClick={() => setNums(p => p.filter(n => n !== String(t.number)))}>✕</button>
              </div>
            ))}
          </div>
          {GROUPS.map(g => {
            const rows = g.metrics.map(([label, path]) => {
              const vals = teams.map(t => deepGet(t, path) ?? null)
              if (vals.every(v => v == null)) return null
              const nums2 = vals.filter(v => typeof v === "number")
              const best = nums2.length ? Math.max(...nums2) : null
              const worst = nums2.length ? Math.min(...nums2) : null
              const isRank = path === "rank"
              return (
                <div key={label} className="cmp-row">
                  <div className="cmp-label">{label}</div>
                  {vals.map((v, i) => {
                    let cls = "mid"
                    if (typeof v === "number") {
                      if (isRank) cls = v === worst ? "best" : v === best ? "worst" : "mid"
                      else cls = v === best && v !== worst ? "best" : v === worst && v !== best ? "worst" : "mid"
                    }
                    return <div key={i} className={`cmp-cell ${cls}`}>{typeof v === "number" ? fmtNum(v) : String(v ?? "—")}</div>
                  })}
                </div>
              )
            }).filter(Boolean)
            if (!rows.length) return null
            return (
              <div key={g.title} className="cmp-metric-section">
                <div className="cmp-section-title">{g.title}</div>
                {rows}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── STRATEGY BOARD ─────────────────────────────────────────────────
function StrategyBoard({ toast }) {
  const canvasRef = useRef(null)
  const [tool, setTool] = useState("pen")
  const [color, setColor] = useState("#ffffff")
  const [size, setSize] = useState(3)
  const [drawing, setDrawing] = useState(false)
  const [strokes, setStrokes] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const [robots, setRobots] = useState([])
  const [showRobotPrompt, setShowRobotPrompt] = useState(false)
  const [robotInput, setRobotInput] = useState("")
  const [robotColor, setRobotColor] = useState("#EF4444")
  const [pendingPos, setPendingPos] = useState({ x: 0, y: 0 })
  const [gallery, setGallery] = useState(() => ls(KGALLERY) || [])
  const lastPos = useRef(null)
  const currentStroke = useRef(null)

  const COLORS = ["#ffffff", "#EF4444", "#22C55E", "#3B82F6", "#EAB308", "#A855F7"]
  const ROBOT_COLORS = ["#EF4444", "#3B82F6", "#22C55E", "#EAB308", "#A855F7"]
  const SIZES = [3, 6, 11]

  const getCtx = () => canvasRef.current?.getContext("2d")

  function drawSegment(stroke, x1, y1, x2, y2) {
    const ctx = getCtx()
    if (!ctx) return
    ctx.save()
    ctx.lineCap = "round"; ctx.lineJoin = "round"
    if (stroke.tool === "highlighter") {
      ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = stroke.color; ctx.lineWidth = stroke.width * 3; ctx.globalAlpha = 0.35
    } else if (stroke.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out"; ctx.strokeStyle = "rgba(0,0,0,1)"; ctx.lineWidth = stroke.width * 3; ctx.globalAlpha = 1
    } else {
      ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = stroke.color || "#fff"; ctx.lineWidth = stroke.width; ctx.globalAlpha = 1
    }
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
    ctx.restore()
  }

  function redrawAll(strokeList) {
    const ctx = getCtx(); const cvs = canvasRef.current
    if (!ctx || !cvs) return
    ctx.clearRect(0, 0, cvs.width, cvs.height)
    for (const s of strokeList) {
      const p = s.points; if (!p || p.length < 2) continue
      for (let i = 1; i < p.length; i++) drawSegment(s, p[i - 1].x, p[i - 1].y, p[i].x, p[i].y)
    }
  }

  function posFromEvent(e) {
    const cvs = canvasRef.current; if (!cvs) return { x: 0, y: 0 }
    const rect = cvs.getBoundingClientRect()
    return { x: (e.clientX - rect.left) * (cvs.width / rect.width), y: (e.clientY - rect.top) * (cvs.height / rect.height) }
  }

  function onPointerDown(e) {
    e.preventDefault()
    const p = posFromEvent(e)
    if (tool === "robot") {
      setPendingPos(p); setRobotInput(""); setShowRobotPrompt(true)
      return
    }
    canvasRef.current?.setPointerCapture(e.pointerId)
    setDrawing(true)
    lastPos.current = p
    currentStroke.current = { tool, color, width: size, points: [p] }
  }

  function onPointerMove(e) {
    if (!drawing || !currentStroke.current) return
    const p = posFromEvent(e)
    drawSegment(currentStroke.current, lastPos.current.x, lastPos.current.y, p.x, p.y)
    lastPos.current = p
    currentStroke.current.points.push(p)
  }

  function onPointerUp() {
    if (drawing && currentStroke.current?.points?.length >= 2) {
      const newStrokes = [...strokes, currentStroke.current]
      setStrokes(newStrokes)
      setRedoStack([])
    }
    setDrawing(false); currentStroke.current = null
  }

  function undo() {
    if (!strokes.length) return
    const newStrokes = [...strokes]; const popped = newStrokes.pop()
    setStrokes(newStrokes); setRedoStack(p => [...p, popped]); redrawAll(newStrokes)
  }

  function redo() {
    if (!redoStack.length) return
    const newRedo = [...redoStack]; const popped = newRedo.pop()
    const newStrokes = [...strokes, popped]
    setStrokes(newStrokes); setRedoStack(newRedo); redrawAll(newStrokes)
  }

  function clear() {
    setStrokes([]); setRedoStack([])
    const ctx = getCtx(); const cvs = canvasRef.current
    if (ctx && cvs) ctx.clearRect(0, 0, cvs.width, cvs.height)
  }

  function saveStrategy() {
    const cvs = canvasRef.current; if (!cvs) return
    // bake robots to canvas
    const ctx = getCtx()
    robots.forEach(rb => {
      ctx.save()
      ctx.beginPath(); ctx.arc(rb.x, rb.y, 18, 0, Math.PI * 2)
      ctx.fillStyle = rb.color; ctx.fill()
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke()
      ctx.fillStyle = "#fff"; ctx.font = "bold 12px DM Mono,monospace"
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText(String(rb.team).slice(0, 4), rb.x, rb.y)
      ctx.restore()
    })
    const dataURL = cvs.toDataURL("image/png")
    const name = prompt("Name your strategy:")
    if (!name) { redrawAll(strokes); return }
    const newGallery = [...gallery, { id: Date.now(), name, image: dataURL, updatedAt: Date.now() }]
    setGallery(newGallery); ls(KGALLERY, newGallery); setRobots([]); redrawAll(strokes)
    toast("Strategy saved ✓")
  }

  function loadStrategy(item) {
    const ctx = getCtx(); const cvs = canvasRef.current; if (!ctx || !cvs) return
    const img = new Image()
    img.onload = () => { ctx.clearRect(0, 0, cvs.width, cvs.height); ctx.drawImage(img, 0, 0, cvs.width, cvs.height); setStrokes([]); setRedoStack([]) }
    img.src = item.image
    toast(`Loaded: ${item.name}`)
  }

  function deleteStrategy(id) {
    const newGallery = gallery.filter(g => g.id !== id)
    setGallery(newGallery); ls(KGALLERY, newGallery); toast("Deleted")
  }

  function confirmRobot() {
    if (!robotInput.trim()) return
    setRobots(p => [...p, { id: Date.now().toString(), team: robotInput, color: robotColor, x: pendingPos.x, y: pendingPos.y }])
    setShowRobotPrompt(false)
  }

  // setup canvas size on mount
  useEffect(() => {
    const cvs = canvasRef.current; if (!cvs) return
    const wrap = cvs.parentElement
    const resize = () => {
      const r = wrap.getBoundingClientRect()
      cvs.width = r.width; cvs.height = r.height
      redrawAll(strokes)
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  useEffect(() => { redrawAll(strokes) }, [strokes])

  return (
    <div className="strat-wrap">
      <div className="strat-main">
        <div className="strat-toolbar">
          {/* tools */}
          {[["pen","✏️","pen"],["highlighter","🖊","highlighter"],["eraser","⌫","eraser"],["robot","🤖","robot"]].map(([t, icon, k]) => (
            <button key={k} className={`strat-tool-btn${tool === t ? " active" : ""}`} onClick={() => setTool(t)} title={t}>{icon}</button>
          ))}
          <div className="strat-sep" />
          {/* colors */}
          {COLORS.map(c => (
            <div key={c} className={`strat-swatch${color === c && tool !== "eraser" ? " active" : ""}`} style={{ background: c }} onClick={() => { setColor(c); if (tool === "eraser") setTool("pen") }} />
          ))}
          <div className="strat-sep" />
          {/* sizes */}
          {SIZES.map(s => (
            <button key={s} className={`strat-size-btn${size === s ? " active" : ""}`} onClick={() => setSize(s)}>
              <div style={{ width: s * 1.5 + 2, height: s * 1.5 + 2, borderRadius: "50%", background: "var(--text2)" }} />
            </button>
          ))}
          <div className="strat-sep" />
          <button className="strat-tool-btn" onClick={undo} title="Undo">↶</button>
          <button className="strat-tool-btn" onClick={redo} title="Redo">↷</button>
          <button className="strat-tool-btn" onClick={clear} style={{ color: "var(--red)" }} title="Clear">🗑</button>
          <div className="strat-sep" />
          <button className="strat-tool-btn" onClick={saveStrategy} title="Save">💾</button>
        </div>

        <div className="strat-canvas-wrap"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{ cursor: tool === "robot" ? "crosshair" : tool === "eraser" ? "cell" : "crosshair", touchAction: "none" }}>
          <img className="strat-base" src="field.png" alt="Field" onError={e => { e.target.style.display = "none" }} />
          <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} />
          {/* Robots layer */}
          <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            {robots.map(rb => (
              <g key={rb.id}>
                <circle cx={rb.x} cy={rb.y} r={18} fill={rb.color} stroke="#fff" strokeWidth={3} />
                <text x={rb.x} y={rb.y} fill="#fff" fontSize={12} fontWeight="bold" textAnchor="middle" dominantBaseline="middle" fontFamily="DM Mono,monospace">{String(rb.team).slice(0, 4)}</text>
              </g>
            ))}
          </svg>
          {robots.map(rb => (
            <div key={rb.id} style={{ position: "absolute", left: rb.x + 20, top: rb.y - 20 }}>
              <button className="ns-btn glass sm" style={{ fontSize: 10, padding: "1px 5px", opacity: 0.7 }} onClick={() => setRobots(p => p.filter(r => r.id !== rb.id))}>✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Gallery sidebar */}
      <div className="strat-side">
        <div className="strat-side-head">Saved Strategies</div>
        <div className="strat-side-body">
          {!gallery.length && <div className="empty" style={{ textAlign: "left" }}>No saved strategies yet. Draw and hit 💾 to save.</div>}
          {gallery.map(g => (
            <div key={g.id} className="strat-gallery-item">
              {g.image && <div className="strat-gallery-thumb"><img src={g.image} alt={g.name} /></div>}
              <div className="strat-gallery-info">
                <div className="strat-gallery-name">{g.name}</div>
                {g.updatedAt && <div className="strat-gallery-meta">{new Date(g.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>}
              </div>
              <div className="strat-gallery-actions">
                <button className="ns-btn glass sm" style={{ flex: 1 }} onClick={() => loadStrategy(g)}>Load</button>
                <button className="ns-btn glass sm" style={{ color: "var(--red)" }} onClick={() => deleteStrategy(g.id)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Robot Prompt */}
      {showRobotPrompt && (
        <div className="robot-prompt-overlay" onClick={() => setShowRobotPrompt(false)}>
          <div className="robot-prompt-box" onClick={e => e.stopPropagation()}>
            <div className="robot-prompt-title">Place Robot</div>
            <input className="pipe-inp" placeholder="Team #" value={robotInput} onChange={e => setRobotInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") confirmRobot(); if (e.key === "Escape") setShowRobotPrompt(false) }} autoFocus type="number" />
            <div className="robot-prompt-colors">
              {ROBOT_COLORS.map(c => (
                <div key={c} className={`rp-color${robotColor === c ? " active" : ""}`} style={{ background: c }} onClick={() => setRobotColor(c)} />
              ))}
            </div>
            <div className="robot-prompt-actions">
              <button className="ns-btn glass" style={{ flex: 1 }} onClick={() => setShowRobotPrompt(false)}>Cancel</button>
              <button className="ns-btn blue" style={{ flex: 1 }} onClick={confirmRobot}>Place</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── PIPELINE TAB ───────────────────────────────────────────────────
function PipelineTab({ schema, data, picklist, scouters, mlEnabled, onRunResult }) {
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [selectedNode, setSelectedNode] = useState(null)
  const [targetVar, setTargetVar] = useState("")
  const [runResult, setRunResult] = useState(null)
  const [feedbackCategory, setFeedbackCategory] = useState("good")
  const [feedbackText, setFeedbackText] = useState("")
  const [pipelineName, setPipelineName] = useState("default_pipeline")

  const variables = useMemo(() => {
    return (schema?.fields || []).map(f => ({
      varName: f.varName, label: f.label || f.varName,
      description: f.description || `Collected from "${f.label || f.varName}"`,
      useForTraining: !!f.useForTraining,
    }))
  }, [schema])

  const numericVars = useMemo(() => {
    if (!data?.length) return []
    return Object.keys(data[0]).filter(k => typeof data[0][k] === "number")
  }, [data])

  function onCanvasDrop(e) {
    e.preventDefault()
    const varName = e.dataTransfer.getData("text/plain")
    const variable = variables.find(v => v.varName === varName); if (!variable) return
    const rect = e.currentTarget.getBoundingClientRect()
    setNodes(prev => [...prev, { id: Date.now().toString() + Math.random(), ...variable, x: e.clientX - rect.left, y: e.clientY - rect.top }])
  }

  function onNodeClick(id) {
    if (!selectedNode) { setSelectedNode(id); return }
    if (selectedNode === id) { setSelectedNode(null); return }
    const exists = edges.some(e => e.from === selectedNode && e.to === id)
    if (!exists) setEdges(prev => [...prev, { from: selectedNode, to: id }])
    setSelectedNode(null)
  }

  function runPipeline() {
    if (!targetVar || !data?.length) return
    const trainingVars = variables.filter(v => v.useForTraining).map(v => v.varName)
    if (!trainingVars.length) return
    const nodeMap = Object.fromEntries(nodes.map(nd => [nd.id, nd]))
    const inDegree = Object.fromEntries(nodes.map(nd => [nd.id, 0]))
    edges.forEach(e => { if (inDegree[e.to] != null) inDegree[e.to]++ })
    const queue = Object.keys(inDegree).filter(id => inDegree[id] === 0)
    const orderedNodeIds = []
    while (queue.length) {
      const id = queue.shift()
      orderedNodeIds.push(id)
      edges.filter(e => e.from === id).forEach(e => {
        inDegree[e.to]--
        if (inDegree[e.to] === 0) queue.push(e.to)
      })
    }
    const orderedVars = orderedNodeIds.map(id => nodeMap[id]?.varName).filter(Boolean)
    const effectiveVars = orderedVars.length ? orderedVars : trainingVars

    // Predefined analysis methods executed in sequence for each run.
    const methods = ["clean_missing", "aggregate_features", "fit_linear_model", "predict_latest"]

    const rows = data.map(row => {
      const feats = effectiveVars.map(k => asNum(row[k])).filter(v => v != null)
      const y = asNum(row[targetVar])
      if (!feats.length || y == null) return null
      const x = feats.reduce((a, b) => a + b, 0) / feats.length
      return { x, y }
    }).filter(Boolean)
    if (!rows.length) return
    const n = rows.length
    const sx = rows.reduce((s, r) => s + r.x, 0), sy = rows.reduce((s, r) => s + r.y, 0)
    const sxy = rows.reduce((s, r) => s + r.x * r.y, 0), sx2 = rows.reduce((s, r) => s + r.x * r.x, 0)
    const denom = (n * sx2) - (sx * sx) || 1
    const m = ((n * sxy) - (sx * sy)) / denom, b = (sy - m * sx) / n
    const latest = data[data.length - 1] || {}
    const latestFeats = effectiveVars.map(k => asNum(latest[k])).filter(v => v != null)
    const latestX = latestFeats.length ? latestFeats.reduce((a, c) => a + c, 0) / latestFeats.length : 0
    const pred = m * latestX + b
    const trace = orderedNodeIds.map(id => nodeMap[id]?.label || nodeMap[id]?.varName || id)
    const result = { targetVar, trainingVars: effectiveVars, slope: m, intercept: b, prediction: pred, trace, rowsUsed: rows.length, methods }
    setRunResult(result)
    onRunResult?.(result)

    const artifact = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: pipelineName,
      createdAt: new Date().toISOString(),
      pipeline: {
        nodes: nodes.map(n => ({ id: n.id, varName: n.varName, label: n.label, x: n.x, y: n.y })),
        edges,
        orderedNodeIds,
        orderedVariables: effectiveVars,
        methods,
      },
      dataset: {
        rows: data.length,
        targetVar,
        trainingVars: effectiveVars,
        sample: data.slice(-50),
      },
      result,
    }
    savePipelineArtifact({ run: artifact })
  }

  function submitFeedback() {
    if (!feedbackText.trim()) return
    const entry = { category: feedbackCategory, text: feedbackText.trim(), time: new Date().toISOString() }
    try {
      const prev = ls(KFEEDBACK) || []
      ls(KFEEDBACK, [...prev, entry])
      setFeedbackText("")
    } catch {}
    savePipelineArtifact({ feedback: { ...entry, pipeline: pipelineName, targetVar: targetVar || null } })
  }

  if (!mlEnabled) {
    return (
      <div style={{ padding: 20, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div style={{ textAlign: "center", maxWidth: 300 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
          <div style={{ fontWeight: 700, marginBottom: 6, fontFamily: "var(--font-display)" }}>ML Beta Disabled</div>
          <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.55 }}>Enable ML Beta in Admin Settings to access Data Pipelines.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="pipeline-layout" style={{ height: "100%", overflow: "hidden" }}>
      {/* Variables */}
      <div className="pipe-panel">
        <div className="pipe-panel-head">📊 Data Variables</div>
        <div className="pipe-panel-body">
          {!variables.length && <div className="empty">No variables from schema yet.</div>}
          {variables.map(v => (
            <div key={v.varName} className="var-chip" draggable onDragStart={e => e.dataTransfer.setData("text/plain", v.varName)}>
              <div className="var-chip-name">{v.label}</div>
              <div className="var-chip-key">{v.varName}</div>
              <div className="var-chip-desc">{v.description}</div>
              {v.useForTraining && <div className="var-chip-badge">● Training enabled</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="pipe-panel" style={{ overflow: "hidden" }}>
        <div className="pipe-panel-head">🔗 Pipeline Map <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>drag variables · click node A then B to connect</span></div>
        <div className="pipe-canvas"
          style={{ position: "relative", flex: 1 }}
          onDragOver={e => e.preventDefault()}
          onDrop={onCanvasDrop}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            {edges.map((e, i) => {
              const a = nodes.find(n => n.id === e.from); const b = nodes.find(n => n.id === e.to)
              if (!a || !b) return null
              return <line key={i} x1={a.x + 70} y1={a.y + 20} x2={b.x + 70} y2={b.y + 20} stroke="var(--accent2)" strokeWidth="2" markerEnd="url(#arr)" />
            })}
            <defs>
              <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="var(--accent2)" />
              </marker>
            </defs>
          </svg>
          {nodes.map(n => (
            <button key={n.id} className={`pipe-node${selectedNode === n.id ? " selected" : ""}`} style={{ left: n.x, top: n.y }} onClick={() => onNodeClick(n.id)}>
              <div className="pipe-node-title">{n.label}</div>
              <div className="pipe-node-key">{n.varName}</div>
              {n.useForTraining && <div style={{ fontSize: 9, color: "var(--green)", marginTop: 4, fontFamily: "var(--font-mono)" }}>● training</div>}
            </button>
          ))}
          {!nodes.length && <div className="pipe-hint">Drag variables from the left panel to build your pipeline</div>}
        </div>
      </div>

      {/* Run + Feedback */}
      <div className="pipe-panel">
        <div className="pipe-panel-head">⚡ Run + Feedback</div>
        <div className="pipe-panel-body">
          <div className="pipe-section-head">Prediction Target</div>
          <input className="pipe-inp" placeholder="Pipeline name" value={pipelineName} onChange={e => setPipelineName(e.target.value)} />
          <select className="pipe-sel" value={targetVar} onChange={e => setTargetVar(e.target.value)}>
            <option value="">Select target variable…</option>
            {numericVars.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <button className="ns-btn blue" style={{ width: "100%", marginBottom: 10 }} onClick={runPipeline}>▶ Run Pipeline</button>
          {runResult && (
            <div className="pipe-result">
              <div>Prediction: <strong>{runResult.prediction.toFixed(2)}</strong> ({runResult.targetVar})</div>
              <div>Rows used: <strong>{runResult.rowsUsed}</strong></div>
              <div style={{ color: "var(--text3)", fontSize: 11 }}>Slope: {runResult.slope.toFixed(4)} · Intercept: {runResult.intercept.toFixed(4)}</div>
              {runResult.trace.length > 0 && <div style={{ marginTop: 4, fontSize: 11, color: "var(--accent)" }}>Trace: {runResult.trace.join(" → ")}</div>}
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--text3)" }}>Methods: {runResult.methods.join(" → ")}</div>
            </div>
          )}

          <div style={{ borderTop: ".5px solid var(--border)", paddingTop: 10, marginTop: 4 }}>
            <div className="pipe-section-head">Data Context</div>
            <div className="pipe-result">
              <div>Submissions: <strong>{data?.length || 0}</strong></div>
              <div>Active scouters: <strong>{scouters?.length || 0}</strong></div>
              <div>Variables tracked: <strong>{variables.length}</strong></div>
            </div>
          </div>

          <div style={{ borderTop: ".5px solid var(--border)", paddingTop: 10, marginTop: 4 }}>
            <div className="pipe-section-head">Pipeline Feedback</div>
            <select className="pipe-sel" value={feedbackCategory} onChange={e => setFeedbackCategory(e.target.value)}>
              <option value="good">Good</option>
              <option value="better">Things to improve</option>
              <option value="bug">Bug report</option>
            </select>
            <textarea className="pipe-ta" rows={3} placeholder="What should improve?" value={feedbackText} onChange={e => setFeedbackText(e.target.value)} />
            <button className="ns-btn green" style={{ width: "100%" }} onClick={submitFeedback}>Submit Feedback</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── GLOBAL CHAT ────────────────────────────────────────────────────
function GlobalChat({ data, picklist, scouters, variables, runResult, teams }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([{ role: "assistant", text: "Hi! Ask me about team data, standings, predictions, or anything from this data center." }])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const msgsRef = useRef(null)

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [msgs])

  async function send() {
    const q = input.trim(); if (!q) return
    setMsgs(p => [...p, { role: "user", text: q }])
    setInput(""); setLoading(true)
    const lower = q.toLowerCase()
    const top = picklist?.[0]
    let text
    if ((lower.includes("top") || lower.includes("best")) && top) {
      text = `Top team right now is ${top.team || top.number} based on current picklist values.`
    } else if (lower.includes("predict") && runResult) {
      text = `Latest pipeline predicts ${runResult.targetVar} = ${runResult.prediction.toFixed(2)} using ${runResult.rowsUsed} rows.`
    } else if (lower.includes("scouter") || lower.includes("live")) {
      text = `There are currently ${scouters?.length || 0} active scouters and ${data?.length || 0} total submissions.`
    } else {
      text = `Data context: ${data?.length || 0} submissions, ${teams?.length || 0} teams in picklist, ${variables?.length || 0} tracked variables.${runResult ? ` Latest prediction: ${runResult.prediction.toFixed(2)} for ${runResult.targetVar}.` : ""}`
    }
    setMsgs(p => [...p, { role: "assistant", text }])
    setLoading(false)
  }

  return (
    <>
      <button className="chat-btn" onClick={() => setOpen(p => !p)} title="Data Chat">
        {open ? "✕" : "💬"}
      </button>
      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            <div className="chat-head-title">💬 Data Chat</div>
            <button className="ns-btn glass sm" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="chat-msgs" ref={msgsRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>{m.text}</div>
            ))}
            {loading && <div className="chat-msg assistant loading">Thinking…</div>}
          </div>
          <div className="chat-foot">
            <input className="chat-input" placeholder="Ask about data…" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && send()} />
            <button className="ns-btn blue sm" onClick={send} disabled={loading}>→</button>
          </div>
        </div>
      )}
    </>
  )
}

// ── MAIN APP ───────────────────────────────────────────────────────
export default function NorthstarDC() {
  const [tab, setTab] = useState("picklist")
  const [mlEnabled, setMlEnabled] = useState(getMlEnabled)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [searchNum, setSearchNum] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [searchResult, setSearchResult] = useState(null)
  const [runResult, setRunResult] = useState(null)

  const schema = usePoll(`${API}/api/schema`, 15000)
  const scoutData = usePoll(`${API}/api/data`, 4000) || []
  const picklist = usePoll(`${API}/api/picklist`, 5000) || []
  const health = usePoll(`${API}/api/health`, 5000)
  const scouters = usePoll(`${API}/api/scout-progress`, 3000) || []

  const { toasts, toast } = useToast()

  useEffect(() => {
    const id = setInterval(() => setMlEnabled(getMlEnabled()), 1500)
    return () => clearInterval(id)
  }, [])

  const variables = useMemo(() => (schema?.fields || []).map(f => ({
    varName: f.varName, label: f.label || f.varName,
    description: f.description || f.label || f.varName,
    useForTraining: !!f.useForTraining,
  })), [schema])

  // Use picklist as the team list; fallback to empty
  const teams = picklist

  function runSearch() {
    const n = searchNum.trim(); if (!n) return
    const found = teams.find(t => String(t.number) === n || String(t.team) === n)
    setSearchResult(found || null); setShowSearch(true)
  }

  const statusDot = health?.ok ? "live" : (health === null ? "syncing" : "offline")
  const statusText = health?.ok ? "Connected" : (health === null ? "Connecting" : "Offline")

  const TABS = [
    { id: "overview", icon: "📊", label: "Overview" },
    { id: "picklist", icon: "🏆", label: "Picklist" },
    { id: "teamDetail", icon: "🔍", label: "Team Detail" },
    { id: "compare", icon: "⚖️", label: "Compare" },
    { id: "strategy", icon: "🗺", label: "Strategy Board" },
    { id: "pipelines", icon: "🔗", label: "Data Pipelines" },
  ]

  return (
    <div className="ns-app">
      {/* Top Bar */}
      <div className="ns-bar">
        <div className="ns-logo">935<em>//</em>DC</div>
        <div className="ns-ev">{health?.event || "935 Data Center"}</div>
        <div className="ns-bar-r">
          <div style={{ display: "flex", gap: 5 }}>
            <input
              style={{ padding: "5px 9px", borderRadius: 8, border: ".5px solid var(--border2)", background: "var(--surface3)", color: "var(--text)", fontSize: 12, fontFamily: "var(--font-mono)", width: 72, outline: "none" }}
              placeholder="Team #" value={searchNum} onChange={e => setSearchNum(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runSearch()} inputMode="numeric" />
            <button className="ns-btn glass sm" onClick={runSearch}>Go</button>
          </div>
          <div className="ns-chip">
            <div className={`ns-dot ${statusDot}`} />
            <span style={{ fontFamily: "var(--font-mono)" }}>{statusText}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ns-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`ns-tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="ns-main" style={{ overflow: tab === "strategy" || tab === "pipelines" ? "hidden" : "auto" }}>
        {tab === "overview" && (
          <div>
            <div className="overview-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
              <div className="stat-card" style={{ animationDelay: ".0s" }}>
                <div className="stat-label">Teams in Picklist</div>
                <div className="stat-val blue">{teams.length}</div>
                <div className="stat-sub">loaded from data source</div>
              </div>
              <div className="stat-card" style={{ animationDelay: ".05s" }}>
                <div className="stat-label">Scouting Submissions</div>
                <div className="stat-val green">{scoutData.length}</div>
                <div className="stat-sub">{scouters.length} active scouters</div>
              </div>
              <div className="stat-card" style={{ animationDelay: ".1s" }}>
                <div className="stat-label">Backend Status</div>
                <div className={`stat-val ${health?.ok ? "green" : "yellow"}`}>{statusText}</div>
                <div className="stat-sub">{health?.event || "No event loaded"}</div>
              </div>
            </div>
            {teams.length > 0 && (
              <div style={{ padding: "0 14px 14px" }}>
                <div style={{ background: "var(--surface2)", border: ".5px solid var(--border2)", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "12px 14px", background: "var(--surface3)", borderBottom: ".5px solid var(--border)", fontSize: 12, fontWeight: 700 }}>Top Teams Snapshot</div>
                  {sortTeams(teams, "epa.total").slice(0, 5).map((t, i) => (
                    <div key={t.number} className="tc" onClick={() => { setSelectedTeam(t); setTab("teamDetail") }}>
                      <div className="tc-top">
                        <div className="tc-rank">#{t.rank ?? i + 1}</div>
                        <div className="tc-num">{t.number}</div>
                        <div className="tc-name">{t.name || ""}</div>
                        {t.epa?.total != null && <div className="tc-epa">{fmtNum(t.epa.total)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "picklist" && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {!selectedTeam
              ? <Leaderboard teams={teams} onSelect={t => { setSelectedTeam(t); setTab("teamDetail") }} />
              : <TeamDetail team={selectedTeam} onClose={() => setSelectedTeam(null)} />}
          </div>
        )}

        {tab === "teamDetail" && (
          <div style={{ overflow: "auto", height: "100%" }}>
            <TeamDetail team={selectedTeam} onClose={selectedTeam ? () => setSelectedTeam(null) : undefined} />
            {!selectedTeam && (
              <div style={{ padding: 14 }}>
                <div style={{ marginBottom: 10, fontSize: 12, color: "var(--text2)" }}>Select a team from the Picklist tab, or search by team number in the top bar.</div>
                {teams.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {sortTeams(teams, "epa.total").slice(0, 20).map(t => (
                      <button key={t.number} className="ns-btn glass sm" onClick={() => setSelectedTeam(t)}>{t.number}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "compare" && (
          <div style={{ height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <Compare allTeams={teams} />
          </div>
        )}

        {tab === "strategy" && (
          <div style={{ height: "100%", overflow: "hidden" }}>
            <StrategyBoard toast={toast} />
          </div>
        )}

        {tab === "pipelines" && (
          <div style={{ height: "100%", overflow: "hidden" }}>
            <PipelineTab
              schema={schema}
              data={scoutData}
              picklist={picklist}
              scouters={scouters}
              mlEnabled={mlEnabled}
              onRunResult={setRunResult}
            />
          </div>
        )}
      </div>

      {/* Search overlay */}
      {showSearch && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)", zIndex: 90, display: "flex", alignItems: "flex-end" }}
          onClick={() => setShowSearch(false)}>
          <div className="search-panel" onClick={e => e.stopPropagation()}>
            <div className="search-head">
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>Team {searchNum}</div>
              <button className="ns-btn glass sm" onClick={() => setShowSearch(false)}>Close</button>
            </div>
            <div className="search-body" style={{ overflow: "auto", maxHeight: "55vh" }}>
              {searchResult
                ? <TeamDetail team={searchResult} />
                : <div className="empty">No data found for team {searchNum}.</div>}
            </div>
          </div>
        </div>
      )}

      {/* Global Chat */}
      <GlobalChat
        data={scoutData}
        picklist={picklist}
        scouters={scouters}
        variables={variables}
        runResult={runResult}
        teams={teams}
      />

      <ToastHost toasts={toasts} />
    </div>
  )
}