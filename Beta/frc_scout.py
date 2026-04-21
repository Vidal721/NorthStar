"""
FRC Scout — Web UI
Usage: python frc_app.py
Then open http://localhost:5000 in your browser.
Drop a video file in, calibrate zones, run analysis.
"""

from flask import Flask, Response, request, jsonify, send_from_directory
import cv2, numpy as np, json, os, threading, time, base64
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Optional

app = Flask(__name__, static_folder='static')

CONFIG_PATH = 'frc_config.json'
UPLOAD_PATH = 'uploads'
os.makedirs(UPLOAD_PATH, exist_ok=True)
os.makedirs('static', exist_ok=True)

DEFAULT_CONFIG = {
    "ball_hsv": {"lower": [20, 100, 100], "upper": [35, 255, 255]},
    "red_hsv":  [{"lower": [0, 100, 80],  "upper": [10, 255, 255]},
                 {"lower": [160, 100, 80], "upper": [180, 255, 255]}],
    "blue_hsv": [{"lower": [100, 100, 80], "upper": [130, 255, 255]}],
    "scoring_zones": [],
    "robot_min_area": 500, "robot_max_area": 15000, "robot_merge_dist": 80,
    "ball_min_area": 30, "ball_max_area": 3000,
    "ball_min_circularity": 0.35,
    "trajectory_lookback": 25, "attribution_dist": 120,
}

# ─── GLOBAL STATE ─────────────────────────────────────────────────────────────

state = {
    "video_path": None, "cap": None, "fps": 30, "total_frames": 0,
    "frame_num": 0, "paused": True, "speed": 1,
    "config": DEFAULT_CONFIG.copy(),
    "scores": defaultdict(int),
    "events": [],
    "zone_cooldown": {},
    "ball_history": deque(maxlen=30),
    "robots": [],
    "current_balls": [],
    "last_frame_jpg": None,
    "running": False,
    "next_robot_id": defaultdict(int),
    "tracked_robots": {},
}
state_lock = threading.Lock()

def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH) as f:
            cfg = json.load(f)
        for k, v in DEFAULT_CONFIG.items():
            cfg.setdefault(k, v)
        return cfg
    return DEFAULT_CONFIG.copy()

def save_config(cfg):
    with open(CONFIG_PATH, 'w') as f:
        json.dump(cfg, f, indent=2)

# ─── DETECTION ────────────────────────────────────────────────────────────────

