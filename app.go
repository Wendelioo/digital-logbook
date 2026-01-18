package main

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/csv"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
	docx "github.com/lukasjarosch/go-docx"
)

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
// AUTHENTICATION & USER MANAGEMENT
// ==============================================================================

// User represents a user in the system
type User struct {
	ID            int     `json:"id"`
	Password      string  `json:"password"`
	Name          string  `json:"name"`
	FirstName     *string `json:"first_name"`
	MiddleName    *string `json:"middle_name"`
	LastName      *string `json:"last_name"`
	Gender        *string `json:"gender"`
	Role          string  `json:"role"`
	EmployeeID    *string `json:"employee_id"`
	StudentID     *string `json:"student_id"`
	Year          *string `json:"year"`
	Section       *string `json:"section"`
	Email         *string `json:"email"`
	ContactNumber *string `json:"contact_number"`
	PhotoURL      *string `json:"photo_url"`
	DepartmentCode *string `json:"department_code"`
	Created       string  `json:"created"`
	LoginLogID    int     `json:"login_log_id"` // Track the login session
}

// Logout logs a user out and records logout time
func (a *App) Logout(userID int) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Update the most recent login log for this user to set logout time
	// Use a subquery to ensure we get the most recent login log
	query := `UPDATE login_logs 
			  SET logout_time = NOW()
			  WHERE id = (
				  SELECT id FROM (
					  SELECT id FROM login_logs 
					  WHERE user_id = ? AND logout_time IS NULL 
					  ORDER BY login_time DESC 
					  LIMIT 1
				  ) AS subquery
			  )`
	result, err := a.db.Exec(query, userID)
	if err != nil {
		log.Printf("Failed to log logout for user %d: %v", userID, err)
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		log.Printf("Failed to get rows affected for logout: %v", err)
	} else if rowsAffected == 0 {
		log.Printf("No active login log found to update for user %d", userID)
		// Don't return error - might be already logged out
	} else {
		log.Printf("User logout successful: user_id=%d (rows affected: %d)", userID, rowsAffected)
	}

	return nil
}

// RecordTimeoutLogout records logout time for timed-out sessions
// This can be called automatically or manually to handle session timeouts
func (a *App) RecordTimeoutLogout(userID int) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Same logic as Logout - update the most recent login log
	return a.Logout(userID)
}

// Login authenticates a user
func (a *App) Login(username, password string) (*User, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	var user User
	query := `SELECT id, username, password, user_type, created_at FROM users WHERE username = ?`

	var createdAt time.Time
	err := a.db.QueryRow(query, username).Scan(&user.ID, &user.Name, &user.Password, &user.Role, &createdAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("invalid credentials")
		}
		return nil, err
	}

	// Simple password check (in production, use proper password hashing)
	if user.Password != password {
		return nil, fmt.Errorf("invalid credentials")
	}

	user.Created = createdAt.Format("2006-01-02 15:04:05")

	// Get additional user details based on role
	var detailQuery string
	switch user.Role {
	case "admin":
		detailQuery = `SELECT first_name, middle_name, last_name, gender, employee_number, email, profile_photo FROM admins WHERE user_id = ?`
	case "teacher":
		detailQuery = `SELECT first_name, middle_name, last_name, employee_number, email, contact_number, profile_photo FROM teachers WHERE user_id = ?`
	case "student":
		detailQuery = `SELECT first_name, middle_name, last_name, student_number, email, contact_number, profile_photo FROM students WHERE user_id = ? AND is_working_student = FALSE`
	case "working_student":
		detailQuery = `SELECT first_name, middle_name, last_name, student_number, email, contact_number, profile_photo FROM students WHERE user_id = ? AND is_working_student = TRUE`
	}

	var firstName, middleName, lastName, gender sql.NullString
	var employeeID, studentID, photoURL sql.NullString
	var email, contactNumber sql.NullString

	switch user.Role {
	case "admin":
		err = a.db.QueryRow(detailQuery, user.ID).Scan(&firstName, &middleName, &lastName, &gender, &employeeID, &email, &photoURL)
		if err == nil {
			if firstName.Valid {
				user.FirstName = &firstName.String
			}
			if middleName.Valid {
				user.MiddleName = &middleName.String
			}
			if lastName.Valid {
				user.LastName = &lastName.String
			}
			if gender.Valid {
				user.Gender = &gender.String
			}
			if employeeID.Valid {
				user.EmployeeID = &employeeID.String
			}
			if email.Valid {
				user.Email = &email.String
			}
			if photoURL.Valid {
				user.PhotoURL = &photoURL.String
			}
		}
	case "teacher":
		err = a.db.QueryRow(detailQuery, user.ID).Scan(&firstName, &middleName, &lastName, &employeeID, &email, &contactNumber, &photoURL)
		if err == nil {
			if firstName.Valid {
				user.FirstName = &firstName.String
			}
			if middleName.Valid {
				user.MiddleName = &middleName.String
			}
			if lastName.Valid {
				user.LastName = &lastName.String
			}
			if employeeID.Valid {
				user.EmployeeID = &employeeID.String
			}
			if email.Valid {
				user.Email = &email.String
			}
			if contactNumber.Valid {
				user.ContactNumber = &contactNumber.String
			}
			if photoURL.Valid {
				user.PhotoURL = &photoURL.String
			}
		}
	case "student":
		err = a.db.QueryRow(detailQuery, user.ID).Scan(&firstName, &middleName, &lastName, &studentID, &email, &contactNumber, &photoURL)
		if err == nil {
			if firstName.Valid {
				user.FirstName = &firstName.String
			}
			if middleName.Valid {
				user.MiddleName = &middleName.String
			}
			if lastName.Valid {
				user.LastName = &lastName.String
			}
			if studentID.Valid {
				user.StudentID = &studentID.String
			}
			if email.Valid {
				user.Email = &email.String
			}
			if contactNumber.Valid {
				user.ContactNumber = &contactNumber.String
			}
			if photoURL.Valid {
				user.PhotoURL = &photoURL.String
			}
		}
	case "working_student":
		err = a.db.QueryRow(detailQuery, user.ID).Scan(&firstName, &middleName, &lastName, &studentID, &email, &contactNumber, &photoURL)
		if err == nil {
			if firstName.Valid {
				user.FirstName = &firstName.String
			}
			if middleName.Valid {
				user.MiddleName = &middleName.String
			}
			if lastName.Valid {
				user.LastName = &lastName.String
			}
			if studentID.Valid {
				user.StudentID = &studentID.String
			}
			if email.Valid {
				user.Email = &email.String
			}
			if contactNumber.Valid {
				user.ContactNumber = &contactNumber.String
			}
			if photoURL.Valid {
				user.PhotoURL = &photoURL.String
			}
		}
	}

	// Get the hostname (PC number) of this device
	hostname, err := os.Hostname()
	if err != nil {
		log.Printf("Failed to get hostname: %v", err)
		hostname = "Unknown"
	}

	// Create a login log entry
	insertLog := `INSERT INTO login_logs (user_id, pc_number, login_time, login_status) 
				  VALUES (?, ?, NOW(), 'success')`
	result, err := a.db.Exec(insertLog, user.ID, hostname)
	if err != nil {
		log.Printf("❌ Failed to create login log for user %d (username: %s): %v", user.ID, username, err)
		// Don't fail the login if logging fails
	} else {
		// Get the log ID for this session
		logID, err := result.LastInsertId()
		if err == nil {
			user.LoginLogID = int(logID)
			log.Printf("✅ Login logged successfully - ID: %d, User: %s (ID: %d), Role: %s, PC: %s", logID, username, user.ID, user.Role, hostname)
		} else {
			log.Printf("⚠️ Login log created but failed to get log ID: %v", err)
		}
	}

	// Auto-record attendance for students if they log in during class time
	if user.Role == "student" || user.Role == "working_student" {
		go a.autoRecordAttendanceOnLogin(user.ID, hostname)
	}

	log.Printf("User login successful: %s (role: %s, pc: %s)", username, user.Role, hostname)
	return &user, nil
}

