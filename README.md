# 935 SCOUT - Setup & Operations Guide

FRC Team 935 · 2026 Season

## System Architecture

```
Scouting Tablets (Old Amazon Fire tablets)
    ↓ USB cable
Raspberry Pi → Runs dashboard at http://PI_IP:3000
    ↑ Bluetooth
Drive Tablet (Newer Android tablet)
```

---

## 1. Prerequisites

### 1.1 Software

Install on your development machine:

- **Android Studio** - [Download](https://developer.android.com/studio)
  - Open once to download Android SDK
- **Java 17 (JDK)** - [Download](https://www.oracle.com/java/technologies/downloads/#java17)
  - Android builds require exactly JDK 17
- **Node.js LTS** - [Download](https://nodejs.org)
  - Use LTS version
- **ADB (Android Debug Bridge)**
  ```bash
  # Arch
  sudo pacman -S android-tools
  
  # Ubuntu/Debian
  sudo apt install adb
  
  # Mac
  brew install android-platform-tools
  ```
- **Git** - [Download](https://git-scm.com)

### 1.2 Raspberry Pi Requirements

- Raspberry Pi (any model with Bluetooth and USB ports)
- Raspberry Pi OS Lite or Desktop installed
- SSH enabled (enabled during flashing)
- Connected to same network as dev machine
- Python 3 installed (comes with Raspberry Pi OS)

> ⚠️ All setup can be automated: `python3 setup_linux.py` on dev machine. Read this guide first to understand what it does.

---

## 2. Project Structure

```
Scouting-App/
├── Server/
│   ├── Server.js                 # Dashboard web server (Node.js)
│   ├── bt_server.py              # Bluetooth server (drive tablet)
│   ├── usb_server.py             # USB/HTTP server (scouting tablets)
│   ├── package.json
│   └── data/
│       └── scouting_database.json
│
└── Scouter Tablets/              # Capacitor Android app
    ├── android/
    │   ├── app/
    │   │   └── build.gradle
    │   ├── build.gradle          # AGP version lives here
    │   ├── variables.gradle
    │   └── gradle/wrapper/gradle-wrapper.properties
    ├── src/
    │   └── public/
    │       └── form.html         # The actual scouting app
    ├── capacitor.config.ts
    └── package.json
```

---

## 3. Android Studio Setup

### 3.1 Open the Android Project

1. Open Android Studio
2. Click "Open" (not "New Project")
3. Navigate to `Scouting-App/Scouter Tablets/android` and click OK
4. Wait for Gradle to sync (may take several minutes first time)

> ⚠️ Open the `android/` subfolder specifically, NOT the "Scouter Tablets" root folder. Android Studio needs the Gradle project directly.

### 3.2 Set JDK to Version 17

The build fails with any JDK other than 17. Set it explicitly:

1. File → Settings (Mac: Android Studio → Settings)
2. Build, Execution, Deployment → Build Tools → Gradle
3. Under "Gradle JDK", click dropdown and select JDK 17
4. If JDK 17 not listed:
   - Click Download JDK → select version 17 → Vendor: Eclipse Temurin or Amazon Corretto → Download
5. Click OK and wait for Gradle re-sync

**Verify JDK version:**
```bash
java -version  # Should say version 17
```

### 3.3 Gradle Version Configuration

Project uses specific Gradle and AGP versions for Fire OS tablet compatibility. **Do not upgrade.**

**android/build.gradle (Project level):**
```gradle
classpath 'com.android.tools.build:gradle:7.4.2'
```

**android/gradle/wrapper/gradle-wrapper.properties:**
```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-7.6.4-all.zip
```

**android/variables.gradle:**
```gradle
ext {
    minSdkVersion = 22
    compileSdkVersion = 33
    targetSdkVersion = 33
    androidxActivityVersion = '1.7.2'
    androidxAppCompatVersion = '1.6.1'
    androidxCoordinatorLayoutVersion = '1.2.0'
    androidxCoreVersion = '1.9.0'
    androidxFragmentVersion = '1.6.2'
    coreSplashScreenVersion = '1.0.1'
    androidxWebkitVersion = '1.7.0'
    junitVersion = '4.13.2'
    androidxJunitVersion = '1.1.5'
    androidxEspressoCoreVersion = '3.5.1'
}
```

> ⚠️ These versions are deliberately old. Fire tablets run Fire OS based on Android 5.1 (API 22). Upgrading breaks the build.

### 3.4 Sync and Build

After any Gradle file change:
1. File → Sync Project with Gradle Files (or elephant sync icon)

If sync fails with AGP/version mismatch:
1. File → Invalidate Caches → Invalidate and Restart
2. After restart, sync again

### 3.5 Build and Install the APK

1. Plug Fire tablet into dev machine via USB
2. Enable USB Debugging on tablet (see Section 5.1)
3. Click Run → Run 'app' (Shift+F10) or green play button

Android Studio builds APK and installs directly to tablet.

**Build standalone APK without installing:**
```
Build → Build Bundle(s) / APK(s) → Build APK(s)
APK located: android/app/build/outputs/apk/debug/
```

---

## 4. Raspberry Pi Setup

The Pi is the central hub. It runs three servers simultaneously: dashboard, Bluetooth server (drive tablet), and USB server (scouting tablets).

### 4.1 Automated Setup

Fastest way from dev machine:

```bash
python3 setup_linux.py
```

Installs all dependencies, configures Bluetooth, installs adb, uploads server files, and prints competition commands.

### 4.2 Manual Pi Setup

SSH into Pi and run:

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Bluetooth deps (for drive tablet)
sudo apt-get install -y python3-bluetooth bluetooth bluez libbluetooth-dev
pip3 install pybluez --break-system-packages

# Install adb (for USB scouting tablets)
sudo apt-get install -y adb

# Create data directory
mkdir -p ~/Scouting-App/Server/data
echo "[]" > ~/Scouting-App/Server/data/scouting_database.json
```

### 4.3 Configure Bluetooth

Drive tablet connects via Bluetooth. Pi needs discoverable mode and pybluez compat mode enabled:

```bash
# Create compat config for bluetoothd
sudo mkdir -p /etc/systemd/system/bluetooth.service.d
sudo nano /etc/systemd/system/bluetooth.service.d/compat.conf
```

Paste into file:
```ini
[Service]
ExecStart=
ExecStart=/usr/sbin/bluetoothd --compat --noplugin=sap
```

Apply it:
```bash
sudo systemctl daemon-reload
sudo systemctl restart bluetooth
sudo rfkill unblock bluetooth
sudo hciconfig hci0 up
sudo sdptool add SP
sudo hciconfig hci0 piscan
sudo hciconfig hci0 name "935-Scout-Pi"
```

### 4.4 Upload Server Files

Copy server files from dev machine to Pi:

```bash
scp Server/bt_server.py pi_user@PI_IP:~/Scouting-App/Server/
scp Server/usb_server.py pi_user@PI_IP:~/Scouting-App/Server/
scp Server/Server.js pi_user@PI_IP:~/Scouting-App/Server/
scp Server/package.json pi_user@PI_IP:~/Scouting-App/Server/
```

SSH in and install npm deps:

```bash
ssh pi_user@PI_IP
cd ~/Scouting-App/Server && npm install
```

---

## 5. Tablet Setup

### 5.1 Enable USB Debugging on Fire Tablets

1. Open Settings on tablet
2. Tap "Device Options"
3. Find "Serial Number" and tap it 7 times rapidly
   - Message: "You are now a developer"
4. Go back: Device Options → Developer Options
5. Enable "USB Debugging"

> ⚠️ Fire tablet screen must be unlocked showing "Allow USB Debugging" popup when first connecting to new computer. Tap "Allow" and check "Always allow from this computer".

### 5.2 Install the Scouting App

With USB Debugging enabled and tablet plugged into dev machine:

1. Open Android Studio with the `android/` project
2. Tablet appears in device dropdown at top
3. Click Run → Run 'app' to build and install

Repeat for each scouting tablet.

**If tablet doesn't appear in Android Studio:**
```bash
adb devices  # Check status

# If "unauthorized": unlock tablet and tap Allow on popup
# If "no permissions": 
sudo adb kill-server && sudo adb start-server
```

### 5.3 Drive Tablet (Bluetooth)

Drive tablet uses Bluetooth, should be newer Android device (Android 7+).

1. Ensure Pi's `bt_server.py` is running (see Section 6)
2. On drive tablet: Settings → Bluetooth
3. Scan for devices and pair with "935-Scout-Pi"
4. Open scouting app on drive tablet (connects automatically)

---

## 6. Competition Day Operations

### 6.1 Starting Everything on the Pi

SSH into Pi and run all three servers. **Order matters** — start data servers before dashboard.

```bash
ssh pi_user@PI_IP

# Start Bluetooth server (drive tablet)
sudo python3 ~/Scouting-App/Server/bt_server.py &

# Start USB server (scouting tablets)
sudo python3 ~/Scouting-App/Server/usb_server.py &

# Start dashboard (keep in foreground to see logs)
node ~/Scouting-App/Server/Server.js
```

Dashboard available at `http://PI_IP:3000` from any device on same network.

### 6.2 Connecting Scouting Tablets via USB

After plugging scouting tablet into Pi via USB:

1. Ensure USB Debugging enabled and "Allow USB Debugging" popup accepted
2. Run ADB reverse tunnel on Pi:

```bash
sudo adb reverse tcp:8765 tcp:8765
```

Tablet app can now send data. Hit Send button after completing match.

> ⚠️ Run `adb reverse tcp:8765 tcp:8765` once per tablet each time you plug it in. With multiple tablets, run once — adb applies to all authorized devices.

### 6.3 How USB Transfer Works

- Scouting app POSTs match data to `http://localhost:8765/scout` on tablet
- ADB reverse tunnels request through USB cable to port 8765 on Pi
- `usb_server.py` receives and saves to `scouting_database.json`
- No WiFi or internet involved

### 6.4 Pulling Data from the Pi

Copy scouting database to laptop anytime:

```bash
scp pi_user@PI_IP:~/Scouting-App/Server/data/scouting_database.json ~/Downloads/scouting_database.json
```

### 6.5 Checking What Has Been Received

Check current database on Pi anytime:

```bash
cat ~/Scouting-App/Server/data/scouting_database.json | python3 -m json.tool | head -50
```

Check record count:

```bash
python3 -c "import json; d=json.load(open('~/Scouting-App/Server/data/scouting_database.json')); print(len(d), 'records')"
```

---

## 7. Troubleshooting

### 7.1 Build Fails — AGP/Namespace Error

If "Namespace not specified" or AGP version mismatch errors:

- Ensure `android/build.gradle` has AGP 7.4.2
- Ensure `gradle-wrapper.properties` has Gradle 7.6.4
- File → Invalidate Caches → Invalidate and Restart in Android Studio
- After restart, sync again

### 7.2 Build Fails — setAppCacheEnabled

`setAppCacheEnabled` removed in Android SDK 33. Patched with patch-package. If reappears after fresh npm install:

```bash
cd "Scouter Tablets"
npx patch-package @capacitor/android
```

### 7.3 App Crashes on Launch — ServiceWorkerController

APK built targeting too high API level or Capacitor version too new. Check:

- `variables.gradle` has `compileSdkVersion = 33` and `minSdkVersion = 22`
- Capacitor version is 3.x: `cat package.json | grep capacitor`

### 7.4 Tablet Not Showing in adb devices

```bash
sudo adb kill-server
sudo adb start-server
adb devices
```

**If "unauthorized":**
1. Wake up tablet screen
2. Look for "Allow USB Debugging" popup and tap Allow
3. Run `adb devices` again

**If "no permissions":**
```bash
sudo adb kill-server && sudo adb start-server
```

### 7.5 Send Failed in App

Check in order:

1. Is `usb_server.py` running on Pi?
2. Did you run `sudo adb reverse tcp:8765 tcp:8765` after plugging in tablet?
3. Is tablet showing as "device" (not "unauthorized") in `adb devices`?
4. Try unplugging and replugging USB cable, then run adb reverse again

### 7.6 Bluetooth Drive Tablet Cannot Connect

Check on Pi:

```bash
sudo systemctl status bluetooth
sudo hciconfig hci0
```

If Bluetooth is down:

```bash
sudo rfkill unblock bluetooth
sudo hciconfig hci0 up
sudo hciconfig hci0 piscan
sudo python3 ~/Scouting-App/Server/bt_server.py
```

---

## 8. Quick Reference

### Key Commands

| Task | Command |
|------|---------|
| Start BT server | `sudo python3 ~/Scouting-App/Server/bt_server.py &` |
| Start USB server | `sudo python3 ~/Scouting-App/Server/usb_server.py &` |
| Start dashboard | `node ~/Scouting-App/Server/Server.js` |
| Connect scouting tablet | `sudo adb reverse tcp:8765 tcp:8765` |
| Check adb devices | `adb devices` |
| Pull database | `scp pi_user@PI_IP:~/Scouting-App/Server/data/scouting_database.json ~/Downloads/` |
| SSH into Pi | `ssh pi_user@PI_IP` |
| Re-run setup | `python3 setup_linux.py` |

### File Locations

| File | Purpose |
|------|---------|
| `android/build.gradle` | AGP version — must be 7.4.2 |
| `android/variables.gradle` | SDK versions — must stay at API 33 |
| `gradle-wrapper.properties` | Gradle version — must be 7.6.4 |
| `android/app/build.gradle` | App dependencies + resolution strategy |
| `src/public/form.html` | The scouting app UI and logic |
| `Server/usb_server.py` | HTTP server receiving USB data on Pi |
| `Server/bt_server.py` | Bluetooth server for drive tablet on Pi |
| `Server/Server.js` | Dashboard web server on Pi |
| `Server/data/scouting_database.json` | All scouting records |


changes to make sync work
