#!/usr/bin/env python3
"""
935 Scout — Windows Setup Script
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
What this script does automatically:
  1. Installs deps via winget (falls back to Chocolatey)
  2. SSHs into the Pi (password entered once)
  3. Installs Node.js, adb, Bluetooth, PM2 on the Pi
  4. Uploads all server files + public/ folder to the Pi
  5. Registers all 3 servers with PM2 (auto-start on Pi boot):
       • usb_server.py  (ports 8765 + 8766, auto ADB reverse)
       • bt_server.py   (Bluetooth, drive tablet)
       • Server.js      (dashboard, port 3000)
  6. Prints a cheat-sheet — nothing else to do

Run with:  python setup_windows.py
(Run from a normal command prompt — NOT as Administrator)
"""

import os
import sys
import subprocess
import shutil
import getpass
import socket
import threading
import time
from pathlib import Path

# ════════════════════════════════════════════════════════
#  WINDOWS CHECK
# ════════════════════════════════════════════════════════
if sys.platform != 'win32':
    print("This script is for Windows. Use setup_linux.py on Linux/macOS.")
    sys.exit(1)

# ════════════════════════════════════════════════════════
#  BOOTSTRAP — install paramiko
# ════════════════════════════════════════════════════════
def bootstrap():
    try:
        import paramiko  # noqa: F401
    except ImportError:
        print("[>>] Installing paramiko...")
        subprocess.run(
            [sys.executable, '-m', 'pip', 'install', 'paramiko'],
            check=True
        )
        print("[OK] paramiko installed — restarting...")
        os.execv(sys.executable, [sys.executable] + sys.argv)

bootstrap()
import paramiko  # noqa: E402

# ════════════════════════════════════════════════════════
#  COLORS  (Windows 10+ supports ANSI in cmd/PowerShell)
# ════════════════════════════════════════════════════════
# Enable ANSI escape codes on Windows
os.system('')

class C:
    GRN = '\033[92m'; YLW = '\033[93m'; RED = '\033[91m'
    CYN = '\033[96m'; BLD = '\033[1m';  RST = '\033[0m'

def ok(msg):   print(f"{C.GRN}+  {msg}{C.RST}")
def info(msg): print(f"{C.CYN}-> {msg}{C.RST}")
def warn(msg): print(f"{C.YLW}!  {msg}{C.RST}")
def err(msg):  print(f"{C.RED}X  {msg}{C.RST}")
def hdr(msg):  print(f"\n{C.BLD}{C.CYN}{'─'*54}\n  {msg}\n{'─'*54}{C.RST}")
def ask(prompt, default=''):
    val = input(f"{C.BLD}{prompt}{C.RST} [{default}]: ").strip()
    return val if val else default
def ask_yn(prompt, default='y'):
    val = input(f"{C.BLD}{prompt} (y/n){C.RST} [{default}]: ").strip().lower()
    return (val if val else default) == 'y'

# ════════════════════════════════════════════════════════
#  PACKAGE INSTALLER (winget → choco fallback)
# ════════════════════════════════════════════════════════
def has_winget():
    return shutil.which('winget') is not None

def has_choco():
    return shutil.which('choco') is not None

def install_choco():
    """Install Chocolatey package manager."""
    info("Installing Chocolatey...")
    ps_cmd = (
        "Set-ExecutionPolicy Bypass -Scope Process -Force; "
        "[System.Net.ServicePointManager]::SecurityProtocol = "
        "[System.Net.ServicePointManager]::SecurityProtocol -bor 3072; "
        "iex ((New-Object System.Net.WebClient).DownloadString("
        "'https://community.chocolatey.org/install.ps1'))"
    )
    subprocess.run(
        ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass',
         '-Command', ps_cmd],
        check=True
    )
    # Refresh PATH
    os.environ['PATH'] += r';C:\ProgramData\chocolatey\bin'
    ok("Chocolatey installed")

# winget IDs for packages we need
WINGET_IDS = {
    'node':  'OpenJS.NodeJS.LTS',
    'git':   'Git.Git',
    'adb':   'Google.PlatformTools',
    'java':  'Microsoft.OpenJDK.17',
}
CHOCO_IDS = {
    'node':  'nodejs-lts',
    'git':   'git',
    'adb':   'adb',
    'java':  'openjdk17',
}

def pkg_install(name: str):
    """Install a package by logical name using winget or choco."""
    if has_winget():
        wid = WINGET_IDS.get(name, name)
        info(f"winget install {wid}...")
        r = subprocess.run(
            ['winget', 'install', '--id', wid, '-e', '--silent',
             '--accept-source-agreements', '--accept-package-agreements'],
            capture_output=True, text=True
        )
        if r.returncode == 0:
            ok(f"{name} installed via winget")
            return
        warn(f"winget failed for {name}: {r.stderr.strip()[:100]}")

    # Fallback: Chocolatey
    if not has_choco():
        install_choco()
    cid = CHOCO_IDS.get(name, name)
    info(f"choco install {cid}...")
    subprocess.run(['choco', 'install', cid, '-y', '--no-progress'],
                   check=False)

