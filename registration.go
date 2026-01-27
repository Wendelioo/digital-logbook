package main

import (
	"database/sql"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// ==============================================================================
// STUDENT REGISTRATION SYSTEM
// ==============================================================================

// RegistrationRequest represents a student registration submission
type RegistrationRequest struct {
	StudentID       string `json:"student_id"`
	LastName        string `json:"last_name"`
	FirstName       string `json:"first_name"`
	MiddleName      string `json:"middle_name"`
	ContactNumber   string `json:"contact_number"`
	Email           string `json:"email"`
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirm_password"`
}

// PendingRegistration represents a registration awaiting approval
type PendingRegistration struct {
	UserID        int       `json:"user_id"`
	StudentID     string    `json:"student_id"`
	LastName      string    `json:"last_name"`
	FirstName     string    `json:"first_name"`
	MiddleName    *string   `json:"middle_name"`
	ContactNumber string    `json:"contact_number"`
	Email         string    `json:"email"`
	SubmittedAt   time.Time `json:"submitted_at"`
}

// ApprovalRequest represents an approval/rejection action
type ApprovalRequest struct {
	UserID          int    `json:"user_id"`
	ApprovedBy      int    `json:"approved_by"`
	Action          string `json:"action"` // "approve" or "reject"
	RejectionReason string `json:"rejection_reason,omitempty"`
}

// SubmitRegistration handles student self-registration
func (a *App) SubmitRegistration(req RegistrationRequest) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Validation
	if err := validateRegistration(req); err != nil {
		return err
	}

	// Check if student ID already exists
	var existingID int
	err := a.db.QueryRow("SELECT id FROM users WHERE username = ?", req.StudentID).Scan(&existingID)
	if err == nil {
		return fmt.Errorf("student ID already registered")
	} else if err != sql.ErrNoRows {
		return fmt.Errorf("database error: %v", err)
	}

	// Check if email already exists
	var existingEmail int
	err = a.db.QueryRow("SELECT user_id FROM students WHERE email = ?", req.Email).Scan(&existingEmail)
	if err == nil {
		return fmt.Errorf("email already registered")
	} else if err != sql.ErrNoRows {
		return fmt.Errorf("database error: %v", err)
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("password hashing failed: %v", err)
	}

	// Start transaction
	tx, err := a.db.Begin()
	if err != nil {
		return fmt.Errorf("transaction failed: %v", err)
	}
	defer tx.Rollback()

	// Insert into users table with pending status
	result, err := tx.Exec(`
		INSERT INTO users (username, password, user_type, account_status, is_active)
		VALUES (?, ?, 'student', 'pending', FALSE)
	`, req.StudentID, string(hashedPassword))
	if err != nil {
		return fmt.Errorf("failed to create user: %v", err)
	}

	userID, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get user ID: %v", err)
	}

	// Insert into students table
	_, err = tx.Exec(`
		INSERT INTO students (user_id, student_number, first_name, middle_name, last_name, email, contact_number, is_working_student)
		VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)
	`, userID, req.StudentID, req.FirstName, nullString(req.MiddleName), req.LastName, req.Email, req.ContactNumber)
	if err != nil {
		return fmt.Errorf("failed to create student profile: %v", err)
	}

	// Create pending approval record
	_, err = tx.Exec(`
		INSERT INTO registration_approvals (user_id, status)
		VALUES (?, 'pending')
	`, userID)
	if err != nil {
		return fmt.Errorf("failed to create approval record: %v", err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %v", err)
	}

	log.Printf("New registration submitted: Student ID %s (User ID: %d)", req.StudentID, userID)
	return nil
}

