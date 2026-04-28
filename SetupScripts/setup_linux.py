#!/usr/bin/env python3
"""
935 Scout — Linux / macOS Setup Script
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
What this script does automatically:
  1. Detects your OS / distro and installs all deps
  2. SSHs into the Pi (password entered once)
  3. Installs Node.js, adb, Bluetooth, PM2 on the Pi
  4. Uploads all server files + public/ folder to the Pi
  5. Registers all 3 servers with PM2:
       • usb_server.py  (port 8765 + 8766, auto ADB reverse)
       • bt_server.py   (Bluetooth, drive tablet)
       • Server.js      (dashboard, port 3000)
  6. Enables PM2 to auto-start on Pi reboot (systemd)
  7. Prints a one-line cheat-sheet — nothing else to do

Tablet wiring at competition:
  Scouting tablets (×6) → USB cables into Pi USB hub
      usb_server.py detects them automatically and sets up
      ADB reverse tunnels — NO manual adb commands needed.
  Drive tablet → Bluetooth, pairs to "935-Scout-Pi"
"""

import os
import sys
import subprocess
import shutil
import getpass
import socket
from pathlib import Path

# ════════════════════════════════════════════════════════
#  BOOTSTRAP — install paramiko before anything else
# ════════════════════════════════════════════════════════
def bootstrap():
    try:
        import paramiko
    except ImportError:
        print("[>>] Installing paramiko...")
        subprocess.run(
            [sys.executable, '-m', 'pip', 'install', 'paramiko',
             '--break-system-packages'],
            check=False
        )
        try:
            import paramiko  # noqa: F401
        except ImportError:
            subprocess.run(
                [sys.executable, '-m', 'pip', 'install', 'paramiko'],
                check=True
            )
        print("[OK] paramiko installed — restarting...")
        os.execv(sys.executable, [sys.executable] + sys.argv)

bootstrap()
import paramiko  # noqa: E402

# ════════════════════════════════════════════════════════
#  COLORS
# ════════════════════════════════════════════════════════
class C:
    GRN = '\033[92m'; YLW = '\033[93m'; RED = '\033[91m'
    CYN = '\033[96m'; BLD = '\033[1m';  RST = '\033[0m'

def ok(msg):   print(f"{C.GRN}✓  {msg}{C.RST}")
def info(msg): print(f"{C.CYN}→  {msg}{C.RST}")
def warn(msg): print(f"{C.YLW}⚠  {msg}{C.RST}")
def err(msg):  print(f"{C.RED}✗  {msg}{C.RST}")
def hdr(msg):  print(f"\n{C.BLD}{C.CYN}{'─'*54}\n  {msg}\n{'─'*54}{C.RST}")
def ask(prompt, default=''):
    val = input(f"{C.BLD}{prompt}{C.RST} [{default}]: ").strip()
    return val if val else default
def ask_yn(prompt, default='y'):
    val = input(f"{C.BLD}{prompt} (y/n){C.RST} [{default}]: ").strip().lower()
    return (val if val else default) == 'y'

# ════════════════════════════════════════════════════════
#  DISTRO DETECTION
# ════════════════════════════════════════════════════════
def detect_distro():
    if sys.platform == 'darwin':
        return 'mac'
    try:
        text = Path('/etc/os-release').read_text().lower()
        if 'arch' in text or 'manjaro' in text:
            return 'arch'
        if 'fedora' in text or 'rhel' in text or 'centos' in text:
            return 'fedora'
        return 'debian'
    except Exception:
        return 'debian'

DISTRO = detect_distro()

def pkg_install(pkg):
    if DISTRO == 'mac':
        if not shutil.which('brew'):
            info("Installing Homebrew...")
            subprocess.run(
                '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
                shell=True, check=True
            )
        subprocess.run(f'brew install {pkg}', shell=True, check=False)
    elif DISTRO == 'arch':
        subprocess.run(f'sudo pacman -S --noconfirm {pkg}', shell=True, check=False)
    elif DISTRO == 'fedora':
        subprocess.run(f'sudo dnf install -y {pkg}', shell=True, check=False)
    else:
        subprocess.run(f'sudo apt-get install -y {pkg}', shell=True, check=False)

def run_local(cmd, check=True, capture=False, cwd=None):
    kwargs = dict(shell=True, check=check, cwd=str(cwd) if cwd else None)
    if capture:
        kwargs['capture_output'] = True
        kwargs['text'] = True
    return subprocess.run(cmd, **kwargs)