def detect_balls(frame, cfg):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    lo, hi = np.array(cfg['ball_hsv']['lower']), np.array(cfg['ball_hsv']['upper'])
    mask = cv2.inRange(hsv, lo, hi)
    k = np.ones((5,5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    balls = []
    for c in contours:
        area = cv2.contourArea(c)
        if not (cfg['ball_min_area'] < area < cfg['ball_max_area']): continue
        perim = cv2.arcLength(c, True)
        circ = 4 * np.pi * area / (perim**2 + 1e-5)
        if circ < cfg['ball_min_circularity']: continue
        (x, y), r = cv2.minEnclosingCircle(c)
        balls.append({'x': float(x), 'y': float(y), 'r': float(r)})
    return balls

def detect_raw_robots(frame, cfg):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    raw = []
    for team, key in [('red','red_hsv'), ('blue','blue_hsv')]:
        mask = None
        for r in cfg[key]:
            m = cv2.inRange(hsv, np.array(r['lower']), np.array(r['upper']))
            mask = m if mask is None else cv2.bitwise_or(mask, m)
        k = np.ones((15,15), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k)
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in contours:
            area = cv2.contourArea(c)
            if area < cfg['robot_min_area']: continue
            if area > cfg.get('robot_max_area', 15000): continue  # <-- new
            M = cv2.moments(c)
            if M['m00'] == 0: continue
            cx, cy = M['m10']/M['m00'], M['m01']/M['m00']
            raw.append((cx, cy, team, area))
    return raw

def merge_and_track_robots(raw, cfg, tracked, next_id):
    merge_dist = cfg['robot_merge_dist']
    used = set()
    merged = []
    for i, (x1,y1,t1,a1) in enumerate(raw):
        if i in used: continue
        mx,my,ma = x1,y1,a1
        for j, (x2,y2,t2,a2) in enumerate(raw):
            if j==i or j in used or t2!=t1: continue
            if np.hypot(x1-x2,y1-y2) < merge_dist:
                mx=(mx*ma+x2*a2)/(ma+a2); my=(my*ma+y2*a2)/(ma+a2); ma+=a2
                used.add(j)
        used.add(i)
        merged.append((mx,my,t1,ma))

    matched = set()
    for (dx,dy,team,area) in merged:
        best_id, best_dist = None, 100
        for rid, r in tracked.items():
            if r['team'] != team: continue
            d = np.hypot(r['x']-dx, r['y']-dy)
            if d < best_dist: best_dist=d; best_id=rid
        if best_id:
            tracked[best_id].update({'x':dx,'y':dy,'lost':0})
            tracked[best_id]['trail'].append([dx,dy])
            if len(tracked[best_id]['trail']) > 40: tracked[best_id]['trail'].pop(0)
            tracked[best_id]['frames_seen'] = tracked[best_id].get('frames_seen', 0) + 1
            matched.add(best_id)
        else:
            new_id = f"{team.upper()}_{next_id[team]}"
            next_id[team] += 1
            tracked[new_id] = {
                'id': new_id, 'team': team, 'x': dx, 'y': dy,
                'lost': 0, 'trail': [[dx,dy]],
                'spawn_x': dx, 'spawn_y': dy,   # <-- anchor point
                'frames_seen': 1, 'confirmed': False
            }
            matched.add(new_id)

    for rid in list(tracked):
        if rid not in matched:
            tracked[rid]['lost'] = tracked[rid].get('lost', 0) + 1
            if tracked[rid]['lost'] > 15:
                del tracked[rid]
        else:
            r = tracked[rid]
            if not r.get('confirmed'):
                displacement = np.hypot(
                    r['x'] - r['spawn_x'],
                    r['y'] - r['spawn_y']
                )
                if r['frames_seen'] >= 10 and displacement >= 40:
                    r['confirmed'] = True

    return [r for r in tracked.values() if r.get('confirmed')]

def check_zones(balls, zones):
    hits = []
    for b in balls:
        for z in zones:
            pts = np.array(z['polygon'], dtype=np.float32)
            if cv2.pointPolygonTest(pts, (b['x'], b['y']), False) >= 0:
                hits.append((b, z['name'], z['team']))
    return hits

def attribute_scorer(ball_pos, ball_history, robots, cfg):
    bx, by = ball_pos
    lookback = cfg['trajectory_lookback']
    attr_dist = cfg['attribution_dist']
    trajectory = [(bx,by)]
    for past in list(ball_history)[-lookback:]:
        if not past: continue
        last = trajectory[-1]
        closest = min(past, key=lambda b: np.hypot(b['x']-last[0], b['y']-last[1]))
        if np.hypot(closest['x']-last[0], closest['y']-last[1]) > 60: break
        trajectory.append((closest['x'], closest['y']))
    if len(trajectory) < 2 or not robots:
        return None, 0.0
    pts = np.array(trajectory, dtype=np.float32)
    vx,vy,ox,oy = cv2.fitLine(pts, cv2.DIST_L2, 0, 0.01, 0.01).flatten()
    origin_x = ox + vx * -lookback
    origin_y = oy + vy * -lookback
    best = min(robots, key=lambda r: np.hypot(r['x']-origin_x, r['y']-origin_y))
    dist = np.hypot(best['x']-origin_x, best['y']-origin_y)
    if dist > attr_dist:
        prox = min(robots, key=lambda r: np.hypot(r['x']-bx, r['y']-by))
        if np.hypot(prox['x']-bx, prox['y']-by) < attr_dist:
            return prox['id'], 0.35
        return None, 0.0
    return best['id'], max(0.0, 1.0 - dist/attr_dist)

# ─── VIDEO LOOP ───────────────────────────────────────────────────────────────

def render_frame(frame, balls, robots, events, scores, zone_hits, cfg):
    out = frame.copy()
    h, w = out.shape[:2]
    zones = cfg['scoring_zones']
    zone_ball_set = {id(b) for b,_,_ in zone_hits}

    # Draw zones
    for z in zones:
        pts = np.array(z['polygon'], np.int32)
        color = (0,0,200) if z['team']=='red' else (200,80,0) if z['team']=='blue' else (0,180,180)
        ov = out.copy(); cv2.fillPoly(ov,[pts],color); cv2.addWeighted(ov,0.18,out,0.82,0,out)
        cv2.polylines(out,[pts],True,color,1)
        cx = int(np.mean([p[0] for p in z['polygon']]))
        cy = int(np.mean([p[1] for p in z['polygon']]))
        cv2.putText(out, z['name'], (cx-25,cy), cv2.FONT_HERSHEY_SIMPLEX, 0.3, color, 1)

    # Draw robot trails + circles
    for r in robots:
        color = (0,0,210) if r['team']=='red' else (210,80,0)
        trail = r.get('trail',[])
        for i in range(1, min(len(trail),25)):
            pt1=(int(trail[-i-1][0]),int(trail[-i-1][1]))
            pt2=(int(trail[-i][0]),int(trail[-i][1]))
            cv2.line(out,pt1,pt2,color,1)
        cv2.circle(out,(int(r['x']),int(r['y'])),20,color,2)
        cv2.putText(out,r['id'],(int(r['x'])-16,int(r['y'])+5),cv2.FONT_HERSHEY_SIMPLEX,0.35,color,1)

    # Draw balls
    for b in balls:
        in_zone = any(abs(b['x']-zb['x'])<5 and abs(b['y']-zb['y'])<5 for zb,_,_ in zone_hits)
        color = (0,255,80) if in_zone else (0,210,210)
        cv2.circle(out,(int(b['x']),int(b['y'])),max(int(b['r']),4),color,1)

    return out

def video_loop():
    while True:
        with state_lock:
            if not state['running'] or state['paused'] or state['cap'] is None:
                time.sleep(0.033)
                continue
            cap = state['cap']
            cfg = state['config']
            fps = state['fps']
            speed = state['speed']

        ret, frame = cap.read()
        if not ret:
            with state_lock:
                state['paused'] = True
            time.sleep(0.1)
            continue

        with state_lock:
            state['frame_num'] = int(cap.get(cv2.CAP_PROP_POS_FRAMES))

        balls = detect_balls(frame, cfg)
        raw_robots = detect_raw_robots(frame, cfg)

        with state_lock:
            robots = merge_and_track_robots(raw_robots, cfg, state['tracked_robots'], state['next_robot_id'])
            state['robots'] = robots
            state['current_balls'] = balls

            zone_hits = check_zones(balls, cfg['scoring_zones'])
            ball_history = state['ball_history']

            for (ball, zone_name, zone_team) in zone_hits:
                if state['zone_cooldown'].get(zone_name, 0) > 0: continue
                state['zone_cooldown'][zone_name] = int(fps * 0.4)
                robot_id, conf = attribute_scorer((ball['x'],ball['y']), ball_history, robots, cfg)
                key_id = robot_id or 'UNKNOWN'
                state['scores'][key_id] += 1
                state['events'].append({
                    'time': round(state['frame_num']/fps, 1),
                    'zone': zone_name, 'robot': robot_id, 'confidence': round(conf,2)
                })

            for z in list(state['zone_cooldown']):
                state['zone_cooldown'][z] -= 1
                if state['zone_cooldown'][z] <= 0: del state['zone_cooldown'][z]

            state['ball_history'].append(balls)

        vis = render_frame(frame, balls, robots, state['events'], state['scores'], zone_hits, cfg)
        _, jpg = cv2.imencode('.jpg', vis, [cv2.IMWRITE_JPEG_QUALITY, 75])
        with state_lock:
            state['last_frame_jpg'] = jpg.tobytes()

        sleep = max(0, (1.0/fps) / speed - 0.005)
        time.sleep(sleep)

threading.Thread(target=video_loop, daemon=True).start()

# ─── ROUTES ───────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return HTML_PAGE

@app.route('/upload', methods=['POST'])
def upload():
    f = request.files.get('video')
    if not f: return jsonify({'error':'no file'}), 400
    path = os.path.join(UPLOAD_PATH, f.filename)
    f.save(path)
    with state_lock:
        if state['cap']: state['cap'].release()
        cap = cv2.VideoCapture(path)
        state['cap'] = cap
        state['video_path'] = path
        state['fps'] = cap.get(cv2.CAP_PROP_FPS) or 30
        state['total_frames'] = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        state['frame_num'] = 0
        state['paused'] = True
        state['scores'] = defaultdict(int)
        state['events'] = []
        state['zone_cooldown'] = {}
        state['ball_history'] = deque(maxlen=30)
        state['tracked_robots'] = {}
        state['next_robot_id'] = defaultdict(int)
        state['running'] = True
        state['config'] = load_config()
    return jsonify({'ok':True,'fps':state['fps'],'frames':state['total_frames']})

@app.route('/frame')
def frame():
    with state_lock:
        jpg = state['last_frame_jpg']
        if jpg is None and state['cap']:
            cap = state['cap']
            fn = state['frame_num']
            cap.set(cv2.CAP_PROP_POS_FRAMES, fn)
            ret, fr = cap.read()
            if ret:
                _, j = cv2.imencode('.jpg', fr, [cv2.IMWRITE_JPEG_QUALITY, 80])
                jpg = j.tobytes()
    if not jpg: return ('', 204)
    return Response(jpg, mimetype='image/jpeg',
                    headers={'Cache-Control':'no-cache','X-Frame-Num':str(state['frame_num'])})

@app.route('/control', methods=['POST'])
def control():
    d = request.json
    action = d.get('action')
    with state_lock:
        if action == 'play':   state['paused'] = False
        elif action == 'pause': state['paused'] = True
        elif action == 'seek':
            fn = int(d.get('frame', 0))
            if state['cap']:
                state['cap'].set(cv2.CAP_PROP_POS_FRAMES, fn)
                state['frame_num'] = fn
                # Grab preview frame
                ret, fr = state['cap'].read()
                if ret:
                    _, j = cv2.imencode('.jpg', fr, [cv2.IMWRITE_JPEG_QUALITY, 80])
                    state['last_frame_jpg'] = j.tobytes()
        elif action == 'speed': state['speed'] = max(0.25, min(8, float(d.get('value',1))))
    return jsonify({'ok':True})

@app.route('/status')
def status():
    with state_lock:
        return jsonify({
            'frame': state['frame_num'],
            'total': state['total_frames'],
            'fps': state['fps'],
            'paused': state['paused'],
            'speed': state['speed'],
            'scores': dict(state['scores']),
            'events': state['events'][-20:],
            'robots': [{'id':r['id'],'team':r['team'],'x':r['x'],'y':r['y']} for r in state['robots']],
            'balls': len(state['current_balls']),
        })

@app.route('/config', methods=['GET','POST'])
def config_route():
    if request.method == 'GET':
        with state_lock:
            return jsonify(state['config'])
    cfg = request.json
    with state_lock:
        state['config'] = cfg
    save_config(cfg)
    return jsonify({'ok':True})

@app.route('/frame_image')
def frame_image():
    """Return a single clean frame as base64 for zone editor."""
    t = float(request.args.get('t', 5))
    with state_lock:
        cap = state['cap']
        if not cap: return jsonify({'error':'no video'}), 400
        fps = state['fps']
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ret, fr = cap.read()
    if not ret: return jsonify({'error':'seek failed'}), 400
    _, j = cv2.imencode('.jpg', fr, [cv2.IMWRITE_JPEG_QUALITY, 85])
    b64 = base64.b64encode(j.tobytes()).decode()
    with state_lock:
        cap.set(cv2.CAP_PROP_POS_FRAMES, state['frame_num'])
    return jsonify({'image': b64, 'width': fr.shape[1], 'height': fr.shape[0]})

@app.route('/reset_scores', methods=['POST'])
def reset_scores():
    with state_lock:
        state['scores'] = defaultdict(int)
        state['events'] = []
    return jsonify({'ok':True})

# ─── HTML ─────────────────────────────────────────────────────────────────────

HTML_PAGE = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FRC Scout</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Barlow+Condensed:wght@400;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#0d0f12;--surface:#161920;--surface2:#1e2330;--border:#2a2f3d;
    --red:#e84444;--blue:#4488ff;--yellow:#f5c842;--green:#3ddc84;
    --text:#e8eaf0;--muted:#6b7280;--accent:#f5c842;
  }
  body{background:var(--bg);color:var(--text);font-family:'Barlow Condensed',sans-serif;height:100vh;display:flex;flex-direction:column;overflow:hidden}
  header{display:flex;align-items:center;gap:16px;padding:10px 20px;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0}
  header h1{font-size:22px;font-weight:700;letter-spacing:2px;color:var(--accent)}
  header span{font-size:12px;color:var(--muted);font-family:'DM Mono',monospace}
  .main{display:grid;grid-template-columns:1fr 300px;flex:1;overflow:hidden}
  .left{display:flex;flex-direction:column;overflow:hidden}
  .video-area{position:relative;flex:1;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden}
  #videoImg{max-width:100%;max-height:100%;display:block;image-rendering:crisp-edges}
  .drop-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;border:2px dashed var(--border);cursor:pointer;transition:.2s}
  .drop-overlay:hover{border-color:var(--accent);background:rgba(245,200,66,.04)}
  .drop-overlay .icon{font-size:48px;opacity:.4}
  .drop-overlay p{color:var(--muted);font-size:16px;letter-spacing:1px}
  .drop-overlay small{color:var(--border);font-family:'DM Mono',monospace;font-size:11px}
  #fileInput{display:none}

  /* Controls */
  .controls{background:var(--surface);border-top:1px solid var(--border);padding:10px 16px;flex-shrink:0}
  .scrub-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  #scrubber{flex:1;-webkit-appearance:none;height:4px;background:var(--border);border-radius:2px;outline:none;cursor:pointer}
  #scrubber::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--accent);cursor:pointer}
  .timecode{font-family:'DM Mono',monospace;font-size:12px;color:var(--muted);min-width:90px;text-align:right}
  .btn-row{display:flex;align-items:center;gap:8px}
  button{background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:6px 14px;border-radius:4px;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-size:14px;letter-spacing:.5px;transition:.15s}
  button:hover{border-color:var(--accent);color:var(--accent)}
  button.active{background:var(--accent);color:#000;border-color:var(--accent)}
  .speed-badge{background:var(--surface2);border:1px solid var(--border);padding:4px 10px;border-radius:4px;font-family:'DM Mono',monospace;font-size:13px;color:var(--accent);min-width:50px;text-align:center}

  /* Right panel */
  .right{background:var(--surface);border-left:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
  .tabs{display:flex;border-bottom:1px solid var(--border);flex-shrink:0}
  .tab{flex:1;padding:10px;text-align:center;font-size:13px;letter-spacing:1px;cursor:pointer;color:var(--muted);border-bottom:2px solid transparent;transition:.15s}
  .tab.active{color:var(--accent);border-bottom-color:var(--accent)}
  .panel{flex:1;overflow-y:auto;padding:14px;display:none}
  .panel.active{display:block}

  /* Scores */
  .score-card{background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:8px}
  .score-card .robot-id{font-size:18px;font-weight:700;letter-spacing:1px}
  .score-card.red .robot-id{color:var(--red)}
  .score-card.blue .robot-id{color:var(--blue)}
  .score-card .count{font-size:36px;font-weight:700;line-height:1;color:var(--text)}
  .score-card .sub{font-size:11px;color:var(--muted);font-family:'DM Mono',monospace}
  .scores-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}

  /* Events */
  .event{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;font-family:'DM Mono',monospace}
  .event .t{color:var(--muted);min-width:44px}
  .event .robot{min-width:70px}
  .event.red .robot{color:var(--red)}
  .event.blue .robot{color:var(--blue)}
  .event .conf{color:var(--muted);margin-left:auto}
  .conf.hi{color:var(--green)} .conf.mid{color:var(--yellow)} .conf.lo{color:var(--muted)}

  /* Zones editor */
  #zoneCanvas{width:100%;border:1px solid var(--border);border-radius:4px;cursor:crosshair;display:block}
  .zone-controls{display:flex;flex-direction:column;gap:8px;margin-top:10px}
  .zone-form{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  input,select{background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:4px;font-family:'DM Mono',monospace;font-size:13px;width:100%}
  input:focus,select:focus{outline:none;border-color:var(--accent)}
  .zone-list{margin-top:10px}
  .zone-item{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px}
  .zone-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
  .zone-item .del{margin-left:auto;cursor:pointer;color:var(--muted);font-size:16px;line-height:1}
  .zone-item .del:hover{color:var(--red)}
  .label{font-size:11px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px}

  /* HSV tuner */
  .hsv-group{margin-bottom:14px}
  .hsv-group h4{font-size:13px;letter-spacing:1px;margin-bottom:8px;color:var(--accent)}
  .hsv-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px}
  .hsv-row label{min-width:50px;color:var(--muted);font-family:'DM Mono',monospace}
  .hsv-row input[type=range]{flex:1;height:4px;-webkit-appearance:none;border-radius:2px;background:var(--border)}
  .hsv-row input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:var(--accent)}
  .hsv-row .val{min-width:28px;text-align:right;font-family:'DM Mono',monospace;color:var(--text)}
  .preview-dot{width:24px;height:24px;border-radius:50%;border:1px solid var(--border);flex-shrink:0}

  /* Status bar */
  .statusbar{padding:4px 16px;background:var(--surface);border-top:1px solid var(--border);font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);display:flex;gap:16px;flex-shrink:0}
  .statusbar span{display:flex;gap:4px;align-items:center}
  .dot{width:7px;height:7px;border-radius:50%;background:var(--muted)}
  .dot.live{background:var(--green);animation:pulse 1.5s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
</style>
</head>
<body>
<header>
  <h1>FRC SCOUT</h1>
  <span id="headerStatus">NO VIDEO LOADED</span>
  <div style="margin-left:auto;display:flex;gap:8px">
    <button onclick="resetScores()">RESET SCORES</button>
    <button onclick="exportResults()">EXPORT JSON</button>
  </div>
</header>

<div class="main">
  <div class="left">
    <div class="video-area" id="videoArea">
      <div class="drop-overlay" id="dropOverlay" onclick="document.getElementById('fileInput').click()">
        <div class="icon">▶</div>
        <p>DROP VIDEO OR CLICK TO LOAD</p>
        <small>mp4, avi, mov supported</small>
      </div>
      <img id="videoImg" style="display:none" alt="video frame">
      <input type="file" id="fileInput" accept="video/*" onchange="uploadVideo(this)">
    </div>

    <div class="controls">
      <div class="scrub-row">
        <input type="range" id="scrubber" min="0" max="1000" value="0" oninput="onScrub(this)">
        <span class="timecode" id="timecode">0:00 / 0:00</span>
      </div>
      <div class="btn-row">
        <button id="playBtn" onclick="togglePlay()">▶ PLAY</button>
        <button onclick="skip(-150)">◀◀ 5s</button>
        <button onclick="skip(150)">5s ▶▶</button>
        <span style="flex:1"></span>
        <button onclick="changeSpeed(-1)">−</button>
        <span class="speed-badge" id="speedBadge">1×</span>
        <button onclick="changeSpeed(1)">+</button>
      </div>
    </div>
    <div class="statusbar">
      <span><div class="dot" id="liveDot"></div> <span id="statusText">idle</span></span>
      <span>🟡 balls: <b id="ballCount">0</b></span>
      <span>🔴 red robots: <b id="redCount">0</b></span>
      <span>🔵 blue robots: <b id="blueCount">0</b></span>
    </div>
  </div>

  <div class="right">
    <div class="tabs">
      <div class="tab active" onclick="showTab('scores')">SCORES</div>
      <div class="tab" onclick="showTab('events')">EVENTS</div>
      <div class="tab" onclick="showTab('zones')">ZONES</div>
      <div class="tab" onclick="showTab('hsv')">COLORS</div>
    </div>

    <!-- SCORES -->
    <div class="panel active" id="panel-scores">
      <div id="scoresGrid" class="scores-grid"></div>
    </div>

    <!-- EVENTS -->
    <div class="panel" id="panel-events">
      <div id="eventsList"></div>
    </div>

    <!-- ZONES -->
    <div class="panel" id="panel-zones">
      <div class="label">CLICK TO DRAW ZONE POLYGON — RIGHT CLICK TO FINISH</div>
      <canvas id="zoneCanvas" height="200"></canvas>
      <div class="zone-controls">
        <div class="zone-form">
          <div>
            <div class="label">NAME</div>
            <input id="zoneName" placeholder="speaker_red">
          </div>
          <div>
            <div class="label">TEAM</div>
            <select id="zoneTeam">
              <option value="red">Red</option>
              <option value="blue">Blue</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>
        </div>
        <button onclick="finishZone()">ADD ZONE</button>
        <div>
          <div class="label">PREVIEW FRAME (seconds)</div>
          <div style="display:flex;gap:6px">
            <input id="frameTime" type="number" value="5" min="0" step="5" style="width:80px">
            <button onclick="loadZoneFrame()">LOAD</button>
          </div>
        </div>
        <div class="zone-list" id="zoneList"></div>
        <button onclick="saveZones()" class="active">SAVE ZONES</button>
      </div>
    </div>

    <!-- HSV COLORS -->
    <div class="panel" id="panel-hsv">
      <div class="hsv-group">
        <h4>🟡 YELLOW BALLS</h4>
        <div id="hsv-ball"></div>
      </div>
      <div class="hsv-group">
        <h4>🔴 RED ROBOTS</h4>
        <div id="hsv-red"></div>
      </div>
      <div class="hsv-group">
        <h4>🔵 BLUE ROBOTS</h4>
        <div id="hsv-blue"></div>
      </div>
      <button onclick="saveHSV()" class="active">SAVE COLORS</button>
    </div>
  </div>
</div>

<script>
let playing = false, totalFrames = 1, fps = 30, speed = 1;
let scrubbing = false, lastEventCount = 0;
let cfg = {};
let zonePoints = [], zoneFrameImg = null, zoneCanvasScale = {x:1,y:1};

// ── VIDEO ──────────────────────────────────────────────────────────────────
async function uploadVideo(input) {
  const file = input.files[0]; if(!file) return;
  document.getElementById('headerStatus').textContent = 'UPLOADING...';
  const fd = new FormData(); fd.append('video', file);
  const r = await fetch('/upload', {method:'POST', body:fd});
  const d = await r.json();
  fps = d.fps; totalFrames = d.frames;
  document.getElementById('scrubber').max = totalFrames;
  document.getElementById('dropOverlay').style.display = 'none';
  document.getElementById('videoImg').style.display = 'block';
  document.getElementById('headerStatus').textContent = file.name + ' — ' + Math.round(totalFrames/fps) + 's';
  loadZoneFrame();
  cfg = await (await fetch('/config')).json();
  buildHSV();
  renderZoneList();
  startPolling();
}

function togglePlay() {
  playing = !playing;
  fetch('/control', {method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({action: playing ? 'play' : 'pause'})});
  document.getElementById('playBtn').textContent = playing ? '⏸ PAUSE' : '▶ PLAY';
  document.getElementById('liveDot').className = 'dot' + (playing ? ' live' : '');
}

function skip(frames) {
  const cur = parseInt(document.getElementById('scrubber').value);
  const target = Math.max(0, Math.min(totalFrames, cur + frames));
  document.getElementById('scrubber').value = target;
  fetch('/control', {method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({action:'seek', frame: target})});
}

function onScrub(el) {
  scrubbing = true;
  fetch('/control', {method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({action:'seek', frame: parseInt(el.value)})});
  setTimeout(()=>scrubbing=false, 200);
}

function changeSpeed(dir) {
  const steps = [0.25,0.5,1,2,4,8];
  let i = steps.indexOf(speed);
  i = Math.max(0, Math.min(steps.length-1, i+dir));
  speed = steps[i];
  document.getElementById('speedBadge').textContent = speed+'×';
  fetch('/control', {method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({action:'speed', value: speed})});
}

function fmtTime(frames) {
  const s = Math.floor(frames/fps);
  return Math.floor(s/60)+':'+(s%60).toString().padStart(2,'0');
}

// ── POLLING ────────────────────────────────────────────────────────────────
function startPolling() {
  setInterval(async ()=>{
    // Fetch latest processed frame
    if(!scrubbing) {
      const img = document.getElementById('videoImg');
      img.src = '/frame?t=' + Date.now();
    }
    // Fetch status
    const s = await (await fetch('/status')).json();
    if(!scrubbing) {
      document.getElementById('scrubber').value = s.frame;
      document.getElementById('timecode').textContent = fmtTime(s.frame)+' / '+fmtTime(s.total);
    }
    document.getElementById('statusText').textContent = s.paused ? 'paused' : 'running';
    document.getElementById('ballCount').textContent = s.balls;
    const reds = s.robots.filter(r=>r.team==='red').length;
    const blues = s.robots.filter(r=>r.team==='blue').length;
    document.getElementById('redCount').textContent = reds;
    document.getElementById('blueCount').textContent = blues;
    renderScores(s.scores);
    if(s.events.length !== lastEventCount) { renderEvents(s.events); lastEventCount = s.events.length; }
  }, 100);
}

// ── SCORES ─────────────────────────────────────────────────────────────────
function renderScores(scores) {
  const el = document.getElementById('scoresGrid');
  if(!Object.keys(scores).length) { el.innerHTML='<div style="color:var(--muted);font-size:13px;grid-column:1/-1;padding:20px 0;text-align:center">No scores yet</div>'; return; }
  const sorted = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  el.innerHTML = sorted.map(([id,cnt])=>{
    const team = id.includes('RED')?'red':id.includes('BLUE')?'blue':'';
    return `<div class="score-card ${team}">
      <div class="robot-id">${id}</div>
      <div class="count">${cnt}</div>
      <div class="sub">balls scored</div>
    </div>`;
  }).join('');
}

// ── EVENTS ─────────────────────────────────────────────────────────────────
function renderEvents(events) {
  const el = document.getElementById('eventsList');
  el.innerHTML = [...events].reverse().map(e=>{
    const team = e.robot?.includes('RED')?'red':e.robot?.includes('BLUE')?'blue':'';
    const confClass = e.confidence>0.6?'hi':e.confidence>0.3?'mid':'lo';
    return `<div class="event ${team}">
      <span class="t">${e.time}s</span>
      <span class="robot">${e.robot||'???'}</span>
      <span class="zone" style="color:var(--muted);font-size:11px">${e.zone}</span>
      <span class="conf ${confClass}">${Math.round(e.confidence*100)}%</span>
    </div>`;
  }).join('');
}

// ── ZONES ──────────────────────────────────────────────────────────────────
const canvas = document.getElementById('zoneCanvas');
const ctx = canvas.getContext('2d');

async function loadZoneFrame() {
  const t = parseFloat(document.getElementById('frameTime').value)||5;
  const r = await (await fetch('/frame_image?t='+t)).json();
  if(r.error) return;
  const img = new Image();
  img.onload = ()=>{
    zoneFrameImg = img;
    canvas.width = img.width; canvas.height = img.height;
    canvas.style.maxHeight = '200px';
    zoneCanvasScale.x = img.width / canvas.getBoundingClientRect().width;
    zoneCanvasScale.y = img.height / canvas.getBoundingClientRect().height;
    drawZoneCanvas();
  };
  img.src = 'data:image/jpeg;base64,'+r.image;
}

canvas.addEventListener('click', e=>{
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  zonePoints.push([Math.round((e.clientX-rect.left)*scaleX), Math.round((e.clientY-rect.top)*scaleY)]);
  drawZoneCanvas();
});
canvas.addEventListener('contextmenu', e=>{ e.preventDefault(); if(zonePoints.length>2) finishZone(); });

function drawZoneCanvas() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(zoneFrameImg) ctx.drawImage(zoneFrameImg,0,0);
  // Existing zones
  (cfg.scoring_zones||[]).forEach(z=>{
    ctx.beginPath();
    z.polygon.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.closePath();
    ctx.fillStyle = z.team==='red'?'rgba(232,68,68,.25)':z.team==='blue'?'rgba(68,136,255,.25)':'rgba(0,180,180,.25)';
    ctx.strokeStyle = z.team==='red'?'#e84444':z.team==='blue'?'#4488ff':'#00b4b4';
    ctx.lineWidth=2; ctx.fill(); ctx.stroke();
    if(z.polygon.length>0){
      const cx=z.polygon.reduce((s,p)=>s+p[0],0)/z.polygon.length;
      const cy=z.polygon.reduce((s,p)=>s+p[1],0)/z.polygon.length;
      ctx.fillStyle='#fff'; ctx.font='11px DM Mono,monospace';
      ctx.textAlign='center'; ctx.fillText(z.name,cx,cy);
    }
  });
  // Current drawing
  if(zonePoints.length) {
    ctx.beginPath();
    zonePoints.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.strokeStyle='#f5c842'; ctx.lineWidth=2; ctx.setLineDash([4,4]); ctx.stroke();
    ctx.setLineDash([]);
    zonePoints.forEach(([x,y])=>{
      ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2);
      ctx.fillStyle='#f5c842'; ctx.fill();
    });
  }
}

