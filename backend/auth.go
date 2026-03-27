package backend

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// ==============================================================================
// AUTHENTICATION METHODS
// ==============================================================================

// Login authenticates a user
func (a *App) Login(username, password string) (*User, error) {
	if err := a.checkDB(); err != nil {
		log.Printf("LOGIN ERROR: Database not connected")
		return nil, fmt.Errorf("database connection failed - please check database configuration")
	}

	if err := ValidateUsername(username); err != nil {
		return nil, err
	}
	if err := ValidatePassword(password); err != nil {
		return nil, err
	}

	var user User
	var accountStatus string
	var isActive bool
	var createdAt time.Time
	var storedPassword string

	query := `SELECT id, username, password, user_type, account_status, is_active, created_at FROM users WHERE username = ?`
	err := a.db.QueryRow(query, username).Scan(&user.ID, &user.Name, &storedPassword, &user.Role, &accountStatus, &isActive, &createdAt)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("LOGIN ERROR: User '%s' not found", username)
			return nil, fmt.Errorf("invalid credentials")
		}
		log.Printf("LOGIN ERROR: Database query failed for user '%s': %v", username, err)
		return nil, err
	}

	// Only support hashed (bcrypt) passwords. Legacy plaintext passwords are no longer allowed.
	if strings.HasPrefix(storedPassword, "$2a$") || strings.HasPrefix(storedPassword, "$2b$") || strings.HasPrefix(storedPassword, "$2y$") {
		if err := bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(password)); err != nil {
			return nil, fmt.Errorf("invalid credentials")
		}
	} else {
		log.Printf("LOGIN ERROR: User '%s' has unsupported legacy password format", username)
		return nil, fmt.Errorf("invalid credentials")
	}

	// Enforce 4-year validity for student accounts (including working students)
	if user.Role == "student" || user.Role == "working_student" {
		expiryDate := createdAt.AddDate(4, 0, 0)
		if time.Now().After(expiryDate) {
			if err := a.DeleteUser(user.ID); err != nil {
				log.Printf("Failed to auto-delete expired student account %d: %v", user.ID, err)
				return nil, fmt.Errorf("student account has expired and could not be removed automatically. Please contact your administrator.")
			}
			return nil, fmt.Errorf("student account has expired after 4 years and has been removed. Please register a new account.")
		}
	}

	// Check account status
	statusErrors := map[string]string{
		"pending":     "account pending approval - please wait for working student verification",
		"archived":    "account archived - please contact administrator",
		"rejected":    "account registration was rejected - please contact administrator",
		"deactivated": "account deactivated - please contact administrator",
		"deleted":     "account deleted - please contact administrator",
	}
	if msg, found := statusErrors[accountStatus]; found {
		return nil, fmt.Errorf(msg)
	}
	if !isActive {
		return nil, fmt.Errorf("account is inactive - please contact administrator")
	}

	user.Created = formatTime(createdAt)
	// Do not expose password hash or plaintext to the frontend
	user.Password = ""

	// Load role-specific profile
	if err := a.loadUserProfile(&user); err != nil {
		log.Printf("Failed to load user profile: %v", err)
	}

	// Get hostname for PC tracking
	hostname, err := os.Hostname()
	if err != nil {
		log.Printf("Failed to get hostname: %v", err)
		hostname = "Unknown"
	}

	// End any still-open sessions for this user (e.g. previous PC shutdown without logout).
	// Otherwise the old row stays logout_time NULL forever because the new login refreshes
	// the same user heartbeat and closeStaleSessions will not touch the orphaned row.
	if _, err := a.db.Exec(`
		UPDATE log_entries
		SET logout_time = GETDATE()
		WHERE user_id = ? AND logout_time IS NULL
	`, user.ID); err != nil {
		log.Printf("Failed to close prior open login logs for user %d: %v", user.ID, err)
	}

	// Create login log entry
	logID, err := a.createLoginLog(user.ID, hostname)
	if err != nil {
		log.Printf("Failed to create login log for user %d (username: %s): %v", user.ID, username, err)
	} else {
		user.LoginLogID = logID
		log.Printf("Login logged - ID: %d, User: %s (ID: %d), Role: %s, PC: %s", logID, username, user.ID, user.Role, hostname)
	}

	if err := a.TouchSession(user.ID); err != nil {
		log.Printf("Failed to initialize session heartbeat for user %d: %v", user.ID, err)
	}

	// Attendance is now session-based (teacher opens session, student taps Time In).

	log.Printf("User login successful: %s (role: %s, pc: %s)", username, user.Role, hostname)
	return &user, nil
}

