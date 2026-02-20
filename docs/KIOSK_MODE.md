# Kiosk Mode Configuration

## Overview
Kiosk mode locks the application in fullscreen and prevents users from closing the window without logging out. This is designed for PC laboratory environments where the Digital Logbook runs on dedicated kiosk stations.

## Configuration

### Development Mode (Default)
In development, kiosk mode is **disabled** by default to allow normal development workflow:

```json
{
  "kiosk_mode": false
}
```

Features when disabled:
- Normal window size (resizable)
- Can close window normally
- Standard application behavior
- Suitable for development and testing

### Production Mode (Kiosk Stations)
For production deployment in PC laboratories, enable kiosk mode:

```json
{
  "kiosk_mode": true
}
```

Features when enabled:
- Fullscreen mode on startup
- Always on top window
- Cannot close window while screen is locked
- Must logout properly to exit
- Prevents unauthorized access

## How to Enable Kiosk Mode for Production

1. **Edit config.json** in the application directory:
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

2. **Build the production executable**:
   ```bash
   wails build
   ```

3. **Deploy** the executable with the updated `config.json` file to kiosk stations.

## Location of config.json

The application searches for `config.json` in the following locations (in order):

1. **Executable directory** (production) - next to the `.exe` file
2. **Current working directory** (development) - project root

## Development vs Production

| Aspect | Development (`wails dev`) | Production (`wails build`) |
|--------|---------------------------|----------------------------|
| Kiosk Mode | **Disabled** (`false`) | **Enabled** (`true`) for lab PCs |
| Window State | Normal, resizable | Fullscreen, always on top |
| Close Behavior | Standard close | Locked - must logout |
| Use Case | Development & testing | Laboratory kiosk stations |

## Best Practices

1. **Keep development config with `kiosk_mode: false`** for easier development
2. **Create separate production config** with `kiosk_mode: true` for deployment
3. **Document your production config** in deployment notes
4. **Test kiosk mode** before deploying to production stations

## Troubleshooting

### Kiosk mode not activating
- Check `config.json` exists next to the executable
- Verify JSON syntax is valid
- Check application logs for config loading messages

### Can't close application in development
- Set `kiosk_mode: false` in `config.json`
- Restart the application (`wails dev`)

### Want to test kiosk mode in development
- Temporarily set `kiosk_mode: true` in root `config.json`
- Run `wails dev`
- Remember to set back to `false` after testing

## Related Files
- `config.go` - Loads kiosk mode settings
- `main.go` - Applies kiosk settings to window configuration
- `app.go` - Implements screen lock behavior
