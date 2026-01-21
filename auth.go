package main

import (
	"database/sql"
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"time"
)

// ==============================================================================
// AUTHENTICATION METHODS
// ==============================================================================

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
	if err := a.loadUserProfile(&user); err != nil {
		log.Printf("Failed to load user profile: %v", err)
	}

	// Get the hostname (PC number) of this device
	hostname, err := os.Hostname()
	if err != nil {
		log.Printf("Failed to get hostname: %v", err)
		hostname = "Unknown"
	}

	// Create a login log entry
	logID, err := a.createLoginLog(user.ID, hostname)
	if err != nil {
		log.Printf("❌ Failed to create login log for user %d (username: %s): %v", user.ID, username, err)
	} else {
		user.LoginLogID = logID
		log.Printf("✅ Login logged successfully - ID: %d, User: %s (ID: %d), Role: %s, PC: %s", logID, username, user.ID, user.Role, hostname)
	}

	// Auto-record attendance for students if they log in during class time
	if user.Role == "student" || user.Role == "working_student" {
		go a.autoRecordAttendanceOnLogin(user.ID, hostname)
	}

	log.Printf("User login successful: %s (role: %s, pc: %s)", username, user.Role, hostname)
	return &user, nil
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

// ChangePassword updates a user's password
func (a *App) ChangePassword(username, oldPassword, newPassword string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Verify old password first
	var storedPassword string
	checkQuery := `SELECT password FROM users WHERE username = ?`
	err := a.db.QueryRow(checkQuery, username).Scan(&storedPassword)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("user not found")
		}
		return err
	}

	if storedPassword != oldPassword {
		return fmt.Errorf("current password is incorrect")
	}

	// Update password
	updateQuery := `UPDATE users SET password = ? WHERE username = ?`
	_, err = a.db.Exec(updateQuery, newPassword, username)
	if err != nil {
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
		detailQuery = `SELECT first_name, middle_name, last_name, gender, employee_number, email, profile_photo FROM admins WHERE user_id = ?`
	case "teacher":
		detailQuery = `SELECT first_name, middle_name, last_name, employee_number, email, contact_number, profile_photo FROM teachers WHERE user_id = ?`
	case "student":
		detailQuery = `SELECT first_name, middle_name, last_name, student_number, email, contact_number, profile_photo FROM students WHERE user_id = ? AND is_working_student = FALSE`
	case "working_student":
		detailQuery = `SELECT first_name, middle_name, last_name, student_number, email, contact_number, profile_photo FROM students WHERE user_id = ? AND is_working_student = TRUE`
	default:
		return fmt.Errorf("unknown user role: %s", user.Role)
	}

	var firstName, middleName, lastName, gender sql.NullString
	var employeeID, studentID sql.NullString
	var email, contactNumber sql.NullString
	var photoBytes []byte // Changed from sql.NullString to handle BLOB

	switch user.Role {
	case "admin":
		err := a.db.QueryRow(detailQuery, user.ID).Scan(&firstName, &middleName, &lastName, &gender, &employeeID, &email, &photoBytes)
		if err != nil {
			return err
		}
		if gender.Valid {
			user.Gender = &gender.String
		}
		if employeeID.Valid {
			user.EmployeeID = &employeeID.String
		}
	case "teacher":
		err := a.db.QueryRow(detailQuery, user.ID).Scan(&firstName, &middleName, &lastName, &employeeID, &email, &contactNumber, &photoBytes)
		if err != nil {
			return err
		}
		if employeeID.Valid {
			user.EmployeeID = &employeeID.String
		}
		if contactNumber.Valid {
			user.ContactNumber = &contactNumber.String
		}
	case "student", "working_student":
		err := a.db.QueryRow(detailQuery, user.ID).Scan(&firstName, &middleName, &lastName, &studentID, &email, &contactNumber, &photoBytes)
		if err != nil {
			return err
		}
		if studentID.Valid {
			user.StudentID = &studentID.String
		}
		if contactNumber.Valid {
			user.ContactNumber = &contactNumber.String
		}
	}

	// Set common fields
	if firstName.Valid {
		user.FirstName = &firstName.String
	}
	if middleName.Valid {
		user.MiddleName = &middleName.String
	}
	if lastName.Valid {
		user.LastName = &lastName.String
	}
	if email.Valid {
		user.Email = &email.String
	}
	// Convert binary BLOB to Base64 data URL for frontend
	if len(photoBytes) > 0 {
		mimeType := detectImageMimeType(photoBytes)
		base64Data := base64.StdEncoding.EncodeToString(photoBytes)
		dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data)
		user.PhotoURL = &dataURL
	}

	return nil
}

// detectImageMimeType detects the MIME type from image binary data
func detectImageMimeType(data []byte) string {
	if len(data) < 4 {
		return "application/octet-stream"
	}

	// JPEG magic number: FF D8 FF
	if data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
		return "image/jpeg"
	}
	// PNG magic number: 89 50 4E 47
	if data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 {
		return "image/png"
	}
	// GIF magic number: 47 49 46
	if data[0] == 0x47 && data[1] == 0x49 && data[2] == 0x46 {
		return "image/gif"
	}
	// WebP magic number: 52 49 46 46 ... 57 45 42 50
	if len(data) >= 12 && data[0] == 0x52 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x46 &&
		data[8] == 0x57 && data[9] == 0x45 && data[10] == 0x42 && data[11] == 0x50 {
		return "image/webp"
	}

	return "image/jpeg" // Default fallback
}

// createLoginLog creates a login log entry and returns the log ID
func (a *App) createLoginLog(userID int, pcNumber string) (int, error) {
	insertLog := `INSERT INTO login_logs (user_id, pc_number, login_time, login_status) 
				  VALUES (?, ?, NOW(), 'success')`
	result, err := a.db.Exec(insertLog, userID, pcNumber)
	if err != nil {
		return 0, err
	}

	logID, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}

	return int(logID), nil
}
