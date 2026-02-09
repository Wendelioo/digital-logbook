package main

import (
	"database/sql"
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"strings"
	"time"
)

// ==============================================================================
// AUTHENTICATION METHODS
// ==============================================================================

// Login authenticates a user
func (a *App) Login(username, password string) (*User, error) {
	if err := a.checkDB(); err != nil {
		log.Printf("❌ LOGIN ERROR: Database not connected")
		return nil, fmt.Errorf("database connection failed - please check database configuration")
	}

	var user User
	var accountStatus string
	var isActive bool
	var createdAt time.Time

	query := `SELECT id, username, password, user_type, account_status, is_active, created_at FROM users WHERE username = ?`
	err := a.db.QueryRow(query, username).Scan(&user.ID, &user.Name, &user.Password, &user.Role, &accountStatus, &isActive, &createdAt)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("❌ LOGIN ERROR: User '%s' not found", username)
			return nil, fmt.Errorf("invalid credentials")
		}
		log.Printf("❌ LOGIN ERROR: Database query failed for user '%s': %v", username, err)
		return nil, err
	}

	if user.Password != password {
		return nil, fmt.Errorf("invalid credentials")
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
		log.Printf("❌ Failed to create login log for user %d (username: %s): %v", user.ID, username, err)
	} else {
		user.LoginLogID = logID
		log.Printf("✅ Login logged - ID: %d, User: %s (ID: %d), Role: %s, PC: %s", logID, username, user.ID, user.Role, hostname)
	}

	// Auto-record attendance for students
	if user.Role == "student" || user.Role == "working_student" {
		go a.autoRecordAttendanceOnLogin(user.ID)
	}

	log.Printf("User login successful: %s (role: %s, pc: %s)", username, user.Role, hostname)
	return &user, nil
}

// Logout logs a user out and records logout time
func (a *App) Logout(userID int) error {
	if err := a.checkDB(); err != nil {
		return err
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

	var storedPassword string
	if err := a.db.QueryRow(`SELECT password FROM users WHERE username = ?`, username).Scan(&storedPassword); err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("user not found")
		}
		return err
	}

	if storedPassword != oldPassword {
		return fmt.Errorf("current password is incorrect")
	}

	if _, err := a.db.Exec(`UPDATE users SET password = ? WHERE username = ?`, newPassword, username); err != nil {
		log.Printf("Failed to update password for %s: %v", username, err)
		return fmt.Errorf("failed to update password: %w", err)
	}

	log.Printf("Password changed successfully for user: %s", username)
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

	// Load profile photo
	var photoPath sql.NullString
	err := a.db.QueryRow(`SELECT photo_path FROM profile_photos WHERE user_id = ?`, user.ID).Scan(&photoPath)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("Warning: Failed to load profile photo for user %d: %v", user.ID, err)
	}
	if photoPath.Valid {
		user.PhotoPath = &photoPath.String
		if photoDataURL, err := a.convertPhotoToDataURL(photoPath.String); err != nil {
			log.Printf("Warning: Failed to convert photo to data URL for user %d: %v", user.ID, err)
		} else {
			user.PhotoURL = &photoDataURL
		}
	}

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

// convertPhotoToDataURL reads a photo file and converts it to a base64 data URL
func (a *App) convertPhotoToDataURL(filePath string) (string, error) {
	fileBytes, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to read photo file: %w", err)
	}

	// Determine MIME type from extension
	mimeType := "image/jpeg"
	lower := strings.ToLower(filePath)
	if strings.HasSuffix(lower, ".png") {
		mimeType = "image/png"
	} else if strings.HasSuffix(lower, ".gif") {
		mimeType = "image/gif"
	}

	return fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(fileBytes)), nil
}