// Logout logs a user out and records logout time
func (a *App) Logout(userID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	if err := a.closeStaleSessions(); err != nil {
		log.Printf("Failed to close stale sessions before logout: %v", err)
	}

	query := `UPDATE log_entries 
			  SET logout_time = GETDATE()
			  WHERE id = (
				  SELECT TOP 1 id FROM log_entries 
				  WHERE user_id = ? AND logout_time IS NULL 
				  ORDER BY login_time DESC
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
	} else {
		log.Printf("User logout successful: user_id=%d (rows affected: %d)", userID, rowsAffected)
	}

	if err := a.clearSessionHeartbeat(userID); err != nil {
		log.Printf("Failed to clear session heartbeat for user %d: %v", userID, err)
	}

	return nil
}

// ChangePassword updates a user's password
func (a *App) ChangePassword(username, oldPassword, newPassword string) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := ValidateUsername(username); err != nil {
		return err
	}
	if err := ValidatePassword(oldPassword); err != nil {
		return err
	}
	if err := ValidateStrongPassword(newPassword); err != nil {
		return err
	}

	var storedPassword string
	if err := a.db.QueryRow(`SELECT password FROM users WHERE username = ?`, username).Scan(&storedPassword); err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("user not found")
		}
		return err
	}

	// Only support hashed (bcrypt) passwords for the existing password.
	if strings.HasPrefix(storedPassword, "$2a$") || strings.HasPrefix(storedPassword, "$2b$") || strings.HasPrefix(storedPassword, "$2y$") {
		if err := bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(oldPassword)); err != nil {
			return fmt.Errorf("current password is incorrect")
		}
	} else {
		log.Printf("ChangePassword: user %s has unsupported legacy password format", username)
		return fmt.Errorf("current password is incorrect")
	}

	// Hash new password before saving
	hashedNew, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}

	if _, err := a.db.Exec(`UPDATE users SET password = ? WHERE username = ?`, string(hashedNew), username); err != nil {
		log.Printf("Failed to update password for %s: %v", username, err)
		return fmt.Errorf("failed to update password: %w", err)
	}

	log.Printf("Password changed successfully for user: %s", username)
	return nil
}

// ResetPasswordByRole allows privileged users to reset another user's password.
// Policy:
// - admin can reset student, working_student, teacher passwords
// - working_student can reset student passwords only
// - admin passwords are excluded from in-app reset and require manual recovery
func (a *App) ResetPasswordByRole(requesterUserID, targetUserID int, newPassword string) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := ValidatePositiveID(requesterUserID, "requester user ID"); err != nil {
		return err
	}
	if err := ValidatePositiveID(targetUserID, "target user ID"); err != nil {
		return err
	}
	if err := ValidateStrongPassword(newPassword); err != nil {
		return err
	}

	if requesterUserID == targetUserID {
		return fmt.Errorf("use change password for your own account")
	}

	var requesterRole string
	if err := a.db.QueryRow(`SELECT user_type FROM users WHERE id = ?`, requesterUserID).Scan(&requesterRole); err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("requester account not found")
		}
		return fmt.Errorf("failed to validate requester: %w", err)
	}

	var targetRole string
	if err := a.db.QueryRow(`SELECT user_type FROM users WHERE id = ?`, targetUserID).Scan(&targetRole); err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("target account not found")
		}
		return fmt.Errorf("failed to validate target user: %w", err)
	}

	if targetRole == "admin" {
		return fmt.Errorf("admin password reset requires manual recovery")
	}

	isAllowed := false
	switch requesterRole {
	case "admin":
		isAllowed = targetRole == "student" || targetRole == "working_student" || targetRole == "teacher"
	case "working_student":
		isAllowed = false
	}

	if !isAllowed {
		return fmt.Errorf("you are not allowed to reset this account type")
	}

	// Hash new password before saving
	hashedNew, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}

	if _, err := a.db.Exec(`UPDATE users SET password = ? WHERE id = ?`, string(hashedNew), targetUserID); err != nil {
		log.Printf("Failed password reset requester=%d target=%d: %v", requesterUserID, targetUserID, err)
		return fmt.Errorf("failed to reset password: %w", err)
	}

	log.Printf("Password reset successful requester=%d (%s) target=%d (%s)", requesterUserID, requesterRole, targetUserID, targetRole)
	return nil
}

// ==============================================================================
// PASSWORD RESET REQUEST METHODS
// ==============================================================================

// TeacherOption is returned to the frontend so the student can choose a teacher.
type TeacherOption struct {
	TeacherUserID int    `json:"teacher_user_id"`
	FullName      string `json:"full_name"`
	SubjectCode   string `json:"subject_code"`
	SubjectName   string `json:"subject_name"`
}

// PasswordResetRequest is returned to the teacher dashboard.
type PasswordResetRequest struct {
	ID            int    `json:"id"`
	StudentUserID int    `json:"student_user_id"`
	StudentName   string `json:"student_name"`
	StudentCode   string `json:"student_code"`
	SubjectCode   string `json:"subject_code"`
	SubjectName   string `json:"subject_name"`
	Status        string `json:"status"`
	RequestedAt   string `json:"requested_at"`
	ResolvedAt    string `json:"resolved_at"`
}

// GetStudentTeachers returns all teachers belonging to a student's active classes.
// Identifies the student by either users.username or students.student_id (institutional ID).
func (a *App) GetStudentTeachers(studentCode string) ([]TeacherOption, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}
	if strings.TrimSpace(studentCode) == "" {
		return nil, fmt.Errorf("student ID is required")
	}
	code := strings.TrimSpace(studentCode)

	// One row per teacher (same teacher may handle many classes); show teacher name only
	rows, err := a.db.Query(`
		SELECT u.id,
		       COALESCE(t.last_name + ', ' + t.first_name, u.username) AS full_name,
		       '' AS subject_code,
		       '' AS subject_name
		FROM users u
		LEFT JOIN teachers t ON t.id = u.id
		JOIN classes c ON c.teacher_id = u.id
		JOIN classlist cl ON cl.class_id = c.class_id
		JOIN users su ON su.id = cl.student_id
		LEFT JOIN students st ON st.id = su.id
		WHERE su.user_type IN ('student','working_student')
		  AND (su.username = ? OR st.student_id = ?)
		  AND c.is_active = 1
		  AND COALESCE(c.is_archived, 0) = 0
		  AND cl.status NOT IN ('dropped', 'archived')
		GROUP BY u.id, t.last_name, t.first_name, u.username
	`, code, code)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch teachers: %w", err)
	}
	defer rows.Close()

	var options []TeacherOption
	for rows.Next() {
		var t TeacherOption
		if err := rows.Scan(&t.TeacherUserID, &t.FullName, &t.SubjectCode, &t.SubjectName); err != nil {
			continue
		}
		options = append(options, t)
	}
	return options, nil
}

// RequestPasswordReset submits a password reset request on behalf of a student.
// The new password is hashed immediately; the plaintext is never persisted.
func (a *App) RequestPasswordReset(studentCode string, teacherUserID int, newPassword string) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if strings.TrimSpace(studentCode) == "" {
		return fmt.Errorf("student ID is required")
	}
	if err := ValidatePositiveID(teacherUserID, "teacher ID"); err != nil {
		return err
	}
	if err := ValidateStrongPassword(newPassword); err != nil {
		return err
	}

	// Resolve student by username or institutional student_id (students.student_id)
	code := strings.TrimSpace(studentCode)
	var studentUserID int
	if err := a.db.QueryRow(`
		SELECT u.id FROM users u
		LEFT JOIN students st ON st.id = u.id
		WHERE u.user_type IN ('student','working_student')
		  AND (u.username = ? OR st.student_id = ?)
	`, code, code).Scan(&studentUserID); err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("student account not found")
		}
		return fmt.Errorf("failed to look up student: %w", err)
	}

	// Verify the teacher actually teaches this student
	var count int
	if err := a.db.QueryRow(`
		SELECT COUNT(*) FROM classes c
		JOIN classlist cl ON cl.class_id = c.class_id
		WHERE c.teacher_id = ?
		  AND cl.student_id = ?
		  AND c.is_active = 1
		  AND COALESCE(c.is_archived, 0) = 0
	`, teacherUserID, studentUserID).Scan(&count); err != nil {
		return fmt.Errorf("failed to verify teacher-student relationship: %w", err)
	}
	if count == 0 {
		return fmt.Errorf("selected teacher does not have an active class with this student")
	}

	// Cancel any existing pending request to this teacher before inserting a new one
	if _, err := a.db.Exec(`
		DELETE FROM password_reset_requests
		WHERE student_user_id = ? AND teacher_user_id = ? AND status = 'pending'
	`, studentUserID, teacherUserID); err != nil {
		log.Printf("Failed to clear old pending reset request for student=%d teacher=%d: %v", studentUserID, teacherUserID, err)
	}

	// Hash the new password now — teacher never sees or stores a plaintext password
	hashed, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to process password: %w", err)
	}

	if _, err := a.db.Exec(`
		INSERT INTO password_reset_requests (student_user_id, teacher_user_id, new_password_hash, status, requested_at)
		VALUES (?, ?, ?, 'pending', GETDATE())
	`, studentUserID, teacherUserID, string(hashed)); err != nil {
		log.Printf("Failed to insert password reset request student=%d teacher=%d: %v", studentUserID, teacherUserID, err)
		return fmt.Errorf("failed to submit reset request: %w", err)
	}

	log.Printf("Password reset request submitted: student=%d teacher=%d", studentUserID, teacherUserID)

	// Notify the teacher about the new password reset request
	go a.createNotification(teacherUserID, "password_reset",
		"Password Reset Request",
		fmt.Sprintf("Student %s submitted a password reset request.", code),
		"info", notifRef("password_reset"), nil)

	return nil
}

// GetPendingPasswordResets returns all pending reset requests directed at a teacher.
func (a *App) GetPendingPasswordResets(teacherUserID int) ([]PasswordResetRequest, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}
	if err := ValidatePositiveID(teacherUserID, "teacher ID"); err != nil {
		return nil, err
	}

	rows, err := a.db.Query(`
		SELECT r.id, r.student_user_id, u.username,
		       COALESCE(s.first_name + ' ' + s.last_name, u.username) AS student_name,
		       c.subject_code, COALESCE(c.descriptive_title, sub.description, '') AS subject_name,
		       r.status,
		       CONVERT(VARCHAR(19), r.requested_at, 120) AS requested_at
		FROM password_reset_requests r
		JOIN users u ON u.id = r.student_user_id
		LEFT JOIN students s ON s.id = r.student_user_id
		JOIN classes c ON c.teacher_id = r.teacher_user_id
		JOIN classlist cl ON cl.class_id = c.class_id AND cl.student_id = r.student_user_id
		LEFT JOIN subjects sub ON sub.subject_code = c.subject_code
		WHERE r.teacher_user_id = ?
		  AND r.status = 'pending'
		ORDER BY r.requested_at DESC
	`, teacherUserID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch reset requests: %w", err)
	}
	defer rows.Close()

	var requests []PasswordResetRequest
	for rows.Next() {
		var req PasswordResetRequest
		if err := rows.Scan(&req.ID, &req.StudentUserID, &req.StudentCode, &req.StudentName,
			&req.SubjectCode, &req.SubjectName, &req.Status, &req.RequestedAt); err != nil {
			continue
		}
		requests = append(requests, req)
	}
	return requests, nil
}

// ApprovePasswordReset approves a student's password reset request.
// The teacher only confirms identity — the hashed password was set by the student.
func (a *App) ApprovePasswordReset(teacherUserID, requestID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := ValidatePositiveID(teacherUserID, "teacher ID"); err != nil {
		return err
	}
	if err := ValidatePositiveID(requestID, "request ID"); err != nil {
		return err
	}

	var studentUserID int
	var passwordHash string
	var status string
	if err := a.db.QueryRow(`
		SELECT student_user_id, new_password_hash, status
		FROM password_reset_requests
		WHERE id = ? AND teacher_user_id = ?
	`, requestID, teacherUserID).Scan(&studentUserID, &passwordHash, &status); err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("reset request not found or not assigned to you")
		}
		return fmt.Errorf("failed to fetch reset request: %w", err)
	}
	if status != "pending" {
		return fmt.Errorf("request has already been %s", status)
	}

	// Apply the pre-hashed password to the student's account
	if _, err := a.db.Exec(`UPDATE users SET password = ? WHERE id = ?`, passwordHash, studentUserID); err != nil {
		log.Printf("Failed to apply password reset for student=%d: %v", studentUserID, err)
		return fmt.Errorf("failed to apply password reset: %w", err)
	}

	// Mark request as approved
	if _, err := a.db.Exec(`
		UPDATE password_reset_requests
		SET status = 'approved', resolved_at = GETDATE()
		WHERE id = ?
	`, requestID); err != nil {
		log.Printf("Failed to mark reset request %d as approved: %v", requestID, err)
	}

	log.Printf("Password reset approved: request=%d student=%d teacher=%d", requestID, studentUserID, teacherUserID)

	// Notify the student that their password reset was approved
	go a.createNotification(studentUserID, "password_reset",
		"Password Reset Approved",
		"Your password reset request has been approved by your teacher.",
		"success", notifRef("password_reset"), notifRefID(requestID))

	return nil
}

// RejectPasswordReset rejects a student's password reset request.
func (a *App) RejectPasswordReset(teacherUserID, requestID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := ValidatePositiveID(teacherUserID, "teacher ID"); err != nil {
		return err
	}
	if err := ValidatePositiveID(requestID, "request ID"); err != nil {
		return err
	}

	// Look up the student for notification
	var studentUserID int
	_ = a.db.QueryRow(`SELECT student_user_id FROM password_reset_requests WHERE id = ? AND teacher_user_id = ?`, requestID, teacherUserID).Scan(&studentUserID)

	result, err := a.db.Exec(`
		UPDATE password_reset_requests
		SET status = 'rejected', resolved_at = GETDATE()
		WHERE id = ? AND teacher_user_id = ? AND status = 'pending'
	`, requestID, teacherUserID)
	if err != nil {
		return fmt.Errorf("failed to reject request: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("request not found, not assigned to you, or already resolved")
	}
	log.Printf("Password reset rejected: request=%d teacher=%d", requestID, teacherUserID)

	// Notify the student that their password reset was rejected
	if studentUserID > 0 {
		go a.createNotification(studentUserID, "password_reset",
			"Password Reset Rejected",
			"Your password reset request has been rejected by your teacher.",
			"warning", notifRef("password_reset"), notifRefID(requestID))
	}

	return nil
}

// GetPasswordResetHistory returns the last 50 resolved (approved/rejected) reset requests for a teacher.
func (a *App) GetPasswordResetHistory(teacherUserID int) ([]PasswordResetRequest, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}
	if err := ValidatePositiveID(teacherUserID, "teacher ID"); err != nil {
		return nil, err
	}

	rows, err := a.db.Query(`
		SELECT TOP 50 r.id, r.student_user_id, u.username,
		       COALESCE(s.first_name + ' ' + s.last_name, u.username) AS student_name,
		       c.subject_code, COALESCE(c.descriptive_title, sub.description, '') AS subject_name,
		       r.status,
		       CONVERT(VARCHAR(19), r.requested_at, 120) AS requested_at,
		       COALESCE(CONVERT(VARCHAR(19), r.resolved_at, 120), '') AS resolved_at
		FROM password_reset_requests r
		JOIN users u ON u.id = r.student_user_id
		LEFT JOIN students s ON s.id = r.student_user_id
		JOIN classes c ON c.teacher_id = r.teacher_user_id
		JOIN classlist cl ON cl.class_id = c.class_id AND cl.student_id = r.student_user_id
		LEFT JOIN subjects sub ON sub.subject_code = c.subject_code
		WHERE r.teacher_user_id = ?
		  AND r.status != 'pending'
		ORDER BY r.resolved_at DESC
	`, teacherUserID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch password reset history: %w", err)
	}
	defer rows.Close()

	var requests []PasswordResetRequest
	for rows.Next() {
		var req PasswordResetRequest
		if err := rows.Scan(&req.ID, &req.StudentUserID, &req.StudentCode, &req.StudentName,
			&req.SubjectCode, &req.SubjectName, &req.Status, &req.RequestedAt, &req.ResolvedAt); err != nil {
			continue
		}
		requests = append(requests, req)
	}
	return requests, nil
}

// ==============================================================================
// HELPER METHODS
// ==============================================================================

// loadUserProfile loads role-specific user profile information
func (a *App) loadUserProfile(user *User) error {
	var detailQuery string
	switch user.Role {
	case "admin":
		detailQuery = `SELECT first_name, middle_name, last_name, admin_id, email FROM admins WHERE id = ?`
	case "teacher":
		detailQuery = `SELECT first_name, middle_name, last_name, teacher_id, email, contact_number FROM teachers WHERE id = ?`
	case "student":
		detailQuery = `SELECT first_name, middle_name, last_name, student_id, email, contact_number FROM students WHERE id = ? AND is_working_student = 0`
	case "working_student":
		detailQuery = `SELECT first_name, middle_name, last_name, student_id, email, contact_number FROM students WHERE id = ? AND is_working_student = 1`
	default:
		return fmt.Errorf("unknown user role: %s", user.Role)
	}

	var firstName, middleName, lastName sql.NullString
	var employeeID, studentID sql.NullString
	var email, contactNumber sql.NullString

	switch user.Role {
	case "admin":
		if err := a.db.QueryRow(detailQuery, user.ID).Scan(&firstName, &middleName, &lastName, &employeeID, &email); err != nil {
			return err
		}
		user.EmployeeID = scanNullString(employeeID)
	case "teacher":
		if err := a.db.QueryRow(detailQuery, user.ID).Scan(&firstName, &middleName, &lastName, &employeeID, &email, &contactNumber); err != nil {
			return err
		}
		user.EmployeeID = scanNullString(employeeID)
		user.ContactNumber = scanNullString(contactNumber)
	case "student", "working_student":
		if err := a.db.QueryRow(detailQuery, user.ID).Scan(&firstName, &middleName, &lastName, &studentID, &email, &contactNumber); err != nil {
			return err
		}
		user.StudentID = scanNullString(studentID)
		user.ContactNumber = scanNullString(contactNumber)
	}

	// Set common fields
	user.FirstName = scanNullString(firstName)
	user.MiddleName = scanNullString(middleName)
	user.LastName = scanNullString(lastName)
	user.Email = scanNullString(email)

	// Load profile photo from database
	a.loadUserPhotoURL(user)

	return nil
}

// createLoginLog creates a login log entry and returns the log ID
func (a *App) createLoginLog(userID int, pcNumber string) (int, error) {
	var logID int
	err := a.db.QueryRow(
		`INSERT INTO log_entries (user_id, pc_number, login_time) OUTPUT INSERTED.id VALUES (?, ?, GETDATE())`,
		userID, pcNumber,
	).Scan(&logID)
	if err != nil {
		return 0, err
	}
	return logID, nil
}