// autoRecordAttendanceOnLogin automatically records attendance when a student logs in
// if they are enrolled in classes with attendance initialized for today
func (a *App) autoRecordAttendanceOnLogin(studentID int, pcNumber string) {
	if a.db == nil {
		return
	}

	today := time.Now().Format("2006-01-02")
	currentTime := time.Now()

	// Get all enrolled classes for this student with attendance initialized for today
	query := `
		SELECT 
			cl.class_id,
			c.schedule,
			c.school_year,
			c.semester
		FROM classlist cl
		JOIN classes c ON cl.class_id = c.class_id
		LEFT JOIN attendance a ON cl.class_id = a.class_id AND cl.student_user_id = a.student_user_id AND a.date = ?
		WHERE cl.student_user_id = ? 
			AND cl.status = 'active'
			AND c.is_active = TRUE
			AND a.class_id IS NOT NULL
	`

	rows, err := a.db.Query(query, today, studentID)
	if err != nil {
		log.Printf("Failed to query enrolled classes for auto-attendance: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var classID int
		var schedule sql.NullString
		var schoolYear, semester sql.NullString

		err := rows.Scan(&classID, &schedule, &schoolYear, &semester)
		if err != nil {
			continue
		}

		// Check if current time matches class schedule
		if schedule.Valid && a.isWithinClassSchedule(schedule.String, currentTime) {
			// Update attendance to present with login time and PC number using composite key
			updateQuery := `
				UPDATE attendance 
				SET time_in = CURTIME(),
					pc_number = ?,
					status = 'present',
					updated_at = CURRENT_TIMESTAMP
				WHERE class_id = ? AND student_user_id = ? AND date = ?
			`
			_, err := a.db.Exec(updateQuery, pcNumber, classID, studentID, today)
			if err != nil {
				log.Printf("Failed to auto-record attendance for student %d, class %d: %v", studentID, classID, err)
			} else {
				log.Printf("Auto-recorded attendance: student=%d, class=%d, pc=%s", studentID, classID, pcNumber)
			}
		}
	}
}

// isWithinClassSchedule checks if the current time is within the class schedule time window
// Schedule format examples: "MWF 1:00-2:00 PM", "TTh 10:00-11:30 AM", "1:00-2:00 PM"
func (a *App) isWithinClassSchedule(schedule string, checkTime time.Time) bool {
	if schedule == "" {
		return false
	}

	// Check day of week if specified in schedule
	weekday := int(checkTime.Weekday()) // 0=Sunday, 1=Monday, ..., 6=Saturday
	scheduleUpper := strings.ToUpper(strings.TrimSpace(schedule))

	// Check if schedule contains day abbreviations
	hasDaySpec := false
	matchesDay := false

	// Check for common patterns first (longer patterns first to avoid partial matches)
	if strings.Contains(scheduleUpper, "MTWTF") || strings.Contains(scheduleUpper, "MON-TUE-WED-THU-FRI") {
		hasDaySpec = true
		if weekday >= 1 && weekday <= 5 {
			matchesDay = true
		}
	} else if strings.Contains(scheduleUpper, "TTH") || strings.Contains(scheduleUpper, "TTHU") || strings.Contains(scheduleUpper, "TU-TH") {
		hasDaySpec = true
		if weekday == 2 || weekday == 4 {
			matchesDay = true
		}
	} else if strings.Contains(scheduleUpper, "MWF") || strings.Contains(scheduleUpper, "MON-WED-FRI") {
		hasDaySpec = true
		if weekday == 1 || weekday == 3 || weekday == 5 {
			matchesDay = true
		}
	} else {
		// Check individual day abbreviations (check longer ones first)
		dayChecks := []struct {
			pattern string
			days    []int
		}{
			{"THU", []int{4}}, // Thursday
			{"TUE", []int{2}}, // Tuesday
			{"WED", []int{3}}, // Wednesday
			{"FRI", []int{5}}, // Friday
			{"MON", []int{1}}, // Monday
			{"SAT", []int{6}}, // Saturday
			{"SUN", []int{0}}, // Sunday
			{"TH", []int{4}},  // Thursday (abbrev)
			{"SU", []int{0}},  // Sunday (abbrev)
		}

		for _, check := range dayChecks {
			if strings.Contains(scheduleUpper, check.pattern) {
				hasDaySpec = true
				for _, d := range check.days {
					if weekday == d {
						matchesDay = true
						break
					}
				}
				if matchesDay {
					break
				}
			}
		}

		// Check single-letter day codes if no multi-letter match found
		if !hasDaySpec {
			if strings.Contains(scheduleUpper, " M ") || strings.HasPrefix(scheduleUpper, "M ") || scheduleUpper[0] == 'M' {
				hasDaySpec = true
				if weekday == 1 {
					matchesDay = true
				}
			} else if strings.Contains(scheduleUpper, " T ") || strings.HasPrefix(scheduleUpper, "T ") {
				hasDaySpec = true
				if weekday == 2 {
					matchesDay = true
				}
			} else if strings.Contains(scheduleUpper, " W ") || strings.HasPrefix(scheduleUpper, "W ") {
				hasDaySpec = true
				if weekday == 3 {
					matchesDay = true
				}
			} else if strings.Contains(scheduleUpper, " F ") || strings.HasPrefix(scheduleUpper, "F ") {
				hasDaySpec = true
				if weekday == 5 {
					matchesDay = true
				}
			}
		}
	}

	// If day is specified but doesn't match, return false
	if hasDaySpec && !matchesDay {
		return false
	}

	// Extract time range from schedule (e.g., "1:00-2:00 PM" or "10:00-11:30 AM")
	timePattern := regexp.MustCompile(`(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)`)
	matches := timePattern.FindStringSubmatch(schedule)
	if len(matches) != 6 {
		// Try simpler pattern without AM/PM
		timePattern2 := regexp.MustCompile(`(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})`)
		matches = timePattern2.FindStringSubmatch(schedule)
		if len(matches) != 5 {
			return false // Cannot parse schedule
		}
		// Parse 24-hour format
		startHour, _ := strconv.Atoi(matches[1])
		startMin, _ := strconv.Atoi(matches[2])
		endHour, _ := strconv.Atoi(matches[3])
		endMin, _ := strconv.Atoi(matches[4])

		currentHour := checkTime.Hour()
		currentMin := checkTime.Minute()

		currentMinutes := currentHour*60 + currentMin
		startMinutes := startHour*60 + startMin
		endMinutes := endHour*60 + endMin

		// Allow 30 minutes before and after class time
		return currentMinutes >= (startMinutes-30) && currentMinutes <= (endMinutes+30)
	}

	// Parse 12-hour format with AM/PM
	startHour, _ := strconv.Atoi(matches[1])
	startMin, _ := strconv.Atoi(matches[2])
	endHour, _ := strconv.Atoi(matches[3])
	endMin, _ := strconv.Atoi(matches[4])
	period := matches[5]

	// Convert to 24-hour format
	if period == "PM" && startHour != 12 {
		startHour += 12
	}
	if period == "PM" && endHour != 12 {
		endHour += 12
	}
	if period == "AM" && startHour == 12 {
		startHour = 0
	}
	if period == "AM" && endHour == 12 {
		endHour = 0
	}

	currentHour := checkTime.Hour()
	currentMin := checkTime.Minute()

	currentMinutes := currentHour*60 + currentMin
	startMinutes := startHour*60 + startMin
	endMinutes := endHour*60 + endMin

	// Allow 30 minutes before and after class time for flexibility
	return currentMinutes >= (startMinutes-30) && currentMinutes <= (endMinutes+30)
}

// GetUsers returns all users with complete details
func (a *App) GetUsers() ([]User, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			id, username, user_type, created_at,
			first_name, middle_name, last_name,
			employee_number, student_number,
			email, contact_number, department_code
		FROM v_users_complete
		ORDER BY created_at DESC
	`
	rows, err := a.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		var createdAt time.Time
		var firstName, middleName, lastName sql.NullString
		var employeeID, studentID sql.NullString
		var email, contactNumber, departmentCode sql.NullString

		err := rows.Scan(&user.ID, &user.Name, &user.Role, &createdAt,
			&firstName, &middleName, &lastName,
			&employeeID, &studentID,
			&email, &contactNumber, &departmentCode)
		if err != nil {
			continue
		}

		user.Created = createdAt.Format("2006-01-02 15:04:05")

		if firstName.Valid {
			user.FirstName = &firstName.String
		}
		if middleName.Valid {
			user.MiddleName = &middleName.String
		}
		if lastName.Valid {
			user.LastName = &lastName.String
		}
		if employeeID.Valid {
			user.EmployeeID = &employeeID.String
		}
		if studentID.Valid {
			user.StudentID = &studentID.String
		}
		if email.Valid {
			user.Email = &email.String
		}
		if contactNumber.Valid {
			user.ContactNumber = &contactNumber.String
		}
		if departmentCode.Valid {
			user.DepartmentCode = &departmentCode.String
		}

		users = append(users, user)
	}

	return users, nil
}

// GetUsersByType returns users filtered by type with complete details
func (a *App) GetUsersByType(userType string) ([]User, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			id, username, user_type, created_at,
			first_name, middle_name, last_name,
			employee_number, student_number,
			email, contact_number, department_code
		FROM v_users_complete
		WHERE user_type = ?
		ORDER BY created_at DESC
	`
	rows, err := a.db.Query(query, userType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		var createdAt time.Time
		var firstName, middleName, lastName sql.NullString
		var employeeID, studentID sql.NullString
		var email, contactNumber, departmentCode sql.NullString

		err := rows.Scan(&user.ID, &user.Name, &user.Role, &createdAt,
			&firstName, &middleName, &lastName,
			&employeeID, &studentID,
			&email, &contactNumber, &departmentCode)
		if err != nil {
			continue
		}

		user.Created = createdAt.Format("2006-01-02 15:04:05")

		if firstName.Valid {
			user.FirstName = &firstName.String
		}
		if middleName.Valid {
			user.MiddleName = &middleName.String
		}
		if lastName.Valid {
			user.LastName = &lastName.String
		}
		if employeeID.Valid {
			user.EmployeeID = &employeeID.String
		}
		if studentID.Valid {
			user.StudentID = &studentID.String
		}
		if email.Valid {
			user.Email = &email.String
		}
		if contactNumber.Valid {
			user.ContactNumber = &contactNumber.String
		}
		if departmentCode.Valid {
			user.DepartmentCode = &departmentCode.String
		}

		users = append(users, user)
	}

	return users, nil
}

// SearchUsers searches users by name, ID, gender, or date with complete details
func (a *App) SearchUsers(searchTerm, userType string) ([]User, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			id, username, user_type, created_at,
			first_name, middle_name, last_name,
			employee_number, student_number,
			email, contact_number, department_code
		FROM v_users_complete
		WHERE (
			username LIKE ? OR
			first_name LIKE ? OR
			last_name LIKE ? OR
			middle_name LIKE ? OR
			employee_number LIKE ? OR
			student_number LIKE ? OR
			DATE_FORMAT(created_at, '%Y-%m-%d') LIKE ?
		)
	`
	searchPattern := "%" + searchTerm + "%"
	args := []interface{}{searchPattern, searchPattern, searchPattern, searchPattern,
		searchPattern, searchPattern, searchPattern}

	if userType != "" {
		query += ` AND user_type = ?`
		args = append(args, userType)
	}

	query += ` ORDER BY created_at DESC`

	rows, err := a.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		var createdAt time.Time
		var firstName, middleName, lastName sql.NullString
		var employeeID, studentID sql.NullString
		var email, contactNumber, departmentCode sql.NullString

		err := rows.Scan(&user.ID, &user.Name, &user.Role, &createdAt,
			&firstName, &middleName, &lastName,
			&employeeID, &studentID,
			&email, &contactNumber, &departmentCode)
		if err != nil {
			continue
		}

		user.Created = createdAt.Format("2006-01-02 15:04:05")

		if firstName.Valid {
			user.FirstName = &firstName.String
		}
		if middleName.Valid {
			user.MiddleName = &middleName.String
		}
		if lastName.Valid {
			user.LastName = &lastName.String
		}
		if employeeID.Valid {
			user.EmployeeID = &employeeID.String
		}
		if studentID.Valid {
			user.StudentID = &studentID.String
		}
		if email.Valid {
			user.Email = &email.String
		}
		if contactNumber.Valid {
			user.ContactNumber = &contactNumber.String
		}
		if departmentCode.Valid {
			user.DepartmentCode = &departmentCode.String
		}

		users = append(users, user)
	}

	return users, nil
}

// CreateUser creates a new user
func (a *App) CreateUser(password, name, firstName, middleName, lastName, gender, role, employeeID, studentID, year, section, email, contactNumber string, departmentCode string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Log the incoming data for debugging
	log.Printf("CreateUser called - Role: %s, StudentID: %s, Year: %s, Section: %s, Gender: %s, Email: %s", role, studentID, year, section, gender, email)

	// Determine username based on role
	username := employeeID
	if role == "student" || role == "working_student" {
		username = studentID
		if username == "" {
			return fmt.Errorf("student ID is required for %s role", role)
		}
	}

	// Validate required fields for working_student
	if role == "working_student" {
		if studentID == "" {
			return fmt.Errorf("student ID is required for working student")
		}
		if firstName == "" || lastName == "" {
			return fmt.Errorf("first name and last name are required")
		}
	}

	// Check for duplicate registration (username already exists)
	var existingUserID int
	var existingRole string
	checkQuery := `SELECT id, user_type FROM users WHERE username = ?`
	err := a.db.QueryRow(checkQuery, username).Scan(&existingUserID, &existingRole)
	if err == nil {
		// User already exists - return warning message
		if role == "student" || role == "working_student" {
			return fmt.Errorf("⚠️ This Student ID is already registered. If you already have an account, please use the login form instead")
		}
		return fmt.Errorf("⚠️ This %s ID is already registered in the system", role)
	} else if err != sql.ErrNoRows {
		// Database error (not just "no rows")
		log.Printf("Error checking for duplicate user: %v", err)
		return fmt.Errorf("failed to check existing registration: %w", err)
	}

	// Insert into users table
	query := `INSERT INTO users (username, password, user_type) VALUES (?, ?, ?)`
	result, err := a.db.Exec(query, username, password, role)
	if err != nil {
		log.Printf("Failed to insert into users table: %v", err)
		return fmt.Errorf("failed to create user account: %w", err)
	}

	userID, _ := result.LastInsertId()
	log.Printf("Created user account with ID: %d", userID)

	// Insert into respective table based on role
	switch role {
	case "admin":
		query = `INSERT INTO admins (user_id, employee_number, first_name, middle_name, last_name, gender, email) VALUES (?, ?, ?, ?, ?, ?, ?)`
		_, err = a.db.Exec(query, userID, nullString(employeeID), firstName, nullString(middleName), lastName, nullString(gender), nullString(email))
	case "teacher":
		query = `INSERT INTO teachers (user_id, employee_number, first_name, middle_name, last_name, email, contact_number, department_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		_, err = a.db.Exec(query, userID, nullString(employeeID), firstName, nullString(middleName), lastName, nullString(email), nullString(contactNumber), nullString(departmentCode))
	case "student":
		query = `INSERT INTO students (user_id, student_number, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		_, err = a.db.Exec(query, userID, nullString(studentID), firstName, nullString(middleName), lastName, nullString(email), nullString(contactNumber), false)
	case "working_student":
		query = `INSERT INTO students (user_id, student_number, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		log.Printf("📝 Inserting working student - user_id: %d, student_number: %s, name: %s %s, email: %s",
			userID, studentID, firstName, lastName, email)
		_, err = a.db.Exec(query, userID, nullString(studentID), firstName, nullString(middleName), lastName, nullString(email), nullString(contactNumber), true)
	}

	if err != nil {
		log.Printf("Failed to insert into %s table: %v", role, err)
		return fmt.Errorf("failed to create %s profile: %w", role, err)
	}

	log.Printf("Successfully created %s: %s %s (ID: %d)", role, firstName, lastName, userID)
	return nil
}

// BulkStudentData represents a single student entry for bulk registration
type BulkStudentData struct {
	StudentCode   string `json:"student_code"`
	FirstName     string `json:"first_name"`
	MiddleName    string `json:"middle_name"`
	LastName      string `json:"last_name"`
	Gender        string `json:"gender"`
	ContactNumber string `json:"contact_number"`
}

// extractStudentDataFromText extracts student information from text content
// Looks for patterns like: Student Code, Name (First, Middle, Last), Gender, Contact
func extractStudentDataFromText(text string) [][]string {
	var records [][]string

	// Split text into lines
	lines := strings.Split(text, "\n")

	// Pattern to match student data - looking for student codes and names
	// Common patterns:
	// - Student Code: alphanumeric codes
	// - Names: typically in format "Last, First Middle" or "First Middle Last"
	studentCodePattern := regexp.MustCompile(`(?i)(?:student\s*(?:code|id|number)[:\s]*)?([A-Z0-9\-]{3,})`)
	namePattern := regexp.MustCompile(`([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)`)

	var currentRecord []string
	var foundCode bool

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Try to find student code
		codeMatches := studentCodePattern.FindStringSubmatch(line)
		if len(codeMatches) > 1 && !foundCode {
			if len(currentRecord) > 0 {
				// Save previous record if it has data
				if len(currentRecord) >= 2 {
					records = append(records, currentRecord)
				}
			}
			currentRecord = []string{codeMatches[1]}
			foundCode = true
			continue
		}

		// Try to find names
		if foundCode {
			nameMatches := namePattern.FindAllString(line, -1)
			if len(nameMatches) >= 2 {
				// Assume first is first name, last is last name
				currentRecord = append(currentRecord, nameMatches[0])
				if len(nameMatches) >= 3 {
					currentRecord = append(currentRecord, nameMatches[len(nameMatches)-1]) // Last name
					currentRecord = append(currentRecord, nameMatches[1])                  // Middle name if exists
				} else {
					currentRecord = append(currentRecord, nameMatches[len(nameMatches)-1]) // Last name
					currentRecord = append(currentRecord, "")                              // No middle name
				}
				foundCode = false
				if len(currentRecord) >= 3 {
					records = append(records, currentRecord)
					currentRecord = []string{}
				}
			}
		}
	}

	// Add last record if exists
	if len(currentRecord) >= 3 {
		records = append(records, currentRecord)
	}

	// If no structured data found, try CSV-like parsing
	if len(records) == 0 {
		reader := csv.NewReader(strings.NewReader(text))
		csvRecords, err := reader.ReadAll()
		if err == nil && len(csvRecords) > 0 {
			return csvRecords
		}

		// Try tab-separated
		for _, line := range lines {
			if strings.Contains(line, "\t") {
				fields := strings.Split(line, "\t")
				if len(fields) >= 3 {
					records = append(records, fields)
				}
			} else if strings.Contains(line, ",") {
				// Simple comma-separated (not proper CSV)
				fields := strings.Split(line, ",")
				cleanedFields := make([]string, len(fields))
				for i, f := range fields {
					cleanedFields[i] = strings.TrimSpace(f)
				}
				if len(cleanedFields) >= 3 {
					records = append(records, cleanedFields)
				}
			}
		}
	}

	return records
}

// parsePDF extracts text from PDF file
// Note: PDF parsing is currently disabled due to DLL dependency requirements
// Users should convert PDF files to CSV or TXT format for bulk upload
func parsePDF(fileData []byte) (string, error) {
	_ = fileData // Parameter intentionally unused - PDF parsing is disabled
	// PDF parsing requires libmupdf.dll which may not be available
	// For now, return an error suggesting CSV/TXT conversion
	return "", fmt.Errorf("PDF parsing is not available. Please convert your PDF to CSV or TXT format, or use DOCX format")
}

// parseDOCX extracts text from DOCX file
// DOCX files are ZIP archives containing XML files
func parseDOCX(fileData []byte) (string, error) {
	// For now, we'll extract text by parsing the document.xml from the ZIP
	// This is a simplified approach - for production, consider using a more robust library
	// like github.com/unidoc/unioffice or github.com/nguyenthenguyen/docx

	// Try to use the docx library to get runs
	tmpFile, err := os.CreateTemp("", "docx_*.docx")
	if err != nil {
		return "", fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tmpFile.Name())

	// Write file data
	if _, err := tmpFile.Write(fileData); err != nil {
		tmpFile.Close()
		return "", fmt.Errorf("failed to write temp file: %w", err)
	}
	tmpFile.Close()

	// Read DOCX using the library
	doc, err := docx.Open(tmpFile.Name())
	if err != nil {
		return "", fmt.Errorf("failed to open DOCX: %w", err)
	}
	defer doc.Close()

	// Extract text from document runs
	var text strings.Builder

	// Get document.xml content
	docXML := doc.GetFile("word/document.xml")
	if len(docXML) == 0 {
		return "", fmt.Errorf("could not read document.xml from DOCX file")
	}

	// Use RunParser to extract text from the XML
	runParser := docx.NewRunParser(docXML)
	if err := runParser.Execute(); err != nil {
		return "", fmt.Errorf("failed to parse DOCX runs: %w", err)
	}

	runs := runParser.Runs()
	for _, run := range runs {
		if run != nil && run.HasText {
			runText := run.GetText(docXML)
			if runText != "" {
				text.WriteString(runText)
				text.WriteString(" ")
			}
		}
	}

	result := text.String()
	if result == "" {
		return "", fmt.Errorf("could not extract text from DOCX. Please ensure the document contains text, or convert to CSV or PDF format")
	}

	return result, nil
}

// CreateUsersBulkFromFile creates multiple students from uploaded file (PDF, DOCX, CSV, TXT)
// fileData: base64 encoded file content
// fileName: original file name to detect file type
func (a *App) CreateUsersBulkFromFile(fileDataBase64 string, fileName string) (map[string]interface{}, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	// Decode base64 file data
	fileData, err := base64.StdEncoding.DecodeString(fileDataBase64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode file data: %w", err)
	}

	if len(fileData) == 0 {
		return nil, fmt.Errorf("file is empty")
	}

	// Detect file type from extension
	ext := strings.ToLower(filepath.Ext(fileName))
	var textContent string

	switch ext {
	case ".pdf":
		textContent, err = parsePDF(fileData)
		if err != nil {
			return nil, fmt.Errorf("failed to parse PDF: %w", err)
		}
	case ".docx", ".doc":
		textContent, err = parseDOCX(fileData)
		if err != nil {
			return nil, fmt.Errorf("failed to parse DOCX: %w", err)
		}
	case ".csv", ".txt":
		textContent = string(fileData)
	default:
		// Try to parse as text/CSV
		textContent = string(fileData)
	}

	// Extract student data from text
	records := extractStudentDataFromText(textContent)

	if len(records) == 0 {
		return nil, fmt.Errorf("no student data found in file. Please ensure the file contains student codes and names")
	}

	// Detect header row and create column mapping
	startIndex := 0
	columnMap := make(map[string]int) // Maps field names to column indices

	if len(records) > 0 {
		firstRow := records[0]
		firstRowLower := strings.ToLower(strings.Join(firstRow, " "))

		// Check if first row looks like headers
		isHeader := strings.Contains(firstRowLower, "student") ||
			strings.Contains(firstRowLower, "code") ||
			strings.Contains(firstRowLower, "id") ||
			strings.Contains(firstRowLower, "name") ||
			strings.Contains(firstRowLower, "email") ||
			strings.Contains(firstRowLower, "contact") ||
			strings.Contains(firstRowLower, "phone")

		if isHeader {
			startIndex = 1
			// Map columns based on header names
			for colIdx, header := range firstRow {
				headerLower := strings.ToLower(strings.TrimSpace(header))

				// Student Code/ID detection
				if _, exists := columnMap["student_code"]; !exists && (strings.Contains(headerLower, "student") && (strings.Contains(headerLower, "code") || strings.Contains(headerLower, "id")) ||
					strings.Contains(headerLower, "student_id") ||
					strings.Contains(headerLower, "student code") ||
					(strings.Contains(headerLower, "id") && !strings.Contains(headerLower, "email") && !strings.Contains(headerLower, "contact"))) {
					columnMap["student_code"] = colIdx
				}

				// First Name detection
				if _, exists := columnMap["first_name"]; !exists && (strings.Contains(headerLower, "first") && strings.Contains(headerLower, "name") ||
					strings.Contains(headerLower, "firstname") ||
					strings.Contains(headerLower, "fname") ||
					headerLower == "first") {
					columnMap["first_name"] = colIdx
				}

				// Last Name detection
				if _, exists := columnMap["last_name"]; !exists && (strings.Contains(headerLower, "last") && strings.Contains(headerLower, "name") ||
					strings.Contains(headerLower, "lastname") ||
					strings.Contains(headerLower, "lname") ||
					headerLower == "last" ||
					strings.Contains(headerLower, "surname")) {
					columnMap["last_name"] = colIdx
				}

				// Middle Name detection
				if _, exists := columnMap["middle_name"]; !exists && (strings.Contains(headerLower, "middle") && strings.Contains(headerLower, "name") ||
					strings.Contains(headerLower, "middlename") ||
					strings.Contains(headerLower, "mname") ||
					headerLower == "middle" ||
					strings.Contains(headerLower, "mi")) {
					columnMap["middle_name"] = colIdx
				}

				// Email detection
				if _, exists := columnMap["email"]; !exists && (strings.Contains(headerLower, "email") ||
					strings.Contains(headerLower, "e-mail") ||
					strings.Contains(headerLower, "mail")) {
					columnMap["email"] = colIdx
				}

				// Contact Number detection
				if _, exists := columnMap["contact"]; !exists && (strings.Contains(headerLower, "contact") ||
					strings.Contains(headerLower, "phone") ||
					strings.Contains(headerLower, "mobile") ||
					strings.Contains(headerLower, "cell") ||
					(strings.Contains(headerLower, "number") && !strings.Contains(headerLower, "student") && !strings.Contains(headerLower, "id"))) {
					columnMap["contact"] = colIdx
				}

			}
		}
	}

	// If no header mapping found, use default positions (backward compatibility)
	if len(columnMap) == 0 {
		columnMap["student_code"] = 0
		columnMap["first_name"] = 1
		columnMap["last_name"] = 2
		if len(records) > 0 && len(records[0]) > 3 {
			columnMap["middle_name"] = 3
		}
		if len(records) > 0 && len(records[0]) > 4 {
			columnMap["contact"] = 4
		}
	}

	var successCount int
	var errorCount int
	var errors []string

	// Helper function to get column value safely
	getColumnValue := func(record []string, colIdx int, found bool) string {
		if found && colIdx >= 0 && colIdx < len(record) {
			return strings.TrimSpace(record[colIdx])
		}
		return ""
	}

	// Process each record
	for i, record := range records[startIndex:] {
		rowNum := i + startIndex + 1

		// Ensure we have at least 3 fields
		for len(record) < 3 {
			record = append(record, "")
		}

		// Extract values using column mapping
		studentCodeIdx, hasStudentCode := columnMap["student_code"]
		firstNameIdx, hasFirstName := columnMap["first_name"]
		lastNameIdx, hasLastName := columnMap["last_name"]
		middleNameIdx, hasMiddleName := columnMap["middle_name"]
		contactIdx, hasContact := columnMap["contact"]
		emailIdx, hasEmail := columnMap["email"]

		studentCode := getColumnValue(record, studentCodeIdx, hasStudentCode)
		firstName := getColumnValue(record, firstNameIdx, hasFirstName)
		lastName := getColumnValue(record, lastNameIdx, hasLastName)
		middleName := getColumnValue(record, middleNameIdx, hasMiddleName)
		contactNumber := getColumnValue(record, contactIdx, hasContact)
		email := getColumnValue(record, emailIdx, hasEmail)

		// Validate required fields
		if studentCode == "" {
			errorCount++
			errors = append(errors, fmt.Sprintf("Row %d: Student Code is required", rowNum))
			continue
		}
		if firstName == "" {
			errorCount++
			errors = append(errors, fmt.Sprintf("Row %d: First Name is required", rowNum))
			continue
		}
		if lastName == "" {
			errorCount++
			errors = append(errors, fmt.Sprintf("Row %d: Last Name is required", rowNum))
			continue
		}

		// Create the student using existing CreateUser function
		fullName := fmt.Sprintf("%s, %s", lastName, firstName)
		if middleName != "" {
			fullName = fmt.Sprintf("%s, %s %s", lastName, firstName, middleName)
		}

		// Use student code as password (default password)
		err := a.CreateUser(
			studentCode, // password
			fullName,    // name
			firstName,
			middleName,
			lastName,
			"", // gender (removed)
			"student",
			"",          // employeeID
			studentCode, // studentID
			"",          // year level
			"",          // section
			email,       // email (now detected from headers)
			contactNumber,
			"", // departmentCode
		)

		if err != nil {
			errorCount++
			errors = append(errors, fmt.Sprintf("Row %d (%s): %v", rowNum, studentCode, err))
			log.Printf("❌ Failed to create student at row %d: %v", rowNum, err)
		} else {
			successCount++
			log.Printf("✅ Created student: %s %s (Code: %s)", firstName, lastName, studentCode)
		}
	}

	result := map[string]interface{}{
		"success_count": successCount,
		"error_count":   errorCount,
		"total_count":   len(records) - startIndex,
		"errors":        errors,
	}

	return result, nil
}

// CreateUsersBulk creates multiple students from CSV data (kept for backward compatibility)
// CSV format: Student Code, First Name, Middle Name (optional), Last Name, Contact Number (optional)
func (a *App) CreateUsersBulk(csvData string) (map[string]interface{}, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	// Parse CSV data
	reader := csv.NewReader(strings.NewReader(csvData))
	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to parse CSV: %w", err)
	}

	if len(records) == 0 {
		return nil, fmt.Errorf("CSV file is empty")
	}

	// Skip header row if present
	startIndex := 0
	if len(records) > 0 {
		// Check if first row looks like a header (contains "student" or "code" etc.)
		firstRow := strings.ToLower(strings.Join(records[0], " "))
		if strings.Contains(firstRow, "student") || strings.Contains(firstRow, "code") ||
			strings.Contains(firstRow, "name") {
			startIndex = 1
		}
	}

	var successCount int
	var errorCount int
	var errors []string

	// Process each record
	for i, record := range records[startIndex:] {
		rowNum := i + startIndex + 1

		// Validate minimum required fields (at least Student Code, First Name, Last Name)
		if len(record) < 3 {
			errorCount++
			errors = append(errors, fmt.Sprintf("Row %d: Insufficient columns (need at least Student Code, First Name, Last Name)", rowNum))
			continue
		}

		studentCode := strings.TrimSpace(record[0])
		firstName := strings.TrimSpace(record[1])
		middleName := ""
		lastName := ""
		contactNumber := ""
		email := "" // Email not supported in legacy CreateUsersBulk function

		// Parse based on number of columns
		if len(record) >= 3 {
			lastName = strings.TrimSpace(record[2])
		}
		if len(record) >= 4 {
			middleName = strings.TrimSpace(record[3])
		}
		if len(record) >= 5 {
			contactNumber = strings.TrimSpace(record[4])
		}

		// Validate required fields
		if studentCode == "" {
			errorCount++
			errors = append(errors, fmt.Sprintf("Row %d: Student Code is required", rowNum))
			continue
		}
		if firstName == "" {
			errorCount++
			errors = append(errors, fmt.Sprintf("Row %d: First Name is required", rowNum))
			continue
		}
		if lastName == "" {
			errorCount++
			errors = append(errors, fmt.Sprintf("Row %d: Last Name is required", rowNum))
			continue
		}

		// Create the student using existing CreateUser function
		fullName := fmt.Sprintf("%s, %s", lastName, firstName)
		if middleName != "" {
			fullName = fmt.Sprintf("%s, %s %s", lastName, firstName, middleName)
		}

		// Use student code as password (default password)
		err := a.CreateUser(
			studentCode, // password
			fullName,    // name
			firstName,
			middleName,
			lastName,
			"", // gender (removed)
			"student",
			"",          // employeeID
			studentCode, // studentID
			"",          // year level
			"",          // section
			email,       // email
			contactNumber,
			"", // departmentCode
		)

		if err != nil {
			errorCount++
			errors = append(errors, fmt.Sprintf("Row %d (%s): %v", rowNum, studentCode, err))
			log.Printf("❌ Failed to create student at row %d: %v", rowNum, err)
		} else {
			successCount++
			log.Printf("✅ Created student: %s %s (Code: %s)", firstName, lastName, studentCode)
		}
	}

	result := map[string]interface{}{
		"success_count": successCount,
		"error_count":   errorCount,
		"total_count":   len(records) - startIndex,
		"errors":        errors,
	}

	return result, nil
}