function finishZone() {
  if(zonePoints.length < 3) return;
  const name = document.getElementById('zoneName').value || ('zone_'+Date.now());
  const team = document.getElementById('zoneTeam').value;
  cfg.scoring_zones = cfg.scoring_zones||[];
  cfg.scoring_zones.push({name, team, polygon: [...zonePoints]});
  zonePoints = [];
  renderZoneList(); drawZoneCanvas();
}

function renderZoneList() {
  const el = document.getElementById('zoneList');
  el.innerHTML = (cfg.scoring_zones||[]).map((z,i)=>`
    <div class="zone-item">
      <div class="zone-dot" style="background:${z.team==='red'?'#e84444':z.team==='blue'?'#4488ff':'#00b4b4'}"></div>
      <span>${z.name}</span><span style="color:var(--muted);font-size:11px;margin-left:4px">${z.team}</span>
      <span class="del" onclick="deleteZone(${i})">×</span>
    </div>`).join('');
}

function deleteZone(i) {
  cfg.scoring_zones.splice(i,1);
  renderZoneList(); drawZoneCanvas();
}

async function saveZones() {
  await fetch('/config', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(cfg)});
  const btn = event.target; btn.textContent='SAVED ✓';
  setTimeout(()=>btn.textContent='SAVE ZONES',1500);
}