// GetPendingRegistrations returns all registrations awaiting approval
func (a *App) GetPendingRegistrations() ([]PendingRegistration, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			u.id,
			s.student_number,
			s.last_name,
			s.first_name,
			s.middle_name,
			s.contact_number,
			s.email,
			u.created_at
		FROM users u
		JOIN students s ON u.id = s.user_id
		WHERE u.account_status = 'pending'
		AND u.user_type = 'student'
		ORDER BY u.created_at ASC
	`

	rows, err := a.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch pending registrations: %v", err)
	}
	defer rows.Close()

	var registrations []PendingRegistration
	for rows.Next() {
		var reg PendingRegistration
		err := rows.Scan(
			&reg.UserID,
			&reg.StudentID,
			&reg.LastName,
			&reg.FirstName,
			&reg.MiddleName,
			&reg.ContactNumber,
			&reg.Email,
			&reg.SubmittedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan registration: %v", err)
		}
		registrations = append(registrations, reg)
	}

	return registrations, nil
}

// ProcessRegistration approves or rejects a student registration
func (a *App) ProcessRegistration(req ApprovalRequest) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Validate action
	if req.Action != "approve" && req.Action != "reject" {
		return fmt.Errorf("invalid action: must be 'approve' or 'reject'")
	}

	if req.Action == "reject" && strings.TrimSpace(req.RejectionReason) == "" {
		return fmt.Errorf("rejection reason is required")
	}

	// Start transaction
	tx, err := a.db.Begin()
	if err != nil {
		return fmt.Errorf("transaction failed: %v", err)
	}
	defer tx.Rollback()

	// Update user status
	var newStatus string
	var isActive bool
	if req.Action == "approve" {
		newStatus = "active"
		isActive = true
	} else {
		newStatus = "rejected"
		isActive = false
	}

	_, err = tx.Exec(`
		UPDATE users 
		SET account_status = ?, is_active = ?
		WHERE id = ? AND account_status = 'pending'
	`, newStatus, isActive, req.UserID)
	if err != nil {
		return fmt.Errorf("failed to update user status: %v", err)
	}

	// Update approval record
	var rejectionReason interface{}
	if req.Action == "reject" {
		rejectionReason = req.RejectionReason
	} else {
		rejectionReason = nil
	}

	_, err = tx.Exec(`
		UPDATE registration_approvals
		SET status = ?, approved_by_user_id = ?, rejection_reason = ?, processed_at = NOW()
		WHERE user_id = ? AND status = 'pending'
	`, req.Action+"d", req.ApprovedBy, rejectionReason, req.UserID)
	if err != nil {
		return fmt.Errorf("failed to update approval record: %v", err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %v", err)
	}

	log.Printf("Registration %s: User ID %d by User ID %d", req.Action+"d", req.UserID, req.ApprovedBy)
	return nil
}

// ==============================================================================
// VALIDATION HELPERS
// ==============================================================================

func validateRegistration(req RegistrationRequest) error {
	// Student ID validation
	if strings.TrimSpace(req.StudentID) == "" {
		return fmt.Errorf("student ID is required")
	}
	if len(req.StudentID) < 4 || len(req.StudentID) > 50 {
		return fmt.Errorf("student ID must be between 4 and 50 characters")
	}

	// Name validation
	if strings.TrimSpace(req.FirstName) == "" {
		return fmt.Errorf("first name is required")
	}
	if strings.TrimSpace(req.LastName) == "" {
		return fmt.Errorf("last name is required")
	}

	// Email validation
	if strings.TrimSpace(req.Email) == "" {
		return fmt.Errorf("email is required")
	}
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	if !emailRegex.MatchString(req.Email) {
		return fmt.Errorf("invalid email format")
	}

	// Contact number validation
	if strings.TrimSpace(req.ContactNumber) == "" {
		return fmt.Errorf("contact number is required")
	}
	// Allow Philippine mobile numbers (11 digits starting with 09) or landlines
	phoneRegex := regexp.MustCompile(`^(09\d{9}|\d{7,15})$`)
	cleanedPhone := strings.ReplaceAll(strings.ReplaceAll(req.ContactNumber, "-", ""), " ", "")
	if !phoneRegex.MatchString(cleanedPhone) {
		return fmt.Errorf("invalid contact number format")
	}

	// Password validation
	if strings.TrimSpace(req.Password) == "" {
		return fmt.Errorf("password is required")
	}
	if len(req.Password) < 8 {
		return fmt.Errorf("password must be at least 8 characters long")
	}
	if req.Password != req.ConfirmPassword {
		return fmt.Errorf("passwords do not match")
	}

	return nil
}
