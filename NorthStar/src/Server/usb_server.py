#!/usr/bin/env python3
"""
935 Scout — USB Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Runs on the Raspberry Pi. Does three things automatically:

  1. TABLET WATCHER — polls `adb devices` every 2 s; when a
     new Fire tablet appears it immediately runs:
         adb -s <serial> reverse tcp:8765 tcp:8765
         adb -s <serial> reverse tcp:8766 tcp:8766
     and logs the event. Handles up to 6 tablets at once.
     Cleans up when a tablet is unplugged.

  2. SCOUTING DATA RECEIVER — HTTP on port 8765 (localhost).
     Tablets POST pipe-delimited payloads to /scout and the
     server saves them to data/scouting_database.json.

  3. FORM SERVER — HTTP on port 8766 (localhost).
     Serves the entire public/ folder so tablets can open
     http://localhost:8766 and get form.html with no WiFi.
     The ADB reverse tunnel makes localhost:8766 on the
     tablet map back to port 8766 on this Pi.

No manual adb reverse needed — just plug in the tablets.
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os
import signal
import subprocess
import threading
import time
import mimetypes
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

# ── Paths & ports ────────────────────────────────────────
BASE_DIR   = Path(__file__).parent.resolve()
PUBLIC_DIR = BASE_DIR / 'public'
DATA_FILE  = BASE_DIR / 'data' / 'scouting_database.json'

SCOUT_PORT    = 8765
FORM_PORT     = 8766
API_PORT      = 3000   # Server.js API (schema, data, chat, etc.)
MAX_TABLETS   = 6
POLL_INTERVAL = 2

os.makedirs(DATA_FILE.parent, exist_ok=True)

# ── Thread safety ────────────────────────────────────────
file_lock    = threading.Lock()
tablets_lock = threading.Lock()
connected_tablets: dict[str, datetime] = {}

# ── Shutdown event — set by SIGTERM or Ctrl+C ────────────
shutdown_event = threading.Event()


# ═══════════════════════════════════════════════════════
#  LOGGING
# ═══════════════════════════════════════════════════════
def _ts():
    return datetime.now().strftime('%H:%M:%S')

def log(tag, msg, color='\033[96m'):
    print(f"\033[90m[{_ts()}]\033[0m {color}[{tag}]\033[0m {msg}", flush=True)

def log_ok(tag, msg):   log(tag, msg, '\033[92m')
def log_warn(tag, msg): log(tag, msg, '\033[93m')
def log_err(tag, msg):  log(tag, msg, '\033[91m')


# ═══════════════════════════════════════════════════════
#  DATABASE
# ═══════════════════════════════════════════════════════
def read_db() -> list:
    if not DATA_FILE.exists():
        return []
    try:
        content = DATA_FILE.read_text().strip()
        return json.loads(content) if content else []
    except Exception as e:
        log_warn('DB', f'Could not read DB ({e}), starting fresh')
        return []

def write_db(data: list):
    tmp = str(DATA_FILE) + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, str(DATA_FILE))


# ═══════════════════════════════════════════════════════
#  PAYLOAD PARSER
# ═══════════════════════════════════════════════════════
def parse_payload(raw: str) -> dict:
    record = {}
    for part in raw.strip().split('|'):
        if ':' not in part:
            continue
        key, _, val = part.partition(':')
        key, val = key.strip(), val.strip()

        if   key == 'sc':   record['scouter']         = val
        elif key == 'mt':   record['matchNumber']      = val
        elif key == 'tm':
            try:    record['teamNumber'] = int(val)
            except: record['teamNumber'] = val
        elif key == 'al':   record['alliance']         = val
        elif key == 'fo':   record['fieldOrientation'] = 'flipped' if val == 'F' else 'normal'
        elif key == 'sp':   record['startPos']         = val
        elif key == 'rs':   record['robotStatus']      = val
        elif key == 'ev':
            try:    record['eventCount'] = int(val)
            except: record['eventCount'] = 0
        elif key == 'cl':   record['climbResult']      = val
        elif key == 'ct':   record['climbTiming']      = val
        elif key == 'fc':
            try:    record['foulsCaused'] = int(val)
            except: record['foulsCaused'] = 0
        elif key == 'cy':
            try:    record['teleop_cycles'] = int(val)
            except: record['teleop_cycles'] = 0
        elif key == 'cavg':
            try:    record['cycle_avg_sec'] = int(val)
            except: record['cycle_avg_sec'] = 0
        elif key == 'cmin':
            try:    record['cycle_best_sec'] = int(val)
            except: record['cycle_best_sec'] = 0
        elif key == 'cmax':
            try:    record['cycle_worst_sec'] = int(val)
            except: record['cycle_worst_sec'] = 0
        elif key == 'zt':
            try:    record['zoneTimes'] = json.loads(val)
            except: record['zoneTimes'] = {}
        elif key == 'log':
            record['log']    = val
            record['events'] = [e for e in val.split(';') if e] if val else []
        elif key == 'dn':   record['defenseNotes']   = val
        elif key == 'pm':   record['prematchNotes']  = val
        elif key == 'en':   record['endNotes']       = val
        elif key == 'pts':
            try:    record['pts'] = int(val)
            except: record['pts'] = 0

    for k, v in [
        ('scouter',''), ('matchNumber','?'), ('teamNumber',0),
        ('alliance','?'), ('fieldOrientation','normal'), ('startPos',''),
        ('robotStatus',''), ('eventCount',0), ('climbResult','None'),
        ('climbTiming',''), ('foulsCaused',0), ('teleop_cycles',0),
        ('cycle_avg_sec',0), ('cycle_best_sec',0), ('cycle_worst_sec',0),
        ('zoneTimes',{}), ('log',''), ('events',[]),
        ('defenseNotes',''), ('prematchNotes',''), ('endNotes',''),
    ]:
        record.setdefault(k, v)

    record['time']   = datetime.now().strftime('%I:%M %p')
    record['source'] = 'usb'
    return record


# ═══════════════════════════════════════════════════════
#  SCOUTING DATA HTTP HANDLER  (port 8765)
# ═══════════════════════════════════════════════════════
class ScoutHandler(BaseHTTPRequestHandler):

    def do_POST(self):
        if self.path != '/scout':
            self.send_response(404); self.end_headers(); return

        length = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(length).decode('utf-8', errors='replace').strip()

        if not raw:
            self.send_response(400); self.end_headers()
            self.wfile.write(b'ERR: empty payload'); return

        log('USB', f'Received ({len(raw)} B): {raw[:80]}...')

        try:
            record = parse_payload(raw)
            with file_lock:
                db = read_db()
                db.append(record)
                write_db(db)
            log_ok('USB', f'Saved: Match {record.get("matchNumber","?")} '
                          f'Team {record.get("teamNumber","?")} '
                          f'Scout {record.get("scouter","?")} '
                          f'({len(db)} total records)')
            self.send_response(200); self.end_headers()
            self.wfile.write(b'OK')
        except Exception as e:
            log_err('USB', f'Error saving: {e}')
            self.send_response(500); self.end_headers()
            self.wfile.write(b'ERR')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


# ═══════════════════════════════════════════════════════
#  FORM SERVER HTTP HANDLER  (port 8766)
#  Also proxies /api/* → Server.js on localhost:3000
#  so the tablet never needs to reach port 3000 directly.
# ═══════════════════════════════════════════════════════
class FormHandler(BaseHTTPRequestHandler):

    INDEX_FILES = ['form.html', 'scout.html', 'index.html']

    # ── API proxy ────────────────────────────────────────
    def _proxy(self, method):
        """Forward the request to Server.js and relay the response."""
        target = f'http://127.0.0.1:{API_PORT}{self.path}'
        # Read request body if present
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length) if length else None

        req = urllib.request.Request(
            url=target,
            data=body,
            method=method,
            headers={
                k: v for k, v in self.headers.items()
                if k.lower() not in ('host', 'connection')
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                raw = resp.read()
                self.send_response(resp.status)
                for k, v in resp.headers.items():
                    if k.lower() not in ('transfer-encoding', 'connection'):
                        self.send_header(k, v)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(raw)
                log('PROXY', f'{method} {self.path} → {resp.status}')
        except urllib.error.HTTPError as e:
            raw = e.read()
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(raw)
            log_warn('PROXY', f'{method} {self.path} → {e.code}')
        except Exception as e:
            log_err('PROXY', f'{method} {self.path} failed: {e}')
            self.send_response(502)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(f'Proxy error: {e}'.encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/api/'):
            self._proxy('GET'); return

        path = self.path.split('?')[0]

        if path in ('', '/'):
            for name in self.INDEX_FILES:
                if (PUBLIC_DIR / name).exists():
                    path = f'/{name}'
                    break

        file_path = PUBLIC_DIR / path.lstrip('/')

        if not file_path.exists() or not file_path.is_file():
            self.send_response(404); self.end_headers()
            self.wfile.write(b'404 Not Found'); return

        mime, _ = mimetypes.guess_type(str(file_path))
        mime = mime or 'application/octet-stream'

        data = file_path.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(data)
        log('FORM', f'Served {file_path.name} ({len(data)} B)')

    def do_POST(self):
        if self.path.startswith('/api/'):
            self._proxy('POST'); return
        self.send_response(404); self.end_headers()

    def do_PUT(self):
        if self.path.startswith('/api/'):
            self._proxy('PUT'); return
        self.send_response(404); self.end_headers()

    def do_DELETE(self):
        if self.path.startswith('/api/'):
            self._proxy('DELETE'); return
        self.send_response(404); self.end_headers()

    def log_message(self, fmt, *args):
        pass


# ═══════════════════════════════════════════════════════
#  ADB TABLET WATCHER
# ═══════════════════════════════════════════════════════
def _run_adb(*args, timeout=8) -> tuple[int, str, str]:
    try:
        r = subprocess.run(
            ['adb', *args],
            capture_output=True, text=True, timeout=timeout
        )
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    except FileNotFoundError:
        return 1, '', 'adb not found — install android-tools'
    except subprocess.TimeoutExpired:
        return 1, '', 'adb timeout'
    except Exception as e:
        return 1, '', str(e)


def _get_online_serials() -> set[str]:
    code, out, _ = _run_adb('devices')
    serials = set()
    for line in out.splitlines()[1:]:
        line = line.strip()
        if line.endswith('\tdevice'):
            serials.add(line.split('\t')[0])
    return serials


def _setup_tablet(serial: str):
    log('ADB', f'New tablet → {serial}  (setting up tunnels...)')
    for port in (SCOUT_PORT, FORM_PORT, API_PORT):
        code, out, err = _run_adb('-s', serial,
                                   'reverse', f'tcp:{port}', f'tcp:{port}')
        if code == 0:
            log_ok('ADB', f'  {serial}: reverse tcp:{port} ✓')
        else:
            log_warn('ADB', f'  {serial}: reverse tcp:{port} failed — {err}')
    log_ok('ADB', f'Tablet {serial} ready  (scout→:{SCOUT_PORT}  form→:{FORM_PORT})')


def _teardown_tablet(serial: str):
    log('ADB', f'Tablet disconnected → {serial}')
    for port in (SCOUT_PORT, FORM_PORT, API_PORT):
        _run_adb('-s', serial, 'reverse', '--remove', f'tcp:{port}')


def tablet_watcher():
    log('ADB', f'Tablet watcher started (polling every {POLL_INTERVAL}s, '
               f'max {MAX_TABLETS} tablets)')
    time.sleep(2)
    _run_adb('start-server', timeout=15)

    while not shutdown_event.is_set():
        try:
            current = _get_online_serials()
            with tablets_lock:
                previous = set(connected_tablets.keys())
                for serial in current - previous:
                    if len(connected_tablets) >= MAX_TABLETS:
                        log_warn('ADB', f'Max tablets ({MAX_TABLETS}) reached — ignoring {serial}')
                        continue
                    connected_tablets[serial] = datetime.now()
                    threading.Thread(target=_setup_tablet, args=(serial,),
                                     daemon=True, name=f'setup-{serial}').start()
                for serial in previous - current:
                    del connected_tablets[serial]
                    threading.Thread(target=_teardown_tablet, args=(serial,),
                                     daemon=True, name=f'teardown-{serial}').start()
        except Exception as e:
            log_err('ADB', f'Watcher error: {e}')

        shutdown_event.wait(timeout=POLL_INTERVAL)


def status_printer():
    shutdown_event.wait(timeout=10)
    while not shutdown_event.is_set():
        with tablets_lock:
            count = len(connected_tablets)
            if count:
                lines = [f'  {s}  (since {t.strftime("%H:%M:%S")})'
                         for s, t in connected_tablets.items()]
                log('ADB', f'{count}/{MAX_TABLETS} tablet(s) connected:\n' + '\n'.join(lines))
            else:
                log('ADB', 'No tablets connected — plug in a Fire tablet with USB Debugging on')
        shutdown_event.wait(timeout=30)


# ═══════════════════════════════════════════════════════
#  SERVER HELPER — SO_REUSEADDR so restarts never block
# ═══════════════════════════════════════════════════════
class ReuseAddrHTTPServer(HTTPServer):
    allow_reuse_address = True


def start_http_server(handler_class, port, label, bind='127.0.0.1'):
    server = ReuseAddrHTTPServer((bind, port), handler_class)
    t = threading.Thread(target=server.serve_forever,
                         name=f'http-{label}', daemon=True)
    t.start()
    log_ok(label, f'Listening on {bind}:{port}')
    return server


# ═══════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════
if __name__ == '__main__':
    print('\033[1m\033[96m')
    print('  ╔═══════════════════════════════════════════════╗')
    print('  ║   935 Scout — USB Server                      ║')
    print(f'  ║   Scout data  →  port {SCOUT_PORT}  (auto ADB reverse)  ║')
    print(f'  ║   Form server →  port {FORM_PORT}  (serves public/)     ║')
    print(f'  ║   Max tablets: {MAX_TABLETS}                              ║')
    print('  ╚═══════════════════════════════════════════════╝')
    print('\033[0m')

    if not PUBLIC_DIR.exists():
        log_warn('FORM', f'public/ not found at {PUBLIC_DIR} — form server will return 404s')
    else:
        files = [f.name for f in PUBLIC_DIR.iterdir() if f.is_file()]
        log_ok('FORM', f'Serving public/  ({len(files)} files: {", ".join(files[:6])})')

    scout_server = start_http_server(ScoutHandler, SCOUT_PORT, 'USB')
    form_server  = start_http_server(FormHandler,  FORM_PORT,  'FORM')

    threading.Thread(target=tablet_watcher, daemon=True, name='tablet-watcher').start()
    threading.Thread(target=status_printer, daemon=True, name='status-printer').start()

    log('MAIN', 'All services running. Ctrl+C to stop.')
    log('MAIN', f'Saving scouting data to: {DATA_FILE}')

    # Handle both SIGTERM (PM2 stop/restart) and SIGINT (Ctrl+C) cleanly
    def _shutdown(signum, frame):
        print('\n\033[93m[MAIN] Shutting down...\033[0m', flush=True)
        shutdown_event.set()
        scout_server.shutdown()
        form_server.shutdown()
        scout_server.server_close()
        form_server.server_close()
        print('\033[93m[MAIN] Done.\033[0m', flush=True)

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT,  _shutdown)

    # Block main thread until shutdown is triggered
    shutdown_event.wait()