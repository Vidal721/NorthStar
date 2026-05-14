"""
bumper_detector.py  —  FRC Robot Tracker with Claude Vision Bumper ID
======================================================================

Key design:
  • Every frame: darken the full image, then draw bright bounding boxes
    around each detected robot — nothing else is bright.
  • Each robot crop is sent to Claude Vision (claude-sonnet-4-20250514) to
    read the bumper number.  Calls are rate-limited to once every N frames
    per robot so the API isn't hammered.
  • Global registry: max 6 robots.  Identity is first established by bumper
    number (1-9999); if no number is readable the robot gets an auto-ID
    (A, B, C …).  When a new detection doesn't match any live robot by
    position+appearance AND we're under the cap, a new slot is created.
  • Across frames, robots are matched with Hungarian assignment using a
    combined spatial + visual-embedding cost (same as before, but simplified
    and documented).

Controls
--------
  Q          quit
  Space      pause / resume
  C          clear all tracks
  P          print registry summary to console

Requirements
------------
  pip install opencv-python ultralytics filterpy scipy anthropic numpy
  export ANTHROPIC_API_KEY=sk-ant-...
"""

import os
import cv2
import time
import base64
import threading
import numpy as np
from ultralytics import YOLO
from filterpy.kalman import KalmanFilter
from scipy.optimize import linear_sum_assignment
from collections import deque
'''import anthropic'''

# ──────────────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────────────
MODEL_PATH  = "best.pt"
VIDEO_PATH  = "video.mp4"

CONF        = 0.15
MAX_DET     = 12
MIN_HITS    = 3        # frames before a new track is "confirmed"
MAX_MISSING = 45       # frames a confirmed robot can be invisible before removal
MAX_ROBOTS  = 6        # hard cap — FRC has exactly 6

MATCH_DISTANCE = 100   # spatial gate (pixels at native resolution)
SPATIAL_GATE   = MATCH_DISTANCE * 2.0

# Cost matrix weights (distance + appearance; must sum to 1.0)
COST_DIST_W = 0.35
COST_EMB_W  = 0.65

# Embedding EMA
EMBED_DIM        = 48
EMB_EMA_ALPHA    = 0.10
EMB_UPDATE_MINSIM = 0.72

# Re-ID (after full loss)
REID_MIN_OBS   = 5
REID_ACCEPT    = 0.45

# Claude Vision bumper-read rate limiting
VISION_INTERVAL_FRAMES = 15   # query Claude every N frames per robot
VISION_TIMEOUT_SEC     = 3.0  # max wait for API response

# Display
DISPLAY_H     = 720
DARKEN_ALPHA  = 0.82   # how much to darken the background (0=black, 1=unchanged)
BOX_THICKNESS = 2

# Alliance HSV ranges
ALLIANCE_HSV = {
    "red":  [(0,   100,  80), (10,  255, 255)],
    "red2": [(160, 100,  80), (180, 255, 255)],
    "blue": [(100, 100,  60), (130, 255, 255)],
}

# ──────────────────────────────────────────────────────────────
# GLOBALS
# ──────────────────────────────────────────────────────────────
_next_auto_id  = 0         # counter for auto-IDs (A, B, C …)
frame_count    = 0
robots         = {}        # {internal_int_id: RobotTrack}
portfolio_reg  = {}        # {internal_int_id: RobotPortfolio}  — persists after loss
_next_track_id = 1

paused = False

anthropic_client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

# ──────────────────────────────────────────────────────────────
# AUTO-ID GENERATOR
# ──────────────────────────────────────────────────────────────
def _next_auto_label() -> str:
    global _next_auto_id
    label = chr(ord('A') + _next_auto_id % 26)
    _next_auto_id += 1
    return label


# ──────────────────────────────────────────────────────────────
# CLAUDE VISION — BUMPER NUMBER READER
# ──────────────────────────────────────────────────────────────
def _encode_crop(crop: np.ndarray) -> str:
    """Encode a BGR crop as base64 JPEG."""
    _, buf = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return base64.standard_b64encode(buf).decode("utf-8")