// ── HSV ────────────────────────────────────────────────────────────────────
function buildHSV() {
  buildHSVGroup('hsv-ball', 'ball_hsv', cfg.ball_hsv);
  buildHSVGroup('hsv-red', 'red_hsv_0', cfg.red_hsv?.[0]);
  buildHSVGroup('hsv-blue', 'blue_hsv_0', cfg.blue_hsv?.[0]);
}

function buildHSVGroup(containerId, key, hsv) {
  if(!hsv) return;
  const el = document.getElementById(containerId);
  const channels = ['H','S','V'];
  const maxV = [180,255,255];
  let html = '';
  channels.forEach((ch,i)=>{
    html += `<div class="hsv-row">
      <label>${ch} min</label>
      <input type="range" min="0" max="${maxV[i]}" value="${hsv.lower[i]}"
        oninput="updateHSV('${key}','lower',${i},this.value);this.nextElementSibling.textContent=this.value">
      <span class="val">${hsv.lower[i]}</span>
    </div>
    <div class="hsv-row">
      <label>${ch} max</label>
      <input type="range" min="0" max="${maxV[i]}" value="${hsv.upper[i]}"
        oninput="updateHSV('${key}','upper',${i},this.value);this.nextElementSibling.textContent=this.value">
      <span class="val">${hsv.upper[i]}</span>
    </div>`;
  });
  el.innerHTML = html;
}

