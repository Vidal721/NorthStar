"""
FRC Scout — Ball Scoring Tracker
python frc_app.py  →  http://localhost:5000
"""

from flask import Flask, Response, request, jsonify
import cv2, numpy as np, json, os, threading, time, base64
from collections import defaultdict

app = Flask(__name__)

CONFIG_PATH  = 'frc_config.json'
UPLOAD_PATH  = 'uploads'
os.makedirs(UPLOAD_PATH, exist_ok=True)

DEFAULT_CONFIG = {
    "ball_hsv": {"lower": [20, 100, 100], "upper": [35, 255, 255]},
    "scoring_zones": [],
    "ignore_zones": [],
    "ball_min_area": 80,
    "ball_max_area": 4000,
    "ball_min_circularity": 0.30,
    "zone_cooldown_secs": 1.0,
}

# ── STATE ─────────────────────────────────────────────────────────────────────

state = {
    "cap": None, "fps": 30, "total_frames": 0,
    "frame_num": 0, "paused": True, "speed": 1,
    "config": DEFAULT_CONFIG.copy(),
    "scores": defaultdict(int),
    "events": [],
    "zone_cooldown": {},
    "current_balls": [],
    "last_frame_jpg": None,
    "running": False,
}
lock = threading.Lock()

def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH) as f:
            c = json.load(f)
        for k, v in DEFAULT_CONFIG.items():
            c.setdefault(k, v)
        return c
    return DEFAULT_CONFIG.copy()

def save_config(c):
    with open(CONFIG_PATH, 'w') as f:
        json.dump(c, f, indent=2)

# ── DETECTION ─────────────────────────────────────────────────────────────────

def detect_balls(frame, cfg):
    hsv  = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    lo   = np.array(cfg['ball_hsv']['lower'],  dtype=np.uint8)
    hi   = np.array(cfg['ball_hsv']['upper'],  dtype=np.uint8)
    mask = cv2.inRange(hsv, lo, hi)
    k    = np.ones((7, 7), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  k)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k)

    # Blank out ignore zones
    for z in cfg.get('ignore_zones', []):
        pts = np.array(z['polygon'], np.int32)
        cv2.fillPoly(mask, [pts], 0)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    balls = []
    for c in contours:
        area = cv2.contourArea(c)
        if not (cfg['ball_min_area'] < area < cfg['ball_max_area']):
            continue
        perim = cv2.arcLength(c, True)
        circ  = 4 * np.pi * area / (perim ** 2 + 1e-5)
        if circ < cfg['ball_min_circularity']:
            continue
        (x, y), r = cv2.minEnclosingCircle(c)
        balls.append({'x': float(x), 'y': float(y), 'r': float(r)})
    return balls

def check_zones(balls, scoring_zones):
    hits = []
    for b in balls:
        for z in scoring_zones:
            pts = np.array(z['polygon'], dtype=np.float32)
            if cv2.pointPolygonTest(pts, (b['x'], b['y']), False) >= 0:
                hits.append((b, z['name'], z.get('team', 'neutral')))
                break
    return hits

# ── RENDER ────────────────────────────────────────────────────────────────────

def render_frame(frame, balls, zone_hits, cfg):
    out = frame.copy()
    for z in cfg.get('ignore_zones', []):
        pts = np.array(z['polygon'], np.int32)
        ov  = out.copy(); cv2.fillPoly(ov, [pts], (40, 30, 80))
        cv2.addWeighted(ov, 0.35, out, 0.65, 0, out)
        cv2.polylines(out, [pts], True, (100, 80, 180), 1)

    for z in cfg['scoring_zones']:
        pts  = np.array(z['polygon'], np.int32)
        team = z.get('team', 'neutral')
        col  = (0,0,180) if team=='red' else (180,60,0) if team=='blue' else (0,140,140)
        ov   = out.copy(); cv2.fillPoly(ov, [pts], col)
        cv2.addWeighted(ov, 0.25, out, 0.75, 0, out)
        cv2.polylines(out, [pts], True, col, 2)
        cx = int(np.mean([p[0] for p in z['polygon']]))
        cy = int(np.mean([p[1] for p in z['polygon']]))
        cv2.putText(out, z['name'], (cx-30, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255,255,255), 1, cv2.LINE_AA)

    for b in balls:
        in_zone = any(bh is b for bh,_,_ in zone_hits)
        col = (0, 255, 80) if in_zone else (0, 220, 220)
        cv2.circle(out, (int(b['x']), int(b['y'])), max(int(b['r']), 5), col, 2)
        cv2.circle(out, (int(b['x']), int(b['y'])), 2, col, -1)
    return out

# ── VIDEO LOOP ────────────────────────────────────────────────────────────────

def video_loop():
    while True:
        with lock:
            if not state['running'] or state['paused'] or state['cap'] is None:
                time.sleep(0.02); continue
            cap   = state['cap']
            cfg   = state['config']
            fps   = state['fps']
            speed = state['speed']

        ret, frame = cap.read()
        if not ret:
            with lock: state['paused'] = True
            time.sleep(0.05); continue

        frame_num = int(cap.get(cv2.CAP_PROP_POS_FRAMES))
        balls     = detect_balls(frame, cfg)
        zone_hits = check_zones(balls, cfg['scoring_zones'])

        with lock:
            state['frame_num']     = frame_num
            state['current_balls'] = balls
            cooldown_frames = max(1, int(fps * cfg.get('zone_cooldown_secs', 1.0)))

            for (ball, zone_name, zone_team) in zone_hits:
                if state['zone_cooldown'].get(zone_name, 0) > 0:
                    continue
                state['zone_cooldown'][zone_name] = cooldown_frames
                state['scores'][zone_name] += 1
                state['events'].append({
                    'time':  round(frame_num / fps, 1),
                    'zone':  zone_name,
                    'team':  zone_team,
                    'total': state['scores'][zone_name],
                })

            for z in list(state['zone_cooldown']):
                state['zone_cooldown'][z] -= 1
                if state['zone_cooldown'][z] <= 0:
                    del state['zone_cooldown'][z]

        vis = render_frame(frame, balls, zone_hits, cfg)
        _, jpg = cv2.imencode('.jpg', vis, [cv2.IMWRITE_JPEG_QUALITY, 78])
        with lock:
            state['last_frame_jpg'] = jpg.tobytes()

        time.sleep(max(0, (1.0 / fps) / speed - 0.004))

