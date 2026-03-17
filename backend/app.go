package backend

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ==============================================================================
// APP STRUCTURE
// ==============================================================================

// App struct
type App struct {
	ctx          context.Context
	db           *sql.DB
	kioskMode    bool
	screenLocked bool
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Load app settings for kiosk mode
	appConfig := LoadAppSettings()
	a.kioskMode = appConfig.KioskMode
	a.screenLocked = appConfig.KioskMode // Start locked if kiosk mode is on

	// Initialize database connection with retry
	var db *sql.DB
	var err error

	maxRetries := 3
	for i := 1; i <= maxRetries; i++ {
		db, err = InitDatabase()
		if err == nil {
			break
		}
		log.Printf("Database connection attempt %d/%d failed: %v", i, maxRetries, err)
		if i < maxRetries {
			log.Printf("Retrying in %d seconds...", i*2)
			time.Sleep(time.Duration(i*2) * time.Second)
		}
	}

	if err != nil {
		log.Println("All database connection attempts failed - will auto-reconnect on next request")
		log.Println("To fix: Check SQL Server is running, TCP/IP is enabled, and credentials are correct")
	} else {
		a.db = db
		log.Println("Database connected successfully")
		if err := a.ensureSessionHeartbeatTable(); err != nil {
			log.Printf("Failed to ensure session heartbeat table: %v", err)
		}
		if err := a.ensureActivityTrackingColumns(); err != nil {
			log.Printf("Failed to ensure activity tracking columns: %v", err)
		}
		if err := a.closeStaleSessions(); err != nil {
			log.Printf("Failed to close stale sessions on startup: %v", err)
		}
		if err := a.ensureNotificationsTable(); err != nil {
			log.Printf("Failed to ensure notifications table: %v", err)
		}
		if err := a.CleanOldNotifications(); err != nil {
			log.Printf("Failed to clean old notifications: %v", err)
		}
	}

	// If kiosk mode is on, force lock the screen on startup
	// (using runtime API since Wails startup options alone aren't reliable)
	if a.kioskMode {
		go func() {
			// Small delay to let the window fully initialize
			time.Sleep(500 * time.Millisecond)
			wailsRuntime.WindowSetAlwaysOnTop(a.ctx, true)
			wailsRuntime.WindowFullscreen(a.ctx)
			log.Println("Kiosk mode: Screen locked on startup")
		}()
	}
}

func (a *App) shutdown(ctx context.Context) {
	if err := a.CloseSessionsForCurrentHost(); err != nil {
		log.Printf("Failed to close sessions on app shutdown: %v", err)
	}
}

// SaveFileDialog opens the native Save As dialog so the user can choose where to save a file
// (e.g. Documents or any folder). Returns the chosen path, or empty string if cancelled.
// defaultFilename is the suggested name (e.g. "classlist_math_20240101.csv").
// filterDisplayName and filterPattern set the file type filter (e.g. "CSV files", "*.csv").
func (a *App) SaveFileDialog(title string, defaultFilename string, filterDisplayName string, filterPattern string) (string, error) {
	homeDir, _ := os.UserHomeDir()
	defaultDir := filepath.Join(homeDir, "Documents")
	// DefaultDirectory must exist; fallback to home if Documents is missing
	if _, err := os.Stat(defaultDir); err != nil {
		defaultDir = homeDir
	}
	path, err := wailsRuntime.SaveFileDialog(a.ctx, wailsRuntime.SaveDialogOptions{
		Title:            title,
		DefaultFilename:  defaultFilename,
		DefaultDirectory: defaultDir,
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: filterDisplayName, Pattern: filterPattern},
		},
	})
	if err != nil {
		return "", err
	}
	return path, nil
}

// ==============================================================================
// KIOSK / SCREEN LOCK METHODS
// ==============================================================================

// UnlockScreen is called after successful login.
// Turns the app into a normal resizable window so the user can use it alongside other apps.
func (a *App) UnlockScreen() {
	if !a.kioskMode {
		return
	}
	a.screenLocked = false
	wailsRuntime.WindowUnfullscreen(a.ctx)
	wailsRuntime.WindowSetAlwaysOnTop(a.ctx, false)
	wailsRuntime.WindowSetSize(a.ctx, 1000, 700)
	wailsRuntime.WindowCenter(a.ctx)
	log.Println("Screen unlocked - app is now a normal window")
}

