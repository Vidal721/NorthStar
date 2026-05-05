import cv2
import numpy as np
from collections import defaultdict
from ultralytics import YOLO

# =====================
# CONFIG
# =====================
MODEL_PATH    = "best.pt"
VIDEO_PATH    = "video.mp4"
FIELD_IMAGE   = "field.png"
CONF          = 0.15    # raised — kills weak ghost detections
MAX_DET       = 10       # hard cap on detections per frame
MIN_HITS      = 3        # robot must appear N frames before we draw it
TRAIL_LEN     = 90       # frames of trail history
TRAIL_FADE    = True

# =====================
# LOAD
# =====================
model = YOLO(MODEL_PATH)

field = cv2.imread(FIELD_IMAGE)
if field is None:
    field = np.zeros((800, 1200, 3), dtype=np.uint8)
field_h, field_w = field.shape[:2]

# =====================
# STATE
# =====================
video_pts = []
field_pts = []
H     = None
H_inv = None

def id_color(tid):
    np.random.seed(int(tid) * 137 + 42)
    return tuple(int(c) for c in np.random.randint(80, 255, 3))

field_trails  = defaultdict(list)   # id -> [(mx,my), ...]
video_trails  = defaultdict(list)   # id -> [(cx,cy), ...]
hit_count     = defaultdict(int)    # id -> consecutive frame count
seen_ids      = set()               # IDs that passed MIN_HITS

# =====================
# MOUSE
# =====================
def mouse_video(event, x, y, flags, param):
    if event == cv2.EVENT_LBUTTONDOWN and len(video_pts) < 4:
        video_pts.append([x, y])
        print(f"Video point {len(video_pts)}: ({x}, {y})")

def mouse_field(event, x, y, flags, param):
    if event == cv2.EVENT_LBUTTONDOWN and len(field_pts) < 4:
        field_pts.append([x, y])
        print(f"Field point {len(field_pts)}: ({x}, {y})")

# =====================
# CAPTURE
# =====================
cap = cv2.VideoCapture(VIDEO_PATH)
ret, _ = cap.read()
if not ret:
    raise RuntimeError("Could not read video.")
cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

cv2.namedWindow("Video")
cv2.setMouseCallback("Video", mouse_video)
cv2.namedWindow("Field")
cv2.setMouseCallback("Field", mouse_field)

print("\nStep 1: Click 4 corners on VIDEO")
print("Step 2: Click matching 4 corners on FIELD")
print("Q = quit | R = reset\n")

# =====================
# HELPERS
# =====================
def draw_trail(img, trail, color, max_r=6):
    n = len(trail)
    if n < 2:
        return
    for i in range(1, n):
        alpha = i / n
        c = tuple(int(ch * alpha) for ch in color) if TRAIL_FADE else color
        thickness = max(1, int(max_r * alpha))
        cv2.line(img, trail[i - 1], trail[i], c, thickness)

def hud(img, lines, x=10, y0=25, scale=0.55, color=(255,255,0)):
    for i, line in enumerate(lines):
        y = y0 + i * 22
        cv2.putText(img, line, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0,0,0), 3)
        cv2.putText(img, line, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color,   1)

def map_point(H_mat, x, y):
    pt = np.array([[[float(x), float(y)]]], dtype=np.float32)
    out = cv2.perspectiveTransform(pt, H_mat)
    return int(out[0][0][0]), int(out[0][0][1])

# =====================
# MAIN LOOP
# =====================
frame_count  = 0
active_ids   = set()

