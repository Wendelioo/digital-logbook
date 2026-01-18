# AI Coding Instructions for Digital Logbook

This is a **Wails desktop application** for academic institution PC laboratory attendance tracking with role-based dashboards for admin, teacher, student, and working-student users.

## Architecture Overview

### Tech Stack
- **Backend**: Go (Wails v2.11) - desktop app runtime with embedded web server
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Database**: MySQL with connection via environment variables (DB_HOST, DB_USERNAME, DB_PASSWORD, DB_DATABASE)
- **Export**: PDF (gofpdf), CSV (encoding/csv), DOCX (go-docx)

### Key Components

**Backend Structure** (`app.go` - 4300 lines):
- **App struct**: Holds context and *sql.DB connection (initialized at startup)
- **Methods are Wails-bound**: All `func (a *App)` methods are automatically exposed to frontend via Wails JavaScript bridge
- **User roles**: admin, teacher, student, working_student (ENUM in MySQL)
- **Major feature areas**: Authentication, User Management, Attendance Logging, Equipment Feedback, Report Export

**Frontend Structure**:
- **AuthContext** (`contexts/AuthContext.tsx`): Manages user state and login/logout via Wails bridge calls (`Login()`, `Logout()`)
- **Role-based routing**: Protected routes with `RoleRoute` component enforcing role restrictions
- **Dashboards**: AdminDashboard, TeacherDashboard, StudentDashboard, WorkingStudentDashboard (separate pages for each role)
- **Styling**: Tailwind CSS with custom primary color palette

### Database Schema Key Tables
- `users`: Core authentication (username, password, user_type, account_lock fields)
- `admins`, `teachers`, `students`: Role-specific tables (user_id FK to users.id)
- `login_logs`: Records login/logout sessions with hostname PC tracking
- `attendance`: Student attendance per class session
- `feedback`: Equipment condition reports (computer, mouse, keyboard, monitor status + issues)
- `departments`: Organizational units for grouping users

## Wails Integration Patterns

### Frontend-Backend Communication
```typescript
// Frontend calls Go methods directly via Wails-generated bridge
import { Login, Logout } from '../../wailsjs/go/main/App';

const user = await Login(username, password);  // Returns *User struct as JSON
await Logout(userID);
```

**Important**: Wails automatically generates `wailsjs/go/main/App.js` and `.d.ts` from Go method signatures.

### Go Method Binding Rules
- Public methods on App struct are automatically exposed (capitalized names)
- Method signatures: `func (a *App) MethodName(params...) (returnType, error)`
- Error handling: Last return value is error; frontend receives error via Promise rejection
- JSON serialization: Use struct tags `json:"field_name"` for frontend mapping

## Developer Workflows

### Local Development
```bash
# Setup
npm install                          # frontend deps
wails doctor                         # verify environment
# MySQL must be running on localhost:3306 (default: root/root, database: logbookdb)

# Run in development mode
wails dev                            # starts Go + React dev server with hot reload

# Build production
wails build                          # generates executable and installer (.nsi for Windows)
```

### Database Setup
```bash
# Import schema (MySQL Workbench or CLI)
mysql -u root -p logbookdb < database/logbookschema.sql

# Seed sample data
mysql -u root -p logbookdb < database/seed.sql
```

**Config via environment variables**:
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` (defaults: localhost, 3306, root, root, logbookdb)

## Project Conventions

### Go Code Patterns
1. **Null handling**: Use `*sql.NullString`, `*sql.NullTime` for optional fields; check `.Valid` before accessing
2. **Error logging**: `log.Printf()` for errors (not panicking); check database availability in startup
3. **Database queries**: Use parameterized queries (`?` placeholders) for SQL injection prevention
4. **Bulk operations**: `CreateUsersBulkFromFile()` parses CSV; validates headers before batch insert

### Frontend Patterns
1. **User persistence**: localStorage stores user object on login; restored on app restart
2. **Styling**: Tailwind classes with custom primary palette; no CSS modules (pure Tailwind + inline styles)
3. **Role checking**: Always wrap sensitive routes with both `ProtectedRoute` and `RoleRoute` (see App.tsx)
4. **Icons**: lucide-react for UI icons (installed dependency)

### Data Flow: User Login
1. Frontend → `LoginPage` form submission calls `Login(username, password)` (Go method)
2. Backend → validates username in users table, verifies password hash, retrieves role-specific profile
3. Backend → records `login_logs` entry with hostname (PC detection)
4. Frontend ← receives User object, stores in localStorage and AuthContext, redirects to role-appropriate dashboard

### Report Generation
- **CSV export**: Uses `encoding/csv` writer; output goes to Downloads folder
- **PDF export**: Uses `gofpdf` library; format varies by report type (logs vs feedback)
- **Methods**: `ExportLogsCSV()`, `ExportLogsPDF()`, `ExportFeedbackCSV()`, `ExportFeedbackPDF()`

## Critical Files to Understand

| File | Purpose |
|------|---------|
| [app.go](app.go) | All backend logic; 30+ exported Go methods |
| [config.go](config.go) | Database connection setup and env var loading |
| [frontend/src/contexts/AuthContext.tsx](frontend/src/contexts/AuthContext.tsx) | User state management |
| [frontend/src/App.tsx](frontend/src/App.tsx) | Route protection logic |
| [database/logbookschema.sql](database/logbookschema.sql) | 400+ lines; includes schema comments explaining design decisions |
| [wails.json](wails.json) | Build config; npm scripts for frontend lifecycle |

## Common Tasks & Patterns

**Adding a new Go method**: Define `func (a *App) NewFeature(...) (ResultType, error)` in app.go → auto-exposed to frontend
**Querying attendance data**: See `GetAllLogs()` pattern—JOIN login_logs with users, scan into LoginLog struct
**Handling nullable fields**: `var field *string`; check `field != nil` before using
**Team working note**: The project is a capstone by 4 BSIT students; code prioritizes functionality over optimization

## External Dependencies
- **Wails**: v2.11 (desktop runtime)
- **React Router**: v6 (routing)
- **Tailwind**: v3 (styling)
- **MySQL Driver**: `github.com/go-sql-driver/mysql`
- **PDF/DOCX**: `gofpdf`, `go-docx` for exports
