package main

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"
)

// Maximum lengths for input fields (defense in depth and DB column limits)
const (
	MaxLenUsername     = 100
	MaxLenPassword     = 256
	MaxLenName         = 100
	MaxLenEmail        = 254
	MaxLenContact      = 30
	MaxLenStudentID    = 50
	MaxLenEmployeeID   = 50
	MaxLenDepartment   = 20
	MaxLenSearchTerm   = 200
	MaxLenEDPCode      = 50
	MaxLenComments     = 2000
	MaxLenPCNumber     = 50
	MaxLenRejectReason = 500
)

// SanitizeString removes control characters and null bytes, trims, and optionally truncates.
// Use for free-text fields that are passed as query parameters (parameterized queries prevent SQL injection;
// this avoids control chars and enforces length).
func SanitizeString(s string, maxLen int) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if r == 0 || r == '\x00' || unicode.Is(unicode.Cc, r) {
			continue
		}
		b.WriteRune(r)
	}
	out := strings.TrimSpace(b.String())
	if maxLen > 0 && len(out) > maxLen {
		return out[:maxLen]
	}
	return out
}

// ContainsControlOrNull returns true if s has null bytes or control characters.
func ContainsControlOrNull(s string) bool {
	for _, r := range s {
		if r == 0 || unicode.Is(unicode.Cc, r) {
			return true
		}
	}
	return false
}

// ValidateUsername validates username (e.g. student ID or employee ID used at login).
func ValidateUsername(username string) error {
	s := strings.TrimSpace(username)
	if s == "" {
		return fmt.Errorf("username is required")
	}
	if len(s) > MaxLenUsername {
		return fmt.Errorf("username must be at most %d characters", MaxLenUsername)
	}
	if ContainsControlOrNull(s) {
		return fmt.Errorf("username contains invalid characters")
	}
	return nil
}

// ValidatePassword validates password for login/creation.
func ValidatePassword(password string) error {
	if password == "" {
		return fmt.Errorf("password is required")
	}
	if len(password) > MaxLenPassword {
		return fmt.Errorf("password must be at most %d characters", MaxLenPassword)
	}
	if ContainsControlOrNull(password) {
		return fmt.Errorf("password contains invalid characters")
	}
	return nil
}

// ValidateName validates first/middle/last name.
func ValidateName(name, fieldName string) error {
	s := strings.TrimSpace(name)
	if len(s) > MaxLenName {
		return fmt.Errorf("%s must be at most %d characters", fieldName, MaxLenName)
	}
	if ContainsControlOrNull(s) {
		return fmt.Errorf("%s contains invalid characters", fieldName)
	}
	return nil
}

// ValidateRequiredName is like ValidateName but also requires non-empty.
func ValidateRequiredName(name, fieldName string) error {
	if strings.TrimSpace(name) == "" {
		return fmt.Errorf("%s is required", fieldName)
	}
	return ValidateName(name, fieldName)
}

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// ValidateEmail validates email format and length.
func ValidateEmail(email string) error {
	s := strings.TrimSpace(email)
	if s == "" {
		return fmt.Errorf("email is required")
	}
	if len(s) > MaxLenEmail {
		return fmt.Errorf("email must be at most %d characters", MaxLenEmail)
	}
	if ContainsControlOrNull(s) {
		return fmt.Errorf("email contains invalid characters")
	}
	if !emailRegex.MatchString(s) {
		return fmt.Errorf("invalid email format")
	}
	return nil
}

// ValidateContactNumber validates contact number (length and no control chars).
func ValidateContactNumber(contact string) error {
	s := strings.TrimSpace(contact)
	if len(s) > MaxLenContact {
		return fmt.Errorf("contact number must be at most %d characters", MaxLenContact)
	}
	if ContainsControlOrNull(s) {
		return fmt.Errorf("contact number contains invalid characters")
	}
	return nil
}

// ValidateStudentID validates student ID (length, no control chars).
func ValidateStudentID(studentID string) error {
	s := strings.TrimSpace(studentID)
	if len(s) > MaxLenStudentID {
		return fmt.Errorf("student ID must be at most %d characters", MaxLenStudentID)
	}
	if ContainsControlOrNull(s) {
		return fmt.Errorf("student ID contains invalid characters")
	}
	return nil
}

// ValidateEmployeeID validates employee/teacher ID.
func ValidateEmployeeID(employeeID string) error {
	s := strings.TrimSpace(employeeID)
	if len(s) > MaxLenEmployeeID {
		return fmt.Errorf("employee ID must be at most %d characters", MaxLenEmployeeID)
	}
	if ContainsControlOrNull(s) {
		return fmt.Errorf("employee ID contains invalid characters")
	}
	return nil
}

// ValidateSearchTerm validates search term for user/search queries.
func ValidateSearchTerm(searchTerm string) (string, error) {
	s := SanitizeString(searchTerm, MaxLenSearchTerm)
	if ContainsControlOrNull(searchTerm) {
		return "", fmt.Errorf("search term contains invalid characters")
	}
	return s, nil
}

// ValidateEDPCode validates EDP code for class join.
func ValidateEDPCode(edpCode string) (string, error) {
	s := strings.TrimSpace(edpCode)
	if s == "" {
		return "", fmt.Errorf("EDP code cannot be empty")
	}
	if len(s) > MaxLenEDPCode {
		return "", fmt.Errorf("EDP code must be at most %d characters", MaxLenEDPCode)
	}
	if ContainsControlOrNull(s) {
		return "", fmt.Errorf("EDP code contains invalid characters")
	}
	return s, nil
}

// ValidateUserType validates role/user type for filtering.
func ValidateUserType(userType string) error {
	switch userType {
	case "", "admin", "teacher", "student", "working_student":
		return nil
	default:
		return fmt.Errorf("invalid user type")
	}
}

// ValidateComments validates free-text comments (feedback, notes).
func ValidateComments(comments string) (string, error) {
	s := SanitizeString(comments, MaxLenComments)
	if ContainsControlOrNull(comments) {
		return "", fmt.Errorf("comments contain invalid characters")
	}
	return s, nil
}

// ValidatePCNumber validates PC number or hostname for feedback.
func ValidatePCNumber(pcNumber string) (string, error) {
	s := SanitizeString(pcNumber, MaxLenPCNumber)
	if ContainsControlOrNull(pcNumber) {
		return "", fmt.Errorf("PC number contains invalid characters")
	}
	return s, nil
}

// ValidateRejectionReason validates rejection reason length.
func ValidateRejectionReason(reason string) (string, error) {
	s := SanitizeString(reason, MaxLenRejectReason)
	return s, nil
}

// ValidatePositiveID ensures id is positive (for single ID args).
func ValidatePositiveID(id int, name string) error {
	if id <= 0 {
		return fmt.Errorf("invalid %s", name)
	}
	return nil
}

// ValidatePositiveIDs ensures all IDs are positive (for slice args).
func ValidatePositiveIDs(ids []int, name string) error {
	for i, id := range ids {
		if id <= 0 {
			return fmt.Errorf("invalid %s at position %d", name, i+1)
		}
	}
	return nil
}