// LockScreen is called after logout.
// Restores fullscreen and always-on-top to force the next user to login.
func (a *App) LockScreen() {
	if !a.kioskMode {
		return
	}
	a.screenLocked = true
	wailsRuntime.WindowSetAlwaysOnTop(a.ctx, true)
	wailsRuntime.WindowMaximise(a.ctx)
	wailsRuntime.WindowFullscreen(a.ctx)
	log.Println("Screen locked - waiting for next user to login")
}

// IsKioskMode returns whether kiosk mode is enabled (for frontend to know)
func (a *App) IsKioskMode() bool {
	return a.kioskMode
}

// ==============================================================================
// SHARED TYPE DEFINITIONS
// ==============================================================================

// User represents a user in the system
type User struct {
	ID             int     `json:"id"`
	Password       string  `json:"password"`
	Name           string  `json:"name"`
	FirstName      *string `json:"first_name"`
	MiddleName     *string `json:"middle_name"`
	LastName       *string `json:"last_name"`
	Role           string  `json:"role"`
	EmployeeID     *string `json:"employee_id"`
	StudentID      *string `json:"student_id"`
	Email          *string `json:"email"`
	ContactNumber  *string `json:"contact_number"`
	PhotoURL       *string `json:"photo_url"` // Base64 data URL for frontend display
	DepartmentCode *string `json:"department_code"`
	Created        string  `json:"created"`
	LoginLogID     int     `json:"login_log_id"` // Track the login session
	// Activity tracking fields (populated by GetUsersByActivityStatus)
	LastLoginAt    *string `json:"last_login_at,omitempty"`   // ISO datetime of last login
	LastLoginAgo   string  `json:"last_login_ago,omitempty"`  // Human-readable "2 months ago"
	DeactivatedAt  *string `json:"deactivated_at,omitempty"`  // When auto-deactivated by system
	DeletedAt      *string `json:"deleted_at,omitempty"`      // When soft-deleted (4-year rule)
	ActivityStatus string  `json:"activity_status,omitempty"` // active | archived | deactivated | deleted
}

// LoginLog represents a user login/logout session
type LoginLog struct {
	ID           int     `json:"id"`
	UserID       int     `json:"user_id"`
	UserName     string  `json:"user_name"`
	UserIDNumber string  `json:"user_id_number"`
	UserType     string  `json:"user_type"`
	PCNumber     *string `json:"pc_number,omitempty"`
	LoginTime    string  `json:"login_time"`
	LogoutTime   *string `json:"logout_time,omitempty"`
}

// Feedback represents equipment condition feedback from students
type Feedback struct {
	ID                  int     `json:"id"`
	StudentUserID       int     `json:"student_user_id"`
	StudentIDStr        string  `json:"student_id_str"`
	FirstName           string  `json:"first_name"`
	MiddleName          *string `json:"middle_name,omitempty"`
	LastName            string  `json:"last_name"`
	StudentName         string  `json:"student_name"`
	PCNumber            string  `json:"pc_number"`
	EquipmentCondition  string  `json:"equipment_condition"`
	MonitorCondition    string  `json:"monitor_condition"`
	KeyboardCondition   string  `json:"keyboard_condition"`
	MouseCondition      string  `json:"mouse_condition"`
	Comments            *string `json:"comments,omitempty"`
	DateSubmitted       string  `json:"date_submitted"`
	Status              string  `json:"status"`
	Priority            string  `json:"priority"` // Issue priority (low/medium/high/critical)
	VerifiedByUserID    *int    `json:"verified_by_user_id,omitempty"`
	VerifiedAt          *string `json:"verified_at,omitempty"`
	ForwardedByUserID   *int    `json:"forwarded_by_user_id,omitempty"`
	ForwardedByName     *string `json:"forwarded_by_name,omitempty"`
	ForwardedAt         *string `json:"forwarded_at,omitempty"`
	WorkingStudentNotes *string `json:"working_student_notes,omitempty"`
}

// ClasslistEntry represents a student enrolled in a class
type ClasslistEntry struct {
	ClassID        int     `json:"class_id"`
	StudentUserID  int     `json:"student_user_id"`
	StudentCode    string  `json:"student_code"`
	FirstName      string  `json:"first_name"`
	MiddleName     *string `json:"middle_name,omitempty"`
	LastName       string  `json:"last_name"`
	EnrollmentDate string  `json:"enrollment_date"`
	Status         string  `json:"status"`
	Email          *string `json:"email,omitempty"`
	ContactNumber  *string `json:"contact_number,omitempty"`
	Course         *string `json:"course,omitempty"`
}