def read_bumper_number_async(crop: np.ndarray, callback):
    """
    Fire-and-forget: ask Claude Vision to read the bumper number on the robot.
    `callback(number_str_or_None)` is called from a background thread when done.
    number_str_or_None is e.g. "1234" or None if unreadable.
    """
    def _run():
        try:
            b64 = _encode_crop(crop)
            resp = anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=64,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type":       "base64",
                                "media_type": "image/jpeg",
                                "data":       b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": (
                                "This is a cropped image of an FRC (FIRST Robotics Competition) robot. "
                                "Look for a bumper number — a 1-4 digit team number printed or displayed "
                                "on the robot's foam bumpers (usually around the perimeter). "
                                "If you can read a bumper number, reply with ONLY that number and nothing else. "
                                "If you cannot clearly see a bumper number, reply with exactly: NONE"
                            ),
                        },
                    ],
                }],
            )
            text = resp.content[0].text.strip().upper()
            if text == "NONE" or not text.isdigit():
                callback(None)
            else:
                callback(text)
        except Exception as e:
            print(f"[Vision] error: {e}")
            callback(None)

    t = threading.Thread(target=_run, daemon=True)
    t.start()


# ──────────────────────────────────────────────────────────────
# VISUAL EMBEDDING
# ──────────────────────────────────────────────────────────────
def extract_embedding(frame: np.ndarray, x1, y1, x2, y2) -> np.ndarray | None:
    """
    48-d descriptor: HSV histogram (32-d) + gradient orientation (8-d) + texture (8-d).
    L2-normalised so cosine_sim == dot product.
    """
    ix1 = max(0, int(x1)); iy1 = max(0, int(y1))
    ix2 = min(frame.shape[1]-1, int(x2)); iy2 = min(frame.shape[0]-1, int(y2))
    if ix2-ix1 < 8 or iy2-iy1 < 8:
        return None

    crop = cv2.resize(frame[iy1:iy2, ix1:ix2], (32, 32))
    hsv  = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)

    def nhist(ch, bins, rng):
        h = cv2.calcHist([hsv], [ch], None, [bins], rng).flatten()
        s = h.sum(); return h/s if s > 0 else h

    colour = np.concatenate([nhist(0,16,[0,180]), nhist(1,8,[0,256]), nhist(2,8,[0,256])])

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY).astype(np.float32)
    gx   = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy   = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag  = np.hypot(gx, gy)
    ang  = (np.arctan2(gy, gx) + np.pi) / (2*np.pi)
    grad = np.array([mag[(ang>=i/8)&(ang<(i+1)/8)].sum() for i in range(8)], np.float32)
    s = grad.sum(); grad = grad/s if s > 0 else grad

    tex = []
    for qy in range(2):
        for qx in range(2):
            q = gray[qy*16:(qy+1)*16, qx*16:(qx+1)*16]
            tex += [float(np.var(q)), float(np.mean(q)/255.0)]
    tex = np.array(tex, np.float32)
    s = tex.sum(); tex = tex/s if s > 0 else tex

    vec  = np.concatenate([colour, grad, tex])[:EMBED_DIM]
    norm = np.linalg.norm(vec)
    return vec/norm if norm > 1e-8 else vec


def cosine_sim(a, b) -> float:
    return float(np.clip(np.dot(a, b), 0.0, 1.0))