threading.Thread(target=video_loop, daemon=True).start()

# ── ROUTES ────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return HTML_PAGE

@app.route('/upload', methods=['POST'])
def upload():
    f = request.files.get('video')
    if not f: return jsonify({'error': 'no file'}), 400
    path = os.path.join(UPLOAD_PATH, f.filename)
    f.save(path)
    with lock:
        if state['cap']: state['cap'].release()
        cap = cv2.VideoCapture(path)
        state.update({
            'cap': cap,
            'fps': cap.get(cv2.CAP_PROP_FPS) or 30,
            'total_frames': int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
            'frame_num': 0, 'paused': True,
            'scores': defaultdict(int), 'events': [],
            'zone_cooldown': {}, 'running': True,
            'config': load_config(),
        })
        fps = state['fps']; frames = state['total_frames']
    return jsonify({'ok': True, 'fps': fps, 'frames': frames})

@app.route('/frame')
def get_frame():
    with lock:
        jpg = state['last_frame_jpg']
        if jpg is None and state['cap']:
            state['cap'].set(cv2.CAP_PROP_POS_FRAMES, state['frame_num'])
            ret, fr = state['cap'].read()
            if ret:
                _, j = cv2.imencode('.jpg', fr, [cv2.IMWRITE_JPEG_QUALITY, 80])
                jpg = j.tobytes()
    if not jpg: return ('', 204)
    return Response(jpg, mimetype='image/jpeg', headers={'Cache-Control': 'no-cache'})

