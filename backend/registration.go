package backend

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
	DepartmentCode  string `json:"department_code"`
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
	UserID        int     `json:"user_id"`
	StudentID     string  `json:"student_id"`
	LastName      string  `json:"last_name"`
	FirstName     string  `json:"first_name"`
	MiddleName    *string `json:"middle_name"`
	ContactNumber string  `json:"contact_number"`
	Email         string  `json:"email"`
	SubmittedAt   string  `json:"submitted_at"`
}

// ApprovalRequest represents an approval/rejection action
type ApprovalRequest struct {
	UserID          int    `json:"user_id"`
	ApprovedBy      int    `json:"approved_by"`
	Action          string `json:"action"` // "approve" or "reject"
	RejectionReason string `json:"rejection_reason,omitempty"`
}

// RegistrationHistoryEntry is a non-sensitive record for registration history (name and status only)
type RegistrationHistoryEntry struct {
	FirstName   string  `json:"first_name"`
	LastName    string  `json:"last_name"`
	MiddleName  *string `json:"middle_name,omitempty"`
	SubmittedAt string  `json:"submitted_at"`
	ProcessedAt string  `json:"processed_at"`
	Status      string  `json:"status"` // "approved" or "rejected"
}

// SubmitRegistration handles student self-registration
func (a *App) SubmitRegistration(req RegistrationRequest) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	// Validation
	if err := validateRegistration(req); err != nil {
		return err
	}

	normalizedDepartmentCode, err := a.validateActiveDepartmentCode(req.DepartmentCode)
	if err != nil {
		return err
	}
	req.DepartmentCode = normalizedDepartmentCode

	// Check if student ID already exists.
	// If it exists and is rejected, allow re-registration by resetting it to pending.
	var existingID int
	var existingStatus string
	err = a.db.QueryRow("SELECT id, account_status FROM users WHERE username = ?", req.StudentID).Scan(&existingID, &existingStatus)
	isReRegistration := false
	if err == nil {
		switch existingStatus {
		case "pending":
			return fmt.Errorf("this student ID has a pending registration - please wait for working student approval")
		case "rejected":
			isReRegistration = true
		case "active":
			return fmt.Errorf("this student ID is already active - please try logging in instead")
		default:
			return fmt.Errorf("student ID already registered")
		}
	} else if err != sql.ErrNoRows {
		return fmt.Errorf("database error: %v", err)
	}

	// Check if email already exists
	var existingEmailUserID int
	var existingEmailStatus string
	err = a.db.QueryRow(`
		SELECT u.id, u.account_status 
		FROM students s 
		JOIN users u ON s.id = u.id 
		WHERE s.email = ?
	`, req.Email).Scan(&existingEmailUserID, &existingEmailStatus)
	if err == nil {
		// Allow email reuse only when re-registering the same rejected account.
		if !(isReRegistration && existingEmailUserID == existingID) {
			switch existingEmailStatus {
			case "pending":
				return fmt.Errorf("this email has a pending registration - please wait for working student approval")
			case "rejected":
				return fmt.Errorf("this email was previously rejected - use the same student ID to re-register")
			case "active":
				return fmt.Errorf("this email is already registered to an active account")
			default:
				return fmt.Errorf("email already registered")
			}
		}
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

	var userID int64
	if isReRegistration {
		userID = int64(existingID)

		// Reset rejected account to pending and apply the newly submitted password.
		_, err = tx.Exec(`
			UPDATE users
			SET password = ?, account_status = 'pending', is_active = 0, updated_at = GETDATE()
			WHERE id = ? AND account_status = 'rejected'
		`, string(hashedPassword), userID)
		if err != nil {
			return fmt.Errorf("failed to reset rejected user account: %v", err)
		}

		// Refresh student profile details from the new submission.
		_, err = tx.Exec(`
			UPDATE students
			SET student_id = ?, first_name = ?, middle_name = ?, last_name = ?, email = ?, contact_number = ?, department_code = ?, updated_at = GETDATE()
			WHERE id = ?
		`, req.StudentID, req.FirstName, nullString(req.MiddleName), req.LastName, req.Email, req.ContactNumber, req.DepartmentCode, userID)
		if err != nil {
			return fmt.Errorf("failed to update rejected student profile: %v", err)
		}

		// Reopen approval workflow.
		result, err := tx.Exec(`
			UPDATE registration_approvals
			SET status = 'pending', approved_by_user_id = NULL, rejection_reason = NULL, processed_at = NULL, updated_at = GETDATE()
			WHERE user_id = ?
		`, userID)
		if err != nil {
			return fmt.Errorf("failed to reset approval record: %v", err)
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			return fmt.Errorf("failed to verify approval reset: %v", err)
		}
		if rowsAffected == 0 {
			_, err = tx.Exec(`
				INSERT INTO registration_approvals (user_id, status)
				VALUES (?, 'pending')
			`, userID)
			if err != nil {
				return fmt.Errorf("failed to recreate approval record: %v", err)
			}
		}
	} else {
		// Insert into users table with pending status.
		insertUserQuery := `
			INSERT INTO users (username, password, user_type, account_status, is_active)
			OUTPUT INSERTED.id
			VALUES (?, ?, 'student', 'pending', 0)
		`
		err = tx.QueryRow(insertUserQuery, req.StudentID, string(hashedPassword)).Scan(&userID)
		if err != nil {
			return fmt.Errorf("failed to create user: %v", err)
		}

		// Insert into students table.
		_, err = tx.Exec(`
			INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, department_code, is_working_student)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
		`, userID, req.StudentID, req.FirstName, nullString(req.MiddleName), req.LastName, req.Email, req.ContactNumber, req.DepartmentCode)
		if err != nil {
			return fmt.Errorf("failed to create student profile: %v", err)
		}

		// Create pending approval record.
		_, err = tx.Exec(`
			INSERT INTO registration_approvals (user_id, status)
			VALUES (?, 'pending')
		`, userID)
		if err != nil {
			return fmt.Errorf("failed to create approval record: %v", err)
		}
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %v", err)
	}

	if isReRegistration {
		log.Printf("Registration re-submitted: Student ID %s (User ID: %d)", req.StudentID, userID)
	} else {
		log.Printf("New registration submitted: Student ID %s (User ID: %d)", req.StudentID, userID)
	}

	// Notify all working students about new pending registration
	go a.createNotificationForRole("working_student", "registration",
		"New Registration",
		fmt.Sprintf("Student %s submitted a registration request.", req.StudentID),
		"info", notifRef("registration"), notifRefID64(userID))

	return nil
}