# ──────────────────────────────────────────────────────────────
# ALLIANCE DETECTOR
# ──────────────────────────────────────────────────────────────
def detect_alliance(frame, x1, y1, x2, y2) -> str:
    ix1 = max(0, int(x1)); iy1 = max(0, int(y1))
    ix2 = min(frame.shape[1]-1, int(x2)); iy2 = min(frame.shape[0]-1, int(y2))
    if ix2-ix1 < 6 or iy2-iy1 < 6:
        return "unknown"
    h = iy2-iy1

    def vote(crop):
        if crop.size == 0: return "unknown", 0.0
        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        sat = (hsv[:,:,1] > 80).astype(np.uint8)
        tot = max(1, int(sat.sum()))
        def px(lo, hi):
            return int((cv2.inRange(hsv, np.array(lo,np.uint8), np.array(hi,np.uint8))//255*sat).sum())
        r = (px(*ALLIANCE_HSV["red"]) + px(*ALLIANCE_HSV["red2"])) / tot
        b = px(*ALLIANCE_HSV["blue"]) / tot
        if r > b and r > 0.25: return "red",  r
        if b > r and b > 0.25: return "blue", b
        return "unknown", max(r, b)

    r1, c1 = vote(frame[iy1+int(h*0.60):iy2,              ix1:ix2])
    r2, c2 = vote(frame[iy1+int(h*0.45):iy1+int(h*0.62), ix1:ix2])

    if r1 == r2 and r1 != "unknown": return r1
    if r1 != "unknown" and c1 > 0.40: return r1
    if r2 != "unknown" and c2 > 0.40: return r2
    return "unknown"


# ──────────────────────────────────────────────────────────────
# ROBOT PORTFOLIO  (persistent identity)
# ──────────────────────────────────────────────────────────────
class RobotPortfolio:
    """
    Persistent identity record for one robot.
    Survives disappearance; used for re-ID.

    display_id  — what we show on screen:
                  a bumper number string like "1234" if known,
                  else an auto-label like "A", "B" …
    """
    def __init__(self, track_id: int):
        self.track_id            = track_id
        self.display_id: str     = _next_auto_label()   # overwritten when bumper is read
        self.bumper_number: str | None = None           # e.g. "1234"

        self.confirmed_embedding = None
        self._alliances          = deque(maxlen=30)
        self.observation_count   = 0
        self.snapshot            = None   # frozen when robot goes missing

        # Vision query rate-limiting
        self._last_vision_frame  = -VISION_INTERVAL_FRAMES  # force first query immediately
        self._vision_pending     = False

    # ── bumper number ──────────────────────────────────────────
    def register_bumper(self, number: str | None):
        """Called from the background vision thread via callback."""
        if number is None:
            return
        if self.bumper_number == number:
            return  # already known, nothing to do
        # New or changed number — check for conflicts
        existing = [p for p in portfolio_reg.values()
                    if p is not self and p.bumper_number == number]
        if existing:
            # Merge: point the old track's display_id to the one that already has it
            # (keep the richer embedding — whichever has more obs)
            winner = max(existing, key=lambda p: p.observation_count)
            print(f"[Registry] Bumper #{number} conflict: "
                  f"track {self.track_id} vs {winner.track_id} — "
                  f"keeping track {winner.track_id}")
            return
        self.bumper_number = number
        self.display_id    = number
        print(f"[Registry] Track {self.track_id} → bumper #{number}")

    def request_vision_if_due(self, frame: np.ndarray, x1, y1, x2, y2):
        """Queue a Claude Vision call if enough frames have passed."""
        if self._vision_pending:
            return
        if frame_count - self._last_vision_frame < VISION_INTERVAL_FRAMES:
            return
        # Extract crop from the ORIGINAL (undarkened) frame
        ix1 = max(0, int(x1)); iy1 = max(0, int(y1))
        ix2 = min(frame.shape[1]-1, int(x2)); iy2 = min(frame.shape[0]-1, int(y2))
        if ix2-ix1 < 20 or iy2-iy1 < 20:
            return
        crop = frame[iy1:iy2, ix1:ix2].copy()
        self._vision_pending    = True
        self._last_vision_frame = frame_count

        def _cb(number):
            self.register_bumper(number)
            self._vision_pending = False

        read_bumper_number_async(crop, _cb)

    # ── appearance embedding ───────────────────────────────────
    def feed(self, frame, x1, y1, x2, y2):
        emb = extract_embedding(frame, x1, y1, x2, y2)
        if emb is not None:
            self._update_embedding(emb)
        self._alliances.append(detect_alliance(frame, x1, y1, x2, y2))
        self.observation_count += 1

    def _update_embedding(self, emb):
        if self.confirmed_embedding is None:
            self.confirmed_embedding = emb.copy(); return
        sim = cosine_sim(emb, self.confirmed_embedding)
        if sim >= EMB_UPDATE_MINSIM:
            self.confirmed_embedding = ((1-EMB_EMA_ALPHA)*self.confirmed_embedding
                                        + EMB_EMA_ALPHA*emb)
            norm = np.linalg.norm(self.confirmed_embedding)
            if norm > 1e-8: self.confirmed_embedding /= norm

    def get_alliance(self) -> str:
        votes = list(self._alliances)
        if not votes: return "unknown"
        for label in ("red", "blue"):
            if votes.count(label) > len(votes)*0.4: return label
        return "unknown"

    def freeze(self, pos, vel, fno):
        self.snapshot = {
            "embedding":  self.confirmed_embedding.copy() if self.confirmed_embedding is not None else None,
            "alliance":   self.get_alliance(),
            "last_pos":   pos,
            "last_vel":   vel,
            "last_frame": fno,
            "obs":        self.observation_count,
        }

    def summary(self) -> str:
        return (f"  Track {self.track_id} | display={self.display_id} | "
                f"bumper={self.bumper_number} | alliance={self.get_alliance()} | "
                f"obs={self.observation_count}")


# ──────────────────────────────────────────────────────────────
# ROBOT TRACK  (live Kalman state)
# ──────────────────────────────────────────────────────────────
class RobotTrack:
    def __init__(self, track_id: int, x: float, y: float, color: tuple):
        self.id             = track_id
        self.color          = color
        self.missing_frames = 0
        self.visible        = True
        self.hit_count      = 0
        self.confirmed      = False
        self.reid_flash     = 0
        self.trail: list    = []

        self.kf   = KalmanFilter(dim_x=4, dim_z=2)
        dt        = 1.0
        self.kf.F = np.array([[1,0,dt,0],[0,1,0,dt],[0,0,1,0],[0,0,0,1]], float)
        self.kf.H = np.array([[1,0,0,0],[0,1,0,0]], float)
        self.kf.P *= 100; self.kf.R *= 5; self.kf.Q *= 0.1
        self.kf.x = np.array([x, y, 0, 0], float).reshape(4, 1)

        if track_id not in portfolio_reg:
            portfolio_reg[track_id] = RobotPortfolio(track_id)
        self.portfolio: RobotPortfolio = portfolio_reg[track_id]

    def predict(self):
        self.kf.predict()

    def update(self, x, y):
        self.kf.update(np.array([x, y], float))
        self.missing_frames = 0
        self.visible        = True
        self.hit_count     += 1
        if self.hit_count >= MIN_HITS:
            self.confirmed = True
        if self.reid_flash > 0:
            self.reid_flash -= 1

    def feed_portfolio(self, frame, x1, y1, x2, y2):
        if not self.confirmed: return
        self.portfolio.feed(frame, x1, y1, x2, y2)
        self.portfolio.request_vision_if_due(frame, x1, y1, x2, y2)

    def freeze_portfolio(self):
        vx, vy = self.get_vel()
        self.portfolio.freeze(self.get_pos(), (vx, vy), frame_count)

    def get_pos(self):
        return int(self.kf.x[0,0]), int(self.kf.x[1,0])

    def get_vel(self):
        return float(self.kf.x[2,0]), float(self.kf.x[3,0])

    def confidence(self):
        return max(0.0, 1.0 - self.missing_frames/MAX_MISSING)


# ──────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────
def id_color(tid: int) -> tuple:
    np.random.seed(int(tid)*137 + 42)
    return tuple(int(c) for c in np.random.randint(100, 255, 3))


def draw_trail(img, trail, color, ghost=False):
    if len(trail) < 2: return
    for i in range(1, len(trail)):
        a = i/len(trail)
        c = tuple(int(v*(0.35 if ghost else 1.0)*a) for v in color)
        cv2.line(img, trail[i-1], trail[i], c, max(1, int(2*a)))


def draw_velocity_arrow(img, x, y, vx, vy, color, scale=4.0):
    if np.hypot(vx, vy) < 0.5: return
    cv2.arrowedLine(img, (x,y), (int(x+vx*scale), int(y+vy*scale)), color, 2, tipLength=0.3)


# ──────────────────────────────────────────────────────────────
# COST MATRIX
# ──────────────────────────────────────────────────────────────
def build_cost_matrix(tracks, detections, det_embeddings, det_alliances):
    INF  = 1e6
    cost = np.full((len(tracks), len(detections)), INF, np.float32)

    for i, track in enumerate(tracks):
        tx, ty     = track.get_pos()
        track_alln = track.portfolio.get_alliance() if track.confirmed else "unknown"
        track_emb  = track.portfolio.confirmed_embedding
        slack      = min(track.missing_frames * 3, MATCH_DISTANCE)
        gate       = SPATIAL_GATE + slack

        for j, det in enumerate(detections):
            dx, dy = det[0], det[1]
            dist   = float(np.hypot(tx-dx, ty-dy))
            if dist >= gate: continue

            det_alln = det_alliances[j]
            if (track_alln in ("red","blue") and
                    det_alln in ("red","blue") and
                    track_alln != det_alln):
                continue

            dist_norm = dist / gate
            if track_emb is not None and det_embeddings[j] is not None:
                emb_cost = 1.0 - cosine_sim(track_emb, det_embeddings[j])
            else:
                emb_cost = 0.5

            cost[i, j] = COST_DIST_W*dist_norm + COST_EMB_W*emb_cost

    return cost


# ──────────────────────────────────────────────────────────────
# RE-ID ENGINE
# ──────────────────────────────────────────────────────────────
def find_best_reid_match(det_emb, det_alliance, cx, cy, candidate_ids, force=False):
    best_id, best_score = None, -1.0
    for rid in candidate_ids:
        p = portfolio_reg.get(rid)
        if p is None or p.snapshot is None: continue
        snap = p.snapshot
        if snap.get("obs", 0) < REID_MIN_OBS: continue
        ref_emb = snap.get("embedding")
        if ref_emb is None: continue
        ref_alln = snap.get("alliance", "unknown")
        if (det_alliance in ("red","blue") and
                ref_alln in ("red","blue") and
                det_alliance != ref_alln):
            continue
        emb_sim  = cosine_sim(det_emb, ref_emb) if det_emb is not None else 0.0
        last_pos = snap.get("last_pos", (cx,cy))
        last_vel = snap.get("last_vel", (0,0))
        dt       = max(1, frame_count - snap.get("last_frame", frame_count))
        pred     = (last_pos[0]+last_vel[0]*dt, last_pos[1]+last_vel[1]*dt)
        dist     = float(np.hypot(cx-pred[0], cy-pred[1]))
        pos_score = float(np.exp(-dist/350.0))
        score     = 0.70*emb_sim + 0.30*pos_score
        if score > best_score:
            best_score = score; best_id = rid
    if force and best_id is not None:
        return best_id, best_score
    if best_id is not None and best_score >= REID_ACCEPT:
        return best_id, best_score
    return None, best_score


# ──────────────────────────────────────────────────────────────
# DISPLAY — DARKENED FRAME + BOUNDING BOXES
# ──────────────────────────────────────────────────────────────
def render_frame(original_frame: np.ndarray,
                 robot_boxes: list,   # [(track_id, x1,y1,x2,y2, robot_obj)]
                 ) -> np.ndarray:
    """
    Darken the entire frame, then for each robot:
      • paste the original (bright) crop back inside the bounding box
      • draw a coloured box border
      • draw label with display_id, alliance, obs count
    """
    # Start from a darkened version of the original
    dark = (original_frame * (1.0 - DARKEN_ALPHA)).astype(np.uint8)

    for (tid, x1, y1, x2, y2, robot) in robot_boxes:
        ix1 = max(0, int(x1)); iy1 = max(0, int(y1))
        ix2 = min(original_frame.shape[1]-1, int(x2))
        iy2 = min(original_frame.shape[0]-1, int(y2))

        # Restore original brightness inside the robot's bounding box
        dark[iy1:iy2, ix1:ix2] = original_frame[iy1:iy2, ix1:ix2]

        col   = robot.color
        alln  = robot.portfolio.get_alliance()
        disp  = robot.portfolio.display_id
        obs   = robot.portfolio.observation_count
        bumper_known = robot.portfolio.bumper_number is not None

        # Alliance tint on box border
        box_col = {"red": (60,60,220), "blue": (200,80,40)}.get(alln, col)

        # Box border — thicker + white flash on re-ID
        bw     = BOX_THICKNESS + (2 if robot.reid_flash > 0 else 0)
        border = (255,255,255) if robot.reid_flash > 0 else box_col
        cv2.rectangle(dark, (ix1, iy1), (ix2, iy2), border, bw)

        # Corner accent in robot's own colour
        corner = 10
        for sx, sy, ex, ey in [
            (ix1, iy1, ix1+corner, iy1), (ix1, iy1, ix1, iy1+corner),
            (ix2, iy1, ix2-corner, iy1), (ix2, iy1, ix2, iy1+corner),
            (ix1, iy2, ix1+corner, iy2), (ix1, iy2, ix1, iy2-corner),
            (ix2, iy2, ix2-corner, iy2), (ix2, iy2, ix2, iy2-corner),
        ]:
            cv2.line(dark, (sx,sy), (ex,ey), col, 2)

        # Label — bumper number (or auto-ID), alliance, obs
        bumper_str = f"#{disp}" if bumper_known else f"[{disp}]"
        alln_str   = alln[0].upper() if alln != "unknown" else "?"
        label      = f"{bumper_str} {alln_str} {obs}obs"
        lx, ly     = ix1+4, max(iy1+18, iy1+4)
        cv2.putText(dark, label, (lx, ly),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0,0,0),   3)
        cv2.putText(dark, label, (lx, ly),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.52, border,    1)

        # Trail
        draw_trail(dark, robot.trail, col)

        # Velocity arrow from centre of box
        cx_b = (ix1+ix2)//2; cy_b = (iy1+iy2)//2
        vx, vy = robot.get_vel()
        draw_velocity_arrow(dark, cx_b, cy_b, vx, vy, col)

    return dark


def render_ghost_robots(display: np.ndarray):
    """Draw Kalman-predicted positions for robots not currently visible."""
    for rid, robot in robots.items():
        if not robot.confirmed or robot.visible:
            continue
        px, py = robot.get_pos()
        conf   = robot.confidence()
        col    = robot.color
        gc     = tuple(int(v*conf) for v in col)
        disp   = robot.portfolio.display_id
        draw_trail(display, robot.trail, col, ghost=True)
        cv2.circle(display, (px,py), int(8+16*conf), gc, 1)
        cv2.line(display, (px-6,py-6), (px+6,py+6), gc, 2)
        cv2.line(display, (px+6,py-6), (px-6,py+6), gc, 2)
        cv2.putText(display, f"[{disp}]?", (px+10,py-8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, gc, 1)


# ──────────────────────────────────────────────────────────────
# LOAD MODEL + VIDEO
# ──────────────────────────────────────────────────────────────
model = YOLO(MODEL_PATH)

cap     = cv2.VideoCapture(VIDEO_PATH)
ret, _f = cap.read()
if not ret:
    raise RuntimeError(f"Cannot open video: {VIDEO_PATH}")
frame_h, frame_w = _f.shape[:2]
cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

video_scale = DISPLAY_H / frame_h
DISPLAY_W   = int(frame_w * video_scale)

cv2.namedWindow("Robot Tracker")

# ──────────────────────────────────────────────────────────────
# MAIN LOOP
# ──────────────────────────────────────────────────────────────
while True:
    if not paused:
        ret, frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue
        frame_count += 1

    # ── Kalman predict ───────────────────────────────────────
    for robot in robots.values():
        robot.predict()
        robot.visible = False

    # ── YOLO inference ──────────────────────────────────────
    detections     = []  # (cx, cy, x1, y1, x2, y2)
    det_alliances  = []
    det_embeddings = []

    results = model.predict(frame, conf=CONF, max_det=MAX_DET, verbose=False)[0]
    if results.boxes is not None:
        for i in range(len(results.boxes)):
            x1, y1, x2, y2 = results.boxes.xyxy[i].cpu().numpy()
            cx, cy = int((x1+x2)/2), int(y2)
            detections.append((cx, cy, x1, y1, x2, y2))
            det_alliances.append(detect_alliance(frame, x1, y1, x2, y2))
            det_embeddings.append(extract_embedding(frame, x1, y1, x2, y2))

    # ── Hungarian assignment ─────────────────────────────────
    assigned_dets = set()
    if robots and detections:
        robot_list  = list(robots.values())
        cost_matrix = build_cost_matrix(robot_list, detections, det_embeddings, det_alliances)
        rows, cols  = linear_sum_assignment(cost_matrix)
        for r, c in zip(rows, cols):
            if cost_matrix[r, c] >= 1e5: continue
            robot = robot_list[r]
            cx, cy, x1, y1, x2, y2 = detections[c]
            robot.update(cx, cy)
            robot.feed_portfolio(frame, x1, y1, x2, y2)
            assigned_dets.add(c)

    # ── Unassigned detections: re-ID or spawn ────────────────
    # Prune stale unconfirmed ghosts
    stale = [rid for rid, r in robots.items()
             if not r.confirmed and r.missing_frames > MIN_HITS*2]
    for rid in stale:
        del robots[rid]

    confirmed_count = sum(1 for r in robots.values() if r.confirmed)

    for idx in range(len(detections)):
        if idx in assigned_dets: continue
        cx, cy, x1, y1, x2, y2 = detections[idx]
        det_emb  = det_embeddings[idx]
        det_alln = det_alliances[idx]

        # Skip duplicates overlapping a live track
        if any(np.hypot(cx - r.get_pos()[0], cy - r.get_pos()[1]) < MATCH_DISTANCE*0.7
               for r in robots.values() if r.visible):
            continue

        # Try re-ID from frozen portfolios
        active_ids = set(robots.keys())
        lost_ids   = [rid for rid, p in portfolio_reg.items()
                      if rid not in active_ids and p.snapshot is not None]

        if lost_ids and det_emb is not None:
            best_id, score = find_best_reid_match(
                det_emb, det_alln, cx, cy, lost_ids,
                force=(confirmed_count >= MAX_ROBOTS))
            if best_id is not None:
                robot = RobotTrack(best_id, cx, cy, id_color(best_id))
                robots[best_id]  = robot
                robot.update(cx, cy)
                robot.reid_flash = 12
                confirmed_count  = sum(1 for r in robots.values() if r.confirmed)
                continue

        # At cap — force-assign to nearest missing confirmed robot
        if confirmed_count >= MAX_ROBOTS:
            missing = [r for r in robots.values() if r.confirmed and not r.visible]
            if missing:
                closest = min(missing, key=lambda r: np.hypot(
                    cx-r.get_pos()[0], cy-r.get_pos()[1]))
                closest.update(cx, cy)
                closest.reid_flash = 8
            continue

        # Spawn new track (only if under cap)
        if len([r for r in robots.values() if r.confirmed]) < MAX_ROBOTS:
            tid   = _next_track_id
            _next_track_id_ref = [_next_track_id]  # workaround for nonlocal in loop
            robot = RobotTrack(tid, cx, cy, id_color(tid))
            robots[tid] = robot
            # increment global
            globals()['_next_track_id'] += 1
            confirmed_count = sum(1 for r in robots.values() if r.confirmed)

    # ── Lost track management ────────────────────────────────
    remove_ids = []
    for rid, robot in robots.items():
        if not robot.visible:
            robot.missing_frames += 1
        if not robot.confirmed and robot.missing_frames > MIN_HITS*2:
            remove_ids.append(rid); continue
        if robot.confirmed and robot.missing_frames >= MAX_MISSING:
            if robot.missing_frames == MAX_MISSING:
                robot.freeze_portfolio()
            remove_ids.append(rid)
    for rid in remove_ids:
        del robots[rid]

    # ── Build list of visible robots + their boxes for rendering ──
    robot_boxes = []
    for rid, robot in robots.items():
        if not robot.confirmed or not robot.visible:
            continue
        px, py = robot.get_pos()
        # Recover bounding box from the best-matching detection
        best_det = min(
            [(i, detections[i]) for i in assigned_dets],
            key=lambda t: np.hypot(px - t[1][0], py - t[1][1]),
            default=(None, None)
        )
        if best_det[0] is None:
            continue
        _, (cx, cy, x1, y1, x2, y2) = best_det
        robot.trail.append((px, py))
        robot.trail = robot.trail[-90:]
        robot_boxes.append((rid, x1, y1, x2, y2, robot))

    # ── Render ──────────────────────────────────────────────
    display = render_frame(frame, robot_boxes)
    render_ghost_robots(display)

    # ── HUD ─────────────────────────────────────────────────
    confirmed_count = sum(1 for r in robots.values() if r.confirmed)
    known_bumpers   = sum(1 for p in portfolio_reg.values() if p.bumper_number)
    pending_vision  = sum(1 for p in portfolio_reg.values() if p._vision_pending)

    hud = (f"Robots: {confirmed_count}/{MAX_ROBOTS}  "
           f"Bumpers ID'd: {known_bumpers}  "
           f"Vision pending: {pending_vision}  "
           f"Frame: {frame_count}")
    if paused: hud += "  [PAUSED]"
    cv2.putText(display, hud, (10, display.shape[0]-32),
                cv2.FONT_HERSHEY_SIMPLEX, 0.46, (200,200,200), 1)
    cv2.putText(display, "Space: pause | C: clear | P: registry | Q: quit",
                (10, display.shape[0]-12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.38, (140,140,140), 1)

    cv2.imshow("Robot Tracker", cv2.resize(display, (DISPLAY_W, DISPLAY_H)))

    key = cv2.waitKey(1) & 0xFF
    if   key == ord('q'): break
    elif key == ord(' '): paused = not paused
    elif key == ord('c'):
        robots.clear()
        print("Tracks cleared")
    elif key == ord('p'):
        print("\n=== PORTFOLIO REGISTRY ===")
        for rid, p in sorted(portfolio_reg.items()):
            print(p.summary())
        print("==========================\n")

cap.release()
cv2.destroyAllWindows()