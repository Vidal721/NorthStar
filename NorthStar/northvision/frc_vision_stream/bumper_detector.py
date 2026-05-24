"""
bumper_detector.py  —  FRC Robot Tracker with Local Tesseract OCR ID
=====================================================================
  • Display: frame is darkened, only robot bounding-box regions are shown at full brightness.
  • Per-detection bumper reading: each crop is processed locally by Tesseract OCR
    (digit-only mode) to extract the 3-4 digit FRC team number.
  • Bumper number is the CANONICAL identity — matched first before embedding/spatial.
    - If bumper number is read → look for existing robot with that number, update it.
    - If no bumper number → fall back to embedding + spatial matching.
    - If no match and < 6 robots stored → create new robot.
    - If >= 6 robots stored → force-assign to closest missing robot (never exceed 6).
  • Cross-frame: every new detection is compared against ALL stored robots
    (visible + recently lost) before any new robot is spawned.
  • All OCR runs in background threads — never stalls the video loop.

Controls:
  Space  -> pause/unpause
  Q      -> quit
  C      -> clear all tracks
  P      -> print portfolio summary
  Ctrl+Click -> draw blind zone polygon (Enter to close, Z to undo, Esc to cancel)
"""

import cv2
import numpy as np
import re
import threading
import queue
import json
import os
import tkinter as tk
from tkinter import simpledialog, messagebox
import pytesseract
from ultralytics import YOLO
from filterpy.kalman import KalmanFilter
from scipy.optimize import linear_sum_assignment
from collections import deque

# =====================
# CONFIG
# =====================
MODEL_PATH = "best.pt"
VIDEO_PATH = "video.mp4"

CONF        = 0.15
MAX_DET     = 10
MIN_HITS    = 3
TRAIL_LEN   = 90
MAX_MISSING = 30

MATCH_DISTANCE = 90
MAX_ROBOTS     = 6

BLIND_ZONE_COLOR = (0, 80, 200)
BLIND_ZONE_ALPHA = 0.25

# Darkening overlay strength (0 = no darkening, 1 = fully black)
DARKEN_ALPHA = 0.82

# =====================
# EMBEDDING CONFIG
# =====================
EMBED_DIM = 48
EMB_EMA_ALPHA      = 0.10
EMB_UPDATE_MIN_SIM = 0.75

COST_DIST_WEIGHT = 0.35
COST_EMB_WEIGHT  = 0.65
SPATIAL_GATE     = MATCH_DISTANCE * 2.0

REID_MIN_OBS      = 5
REID_ACCEPT_SCORE = 0.45

# =====================
# DEFENSE / OCCLUSION CONFIG
# =====================
# Cost threshold below which we consider the trajectory match "confident"
# (Hungarian cost is 0–1 range; above this = weak/forced match, trigger re-verify)
TRAJ_CONFIDENT_COST   = 0.55

# How many consecutive frames of color agreement needed to pass re-verification
COLOR_VERIFY_FRAMES   = 8

# Minimum color agreement ratio during verification window to pass
COLOR_VERIFY_MIN_RATIO = 0.60

# Frames a robot must be missing before its next match is considered post-occlusion
OCCLUSION_MISSING_MIN = 4

# =====================
# TESSERACT OCR CONFIG
# =====================
# OCR runs in background threads so it never stalls the video loop.

# Tesseract config: digits only, single line, no page segmentation overhead.
# PSM 7 = single text line. PSM 8 = single word. Try 8 for short team numbers.
_TESS_CONFIG = "--oem 1 --psm 8 -c tessedit_char_whitelist=0123456789"

# How often to re-run OCR for a given robot (frames).
BUMPER_REREAD_INTERVAL    = 15   # normal cadence
BUMPER_REREAD_INTERVAL_HQ = 5    # when crop is large and clear

# Votes needed to lock a bumper number.
BUMPER_LOCK_VOTES    = 3
BUMPER_HQ_VOTE_WEIGHT = 2   # large/clear crop counts double

# Minimum crop pixel area to be considered "high quality".
BUMPER_HQ_MIN_AREA = 120 * 80   # px²

# Alliance colours — wider ranges, lower saturation floor for indoor/shadowed bumpers
ALLIANCE_HSV = {
    "red":  [(0,   60,  50), (12,  255, 255)],
    "red2": [(155, 60,  50), (180, 255, 255)],
    "blue": [(95,  60,  40), (135, 255, 255)],
}

# =====================
# LOAD MODEL
# =====================
model = YOLO(MODEL_PATH)

# =====================
# GLOBALS
# =====================
video_pts = []

next_robot_id      = 1
frame_count        = 0
robots             = {}
portfolio_registry = {}

blind_zones  = []
active_zone  = []
drawing_zone = False
paused       = False

# Background bumper-read results
_bumper_result_queue = queue.Queue()
_pending_bumper_keys = set()

# ── Single-robot selection & tracking ───────────────────────────────────────
# State machine:
#   "waiting"   — no detections yet; track all normally until first detection
#   "selecting" — first detections seen; paused, waiting for user to click one
#   "tracking"  — user selected a robot; only follow that robot
selection_state    = "waiting"
selected_robot_id  = None      # internal RobotTrack id of the chosen robot
tracked_coords     = []        # list of (field_x, field_y) — filled at save time
_raw_video_coords  = []        # list of (cx, cy) in raw VIDEO pixels — recorded live
# Bboxes of candidates shown during selection screen (display-scale)
_selection_bboxes  = []        # list of (x1,y1,x2,y2, robot_id) in DISPLAY coords

# ── Match metadata (prompt before first save) ────────────────────────────────
match_number = None
team_number  = None


# =====================
# LOCAL TESSERACT OCR BUMPER READER
# =====================

def _preprocess_bumper_crop(frame, x1, y1, x2, y2):
    """
    Extract and preprocess a bumper crop for OCR.
    Returns a grayscale image ready for Tesseract, or None if too small.
    
    Strategy:
      - Focus on the LOWER 40% of the bounding box where bumpers live.
      - Upscale to at least 64px tall (Tesseract works best >= 32px char height).
      - Apply adaptive threshold to handle varied lighting / bumper colours.
      - Try both light-on-dark and dark-on-light, return both for dual-pass OCR.
    """
    ix1 = max(0, int(x1)); iy1 = max(0, int(y1))
    ix2 = min(frame.shape[1]-1, int(x2)); iy2 = min(frame.shape[0]-1, int(y2))
    if ix2 - ix1 < 20 or iy2 - iy1 < 20:
        return None, None

    h = iy2 - iy1
    # Bumpers are at the base — take lower 45% of the box
    bumper_y1 = iy1 + int(h * 0.55)
    crop = frame[bumper_y1:iy2, ix1:ix2]
    if crop.size == 0:
        return None, None

    # Upscale: target ~80px tall for reliable digit recognition
    scale = max(1.0, 80.0 / crop.shape[0])
    if scale > 1.0:
        crop = cv2.resize(crop, None, fx=scale, fy=scale,
                          interpolation=cv2.INTER_CUBIC)

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

    # Mild denoising
    gray = cv2.GaussianBlur(gray, (3, 3), 0)

    # Adaptive threshold — handles shadows and coloured bumpers well
    thresh_dark  = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 15, 8)           # white text on dark bumper
    thresh_light = cv2.bitwise_not(thresh_dark)  # dark text on light bumper

    return thresh_dark, thresh_light