// ClassStudent represents a student available for enrollment
type ClassStudent struct {
	ID            int     `json:"id"`
	StudentID     string  `json:"student_id"`
	FirstName     string  `json:"first_name"`
	MiddleName    *string `json:"middle_name,omitempty"`
	LastName      string  `json:"last_name"`
	Gender        *string `json:"gender,omitempty"`
	Email         *string `json:"email,omitempty"`
	ContactNumber *string `json:"contact_number,omitempty"`
	PhotoURL      *string `json:"photo_url,omitempty"` // Base64 data URL for frontend display
	ClassID       *int    `json:"class_id,omitempty"`
	IsEnrolled    bool    `json:"is_enrolled"`
}

// ==============================================================================
// ADMIN DASHBOARD
// ==============================================================================

// AdminDashboard represents admin dashboard data
type AdminDashboard struct {
	TotalStudents           int `json:"total_students"`
	TotalTeachers           int `json:"total_teachers"`
	WorkingStudents         int `json:"working_students"`
	RecentLogins            int `json:"recent_logins"`
	ActiveUsersNow          int `json:"active_users_now"`
	StudentsLoggedIn        int `json:"students_logged_in"`
	TeachersLoggedIn        int `json:"teachers_logged_in"`
	WorkingStudentsLoggedIn int `json:"working_students_logged_in"`
	TodayLogins             int `json:"today_logins"`
	TodayNewUsers           int `json:"today_new_users"`
	PendingFeedback         int `json:"pending_feedback"`
}

// GetAdminDashboard returns admin dashboard statistics
func (a *App) GetAdminDashboard() (AdminDashboard, error) {
	var dashboard AdminDashboard

	if err := a.checkDB(); err != nil {
		return dashboard, err
	}

	if err := a.closeStaleSessions(); err != nil {
		log.Printf("Failed to close stale sessions in admin dashboard: %v", err)
	}

	// Count students
	a.db.QueryRow(`SELECT COUNT(*) FROM students`).Scan(&dashboard.TotalStudents)

	// Count teachers
	a.db.QueryRow(`SELECT COUNT(*) FROM teachers`).Scan(&dashboard.TotalTeachers)

	// Count working students
	a.db.QueryRow(`SELECT COUNT(*) FROM users WHERE user_type = 'working_student'`).Scan(&dashboard.WorkingStudents)

	// Count recent logins (last 24 hours)
	a.db.QueryRow(`SELECT COUNT(*) FROM log_entries WHERE login_time >= DATEADD(HOUR, -24, GETDATE())`).Scan(&dashboard.RecentLogins)

	// Count active users now (logged in today without logout, distinct per user)
	a.db.QueryRow(`
		SELECT COUNT(DISTINCT ll.user_id)
		FROM log_entries ll
		WHERE ll.logout_time IS NULL
			AND CAST(ll.login_time AS DATE) = CAST(GETDATE() AS DATE)
			AND EXISTS (
				SELECT 1 FROM user_session_heartbeats sh
				WHERE sh.user_id = ll.user_id
				AND sh.last_seen >= DATEADD(SECOND, -?, GETDATE())
			)
	`, sessionHeartbeatTimeoutSeconds).Scan(&dashboard.ActiveUsersNow)

	// Count students currently logged in (JOIN with users to get role)
	a.db.QueryRow(`
		SELECT COUNT(DISTINCT ll.user_id) FROM log_entries ll
		INNER JOIN users u ON ll.user_id = u.id
		WHERE ll.logout_time IS NULL AND CAST(ll.login_time AS DATE) = CAST(GETDATE() AS DATE) AND u.user_type = 'student'
			AND EXISTS (
				SELECT 1 FROM user_session_heartbeats sh
				WHERE sh.user_id = ll.user_id
				AND sh.last_seen >= DATEADD(SECOND, -?, GETDATE())
			)
	`, sessionHeartbeatTimeoutSeconds).Scan(&dashboard.StudentsLoggedIn)

	// Count teachers currently logged in
	a.db.QueryRow(`
		SELECT COUNT(DISTINCT ll.user_id) FROM log_entries ll
		INNER JOIN users u ON ll.user_id = u.id
		WHERE ll.logout_time IS NULL AND CAST(ll.login_time AS DATE) = CAST(GETDATE() AS DATE) AND u.user_type = 'teacher'
			AND EXISTS (
				SELECT 1 FROM user_session_heartbeats sh
				WHERE sh.user_id = ll.user_id
				AND sh.last_seen >= DATEADD(SECOND, -?, GETDATE())
			)
	`, sessionHeartbeatTimeoutSeconds).Scan(&dashboard.TeachersLoggedIn)

	// Count working students currently logged in
	a.db.QueryRow(`
		SELECT COUNT(DISTINCT ll.user_id) FROM log_entries ll
		INNER JOIN users u ON ll.user_id = u.id
		WHERE ll.logout_time IS NULL AND CAST(ll.login_time AS DATE) = CAST(GETDATE() AS DATE) AND u.user_type = 'working_student'
			AND EXISTS (
				SELECT 1 FROM user_session_heartbeats sh
				WHERE sh.user_id = ll.user_id
				AND sh.last_seen >= DATEADD(SECOND, -?, GETDATE())
			)
	`, sessionHeartbeatTimeoutSeconds).Scan(&dashboard.WorkingStudentsLoggedIn)

	// Count today's logins
	a.db.QueryRow(`
		SELECT COUNT(*) FROM log_entries 
		WHERE CAST(login_time AS DATE) = CAST(GETDATE() AS DATE)
	`).Scan(&dashboard.TodayLogins)

	// Count users created today
	a.db.QueryRow(`
		SELECT COUNT(*) FROM users 
		WHERE CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)
	`).Scan(&dashboard.TodayNewUsers)

	// Count pending feedback (forwarded to admin but not archived)
	a.db.QueryRow(`
		SELECT COUNT(*) FROM feedback 
		WHERE status = 'forwarded' AND (is_archived = 0 OR is_archived IS NULL)
	`).Scan(&dashboard.PendingFeedback)

	return dashboard, nil
}