def refresh_path():
    """Re-read PATH from registry so newly installed tools are found."""
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                             r'SYSTEM\CurrentControlSet\Control\Session Manager\Environment')
        sys_path, _ = winreg.QueryValueEx(key, 'PATH')
        winreg.CloseKey(key)
        key2 = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Environment')
        try:
            usr_path, _ = winreg.QueryValueEx(key2, 'PATH')
        except FileNotFoundError:
            usr_path = ''
        winreg.CloseKey(key2)
        os.environ['PATH'] = sys_path + ';' + usr_path
    except Exception:
        pass

def run_local(cmd, check=True, capture=False, cwd=None, shell=True):
    kwargs = dict(shell=shell, check=check, cwd=str(cwd) if cwd else None)
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
        home / 'Documents' / 'Scouting-App',
        home / 'Desktop' / 'Scouting-App',
        home / 'Scouting-App',
        Path('C:/Scouting-App'),
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
        path = ask("Full path to Scouting-App (e.g. C:\\Users\\You\\Scouting-App)")
        found = Path(path)
        if not found.exists():
            err(f"Not found: {found}")
            sys.exit(1)
    ok(f"Using: {found}")
    return found

# ════════════════════════════════════════════════════════
#  STEP 2 — Install system deps (local Windows machine)
# ════════════════════════════════════════════════════════
def check_and_install_deps():
    hdr("STEP 2 — Install Dependencies (Windows)")

    # Node.js
    if shutil.which('node'):
        r = run_local('node --version', capture=True, check=False)
        ok(f"Node.js: {r.stdout.strip()}")
    else:
        warn("Node.js not found — installing...")
        pkg_install('node')
        refresh_path()
        if shutil.which('node'):
            r = run_local('node --version', capture=True, check=False)
            ok(f"Node.js installed: {r.stdout.strip()}")
        else:
            warn("Node.js not on PATH yet — you may need to restart your terminal.")
            warn("Re-run this script after restarting.")

    # git
    if shutil.which('git'):
        r = run_local('git --version', capture=True, check=False)
        ok(f"git: {r.stdout.strip()}")
    else:
        info("Installing git..."); pkg_install('git'); refresh_path()

    # adb (Android Platform Tools)
    if shutil.which('adb'):
        ok("adb found")
    else:
        info("Installing Android Platform Tools (adb)...")
        pkg_install('adb')
        refresh_path()
        # Platform tools often land in AppData
        extra = Path.home() / 'AppData' / 'Local' / 'Android' / 'Sdk' / 'platform-tools'
        if extra.exists():
            os.environ['PATH'] += f';{extra}'
        if shutil.which('adb'):
            ok("adb ready")
        else:
            warn("adb not on PATH — you may need to add platform-tools manually")
            warn("Download: https://developer.android.com/tools/releases/platform-tools")

    # Java
    if shutil.which('java'):
        r = run_local('java -version', capture=True, check=False)
        ok(f"Java: {(r.stderr or r.stdout).strip().splitlines()[0]}")
    else:
        info("Installing Java 17..."); pkg_install('java'); refresh_path()

    ok("Local Windows deps ready")

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
#  STEP 5 — Auto-discover Pi IP
# ════════════════════════════════════════════════════════
def discover_pi_ip(default_ip: str) -> str:
    info("Trying mDNS (raspberrypi.local)...")
    try:
        ip = socket.gethostbyname('raspberrypi.local')
        ok(f"Found Pi via mDNS: {ip}")
        if ask_yn(f"Use {ip}?"):
            return ip
    except Exception:
        pass

    info("Scanning local subnet for SSH hosts (port 22)...")
    try:
        my_ip = socket.gethostbyname(socket.gethostname())
        subnet = '.'.join(my_ip.split('.')[:3])
        found_ips: list[str] = []

        def probe(ip):
            try:
                s = socket.create_connection((ip, 22), timeout=0.4)
                s.close()
                found_ips.append(ip)
            except Exception:
                pass

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
        warn("Check: Pi is on, SSH enabled (raspi-config -> Interface -> SSH)")
        sys.exit(1)

    sftp = ssh.open_sftp()

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

    home_out, _ = runcmd('echo $HOME')
    pi_home = home_out.strip()
    pi_path_abs = pi_path.replace('~', pi_home)

    def put_file(local: Path, remote: str):
        remote_abs = remote.replace('~', pi_home)
        try:
            sftp.put(str(local), remote_abs)
            ok(f"  Uploaded: {local.name}")
        except Exception as e:
            warn(f"  Upload failed ({local.name}): {e}")

    def put_dir(local_dir: Path, remote_dir: str):
        remote_abs = remote_dir.replace('~', pi_home)
        runcmd(f'mkdir -p "{remote_abs}"')
        for item in local_dir.iterdir():
            if item.is_file():
                put_file(item, f'{remote_abs}/{item.name}')
            elif item.is_dir():
                put_dir(item, f'{remote_abs}/{item.name}')

    # Directories
    runcmd(f'mkdir -p "{pi_path_abs}/Server/data"')
    ok("Pi directories ready")

    # Upload server files
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

    # Upload public/
    public_local = project_path / 'Server' / 'public'
    if public_local.exists():
        info("Uploading public/ folder...")
        put_dir(public_local, f'{pi_path}/Server/public')
        ok("public/ uploaded")
    else:
        warn("No public/ folder found — tablets won't get form.html")

    # Node.js on Pi
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

    # PM2
    info("Installing PM2...")
    runcmd('sudo npm install -g pm2')
    ok("PM2 installed")

    # Bluetooth
    info("Installing Bluetooth stack (drive tablet)...")
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
    ok("Bluetooth ready — 935-Scout-Pi")

    # adb on Pi
    info("Installing adb on Pi...")
    runcmd('sudo apt-get install -y adb', ignore_errors=True)
    ok("adb on Pi ready")

    # npm deps on Pi
    info("Installing npm deps on Pi...")
    runcmd(f'cd "{pi_path_abs}/Server" && npm install')
    ok("Pi npm deps installed")

    # Init DB
    runcmd(f'[ -f "{pi_path_abs}/Server/data/scouting_database.json" ] || '
           f'echo "[]" > "{pi_path_abs}/Server/data/scouting_database.json"')
    ok("Pi database ready")

    # ── PM2: start all 3 servers ──────────────────────────
    hdr("STEP 7 — Start Servers with PM2")

    server_dir = f'{pi_path_abs}/Server'

    runcmd('pm2 delete 935-usb 935-bt 935-dashboard 2>/dev/null || true',
           ignore_errors=True)

    runcmd(
        f'pm2 start python3 --name 935-usb -- "{server_dir}/usb_server.py"'
    )
    ok("PM2: 935-usb started")

    runcmd(
        f'pm2 start "sudo python3 {server_dir}/bt_server.py" --name 935-bt'
    )
    ok("PM2: 935-bt started")

    runcmd(
        f'pm2 start "{server_dir}/Server.js" --name 935-dashboard'
    )
    ok("PM2: 935-dashboard started")

    runcmd('pm2 save')
    ok("PM2 process list saved")

    info("Enabling PM2 on boot...")
    startup_out, _ = runcmd(
        f'pm2 startup systemd -u {pi_user} --hp {pi_home}',
        ignore_errors=True
    )
    for line in startup_out.splitlines():
        if line.strip().startswith('sudo'):
            runcmd(line.strip(), ignore_errors=True)
            break
    ok("PM2 auto-start on boot enabled")

    status_out, _ = runcmd('pm2 list', ignore_errors=True)
    if status_out:
        print(f"\n{C.CYN}{status_out}{C.RST}\n")

    ok("Pi fully configured!")

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
  Scouting tablets (x6) -> USB into Pi hub -> auto-detected
  Drive tablet -> pair Bluetooth to {C.CYN}935-Scout-Pi{C.RST}