// UpdateUser updates an existing user
func (a *App) UpdateUser(id int, name, firstName, middleName, lastName, gender, role, employeeID, studentID, year, section, email, contactNumber string, departmentCode string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Update in respective table based on role
	var query string
	var err error
	switch role {
	case "admin":
		query = `UPDATE admins SET first_name = ?, middle_name = ?, last_name = ?, gender = ?, employee_number = ?, email = ? WHERE user_id = ?`
		_, err = a.db.Exec(query, firstName, nullString(middleName), lastName, nullString(gender), nullString(employeeID), nullString(email), id)
	case "teacher":
		query = `UPDATE teachers SET first_name = ?, middle_name = ?, last_name = ?, employee_number = ?, email = ?, contact_number = ?, department_code = ? WHERE user_id = ?`
		_, err = a.db.Exec(query, firstName, nullString(middleName), lastName, nullString(employeeID), nullString(email), nullString(contactNumber), nullString(departmentCode), id)
	case "student":
		query = `UPDATE students SET first_name = ?, middle_name = ?, last_name = ?, student_number = ?, email = ?, contact_number = ? WHERE user_id = ? AND is_working_student = FALSE`
		_, err = a.db.Exec(query, firstName, nullString(middleName), lastName, nullString(studentID), nullString(email), nullString(contactNumber), id)
	case "working_student":
		query = `UPDATE students SET first_name = ?, middle_name = ?, last_name = ?, student_number = ?, email = ?, contact_number = ? WHERE user_id = ? AND is_working_student = TRUE`
		_, err = a.db.Exec(query, firstName, nullString(middleName), lastName, nullString(studentID), nullString(email), nullString(contactNumber), id)
	}

	return err
}