// Subject represents a course/subject
type Subject struct {
	Code          string  `json:"code"`
	Name          string  `json:"name"`
	TeacherUserID int     `json:"teacher_user_id"`
	TeacherName   *string `json:"teacher_name,omitempty"`
	Description   *string `json:"description,omitempty"`
	CreatedAt     string  `json:"created_at"`
}

// CourseClass represents a class/section
type CourseClass struct {
	ID                   int     `json:"id"`
	ClassID              int     `json:"class_id"`
	SubjectCode          string  `json:"subject_code"`
	SubjectName          string  `json:"subject_name"`
	DescriptiveTitle     *string `json:"descriptive_title,omitempty"`
	EdpCode              *string `json:"edp_code,omitempty"`
	Section              *string `json:"section,omitempty"`
	Schedule             *string `json:"schedule,omitempty"`
	Room                 *string `json:"room,omitempty"`
	SchoolYear           *string `json:"school_year,omitempty"`
	Semester             *string `json:"semester,omitempty"`
	TeacherUserID        int     `json:"teacher_user_id"`
	TeacherName          *string `json:"teacher_name,omitempty"`
	StudentCount         int     `json:"student_count"`
	EnrolledCount        int     `json:"enrolled_count"`
	IsActive             bool    `json:"is_active"`
	IsArchived           bool    `json:"is_archived"`
	CreatedByUserID      *int    `json:"created_by_user_id,omitempty"`
	CreatedAt            string  `json:"created_at"`
	LatestAttendanceDate *string `json:"latest_attendance_date,omitempty"`
	ClassStatus          string  `json:"class_status"`
}

// Attendance represents an attendance record
type Attendance struct {
	ID             int     `json:"id"`
	ClassID        int     `json:"class_id"`
	SubjectCode    string  `json:"subject_code"`
	SubjectName    string  `json:"subject_name"`
	Section        string  `json:"section"`
	Schedule       string  `json:"schedule"`
	StudentUserID  int     `json:"student_user_id"`
	StudentID      string  `json:"student_id"`
	StudentCode    string  `json:"student_code"`
	StudentName    string  `json:"student_name"`
	FirstName      string  `json:"first_name"`
	MiddleName     *string `json:"middle_name,omitempty"`
	LastName       string  `json:"last_name"`
	Date           string  `json:"date"`
	AttendanceDate string  `json:"attendance_date"`
	TimeIn         *string `json:"time_in,omitempty"`
	Status         string  `json:"status"`
	Remarks        *string `json:"remarks"`
	RecordedBy     int     `json:"recorded_by"`
	RecordedByName string  `json:"recorded_by_name"`
	IsArchived     bool    `json:"is_archived"`
	IsEditable     bool    `json:"is_editable"`
}

