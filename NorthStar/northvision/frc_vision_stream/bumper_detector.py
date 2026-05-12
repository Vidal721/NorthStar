import cv2
import numpy as np
from ultralytics import YOLO
from filterpy.kalman import KalmanFilter
from scipy.optimize import linear_sum_assignment

# =====================
# CONFIG
# =====================
MODEL_PATH   = "best.pt"
VIDEO_PATH   = "video.mp4"
FIELD_IMAGE  = "field.png"

CONF           = 0.15
MAX_DET        = 10
MIN_HITS       = 3
TRAIL_LEN      = 90
MAX_MISSING    = 30
MATCH_DISTANCE = 90
MAX_ROBOTS     = 6

BLIND_ZONE_COLOR = (0, 80, 200)
BLIND_ZONE_ALPHA = 0.25

# =====================
# LOAD
# =====================
model = YOLO(MODEL_PATH)

field = cv2.imread(FIELD_IMAGE)
if field is None:
    field = np.zeros((800, 1200, 3), dtype=np.uint8)
field_h, field_w = field.shape[:2]

# =====================
# GLOBALS
# =====================
video_pts   = []
field_pts   = []
H           = None
H_inv       = None

next_robot_id = 1
frame_count   = 0
robots        = {}

blind_zones  = []   # list of np.array (N,2) full-res polys
active_zone  = []   # points being drawn right now
drawing_zone = False

pending_id_request = None   # dict when disambiguation needed, else None
paused             = False
_active_det_idx    = None   # which detection box the user clicked last

# =====================
# ROBOT CLASS
# =====================
class RobotTrack:
    def __init__(self, robot_id, x, y, color):
        self.id             = robot_id
        self.color          = color
        self.trail_video    = []
        self.trail_field    = []
        self.missing_frames = 0
        self.visible        = True
        self.hit_count      = 0
        self.confirmed      = False
        self.in_blind_zone  = False

        self.kf   = KalmanFilter(dim_x=4, dim_z=2)
        dt        = 1.0
        self.kf.F = np.array([[1,0,dt,0],[0,1,0,dt],[0,0,1,0],[0,0,0,1]], dtype=float)
        self.kf.H = np.array([[1,0,0,0],[0,1,0,0]], dtype=float)
        self.kf.P *= 100
        self.kf.R *= 5
        self.kf.Q *= 0.1
        self.kf.x = np.array([x, y, 0, 0], dtype=float).reshape(4, 1)

    def predict(self):
        self.kf.predict()
        return int(self.kf.x[0, 0]), int(self.kf.x[1, 0])

    def update(self, x, y):
        self.kf.update(np.array([x, y], dtype=float))
        self.missing_frames = 0
        self.visible        = True
        self.in_blind_zone  = False
        self.hit_count     += 1
        if self.hit_count >= MIN_HITS:
            self.confirmed = True

    def get_position(self):
        return int(self.kf.x[0, 0]), int(self.kf.x[1, 0])

    def get_velocity(self):
        return float(self.kf.x[2, 0]), float(self.kf.x[3, 0])

    def confidence(self):
        return max(0.0, 1.0 - self.missing_frames / MAX_MISSING)

# =====================
# HELPERS
# =====================
def id_color(tid):
    np.random.seed(int(tid) * 137 + 42)
    return tuple(int(c) for c in np.random.randint(80, 255, 3))

def map_point(H_mat, x, y):
    pt  = np.array([[[float(x), float(y)]]], dtype=np.float32)
    out = cv2.perspectiveTransform(pt, H_mat)
    return int(out[0][0][0]), int(out[0][0][1])

def draw_trail(img, trail, color, ghost=False):
    if len(trail) < 2:
        return
    for i in range(1, len(trail)):
        alpha = i / len(trail)
        c     = tuple(int(v * (0.35 if ghost else 1.0) * alpha) for v in color)
        cv2.line(img, trail[i-1], trail[i], c, max(1, int(2 * alpha)))

def draw_velocity_arrow(img, x, y, vx, vy, color, scale=4.0):
    if np.hypot(vx, vy) < 0.5:
        return
    cv2.arrowedLine(img, (x, y), (int(x + vx*scale), int(y + vy*scale)), color, 2, tipLength=0.3)

