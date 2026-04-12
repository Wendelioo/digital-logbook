package backend

import (
	"database/sql"
	"fmt"
	"log"
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
	var createdAt time.Time
	var storedPassword string

	query := `SELECT id, username, password, user_type, account_status, created_at FROM users WHERE username = ?`
	err := a.db.QueryRow(query, username).Scan(&user.ID, &user.Name, &storedPassword, &user.Role, &accountStatus, &createdAt)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("LOGIN ERROR: User '%s' not found", username)
			return nil, fmt.Errorf("invalid credentials")
		}
		log.Printf("LOGIN ERROR: Database query failed for user '%s': %v", username, err)
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(password)); err != nil {
		log.Printf("LOGIN ERROR: Password verification failed for user '%s'", username)
		return nil, fmt.Errorf("invalid credentials")
	}

	// Enforce 4-year validity for student accounts (including working students)
	if user.Role == "student" || user.Role == "working_student" {
		expiryDate := createdAt.AddDate(4, 0, 0)
		if time.Now().After(expiryDate) {
			if err := a.deleteUserByID(user.ID); err != nil {
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

	user.Created = formatTime(createdAt)
	// Do not expose password hash or plaintext to the frontend
	user.Password = ""

	// Load role-specific profile
	if err := a.loadUserProfile(&user); err != nil {
		log.Printf("Failed to load user profile: %v", err)
	}

	// Use configured station identity instead of machine hostname.
	stationLabel := a.currentStationLabel()

	// End any still-open sessions for this user (e.g. previous PC shutdown without logout).
	// Otherwise the old row stays logout_time NULL forever because the new login refreshes
	// the same user heartbeat and closeStaleSessions will not touch the orphaned row.
	if _, err := a.db.Exec(`
		UPDATE log_entries
		SET logout_time = NOW()
		WHERE user_id = ? AND logout_time IS NULL
	`, user.ID); err != nil {
		log.Printf("Failed to close prior open login logs for user %d: %v", user.ID, err)
	}

	// Create login log entry
	logID, err := a.createLoginLog(user.ID, stationLabel)
	if err != nil {
		log.Printf("Failed to create login log for user %d (username: %s): %v", user.ID, username, err)
	} else {
		user.LoginLogID = logID
		log.Printf("Login logged - ID: %d, User: %s (ID: %d), Role: %s, PC: %s", logID, username, user.ID, user.Role, stationLabel)
	}

	if err := a.TouchSession(user.ID); err != nil {
		log.Printf("Failed to initialize session heartbeat for user %d: %v", user.ID, err)
	}

	// Attendance is now session-based (teacher opens session, student taps Time In).

	log.Printf("User login successful: %s (role: %s, pc: %s)", username, user.Role, stationLabel)
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

	var latestOpenLogID int
	err := a.db.QueryRow(`
		SELECT id
		FROM log_entries
		WHERE user_id = ? AND logout_time IS NULL
		ORDER BY login_time DESC
		LIMIT 1
	`, userID).Scan(&latestOpenLogID)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("No active login log found to update for user %d", userID)
			if hbErr := a.clearSessionHeartbeat(userID); hbErr != nil {
				log.Printf("Failed to clear session heartbeat for user %d: %v", userID, hbErr)
			}
			return nil
		}
		log.Printf("Failed to find active login log for user %d: %v", userID, err)
		return err
	}

	result, err := a.db.Exec(`UPDATE log_entries SET logout_time = NOW() WHERE id = ?`, latestOpenLogID)
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

	if err := bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(oldPassword)); err != nil {
		log.Printf("ChangePassword: current password verification failed for user %s", username)
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

	trimmedPassword := strings.TrimSpace(newPassword)
	if trimmedPassword == "" {
		return fmt.Errorf("new password is required")
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
	var targetUsername string
	if err := a.db.QueryRow(`SELECT user_type, username FROM users WHERE id = ?`, targetUserID).Scan(&targetRole, &targetUsername); err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("target account not found")
		}
		return fmt.Errorf("failed to validate target user: %w", err)
	}

	isAllowed := false
	switch requesterRole {
	case "admin":
		isAllowed = true
	case "working_student":
		isAllowed = false
	}

	if !isAllowed {
		return fmt.Errorf("you are not allowed to reset this account type")
	}

	isTemporaryIDPassword := trimmedPassword == strings.TrimSpace(targetUsername)
	if !isTemporaryIDPassword {
		if err := ValidateStrongPassword(trimmedPassword); err != nil {
			return err
		}
	}

	// Hash new password before saving
	hashedNew, err := bcrypt.GenerateFromPassword([]byte(trimmedPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}

	if _, err := a.db.Exec(`UPDATE users SET password = ? WHERE id = ?`, string(hashedNew), targetUserID); err != nil {
		log.Printf("Failed password reset requester=%d target=%d: %v", requesterUserID, targetUserID, err)
		return fmt.Errorf("failed to reset password: %w", err)
	}

	if isTemporaryIDPassword {
		log.Printf("Password reset to account ID requester=%d (%s) target=%d (%s)", requesterUserID, requesterRole, targetUserID, targetRole)
	} else {
		log.Printf("Password reset successful requester=%d (%s) target=%d (%s)", requesterUserID, requesterRole, targetUserID, targetRole)
	}
	return nil
}