// GetPendingRegistrations returns all registrations awaiting approval
func (a *App) GetPendingRegistrations() ([]PendingRegistration, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			u.id,
			s.student_id,
			s.last_name,
			s.first_name,
			s.middle_name,
			s.contact_number,
			s.email,
			u.created_at
		FROM users u
		JOIN students s ON u.id = s.id
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
		var submittedAt time.Time
		err := rows.Scan(
			&reg.UserID,
			&reg.StudentID,
			&reg.LastName,
			&reg.FirstName,
			&reg.MiddleName,
			&reg.ContactNumber,
			&reg.Email,
			&submittedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan registration: %v", err)
		}

		// Format time field as string
		reg.SubmittedAt = submittedAt.Format("2006-01-02 15:04:05")

		registrations = append(registrations, reg)
	}

	return registrations, nil
}

// ProcessRegistration approves or rejects a student registration
func (a *App) ProcessRegistration(req ApprovalRequest) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := ValidatePositiveID(req.UserID, "user ID"); err != nil {
		return err
	}
	if err := ValidatePositiveID(req.ApprovedBy, "approver user ID"); err != nil {
		return err
	}

	// Validate action
	if req.Action != "approve" && req.Action != "reject" {
		return fmt.Errorf("invalid action: must be 'approve' or 'reject'")
	}

	if req.Action == "reject" {
		if strings.TrimSpace(req.RejectionReason) == "" {
			return fmt.Errorf("rejection reason is required")
		}
		req.RejectionReason, _ = ValidateRejectionReason(req.RejectionReason)
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
	approvalStatus := "approved"
	if req.Action == "reject" {
		rejectionReason = req.RejectionReason
		approvalStatus = "rejected"
	} else {
		rejectionReason = nil
	}

	_, err = tx.Exec(`
		UPDATE registration_approvals
		SET status = ?, approved_by_user_id = ?, rejection_reason = ?, processed_at = GETDATE()
		WHERE user_id = ? AND status = 'pending'
	`, approvalStatus, req.ApprovedBy, rejectionReason, req.UserID)
	if err != nil {
		return fmt.Errorf("failed to update approval record: %v", err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %v", err)
	}

	log.Printf("Registration %s: User ID %d by User ID %d", approvalStatus, req.UserID, req.ApprovedBy)

	// Notify the student about their registration result
	if req.Action == "approve" {
		go a.createNotification(req.UserID, "registration",
			"Registration Approved",
			"Your registration has been approved. You can now log in.",
			"success", notifRef("registration"), notifRefID(req.UserID))
	} else {
		go a.createNotification(req.UserID, "registration",
			"Registration Rejected",
			fmt.Sprintf("Your registration was rejected: %s", req.RejectionReason),
			"warning", notifRef("registration"), notifRefID(req.UserID))
	}

	return nil
}

// GetRegistrationHistory returns processed registration records with name and status only (no email, user ID, or student ID).
func (a *App) GetRegistrationHistory() ([]RegistrationHistoryEntry, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			s.first_name,
			s.last_name,
			s.middle_name,
			u.created_at,
			ra.processed_at,
			ra.status
		FROM registration_approvals ra
		INNER JOIN users u ON u.id = ra.user_id
		INNER JOIN students s ON s.id = ra.user_id
		WHERE ra.status IN ('approved', 'rejected')
		ORDER BY ra.processed_at DESC
	`

	rows, err := a.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch registration history: %v", err)
	}
	defer rows.Close()

	var entries []RegistrationHistoryEntry
	for rows.Next() {
		var e RegistrationHistoryEntry
		var submittedAt time.Time
		var processedAt sql.NullTime
		var middleName sql.NullString
		err := rows.Scan(&e.FirstName, &e.LastName, &middleName, &submittedAt, &processedAt, &e.Status)
		if err != nil {
			return nil, fmt.Errorf("failed to scan registration history row: %v", err)
		}
		e.SubmittedAt = submittedAt.Format("2006-01-02 15:04:05")
		if middleName.Valid {
			e.MiddleName = &middleName.String
		}
		if processedAt.Valid {
			e.ProcessedAt = processedAt.Time.Format("2006-01-02 15:04:05")
		}
		entries = append(entries, e)
	}

	return entries, nil
}

// ==============================================================================
// VALIDATION HELPERS
// ==============================================================================

func validateRegistration(req RegistrationRequest) error {
	// Student ID validation (format: YYYY-NNNNN or WS-YYYY-NNN)
	if err := ValidateStudentID(req.StudentID); err != nil {
		return err
	}
	if strings.TrimSpace(req.DepartmentCode) == "" {
		return fmt.Errorf("department is required")
	}

	// Name validation
	if err := ValidateRequiredName(req.FirstName, "first name"); err != nil {
		return err
	}
	if err := ValidateRequiredName(req.LastName, "last name"); err != nil {
		return err
	}
	if req.MiddleName != "" {
		if err := ValidateName(req.MiddleName, "middle name"); err != nil {
			return err
		}
	}

	// Email validation
	if err := ValidateEmail(req.Email); err != nil {
		return err
	}

	// Contact number validation
	if strings.TrimSpace(req.ContactNumber) == "" {
		return fmt.Errorf("contact number is required")
	}
	if err := ValidateContactNumber(req.ContactNumber); err != nil {
		return err
	}
	// Allow Philippine mobile numbers (11 digits starting with 09) or landlines
	phoneRegex := regexp.MustCompile(`^(09\d{9}|\d{7,15})$`)
	cleanedPhone := strings.ReplaceAll(strings.ReplaceAll(req.ContactNumber, "-", ""), " ", "")
	if !phoneRegex.MatchString(cleanedPhone) {
		return fmt.Errorf("invalid contact number format")
	}

	// Password validation (strong policy)
	if err := ValidateStrongPassword(req.Password); err != nil {
		return err
	}
	if req.Password != req.ConfirmPassword {
		return fmt.Errorf("passwords do not match")
	}

	return nil
}
