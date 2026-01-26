package main

import (
	"context"
	"database/sql"
	"encoding/base64"
	"fmt"
	"log"
	"strings"
	"time"
)

// ==============================================================================
// APP STRUCTURE
// ==============================================================================

// App struct
type App struct {
	ctx context.Context
	db  *sql.DB
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Initialize database connection
	db, err := InitDatabase()
	if err != nil {
		log.Printf("Database connection failed: %v", err)
		log.Println("App will start but database features will be unavailable")
	} else {
		a.db = db
		log.Println("Database ready")
	}
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
	Gender         *string `json:"gender"`
	Role           string  `json:"role"`
	EmployeeID     *string `json:"employee_id"`
	StudentID      *string `json:"student_id"`
	Year           *string `json:"year"`
	Section        *string `json:"section"`
	Email          *string `json:"email"`
	ContactNumber  *string `json:"contact_number"`
	PhotoURL       *string `json:"photo_url"`
	DepartmentCode *string `json:"department_code"`
	Created        string  `json:"created"`
	LoginLogID     int     `json:"login_log_id"` // Track the login session
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
	ProfilePhoto  *string `json:"profile_photo,omitempty"`
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
	LockedAccounts          int `json:"locked_accounts"`
	PendingFeedback         int `json:"pending_feedback"`
}

// GetAdminDashboard returns admin dashboard statistics
func (a *App) GetAdminDashboard() (AdminDashboard, error) {
	var dashboard AdminDashboard

	if a.db == nil {
		return dashboard, fmt.Errorf("database not connected")
	}

	// Count students
	a.db.QueryRow(`SELECT COUNT(*) FROM students`).Scan(&dashboard.TotalStudents)

	// Count teachers
	a.db.QueryRow(`SELECT COUNT(*) FROM teachers`).Scan(&dashboard.TotalTeachers)

	// Count working students
	a.db.QueryRow(`SELECT COUNT(*) FROM users WHERE user_type = 'working_student'`).Scan(&dashboard.WorkingStudents)

	// Count recent logins (last 24 hours)
	a.db.QueryRow(`SELECT COUNT(*) FROM login_logs WHERE login_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`).Scan(&dashboard.RecentLogins)

	// Count active users now (logged in without logout)
	a.db.QueryRow(`SELECT COUNT(*) FROM login_logs WHERE logout_time IS NULL`).Scan(&dashboard.ActiveUsersNow)

	// Count students currently logged in
	a.db.QueryRow(`
		SELECT COUNT(*) FROM login_logs 
		WHERE logout_time IS NULL AND user_type = 'student'
	`).Scan(&dashboard.StudentsLoggedIn)

	// Count teachers currently logged in
	a.db.QueryRow(`
		SELECT COUNT(*) FROM login_logs 
		WHERE logout_time IS NULL AND user_type = 'teacher'
	`).Scan(&dashboard.TeachersLoggedIn)

	// Count working students currently logged in
	a.db.QueryRow(`
		SELECT COUNT(*) FROM login_logs 
		WHERE logout_time IS NULL AND user_type = 'working_student'
	`).Scan(&dashboard.WorkingStudentsLoggedIn)

	// Count today's logins
	a.db.QueryRow(`
		SELECT COUNT(*) FROM login_logs 
		WHERE DATE(login_time) = CURDATE()
	`).Scan(&dashboard.TodayLogins)

	// Count users created today
	a.db.QueryRow(`
		SELECT COUNT(*) FROM users 
		WHERE DATE(created_at) = CURDATE()
	`).Scan(&dashboard.TodayNewUsers)

	// Count locked accounts
	a.db.QueryRow(`
		SELECT COUNT(*) FROM users 
		WHERE account_lock = TRUE
	`).Scan(&dashboard.LockedAccounts)

	// Count pending feedback
	a.db.QueryRow(`
		SELECT COUNT(*) FROM feedback 
		WHERE status = 'pending'
	`).Scan(&dashboard.PendingFeedback)

	return dashboard, nil
}

// ==============================================================================
// TEACHER DASHBOARD
// ==============================================================================

// TeacherDashboard represents teacher dashboard data
type TeacherDashboard struct {
	Classes              []CourseClass `json:"classes"`
	Attendance           []Attendance  `json:"attendance"`
	TotalAttendanceWeek  int           `json:"total_attendance_week"`
	TotalAttendanceMonth int           `json:"total_attendance_month"`
	TodayClasses         []CourseClass `json:"today_classes"`
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
	YearLevel            *string `json:"year_level,omitempty"`
	SchoolYear           *string `json:"school_year,omitempty"`
	Semester             *string `json:"semester,omitempty"`
	TeacherUserID        int     `json:"teacher_user_id"`
	TeacherName          *string `json:"teacher_name,omitempty"`
	StudentCount         int     `json:"student_count"`
	EnrolledCount        int     `json:"enrolled_count"`
	IsActive             bool    `json:"is_active"`
	CreatedByUserID      *int    `json:"created_by_user_id,omitempty"`
	CreatedAt            string  `json:"created_at"`
	LatestAttendanceDate *string `json:"latest_attendance_date,omitempty"`
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
	TimeIn         *string `json:"time_in"`
	TimeOut        *string `json:"time_out"`
	PCNumber       *string `json:"pc_number"`
	Status         string  `json:"status"`
	Remarks        *string `json:"remarks"`
	RecordedBy     int     `json:"recorded_by"`
	RecordedByName string  `json:"recorded_by_name"`
}