// ==============================================================================
// STUDENT DASHBOARD
// ==============================================================================

// StudentDashboard represents student dashboard data
type StudentDashboard struct {
	Attendance        []Attendance `json:"attendance"`
	TodayLog          *Attendance  `json:"today_log"`
	AttendanceRate    float64      `json:"attendance_rate"`
	CurrentlyLoggedIn bool         `json:"currently_logged_in"`
	CurrentPCNumber   *string      `json:"current_pc_number"`
	EnrolledClasses   int          `json:"enrolled_classes"`
	ArchivedClasses   int          `json:"archived_classes"`
}

// GetStudentDashboard returns student dashboard data
func (a *App) GetStudentDashboard(userID int) (StudentDashboard, error) {
	var dashboard StudentDashboard

	if err := a.checkDB(); err != nil {
		return dashboard, err
	}

	if err := a.closeStaleSessions(); err != nil {
		log.Printf("Failed to close stale sessions in student dashboard: %v", err)
	}
	if err := a.ensureAttendanceSessionsTable(); err != nil {
		log.Printf("Failed to ensure attendance sessions table in student dashboard: %v", err)
	} else if err := a.closeExpiredAttendanceSessions(); err != nil {
		log.Printf("Failed to close expired attendance sessions in student dashboard: %v", err)
	}

	// Get all attendance records for this student
	query := `
		SELECT 
			a.class_id, a.student_id, CONVERT(VARCHAR(10), a.attendance_date, 23) as date,
			stu.student_id,
			stu.first_name, stu.middle_name, stu.last_name,
			c.subject_code, s.description as subject_name,
			CONVERT(VARCHAR(8), a.time_in_at, 108) as time_in,
			a.status, a.remarks
		FROM attendance a
		JOIN students stu ON a.student_id = stu.id
		JOIN classes c ON a.class_id = c.class_id
		JOIN subjects s ON c.subject_code = s.subject_code
		WHERE a.student_id = ?
		ORDER BY a.attendance_date DESC
	`

	rows, err := a.db.Query(query, userID)
	if err != nil {
		return dashboard, err
	}
	defer rows.Close()

	var attendance []Attendance
	presentCount := 0
	for rows.Next() {
		var att Attendance
		var middleName, remarks, status, timeIn sql.NullString
		err := rows.Scan(
			&att.ClassID, &att.StudentID, &att.Date,
			&att.StudentCode, &att.FirstName, &middleName, &att.LastName,
			&att.SubjectCode, &att.SubjectName,
			&timeIn, &status, &remarks,
		)
		if err != nil {
			log.Printf("Failed to scan attendance: %v", err)
			continue
		}
		if middleName.Valid {
			att.MiddleName = &middleName.String
		}
		if status.Valid {
			att.Status = strings.TrimSpace(status.String)
		}
		if timeIn.Valid {
			value := strings.TrimSpace(timeIn.String)
			if value != "" {
				att.TimeIn = &value
			}
		}
		if remarks.Valid {
			att.Remarks = &remarks.String
		}
		attendance = append(attendance, att)

		// Count present records (case-insensitive)
		if strings.EqualFold(strings.TrimSpace(att.Status), "present") {
			presentCount++
		}

		// Check if this is today's record
		if att.Date == time.Now().Format("2006-01-02") && dashboard.TodayLog == nil {
			dashboard.TodayLog = &att
		}
	}

	dashboard.Attendance = attendance

	// Calculate attendance rate
	totalRecords := len(attendance)
	if totalRecords > 0 {
		dashboard.AttendanceRate = (float64(presentCount) / float64(totalRecords)) * 100
	}

	// Check if currently logged in
	var loggedIn int
	var pcNumber sql.NullString
	err = a.db.QueryRow(`
		SELECT COUNT(*), pc_number 
		FROM log_entries 
		WHERE user_id = ? AND logout_time IS NULL
			AND EXISTS (
				SELECT 1 FROM user_session_heartbeats sh
				WHERE sh.user_id = log_entries.user_id
				AND sh.last_seen >= DATEADD(SECOND, -?, GETDATE())
			)
		GROUP BY pc_number
	`, userID, sessionHeartbeatTimeoutSeconds).Scan(&loggedIn, &pcNumber)
	if err == nil && loggedIn > 0 {
		dashboard.CurrentlyLoggedIn = true
		if pcNumber.Valid {
			dashboard.CurrentPCNumber = &pcNumber.String
		}
	}

	// Count enrolled classes
	a.db.QueryRow(`
		SELECT COUNT(DISTINCT class_id) 
		FROM classlist 
		WHERE student_id = ? AND status = 'active'
	`, userID).Scan(&dashboard.EnrolledClasses)

	// Count archived classes (teacher-archived via classes.is_archived OR student self-archived via student_archived_classes)
	a.db.QueryRow(`
		SELECT COUNT(DISTINCT cl.class_id)
		FROM classlist cl
		JOIN classes c ON cl.class_id = c.class_id
		LEFT JOIN student_archived_classes sac ON sac.student_id = cl.student_id AND sac.class_id = cl.class_id
		WHERE cl.student_id = ?
		  AND cl.status = 'active'
		  AND (
			COALESCE(c.is_archived, 0) = 1
			OR sac.class_id IS NOT NULL
		  )
	`, userID).Scan(&dashboard.ArchivedClasses)

	return dashboard, nil
}