// DeleteUser deletes a user
func (a *App) DeleteUser(id int) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	query := `DELETE FROM users WHERE id = ?`
	_, err := a.db.Exec(query, id)
	return err
}

// ==============================================================================
// ADMIN DASHBOARD
// ==============================================================================

// AdminDashboard represents admin dashboard data
type AdminDashboard struct {
	TotalStudents   int `json:"total_students"`
	TotalTeachers   int `json:"total_teachers"`
	WorkingStudents int `json:"working_students"`
	RecentLogins    int `json:"recent_logins"`
}

// GetAdminDashboard returns admin dashboard statistics
func (a *App) GetAdminDashboard() (AdminDashboard, error) {
	var dashboard AdminDashboard

	if a.db == nil {
		return dashboard, fmt.Errorf("database not connected")
	}

	// Count total students
	err := a.db.QueryRow(`SELECT COUNT(*) FROM students`).Scan(&dashboard.TotalStudents)
	if err != nil {
		log.Printf("⚠ Failed to count students: %v", err)
	}

	// Count total teachers
	err = a.db.QueryRow(`SELECT COUNT(*) FROM teachers`).Scan(&dashboard.TotalTeachers)
	if err != nil {
		log.Printf("⚠ Failed to count teachers: %v", err)
	}

	// Count working students
	err = a.db.QueryRow(`SELECT COUNT(*) FROM students WHERE is_working_student = TRUE`).Scan(&dashboard.WorkingStudents)
	if err != nil {
		log.Printf("⚠ Failed to count working students: %v", err)
	}

	// Count recent logins (last 24 hours)
	err = a.db.QueryRow(`
		SELECT COUNT(*) 
		FROM login_logs 
		WHERE login_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
	`).Scan(&dashboard.RecentLogins)
	if err != nil {
		log.Printf("⚠ Failed to count recent logins: %v", err)
	}

	return dashboard, nil
}