// ==============================================================================
// PASSWORD RESET IDENTITY HELPERS
// ==============================================================================

func (a *App) resolvePasswordResetRequester(requestedRole, identifier string) (int, string, string, error) {
	identifier = strings.TrimSpace(identifier)
	if identifier == "" {
		return 0, "", "", fmt.Errorf("account identifier is required")
	}

	validateAndReturn := func(query string, args ...interface{}) (int, string, string, error) {
		var requesterUserID int
		var requesterRole string
		var requesterCode string
		if err := a.db.QueryRow(query, args...).Scan(&requesterUserID, &requesterRole, &requesterCode); err != nil {
			if err == sql.ErrNoRows {
				return 0, "", "", fmt.Errorf("requester account not found")
			}
			return 0, "", "", fmt.Errorf("failed to look up requester: %w", err)
		}
		return requesterUserID, requesterRole, requesterCode, nil
	}

	switch requestedRole {
	case "student", "working_student":
		return validateAndReturn(`
			SELECT u.id, u.user_type, COALESCE(st.student_id, u.username)
			FROM users u
			LEFT JOIN students st ON st.id = u.id
			WHERE u.user_type = ?
			  AND u.account_status = 'active'
			  AND (u.username = ? OR st.student_id = ?)
		`, requestedRole, identifier, identifier)
	case "teacher":
		return validateAndReturn(`
			SELECT u.id, u.user_type, COALESCE(t.teacher_id, u.username)
			FROM users u
			LEFT JOIN teachers t ON t.id = u.id
			WHERE u.user_type = 'teacher'
			  AND u.account_status = 'active'
			  AND (u.username = ? OR t.teacher_id = ?)
		`, identifier, identifier)
	case "admin":
		return validateAndReturn(`
			SELECT u.id, u.user_type, COALESCE(ad.admin_id, u.username)
			FROM users u
			LEFT JOIN admins ad ON ad.id = u.id
			WHERE u.user_type = 'admin'
			  AND u.account_status = 'active'
			  AND (u.username = ? OR ad.admin_id = ?)
		`, identifier, identifier)
	default:
		// Fallback for legacy callers that do not pass a role.
		return validateAndReturn(`
			SELECT u.id, u.user_type, COALESCE(st.student_id, u.username)
			FROM users u
			LEFT JOIN students st ON st.id = u.id
			WHERE u.user_type IN ('student','working_student')
			  AND u.account_status = 'active'
			  AND (u.username = ? OR st.student_id = ?)
		`, identifier, identifier)
	}
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
	result, err := a.db.Exec(
		`INSERT INTO log_entries (user_id, pc_number, login_time) VALUES (?, ?, NOW())`,
		userID, pcNumber,
	)
	if err != nil {
		return 0, err
	}
	logID, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	return int(logID), nil
}