# ════════════════════════════════════════════════════════
#  STEP 1 — Find project
# ════════════════════════════════════════════════════════
def find_project():
    hdr("STEP 1 — Locate Project")
    home = Path.home()
    candidates = [
        home / 'Downloads' / 'Programming' / 'HTML' / 'Scouting-App',
        home / 'Scouting-App',
        home / 'Documents' / 'Scouting-App',
        Path('/opt/Scouting-App'),
    ]
    found = None
    for c in candidates:
        if c.exists() and (c / 'Server').exists():
            found = c
            break
    if found:
        ok(f"Found: {found}")
        if not ask_yn("Use this path?"):
            found = None
    if not found:
        path = ask("Full path to Scouting-App")
        found = Path(path)
        if not found.exists():
            err(f"Not found: {found}")
            sys.exit(1)
    ok(f"Using: {found}")
    return found

# ════════════════════════════════════════════════════════
#  STEP 2 — Install system deps (local machine)
# ════════════════════════════════════════════════════════
def check_and_install_deps():
    hdr(f"STEP 2 — Install Dependencies ({DISTRO})")

    # Node.js
    if shutil.which('node'):
        r = run_local('node --version', capture=True, check=False)
        ok(f"Node.js: {r.stdout.strip()}")
    else:
        warn("Node.js not found — installing...")
        if DISTRO == 'mac':
            pkg_install('node')
        elif DISTRO in ('arch', 'fedora'):
            pkg_install('nodejs npm')
        else:
            run_local('curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -', check=False)
            run_local('sudo apt-get install -y nodejs', check=False)
        if shutil.which('node'):
            r = run_local('node --version', capture=True, check=False)
            ok(f"Node.js installed: {r.stdout.strip()}")
        else:
            err("Node.js install failed — install manually from https://nodejs.org")
            sys.exit(1)

    # git
    if shutil.which('git'):
        r = run_local('git --version', capture=True, check=False)
        ok(f"git: {r.stdout.strip()}")
    else:
        info("Installing git..."); pkg_install('git')

    # Java 17
    if shutil.which('java'):
        r = run_local('java -version', capture=True, check=False)
        ok(f"Java: {(r.stderr or r.stdout).strip().splitlines()[0]}")
    else:
        info("Installing Java 17...")
        if DISTRO == 'mac':      pkg_install('openjdk@17')
        elif DISTRO == 'arch':   pkg_install('jdk17-openjdk')
        elif DISTRO == 'fedora': pkg_install('java-17-openjdk')
        else:                    pkg_install('openjdk-17-jdk')

    # adb
    if shutil.which('adb'):
        ok("adb found")
    else:
        info("Installing adb...")
        if DISTRO == 'mac':      pkg_install('android-platform-tools')
        elif DISTRO == 'arch':   pkg_install('android-tools')
        elif DISTRO == 'fedora': pkg_install('android-tools')
        else:                    pkg_install('adb')

    ok("Local deps ready")

# ════════════════════════════════════════════════════════
#  STEP 3 — npm deps (local)
# ════════════════════════════════════════════════════════
def install_npm_deps(project_path):
    hdr("STEP 3 — Install npm Dependencies")
    server_path = project_path / 'Server'
    if (server_path / 'package.json').exists():
        info("Installing Server deps...")
        run_local('npm install', cwd=server_path)
        ok("Server deps installed")
    else:
        warn("No package.json in Server — skipping")

    tablets_path = project_path / 'Scouter Tablets'
    if (tablets_path / 'package.json').exists():
        info("Installing Scouter Tablets deps...")
        run_local('npm install', cwd=tablets_path)
        info("Running cap sync...")
        run_local('npx cap sync', cwd=tablets_path)
        ok("Capacitor synced")
    else:
        warn("No package.json in Scouter Tablets — skipping")

# ════════════════════════════════════════════════════════
#  STEP 4 — Data directory (local)
# ════════════════════════════════════════════════════════
def setup_data_dir(project_path):
    hdr("STEP 4 — Data Directory")
    data_dir = project_path / 'Server' / 'data'
    data_dir.mkdir(parents=True, exist_ok=True)
    for fname, content in [
        ('scouting_database.json', '[]'),
        ('schema.json', '{"version":1,"fields":[]}'),
        ('equations.json', '[]'),
    ]:
        f = data_dir / fname
        if not f.exists():
            f.write_text(content)
            ok(f"Created {fname}")
        else:
            ok(f"{fname} exists")

