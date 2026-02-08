# Database Configuration Deployment Guide

## Overview
The application now loads database settings from a `config.json` file placed **next to the executable**, making it easy to deploy to multiple client PCs without recompiling.

## Setup Instructions

### 1. Build Your Application with NSIS Installer
```bash
wails build
```

This command:
- ✅ Compiles the Go backend
- ✅ Builds the React frontend
- ✅ Creates the executable
- ✅ **Generates the NSIS installer** in `build/bin/`

The installer will be named something like: `digital-logbook-amd64-installer.exe`

### 2. What Gets Installed
When users run your installer, it will copy to the installation directory (typically `C:\Program Files\...`):
- Your application executable
- **config.json** (automatically included via modified `project.nsi`)

### 3. Customize config.json Before Building
**IMPORTANT**: Before running `wails build`, edit `config.json` in your project root with the correct server IP:

```json
{
  "server": "192.168.1.200",  ← Change this to your SQL Server IP
  "port": "1433",
  "username": "logbook_app",
  "password": "SecurePassword123!",
  "database": "logbookdb"
}
```

### 4. Distribution Options

#### Option A: Single Installer (Recommended for LAN)
1. Edit `config.json` with your SQL Server IP
2. Run `wails build`
3. Distribute `build/bin/digital-logbook-amd64-installer.exe` to all client PCs
4. Users run the installer - it installs both app and config.json
5. **All clients connect to the same server** (configured once at build time)

#### Option B: Manual Configuration (For Multiple Servers)
1. Run `wails build` with default config.json
2. After installation, users navigate to install directory:
   - Default: `C:\Program Files\YourCompany\YourProduct\`
3. Edit `config.json` directly in the installation folder
4. Restart the application

#### Option C: Pre-configured Installers
Build multiple installers for different locations:
```bash
# Edit config.json for Server A (192.168.1.200)
wails build
move build\bin\*-installer.exe build\bin\installer-ServerA.exe

# Edit config.json for Server B (192.168.2.100)  
wails build
move build\bin\*-installer.exe build\bin\installer-ServerB.exe
```

## Configuration Fields

| Field      | Description                           | Example           |
|------------|---------------------------------------|-------------------|
| `server`   | SQL Server IP address or hostname     | `192.168.1.200`   |
| `port`     | SQL Server TCP port                   | `1433`            |
| `username` | SQL Server authentication username    | `logbook_app`     |
| `password` | SQL Server authentication password    | `SecurePassword123!` |
| `database` | Database name                         | `logbookdb`       |

## Defaults
If `config.json` is missing or malformed, the app uses these defaults:
- **Server**: 192.168.1.200
- **Port**: 1433
- **Username**: logbook_app
- **Password**: SecurePassword123!
- **Database**: logbookdb

## Troubleshooting

### "Login failed" errors on client PCs
**Check:**
1. ✅ `config.json` exists next to the executable
2. ✅ Server IP in config.json is correct
3. ✅ SQL Server is accessible from client PC (ping test)
4. ✅ SQL Server TCP/IP protocol is enabled (port 1433)
5. ✅ Firewall allows incoming connections on port 1433
6. ✅ SQL Server authentication is enabled (not just Windows auth)
7. ✅ Username/password are correct

### Config file not found
**The app looks for `config.json` in the executable's directory.**

To verify the location:
- Run the app and check the console output
- Look for the line: `📁 Looking for config file at: <path>`

### Connection works on server but not on clients
**Most common cause**: Firewall blocking port 1433

**Fix on SQL Server**:
1. Open Windows Firewall
2. Create new inbound rule for TCP port 1433
3. Allow connections from your LAN subnet

## SQL Server Setup Checklist

On your SQL Server machine:

1. **Enable TCP/IP Protocol**:
   - Open SQL Server Configuration Manager
   - Go to SQL Server Network Configuration → Protocols
   - Enable TCP/IP protocol
   - Restart SQL Server service

2. **Configure Port 1433**:
   - In TCP/IP properties → IP Addresses tab
   - Set TCP Port to `1433` for all IP addresses
   - Restart SQL Server service

3. **Enable SQL Server Authentication**:
   - Open SQL Server Management Studio
   - Right-click server → Properties → Security
   - Select "SQL Server and Windows Authentication mode"
   - Restart SQL Server service

4. **Create Login**:
   ```sql
   CREATE LOGIN logbook_app WITH PASSWORD = 'SecurePassword123!';
   USE logbookdb;
   CREATE USER logbook_app FOR LOGIN logbook_app;
   ALTER ROLE db_owner ADD MEMBER logbook_app;
   ```

5. **Configure Firewall**:
   ```powershell
   New-NetFirewallRule -DisplayName "SQL Server" -Direction Inbound -Protocol TCP -LocalPort 1433 -Action Allow
   ```

## Testing Connection

### From Client PC (PowerShell):
```powershell
# Test network connectivity
Test-NetConnection -ComputerName 192.168.1.200 -Port 1433

# Should show: TcpTestSucceeded : True
```

### Using SQL Server Management Studio:
Connect from a client PC using:
- **Server**: 192.168.1.200,1433
- **Authentication**: SQL Server Authentication
- **Username**: logbook_app
- **Password**: SecurePassword123!

If SSMS connects successfully, your Wails app should too.

## Security Notes

⚠️ **Important**: 
- The config.json file contains plaintext credentials
- Ensure proper file permissions on production deployments
- Consider using Windows ACLs to restrict access to config.json
- For production, change default passwords
- Use strong passwords for SQL Server authentication

## Example Deployment Workflow

1. Build application: `wails build`
2. Copy executable from `build/bin/` to deployment folder
3. Create `config.json` with client-specific server IP
4. Test connection from client PC
5. Distribute to users (installer or manual copy)

---

**Need Help?**
If connections still fail after following this guide, check application logs for specific error messages with troubleshooting tips.
