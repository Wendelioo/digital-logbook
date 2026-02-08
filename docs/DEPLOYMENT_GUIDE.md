# 🚀 Digital Logbook - Deployment Guide

This guide will help you install and configure the Digital Logbook application on different computers in your lab.

## 📋 Prerequisites

Before installing the application, ensure you have:

1. **SQL Server Database** accessible on your network
   - Server IP address (e.g., `192.168.1.200`)
   - Database name (default: `logbookdb`)
   - Username and password with appropriate permissions
   
2. **Network Access**
   - The PC must be able to connect to the SQL Server over the network
   - Firewall rules allowing SQL Server port (default: 1433)

## 📦 Installation Steps

### Option 1: Quick Setup (Recommended)

1. **Copy the installer or exe file** to the target PC
2. **Run the installer** and choose an installation folder
3. **Launch the application**
4. **If login fails with database error:**
   - Click the **"Configure Database Connection"** link in the error message
   - OR navigate directly to the database setup screen
5. **Enter your database details:**
   - Server Address: Your SQL Server IP (e.g., `192.168.1.200`)
   - Port: `1433` (default)
   - Database Name: `logbookdb`
   - Username: `logbook_app` (or your database username)
   - Password: Your database password
   - Instance: Leave blank unless using named instance (e.g., `SQLEXPRESS`)
6. **Click "Test Connection"** to verify settings
7. **Click "Save & Connect"** to save configuration
8. **Return to login page** and log in

### Option 2: Manual Configuration with Batch File

If you're deploying to multiple PCs, you can create a launcher script:

1. **Navigate to the installation folder** (where the .exe is located)
2. **Create a file** named `run-logbook.bat` with this content:

```batch
@echo off
REM Database Configuration - Update these values
set DB_SERVER=192.168.1.200
set DB_PORT=1433
set DB_USERNAME=logbook_app
set DB_PASSWORD=YourPasswordHere
set DB_DATABASE=logbookdb
REM set DB_INSTANCE=SQLEXPRESS

REM Launch the application
start "" "digital-logbook.exe"
```

3. **Edit the values** to match your database server
4. **Run the batch file** instead of the exe directly

### Option 3: Configuration File

The application automatically creates a `db_config.json` file after successful database setup. You can:

1. **Configure one PC** using the GUI (Option 1)
2. **Copy the `db_config.json` file** from the installation folder
3. **Paste it** into the installation folder on other PCs
4. **Launch the application** - it will use the saved settings

**Example db_config.json:**
```json
{
  "server": "192.168.1.200",
  "port": "1433",
  "username": "logbook_app",
  "password": "SecurePassword123!",
  "database": "logbookdb",
  "instance": ""
}
```

⚠️ **Security Note:** The password is stored in plain text. Ensure the config file has appropriate permissions.

## 🔧 Database Server Setup

Your IT administrator should have already set up the SQL Server database. If not:

### SQL Server Requirements

1. **Create the database:**
   ```sql
   CREATE DATABASE logbookdb;
   ```

2. **Create a login for the application:**
   ```sql
   CREATE LOGIN logbook_app WITH PASSWORD = 'SecurePassword123!';
   USE logbookdb;
   CREATE USER logbook_app FOR LOGIN logbook_app;
   ALTER ROLE db_owner ADD MEMBER logbook_app;
   ```

3. **Enable TCP/IP connections:**
   - Open SQL Server Configuration Manager
   - Enable TCP/IP protocol
   - Set port to 1433
   - Restart SQL Server service

4. **Configure Windows Firewall:**
   ```powershell
   New-NetFirewallRule -DisplayName "SQL Server" -Direction Inbound -Protocol TCP -LocalPort 1433 -Action Allow
   ```

5. **Import the database schema:**
   - Use the `database/logbookdb_sqlserver.sql` file
   - Run it against your logbookdb database

## 🌐 Network Configuration

### Finding Your Database Server IP

On the SQL Server machine:
```powershell
ipconfig
```
Look for IPv4 Address under your network adapter.

### Testing Network Connectivity

From the client PC:
```powershell
Test-NetConnection -ComputerName 192.168.1.200 -Port 1433
```

Should return `TcpTestSucceeded: True`

## ❓ Troubleshooting

### Error: "Failed to connect to database"

**Possible causes:**
- Database server is not running
- Network connectivity issues
- Firewall blocking port 1433
- Incorrect server IP or credentials
- SQL Server not configured for remote connections

**Solutions:**
1. Verify server IP with ping: `ping 192.168.1.200`
2. Check port access: `Test-NetConnection -ComputerName 192.168.1.200 -Port 1433`
3. Verify credentials with SQL Server Management Studio
4. Check SQL Server error logs
5. Use the built-in Database Setup screen to test connection

### Error: "Database not connected"

The application couldn't establish a database connection on startup.

**Solution:** Use the Database Setup screen to configure and test the connection.

### Login Works on One PC but Not Another

**Likely cause:** The other PC doesn't have the database configuration.

**Solution:** 
- Use Database Setup screen on the new PC
- OR copy `db_config.json` from working PC
- OR use the batch file method (Option 2)

### SQL Server Named Instance (e.g., SQLEXPRESS)

If using a named instance:
- Server: `COMPUTER-NAME` or `192.168.1.200`
- Instance: `SQLEXPRESS`
- OR use combined format in Server field: `192.168.1.200\SQLEXPRESS`

## 📝 Deployment Checklist

- [ ] SQL Server database is set up and accessible
- [ ] Database schema is imported
- [ ] Test credentials work from SQL Management Studio
- [ ] Port 1433 is open on firewall
- [ ] Application is installed on client PC
- [ ] Database connection is configured (via GUI, batch file, or config file)
- [ ] Test login with existing user account
- [ ] Verify attendance logging works
- [ ] Confirm data is saved to database

## 🎯 Quick Reference

| Component | Default Value | Customizable |
|-----------|---------------|--------------|
| Server | `192.168.1.200` | ✅ Yes |
| Port | `1433` | ✅ Yes |
| Database | `logbookdb` | ✅ Yes |
| Username | `logbook_app` | ✅ Yes |
| Password | - | ✅ Yes |
| Instance | (blank) | ✅ Optional |

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify network connectivity to database server
3. Test database credentials with SQL Management Studio
4. Contact your IT administrator for network/firewall issues
5. Check application logs in the installation folder

---

**Last Updated:** February 2026
**Version:** 1.0