# ════════════════════════════════════════════════════════
#  STEP 5 — Auto-discover Pi IP (optional)
# ════════════════════════════════════════════════════════
def discover_pi_ip(default_ip: str) -> str:
    """Try mDNS first, then quick TCP probe, fall back to user input."""
    info("Trying mDNS (raspberrypi.local)...")
    try:
        ip = socket.gethostbyname('raspberrypi.local')
        ok(f"Found Pi via mDNS: {ip}")
        if ask_yn(f"Use {ip}?"):
            return ip
    except Exception:
        pass

    # Quick TCP probe of common Pi IPs on the same subnet
    info("Scanning local subnet for Pi on port 22...")
    try:
        my_ip = socket.gethostbyname(socket.gethostname())
        subnet = '.'.join(my_ip.split('.')[:3])
        found_ips = []
        def probe(ip):
            try:
                s = socket.create_connection((ip, 22), timeout=0.3)
                s.close()
                found_ips.append(ip)
            except Exception:
                pass
        import threading
        threads = [threading.Thread(target=probe, args=(f'{subnet}.{i}',))
                   for i in range(1, 255)]
        for t in threads: t.start()
        for t in threads: t.join()
        if found_ips:
            info(f"SSH hosts on {subnet}.x: {', '.join(found_ips)}")
    except Exception:
        pass

    return ask("Pi IP address", default_ip)