// GetTeacherDashboard returns teacher dashboard data
func (a *App) GetTeacherDashboard(teacherUserID int) (TeacherDashboard, error) {
	var dashboard TeacherDashboard

	if a.db == nil {
		return dashboard, fmt.Errorf("database not connected")
	}

	// Get classes for this teacher
	classes, err := a.GetTeacherClasses(teacherUserID)
	if err != nil {
		return dashboard, err
	}
	dashboard.Classes = classes

	// Get attendance for these classes (recent records)
	if len(classes) > 0 {
		// Get attendance from the last 7 days for all classes
		classIDs := make([]int, len(classes))
		for i, class := range classes {
			classIDs[i] = class.ID
		}

		attendance, err := a.GetRecentAttendance(classIDs, 7)
		if err != nil {
			log.Printf("Failed to get recent attendance: %v", err)
		} else {
			dashboard.Attendance = attendance
		}

		// Count attendance records this week
		a.db.QueryRow(`
			SELECT COUNT(*) FROM attendance 
			WHERE class_id IN (`+strings.Repeat("?,", len(classIDs)-1)+`?) 
			AND attendance_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
		`, convertToInterfaceSlice(classIDs)...).Scan(&dashboard.TotalAttendanceWeek)

		// Count attendance records this month
		a.db.QueryRow(`
			SELECT COUNT(*) FROM attendance 
			WHERE class_id IN (`+strings.Repeat("?,", len(classIDs)-1)+`?) 
			AND attendance_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
		`, convertToInterfaceSlice(classIDs)...).Scan(&dashboard.TotalAttendanceMonth)
	}

	// Filter today's classes (simplified - returns all active classes)
	dashboard.TodayClasses = classes

	return dashboard, nil
}

// Helper function to convert int slice to interface slice for variadic SQL args
func convertToInterfaceSlice(nums []int) []interface{} {
	result := make([]interface{}, len(nums))
	for i, v := range nums {
		result[i] = v
	}
	return result
}

// GetRecentAttendance gets attendance records for given class IDs within the last N days
func (a *App) GetRecentAttendance(classIDs []int, days int) ([]Attendance, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	if len(classIDs) == 0 {
		return []Attendance{}, nil
	}

	// Build query with placeholders for class IDs
	placeholders := make([]string, len(classIDs))
	args := make([]interface{}, len(classIDs)+1)
	for i, id := range classIDs {
		placeholders[i] = "?"
		args[i] = id
	}
	args[len(classIDs)] = days

	query := fmt.Sprintf(`
		SELECT 
			a.id, a.class_id, c.subject_code, s.name, c.section, c.schedule,
			a.student_user_id, st.student_id, 
			CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.middle_name, ''), ' ', COALESCE(u.last_name, '')) as student_name,
			a.attendance_date, a.time_in, a.time_out, a.pc_number, a.status, a.remarks,
			a.recorded_by,
			CONCAT(COALESCE(rec.first_name, ''), ' ', COALESCE(rec.middle_name, ''), ' ', COALESCE(rec.last_name, '')) as recorded_by_name
		FROM attendance a
		JOIN classlist c ON a.class_id = c.id
		JOIN subjects s ON c.subject_code = s.code
		JOIN students st ON a.student_user_id = st.user_id
		JOIN users u ON st.user_id = u.id
		LEFT JOIN users rec ON a.recorded_by = rec.id
		WHERE a.class_id IN (%s)
		AND a.attendance_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
		ORDER BY a.attendance_date DESC, a.time_in DESC
	`, strings.Join(placeholders, ","))

	rows, err := a.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attendance []Attendance
	for rows.Next() {
		var att Attendance
		err := rows.Scan(
			&att.ID, &att.ClassID, &att.SubjectCode, &att.SubjectName, &att.Section, &att.Schedule,
			&att.StudentUserID, &att.StudentID, &att.StudentName,
			&att.AttendanceDate, &att.TimeIn, &att.TimeOut, &att.PCNumber, &att.Status, &att.Remarks,
			&att.RecordedBy, &att.RecordedByName,
		)
		if err != nil {
			log.Printf("Failed to scan attendance: %v", err)
			continue
		}
		attendance = append(attendance, att)
	}

	return attendance, nil
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
}

