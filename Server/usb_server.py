#!/usr/bin/env python3
"""
935 Scout USB Server
Receives scouting data from Fire tablets over USB via ADB reverse tunnel.

Setup (run once per tablet connection):
    adb reverse tcp:8765 tcp:8765

Then start this server:
    python3 usb_server.py

The tablet app POSTs pipe-delimited payload to http://localhost:8765/scout
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os
import threading
from datetime import datetime

PORT = 8765
DATA_FILE = os.path.join(os.path.dirname(__file__), 'data/scouting_database.json')
os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)

file_lock = threading.Lock()

def read_db():
    if not os.path.exists(DATA_FILE):
        return []
    try:
        with open(DATA_FILE, 'r') as f:
            content = f.read().strip()
            return json.loads(content) if content else []
    except Exception as e:
        print(f'[USB] Warning: could not read DB ({e}), starting fresh')
        return []

def write_db(data):
    tmp = DATA_FILE + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, DATA_FILE)

def parse_payload(raw):
    record = {}
    parts = raw.strip().split('|')
    for part in parts:
        if ':' not in part:
            continue
        key, _, val = part.partition(':')
        key = key.strip()
        val = val.strip()

        if key == 'sc':   record['scouter'] = val
        elif key == 'mt': record['matchNumber'] = val
        elif key == 'tm':
            try: record['teamNumber'] = int(val)
            except: record['teamNumber'] = val
        elif key == 'al': record['alliance'] = val
        elif key == 'fo': record['fieldOrientation'] = 'flipped' if val == 'F' else 'normal'
        elif key == 'sp': record['startPos'] = val
        elif key == 'rs': record['robotStatus'] = val
        elif key == 'ev':
            try: record['eventCount'] = int(val)
            except: record['eventCount'] = 0
        elif key == 'cl': record['climbResult'] = val
        elif key == 'ct': record['climbTiming'] = val
        elif key == 'fc':
            try: record['foulsCaused'] = int(val)
            except: record['foulsCaused'] = 0
        elif key == 'cy':
            try: record['teleop_cycles'] = int(val)
            except: record['teleop_cycles'] = 0
        elif key == 'cavg':
            try: record['cycle_avg_sec'] = int(val)
            except: record['cycle_avg_sec'] = 0
        elif key == 'cmin':
            try: record['cycle_best_sec'] = int(val)
            except: record['cycle_best_sec'] = 0
        elif key == 'cmax':
            try: record['cycle_worst_sec'] = int(val)
            except: record['cycle_worst_sec'] = 0
        elif key == 'zt':
            try: record['zoneTimes'] = json.loads(val)
            except: record['zoneTimes'] = {}
        elif key == 'log':
            record['log'] = val
            record['events'] = [e for e in val.split(';') if e] if val else []
        elif key == 'dn': record['defenseNotes'] = val
        elif key == 'pm': record['prematchNotes'] = val
        elif key == 'en': record['endNotes'] = val
        elif key == 'pts':
            try: record['pts'] = int(val)
            except: record['pts'] = 0

    record.setdefault('scouter', '')
    record.setdefault('matchNumber', '?')
    record.setdefault('teamNumber', 0)
    record.setdefault('alliance', '?')
    record.setdefault('fieldOrientation', 'normal')
    record.setdefault('startPos', '')
    record.setdefault('robotStatus', '')
    record.setdefault('eventCount', 0)
    record.setdefault('climbResult', 'None')
    record.setdefault('climbTiming', '')
    record.setdefault('foulsCaused', 0)
    record.setdefault('teleop_cycles', 0)
    record.setdefault('cycle_avg_sec', 0)
    record.setdefault('cycle_best_sec', 0)
    record.setdefault('cycle_worst_sec', 0)
    record.setdefault('zoneTimes', {})
    record.setdefault('log', '')
    record.setdefault('events', [])
    record.setdefault('defenseNotes', '')
    record.setdefault('prematchNotes', '')
    record.setdefault('endNotes', '')
    record['time'] = datetime.now().strftime('%I:%M %p')
    record['source'] = 'usb'
    return record

class ScoutHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/scout':
            self.send_response(404)
            self.end_headers()
            return

        length = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(length).decode('utf-8', errors='replace').strip()

        if not raw:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'ERR: empty payload')
            return

        print(f'[USB] Received ({len(raw)} bytes): {raw[:80]}...')

        try:
            record = parse_payload(raw)
            with file_lock:
                db = read_db()
                db.append(record)
                write_db(db)
            print(f'[USB] ✓ Saved: Match {record.get("matchNumber","?")} '
                  f'Team {record.get("teamNumber","?")} '
                  f'Scout {record.get("scouter","?")} '
                  f'({len(db)} total records)')
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'OK')
        except Exception as e:
            print(f'[USB] Error: {e}')
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b'ERR')

    def do_OPTIONS(self):
        # Handle CORS preflight so the WebView doesn't block the request
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, format, *args):
        pass  # Suppress default HTTP logging, we have our own

if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', PORT), ScoutHandler)
    print(f'[USB] 935 Scout USB server listening on port {PORT}')
    print(f'[USB] Saving to: {DATA_FILE}')
    print(f'[USB] Make sure to run: adb reverse tcp:{PORT} tcp:{PORT}')
    print(f'[USB] Waiting for data...')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n[USB] Shutting down.')
        server.server_close()