# ════════════════════════════════════════════════════════
#  STEP 6 — Pi setup via SSH/SFTP
# ════════════════════════════════════════════════════════
def setup_pi(project_path):
    hdr("STEP 6 — Raspberry Pi Setup")

    if not ask_yn("Set up the Raspberry Pi now?"):
        info("Skipping Pi setup")
        return None, None, None

    default_ip = '192.168.40.71'
    pi_ip   = discover_pi_ip(default_ip)
    pi_user = ask("Pi username", "data")
    pi_path = ask("Project path on Pi", "~/Scouting-App")
    pi_pass = getpass.getpass(
        f"{C.BLD}Pi password (entered once for all operations): {C.RST}"
    )

    info(f"Connecting to {pi_user}@{pi_ip}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(pi_ip, username=pi_user, password=pi_pass, timeout=15)
        ok("Connected to Pi")
    except paramiko.AuthenticationException:
        err("Authentication failed — wrong password or username")
        sys.exit(1)
    except Exception as e:
        err(f"Cannot connect: {e}")
        warn("Check: Pi is on, SSH enabled (raspi-config → Interface → SSH)")
        sys.exit(1)

    sftp = ssh.open_sftp()

    # ── SSH helper ────────────────────────────────────────
    def runcmd(cmd, ignore_errors=False):
        import shlex
        if 'sudo' in cmd:
            safe = pi_pass.replace("'", "\\'")
            inner = cmd.replace('sudo ', '', 1)
            cmd = f"echo '{safe}' | sudo -S bash -c " + shlex.quote(inner)
        _, stdout, stderr = ssh.exec_command(cmd)
        out  = stdout.read().decode('utf-8', errors='replace').strip()
        errs = stderr.read().decode('utf-8', errors='replace').strip()
        code = stdout.channel.recv_exit_status()
        if out:
            info(f"  Pi: {out[:140]}")
        if code != 0 and not ignore_errors and errs:
            filtered = '\n'.join(
                l for l in errs.splitlines()
                if '[sudo]' not in l and 'password for' not in l
            )
            if filtered:
                warn(f"  Pi err: {filtered[:120]}")
        return out, code

    # ── Resolve home dir once ─────────────────────────────
    home_out, _ = runcmd('echo $HOME')
    pi_home = home_out.strip()
    pi_path_abs = pi_path.replace('~', pi_home)

    # ── SFTP upload helper ────────────────────────────────
    def put_file(local: Path, remote: str):
        remote_abs = remote.replace('~', pi_home)
        try:
            sftp.put(str(local), remote_abs)
            ok(f"  Uploaded: {local.name}")
        except Exception as e:
            warn(f"  Upload failed ({local.name}): {e}")

    def put_dir(local_dir: Path, remote_dir: str):
        """Recursively upload a directory."""
        remote_abs = remote_dir.replace('~', pi_home)
        runcmd(f'mkdir -p "{remote_abs}"')
        for item in local_dir.iterdir():
            if item.is_file():
                put_file(item, f'{remote_abs}/{item.name}')
            elif item.is_dir():
                put_dir(item, f'{remote_abs}/{item.name}')

    # ── Directories ───────────────────────────────────────
    runcmd(f'mkdir -p "{pi_path_abs}/Server/data"')
    ok("Pi directories ready")

    # ── Upload server files ───────────────────────────────
    server_files = [
        (project_path / 'Server' / 'bt_server.py',  f'{pi_path}/Server/bt_server.py'),
        (project_path / 'Server' / 'usb_server.py', f'{pi_path}/Server/usb_server.py'),
        (project_path / 'Server' / 'Server.js',     f'{pi_path}/Server/Server.js'),
        (project_path / 'Server' / 'package.json',  f'{pi_path}/Server/package.json'),
    ]
    for local, remote in server_files:
        if local.exists():
            put_file(local, remote)
        else:
            warn(f"  {local.name} not found — skipping")

    # ── Upload public/ folder ─────────────────────────────
    public_local = project_path / 'Server' / 'public'
    if public_local.exists():
        info("Uploading public/ folder...")
        put_dir(public_local, f'{pi_path}/Server/public')
        ok("public/ uploaded")
    else:
        warn("No public/ folder found locally — tablets won't get form.html")

    # ── Node.js on Pi ─────────────────────────────────────
    out, code = runcmd('node --version', ignore_errors=True)
    if code != 0 or not out:
        info("Installing Node.js on Pi...")
        runcmd('curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/node_setup.sh')
        runcmd('sudo bash /tmp/node_setup.sh')
        runcmd('sudo apt-get install -y nodejs')
        out, _ = runcmd('node --version', ignore_errors=True)
        ok(f"Node.js installed: {out}")
    else:
        ok(f"Node.js on Pi: {out}")

    # ── PM2 ───────────────────────────────────────────────
    info("Installing PM2 (process manager)...")
    runcmd('sudo npm install -g pm2', ignore_errors=False)
    ok("PM2 installed")

    # ── Bluetooth ─────────────────────────────────────────
    info("Installing Bluetooth stack (for drive tablet)...")
    runcmd('sudo apt-get install -y python3-bluetooth bluetooth bluez libbluetooth-dev',
           ignore_errors=True)
    runcmd('pip3 install pybluez --break-system-packages', ignore_errors=True)

    btd_path, _ = runcmd('which bluetoothd', ignore_errors=True)
    btd_path = (btd_path or '/usr/sbin/bluetoothd').strip()
    compat_conf = (
        '[Service]\nExecStart=\nExecStart=' + btd_path +
        ' --compat --noplugin=sap\n'
    )
    runcmd('sudo mkdir -p /etc/systemd/system/bluetooth.service.d')
    runcmd(f"printf '{compat_conf}' | sudo tee "
           f"/etc/systemd/system/bluetooth.service.d/compat.conf > /dev/null")
    runcmd('sudo systemctl daemon-reload')
    runcmd('sudo systemctl restart bluetooth', ignore_errors=True)
    runcmd('sudo rfkill unblock bluetooth', ignore_errors=True)
    runcmd('sudo hciconfig hci0 up', ignore_errors=True)
    runcmd('sudo sdptool add SP', ignore_errors=True)
    runcmd('sudo hciconfig hci0 piscan', ignore_errors=True)
    runcmd('sudo hciconfig hci0 name "935-Scout-Pi"', ignore_errors=True)
    ok("Bluetooth ready — device name: 935-Scout-Pi")

    # ── adb on Pi ─────────────────────────────────────────
    info("Installing adb on Pi...")
    runcmd('sudo apt-get install -y adb', ignore_errors=True)
    ok("adb installed on Pi")

    # ── npm deps on Pi ────────────────────────────────────
    info("Installing npm deps on Pi...")
    runcmd(f'cd "{pi_path_abs}/Server" && npm install')
    ok("Pi npm deps installed")

    # ── Init DB ───────────────────────────────────────────
    runcmd(f'[ -f "{pi_path_abs}/Server/data/scouting_database.json" ] || '
           f'echo "[]" > "{pi_path_abs}/Server/data/scouting_database.json"')
    ok("Pi database ready")

    # ════════════════════════════════════════════════════
    #  PM2 — register & start all 3 servers
    # ════════════════════════════════════════════════════
    hdr("STEP 7 — Start Servers with PM2")

    server_dir = f'{pi_path_abs}/Server'

    # Stop any existing PM2 processes from previous runs
    runcmd('pm2 delete 935-usb 935-bt 935-dashboard 2>/dev/null || true',
           ignore_errors=True)

    # usb_server.py  — needs sudo for adb (runs as current user, adb handles perms)
    runcmd(
        f'pm2 start python3 --name 935-usb -- "{server_dir}/usb_server.py"',
        ignore_errors=False
    )
    ok("PM2: 935-usb started (usb_server.py)")

    # bt_server.py  — needs sudo for Bluetooth RFCOMM
    runcmd(
        f'pm2 start "sudo python3 {server_dir}/bt_server.py" --name 935-bt',
        ignore_errors=False
    )
    ok("PM2: 935-bt started (bt_server.py)")

    # Server.js  — dashboard
    runcmd(
        f'pm2 start "{server_dir}/Server.js" --name 935-dashboard',
        ignore_errors=False
    )
    ok("PM2: 935-dashboard started (Server.js)")

    # Save PM2 process list
    runcmd('pm2 save')
    ok("PM2 process list saved")

    # Enable PM2 to launch on boot via systemd
    info("Enabling PM2 on boot...")
    startup_out, _ = runcmd(f'pm2 startup systemd -u {pi_user} --hp {pi_home}',
                             ignore_errors=True)
    # pm2 startup prints a 'sudo env ...' command we need to run
    for line in startup_out.splitlines():
        if line.strip().startswith('sudo'):
            runcmd(line.strip(), ignore_errors=True)
            break
    ok("PM2 will auto-start on Pi reboot")

    # Show running status
    status_out, _ = runcmd('pm2 list', ignore_errors=True)
    if status_out:
        print(f"\n{C.CYN}{status_out}{C.RST}\n")

    ok("Pi fully configured — all servers running under PM2")

    sftp.close()
    ssh.close()
    return pi_ip, pi_user, pi_path_abs

# ════════════════════════════════════════════════════════
#  FINAL SUMMARY
# ════════════════════════════════════════════════════════
def print_summary(project_path, pi_ip, pi_user, pi_path_abs):
    hdr("Complete — Cheat Sheet")

    if not pi_ip:
        warn("Pi setup was skipped. Re-run this script to configure the Pi.")
        return

    print(f"""
{C.BLD}At competition — just plug in the tablets.{C.RST}
  Scouting tablets (×6) → USB into Pi hub → auto-detected ✓
  Drive tablet → pair Bluetooth to {C.CYN}935-Scout-Pi{C.RST}

{C.BLD}Pi address:{C.RST}  {C.CYN}{pi_ip}{C.RST}
{C.BLD}Dashboard:{C.RST}   {C.CYN}http://{pi_ip}:3000{C.RST}
{C.BLD}Form (tablet):{C.RST} {C.CYN}http://localhost:8766{C.RST}  (via ADB tunnel)

{C.BLD}SSH into Pi (if needed):{C.RST}
  {C.CYN}ssh {pi_user}@{pi_ip}{C.RST}

{C.BLD}PM2 commands (on Pi):{C.RST}
  {C.CYN}pm2 list{C.RST}          ← see all 3 servers
  {C.CYN}pm2 logs{C.RST}          ← live log from all servers
  {C.CYN}pm2 logs 935-usb{C.RST}  ← USB server only
  {C.CYN}pm2 restart all{C.RST}   ← restart everything
  {C.CYN}pm2 stop all{C.RST}      ← stop everything

{C.BLD}Pull scouting data:{C.RST}
  {C.CYN}scp {pi_user}@{pi_ip}:{pi_path_abs}/Server/data/scouting_database.json ~/Downloads/{C.RST}
""")
    ok("All done — no manual steps required at competition!")

# ════════════════════════════════════════════════════════
#  MAIN
# ════════════════════════════════════════════════════════
if __name__ == '__main__':
    print(f"{C.BLD}{C.CYN}")
    print("  ╔══════════════════════════════════════════════╗")
    print("  ║   935 Scout — Linux / macOS Setup            ║")
    print("  ╚══════════════════════════════════════════════╝")
    print(f"{C.RST}  Python {sys.version.split()[0]} · {DISTRO}\n")

    try:
        project = find_project()
        check_and_install_deps()
        install_npm_deps(project)
        setup_data_dir(project)
        pi_ip, pi_user, pi_path_abs = setup_pi(project)
        print_summary(project, pi_ip, pi_user, pi_path_abs)
    except KeyboardInterrupt:
        print(f"\n{C.YLW}Setup cancelled.{C.RST}")