def draw_decay_circle(img, x, y, color, conf):
    cv2.circle(img, (x, y), int(8 + 16 * conf), tuple(int(v * conf) for v in color), 1)

def point_in_any_zone(x, y):
    for zi, zone in enumerate(blind_zones):
        if len(zone) >= 3:
            if cv2.pointPolygonTest(zone.astype(np.float32), (float(x), float(y)), False) >= 0:
                return zi
    return -1

def draw_blind_zones(img, scale=1.0):
    overlay = img.copy()
    for zone in blind_zones:
        if len(zone) < 2:
            continue
        scaled = (zone * scale).astype(np.int32)
        if len(zone) >= 3:
            cv2.fillPoly(overlay, [scaled], BLIND_ZONE_COLOR)
        cv2.polylines(overlay, [scaled], isClosed=(len(zone) >= 3), color=(0, 140, 255), thickness=2)
    cv2.addWeighted(overlay, BLIND_ZONE_ALPHA, img, 1 - BLIND_ZONE_ALPHA, 0, img)

    if active_zone:
        scaled = (np.array(active_zone, dtype=np.float32) * scale).astype(np.int32)
        for pt in scaled:
            cv2.circle(img, tuple(pt), 5, (0, 200, 255), -1)
        if len(active_zone) >= 2:
            cv2.polylines(img, [scaled], isClosed=False, color=(0, 200, 255), thickness=1)

def create_assignment_cost(tracks, detections):
    cost = np.zeros((len(tracks), len(detections)), dtype=np.float32)
    for i, track in enumerate(tracks):
        tx, ty = track.get_position()
        for j, (dx, dy) in enumerate(detections):
            cost[i, j] = np.linalg.norm([tx - dx, ty - dy])
    return cost

