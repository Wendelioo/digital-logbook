# Digital Logbook - Kiosk Mode Setup Guide

## Overview

Kiosk mode makes the Digital Logbook app the **mandatory first thing users see** on lab PCs. Users cannot use the computer without logging in or registering. Once logged in, they can **freely use Windows** (browse files, open other apps, etc.). When they logout, the app takes over the screen again forcing the next user to login.

### What Kiosk Mode Does:
- **Auto-starts** the app when Windows boots
- **Login screen blocks the PC** — fullscreen, always on top, can't close
- **After login** — app minimizes, user can freely use Windows normally
- **After logout** — app takes over the screen again (fullscreen, always on top)
- **Auto-logout** — inactivity timeout also re-locks the screen
- **Auto-restarts** if crashed (via optional kiosk_launcher.bat)

### User Flow:
```
PC turns on → App blocks screen (fullscreen login page)
    ↓
User logs in → App minimizes, user can freely use Windows
    ↓
User clicks Logout in the app → App goes fullscreen again (login page)
    ↓
Next user logs in...
```

---

## Step 1: Enable Kiosk Mode in config.json

Open `config.json` (located next to the `.exe` after installation) and set `kiosk_mode` to `true`:

```json
{
  "server": "192.168.1.200",
  "port": "1433",
  "username": "logbook_app",
  "password": "SecurePassword123!",
  "database": "logbookdb",
  "kiosk_mode": true
}
```

> **For development/testing**: Keep `kiosk_mode` as `false`. The app runs normally in windowed mode.

---

## Step 2: Install the App (Auto-Start is Included)

Run the NSIS installer (`Digital Logbook-amd64-installer.exe`). It will:
1. Install the app to `C:\Program Files\...`
2. Create desktop and Start Menu shortcuts
3. **Automatically register the app to start on Windows boot** (via Windows Registry)

The auto-start registry entry is at:
```
HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run\Digital Logbook
```

---

## Step 3 (Optional): Use the Kiosk Launcher for Auto-Restart

If you want the app to **automatically restart if it crashes**, use the `kiosk_launcher.bat` script:

1. Copy `kiosk_launcher.bat` to the installation folder (next to `Digital Logbook.exe`)
2. Change the startup registry to point to the launcher instead:
   - Press `Win + R` → type `regedit` → Enter
   - Navigate to: `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run`
   - Double-click `Digital Logbook`
   - Change the path to: `"C:\Program Files\...\kiosk_launcher.bat"`

---

## Step 4 (Recommended): Restrict Windows Features via Group Policy

To make the kiosk truly locked down, apply these Windows Group Policy settings on lab PCs:

### Open Group Policy Editor
Press `Win + R` → type `gpedit.msc` → Enter

### Recommended Policies

| Policy Location | Setting | Value |
|---|---|---|
| `User Config > Admin Templates > System` | **Prevent access to registry editing tools** | Enabled |
| `User Config > Admin Templates > System` | **Prevent access to the command prompt** | Enabled |
| `User Config > Admin Templates > System > Ctrl+Alt+Del Options` | **Remove Task Manager** | Enabled |
| `User Config > Admin Templates > Desktop` | **Hide and disable all items on the desktop** | Enabled |
| `User Config > Admin Templates > Start Menu and Taskbar` | **Remove and prevent access to Shut Down** | Enabled (optional) |
| `Computer Config > Admin Templates > System` | **Don't display the Getting Started welcome screen** | Enabled |

> **Important**: Apply these policies to the **student/lab user account**, NOT the admin account. You need a separate Windows admin account to manage the PC.

### Recommended Windows Account Setup for Lab PCs
1. **Admin account** (e.g., `LabAdmin`) — full privileges, for IT staff only
2. **Student account** (e.g., `Student` or `LabUser`) — restricted account with Group Policy applied
3. Set the student account to **auto-login** on boot (see Step 5)

---

## Step 5 (Optional): Auto-Login Windows User

To skip the Windows login screen and go straight to the Digital Logbook:

1. Press `Win + R` → type `netplwiz` → Enter
2. Select the lab user account (e.g., `Student`)
3. **Uncheck** "Users must enter a user name and password to use this computer"
4. Click Apply → enter the account password when prompted
5. Restart to verify

Now the PC boots → Windows auto-logs in → Digital Logbook launches in fullscreen.

---

## How Users Experience It

```
PC turns on
    ↓
Windows auto-logs in (no Windows login screen)
    ↓
Digital Logbook launches fullscreen automatically
    ↓
User sees LOGIN PAGE (must login or register to use the PC)
    ↓
User logs in → App minimizes, Windows desktop is accessible
    ↓
User can freely browse files, open apps, use the PC normally
    ↓
User clicks Logout in the app → App goes FULLSCREEN again
    ↓
Login page blocks the screen → next user must login
```

---

## How Admins/IT Staff Manage the PC

### To temporarily exit kiosk mode:
1. Press `Ctrl + Alt + Delete` → open **Task Manager** (if not disabled by policy)
2. End the `Digital Logbook.exe` process
3. If using `kiosk_launcher.bat`, also end the `cmd.exe` running it

### To permanently disable kiosk mode:
1. Open `config.json` next to the executable
2. Set `"kiosk_mode": false`
3. Restart the app

### To remove auto-startup:
1. Open `regedit`
2. Go to: `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run`
3. Delete the `Digital Logbook` entry

### To switch to admin Windows account:
- Press `Ctrl + Alt + Delete` → **Switch User** or **Sign Out**
- Log into the `LabAdmin` account

---

## Troubleshooting

| Issue | Solution |
|---|---|
| App doesn't start on boot | Check registry entry exists at `HKLM\...\Run` |
| App starts but not fullscreen | Verify `config.json` has `"kiosk_mode": true` |
| Can't close app for maintenance | Use Task Manager (`Ctrl+Shift+Esc`) or `taskkill /f /im "Digital Logbook.exe"` in admin cmd |
| App crashes and doesn't restart | Use `kiosk_launcher.bat` instead of direct `.exe` startup |
| Students can Alt+Tab away | The `AlwaysOnTop` setting prevents this; also apply Group Policy to hide taskbar |
| Need to update the app | Log into Windows admin account, stop the app, run the new installer |

---

## Security Notes

- **Kiosk mode is NOT a security boundary** — it's a convenience lock. A determined user with physical access can bypass it.
- **Always use a restricted Windows user account** with Group Policy for actual security.
- **The admin Windows account** should have a strong password known only to IT staff.
- **Passwords in the app** are stored in plain text — implement proper hashing before real production deployment.