def _parse_team_number(text):
    """Extract a valid 3-4 digit FRC team number from raw OCR text."""
    digits = re.sub(r'\D', '', text)
    # FRC team numbers: 1 – 9999 (realistically 1–9999, active teams 1-8999)
    for length in (4, 3):
        if len(digits) >= length:
            candidate = digits[:length]
            val = int(candidate)
            if 1 <= val <= 9999:
                return candidate
    return None


def _run_tesseract_ocr(crop_img):
    """Run Tesseract on a single preprocessed image, return raw string."""
    try:
        return pytesseract.image_to_string(crop_img, config=_TESS_CONFIG).strip()
    except Exception:
        return ""


def _ocr_bumper_worker(frame, x1, y1, x2, y2, result_key, hq):
    """
    Background thread: preprocess crop, run Tesseract (dual-pass),
    push result to queue.
    """
    vote_weight = BUMPER_HQ_VOTE_WEIGHT if hq else 1

    img_a, img_b = _preprocess_bumper_crop(frame, x1, y1, x2, y2)
    if img_a is None:
        _bumper_result_queue.put((result_key, None, 1))
        return

    number = None
    for img in (img_a, img_b):
        raw = _run_tesseract_ocr(img)
        number = _parse_team_number(raw)
        if number:
            break

    _bumper_result_queue.put((result_key, number, vote_weight))


def request_bumper_read(frame, x1, y1, x2, y2, result_key):
    """Dispatch a background OCR read if one isn't already pending for this key."""
    if result_key in _pending_bumper_keys:
        return
    # Determine quality for vote weighting
    area = (int(x2) - int(x1)) * (int(y2) - int(y1))
    hq   = area >= BUMPER_HQ_MIN_AREA
    _pending_bumper_keys.add(result_key)
    t = threading.Thread(
        target=_ocr_bumper_worker,
        args=(frame, x1, y1, x2, y2, result_key, hq),
        daemon=True)
    t.start()


def drain_bumper_results():
    """Call once per frame to collect completed OCR results."""
    results = {}
    while True:
        try:
            key, number, weight = _bumper_result_queue.get_nowait()
            _pending_bumper_keys.discard(key)
            results[key] = (number, weight)
        except queue.Empty:
            break
    return results


# =====================
# EMBEDDING EXTRACTOR
# =====================
def extract_embedding(frame, x1, y1, x2, y2):
    ix1 = max(0, int(x1)); iy1 = max(0, int(y1))
    ix2 = min(frame.shape[1]-1, int(x2)); iy2 = min(frame.shape[0]-1, int(y2))
    if ix2 - ix1 < 8 or iy2 - iy1 < 8:
        return None

    crop = cv2.resize(frame[iy1:iy2, ix1:ix2], (32, 32))
    hsv  = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)

    def nhist(ch, bins, rng):
        h = cv2.calcHist([hsv], [ch], None, [bins], rng).flatten()
        s = h.sum(); return h / s if s > 0 else h
    colour = np.concatenate([nhist(0,16,[0,180]), nhist(1,8,[0,256]), nhist(2,8,[0,256])])

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY).astype(np.float32)
    gx   = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy   = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag  = np.hypot(gx, gy)
    ang  = (np.arctan2(gy, gx) + np.pi) / (2 * np.pi)
    grad = np.array([mag[(ang >= i/8) & (ang < (i+1)/8)].sum() for i in range(8)], np.float32)
    s = grad.sum(); grad = grad / s if s > 0 else grad

    tex = []
    for qy in range(2):
        for qx in range(2):
            q = gray[qy*16:(qy+1)*16, qx*16:(qx+1)*16]
            tex += [float(np.var(q)), float(np.mean(q) / 255.0)]
    tex = np.array(tex, np.float32)
    s = tex.sum(); tex = tex / s if s > 0 else tex

    vec = np.concatenate([colour, grad, tex])[:EMBED_DIM]
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 1e-8 else vec


def cosine_sim(a, b):
    return float(np.clip(np.dot(a, b), 0.0, 1.0))