// ==============================================================================
// WORKING STUDENT DASHBOARD
// ==============================================================================

// WorkingStudentDashboard represents working student dashboard data
type WorkingStudentDashboard struct {
	StudentsRegistered   int `json:"students_registered"`
	ClasslistsCreated    int `json:"classlists_created"`
	PendingFeedback      int `json:"pending_feedback"`
	TodayRegistrations   int `json:"today_registrations"`
	ActiveStudentsNow    int `json:"active_students_now"`
	PendingRegistrations int `json:"pending_registrations"`
}

// GetWorkingStudentDashboard returns working student dashboard data
func (a *App) GetWorkingStudentDashboard() (WorkingStudentDashboard, error) {
	var dashboard WorkingStudentDashboard

	if err := a.checkDB(); err != nil {
		return dashboard, err
	}

	if err := a.closeStaleSessions(); err != nil {
		log.Printf("Failed to close stale sessions in working student dashboard: %v", err)
	}

	// Count students
	a.db.QueryRow(`SELECT COUNT(*) FROM students`).Scan(&dashboard.StudentsRegistered)

	// Count classlists
	a.db.QueryRow(`SELECT COUNT(*) FROM classlist`).Scan(&dashboard.ClasslistsCreated)

	// Count pending feedback
	a.db.QueryRow(`
		SELECT COUNT(*) FROM feedback 
		WHERE status = 'pending'
	`).Scan(&dashboard.PendingFeedback)

	// Count students registered today
	a.db.QueryRow(`
		SELECT COUNT(*) FROM users u
		JOIN students s ON u.id = s.id
		WHERE CAST(u.created_at AS DATE) = CAST(GETDATE() AS DATE)
	`).Scan(&dashboard.TodayRegistrations)

	// Count students currently logged in
	a.db.QueryRow(`
		SELECT COUNT(DISTINCT ll.user_id)
		FROM log_entries ll
		INNER JOIN users u ON ll.user_id = u.id
		WHERE ll.logout_time IS NULL
			AND u.user_type = 'student'
			AND EXISTS (
				SELECT 1 FROM user_session_heartbeats sh
				WHERE sh.user_id = ll.user_id
				AND sh.last_seen >= DATEADD(SECOND, -?, GETDATE())
			)
	`, sessionHeartbeatTimeoutSeconds).Scan(&dashboard.ActiveStudentsNow)

	// Count pending registrations
	a.db.QueryRow(`SELECT COUNT(*) FROM users WHERE account_status = 'pending'`).Scan(&dashboard.PendingRegistrations)

	return dashboard, nil
}

// ==============================================================================
// USER PROFILE MANAGEMENT
// ==============================================================================

// UpdateUserPhoto updates a user's profile photo
// Accepts a base64 data URL (e.g. "data:image/jpeg;base64,...") and stores it directly in the database.
func (a *App) UpdateUserPhoto(userID int, userRole, photoURL string) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	// If raw base64 without data URL prefix, wrap it
	if !strings.HasPrefix(photoURL, "data:") {
		photoURL = "data:image/jpeg;base64," + photoURL
	}

	err := a.SaveProfilePhoto(userID, photoURL)
	if err != nil {
		return fmt.Errorf("failed to update profile photo: %w", err)
	}

	log.Printf("Profile photo updated for user ID %d (%s)", userID, userRole)
	return nil
}