while True:
    ret, frame = cap.read()
    if not ret:
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        frame_count = 0
        continue

    frame_count += 1
    display_video = frame.copy()
    display_field = field.copy()

    # Build homography once we have 4+4 points
    if len(video_pts) == 4 and len(field_pts) == 4 and H is None:
        src = np.array(video_pts, dtype=np.float32)
        dst = np.array(field_pts, dtype=np.float32)
        H,     _ = cv2.findHomography(src, dst)
        H_inv, _ = cv2.findHomography(dst, src)
        print("\nHomography ready.\n")

    # Draw calibration picks
    for i, p in enumerate(video_pts):
        cv2.circle(display_video, tuple(p), 7, (0,255,255), -1)
        cv2.putText(display_video, str(i+1), (p[0]+9, p[1]-9),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0,255,255), 2)
    for i, p in enumerate(field_pts):
        cv2.circle(display_field, tuple(p), 7, (0,255,255), -1)
        cv2.putText(display_field, str(i+1), (p[0]+9, p[1]-9),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0,255,255), 2)

    # =====================
    # TRACK
    # =====================
    results = model.track(
        frame,
        persist=True,
        conf=CONF,
        max_det=MAX_DET,
        tracker="bytetrack.yaml"
    )[0]

    current_ids = set()

    if results.boxes is not None and results.boxes.id is not None:
        for i in range(len(results.boxes)):
            x1, y1, x2, y2 = results.boxes.xyxy[i].cpu().numpy()
            tid  = int(results.boxes.id[i].item())
            conf = float(results.boxes.conf[i].item())

            # Increment hit counter; only commit after MIN_HITS
            hit_count[tid] += 1
            if hit_count[tid] < MIN_HITS:
                continue
            seen_ids.add(tid)

            color = id_color(tid)
            cx = int((x1 + x2) / 2)
            cy = int(y2)   # foot point for ground plane
            current_ids.add(tid)

            # --- Video ---
            cv2.rectangle(display_video, (int(x1),int(y1)), (int(x2),int(y2)), color, 2)
            label = f"#{tid}  {conf:.2f}"
            (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(display_video, (int(x1), int(y1)-lh-8),
                          (int(x1)+lw+6, int(y1)), color, -1)
            cv2.putText(display_video, label, (int(x1)+3, int(y1)-4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,0,0), 1)

            # Video trail — append then draw
            video_trails[tid].append((cx, cy))
            if len(video_trails[tid]) > TRAIL_LEN:
                video_trails[tid].pop(0)
            draw_trail(display_video, video_trails[tid], color, max_r=3)

            # --- Field ---
            if H is not None:
                mx, my = map_point(H, cx, cy)
                if 0 <= mx < field_w and 0 <= my < field_h:
                    # Field trail — append then draw
                    field_trails[tid].append((mx, my))
                    if len(field_trails[tid]) > TRAIL_LEN:
                        field_trails[tid].pop(0)
                    draw_trail(display_field, field_trails[tid], color, max_r=5)

                    # Dot
                    cv2.circle(display_field, (mx, my), 10, color, -1)
                    cv2.circle(display_field, (mx, my), 10, (0,0,0), 1)

                    # ID label
                    cv2.putText(display_field, f"#{tid}", (mx+13, my+5),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,0,0), 3)
                    cv2.putText(display_field, f"#{tid}", (mx+13, my+5),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

    # Decay hit counters for IDs not seen this frame
    for tid in list(hit_count):
        if tid not in current_ids:
            hit_count[tid] = max(0, hit_count[tid] - 1)

    active_ids = current_ids & seen_ids

    # =====================
    # BIDIRECTIONAL VERIFY
    # (shows field calib pts projected back onto video as magenta X)
    # =====================
    if H_inv is not None:
        for p in field_pts:
            bx, by = map_point(H_inv, p[0], p[1])
            if 0 <= bx < display_video.shape[1] and 0 <= by < display_video.shape[0]:
                cv2.drawMarker(display_video, (bx,by), (255,0,255),
                               cv2.MARKER_CROSS, 16, 2)

    # =====================
    # HUD
    # =====================
    hom_status = "ACTIVE"  if H is not None else "PENDING"
    hom_color  = (0,255,0) if H is not None else (0,165,255)

    hud(display_video, [
        f"Video pts : {len(video_pts)}/4   Field pts : {len(field_pts)}/4",
        f"Homography: {hom_status}",
        f"Robots    : {len(active_ids)} live  ({len(seen_ids)} total seen)",
        f"Frame     : {frame_count}",
    ], color=hom_color)

    hud(display_field, [
        f"Homography: {hom_status}",
        f"Robots: {len(active_ids)} live",
    ], color=hom_color)

    # Legend
    if seen_ids:
        sorted_ids = sorted(seen_ids)
        lx = field_w - 130
        ly = 10
        bg_h = len(sorted_ids) * 22 + 8
        cv2.rectangle(display_field, (lx-6, ly-4), (field_w-4, ly+bg_h), (30,30,30), -1)
        for j, tid in enumerate(sorted_ids):
            c  = id_color(tid)
            sy = ly + j * 22
            alive = tid in active_ids
            cv2.rectangle(display_field, (lx, sy), (lx+14, sy+14), c, -1)
            label = f"Robot #{tid}" + ("" if alive else " [lost]")
            cv2.putText(display_field, label, (lx+18, sy+12),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42,
                        (220,220,220) if alive else (120,120,120), 1)

    cv2.imshow("Video", display_video)
    cv2.imshow("Field", display_field)

    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'):
        break
    elif key == ord('r'):
        video_pts.clear()
        field_pts.clear()
        field_trails.clear()
        video_trails.clear()
        hit_count.clear()
        seen_ids.clear()
        H = H_inv = None
        print("Reset.")

cap.release()
cv2.destroyAllWindows()