# =====================
# ALLIANCE DETECTOR
# =====================
def detect_alliance(frame, x1, y1, x2, y2):
    ix1 = max(0, int(x1)); iy1 = max(0, int(y1))
    ix2 = min(frame.shape[1]-1, int(x2)); iy2 = min(frame.shape[0]-1, int(y2))
    if ix2 - ix1 < 6 or iy2 - iy1 < 6:
        return "unknown"
    h = iy2 - iy1

    def vote(crop):
        if crop.size == 0:
            return "unknown", 0.0
        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        # Count all pixels (not just saturated ones) to handle dark/shadowed bumpers
        tot = max(1, crop.shape[0] * crop.shape[1])
        def px(lo, hi):
            return int(cv2.inRange(hsv, np.array(lo, np.uint8), np.array(hi, np.uint8)).sum() // 255)
        r = (px(*ALLIANCE_HSV["red"]) + px(*ALLIANCE_HSV["red2"])) / tot
        b = px(*ALLIANCE_HSV["blue"]) / tot
        if r > b and r > 0.12: return "red",  r
        if b > r and b > 0.12: return "blue", b
        return "unknown", max(r, b)

    # Primary: lower bumper strip (60–100% of box height)
    r1, c1 = vote(frame[iy1 + int(h*0.60):iy2,              ix1:ix2])
    # Secondary: mid-lower strip (45–62%)
    r2, c2 = vote(frame[iy1 + int(h*0.45):iy1+int(h*0.62),  ix1:ix2])
    # Fallback: full height (catches robots that are partially cropped at bottom)
    r3, c3 = vote(frame[iy1:iy2,                             ix1:ix2])

    # Majority of two agreeing strips wins
    results = [(r1,c1),(r2,c2),(r3,c3)]
    for label in ("red","blue"):
        agreeing = [c for r,c in results if r == label]
        if len(agreeing) >= 2:
            return label
    # Single strong read
    best = max(results, key=lambda x: x[1])
    if best[0] != "unknown" and best[1] > 0.20:
        return best[0]
    return "unknown"


# =====================
# ROBOT PORTFOLIO
# =====================
class RobotPortfolio:
    """
    Persistent visual + bumper identity for one robot.
    bumper_number (str or None): team number once locked; None until confirmed.
    """
    def __init__(self, robot_id):
        self.robot_id = robot_id
        self.confirmed_embedding = None
        self._alliances = deque(maxlen=30)
        self.observation_count = 0
        self.snapshot = None

        self.bumper_number = None
        self._bumper_votes = {}
        self.bumper_locked = False
        self.last_bumper_read_frame = -BUMPER_REREAD_INTERVAL

        # Permanent alliance lock — once set, never overwritten
        self.locked_alliance = None   # "red" | "blue" | None
        self._alliance_lock_votes = 0
        self.ALLIANCE_LOCK_THRESHOLD = 5  # votes needed to lock

    def feed(self, frame, x1, y1, x2, y2, cx, cy):
        emb = extract_embedding(frame, x1, y1, x2, y2)
        if emb is not None:
            self._update_embedding(emb)
        detected = detect_alliance(frame, x1, y1, x2, y2)
        self._alliances.append(detected)
        self.observation_count += 1
        # Accumulate votes toward a permanent alliance lock
        if detected in ("red", "blue") and self.locked_alliance is None:
            self._alliance_lock_votes += 1
            if self._alliance_lock_votes >= self.ALLIANCE_LOCK_THRESHOLD:
                votes = list(self._alliances)
                red_v  = votes.count("red")
                blue_v = votes.count("blue")
                if red_v > blue_v:
                    self.locked_alliance = "red"
                elif blue_v > red_v:
                    self.locked_alliance = "blue"
                if self.locked_alliance:
                    print(f"[Alliance] Robot #{self.robot_id} permanently locked as {self.locked_alliance.upper()}")

    def register_bumper_read(self, number, weight=1):
        """Called when a local OCR result arrives for this robot."""
        if self.bumper_locked or number is None:
            return
        self._bumper_votes[number] = self._bumper_votes.get(number, 0) + weight
        top_num = max(self._bumper_votes, key=self._bumper_votes.get)
        if self._bumper_votes[top_num] >= BUMPER_LOCK_VOTES:
            self.bumper_number = top_num
            self.bumper_locked = True
            print(f"[Bumper] Robot #{self.robot_id} locked as team {top_num}")
            # Also lock alliance now if not already — bumper confirmed means color is certain
            if self.locked_alliance is None:
                votes = list(self._alliances)
                red_v  = votes.count("red")
                blue_v = votes.count("blue")
                if red_v > blue_v:
                    self.locked_alliance = "red"
                elif blue_v > red_v:
                    self.locked_alliance = "blue"
                if self.locked_alliance:
                    print(f"[Alliance] Robot #{self.robot_id} alliance locked via bumper as {self.locked_alliance.upper()}")

    def _update_embedding(self, emb):
        if self.confirmed_embedding is None:
            self.confirmed_embedding = emb.copy()
            return
        sim = cosine_sim(emb, self.confirmed_embedding)
        if sim >= EMB_UPDATE_MIN_SIM:
            self.confirmed_embedding = ((1 - EMB_EMA_ALPHA) * self.confirmed_embedding
                                        + EMB_EMA_ALPHA * emb)
            norm = np.linalg.norm(self.confirmed_embedding)
            if norm > 1e-8:
                self.confirmed_embedding /= norm

    def get_alliance(self):
        # Permanent lock takes absolute priority — can never be overridden
        if self.locked_alliance is not None:
            return self.locked_alliance
        votes = list(self._alliances)
        if not votes: return "unknown"
        for label in ("red", "blue"):
            if votes.count(label) > len(votes) * 0.4:
                return label
        return "unknown"

    def freeze(self, pos, vel, frame_no):
        self.snapshot = {
            "embedding":       self.confirmed_embedding.copy() if self.confirmed_embedding is not None else None,
            "alliance":        self.get_alliance(),   # locked value if set
            "locked_alliance": self.locked_alliance,
            "bumper":          self.bumper_number,
            "last_pos":        pos,
            "last_vel":        vel,
            "last_frame":      frame_no,
            "obs":             self.observation_count,
        }

    def display_label(self):
        if self.bumper_number:
            return self.bumper_number
        return f"#{self.robot_id}"

    def summary(self):
        has_emb = self.confirmed_embedding is not None
        lock_str = f"LOCKED:{self.locked_alliance}" if self.locked_alliance else self.get_alliance()
        return (f"  Robot #{self.robot_id}: bumper={self.bumper_number or '?'}  "
                f"obs={self.observation_count}  alliance={lock_str}  "
                f"embedding={'YES' if has_emb else 'NO'}")


# =====================
# ROBOT TRACK
# =====================
class RobotTrack:
    def __init__(self, robot_id, x, y, color):
        self.id             = robot_id
        self.color          = color
        self.trail          = []
        self.missing_frames = 0
        self.visible        = True
        self.hit_count      = 0
        self.confirmed      = False
        self.in_blind_zone  = False
        self.reid_flash     = 0
        self.last_bbox      = None  # (x1, y1, x2, y2)

        # Defense / post-occlusion color re-verification
        # Set to True when a robot re-emerges after occlusion with a weak trajectory match.
        # While True, color is sampled every frame and compared against locked_alliance.
        # If it passes → clear flag. If it fails → bumper re-read is triggered.
        self.needs_color_verify    = False
        self._verify_frames_left   = 0
        self._verify_color_hits    = 0   # frames where color agreed
        self._verify_color_total   = 0   # frames sampled so far

        self.kf   = KalmanFilter(dim_x=4, dim_z=2)
        dt        = 1.0
        self.kf.F = np.array([[1,0,dt,0],[0,1,0,dt],[0,0,1,0],[0,0,0,1]], dtype=float)
        self.kf.H = np.array([[1,0,0,0],[0,1,0,0]], dtype=float)
        self.kf.P *= 100
        self.kf.R *= 5
        self.kf.Q *= 0.1
        self.kf.x = np.array([x, y, 0, 0], dtype=float).reshape(4, 1)

        if robot_id not in portfolio_registry:
            portfolio_registry[robot_id] = RobotPortfolio(robot_id)
        self.portfolio = portfolio_registry[robot_id]

    def predict(self):
        self.kf.predict()

    def update(self, x, y, bbox=None):
        self.kf.update(np.array([x, y], dtype=float))
        self.missing_frames = 0
        self.visible        = True
        self.in_blind_zone  = False
        self.hit_count     += 1
        if self.hit_count >= MIN_HITS:
            self.confirmed = True
        if self.reid_flash > 0:
            self.reid_flash -= 1
        if bbox is not None:
            self.last_bbox = bbox

    def feed_portfolio(self, frame, x1, y1, x2, y2):
        if not self.confirmed:
            return
        cx, cy = self.get_pos()
        self.portfolio.feed(frame, x1, y1, x2, y2, cx, cy)

    def start_color_verify(self):
        """
        Called when we re-assign this robot after occlusion with a weak trajectory.
        Resets the verification window so the next COLOR_VERIFY_FRAMES frames are
        used to confirm the robot's locked alliance colour still matches what's seen.
        """
        self.needs_color_verify  = True
        self._verify_frames_left = COLOR_VERIFY_FRAMES
        self._verify_color_hits  = 0
        self._verify_color_total = 0

    def tick_color_verify(self, frame, x1, y1, x2, y2):
        """
        Call once per frame while needs_color_verify is True (robot is visible).
        Returns True when verification is complete (pass or fail).
        On fail, triggers a fresh bumper re-read.
        """
        if not self.needs_color_verify:
            return False

        locked = self.portfolio.locked_alliance
        if locked is None:
            # Nothing to verify against — just clear the flag
            self.needs_color_verify = False
            return True

        detected = detect_alliance(frame, x1, y1, x2, y2)
        self._verify_color_total += 1
        if detected == locked:
            self._verify_color_hits += 1

        self._verify_frames_left -= 1

        if self._verify_frames_left <= 0:
            ratio = self._verify_color_hits / max(1, self._verify_color_total)
            if ratio >= COLOR_VERIFY_MIN_RATIO:
                # Color confirmed — robot identity is solid
                print(f"[Verify] Robot #{self.id} color verified ({ratio:.0%} agree, alliance={locked})")
            else:
                # Color mismatch after occlusion — force a bumper re-read
                print(f"[Verify] Robot #{self.id} color MISMATCH after occlusion "
                      f"({ratio:.0%} agree, locked={locked}) — forcing bumper re-read")
                self.portfolio.last_bumper_read_frame = -BUMPER_REREAD_INTERVAL  # make it due immediately
            self.needs_color_verify = False
            return True

        return False

    def freeze_portfolio(self):
        vx, vy = self.get_vel()
        self.portfolio.freeze(self.get_pos(), (vx, vy), frame_count)

    def get_pos(self):
        return int(self.kf.x[0, 0]), int(self.kf.x[1, 0])

    def get_vel(self):
        return float(self.kf.x[2, 0]), float(self.kf.x[3, 0])

    def confidence(self):
        return max(0.0, 1.0 - self.missing_frames / MAX_MISSING)


# =====================
# HELPERS
# =====================
def id_color(tid):
    np.random.seed(int(tid) * 137 + 42)
    return tuple(int(c) for c in np.random.randint(80, 255, 3))

def alliance_color(alliance):
    """Return a strong BGR color for a given alliance string."""
    return {
        "red":  (40,  40,  220),   # vivid red
        "blue": (220, 100,  30),   # vivid blue
    }.get(alliance, (180, 180, 180))  # grey for unknown

def draw_trail(img, trail, color, ghost=False):
    if len(trail) < 2: return
    for i in range(1, len(trail)):
        alpha = i / len(trail)
        c = tuple(int(v * (0.35 if ghost else 1.0) * alpha) for v in color)
        cv2.line(img, trail[i-1], trail[i], c, max(1, int(2*alpha)))

def draw_velocity_arrow(img, x, y, vx, vy, color, scale=4.0):
    if np.hypot(vx, vy) < 0.5: return
    cv2.arrowedLine(img, (x,y), (int(x+vx*scale), int(y+vy*scale)), color, 2, tipLength=0.3)

def draw_decay_circle(img, x, y, color, conf):
    cv2.circle(img, (x,y), int(8+16*conf), tuple(int(v*conf) for v in color), 1)

def point_in_any_zone(x, y):
    for zi, zone in enumerate(blind_zones):
        if len(zone) >= 3 and cv2.pointPolygonTest(
                zone.astype(np.float32), (float(x), float(y)), False) >= 0:
            return zi
    return -1

def draw_blind_zones(img):
    overlay = img.copy()
    for zone in blind_zones:
        if len(zone) < 2: continue
        if len(zone) >= 3:
            cv2.fillPoly(overlay, [zone], BLIND_ZONE_COLOR)
        cv2.polylines(overlay, [zone], isClosed=(len(zone)>=3), color=(0,140,255), thickness=2)
    cv2.addWeighted(overlay, BLIND_ZONE_ALPHA, img, 1-BLIND_ZONE_ALPHA, 0, img)
    if active_zone:
        pts = np.array(active_zone, dtype=np.int32)
        for pt in pts:
            cv2.circle(img, tuple(pt), 5, (0,200,255), -1)
        if len(active_zone) >= 2:
            cv2.polylines(img, [pts], isClosed=False, color=(0,200,255), thickness=1)


def apply_darkened_display(frame, bboxes):
    """
    Returns a copy of frame darkened everywhere except the robot bounding boxes.
    """
    dark = (frame.astype(np.float32) * (1.0 - DARKEN_ALPHA)).astype(np.uint8)
    out  = dark.copy()
    for (x1, y1, x2, y2) in bboxes:
        ix1 = max(0, int(x1)); iy1 = max(0, int(y1))
        ix2 = min(frame.shape[1]-1, int(x2)); iy2 = min(frame.shape[0]-1, int(y2))
        if ix2 > ix1 and iy2 > iy1:
            out[iy1:iy2, ix1:ix2] = frame[iy1:iy2, ix1:ix2]
    return out


# =====================
# COST MATRIX
# =====================
def build_cost_matrix(tracks, detections, det_embeddings, det_alliances):
    INF = 1e6
    cost = np.full((len(tracks), len(detections)), INF, dtype=np.float32)

    for i, track in enumerate(tracks):
        tx, ty     = track.get_pos()
        track_alln = track.portfolio.get_alliance() if track.confirmed else "unknown"
        track_emb  = track.portfolio.confirmed_embedding

        missing_slack = min(track.missing_frames * 3, MATCH_DISTANCE)
        gate = SPATIAL_GATE + missing_slack

        for j, det in enumerate(detections):
            dx, dy = det[0], det[1]
            dist   = float(np.hypot(tx - dx, ty - dy))

            if dist >= gate:
                continue

            det_alln = det_alliances[j]
            if (track_alln in ("red","blue") and
                    det_alln  in ("red","blue") and
                    track_alln != det_alln):
                continue

            dist_norm = dist / gate

            if track_emb is not None and det_embeddings[j] is not None:
                emb_cost = 1.0 - cosine_sim(track_emb, det_embeddings[j])
            else:
                emb_cost = 0.5

            cost[i, j] = COST_DIST_WEIGHT * dist_norm + COST_EMB_WEIGHT * emb_cost

    return cost


# =====================
# RE-ID ENGINE
# =====================
def find_best_reid_match(det_emb, det_alliance, cx, cy, candidate_ids, force=False):
    best_id    = None
    best_score = -1.0

    for rid in candidate_ids:
        p = portfolio_registry.get(rid)
        if p is None or p.snapshot is None:
            continue
        snap = p.snapshot

        if snap.get("obs", 0) < REID_MIN_OBS:
            continue

        ref_emb = snap.get("embedding")
        if ref_emb is None:
            continue

        ref_alln = snap.get("alliance", "unknown")
        if (det_alliance in ("red","blue") and
                ref_alln   in ("red","blue") and
                det_alliance != ref_alln):
            continue

        emb_sim = cosine_sim(det_emb, ref_emb) if det_emb is not None else 0.0

        last_pos = snap.get("last_pos", (cx, cy))
        last_vel = snap.get("last_vel", (0, 0))
        dt       = max(1, frame_count - snap.get("last_frame", frame_count))
        pred     = (last_pos[0] + last_vel[0] * dt,
                    last_pos[1] + last_vel[1] * dt)
        dist     = float(np.hypot(cx - pred[0], cy - pred[1]))
        pos_score = float(np.exp(-dist / 350.0))

        score = 0.70 * emb_sim + 0.30 * pos_score

        if score > best_score:
            best_score = score
            best_id    = rid

    if force and best_id is not None:
        return best_id, best_score
    if best_id is not None and best_score >= REID_ACCEPT_SCORE:
        return best_id, best_score
    return None, best_score


# =====================
# FIELD COORDINATE MAPPING
# =====================
FIELD_IMG_PATH = "field.png"   # overhead field image

# video_pts   — 4 corners clicked on the VIDEO   (set during normal tracking)
# field_pts   — 4 corners clicked on the FIELD IMAGE (set during save flow)
# homography  — computed from video_pts → field_pts
field_pts      = []   # (x,y) in the FLIPPED field-image coordinate space
_homography_M  = None


def compute_homography():
    """Build the perspective matrix from video space → field-image space."""
    global _homography_M
    if len(video_pts) == 4 and len(field_pts) == 4:
        src = np.array(video_pts,  dtype=np.float32)
        dst = np.array(field_pts,  dtype=np.float32)
        _homography_M, _ = cv2.findHomography(src, dst)
    else:
        _homography_M = None


def map_to_field(cx, cy):
    """
    Map a raw video pixel (cx, cy) directly to field-image coordinates
    using the homography built from the two sets of 4 corner clicks.
    Returns (fx, fy) or None if homography not ready.
    """
    if _homography_M is None:
        return None
    pt  = np.array([[[float(cx), float(cy)]]], dtype=np.float32)
    out = cv2.perspectiveTransform(pt, _homography_M)[0][0]
    return int(round(float(out[0]))), int(round(float(out[1])))


def record_coord(robot):
    """Append the raw video-pixel position of the tracked robot."""
    cx, cy = robot.get_pos()
    _raw_video_coords.append([cx, cy])


def prompt_match_info():
    """Tkinter dialogs to collect match and team numbers."""
    global match_number, team_number
    root = tk.Tk()
    root.withdraw()
    mn = simpledialog.askstring("Match Info", "Enter match number:", parent=root)
    tn = simpledialog.askstring("Match Info", "Enter team number:", parent=root)
    root.destroy()
    match_number = mn.strip() if mn else "unknown"
    team_number  = tn.strip() if tn else "unknown"


# ── field corner click state ─────────────────────────────────────────────────
_field_img_orig    = None   # the raw field image (not flipped) — kept for saves
_field_img_display = None   # the flipped version shown in the window
_field_scale       = 1.0    # scale factor applied to fit on screen
_field_win_pts     = []     # click points in WINDOW coords (scaled+flipped display)


def _mouse_field(event, x, y, flags, param):
    """Mouse callback for the Field corner-selection window."""
    global _field_win_pts, field_pts
    if event == cv2.EVENT_LBUTTONDOWN and len(_field_win_pts) < 4:
        _field_win_pts.append((x, y))
        # Convert display coords → pixel coords in the FLIPPED image
        fx = int(x / _field_scale)
        fy = int(y / _field_scale)
        field_pts.append((fx, fy))
        print(f"[Field] Corner {len(field_pts)}: display=({x},{y})  img=({fx},{fy})")


def run_field_mapping_window():
    """
    Close the Video window, open the field image (horizontally flipped to match
    the camera view), let the user click its 4 corners in the same order as
    video_pts, compute the homography, draw the robot path, save JSON, then
    display the result until any key is pressed.
    """
    global _field_img_orig, _field_img_display, _field_scale
    global _field_win_pts, field_pts, _homography_M

    # ── Load field image ──────────────────────────────────────────────────
    field_raw = cv2.imread(FIELD_IMG_PATH)
    if field_raw is None:
        print(f"[Field] ERROR: cannot load '{FIELD_IMG_PATH}'. Saving JSON without map.")
        _save_json_only()
        return

    _field_img_orig = field_raw.copy()

    # Flip horizontally so left/right matches the camera's perspective
    field_flipped = cv2.flip(field_raw, 1)

    # Scale to fit screen (max 1400 wide, 800 tall)
    fh, fw = field_flipped.shape[:2]
    max_w, max_h = 1400, 800
    _field_scale  = min(max_w / fw, max_h / fh, 1.0)
    disp_w = int(fw * _field_scale)
    disp_h = int(fh * _field_scale)
    _field_img_display = cv2.resize(field_flipped, (disp_w, disp_h))

    # ── Close video window, open field window ────────────────────────────
    FIELD_WIN = "Field - Click 4 Field Corners"
    cv2.destroyWindow("Video")
    cv2.namedWindow(FIELD_WIN)
    cv2.setMouseCallback(FIELD_WIN, _mouse_field)

    _field_win_pts.clear()
    field_pts.clear()

    print("[Field] Click the 4 corners of the field in the SAME ORDER you clicked them on the video.")

    ORDER_COLORS = [(0,255,128), (0,200,255), (255,180,0), (255,80,200)]

    # ── Corner-selection loop ─────────────────────────────────────────────
    # Loop runs until 4 points placed AND one extra frame drawn to show the 4th dot
    while True:
        canvas = _field_img_display.copy()

        # Draw clicks so far + connecting lines
        for i, (px, py) in enumerate(_field_win_pts):
            cv2.circle(canvas, (px, py), 9, ORDER_COLORS[i], -1)
            cv2.circle(canvas, (px, py), 9, (255,255,255), 2)
            cv2.putText(canvas, str(i+1), (px+12, py+6),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, ORDER_COLORS[i], 2)
            if i > 0:
                cv2.line(canvas, _field_win_pts[i-1], (px, py), (200,200,200), 1)
        if len(_field_win_pts) >= 4:
            cv2.line(canvas, _field_win_pts[-1], _field_win_pts[0], (200,200,200), 1)

        # Instruction banner — bottom of image so it doesn't cover field corners
        remaining = max(0, 4 - len(_field_win_pts))
        if remaining > 0:
            banner = f"Click {remaining} more corner(s)  (same order as video)   Z = undo   Q = quit"
        else:
            banner = "All 4 corners set — building path..."
        (bw, bh), _ = cv2.getTextSize(banner, cv2.FONT_HERSHEY_SIMPLEX, 0.65, 2)
        by = canvas.shape[0] - 10
        cv2.rectangle(canvas, (8, by - bh - 10), (bw + 20, by + 4), (0, 0, 0), -1)
        cv2.putText(canvas, banner, (14, by - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 128), 2)

        cv2.imshow(FIELD_WIN, canvas)
        key = cv2.waitKey(30) & 0xFF
        if key == ord('q'):
            cv2.destroyAllWindows()
            return
        if key == ord('z') and _field_win_pts:
            _field_win_pts.pop()
            field_pts.pop()

        if len(_field_win_pts) >= 4:
            # Render one final frame showing all 4 dots, then proceed
            cv2.imshow(FIELD_WIN, canvas)
            cv2.waitKey(300)
            break

    # ── Build homography & map coords ────────────────────────────────────
    compute_homography()

    mapped = []
    if _homography_M is not None and _raw_video_coords:
        raw = np.array(_raw_video_coords, dtype=np.float32).reshape(-1, 1, 2)
        out = cv2.perspectiveTransform(raw, _homography_M).reshape(-1, 2)
        mapped = [(int(round(float(p[0]))), int(round(float(p[1])))) for p in out]
    else:
        print("[Field] Homography failed or no coords recorded — no path to draw.")

    # ── Draw path on the flipped field image ─────────────────────────────
    result = _field_img_display.copy()

    if len(mapped) >= 2:
        pts_arr = np.array(
            [(int(x * _field_scale), int(y * _field_scale)) for x, y in mapped],
            dtype=np.int32)
        # Path line
        for i in range(1, len(pts_arr)):
            alpha = i / len(pts_arr)
            r = int(255 * alpha)
            g = int(180 * (1 - alpha))
            cv2.line(result, tuple(pts_arr[i-1]), tuple(pts_arr[i]), (0, r, 255-r), 3)
        # Start dot (green) and end dot (red)
        cv2.circle(result, tuple(pts_arr[0]),  10, (0, 255, 80),  -1)
        cv2.circle(result, tuple(pts_arr[-1]), 10, (0,  80, 255), -1)
        # Dots every N steps for visibility
        step = max(1, len(pts_arr) // 60)
        for i in range(0, len(pts_arr), step):
            cv2.circle(result, tuple(pts_arr[i]), 4, (255, 255, 255), -1)

    # Labels
    tr_label = f"Team {team_number}  Match {match_number}  —  {len(mapped)} points"
    cv2.putText(result, tr_label, (14, result.shape[0] - 14),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (220, 220, 220), 2)
    cv2.putText(result, "Press any key to close", (14, result.shape[0] - 36),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (160, 160, 160), 1)

    # ── Save JSON with field coords ───────────────────────────────────────
    _save_json_only(mapped)

    # ── Show result ───────────────────────────────────────────────────────
    cv2.imshow(FIELD_WIN, result)
    cv2.waitKey(0)
    cv2.destroyAllWindows()


def _save_json_only(field_coords=None):
    """Write the JSON file (called with field-mapped coords, or raw if mapping failed)."""
    coords_to_save = field_coords if field_coords is not None else tracked_coords
    data = {
        "match_number": match_number,
        "team_number":  team_number,
        "coords":       [list(c) for c in coords_to_save],
    }
    filename = f"match_{match_number}_team_{team_number}.json"
    with open(filename, "w") as f:
        json.dump(data, f, indent=2)
    print(f"[Save] {len(coords_to_save)} coords → {os.path.abspath(filename)}")


def save_and_map():
    """
    Entry point called from the 'S' key / Finish button.
    Prompts for match info, then opens the field mapping window.
    """
    global match_number, team_number
    # Pause video immediately
    prompt_match_info()
    run_field_mapping_window()
    # After field window closes, also close everything else
    cv2.destroyAllWindows()


# =====================
# CAPTURE + DISPLAY
# =====================
cap = cv2.VideoCapture(VIDEO_PATH)
ret, _first = cap.read()
if not ret:
    raise RuntimeError("Could not read video")
frame_h, frame_w = _first.shape[:2]
cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

DISPLAY_H   = 720
video_scale = DISPLAY_H / frame_h
DISPLAY_W   = int(frame_w * video_scale)

cv2.namedWindow("Video")


def mouse_video(event, x, y, flags, param):
    global drawing_zone, active_zone, selection_state, selected_robot_id, paused
    ctrl = bool(flags & cv2.EVENT_FLAG_CTRLKEY)
    if event == cv2.EVENT_LBUTTONDOWN:
        # ── Finish & Save button (top-right) ────────────────────────────
        if selection_state == "tracking":
            # Recompute button bounds to check click (same logic as draw)
            import cv2 as _cv2
            btn_label = "Finish & Save [S]"
            (tw, th), _ = _cv2.getTextSize(btn_label, _cv2.FONT_HERSHEY_SIMPLEX, 0.65, 2)
            bx1 = DISPLAY_W - tw - 24
            by1 = 10
            bx2 = DISPLAY_W - 6
            by2 = th + 26
            if bx1 <= x <= bx2 and by1 <= y <= by2:
                param["do_save"] = True   # signal main loop
                return

        # ── Robot selection mode ─────────────────────────────────────────
        if selection_state == "selecting":
            for (bx1, by1, bx2, by2, rid) in _selection_bboxes:
                if bx1 <= x <= bx2 and by1 <= y <= by2:
                    selected_robot_id = rid
                    selection_state   = "tracking"
                    paused            = False
                    print(f"[Select] Tracking robot #{rid}")
                    return  # selected a robot -- don't also place a field point

        # ── Field boundary points & blind zones (allowed in any state) ───
        if ctrl:
            active_zone.append([int(x/video_scale), int(y/video_scale)])
            drawing_zone = True
        elif not drawing_zone and len(video_pts) < 4:
            # Store in raw video coords (display coords / video_scale)
            video_pts.append([int(x/video_scale), int(y/video_scale)])
            print(f"[Field] Video corner {len(video_pts)}: raw=({int(x/video_scale)},{int(y/video_scale)})  window=({x},{y})")

_mouse_param = {"do_save": False}
cv2.setMouseCallback("Video", mouse_video, _mouse_param)


# =====================
# MAIN LOOP
# =====================
while True:
    # ── Check if Finish button was clicked ───────────────────────────────
    if _mouse_param.get("do_save"):
        _mouse_param["do_save"] = False
        save_and_map()
        break
    if not paused:
        ret, frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue
        frame_count += 1

    # ── Drain any completed local OCR bumper reads ───────────────────────
    bumper_results = drain_bumper_results()
    for result_key, (number, weight) in bumper_results.items():
        # result_key format: "robot_{rid}_frame_{f}"
        try:
            rid = int(result_key.split("_")[1])
            p = portfolio_registry.get(rid)
            if p is not None:
                p.register_bumper_read(number, weight)
        except Exception:
            pass

    # ── Kalman predict + reset visibility ────────────────────────────────
    raw_bboxes = []
    field_ready = (len(video_pts) == 4)   # don't track until boundary is set

    if not paused:
        for robot in robots.values():
            robot.predict()
            robot.visible = False

        detections     = []
        det_alliances  = []
        det_embeddings = []

        if field_ready:
            poly = np.array(video_pts, dtype=np.float32)
            results = model.predict(frame, conf=CONF, max_det=MAX_DET, verbose=False)[0]
            if results.boxes is not None:
                for i in range(len(results.boxes)):
                    x1, y1, x2, y2 = results.boxes.xyxy[i].cpu().numpy()
                    cx, cy = int((x1+x2)/2), int(y2)
                    if cv2.pointPolygonTest(poly, (float(cx), float(cy)), False) < 0:
                        continue
                    detections.append((cx, cy, x1, y1, x2, y2))
                    det_alliances.append(detect_alliance(frame, x1, y1, x2, y2))
                    det_embeddings.append(extract_embedding(frame, x1, y1, x2, y2))
                    raw_bboxes.append((int(x1), int(y1), int(x2), int(y2)))

        # ── Hungarian assignment ─────────────────────────────────────────
        assigned_dets = set()

        if field_ready and robots and detections:
            robot_list  = list(robots.values())
            cost_matrix = build_cost_matrix(
                robot_list, detections, det_embeddings, det_alliances)
            rows, cols = linear_sum_assignment(cost_matrix)

            for r, c in zip(rows, cols):
                if cost_matrix[r, c] >= 1e5:
                    continue
                robot = robot_list[r]
                cx, cy, x1, y1, x2, y2 = detections[c]

                # If this robot was missing long enough to have been occluded by a defender,
                # and the trajectory match cost is weak, start a color re-verification pass.
                was_occluded = robot.missing_frames >= OCCLUSION_MISSING_MIN
                weak_match   = cost_matrix[r, c] > TRAJ_CONFIDENT_COST
                if was_occluded and weak_match and not robot.needs_color_verify:
                    robot.start_color_verify()
                    print(f"[Defense] Robot #{robot.id} re-emerged after {robot.missing_frames} "
                          f"missing frames (cost={cost_matrix[r,c]:.2f}) — color verify started")

                robot.update(cx, cy, bbox=(x1, y1, x2, y2))
                robot.feed_portfolio(frame, x1, y1, x2, y2)

                # Run one color-verify tick if active
                if robot.needs_color_verify:
                    robot.tick_color_verify(frame, x1, y1, x2, y2)

                assigned_dets.add(c)

                # Record coord if this is the tracked robot
                if selection_state == "tracking" and robot.id == selected_robot_id:
                    record_coord(robot)

                # Schedule bumper read if due
                p = robot.portfolio
                area     = (int(x2) - int(x1)) * (int(y2) - int(y1))
                interval = BUMPER_REREAD_INTERVAL_HQ if area >= BUMPER_HQ_MIN_AREA else BUMPER_REREAD_INTERVAL
                if (not p.bumper_locked and
                        frame_count - p.last_bumper_read_frame >= interval):
                    p.last_bumper_read_frame = frame_count
                    key = f"robot_{robot.id}_frame_{frame_count}"
                    request_bumper_read(frame, x1, y1, x2, y2, key)

        # ── Unassigned detections: re-ID or spawn ───────────────────────
        if field_ready:
            stale = [rid for rid, r in robots.items()
                     if not r.confirmed and r.missing_frames > MIN_HITS * 2]
            for rid in stale:
                del robots[rid]

            confirmed_count = sum(1 for r in robots.values() if r.confirmed)

            for idx in range(len(detections)):
                if idx in assigned_dets:
                    continue
                cx, cy, x1, y1, x2, y2 = detections[idx]
                det_emb  = det_embeddings[idx]
                det_alln = det_alliances[idx]

                # Skip near-duplicate (occlusion) detections
                if any(np.hypot(cx - r.get_pos()[0], cy - r.get_pos()[1]) < MATCH_DISTANCE * 0.7
                       for r in robots.values() if r.visible):
                    continue

                active_ids = set(robots.keys())
                lost_ids   = [rid for rid, p in portfolio_registry.items()
                              if rid not in active_ids and p.snapshot is not None]

                matched = False

                # Try embedding re-ID against lost robots
                if lost_ids and det_emb is not None:
                    best_id, score = find_best_reid_match(
                        det_emb, det_alln, cx, cy, lost_ids,
                        force=(confirmed_count >= MAX_ROBOTS)
                    )
                    if best_id is not None:
                        robot = RobotTrack(best_id, cx, cy, alliance_color(portfolio_registry[best_id].get_alliance()))
                        robots[best_id] = robot
                        robot.update(cx, cy, bbox=(x1, y1, x2, y2))
                        robot.reid_flash = 12
                        # Re-ID after being lost — always verify color on re-emergence
                        robot.start_color_verify()
                        print(f"[Defense] Robot #{best_id} re-ID'd (score={score:.2f}) — color verify started")
                        confirmed_count = sum(1 for r in robots.values() if r.confirmed)
                        matched = True

                if matched:
                    continue

                # At cap — force assign to closest missing confirmed robot
                if confirmed_count >= MAX_ROBOTS:
                    missing = [r for r in robots.values() if r.confirmed and not r.visible]
                    if missing:
                        closest = min(missing, key=lambda r: np.hypot(
                            cx - r.get_pos()[0], cy - r.get_pos()[1]))
                        closest.update(cx, cy, bbox=(x1, y1, x2, y2))
                        closest.reid_flash = 8
                    continue

                # Per-alliance cap: max 3 robots per color
                # get_alliance() returns the permanent locked value if set
                if det_alln in ("red", "blue"):
                    alliance_count = sum(
                        1 for r in robots.values()
                        if r.confirmed and r.portfolio.get_alliance() == det_alln)
                    if alliance_count >= 3:
                        continue   # already have 3 of this color, skip

                # Spawn new robot — color is alliance color immediately
                if next_robot_id <= MAX_ROBOTS:
                    spawn_color = alliance_color(det_alln)
                    robot = RobotTrack(next_robot_id, cx, cy, spawn_color)
                    robots[next_robot_id] = robot
                    p = robot.portfolio
                    p.last_bumper_read_frame = frame_count
                    key = f"robot_{next_robot_id}_frame_{frame_count}"
                    request_bumper_read(frame, x1, y1, x2, y2, key)
                    next_robot_id  += 1
                    confirmed_count = sum(1 for r in robots.values() if r.confirmed)

        # ── Trigger selection pause when first confirmed robots appear ───
        if (selection_state == "waiting" and field_ready and
                sum(1 for r in robots.values() if r.confirmed) > 0):
            selection_state = "selecting"
            paused          = True
            print("[Select] First robots detected — paused for selection")

        # ── Lost track management ────────────────────────────────────────
        remove_ids = []
        for rid, robot in robots.items():
            if not robot.visible and not robot.in_blind_zone:
                robot.missing_frames += 1
                px, py = robot.get_pos()
                if point_in_any_zone(px, py) >= 0:
                    robot.in_blind_zone = True

            if not robot.confirmed and robot.missing_frames > MIN_HITS * 2:
                remove_ids.append(rid)
                continue

            if robot.confirmed and not robot.in_blind_zone and robot.missing_frames >= MAX_MISSING:
                if robot.missing_frames == MAX_MISSING:
                    robot.freeze_portfolio()
                remove_ids.append(rid)
                continue

        for rid in remove_ids:
            del robots[rid]

    # ── Build darkened display ────────────────────────────────────────────
    # Include any confirmed robot bboxes too (in case they were matched via tracks)
    visible_bboxes = list(raw_bboxes)
    for robot in robots.values():
        if robot.confirmed and robot.visible and robot.last_bbox is not None:
            x1, y1, x2, y2 = robot.last_bbox
            bb = (int(x1), int(y1), int(x2), int(y2))
            if bb not in visible_bboxes:
                visible_bboxes.append(bb)

    display = apply_darkened_display(frame, visible_bboxes)
    draw_blind_zones(display)

    # ── Selection overlay ─────────────────────────────────────────────────
    _selection_bboxes.clear()
    if selection_state == "selecting":
        # Draw a prominent instruction banner
        banner = "CLICK A ROBOT TO TRACK"
        (bw, bh), _ = cv2.getTextSize(banner, cv2.FONT_HERSHEY_SIMPLEX, 1.1, 3)
        bx = (DISPLAY_W - bw) // 2
        cv2.rectangle(display, (bx-12, 8), (bx+bw+12, bh+24), (0,0,0), -1)
        cv2.putText(display, banner, (bx, bh+14),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.1, (0, 255, 128), 3)

        # Highlight each confirmed robot with a clickable highlight box
        for rid, robot in robots.items():
            if not robot.confirmed or robot.last_bbox is None:
                continue
            x1,y1,x2,y2 = (int(v*video_scale) for v in robot.last_bbox)
            # Bright white pulsing border
            cv2.rectangle(display, (x1-4, y1-4), (x2+4, y2+4), (0,255,128), 4)
            cv2.rectangle(display, (x1,   y1),   (x2,   y2),   (255,255,255), 2)
            label = robot.portfolio.display_label()
            cv2.putText(display, f"[{label}]", (x1+4, y1-8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,128), 2)
            # Store display-scale bbox for click detection
            _selection_bboxes.append((x1-4, y1-4, x2+4, y2+4, rid))

    # Field crop polygon UI -- video_pts are raw video coords; display is also raw frame size
    for pt in video_pts:
        cv2.circle(display, (int(pt[0]), int(pt[1])), 8, (0, 255, 255), -1)
        cv2.circle(display, (int(pt[0]), int(pt[1])), 8, (0, 0, 0), 2)
    if len(video_pts) == 4:
        cv2.polylines(display, [np.array(video_pts, dtype=np.int32)],
                      isClosed=True, color=(0, 255, 0), thickness=2)
    if drawing_zone:
        bz_msg = f"Blind zone: {len(active_zone)} pts — Enter to close"
        cv2.putText(display, bz_msg,
                    (10, display.shape[0] - 70), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0,200,255), 2)

    # ── Thin grey boxes around all raw detections ────────────────────────
    for (x1, y1, x2, y2) in raw_bboxes:
        cv2.rectangle(display, (x1, y1), (x2, y2), (160, 160, 160), 1)

    # ── Draw confirmed robots ─────────────────────────────────────────────
    for rid, robot in robots.items():
        if not robot.confirmed:
            continue

        # In tracking mode, dim non-selected robots
        is_tracked = (selection_state == "tracking" and rid == selected_robot_id)
        if selection_state == "tracking" and not is_tracked:
            # Draw a faint ghost only
            px, py = robot.get_pos()
            gc = (80, 80, 80)
            cv2.circle(display, (px, py), 8, gc, 1)
            continue

        px, py = robot.get_pos()
        vx, vy = robot.get_vel()
        alln   = robot.portfolio.get_alliance()
        label  = robot.portfolio.display_label()

        # Keep robot.color in sync with resolved alliance
        box_color = alliance_color(alln)
        if alln != "unknown":
            robot.color = box_color

        col    = robot.color   # for trail / ghost (may still be grey if unknown)
        border = (255, 255, 255) if robot.reid_flash > 0 else box_color
        bw     = 4 if robot.reid_flash > 0 else 3

        if robot.visible and robot.last_bbox is not None:
            x1, y1, x2, y2 = (int(v) for v in robot.last_bbox)
            robot.trail.append((px, py))
            robot.trail = robot.trail[-TRAIL_LEN:]

            # Main bounding box — thick, alliance color
            cv2.rectangle(display, (x1, y1), (x2, y2), box_color, bw)

            # White flash border on re-ID
            if robot.reid_flash > 0:
                cv2.rectangle(display, (x1-2, y1-2), (x2+2, y2+2), (255,255,255), 2)
                robot.reid_flash -= 1

            # Label badge — cyan if bumper locked, yellow if verifying color, white if pending
            if robot.needs_color_verify:
                lbl_color = (0, 220, 255)   # yellow — actively verifying
            elif robot.portfolio.bumper_locked:
                lbl_color = (50, 230, 255)  # cyan — fully confirmed
            else:
                lbl_color = (230, 230, 230) # white — pending
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
            cv2.rectangle(display, (x1, y1 - th - 10), (x1 + tw + 8, y1), (0,0,0), -1)
            cv2.putText(display, label, (x1+4, y1-5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, lbl_color, 2)

            # Alliance letter top-right of box
            alln_char = alln[:1].upper() if alln != "unknown" else "?"
            cv2.putText(display, alln_char, (x2-18, y1+18),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, box_color, 2)

            draw_velocity_arrow(display, px, py, vx, vy, box_color)
            draw_trail(display, robot.trail, col)

        elif robot.in_blind_zone:
            draw_trail(display, robot.trail, col, ghost=True)
            cv2.circle(display, (px, py), 14, col, 2)
            cv2.putText(display, f"{label} [BLIND]", (px+18, py+5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, col, 2)

        else:
            conf = robot.confidence()
            robot.trail.append((px, py))
            robot.trail = robot.trail[-TRAIL_LEN:]
            draw_trail(display, robot.trail, col, ghost=True)
            draw_decay_circle(display, px, py, col, conf)
            gc = tuple(int(v*conf) for v in col)
            cv2.line(display, (px-6,py-6), (px+6,py+6), gc, 2)
            cv2.line(display, (px+6,py-6), (px-6,py+6), gc, 2)
            draw_velocity_arrow(display, px, py, vx*conf, vy*conf, gc)
            cv2.putText(display, f"{label}?", (px+12, py-8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, gc, 1)

    # ── HUD ──────────────────────────────────────────────────────────────
    confirmed_count = sum(1 for r in robots.values() if r.confirmed)
    blind_count     = sum(1 for r in robots.values() if r.in_blind_zone)
    locked_bumpers  = sum(1 for p in portfolio_registry.values() if p.bumper_locked)
    pending_reads   = len(_pending_bumper_keys)

    hud = (f"Robots: {confirmed_count}/{MAX_ROBOTS}  Blind: {blind_count}  "
           f"Bumpers ID'd: {locked_bumpers}  OCR pending: {pending_reads}  "
           f"Frame: {frame_count}")
    if paused: hud += "  [PAUSED]"
    if selection_state == "selecting":
        hud += "  ← CLICK A ROBOT TO TRACK"
    elif selection_state == "tracking":
        tr = robots.get(selected_robot_id)
        tlabel = tr.portfolio.display_label() if tr else f"#{selected_robot_id}"
        hud += f"  | Tracking: {tlabel}  Coords: {len(tracked_coords)}"

    cv2.putText(display, hud,
                (10, display.shape[0]-32),
                cv2.FONT_HERSHEY_SIMPLEX, 0.46, (200,200,200), 1)

    # Bottom hint line — show save hint when tracking
    if selection_state == "tracking":
        hint = ("Ctrl+Click: blind zone | Space: pause | S: finish & save JSON | Q: quit")
    else:
        hint = ("Ctrl+Click: blind zone | Enter: close | Space: pause | Z: undo | C: clear | P: portfolios | Q: quit")
    cv2.putText(display, hint,
                (10, display.shape[0]-12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.38, (140,140,140), 1)

    # ── "Finish & Save" button (top-right) ───────────────────────────────
    if selection_state == "tracking":
        btn_label = "Finish & Save [S]"
        (tw, th), _ = cv2.getTextSize(btn_label, cv2.FONT_HERSHEY_SIMPLEX, 0.65, 2)
        bx1 = DISPLAY_W - tw - 24
        by1 = 10
        bx2 = DISPLAY_W - 6
        by2 = th + 26
        cv2.rectangle(display, (bx1, by1), (bx2, by2), (30, 180, 30), -1)
        cv2.rectangle(display, (bx1, by1), (bx2, by2), (80, 255, 80), 2)
        cv2.putText(display, btn_label, (bx1+8, by2-8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255,255,255), 2)

    cv2.imshow("Video", cv2.resize(display, (DISPLAY_W, DISPLAY_H)))

    key = cv2.waitKey(1) & 0xFF
    if   key == ord('q'):  break
    elif key == ord('s') and selection_state == "tracking":
        save_and_map()
        break   # field window took over; exit main loop cleanly
    elif key == ord(' '):  paused = not paused
    elif key == 13:
        if drawing_zone and len(active_zone) >= 3:
            blind_zones.append(np.array(active_zone, dtype=np.int32))
            print(f"Blind zone {len(blind_zones)} saved")
        active_zone = []; drawing_zone = False
    elif key == 27:
        active_zone = []; drawing_zone = False
    elif key == ord('z'):
        if blind_zones: blind_zones.pop(); print("Last blind zone removed")
    elif key == ord('c'):
        robots.clear()
        next_robot_id = 1
        portfolio_registry.clear()
        print("Tracks cleared")
    elif key == ord('p'):
        print("\n=== PORTFOLIO REGISTRY ===")
        for rid, p in sorted(portfolio_registry.items()):
            print(p.summary())
        print("==========================\n")

cap.release()
cv2.destroyAllWindows()