// ==============================================================================
// DEPARTMENT MANAGEMENT
// ==============================================================================

// Department represents a department
type Department struct {
	DepartmentCode string  `json:"department_code"`
	DepartmentName string  `json:"department_name"`
	Description    *string `json:"description,omitempty"`
	IsActive       bool    `json:"is_active"`
	CreatedAt      string  `json:"created_at"`
	UpdatedAt      string  `json:"updated_at"`
}

// GetDepartments returns all departments
func (a *App) GetDepartments() ([]Department, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT department_code, department_name, description, is_active, created_at, updated_at
		FROM departments
		ORDER BY department_code
	`
	rows, err := a.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var departments []Department
	for rows.Next() {
		var dept Department
		var description sql.NullString
		var createdAt, updatedAt time.Time

		err := rows.Scan(&dept.DepartmentCode, &dept.DepartmentName, &description, &dept.IsActive, &createdAt, &updatedAt)
		if err != nil {
			continue
		}

		if description.Valid {
			dept.Description = &description.String
		}
		dept.CreatedAt = createdAt.Format("2006-01-02 15:04:05")
		dept.UpdatedAt = updatedAt.Format("2006-01-02 15:04:05")

		departments = append(departments, dept)
	}

	return departments, nil
}

// CreateDepartment creates a new department
func (a *App) CreateDepartment(departmentCode, departmentName, description string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	if departmentCode == "" || departmentName == "" {
		return fmt.Errorf("department code and name are required")
	}

	query := `INSERT INTO departments (department_code, department_name, description) VALUES (?, ?, ?)`
	_, err := a.db.Exec(query, departmentCode, departmentName, nullString(description))
	if err != nil {
		log.Printf("⚠ Failed to create department: %v", err)
		return err
	}

	log.Printf("✓ Department created: %s - %s", departmentCode, departmentName)
	return nil
}

// UpdateDepartment updates an existing department
func (a *App) UpdateDepartment(oldDepartmentCode, departmentCode, departmentName, description string, isActive bool) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	if departmentCode == "" || departmentName == "" {
		return fmt.Errorf("department code and name are required")
	}

	query := `UPDATE departments SET department_code = ?, department_name = ?, description = ?, is_active = ? WHERE department_code = ?`
	_, err := a.db.Exec(query, departmentCode, departmentName, nullString(description), isActive, oldDepartmentCode)
	if err != nil {
		log.Printf("⚠ Failed to update department: %v", err)
		return err
	}

	log.Printf("✓ Department updated: %s", departmentCode)
	return nil
}

// DeleteDepartment deletes a department
func (a *App) DeleteDepartment(departmentCode string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	query := `DELETE FROM departments WHERE department_code = ?`
	_, err := a.db.Exec(query, departmentCode)
	if err != nil {
		log.Printf("⚠ Failed to delete department: %v", err)
		return err
	}

	log.Printf("✓ Department deleted: %s", departmentCode)
	return nil
}

// ==============================================================================
// LOGIN LOGS
// ==============================================================================

// LoginLog represents a login log entry
type LoginLog struct {
	ID           int     `json:"id"`
	UserID       int     `json:"user_id"`
	UserName     string  `json:"user_name"`
	UserIDNumber string  `json:"user_id_number"`
	UserType     string  `json:"user_type"`
	PCNumber     *string `json:"pc_number"`
	LoginTime    string  `json:"login_time"`
	LogoutTime   *string `json:"logout_time"`
}

// ==============================================================================
// FEEDBACK
// ==============================================================================

// Feedback represents equipment feedback
type Feedback struct {
	ID                  int     `json:"id"`
	StudentUserID       int     `json:"student_user_id"`
	StudentIDStr        string  `json:"student_id_str"`
	FirstName           string  `json:"first_name"`
	MiddleName          *string `json:"middle_name"`
	LastName            string  `json:"last_name"`
	StudentName         string  `json:"student_name"`
	PCNumber            string  `json:"pc_number"`
	EquipmentCondition  string  `json:"equipment_condition"`
	MonitorCondition    string  `json:"monitor_condition"`
	KeyboardCondition   string  `json:"keyboard_condition"`
	MouseCondition      string  `json:"mouse_condition"`
	Comments            *string `json:"comments"`
	DateSubmitted       string  `json:"date_submitted"`
	Status              string  `json:"status"` // 'pending', 'forwarded', 'resolved'
	ForwardedByUserID   *int    `json:"forwarded_by_user_id"`
	ForwardedByName     *string `json:"forwarded_by_name"`
	ForwardedAt         *string `json:"forwarded_at"`
	WorkingStudentNotes *string `json:"working_student_notes"`
}

// GetFeedback returns all forwarded feedback (for admins)
func (a *App) GetFeedback() ([]Feedback, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			f.id, 
			f.student_user_id, 
			COALESCE(s.student_number, 'N/A') as student_id_str,
			s.first_name, 
			s.middle_name, 
			s.last_name, 
			f.pc_number, 
			f.equipment_condition, 
			f.monitor_condition, 
			f.keyboard_condition, 
			f.mouse_condition, 
			f.comments, 
			f.date_submitted,
			f.status,
			f.forwarded_by_user_id,
			f.forwarded_at,
			f.working_student_notes,
			CONCAT(
				COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name, ''), 
				CASE WHEN COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name) IS NOT NULL THEN ', ' ELSE '' END,
				COALESCE(s_fwd.first_name, t_fwd.first_name, a_fwd.first_name, ''),
				CASE WHEN COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name) IS NOT NULL 
					THEN CONCAT(' ', COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name)) 
					ELSE '' END
			) as forwarded_by_name
		FROM feedback f
		LEFT JOIN students s ON f.student_user_id = s.user_id
		LEFT JOIN users u_fwd ON f.forwarded_by_user_id = u_fwd.id
		LEFT JOIN students s_fwd ON u_fwd.id = s_fwd.user_id AND u_fwd.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t_fwd ON u_fwd.id = t_fwd.user_id AND u_fwd.user_type = 'teacher'
		LEFT JOIN admins a_fwd ON u_fwd.id = a_fwd.user_id AND u_fwd.user_type = 'admin'
		WHERE f.status = 'forwarded'
		ORDER BY f.date_submitted DESC 
		LIMIT 1000`
	rows, err := a.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var feedbacks []Feedback
	for rows.Next() {
		var fb Feedback
		var middleName, comments, studentIDStr, forwardedByName, workingStudentNotes sql.NullString
		var dateSubmitted time.Time
		var forwardedBy sql.NullInt64
		var forwardedAt sql.NullTime

		err := rows.Scan(&fb.ID, &fb.StudentUserID, &studentIDStr, &fb.FirstName, &middleName, &fb.LastName,
			&fb.PCNumber, &fb.EquipmentCondition, &fb.MonitorCondition,
			&fb.KeyboardCondition, &fb.MouseCondition, &comments, &dateSubmitted, &fb.Status,
			&forwardedBy, &forwardedAt, &workingStudentNotes, &forwardedByName)
		if err != nil {
			continue
		}

		if studentIDStr.Valid {
			fb.StudentIDStr = studentIDStr.String
		} else {
			fb.StudentIDStr = "N/A"
		}
		if middleName.Valid {
			fb.MiddleName = &middleName.String
		}
		if comments.Valid {
			fb.Comments = &comments.String
		}
		if forwardedBy.Valid {
			forwardedByInt := int(forwardedBy.Int64)
			fb.ForwardedByUserID = &forwardedByInt
		}
		if forwardedAt.Valid {
			forwardedAtStr := forwardedAt.Time.Format("2006-01-02 15:04:05")
			fb.ForwardedAt = &forwardedAtStr
		}
		if forwardedByName.Valid && forwardedByName.String != "" {
			fb.ForwardedByName = &forwardedByName.String
		}
		if workingStudentNotes.Valid {
			fb.WorkingStudentNotes = &workingStudentNotes.String
		}

		fb.StudentName = fmt.Sprintf("%s, %s", fb.LastName, fb.FirstName)
		if middleName.Valid {
			fb.StudentName += " " + middleName.String
		}
		fb.DateSubmitted = dateSubmitted.Format("2006-01-02 15:04:05")

		feedbacks = append(feedbacks, fb)
	}

	return feedbacks, nil
}