# =====================
# DISAMBIGUATION UI
# =====================
def draw_id_request(img, req):
    h, w = img.shape[:2]

    overlay = img.copy()
    cv2.rectangle(overlay, (0, 0), (w, h), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.55, img, 0.45, 0, img)

    dets  = req["detections"]
    cands = req["candidates"]
    sel   = req["selected"]

    cv2.putText(img, "BLIND ZONE EXIT — Identify robots", (w//2 - 220, 40),
                cv2.FONT_HERSHEY_DUPLEX, 0.9, (255, 255, 255), 2)

    for di, det in enumerate(dets):
        cx, cy, x1, y1, x2, y2 = det
        sx1, sy1 = int(x1 * video_scale), int(y1 * video_scale)
        sx2, sy2 = int(x2 * video_scale), int(y2 * video_scale)
        assigned_rid = sel.get(di)
        box_color    = id_color(assigned_rid) if assigned_rid else (200, 200, 200)
        cv2.rectangle(img, (sx1, sy1), (sx2, sy2), box_color, 3)
        label = f"Robot #{assigned_rid}" if assigned_rid else f"Det {di+1} — click to select"
        cv2.putText(img, label, (sx1, sy1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, box_color, 2)

    panel_x = w - 230
    cv2.rectangle(img, (panel_x - 10, 60), (w - 10, 60 + len(cands)*60 + 20), (40, 40, 40), -1)
    cv2.putText(img, "Parked robots:", (panel_x, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 180, 180), 1)

    req["button_rects"] = []
    for bi, rid in enumerate(cands):
        bx1, by1 = panel_x, 100 + bi * 60
        bx2, by2 = w - 20, by1 + 45
        taken     = rid in sel.values()
        btn_color = id_color(rid) if not taken else (60, 60, 60)
        cv2.rectangle(img, (bx1, by1), (bx2, by2), btn_color, -1)
        cv2.putText(img, f"Robot #{rid}", (bx1 + 10, by1 + 28),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
        req["button_rects"].append((bx1, by1, bx2, by2, rid))

    all_assigned  = len(sel) == len(dets)
    confirm_color = (0, 200, 80) if all_assigned else (60, 60, 60)
    cy1 = h - 80
    cv2.rectangle(img, (w//2 - 100, cy1), (w//2 + 100, cy1 + 50), confirm_color, -1)
    cv2.putText(img, "CONFIRM", (w//2 - 55, cy1 + 33),
                cv2.FONT_HERSHEY_DUPLEX, 0.8, (255, 255, 255), 2)
    req["confirm_rect"] = (w//2 - 100, cy1, w//2 + 100, cy1 + 50)

    cv2.putText(img, "1. Click a detection box  2. Click a robot button  3. Confirm",
                (20, h - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (160, 160, 160), 1)
    return img

def handle_disambiguation_click(x, y, req):
    global _active_det_idx, pending_id_request, paused

    cx1, cy1, cx2, cy2 = req["confirm_rect"]
    if cx1 <= x <= cx2 and cy1 <= y <= cy2:
        if len(req["selected"]) == len(req["detections"]):
            for det_idx, rid in req["selected"].items():
                det      = req["detections"][det_idx]
                dcx, dcy = det[0], det[1]
                if rid in robots:
                    robots[rid].update(dcx, dcy)
            pending_id_request = None
            paused             = False
            _active_det_idx    = None
        return

    for di, det in enumerate(req["detections"]):
        _, _, x1, y1, x2, y2 = det
        sx1, sy1 = int(x1 * video_scale), int(y1 * video_scale)
        sx2, sy2 = int(x2 * video_scale), int(y2 * video_scale)
        if sx1 <= x <= sx2 and sy1 <= y <= sy2:
            _active_det_idx = di
            return

    if _active_det_idx is not None:
        for bx1, by1, bx2, by2, rid in req["button_rects"]:
            if bx1 <= x <= bx2 and by1 <= y <= by2:
                if rid not in req["selected"].values():
                    req["selected"][_active_det_idx] = rid
                    _active_det_idx = None
                return

# =====================
# MOUSE CALLBACKS
# =====================
def mouse_video(event, x, y, flags, param):
    global drawing_zone, active_zone

    if pending_id_request is not None and event == cv2.EVENT_LBUTTONDOWN:
        handle_disambiguation_click(x, y, pending_id_request)
        return

    ctrl_held = bool(flags & cv2.EVENT_FLAG_CTRLKEY)

    if event == cv2.EVENT_LBUTTONDOWN:
        if ctrl_held:
            active_zone.append([int(x / video_scale), int(y / video_scale)])
            drawing_zone = True
        elif not drawing_zone and len(video_pts) < 4:
            video_pts.append([int(x / video_scale), int(y / video_scale)])

def mouse_field(event, x, y, flags, param):
    if event == cv2.EVENT_LBUTTONDOWN and len(field_pts) < 4:
        field_pts.append([int(x / field_scale_disp), int(y / field_scale_disp)])

# =====================
# CAPTURE + DISPLAY SCALE
# =====================
cap = cv2.VideoCapture(VIDEO_PATH)
ret, _first = cap.read()
if not ret:
    raise RuntimeError("Could not read video")
frame_h, frame_w = _first.shape[:2]
cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

DISPLAY_H        = 720
video_scale      = DISPLAY_H / frame_h
DISPLAY_W        = int(frame_w * video_scale)

FIELD_DISPLAY_H  = 600
field_scale_disp = FIELD_DISPLAY_H / field_h
FIELD_DISPLAY_W  = int(field_w * field_scale_disp)

cv2.namedWindow("Video")
cv2.namedWindow("Field")
cv2.setMouseCallback("Video", mouse_video)
cv2.setMouseCallback("Field", mouse_field)

# =====================
# MAIN LOOP
# =====================
while True:
    if not paused:
        ret, frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue
        frame_count += 1

    display_video = frame.copy()
    display_field = field.copy()

    # --- Homography ---
    if len(video_pts) == 4 and len(field_pts) == 4 and H is None:
        src      = np.array(video_pts, dtype=np.float32)
        dst      = np.array(field_pts, dtype=np.float32)
        H, _     = cv2.findHomography(src, dst)
        H_inv, _ = cv2.findHomography(dst, src)
        print("Homography ready")

    # --- Draw blind zones ---
    draw_blind_zones(display_video, scale=1.0)

    # --- Calibration overlays ---
    for pt in video_pts:
        cv2.circle(display_video, tuple(pt), 6, (0, 255, 255), -1)
    for pt in field_pts:
        cv2.circle(display_field, tuple(pt), 6, (0, 255, 255), -1)
    if len(video_pts) == 4:
        cv2.polylines(display_video, [np.array(video_pts, dtype=np.int32)],
                      isClosed=True, color=(0, 255, 0), thickness=2)
    if len(video_pts) < 4:
        cv2.putText(display_video, f"Click {4-len(video_pts)} more point(s) on video",
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
    if len(field_pts) < 4:
        cv2.putText(display_field, f"Click {4-len(field_pts)} more point(s) on field",
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
    if drawing_zone:
        cv2.putText(display_video, f"Blind zone: {len(active_zone)} pts — Enter to close, Esc to cancel",
                    (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 200, 255), 2)

    # --- Predict ---
    if not paused:
        for robot in robots.values():
            robot.predict()
            robot.visible = False

    # --- YOLO + ByteTrack ---
    detections = []
    if not paused:
        results = model.track(frame, persist=True, conf=CONF,
                              max_det=MAX_DET, tracker="bytetrack.yaml")[0]
        if results.boxes is not None:
            for i in range(len(results.boxes)):
                x1, y1, x2, y2 = results.boxes.xyxy[i].cpu().numpy()
                cx, cy = int((x1+x2)/2), int(y2)
                if len(video_pts) == 4:
                    poly = np.array(video_pts, dtype=np.float32)
                    if cv2.pointPolygonTest(poly, (float(cx), float(cy)), False) < 0:
                        continue
                detections.append((cx, cy, x1, y1, x2, y2))

    # --- Assign detections ---
    if not paused:
        robot_list    = list(robots.values())
        assigned_dets = set()

        if robot_list and detections:
            det_pos     = [(d[0], d[1]) for d in detections]
            cost_matrix = create_assignment_cost(robot_list, det_pos)
            rows, cols  = linear_sum_assignment(cost_matrix)

            for r, c in zip(rows, cols):
                robot = robot_list[r]
                # Adaptive gate: expands as track has been missing longer
                adaptive_gate = MATCH_DISTANCE + robot.missing_frames * 4
                if cost_matrix[r, c] >= adaptive_gate:
                    continue
                cx, cy, x1, y1, x2, y2 = detections[c]
                robot.update(cx, cy)
                assigned_dets.add(c)

                if not robot.confirmed:
                    continue

                robot.trail_video.append((cx, cy))
                robot.trail_video = robot.trail_video[-TRAIL_LEN:]
                draw_trail(display_video, robot.trail_video, robot.color)
                vx, vy = robot.get_velocity()
                draw_velocity_arrow(display_video, cx, cy, vx, vy, robot.color)
                cv2.rectangle(display_video, (int(x1),int(y1)), (int(x2),int(y2)), robot.color, 2)
                cv2.putText(display_video, f"Robot #{robot.id}",
                            (int(x1), int(y1)-10), cv2.FONT_HERSHEY_SIMPLEX, 0.55, robot.color, 2)

                if H is not None:
                    mx, my = map_point(H, cx, cy)
                    if 0 <= mx < field_w and 0 <= my < field_h:
                        robot.trail_field.append((mx, my))
                        robot.trail_field = robot.trail_field[-TRAIL_LEN:]
                        draw_trail(display_field, robot.trail_field, robot.color)
                        cv2.circle(display_field, (mx, my), 10, robot.color, -1)
                        cv2.putText(display_field, f"#{robot.id}", (mx+14, my+4),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, robot.color, 2)
                        draw_velocity_arrow(display_field, mx, my, vx, vy, robot.color, scale=3.0)

        # --- Unassigned detections: blind zone exit or new robot ---
        unassigned = [detections[i] for i in range(len(detections)) if i not in assigned_dets]

        # Purge unconfirmed tracks that have been missing too long
        stale_unconfirmed = [rid for rid, r in robots.items()
                             if not r.confirmed and r.missing_frames > MIN_HITS * 2]
        for rid in stale_unconfirmed:
            del robots[rid]

        if unassigned:
            confirmed_count = sum(1 for r in robots.values() if r.confirmed)

            # Blind zone parked robots take priority
            parked = [r for r in robots.values() if r.in_blind_zone and r.confirmed]

            for det in unassigned:
                cx, cy = det[0], det[1]

                # --- Step 1: try to match to a blind-zone parked robot by proximity ---
                if parked:
                    parked_by_dist = sorted(
                        parked,
                        key=lambda r: np.linalg.norm([cx - r.get_position()[0], cy - r.get_position()[1]])
                    )
                    best = parked_by_dist[0]
                    second_best_dist = (
                        np.linalg.norm([cx - parked_by_dist[1].get_position()[0],
                                        cx - parked_by_dist[1].get_position()[1]])
                        if len(parked_by_dist) > 1 else 9999
                    )
                    best_dist = np.linalg.norm([cx - best.get_position()[0], cy - best.get_position()[1]])

                    if len(parked) == 1 or second_best_dist > best_dist * 1.5:
                        # Clear winner — auto reassign
                        best.update(cx, cy)
                        parked.remove(best)
                        print(f"Auto-reassigned Robot #{best.id} from blind zone")
                        continue
                    else:
                        # Ambiguous blind zone exit — ask user
                        pending_id_request = {
                            "detections": [det],
                            "candidates": [r.id for r in parked_by_dist[:2]],
                            "selected":   {},
                            "button_rects": [],
                            "confirm_rect": (0,0,0,0),
                        }
                        paused = True
                        continue

                # --- Step 2: if at robot cap, match to nearest missing confirmed track ---
                if confirmed_count >= MAX_ROBOTS:
                    missing = [r for r in robots.values() if r.confirmed and not r.visible]
                    if missing:
                        nearest = min(missing, key=lambda r: np.linalg.norm(
                            [cx - r.get_position()[0], cy - r.get_position()[1]]))
                        nearest_dist = np.linalg.norm(
                            [cx - nearest.get_position()[0], cy - nearest.get_position()[1]])

                        # Find second nearest to check ambiguity
                        second_dist = min(
                            (np.linalg.norm([cx - r.get_position()[0], cy - r.get_position()[1]])
                             for r in missing if r.id != nearest.id),
                            default=9999
                        )

                        if second_dist > nearest_dist * 1.5:
                            # Confident — general zone reassign
                            nearest.update(cx, cy)
                            print(f"General zone reassign: Robot #{nearest.id}")
                        else:
                            # Two missing robots nearby — ask user
                            top2 = sorted(missing, key=lambda r: np.linalg.norm(
                                [cx - r.get_position()[0], cy - r.get_position()[1]]))[:2]
                            pending_id_request = {
                                "detections": [det],
                                "candidates": [r.id for r in top2],
                                "selected":   {},
                                "button_rects": [],
                                "confirm_rect": (0,0,0,0),
                            }
                            paused = True
                    # Never spawn — we know there are exactly MAX_ROBOTS robots
                    continue

                # --- Step 3: genuinely new robot (we have fewer than MAX_ROBOTS confirmed) ---
                # Only if this detection is far from all existing tracks
                min_dist_existing = min(
                    (np.linalg.norm([cx - r.get_position()[0], cy - r.get_position()[1]])
                     for r in robots.values()),
                    default=9999
                )
                if min_dist_existing < MATCH_DISTANCE * 1.5:
                    continue  # Too close to an existing track — noise or occlusion

                robot = RobotTrack(next_robot_id, cx, cy, id_color(next_robot_id))
                robots[next_robot_id] = robot
                next_robot_id += 1
                confirmed_count = sum(1 for r in robots.values() if r.confirmed)

        # --- Lost tracks ---
        remove_ids = []

        for rid, robot in robots.items():
            if not robot.visible and not robot.in_blind_zone:
                robot.missing_frames += 1
                px, py = robot.get_position()
                if point_in_any_zone(px, py) >= 0:
                    robot.in_blind_zone = True
                    print(f"Robot #{rid} entered blind zone")

            # Unconfirmed tracks expire quickly
            if not robot.confirmed and robot.missing_frames > MIN_HITS * 2:
                remove_ids.append(rid)
                continue

            # Confirmed tracks expire only if not blind-zone parked
            if robot.confirmed and robot.missing_frames > MAX_MISSING and not robot.in_blind_zone:
                remove_ids.append(rid)
                continue

            if not robot.confirmed or robot.visible:
                continue

            px, py = robot.get_position()
            vx, vy = robot.get_velocity()

            if robot.in_blind_zone:
                # Static marker — no decay
                cv2.circle(display_video, (px, py), 14, robot.color, 2)
                cv2.circle(display_video, (px, py), 5,  robot.color, -1)
                cv2.putText(display_video, f"#{rid} [BLIND]", (px+16, py+4),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, robot.color, 2)
                draw_trail(display_video, robot.trail_video, robot.color, ghost=True)

                if H is not None:
                    try:
                        mx, my = map_point(H, px, py)
                        if 0 <= mx < field_w and 0 <= my < field_h:
                            cv2.circle(display_field, (mx, my), 12, robot.color, 2)
                            cv2.putText(display_field, f"#{rid}?", (mx+14, my+4),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, robot.color, 1)
                    except Exception:
                        pass
            else:
                # Normal ghost + decay
                conf = robot.confidence()
                robot.trail_video.append((px, py))
                robot.trail_video = robot.trail_video[-TRAIL_LEN:]
                draw_trail(display_video, robot.trail_video, robot.color, ghost=True)
                draw_decay_circle(display_video, px, py, robot.color, conf)
                gc = tuple(int(v * conf) for v in robot.color)
                cv2.line(display_video, (px-6, py-6), (px+6, py+6), gc, 2)
                cv2.line(display_video, (px+6, py-6), (px-6, py+6), gc, 2)
                draw_velocity_arrow(display_video, px, py, vx*conf, vy*conf, gc)
                cv2.putText(display_video, f"#{rid}?", (px+10, py-8),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, gc, 1)

                if H is not None:
                    try:
                        mx, my = map_point(H, px, py)
                        if 0 <= mx < field_w and 0 <= my < field_h:
                            robot.trail_field.append((mx, my))
                            robot.trail_field = robot.trail_field[-TRAIL_LEN:]
                            draw_trail(display_field, robot.trail_field, robot.color, ghost=True)
                            draw_decay_circle(display_field, mx, my, robot.color, conf)
                            cv2.circle(display_field, (mx, my), 6,
                                       tuple(int(v*conf) for v in robot.color), 2)
                    except Exception:
                        pass

        for rid in remove_ids:
            del robots[rid]

    # --- Disambiguation overlay ---
    if pending_id_request is not None:
        display_video = draw_id_request(display_video, pending_id_request)

    # --- HUD ---
    confirmed_count = sum(1 for r in robots.values() if r.confirmed)
    blind_count     = sum(1 for r in robots.values() if r.in_blind_zone)
    hud = f"Robots: {confirmed_count}/{MAX_ROBOTS}  Blind: {blind_count}  Frame: {frame_count}"
    if paused:
        hud += "  [PAUSED — identify robots]"
    cv2.putText(display_video, hud,
                (10, display_video.shape[0] - 32),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
    cv2.putText(display_video, "Ctrl+Click: blind zone pt | Enter: close zone | Z: undo zone",
                (10, display_video.shape[0] - 12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.42, (140, 140, 140), 1)

    status = f"Calibrating... V:{len(video_pts)}/4  F:{len(field_pts)}/4" if H is None else "Tracking"
    cv2.putText(display_field, status, (10, field_h-12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)
    cv2.putText(display_field, f"Blind zones: {len(blind_zones)}", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 140, 255), 1)

    # --- Show ---
    cv2.imshow("Video", cv2.resize(display_video, (DISPLAY_W, DISPLAY_H)))
    cv2.imshow("Field", cv2.resize(display_field, (FIELD_DISPLAY_W, FIELD_DISPLAY_H)))

    key = cv2.waitKey(1) & 0xFF

    if key == ord('q'):
        break
    elif key == 13:   # Enter — close blind zone
        if drawing_zone and len(active_zone) >= 3:
            blind_zones.append(np.array(active_zone, dtype=np.int32))
            print(f"Blind zone {len(blind_zones)} saved ({len(active_zone)} pts)")
        active_zone  = []
        drawing_zone = False
    elif key == 27:   # Esc — cancel zone
        active_zone  = []
        drawing_zone = False
    elif key == ord('z'):
        if blind_zones:
            blind_zones.pop()
            print("Last blind zone removed")
    elif key == ord('r'):
        video_pts.clear(); field_pts.clear()
        H = H_inv = None
        print("Calibration reset")
    elif key == ord('c'):
        robots.clear()
        next_robot_id = 1
        print("Tracks cleared")

cap.release()
cv2.destroyAllWindows()