// GetStudentDashboard returns student dashboard data
func (a *App) GetStudentDashboard(userID int) (StudentDashboard, error) {
	var dashboard StudentDashboard

	if a.db == nil {
		return dashboard, fmt.Errorf("database not connected")
	}

	// Get all attendance records for this student
	query := `
		SELECT 
			a.class_id, a.student_user_id, DATE_FORMAT(a.date, '%Y-%m-%d') as date,
			stu.student_number,
			stu.first_name, stu.middle_name, stu.last_name,
			c.subject_code, s.description as subject_name,
			a.time_in, a.time_out, a.pc_number, a.status, a.remarks
		FROM attendance a
		JOIN students stu ON a.student_user_id = stu.user_id
		JOIN classes c ON a.class_id = c.class_id
		JOIN subjects s ON c.subject_code = s.subject_code
		WHERE a.student_user_id = ?
		ORDER BY a.date DESC, a.time_in DESC
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
		var middleName, timeIn, timeOut, pcNumber, remarks sql.NullString
		err := rows.Scan(
			&att.ClassID, &att.StudentUserID, &att.Date,
			&att.StudentCode, &att.FirstName, &middleName, &att.LastName,
			&att.SubjectCode, &att.SubjectName,
			&timeIn, &timeOut, &pcNumber, &att.Status, &remarks,
		)
		if err != nil {
			log.Printf("Failed to scan attendance: %v", err)
			continue
		}
		if middleName.Valid {
			att.MiddleName = &middleName.String
		}
		if timeIn.Valid {
			att.TimeIn = &timeIn.String
		}
		if timeOut.Valid {
			att.TimeOut = &timeOut.String
		}
		if pcNumber.Valid {
			att.PCNumber = &pcNumber.String
		}
		if remarks.Valid {
			att.Remarks = &remarks.String
		}
		attendance = append(attendance, att)

		// Count present records
		if att.Status == "Present" {
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
		FROM login_logs 
		WHERE user_id = ? AND logout_time IS NULL
		GROUP BY pc_number
	`, userID).Scan(&loggedIn, &pcNumber)
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
		WHERE student_user_id = ? AND status = 'active'
	`, userID).Scan(&dashboard.EnrolledClasses)

	return dashboard, nil
}

// ==============================================================================
// WORKING STUDENT DASHBOARD
// ==============================================================================

// WorkingStudentDashboard represents working student dashboard data
type WorkingStudentDashboard struct {
	StudentsRegistered int `json:"students_registered"`
	ClasslistsCreated  int `json:"classlists_created"`
	PendingFeedback    int `json:"pending_feedback"`
	TodayRegistrations int `json:"today_registrations"`
	ActiveStudentsNow  int `json:"active_students_now"`
}

// GetWorkingStudentDashboard returns working student dashboard data
func (a *App) GetWorkingStudentDashboard() (WorkingStudentDashboard, error) {
	var dashboard WorkingStudentDashboard

	if a.db == nil {
		return dashboard, fmt.Errorf("database not connected")
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
		JOIN students s ON u.id = s.user_id
		WHERE DATE(u.created_at) = CURDATE()
	`).Scan(&dashboard.TodayRegistrations)

	// Count students currently logged in
	a.db.QueryRow(`
		SELECT COUNT(*) FROM login_logs 
		WHERE logout_time IS NULL AND user_type = 'student'
	`).Scan(&dashboard.ActiveStudentsNow)

	return dashboard, nil
}

// ==============================================================================
// USER PROFILE MANAGEMENT
// ==============================================================================

// UpdateUserPhoto updates a user's profile photo
// Note: This method accepts data URL format and stores it as Base64
// Use UpdateUserProfilePhoto (in users.go) for proper BLOB storage
func (a *App) UpdateUserPhoto(userID int, userRole, photoURL string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Extract base64 data from data URL and decode to binary
	// The photoURL is expected to be in format: "data:image/jpeg;base64,/9j/4AAQ..."
	base64Data := photoURL
	if strings.HasPrefix(photoURL, "data:") {
		parts := strings.Split(photoURL, ",")
		if len(parts) == 2 {
			base64Data = parts[1]
		}
	}

	// Decode Base64 to binary for storage
	imageBytes, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return fmt.Errorf("failed to decode base64 image: %w", err)
	}

	// Update photo in respective table based on role
	var query string
	switch userRole {
	case "admin":
		query = `UPDATE admins SET profile_photo = ? WHERE user_id = ?`
	case "teacher":
		query = `UPDATE teachers SET profile_photo = ? WHERE user_id = ?`
	case "student":
		query = `UPDATE students SET profile_photo = ? WHERE user_id = ?`
	case "working_student":
		// Working students might be stored in a different table
		// For now, assuming they're in students table
		query = `UPDATE students SET profile_photo = ? WHERE user_id = ?`
	default:
		return fmt.Errorf("invalid user role: %s", userRole)
	}

	// Store as binary BLOB (not as text string)
	_, err = a.db.Exec(query, imageBytes, userID)
	if err != nil {
		return fmt.Errorf("failed to update profile photo: %w", err)
	}

	log.Printf("Profile photo updated for user ID %d (%s) - %d bytes", userID, userRole, len(imageBytes))
	return nil
}

// ==============================================================================
// UTILITY FUNCTIONS
// ==============================================================================

// nullString converts empty string to sql.NullString
func nullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: s, Valid: true}
}
