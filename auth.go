package main

import (
	"database/sql"
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
	var accountStatus string
	var isActive bool
	query := `SELECT id, username, password, user_type, account_status, is_active, created_at FROM users WHERE username = ?`

	var createdAt time.Time
	err := a.db.QueryRow(query, username).Scan(&user.ID, &user.Name, &user.Password, &user.Role, &accountStatus, &isActive, &createdAt)
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

	// Check account status
	if accountStatus == "pending" {
		return nil, fmt.Errorf("account pending approval - please wait for working student verification")
	}
	if accountStatus == "rejected" {
		return nil, fmt.Errorf("account registration was rejected - please contact administrator")
	}
	if accountStatus == "suspended" {
		return nil, fmt.Errorf("account suspended - please contact administrator")
	}
	if !isActive {
		return nil, fmt.Errorf("account is inactive - please contact administrator")
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
		go a.autoRecordAttendanceOnLogin(user.ID)
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
		detailQuery = `SELECT first_name, middle_name, last_name, employee_number, email FROM admins WHERE user_id = ?`
	case "teacher":
		detailQuery = `SELECT first_name, middle_name, last_name, employee_number, email, contact_number FROM teachers WHERE user_id = ?`
	case "student":
		detailQuery = `SELECT first_name, middle_name, last_name, student_number, email, contact_number FROM students WHERE user_id = ? AND is_working_student = FALSE`
	case "working_student":
		detailQuery = `SELECT first_name, middle_name, last_name, student_number, email, contact_number FROM students WHERE user_id = ? AND is_working_student = TRUE`
	default:
		return fmt.Errorf("unknown user role: %s", user.Role)
	}

	var firstName, middleName, lastName sql.NullString
	var employeeID, studentID sql.NullString
	var email, contactNumber sql.NullString

	switch user.Role {
	case "admin":
		err := a.db.QueryRow(detailQuery, user.ID).Scan(&firstName, &middleName, &lastName, &employeeID, &email)
		if err != nil {
			return err
		}
		if employeeID.Valid {
			user.EmployeeID = &employeeID.String
		}
	case "teacher":
		err := a.db.QueryRow(detailQuery, user.ID).Scan(&firstName, &middleName, &lastName, &employeeID, &email, &contactNumber)
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
		err := a.db.QueryRow(detailQuery, user.ID).Scan(&firstName, &middleName, &lastName, &studentID, &email, &contactNumber)
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

	// Get profile photo path from profile_photos table (improved from BLOB)
	var photoPath sql.NullString
	photoQuery := `SELECT photo_path FROM profile_photos WHERE user_id = ?`
	err := a.db.QueryRow(photoQuery, user.ID).Scan(&photoPath)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("Warning: Failed to load profile photo for user %d: %v", user.ID, err)
	}
	if photoPath.Valid {
		user.PhotoPath = &photoPath.String
	}

	return nil
}

// createLoginLog creates a login log entry with IP tracking and returns the log ID
func (a *App) createLoginLog(userID int, pcNumber string) (int, error) {
	// Get IP address (for now, set to NULL - can be enhanced with actual IP detection)
	// In a real implementation, you would detect the actual IP address
	insertLog := `INSERT INTO login_logs (user_id, pc_number, ip_address, login_time, login_status) 
				  VALUES (?, ?, NULL, NOW(), 'success')`
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
