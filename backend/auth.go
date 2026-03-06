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
	var updatedAt sql.NullTime
	var storedPassword string

	query := `SELECT id, username, password, user_type, account_status, is_active, created_at, updated_at FROM users WHERE username = ?`
	err := a.db.QueryRow(query, username).Scan(&user.ID, &user.Name, &storedPassword, &user.Role, &accountStatus, &isActive, &createdAt, &updatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("LOGIN ERROR: User '%s' not found", username)
			return nil, fmt.Errorf("invalid credentials")
		}
		log.Printf("LOGIN ERROR: Database query failed for user '%s': %v", username, err)
		return nil, err
	}

	// Support both hashed (bcrypt) and legacy plaintext passwords.
	if strings.HasPrefix(storedPassword, "$2a$") || strings.HasPrefix(storedPassword, "$2b$") || strings.HasPrefix(storedPassword, "$2y$") {
		if err := bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(password)); err != nil {
			return nil, fmt.Errorf("invalid credentials")
		}
	} else {
		// Legacy plaintext comparison; on success, upgrade to bcrypt hash.
		if storedPassword != password {
			return nil, fmt.Errorf("invalid credentials")
		}
		hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err == nil {
			if _, err := a.db.Exec(`UPDATE users SET password = ? WHERE id = ?`, string(hashed), user.ID); err != nil {
				log.Printf("Failed to upgrade password hash for user %d: %v", user.ID, err)
			}
		}
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

	// Handle deactivated accounts with 30-day retention window
	// During this period, login will reactivate the account; after 30 days it is deleted.
	if accountStatus == "suspended" {
		// Use updated_at as the deactivation timestamp; fall back to created_at if missing
		lastChange := createdAt
		if updatedAt.Valid {
			lastChange = updatedAt.Time
		}

		retentionDeadline := lastChange.AddDate(0, 0, 30)
		now := time.Now()

		if now.After(retentionDeadline) {
			if err := a.DeleteUser(user.ID); err != nil {
				log.Printf("Failed to auto-delete deactivated account %d after 30 days: %v", user.ID, err)
				return nil, fmt.Errorf("this account was deactivated more than 30 days ago and could not be removed automatically. Please contact your administrator.")
			}
			return nil, fmt.Errorf("this account was deactivated more than 30 days ago and has been permanently removed.")
		}

		// Within 30 days: reactivate the account on successful login
		if _, err := a.db.Exec(`
			UPDATE users
			SET account_status = 'active', is_active = 1, updated_at = GETDATE()
			WHERE id = ? AND account_status = 'suspended'
		`, user.ID); err != nil {
			log.Printf("Failed to reactivate deactivated account %d on login: %v", user.ID, err)
			return nil, fmt.Errorf("failed to reactivate your account. Please contact your administrator.")
		}

		accountStatus = "active"
		isActive = true
	}

	// Check account status
	statusErrors := map[string]string{
		"pending":   "account pending approval - please wait for working student verification",
		"rejected":  "account registration was rejected - please contact administrator",
		"suspended": "account suspended - please contact administrator",
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

// RecordTimeoutLogout records logout time for timed-out sessions
func (a *App) RecordTimeoutLogout(userID int) error {
	return a.Logout(userID)
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

	// Support both hashed and legacy plaintext for the existing password.
	if strings.HasPrefix(storedPassword, "$2a$") || strings.HasPrefix(storedPassword, "$2b$") || strings.HasPrefix(storedPassword, "$2y$") {
		if err := bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(oldPassword)); err != nil {
			return fmt.Errorf("current password is incorrect")
		}
	} else {
		if storedPassword != oldPassword {
			return fmt.Errorf("current password is incorrect")
		}
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