@app.route('/frame_image')
def frame_image():
    t = float(request.args.get('t', 0))
    with lock:
        cap = state['cap']; cur = state['frame_num']
    if not cap: return jsonify({'error': 'no video'}), 400
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ret, fr = cap.read()
    cap.set(cv2.CAP_PROP_POS_FRAMES, cur)
    if not ret: return jsonify({'error': 'seek failed'}), 400
    _, j = cv2.imencode('.jpg', fr, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return jsonify({'image': base64.b64encode(j.tobytes()).decode(),
                    'width': fr.shape[1], 'height': fr.shape[0]})

@app.route('/pixel_color')
def pixel_color():
    x = int(request.args.get('x', 0))
    y = int(request.args.get('y', 0))
    with lock:
        cap = state['cap']; fn = state['frame_num']
    if not cap: return jsonify({'error': 'no video'}), 400
    cap.set(cv2.CAP_PROP_POS_FRAMES, fn)
    ret, fr = cap.read()
    if not ret: return jsonify({'error': 'read failed'}), 400
    h_img, w_img = fr.shape[:2]
    x = max(0, min(x, w_img - 1)); y = max(0, min(y, h_img - 1))
    bgr = fr[y, x].tolist()
    hsv_img = cv2.cvtColor(fr, cv2.COLOR_BGR2HSV)
    hsv = hsv_img[y, x].tolist()
    margin = [12, 70, 70]
    lower = [max(0, hsv[i] - margin[i]) for i in range(3)]
    upper = [min([180, 255, 255][i], hsv[i] + margin[i]) for i in range(3)]
    return jsonify({'hsv': hsv, 'bgr': bgr, 'lower': lower, 'upper': upper})

@app.route('/control', methods=['POST'])
def control():
    d = request.json
    with lock:
        a = d.get('action')
        if a == 'play':    state['paused'] = False
        elif a == 'pause': state['paused'] = True
        elif a == 'seek':
            fn = int(d.get('frame', 0))
            if state['cap']:
                state['cap'].set(cv2.CAP_PROP_POS_FRAMES, fn)
                state['frame_num'] = fn
                ret, fr = state['cap'].read()
                if ret:
                    _, j = cv2.imencode('.jpg', fr, [cv2.IMWRITE_JPEG_QUALITY, 80])
                    state['last_frame_jpg'] = j.tobytes()
        elif a == 'speed':
            state['speed'] = max(0.25, min(8, float(d.get('value', 1))))
    return jsonify({'ok': True})

@app.route('/status')
def status():
    with lock:
        return jsonify({
            'frame':  state['frame_num'], 'total': state['total_frames'],
            'fps':    state['fps'],       'paused': state['paused'],
            'speed':  state['speed'],
            'scores': dict(state['scores']),
            'events': state['events'][-40:],
            'balls':  len(state['current_balls']),
        })

@app.route('/config', methods=['GET', 'POST'])
def config_route():
    if request.method == 'GET':
        with lock: return jsonify(state['config'])
    cfg = request.json
    with lock: state['config'] = cfg
    save_config(cfg)
    return jsonify({'ok': True})

@app.route('/reset_scores', methods=['POST'])
def reset_scores():
    with lock:
        state['scores'] = defaultdict(int)
        state['events'] = []
        state['zone_cooldown'] = {}
    return jsonify({'ok': True})

# ── HTML ──────────────────────────────────────────────────────────────────────

HTML_PAGE = r'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FRC Scout</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Rajdhani:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#080a0d;--s1:#0e1117;--s2:#151b24;--s3:#1c2433;
  --border:#1f2d40;--border2:#2a3d55;
  --red:#ff3b3b;--blue:#2d8fff;--green:#00e676;--amber:#ffb300;--cyan:#00bcd4;
  --text:#dde6f0;--muted:#4a6080;--accent:#ffb300;
  --ui:'Rajdhani',sans-serif;--mono:'IBM Plex Mono',monospace;
}
html,body{height:100%;overflow:hidden}
body{background:var(--bg);color:var(--text);font-family:var(--ui);display:flex;flex-direction:column}
header{display:flex;align-items:center;gap:14px;padding:7px 16px;background:var(--s1);border-bottom:1px solid var(--border);flex-shrink:0}
.logo{font-size:19px;font-weight:700;letter-spacing:3px;color:var(--accent)}
.logo span{color:var(--cyan)}
#hSt{font-size:11px;color:var(--muted);font-family:var(--mono)}
.hbtn{background:transparent;border:1px solid var(--border2);color:var(--muted);padding:4px 11px;border-radius:3px;cursor:pointer;font-family:var(--ui);font-size:13px;font-weight:600;letter-spacing:.5px;transition:.15s}
.hbtn:hover{border-color:var(--accent);color:var(--accent)}
.main{display:grid;grid-template-columns:1fr 300px;flex:1;overflow:hidden;min-height:0}
.left{display:flex;flex-direction:column;overflow:hidden}
.vwrap{position:relative;flex:1;background:#000;overflow:hidden;display:flex;align-items:center;justify-content:center}
#vImg{max-width:100%;max-height:100%;display:block;image-rendering:crisp-edges}
body.eye #vImg{cursor:crosshair}
.dropz{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;border:2px dashed var(--border2);cursor:pointer;transition:.2s}
.dropz:hover{border-color:var(--accent);background:rgba(255,179,0,.03)}
.dropz .di{font-size:38px;opacity:.22;line-height:1}
.dropz p{font-size:14px;letter-spacing:2px;color:var(--muted)}
.dropz small{font-size:10px;color:var(--border2);font-family:var(--mono)}
#fInput{display:none}
.ctl{background:var(--s1);border-top:1px solid var(--border);padding:8px 13px;flex-shrink:0}
.sr{display:flex;align-items:center;gap:8px;margin-bottom:6px}
#scrub{flex:1;-webkit-appearance:none;height:3px;background:var(--border);border-radius:2px;outline:none;cursor:pointer}
#scrub::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:var(--accent);cursor:pointer}
.tc{font-family:var(--mono);font-size:11px;color:var(--muted);min-width:88px;text-align:right}
.br{display:flex;align-items:center;gap:5px}
.cb{background:var(--s2);border:1px solid var(--border);color:var(--text);padding:5px 11px;border-radius:3px;cursor:pointer;font-family:var(--ui);font-size:13px;font-weight:600;letter-spacing:.5px;transition:.15s}
.cb:hover{border-color:var(--accent);color:var(--accent)}
.cb.on{background:var(--accent);color:#000;border-color:var(--accent)}
.spd{background:var(--s2);border:1px solid var(--border);padding:4px 9px;border-radius:3px;font-family:var(--mono);font-size:12px;color:var(--accent);min-width:44px;text-align:center}
.sbar{display:flex;gap:14px;padding:3px 13px;background:var(--s1);border-top:1px solid var(--border);font-family:var(--mono);font-size:10px;color:var(--muted);flex-shrink:0}
.sbar b{color:var(--text)}
.dot{width:6px;height:6px;border-radius:50%;background:var(--muted);display:inline-block}
.dot.live{background:var(--green);animation:blink 1.4s ease-in-out infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
.right{background:var(--s1);border-left:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
.tabs{display:flex;border-bottom:1px solid var(--border);flex-shrink:0}
.tab{flex:1;padding:8px 4px;text-align:center;font-size:12px;font-weight:600;letter-spacing:1px;cursor:pointer;color:var(--muted);border-bottom:2px solid transparent;transition:.15s}
.tab.on{color:var(--accent);border-bottom-color:var(--accent)}
.panel{flex:1;overflow-y:auto;padding:11px;display:none}
.panel.on{display:block}
.scard{display:flex;align-items:center;justify-content:space-between;background:var(--s2);border:1px solid var(--border);border-radius:4px;padding:10px 13px;margin-bottom:6px;border-left:3px solid var(--muted)}
.scard.red{border-left-color:var(--red)}.scard.blue{border-left-color:var(--blue)}.scard.neutral{border-left-color:var(--cyan)}
.scard .zn{font-size:14px;font-weight:700;letter-spacing:.5px}
.scard.red .zn{color:var(--red)}.scard.blue .zn{color:var(--blue)}.scard.neutral .zn{color:var(--cyan)}
.scard .cnt{font-size:34px;font-weight:700;line-height:1;color:var(--text)}
.scard .sub{font-size:10px;color:var(--muted);font-family:var(--mono)}
.ev{display:flex;gap:7px;padding:4px 0;border-bottom:1px solid var(--border);font-size:11px;font-family:var(--mono);align-items:center}
.ev .et{color:var(--muted);min-width:40px}.ev .ez{flex:1}
.ev.red .ez{color:var(--red)}.ev.blue .ez{color:var(--blue)}.ev.neutral .ez{color:var(--cyan)}
.ev .etot{color:var(--accent);font-weight:600}
.lbl{font-size:10px;color:var(--muted);letter-spacing:.5px;display:block;margin-bottom:3px;font-family:var(--mono)}
input,select{background:var(--s2);border:1px solid var(--border);color:var(--text);padding:5px 8px;border-radius:3px;font-family:var(--mono);font-size:12px;width:100%;outline:none}
input:focus,select:focus{border-color:var(--accent)}
.r2{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.hrow{display:flex;align-items:center;gap:7px;margin-bottom:4px}
.hrow .hl{font-size:10px;color:var(--muted);font-family:var(--mono);min-width:38px}
.hrow input[type=range]{flex:1;-webkit-appearance:none;height:3px;background:var(--border);border-radius:2px}
.hrow input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:11px;height:11px;border-radius:50%;background:var(--accent);cursor:pointer}
.hrow .hv{min-width:24px;text-align:right;font-family:var(--mono);font-size:11px;color:var(--text)}
.swatch{width:100%;height:26px;border-radius:3px;margin:5px 0;border:1px solid var(--border);transition:background .2s}
.sec{font-size:11px;font-weight:700;letter-spacing:2px;color:var(--accent);margin:9px 0 7px}
.eyebtn{display:flex;align-items:center;gap:8px;width:100%;background:var(--s3);border:1px solid var(--border2);color:var(--text);padding:7px 11px;border-radius:3px;cursor:pointer;font-family:var(--ui);font-size:13px;font-weight:600;letter-spacing:.5px;transition:.15s;margin-bottom:8px}
.eyebtn:hover,.eyebtn.on{border-color:var(--cyan);color:var(--cyan)}
.eyebtn.on{background:rgba(0,188,212,.1)}
/* Modal */
.modal{position:fixed;inset:0;background:rgba(0,0,0,.93);z-index:200;display:flex;flex-direction:column;align-items:center;padding:14px;gap:10px;overflow:auto}
.modal.hidden{display:none}
.mhead{width:100%;max-width:1300px;display:flex;align-items:center;gap:10px;flex-shrink:0}
.mhead h2{font-size:15px;font-weight:700;letter-spacing:3px;color:var(--accent)}
.mhint{font-size:10px;color:var(--muted);font-family:var(--mono);flex:1}
.mbody{width:100%;max-width:1300px;display:grid;grid-template-columns:1fr 240px;gap:10px;align-items:start;min-height:0}
.cwrap{position:relative;background:#000;border:1px solid var(--border);border-radius:4px;overflow:hidden}
#zc{display:block;width:100%;cursor:crosshair}
.zsb{display:flex;flex-direction:column;gap:8px;overflow-y:auto;max-height:82vh}
.zlist{max-height:200px;overflow-y:auto}
.zi{display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--border);font-size:11px}
.zdot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.zdel{margin-left:auto;cursor:pointer;color:var(--muted);font-size:15px;padding:0 3px;line-height:1}
.zdel:hover{color:var(--red)}
.ptinfo{font-family:var(--mono);font-size:10px;color:var(--muted);min-height:13px}
.mbtn{background:var(--s2);border:1px solid var(--border);color:var(--text);padding:6px 11px;border-radius:3px;cursor:pointer;font-family:var(--ui);font-size:13px;font-weight:600;letter-spacing:.5px;transition:.15s;width:100%}
.mbtn:hover{border-color:var(--accent);color:var(--accent)}
.mbtn.on{background:var(--accent);color:#000;border-color:var(--accent)}
.mbtn.danger{border-color:var(--red);color:var(--red)}
.mbtn.danger:hover{background:rgba(255,59,59,.1)}
.mrow{display:flex;gap:5px}
.mrow .mbtn{font-size:11px;padding:5px 7px}
.mrow .mbtn.on{background:var(--s3);color:var(--accent);border-color:var(--accent)}
.pgtog{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--muted);cursor:pointer}
.pgtog input{width:auto;padding:0}
</style>
</head>
<body>

<div class="modal hidden" id="modal">
  <div class="mhead">
    <h2 id="mTitle">ZONE EDITOR</h2>
    <span class="mhint" id="mHint">Left-click to place points · Right-click or Enter to finish polygon</span>
    <div style="display:flex;gap:5px">
      <button class="mbtn" style="width:auto" onclick="clearPoly()">CLEAR</button>
      <button class="mbtn on" style="width:auto" onclick="closeModal()">DONE</button>
    </div>
  </div>
  <div class="mbody">
    <div class="cwrap"><canvas id="zc"></canvas></div>
    <div class="zsb">
      <div>
        <div class="sec" style="margin-top:0">MODE</div>
        <div class="mrow">
          <button class="mbtn on" id="mScore" onclick="setMode('score')">SCORING</button>
          <button class="mbtn"    id="mIgn"   onclick="setMode('ignore')">IGNORE</button>
        </div>
      </div>
      <div>
        <label class="lbl">ZONE NAME</label>
        <input id="zName" placeholder="speaker_red">
      </div>
      <div class="r2">
        <div id="teamWrap">
          <label class="lbl">TEAM</label>
          <select id="zTeam"><option value="red">Red</option><option value="blue">Blue</option><option value="neutral">Neutral</option></select>
        </div>
        <div>
          <label class="lbl">FRAME (s)</label>
          <input id="fSec" type="number" value="5" min="0" step="5">
        </div>
      </div>
      <button class="mbtn" onclick="loadFrame()">RELOAD FRAME</button>
      <div class="ptinfo" id="ptInfo">No points</div>
      <button class="mbtn on" onclick="finishZone()">ADD ZONE ↵</button>
      <button class="mbtn danger" onclick="clearPoly()">CLEAR POINTS</button>
      <label class="pgtog"><input type="checkbox" id="pgOn" checked onchange="redraw()"> Perspective guide</label>
      <div>
        <div class="sec">SCORING ZONES</div>
        <div class="zlist" id="zlScore"></div>
      </div>
      <div>
        <div class="sec">IGNORE ZONES</div>
        <div class="zlist" id="zlIgn"></div>
      </div>
      <button class="mbtn on" onclick="saveZones()">SAVE ALL ZONES</button>
    </div>
  </div>
</div>

<header>
  <div class="logo">FRC<span>SCOUT</span></div>
  <span id="hSt">NO VIDEO LOADED</span>
  <div style="margin-left:auto;display:flex;gap:5px">
    <button class="hbtn" onclick="resetScores()">RESET</button>
    <button class="hbtn" onclick="doExport()">EXPORT</button>
  </div>
</header>

<div class="main">
  <div class="left">
    <div class="vwrap" id="vwrap">
      <div class="dropz" id="dropz" onclick="document.getElementById('fInput').click()">
        <div class="di">▶</div>
        <p>DROP VIDEO OR CLICK</p>
        <small>mp4 · avi · mov</small>
      </div>
      <img id="vImg" style="display:none" alt="">
      <input type="file" id="fInput" accept="video/*" onchange="uploadVid(this)">
    </div>
    <div class="ctl">
      <div class="sr">
        <input type="range" id="scrub" min="0" max="1000" value="0" oninput="onScrub(this)">
        <span class="tc" id="tc">0:00 / 0:00</span>
      </div>
      <div class="br">
        <button class="cb" id="playBtn" onclick="togglePlay()">▶ PLAY</button>
        <button class="cb" onclick="skip(-150)">◀◀</button>
        <button class="cb" onclick="skip(150)">▶▶</button>
        <span style="flex:1"></span>
        <button class="cb" onclick="chSpd(-1)">−</button>
        <span class="spd" id="spdB">1×</span>
        <button class="cb" onclick="chSpd(1)">+</button>
      </div>
    </div>
    <div class="sbar">
      <span style="display:flex;align-items:center;gap:5px">
        <span class="dot" id="ldot"></span><span id="stTxt">idle</span>
      </span>
      <span>balls: <b id="bCnt">0</b></span>
    </div>
  </div>

  <div class="right">
    <div class="tabs">
      <div class="tab on"  onclick="showTab('scores')">SCORES</div>
      <div class="tab"     onclick="showTab('events')">EVENTS</div>
      <div class="tab"     onclick="showTab('zones')">ZONES</div>
      <div class="tab"     onclick="showTab('color')">COLOR</div>
    </div>
    <div class="panel on" id="panel-scores">
      <div id="scoreList"><div style="color:var(--muted);font-size:12px;padding:16px 0;text-align:center">No scores yet</div></div>
    </div>
    <div class="panel" id="panel-events">
      <div id="evList"></div>
    </div>
    <div class="panel" id="panel-zones">
      <p style="font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:11px">
        Draw scoring zones and ignore areas.<br>
        Camera is angled — use the perspective guide and draw trapezoids matching the field depth.
      </p>
      <button class="cb on" style="width:100%;margin-bottom:10px" onclick="openModal('score')">OPEN ZONE EDITOR</button>
      <div class="sec">SCORING ZONES</div>
      <div id="zlMain"></div>
      <div class="sec">IGNORE ZONES</div>
      <div id="zlIgnMain"></div>
    </div>
    <div class="panel" id="panel-color">
      <div class="sec" style="margin-top:0">BALL COLOR</div>
      <button class="eyebtn" id="eyeBtn" onclick="toggleEye()">
        <span>🎯</span><span id="eyeLbl">CLICK TO SAMPLE COLOR FROM VIDEO</span>
      </button>
      <div id="eyeInfo" style="font-size:10px;color:var(--muted);font-family:var(--mono);margin-bottom:6px;min-height:13px"></div>
      <div class="swatch" id="swatch"></div>
      <div id="hsvSliders"></div>
      <button class="cb on" style="width:100%;margin-top:9px" onclick="saveColor()">SAVE COLOR</button>
    </div>
  </div>
</div>

<script>
let playing=false,totalFrames=1,fps=30,speed=1;
let scrubbing=false,lastEvLen=0;
let cfg={scoring_zones:[],ignore_zones:[],ball_hsv:{lower:[20,100,100],upper:[35,255,255]}};
let eyeMode=false;
let zPts=[],zImg=null,mode='score';
const canvas=document.getElementById('zc');
const ctx=canvas.getContext('2d');

// ── UPLOAD ─────────────────────────────────────────────────────────────────
async function uploadVid(inp){
  const f=inp.files[0];if(!f)return;
  document.getElementById('hSt').textContent='UPLOADING…';
  const fd=new FormData();fd.append('video',f);
  const d=await(await fetch('/upload',{method:'POST',body:fd})).json();
  fps=d.fps;totalFrames=d.frames;
  document.getElementById('scrub').max=totalFrames;
  document.getElementById('dropz').style.display='none';
  document.getElementById('vImg').style.display='block';
  document.getElementById('hSt').textContent=f.name+' · '+Math.round(totalFrames/fps)+'s';
  cfg=await(await fetch('/config')).json();
  cfg.scoring_zones=cfg.scoring_zones||[];
  cfg.ignore_zones=cfg.ignore_zones||[];
  buildSliders();renderZoneLists();startPoll();
}

// ── PLAYBACK ───────────────────────────────────────────────────────────────
function togglePlay(){
  playing=!playing;
  fetch('/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:playing?'play':'pause'})});
  document.getElementById('playBtn').textContent=playing?'⏸ PAUSE':'▶ PLAY';
  document.getElementById('ldot').className='dot'+(playing?' live':'');
}
function skip(f){
  const t=Math.max(0,Math.min(totalFrames,+document.getElementById('scrub').value+f));
  document.getElementById('scrub').value=t;
  fetch('/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'seek',frame:t})});
}
function onScrub(el){
  scrubbing=true;
  fetch('/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'seek',frame:+el.value})});
  setTimeout(()=>scrubbing=false,250);
}
function chSpd(d){
  const steps=[0.25,0.5,1,2,4,8];
  let i=steps.indexOf(speed);i=Math.max(0,Math.min(steps.length-1,i+d));
  speed=steps[i];document.getElementById('spdB').textContent=speed+'×';
  fetch('/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'speed',value:speed})});
}
function fmt(f){const s=Math.floor(f/fps);return Math.floor(s/60)+':'+(s%60).toString().padStart(2,'0')}

// ── POLL ───────────────────────────────────────────────────────────────────
function startPoll(){
  setInterval(async()=>{
    if(!scrubbing)document.getElementById('vImg').src='/frame?t='+Date.now();
    const s=await(await fetch('/status')).json();
    if(!scrubbing){
      document.getElementById('scrub').value=s.frame;
      document.getElementById('tc').textContent=fmt(s.frame)+' / '+fmt(s.total);
    }
    document.getElementById('stTxt').textContent=s.paused?'paused':'running';
    document.getElementById('bCnt').textContent=s.balls;
    renderScores(s.scores);
    if(s.events.length!==lastEvLen){renderEvents(s.events);lastEvLen=s.events.length;}
  },120);
}

// ── SCORES / EVENTS ────────────────────────────────────────────────────────
function renderScores(sc){
  const el=document.getElementById('scoreList');
  const en=Object.entries(sc);
  if(!en.length){el.innerHTML='<div style="color:var(--muted);font-size:12px;padding:16px 0;text-align:center">No scores yet</div>';return;}
  el.innerHTML=en.sort((a,b)=>b[1]-a[1]).map(([name,cnt])=>{
    const z=(cfg.scoring_zones||[]).find(z=>z.name===name)||{};
    const t=z.team||'neutral';
    return`<div class="scard ${t}"><div><div class="zn">${name}</div><div class="sub">${t}</div></div>
      <div style="text-align:right"><div class="cnt">${cnt}</div><div class="sub">scored</div></div></div>`;
  }).join('');
}
function renderEvents(evs){
  document.getElementById('evList').innerHTML=[...evs].reverse().map(e=>
    `<div class="ev ${e.team||'neutral'}"><span class="et">${e.time}s</span><span class="ez">${e.zone}</span><span class="etot">×${e.total}</span></div>`
  ).join('');
}

// ── TABS ───────────────────────────────────────────────────────────────────
function showTab(n){
  const ns=['scores','events','zones','color'];
  document.querySelectorAll('.tab').forEach((t,i)=>t.className='tab'+(ns[i]===n?' on':''));
  document.querySelectorAll('.panel').forEach(p=>p.className='panel');
  document.getElementById('panel-'+n).className='panel on';
}

// ── EYEDROPPER ─────────────────────────────────────────────────────────────
function toggleEye(){
  eyeMode=!eyeMode;
  document.body.classList.toggle('eye',eyeMode);
  document.getElementById('eyeBtn').classList.toggle('on',eyeMode);
  document.getElementById('eyeLbl').textContent=eyeMode?'CLICK ANY PIXEL ON THE VIDEO':'CLICK TO SAMPLE COLOR FROM VIDEO';
  document.getElementById('eyeInfo').textContent=eyeMode?'Aim at a ball and click…':'';
}
document.getElementById('vImg').addEventListener('click',async function(e){
  if(!eyeMode)return;
  const rect=this.getBoundingClientRect();
  const sx=this.naturalWidth/rect.width,sy=this.naturalHeight/rect.height;
  const px=Math.round((e.clientX-rect.left)*sx);
  const py=Math.round((e.clientY-rect.top)*sy);
  const d=await(await fetch(`/pixel_color?x=${px}&y=${py}`)).json();
  if(d.error)return;
  cfg.ball_hsv={lower:d.lower,upper:d.upper};
  buildSliders();updateSwatch();
  document.getElementById('eyeInfo').textContent=`HSV [${d.hsv.join(', ')}] — range applied`;
  eyeMode=false;
  document.body.classList.remove('eye');
  document.getElementById('eyeBtn').classList.remove('on');
  document.getElementById('eyeLbl').textContent='CLICK TO SAMPLE COLOR FROM VIDEO';
});

// ── HSV SLIDERS ────────────────────────────────────────────────────────────
function buildSliders(){
  const el=document.getElementById('hsvSliders');
  const hsv=cfg.ball_hsv,chs=['H','S','V'],mx=[180,255,255];
  el.innerHTML=chs.map((c,i)=>`
    <div class="hrow"><span class="hl">${c} min</span>
      <input type="range" min="0" max="${mx[i]}" value="${hsv.lower[i]}"
        oninput="cfg.ball_hsv.lower[${i}]=+this.value;this.nextElementSibling.textContent=this.value;updateSwatch()">
      <span class="hv">${hsv.lower[i]}</span></div>
    <div class="hrow"><span class="hl">${c} max</span>
      <input type="range" min="0" max="${mx[i]}" value="${hsv.upper[i]}"
        oninput="cfg.ball_hsv.upper[${i}]=+this.value;this.nextElementSibling.textContent=this.value;updateSwatch()">
      <span class="hv">${hsv.upper[i]}</span></div>`).join('');
  updateSwatch();
}
function updateSwatch(){
  const lo=cfg.ball_hsv.lower,hi=cfg.ball_hsv.upper;
  const h=((lo[0]+hi[0])/2)/180*360;
  const s=((lo[1]+hi[1])/2)/255*100;
  const v=((lo[2]+hi[2])/2)/255*50;
  document.getElementById('swatch').style.background=`hsl(${h},${s}%,${v}%)`;
}
async function saveColor(){
  await fetch('/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cfg)});
  const b=event.target;b.textContent='SAVED ✓';setTimeout(()=>b.textContent='SAVE COLOR',1500);
}

// ── ZONE MODAL ─────────────────────────────────────────────────────────────
function setMode(m){
  mode=m;
  document.getElementById('mScore').classList.toggle('on',m==='score');
  document.getElementById('mIgn').classList.toggle('on',m==='ignore');
  document.getElementById('mTitle').textContent=m==='ignore'?'IGNORE EDITOR':'ZONE EDITOR';
  document.getElementById('mHint').textContent=m==='ignore'
    ?'Draw areas to ignore (crowd stands, field decorations, ref positions)'
    :'Left-click to place points · Right-click or Enter to close polygon · Match field perspective';
  document.getElementById('teamWrap').style.visibility=m==='ignore'?'hidden':'visible';
}
function openModal(m){
  document.getElementById('modal').classList.remove('hidden');
  setMode(m||'score');
  if(zImg){canvas.width=zImg.width;canvas.height=zImg.height;redraw();}
  loadFrame();
}
function closeModal(){document.getElementById('modal').classList.add('hidden');}

async function loadFrame(){
  let t=parseFloat(document.getElementById('fSec').value)||5;
  try{const s=await(await fetch('/status')).json();if(s.total>0){t=s.frame/s.fps;document.getElementById('fSec').value=Math.round(t);}}catch(e){}
  const d=await(await fetch('/frame_image?t='+t)).json();
  if(d.error)return;
  const img=new Image();
  img.onload=()=>{zImg=img;canvas.width=img.width;canvas.height=img.height;redraw();};
  img.src='data:image/jpeg;base64,'+d.image;
}

canvas.addEventListener('click',e=>{
  const r=canvas.getBoundingClientRect();
  const sx=canvas.width/r.width,sy=canvas.height/r.height;
  zPts.push([Math.round((e.clientX-r.left)*sx),Math.round((e.clientY-r.top)*sy)]);
  updPtInfo();redraw();
});
canvas.addEventListener('contextmenu',e=>{e.preventDefault();if(zPts.length>=3)finishZone();});

document.addEventListener('keydown',e=>{
  const open=!document.getElementById('modal').classList.contains('hidden');
  if(open&&e.code==='Enter'&&zPts.length>=3){finishZone();return;}
  if(open&&e.code==='Escape'){closeModal();return;}
  if(!open){
    if(e.code==='Space'){e.preventDefault();togglePlay();}
    if(e.code==='ArrowLeft')skip(-150);
    if(e.code==='ArrowRight')skip(150);
    if(e.key==='+')chSpd(1);
    if(e.key==='-')chSpd(-1);
  }
});

function updPtInfo(){
  const n=zPts.length;
  document.getElementById('ptInfo').textContent=
    n===0?'No points':n<3?`${n} point${n>1?'s':''} — need ${3-n} more`:`${n} points — right-click or Enter to finish`;
}
function clearPoly(){zPts=[];updPtInfo();redraw();}

function redraw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(zImg)ctx.drawImage(zImg,0,0);
  else{ctx.fillStyle='#111';ctx.fillRect(0,0,canvas.width,canvas.height);}
  if(document.getElementById('pgOn')?.checked)drawGrid();

  // Draw ignore zones
  (cfg.ignore_zones||[]).forEach(z=>{
    const p=z.polygon;
    ctx.beginPath();p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
    ctx.fillStyle='rgba(100,80,200,.3)';ctx.strokeStyle='#9070dd';ctx.lineWidth=1.5;ctx.fill();ctx.stroke();
    const cx=p.reduce((s,q)=>s+q[0],0)/p.length;
    const cy=p.reduce((s,q)=>s+q[1],0)/p.length;
    ctx.fillStyle='rgba(210,200,255,.9)';ctx.font='bold 12px Rajdhani,sans-serif';
    ctx.textAlign='center';ctx.shadowColor='rgba(0,0,0,.8)';ctx.shadowBlur=3;
    ctx.fillText('⊘ '+z.name,cx,cy);ctx.shadowBlur=0;
  });

  // Draw scoring zones
  (cfg.scoring_zones||[]).forEach(z=>{
    const p=z.polygon,t=z.team||'neutral';
    ctx.beginPath();p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
    ctx.fillStyle=t==='red'?'rgba(255,59,59,.25)':t==='blue'?'rgba(45,143,255,.25)':'rgba(0,188,212,.25)';
    ctx.strokeStyle=t==='red'?'#ff3b3b':t==='blue'?'#2d8fff':'#00bcd4';
    ctx.lineWidth=2;ctx.fill();ctx.stroke();
    const cx=p.reduce((s,q)=>s+q[0],0)/p.length;
    const cy=p.reduce((s,q)=>s+q[1],0)/p.length;
    ctx.fillStyle='#fff';ctx.font='bold 13px Rajdhani,sans-serif';
    ctx.textAlign='center';ctx.shadowColor='rgba(0,0,0,.8)';ctx.shadowBlur=4;
    ctx.fillText(z.name,cx,cy);ctx.shadowBlur=0;
  });

  // In-progress polygon
  if(zPts.length){
    if(zPts.length>=3){
      ctx.beginPath();zPts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
      ctx.fillStyle=mode==='ignore'?'rgba(130,100,255,.18)':'rgba(255,179,0,.15)';ctx.fill();
    }
    ctx.beginPath();zPts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.strokeStyle=mode==='ignore'?'#9070dd':'#ffb300';
    ctx.lineWidth=2;ctx.setLineDash([7,4]);ctx.stroke();ctx.setLineDash([]);
    if(zPts.length>=3){
      const[fx,fy]=zPts[0],[lx,ly]=zPts[zPts.length-1];
      ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(fx,fy);
      ctx.strokeStyle='rgba(255,179,0,.3)';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.stroke();ctx.setLineDash([]);
    }
    zPts.forEach(([x,y],i)=>{
      ctx.beginPath();ctx.arc(x,y,i===0?7:5,0,Math.PI*2);
      ctx.fillStyle=i===0?(mode==='ignore'?'#9070dd':'#ffb300'):'#fff';
      ctx.strokeStyle='#000';ctx.lineWidth=1.5;ctx.fill();ctx.stroke();
    });
  }
}

function drawGrid(){
  const w=canvas.width,h=canvas.height,vx=w/2,vy=h*0.08;
  ctx.strokeStyle='rgba(255,255,255,0.09)';ctx.lineWidth=1;
  for(let i=0;i<=12;i++){const bx=w*(i/12);ctx.beginPath();ctx.moveTo(vx,vy);ctx.lineTo(bx,h);ctx.stroke();}
  for(let i=1;i<=9;i++){
    const t=(i/9)**1.7,y=vy+(h-vy)*t;
    const lx=vx+(0-vx)*((y-vy)/(h-vy)),rx=vx+(w-vx)*((y-vy)/(h-vy));
    ctx.beginPath();ctx.moveTo(lx,y);ctx.lineTo(rx,y);ctx.stroke();
  }
}

function finishZone(){
  if(zPts.length<3)return;
  const name=document.getElementById('zName').value||('zone_'+Date.now());
  if(mode==='ignore'){
    cfg.ignore_zones=cfg.ignore_zones||[];
    cfg.ignore_zones.push({name,polygon:[...zPts]});
  } else {
    const team=document.getElementById('zTeam').value;
    cfg.scoring_zones=cfg.scoring_zones||[];
    cfg.scoring_zones.push({name,team,polygon:[...zPts]});
  }
  zPts=[];updPtInfo();renderZoneLists();redraw();
  const m=name.match(/^(.*?)(\d+)$/);
  if(m)document.getElementById('zName').value=m[1]+(parseInt(m[2])+1);
}

function delZone(type,i){
  if(type==='score')cfg.scoring_zones.splice(i,1);
  else cfg.ignore_zones.splice(i,1);
  renderZoneLists();redraw();
}

function renderZoneLists(){
  const sc=(cfg.scoring_zones||[]).map((z,i)=>`
    <div class="zi">
      <div class="zdot" style="background:${z.team==='red'?'#ff3b3b':z.team==='blue'?'#2d8fff':'#00bcd4'}"></div>
      <span style="flex:1">${z.name}</span>
      <span style="font-size:10px;color:var(--muted)">${z.team}</span>
      <span class="zdel" onclick="delZone('score',${i})">×</span>
    </div>`).join('')||'<div style="font-size:11px;color:var(--muted);padding:3px 0">None</div>';
  const ig=(cfg.ignore_zones||[]).map((z,i)=>`
    <div class="zi">
      <div class="zdot" style="background:#9070dd"></div>
      <span style="flex:1">${z.name}</span>
      <span class="zdel" onclick="delZone('ignore',${i})">×</span>
    </div>`).join('')||'<div style="font-size:11px;color:var(--muted);padding:3px 0">None</div>';
  ['zlScore','zlMain'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML=sc;});
  ['zlIgn','zlIgnMain'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML=ig;});
}

async function saveZones(){
  await fetch('/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cfg)});
  const b=event.target;b.textContent='SAVED ✓';setTimeout(()=>b.textContent='SAVE ALL ZONES',1500);
}

async function resetScores(){await fetch('/reset_scores',{method:'POST'});}
async function doExport(){
  const s=await(await fetch('/status')).json();
  const bl=new Blob([JSON.stringify({scores:s.scores,events:s.events},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(bl);a.download='frc_results.json';a.click();
}

// ── DRAG & DROP ────────────────────────────────────────────────────────────
const vw=document.getElementById('vwrap');
vw.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';});
vw.addEventListener('drop',e=>{
  e.preventDefault();
  const f=e.dataTransfer.files[0];
  if(f&&f.type.startsWith('video/')){
    const dt=new DataTransfer();dt.items.add(f);
    document.getElementById('fInput').files=dt.files;
    uploadVid(document.getElementById('fInput'));
  }
});
</script>
</body>
</html>'''

if __name__ == '__main__':
    state['config'] = load_config()
    print("FRC Scout → http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)