// GetStudentFeedback returns feedback history for a specific student
func (a *App) GetStudentFeedback(studentID int) ([]Feedback, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			f.id, 
			f.student_user_id, 
			COALESCE(s.student_number, 'N/A') as student_id_str,
			s.first_name,
			s.middle_name,
			s.last_name,
			f.pc_number, 
			f.equipment_condition, 
			f.monitor_condition, 
			f.keyboard_condition, 
			f.mouse_condition, 
			f.comments, 
			f.date_submitted 
		FROM feedback f
		LEFT JOIN students s ON f.student_user_id = s.user_id
		WHERE f.student_user_id = ? 
		ORDER BY f.date_submitted DESC`
	rows, err := a.db.Query(query, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var feedbacks []Feedback
	for rows.Next() {
		var fb Feedback
		var middleName, comments, studentIDStr sql.NullString
		var dateSubmitted time.Time

		err := rows.Scan(&fb.ID, &fb.StudentUserID, &studentIDStr, &fb.FirstName, &middleName, &fb.LastName,
			&fb.PCNumber, &fb.EquipmentCondition, &fb.MonitorCondition,
			&fb.KeyboardCondition, &fb.MouseCondition, &comments, &dateSubmitted)
		if err != nil {
			continue
		}

		if studentIDStr.Valid {
			fb.StudentIDStr = studentIDStr.String
		} else {
			fb.StudentIDStr = "N/A"
		}
		if middleName.Valid {
			fb.MiddleName = &middleName.String
		}
		if comments.Valid {
			fb.Comments = &comments.String
		}

		fb.StudentName = fmt.Sprintf("%s, %s", fb.LastName, fb.FirstName)
		if middleName.Valid {
			fb.StudentName += " " + middleName.String
		}
		fb.DateSubmitted = dateSubmitted.Format("2006-01-02 15:04:05")

		feedbacks = append(feedbacks, fb)
	}

	return feedbacks, nil
}

// SaveEquipmentFeedback saves equipment feedback from a student
func (a *App) SaveEquipmentFeedback(userID int, userName, computerStatus, computerIssue, mouseStatus, mouseIssue, keyboardStatus, keyboardIssue, monitorStatus, monitorIssue, additionalComments string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Get the hostname (PC number) of this device
	hostname, err := os.Hostname()
	if err != nil {
		log.Printf("⚠ Failed to get hostname: %v", err)
		hostname = "Unknown"
	}
	pcNumber := hostname

	// Determine equipment conditions based on status
	// ENUM values: 'Good', 'Minor Issue', 'Not Working'
	equipmentCondition := "Good"
	if computerStatus == "no" {
		equipmentCondition = "Not Working"
	}

	monitorCondition := "Good"
	if monitorStatus == "no" {
		monitorCondition = "Not Working"
	}

	keyboardCondition := "Good"
	if keyboardStatus == "no" {
		keyboardCondition = "Not Working"
	}

	mouseCondition := "Good"
	if mouseStatus == "no" {
		mouseCondition = "Not Working"
	}

	// Build detailed comments with all issues
	var commentsParts []string
	if computerIssue != "" {
		commentsParts = append(commentsParts, fmt.Sprintf("Computer: %s", computerIssue))
	}
	if monitorIssue != "" {
		commentsParts = append(commentsParts, fmt.Sprintf("Monitor: %s", monitorIssue))
	}
	if keyboardIssue != "" {
		commentsParts = append(commentsParts, fmt.Sprintf("Keyboard: %s", keyboardIssue))
	}
	if mouseIssue != "" {
		commentsParts = append(commentsParts, fmt.Sprintf("Mouse: %s", mouseIssue))
	}
	if additionalComments != "" {
		commentsParts = append(commentsParts, fmt.Sprintf("Additional: %s", additionalComments))
	}

	combinedComments := ""
	if len(commentsParts) > 0 {
		combinedComments = commentsParts[0]
		for i := 1; i < len(commentsParts); i++ {
			combinedComments = fmt.Sprintf("%s; %s", combinedComments, commentsParts[i])
		}
	}

	// Insert feedback into database
	query := `INSERT INTO feedback (student_user_id, pc_number, 
			  equipment_condition, monitor_condition, keyboard_condition, mouse_condition, 
			  comments, date_submitted) 
			  VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`

	_, err = a.db.Exec(query, userID, pcNumber,
		equipmentCondition, monitorCondition, keyboardCondition, mouseCondition, nullString(combinedComments))

	if err != nil {
		log.Printf("Failed to save equipment feedback: %v", err)
		return fmt.Errorf("failed to save feedback: %w", err)
	}

	log.Printf("✓ Equipment feedback saved for user %d", userID)
	return nil
}

// GetPendingFeedback returns all pending feedback for working students to review
func (a *App) GetPendingFeedback() ([]Feedback, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			f.id, 
			f.student_user_id, 
			COALESCE(s.student_number, 'N/A') as student_id_str,
			s.first_name, 
			s.middle_name, 
			s.last_name, 
			f.pc_number, 
			f.equipment_condition, 
			f.monitor_condition, 
			f.keyboard_condition, 
			f.mouse_condition, 
			f.comments, 
			f.date_submitted,
			f.status
		FROM feedback f
		LEFT JOIN students s ON f.student_user_id = s.user_id
		WHERE f.status = 'pending'
		ORDER BY f.date_submitted DESC 
		LIMIT 1000`
	rows, err := a.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var feedbacks []Feedback
	for rows.Next() {
		var fb Feedback
		var middleName, comments, studentIDStr sql.NullString
		var dateSubmitted time.Time

		err := rows.Scan(&fb.ID, &fb.StudentUserID, &studentIDStr, &fb.FirstName, &middleName, &fb.LastName,
			&fb.PCNumber, &fb.EquipmentCondition, &fb.MonitorCondition,
			&fb.KeyboardCondition, &fb.MouseCondition, &comments, &dateSubmitted, &fb.Status)
		if err != nil {
			continue
		}

		if studentIDStr.Valid {
			fb.StudentIDStr = studentIDStr.String
		} else {
			fb.StudentIDStr = "N/A"
		}
		if middleName.Valid {
			fb.MiddleName = &middleName.String
		}
		if comments.Valid {
			fb.Comments = &comments.String
		}

		fb.StudentName = fmt.Sprintf("%s, %s", fb.LastName, fb.FirstName)
		if middleName.Valid {
			fb.StudentName += " " + middleName.String
		}
		fb.DateSubmitted = dateSubmitted.Format("2006-01-02 15:04:05")

		feedbacks = append(feedbacks, fb)
	}

	return feedbacks, nil
}

