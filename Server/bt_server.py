#!/usr/bin/env python3

import bluetooth
import threading
import json
import os
import time
from datetime import datetime

DATA_FILE = os.path.join(os.path.dirname(__file__), 'data/scouting_database.json')
os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)

# File lock so multiple tablets don't corrupt the JSON simultaneously
file_lock = threading.Lock()

def read_db():
    if not os.path.exists(DATA_FILE):
        return []
    try:
        with open(DATA_FILE, 'r') as f:
            content = f.read().strip()
            if not content:
                return []
            return json.loads(content)
    except Exception as e:
        print(f'[BT] Warning: could not read DB ({e}), starting fresh')
        return []

def write_db(data):
    # Write to temp file first then rename — prevents corruption if interrupted
    tmp = DATA_FILE + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, DATA_FILE)

def parse_payload(raw):
    """Parse pipe-delimited payload string into a full record matching the JSON schema."""
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

    # Fill in any missing fields with sensible defaults so the record
    # is always complete and matches what the dashboard expects
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
    record['source'] = 'bluetooth'

    return record

def handle_client(client_sock, client_info):
    addr = client_info[0]
    print(f'[BT] Connected: {addr}')
    buffer = ''
    try:
        while True:
            try:
                chunk = client_sock.recv(4096)  # Larger buffer to reduce fragmentation
            except Exception:
                break

            if not chunk:
                break

            buffer += chunk.decode('utf-8', errors='replace')

            # Process all complete payloads in the buffer (each ends with \n)
            while '\n' in buffer:
                payload, buffer = buffer.split('\n', 1)
                payload = payload.strip()
                if not payload:
                    continue

                print(f'[BT] Received from {addr} ({len(payload)} bytes): {payload[:80]}...')

                try:
                    record = parse_payload(payload)
                    with file_lock:
                        db = read_db()
                        db.append(record)
                        write_db(db)
                    print(f'[BT] ✓ Saved: Match {record.get("matchNumber","?")} '
                          f'Team {record.get("teamNumber","?")} '
                          f'Scout {record.get("scouter","?")} '
                          f'Events {record.get("eventCount","?")} '
                          f'({len(db)} total records)')
                    client_sock.send(b'OK\n')
                except Exception as e:
                    print(f'[BT] Parse/save error: {e}')
                    client_sock.send(b'ERR\n')

    except Exception as e:
        print(f'[BT] Client error ({addr}): {e}')
    finally:
        client_sock.close()
        print(f'[BT] Disconnected: {addr}')

def start_server():
    os.system('sudo hciconfig hci0 piscan')
    os.system('sudo hciconfig hci0 name "935-Scout-Pi"')

    server_sock = bluetooth.BluetoothSocket(bluetooth.RFCOMM)
    server_sock.bind(('', bluetooth.PORT_ANY))
    server_sock.listen(2)

    port = server_sock.getsockname()[1]

    bluetooth.advertise_service(
        server_sock,
        '935ScoutService',
        service_classes=[bluetooth.SERIAL_PORT_CLASS],
        profiles=[bluetooth.SERIAL_PORT_PROFILE]
    )

    print(f'[BT] 935 Scout Pi server running on RFCOMM port {port}')
    print(f'[BT] Device name: 935-Scout-Pi')
    print(f'[BT] Waiting for drive tablet(s)...')
    print(f'[BT] Saving to: {DATA_FILE}')

    while True:
        try:
            client_sock, client_info = server_sock.accept()
            t = threading.Thread(
                target=handle_client,
                args=(client_sock, client_info),
                daemon=True
            )
            t.start()
        except KeyboardInterrupt:
            print('\n[BT] Shutting down.')
            break
        except Exception as e:
            print(f'[BT] Accept error: {e}')
            time.sleep(1)

    server_sock.close()

if __name__ == '__main__':
    start_server()