{C.BLD}Pi address:{C.RST}  {C.CYN}{pi_ip}{C.RST}
{C.BLD}Dashboard:{C.RST}   {C.CYN}http://{pi_ip}:3000{C.RST}

{C.BLD}SSH into Pi (optional):{C.RST}
  Use PuTTY or Windows Terminal:
  {C.CYN}ssh {pi_user}@{pi_ip}{C.RST}

{C.BLD}PM2 commands (on Pi via SSH):{C.RST}
  {C.CYN}pm2 list{C.RST}          <- see all 3 servers + status
  {C.CYN}pm2 logs{C.RST}          <- live logs from all servers
  {C.CYN}pm2 logs 935-usb{C.RST}  <- USB server only
  {C.CYN}pm2 restart all{C.RST}   <- restart everything
  {C.CYN}pm2 stop all{C.RST}      <- stop everything

{C.BLD}Pull scouting data (PowerShell):{C.RST}
  {C.CYN}scp {pi_user}@{pi_ip}:{pi_path_abs}/Server/data/scouting_database.json $env:USERPROFILE\\Downloads\\{C.RST}
""")
    ok("All done — no manual steps required at competition!")

# ════════════════════════════════════════════════════════
#  MAIN
# ════════════════════════════════════════════════════════
if __name__ == '__main__':
    print(f"{C.BLD}{C.CYN}")
    print("  +================================================+")
    print("  |   935 Scout -- Windows Setup                   |")
    print("  +================================================+")
    print(f"{C.RST}  Python {sys.version.split()[0]} | Windows\n")

    try:
        project = find_project()
        check_and_install_deps()
        install_npm_deps(project)
        setup_data_dir(project)
        pi_ip, pi_user, pi_path_abs = setup_pi(project)
        print_summary(project, pi_ip, pi_user, pi_path_abs)
    except KeyboardInterrupt:
        print(f"\n{C.YLW}Setup cancelled.{C.RST}")