// ForwardFeedbackToAdmin forwards feedback from working student to admin
func (a *App) ForwardFeedbackToAdmin(feedbackID int, workingStudentID int, notes string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Update feedback to forwarded status
	query := `UPDATE feedback 
			  SET status = 'forwarded', 
			      forwarded_by_user_id = ?, 
			      forwarded_at = NOW(), 
			      working_student_notes = ?
			  WHERE id = ? AND status = 'pending'`

	result, err := a.db.Exec(query, workingStudentID, nullString(notes), feedbackID)
	if err != nil {
		log.Printf("⚠ Failed to forward feedback %d: %v", feedbackID, err)
		return fmt.Errorf("failed to forward feedback: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("feedback not found or already forwarded")
	}

	log.Printf("✓ Feedback %d forwarded to admin by working student %d", feedbackID, workingStudentID)
	return nil
}

// ForwardMultipleFeedbackToAdmin forwards multiple feedback items from working student to admin in batch
func (a *App) ForwardMultipleFeedbackToAdmin(feedbackIDs []int, workingStudentID int, notes string) (int, error) {
	if a.db == nil {
		return 0, fmt.Errorf("database not connected")
	}

	if len(feedbackIDs) == 0 {
		return 0, fmt.Errorf("no feedback IDs provided")
	}

	// Build placeholders for the IN clause
	placeholders := make([]string, len(feedbackIDs))
	args := make([]interface{}, 0, len(feedbackIDs)+2)
	
	// Add workingStudentID and notes first (for SET clause)
	args = append(args, workingStudentID)
	args = append(args, nullString(notes))
	
	// Add feedback IDs for WHERE clause
	for i, id := range feedbackIDs {
		placeholders[i] = "?"
		args = append(args, id)
	}

	// Update all feedback items to forwarded status in a single query
	query := fmt.Sprintf(`UPDATE feedback 
			  SET status = 'forwarded', 
			      forwarded_by_user_id = ?, 
			      forwarded_at = NOW(), 
			      working_student_notes = ?
			  WHERE id IN (%s) AND status = 'pending'`, strings.Join(placeholders, ","))

	result, err := a.db.Exec(query, args...)
	if err != nil {
		log.Printf("⚠ Failed to forward multiple feedback: %v", err)
		return 0, fmt.Errorf("failed to forward feedback: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	if rowsAffected == 0 {
		return 0, fmt.Errorf("no feedback items were forwarded (may already be forwarded or not found)")
	}

	log.Printf("✓ %d feedback items forwarded to admin by working student %d", rowsAffected, workingStudentID)
	return int(rowsAffected), nil
}

// ==============================================================================
// TEACHER DASHBOARD & CLASS MANAGEMENT
// ==============================================================================

// TeacherDashboard represents teacher dashboard data
type TeacherDashboard struct {
	Classes    []CourseClass `json:"classes"`
	Attendance []Attendance  `json:"attendance"`
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

// CourseClass represents a specific instance of a subject (with schedule, room, etc.)
type CourseClass struct {
	ClassID         int     `json:"class_id"`
	SubjectCode     string  `json:"subject_code"`
	SubjectName     string  `json:"subject_name"`
	OfferingCode    *string `json:"offering_code,omitempty"`
	TeacherUserID   int     `json:"teacher_user_id"`
	TeacherCode     *string `json:"teacher_code,omitempty"`
	TeacherName     string  `json:"teacher_name"`
	Schedule        *string `json:"schedule,omitempty"`
	Room            *string `json:"room,omitempty"`
	YearLevel       *string `json:"year_level,omitempty"`
	Section         *string `json:"section,omitempty"`
	Semester        *string `json:"semester,omitempty"`
	SchoolYear      *string `json:"school_year,omitempty"`
	EnrolledCount   int     `json:"enrolled_count"`
	IsActive        bool    `json:"is_active"`
	CreatedByUserID *int    `json:"created_by_user_id,omitempty"`
	CreatedAt       string  `json:"created_at"`
}

// ClasslistEntry represents a student's enrollment in a class
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

// ClassStudent represents a student (used for enrollment operations)
type ClassStudent struct {
	ID            int     `json:"id"`
	StudentID     string  `json:"student_id"`
	FirstName     string  `json:"first_name"`
	MiddleName    *string `json:"middle_name"`
	LastName      string  `json:"last_name"`
	Gender        *string `json:"gender"`
	Email         *string `json:"email"`
	ContactNumber *string `json:"contact_number"`
	ProfilePhoto  *string `json:"profile_photo"`
	ClassID       *int    `json:"class_id,omitempty"`
	IsEnrolled    bool    `json:"is_enrolled"`
}

// Attendance represents an attendance record
type Attendance struct {
	ClassID       int     `json:"class_id"`
	StudentUserID int     `json:"student_user_id"`
	Date          string  `json:"date"`
	StudentCode   string  `json:"student_code"`
	FirstName     string  `json:"first_name"`
	MiddleName    *string `json:"middle_name,omitempty"`
	LastName      string  `json:"last_name"`
	SubjectCode   string  `json:"subject_code"`
	SubjectName   string  `json:"subject_name"`
	TimeIn        *string `json:"time_in"`
	TimeOut       *string `json:"time_out"`
	PCNumber      *string `json:"pc_number,omitempty"`
	Status        string  `json:"status"`
	Remarks       *string `json:"remarks,omitempty"`
	RecordedBy    *int    `json:"recorded_by,omitempty"`
}

// GetTeacherDashboard returns teacher dashboard data
func (a *App) GetTeacherDashboard(teacherID int) (TeacherDashboard, error) {
	var dashboard TeacherDashboard

	if a.db == nil {
		return dashboard, fmt.Errorf("database not connected")
	}

	// Get teacher's classes
	classes, err := a.GetTeacherClasses(teacherID)
	if err != nil {
		log.Printf("⚠ Failed to get teacher classes: %v", err)
		return dashboard, err
	}
	dashboard.Classes = classes

	// Get today's attendance for all teacher's classes
	query := `
		SELECT 
			a.class_id, a.student_user_id, a.date, a.time_in, a.time_out, a.status, a.remarks,
			vcl.class_id, vcl.student_user_id, vcl.student_number, 
			vcl.first_name, vcl.middle_name, vcl.last_name,
			vc.subject_code, vc.subject_name
		FROM attendance a
		JOIN v_classlist_complete vcl ON a.class_id = vcl.class_id AND a.student_user_id = vcl.student_user_id
		JOIN v_classes_complete vc ON a.class_id = vc.class_id
		WHERE vc.teacher_user_id = ? AND a.date = CURDATE()
		ORDER BY a.time_in DESC
		LIMIT 100
	`
	rows, err := a.db.Query(query, teacherID)
	if err != nil {
		log.Printf("⚠ Failed to query attendance: %v", err)
		// Return dashboard with just classes
		return dashboard, nil
	}
	defer rows.Close()

	for rows.Next() {
		var att Attendance
		var timeIn, timeOut, remarks, middleName sql.NullString
		err := rows.Scan(
			&att.ClassID, &att.StudentUserID, &att.Date, &timeIn, &timeOut, &att.Status, &remarks,
			&att.ClassID, &att.StudentUserID, &att.StudentCode,
			&att.FirstName, &middleName, &att.LastName,
			&att.SubjectCode, &att.SubjectName,
		)
		if err != nil {
			continue
		}

		if timeIn.Valid {
			att.TimeIn = &timeIn.String
		}
		if timeOut.Valid {
			att.TimeOut = &timeOut.String
		}
		if remarks.Valid {
			att.Remarks = &remarks.String
		}
		if middleName.Valid {
			att.MiddleName = &middleName.String
		}

		dashboard.Attendance = append(dashboard.Attendance, att)
	}

	return dashboard, nil
}

// RecordAttendance records attendance for a student in a class
func (a *App) RecordAttendance(classID, studentID int, timeIn, timeOut, status, remarks string, recordedBy int) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Verify student is enrolled in the class
	var exists int
	err := a.db.QueryRow(
		`SELECT 1 FROM classlist WHERE class_id = ? AND student_user_id = ? AND status = 'active' LIMIT 1`,
		classID, studentID,
	).Scan(&exists)
	if err != nil {
		log.Printf("⚠ Student %d not enrolled in class %d: %v", studentID, classID, err)
		return fmt.Errorf("student not enrolled in this class")
	}

	// Record or update attendance using composite key (class_id, student_user_id, date)
	query := `
		INSERT INTO attendance (class_id, student_user_id, date, time_in, time_out, status, remarks)
		VALUES (?, ?, CURDATE(), ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE 
			time_in = COALESCE(VALUES(time_in), time_in),
			time_out = COALESCE(VALUES(time_out), time_out),
			status = VALUES(status),
			remarks = VALUES(remarks),
			updated_at = CURRENT_TIMESTAMP
	`
	_, err = a.db.Exec(query, classID, studentID, nullString(timeIn), nullString(timeOut), status, nullString(remarks))
	if err != nil {
		log.Printf("⚠ Failed to record attendance: %v", err)
		return err
	}

	log.Printf("✓ Attendance recorded: student=%d, class=%d, status=%s", studentID, classID, status)
	return nil
}

// UpdateAttendanceTime updates time in/out for an attendance record
func (a *App) UpdateAttendanceTime(classID, studentUserID int, date, timeIn, timeOut string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	query := `
		UPDATE attendance 
		SET time_in = COALESCE(?, time_in), 
		    time_out = COALESCE(?, time_out),
		    updated_at = CURRENT_TIMESTAMP
		WHERE class_id = ? AND student_user_id = ? AND date = ?
	`
	_, err := a.db.Exec(query, nullString(timeIn), nullString(timeOut), classID, studentUserID, date)
	if err != nil {
		log.Printf("⚠ Failed to update attendance time: %v", err)
		return err
	}

	log.Printf("✓ Attendance time updated: class_id=%d, student_user_id=%d, date=%s", classID, studentUserID, date)
	return nil
}

// GetClassAttendance gets attendance records for a specific class on a specific date
func (a *App) GetClassAttendance(classID int, date string) ([]Attendance, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			cl.class_id,
			cl.student_user_id,
			COALESCE(a.date, ?) as date,
			vcl.student_number,
			vcl.first_name,
			vcl.middle_name,
			vcl.last_name,
			s.subject_code,
			s.subject_name,
			a.time_in,
			a.time_out,
			a.pc_number,
			a.status,
			a.remarks
		FROM classlist cl
		JOIN v_classlist_complete vcl ON cl.class_id = vcl.class_id AND cl.student_user_id = vcl.student_user_id
		JOIN classes c ON cl.class_id = c.class_id
		JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN attendance a ON cl.class_id = a.class_id AND cl.student_user_id = a.student_user_id AND a.date = ?
		WHERE cl.class_id = ? AND cl.status = 'active'
		ORDER BY vcl.last_name, vcl.first_name
	`

	rows, err := a.db.Query(query, date, date, classID)
	if err != nil {
		log.Printf("⚠ Failed to query attendance: %v", err)
		return nil, err
	}
	defer rows.Close()

	var attendances []Attendance
	for rows.Next() {
		var att Attendance
		var middleName, timeIn, timeOut, pcNumber, remarks, status sql.NullString

		err := rows.Scan(
			&att.ClassID, &att.StudentUserID, &att.Date,
			&att.StudentCode, &att.FirstName, &middleName, &att.LastName,
			&att.SubjectCode, &att.SubjectName,
			&timeIn, &timeOut, &pcNumber, &status, &remarks,
		)
		if err != nil {
			log.Printf("⚠ Failed to scan attendance row: %v", err)
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
		if status.Valid {
			att.Status = status.String
		} else {
			att.Status = "" // Empty string when no status is set yet
		}

		attendances = append(attendances, att)
	}

	return attendances, nil
}

// InitializeAttendanceForClass creates attendance records for all students in a class for a date
// Status is initially set to 'absent' so teachers can mark who is present
func (a *App) InitializeAttendanceForClass(classID int, date string, recordedBy int) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	query := `
		INSERT INTO attendance (class_id, student_user_id, date, status, remarks, created_at)
		SELECT 
			cl.class_id,
			cl.student_user_id,
			?,
			'absent',
			'Not yet logged in',
			CURRENT_TIMESTAMP
		FROM classlist cl
		WHERE cl.class_id = ? AND cl.status = 'active'
		ON DUPLICATE KEY UPDATE 
			remarks = CASE 
				WHEN time_in IS NULL AND (remarks IS NULL OR remarks = '') THEN 'Not yet logged in'
				ELSE remarks
			END,
			class_id=class_id
	`

	_, err := a.db.Exec(query, date, classID)
	if err != nil {
		log.Printf("⚠ Failed to initialize attendance: %v", err)
		return err
	}

	log.Printf("✓ Attendance initialized for class %d on %s", classID, date)
	return nil
}

// UpdateAttendanceRecord updates a specific attendance record with new details
func (a *App) UpdateAttendanceRecord(classID, studentUserID int, date, timeIn, timeOut, pcNumber, status, remarks string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	query := `
		UPDATE attendance 
		SET time_in = ?,
		    time_out = ?,
		    pc_number = ?,
		    status = ?,
		    remarks = ?,
		    updated_at = CURRENT_TIMESTAMP
		WHERE class_id = ? AND student_user_id = ? AND date = ?
	`

	_, err := a.db.Exec(query, nullString(timeIn), nullString(timeOut), nullString(pcNumber), status, nullString(remarks), classID, studentUserID, date)
	if err != nil {
		log.Printf("⚠ Failed to update attendance record: %v", err)
		return err
	}

	log.Printf("✓ Attendance record updated: class_id=%d, student_user_id=%d, date=%s, status=%s", classID, studentUserID, date, status)
	return nil
}

// RecordStudentLogin records when a student logs in during class time
func (a *App) RecordStudentLogin(classID, studentID int, pcNumber string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Verify student is enrolled in the class
	var exists int
	err := a.db.QueryRow(
		`SELECT 1 FROM classlist WHERE class_id = ? AND student_user_id = ? AND status = 'active' LIMIT 1`,
		classID, studentID,
	).Scan(&exists)
	if err != nil {
		return fmt.Errorf("student not enrolled in this class")
	}

	// Record attendance as present with login time using composite key
	// Clear "Not yet logged in" remark when student logs in
	query := `
		INSERT INTO attendance (class_id, student_user_id, date, time_in, pc_number, status, remarks)
		VALUES (?, ?, CURDATE(), CURTIME(), ?, 'present', NULL)
		ON DUPLICATE KEY UPDATE 
			time_in = COALESCE(time_in, CURTIME()),
			pc_number = VALUES(pc_number),
			status = 'present',
			remarks = CASE 
				WHEN remarks = 'Not yet logged in' THEN NULL
				ELSE remarks
			END,
			updated_at = CURRENT_TIMESTAMP
	`

	_, err = a.db.Exec(query, classID, studentID, pcNumber)
	if err != nil {
		log.Printf("⚠ Failed to record student login: %v", err)
		return err
	}

	log.Printf("✓ Student login recorded: student=%d, class=%d, pc=%s", studentID, classID, pcNumber)
	return nil
		}
		middleName := ""
		if att.MiddleName != nil {
			middleName = *att.MiddleName
		}
		remarks := ""
		if att.Remarks != nil {
			remarks = *att.Remarks
		}

		writer.Write([]string{
			att.Date,
			att.StudentCode,
			att.FirstName,
			middleName,
			att.LastName,
			fmt.Sprintf("%s - %s", att.SubjectCode, att.SubjectName),
			timeIn,
			timeOut,
			att.Status,
			remarks,
		})
	}

	log.Printf("✓ Attendance exported to CSV: %s", filename)
	return filename, nil
}

// GenerateAttendanceFromLogs generates attendance records for a class based on login logs
// It determines status: present (login before 10 min to scheduled time), late (login 10 min after scheduled time), absent (no login)
func (a *App) GenerateAttendanceFromLogs(classID int, date string, recordedBy int) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Get class information including schedule
	var schedule sql.NullString
	err := a.db.QueryRow("SELECT schedule FROM classes WHERE class_id = ?", classID).Scan(&schedule)
	if err != nil {
		log.Printf("⚠ Failed to get class schedule: %v", err)
		return fmt.Errorf("failed to get class schedule: %w", err)
	}

	if !schedule.Valid || schedule.String == "" {
		return fmt.Errorf("class schedule not set")
	}

	// Parse schedule to get start time
	scheduleStr := schedule.String
	startTime, err := parseScheduleStartTime(scheduleStr)
	if err != nil {
		log.Printf("⚠ Failed to parse schedule: %v", err)
		return fmt.Errorf("failed to parse schedule: %w", err)
	}

	// Get all enrolled students
	students, err := a.GetClassStudents(classID)
	if err != nil {
		return fmt.Errorf("failed to get class students: %w", err)
	}

	// Validate the date format
	_, err = time.Parse("2006-01-02", date)
	if err != nil {
		return fmt.Errorf("invalid date format: %w", err)
	}

	// For each student, check login logs and create attendance record
	for _, student := range students {
		// Get login logs for this student on the attendance date
		query := `
			SELECT login_time, logout_time, pc_number
			FROM login_logs
			WHERE user_id = ? 
			AND DATE(login_time) = ?
			AND login_status = 'success'
			ORDER BY login_time ASC
			LIMIT 1
		`
		var loginTime sql.NullTime
		var logoutTime sql.NullTime
		var pcNumber sql.NullString

		err := a.db.QueryRow(query, student.StudentUserID, date).Scan(&loginTime, &logoutTime, &pcNumber)
		
		var status string
		var timeInStr, timeOutStr string
		var pcNumberStr string

		if err == nil && loginTime.Valid {
			// Student logged in - determine if present or late
			loginDateTime := loginTime.Time
			loginTimeOnly := time.Date(0, 1, 1, loginDateTime.Hour(), loginDateTime.Minute(), loginDateTime.Second(), 0, time.UTC)
			
			// Calculate 10 minutes after scheduled time (cutoff for late)
			tenMinutesAfter := startTime.Add(10 * time.Minute)

			timeInStr = loginDateTime.Format("15:04:05")
			if logoutTime.Valid {
				timeOutStr = logoutTime.Time.Format("15:04:05")
			}
			if pcNumber.Valid {
				pcNumberStr = pcNumber.String
			}

			// Determine status based on login time
			// Present: login within 10 minutes after scheduled time (allows 10 min before and 10 min after)
			// Late: login more than 10 minutes after scheduled time
			if loginTimeOnly.Before(tenMinutesAfter) || loginTimeOnly.Equal(tenMinutesAfter) {
				// Login before or within 10 minutes after scheduled time = Present
				status = "present"
			} else {
				// Login more than 10 minutes after scheduled time = Late
				status = "late"
			}
		} else {
			// No login found = Absent
			status = "absent"
		}

		// Set remarks for students who haven't logged in yet
		var remarksStr string
		if status == "absent" {
			remarksStr = "Not yet logged in"
		}

		// Insert or update attendance record
		// If student has logged in (time_in exists), clear the "Not yet logged in" remark
		insertQuery := `
			INSERT INTO attendance (class_id, student_user_id, date, time_in, time_out, pc_number, status, remarks, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON DUPLICATE KEY UPDATE
				time_in = COALESCE(VALUES(time_in), time_in),
				time_out = COALESCE(VALUES(time_out), time_out),
				pc_number = COALESCE(VALUES(pc_number), pc_number),
				status = VALUES(status),
				remarks = CASE 
					WHEN VALUES(time_in) IS NOT NULL AND (remarks = 'Not yet logged in' OR remarks IS NULL OR remarks = '') THEN NULL
					WHEN VALUES(time_in) IS NOT NULL THEN remarks
					WHEN VALUES(remarks) IS NOT NULL AND VALUES(remarks) != '' THEN VALUES(remarks)
					WHEN remarks IS NULL OR remarks = '' THEN VALUES(remarks)
					ELSE remarks
				END,
				updated_at = CURRENT_TIMESTAMP
		`
		_, err = a.db.Exec(insertQuery, classID, student.StudentUserID, date,
			nullString(timeInStr), nullString(timeOutStr), nullString(pcNumberStr), status, nullString(remarksStr))
		if err != nil {
			log.Printf("⚠ Failed to create attendance for student %d: %v", student.StudentUserID, err)
			continue
		}
	}

	log.Printf("✓ Attendance generated from logs for class %d on %s", classID, date)
	return nil
}

// parseScheduleStartTime parses a schedule string and returns the start time
// Schedule format examples: "MWF 1:00-2:00 PM", "TTh 10:00-11:30 AM", "1:00-2:00 PM", "MWF 7:30 AM-8:30 AM"
func parseScheduleStartTime(schedule string) (time.Time, error) {
	// First try pattern with AM/PM after each time (e.g., "7:30 AM-8:30 AM")
	timePattern1 := regexp.MustCompile(`(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)`)
	matches := timePattern1.FindStringSubmatch(schedule)
	
	if len(matches) == 7 {
		// 12-hour format with AM/PM after each time
		startHour, _ := strconv.Atoi(matches[1])
		startMin, _ := strconv.Atoi(matches[2])
		startPeriod := matches[3]

		// Convert to 24-hour format
		if startPeriod == "PM" && startHour != 12 {
			startHour += 12
		}
		if startPeriod == "AM" && startHour == 12 {
			startHour = 0
		}

		return time.Date(0, 1, 1, startHour, startMin, 0, 0, time.UTC), nil
	}

	// Try pattern with AM/PM at the end (e.g., "1:00-2:00 PM" or "10:00-11:30 AM")
	timePattern2 := regexp.MustCompile(`(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)`)
	matches = timePattern2.FindStringSubmatch(schedule)
	
	if len(matches) == 6 {
		// 12-hour format with AM/PM at the end
		startHour, _ := strconv.Atoi(matches[1])
		startMin, _ := strconv.Atoi(matches[2])
		period := matches[5]

		// Convert to 24-hour format
		if period == "PM" && startHour != 12 {
			startHour += 12
		}
		if period == "AM" && startHour == 12 {
			startHour = 0
		}

		return time.Date(0, 1, 1, startHour, startMin, 0, 0, time.UTC), nil
	}

	// Try simpler pattern without AM/PM (24-hour format)
	timePattern3 := regexp.MustCompile(`(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})`)
	matches = timePattern3.FindStringSubmatch(schedule)
	if len(matches) == 5 {
		startHour, _ := strconv.Atoi(matches[1])
		startMin, _ := strconv.Atoi(matches[2])
		return time.Date(0, 1, 1, startHour, startMin, 0, 0, time.UTC), nil
	}

	return time.Time{}, fmt.Errorf("could not parse schedule time from: %s", schedule)
}

// ==============================================================================
// STUDENT DASHBOARD
// ==============================================================================

// StudentDashboard represents student dashboard data
type StudentDashboard struct {
	Attendance []Attendance `json:"attendance"`
	TodayLog   *Attendance  `json:"today_log"`
}

// GetStudentDashboard returns student dashboard data
func (a *App) GetStudentDashboard(userID int) (StudentDashboard, error) {
	var dashboard StudentDashboard

	if a.db == nil {
		return dashboard, fmt.Errorf("database not connected")
	}

	// Get all attendance for this student
	query := `
		SELECT 
			a.class_id, 
			a.student_user_id,
			a.date, 
			a.time_in, 
			a.time_out, 
			a.status 
		FROM attendance a
		WHERE a.student_user_id = ? 
		ORDER BY a.date DESC 
		LIMIT 100`
	rows, err := a.db.Query(query, userID)
	if err != nil {
		return dashboard, err
	}
	defer rows.Close()

	for rows.Next() {
		var att Attendance
		var timeIn, timeOut sql.NullString
		err := rows.Scan(&att.ClassID, &att.StudentUserID, &att.Date, &timeIn, &timeOut, &att.Status)
		if err != nil {
			continue
		}

		if timeIn.Valid {
			att.TimeIn = &timeIn.String
		}
		if timeOut.Valid {
			att.TimeOut = &timeOut.String
		}

		dashboard.Attendance = append(dashboard.Attendance, att)

		// Check if this is today's log
		if att.Date == time.Now().Format("2006-01-02") && dashboard.TodayLog == nil {
			dashboard.TodayLog = &att
		}
	}

	return dashboard, nil
}

// ==============================================================================
// WORKING STUDENT DASHBOARD
// ==============================================================================

// WorkingStudentDashboard represents working student dashboard data
type WorkingStudentDashboard struct {
	StudentsRegistered int `json:"students_registered"`
	ClasslistsCreated  int `json:"classlists_created"`
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

	return dashboard, nil
}

// ==============================================================================
// USER PROFILE MANAGEMENT
// ==============================================================================

// UpdateUserPhoto updates a user's profile photo
func (a *App) UpdateUserPhoto(userID int, userRole, photoURL string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
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
		query = `UPDATE students SET profile_photo = ? WHERE user_id = ? AND is_working_student = TRUE`
	default:
		return fmt.Errorf("invalid user role")
	}

	_, err := a.db.Exec(query, photoURL, userID)
	return err
}

// ChangePassword changes a user's password
func (a *App) ChangePassword(username, oldPassword, newPassword string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Verify old password
	var currentPassword string
	query := `SELECT password FROM users WHERE username = ?`
	err := a.db.QueryRow(query, username).Scan(&currentPassword)
	if err != nil {
		return fmt.Errorf("user not found")
	}

	// Simple password check (in production, use proper password hashing)
	if currentPassword != oldPassword {
		return fmt.Errorf("incorrect old password")
	}

	// Update password
	query = `UPDATE users SET password = ? WHERE username = ?`
	_, err = a.db.Exec(query, newPassword, username)
	return err
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

// nullInt converts 0 or negative values to sql.NullInt64
func nullInt(i int) sql.NullInt64 {
	if i <= 0 {
		return sql.NullInt64{Valid: false}
	}
	return sql.NullInt64{Int64: int64(i), Valid: true}
}