function updateHSV(key, bound, idx, val) {
  val = parseInt(val);
  if(key==='ball_hsv') cfg.ball_hsv[bound][idx] = val;
  else if(key==='red_hsv_0') cfg.red_hsv[0][bound][idx] = val;
  else if(key==='blue_hsv_0') cfg.blue_hsv[0][bound][idx] = val;
}

async function saveHSV() {
  await fetch('/config', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(cfg)});
  const btn = event.target; btn.textContent='SAVED ✓';
  setTimeout(()=>btn.textContent='SAVE COLORS',1500);
}

// ── UTILS ──────────────────────────────────────────────────────────────────
function showTab(name) {
  document.querySelectorAll('.tab').forEach((t,i)=>{
    const tabs=['scores','events','zones','hsv'];
    t.className='tab'+(tabs[i]===name?' active':'');
  });
  document.querySelectorAll('.panel').forEach(p=>p.className='panel');
  document.getElementById('panel-'+name).className='panel active';
}

async function resetScores() {
  await fetch('/reset_scores', {method:'POST'});
}

async function exportResults() {
  const s = await (await fetch('/status')).json();
  const blob = new Blob([JSON.stringify({scores:s.scores,events:s.events},null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='frc_results.json'; a.click();
}

// Keyboard shortcuts
document.addEventListener('keydown', e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT') return;
  if(e.code==='Space'){e.preventDefault();togglePlay();}
  if(e.code==='ArrowLeft') skip(-150);
  if(e.code==='ArrowRight') skip(150);
  if(e.key==='+') changeSpeed(1);
  if(e.key==='-') changeSpeed(-1);
});

// Drag and drop
const area = document.getElementById('videoArea');
area.addEventListener('dragover', e=>{e.preventDefault(); e.dataTransfer.dropEffect='copy';});
area.addEventListener('drop', e=>{
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if(file && file.type.startsWith('video/')) {
    const dt = new DataTransfer(); dt.items.add(file);
    const inp = document.getElementById('fileInput'); inp.files = dt.files;
    uploadVideo(inp);
  }
});
</script>
</body>
</html>'''

if __name__ == '__main__':
    state['config'] = load_config()
    print("FRC Scout running at http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)