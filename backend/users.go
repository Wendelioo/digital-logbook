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
// USER MANAGEMENT METHODS
// ==============================================================================

// GetUsers returns all users with complete details
func (a *App) GetUsers() ([]User, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			a.first_name, a.middle_name, a.last_name,
			a.admin_id, NULL as student_id,
			a.email, a.contact_number, NULL as department_code
		FROM users u
		JOIN admins a ON u.id = a.id
		WHERE u.user_type = 'admin' AND u.is_active = 1 AND u.account_status <> 'suspended'
		UNION ALL
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			t.first_name, t.middle_name, t.last_name,
			t.teacher_id, NULL as student_id,
			t.email, t.contact_number, t.department_code
		FROM users u
		JOIN teachers t ON u.id = t.id
		WHERE u.user_type IN ('teacher') AND u.is_active = 1 AND u.account_status <> 'suspended'
		UNION ALL
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			s.first_name, s.middle_name, s.last_name,
			NULL as admin_id, s.student_id,
			s.email, s.contact_number, NULL as department_code
		FROM users u
		JOIN students s ON u.id = s.id
		WHERE u.user_type IN ('student', 'working_student') AND u.is_active = 1 AND u.account_status <> 'suspended'
		ORDER BY created_at DESC
	`
	rows, err := a.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return a.scanUsers(rows)
}

// GetUsersByType returns users filtered by type with complete details
func (a *App) GetUsersByType(userType string) ([]User, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			a.first_name, a.middle_name, a.last_name,
			a.admin_id, NULL as student_id,
			a.email, a.contact_number, NULL as department_code
		FROM users u
		JOIN admins a ON u.id = a.id
		WHERE u.user_type = 'admin' AND u.user_type = ? AND u.is_active = 1 AND u.account_status <> 'suspended'
		UNION ALL
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			t.first_name, t.middle_name, t.last_name,
			t.teacher_id, NULL as student_id,
			t.email, t.contact_number, t.department_code
		FROM users u
		JOIN teachers t ON u.id = t.id
		WHERE u.user_type = 'teacher' AND u.user_type = ? AND u.is_active = 1 AND u.account_status <> 'suspended'
		UNION ALL
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			s.first_name, s.middle_name, s.last_name,
			NULL as admin_id, s.student_id,
			s.email, s.contact_number, NULL as department_code
		FROM users u
		JOIN students s ON u.id = s.id
		WHERE u.user_type IN ('student', 'working_student') AND u.user_type = ? AND u.is_active = 1 AND u.account_status <> 'suspended'
		ORDER BY created_at DESC
	`
	rows, err := a.db.Query(query, userType, userType, userType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return a.scanUsers(rows)
}

// SearchUsers searches users by name, ID, gender, or date with complete details
func (a *App) SearchUsers(searchTerm, userType string) ([]User, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	sanitizedTerm, err := ValidateSearchTerm(searchTerm)
	if err != nil {
		return nil, err
	}
	if err := ValidateUserType(userType); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			a.first_name, a.middle_name, a.last_name,
			a.admin_id, NULL as student_id,
			a.email, a.contact_number, NULL as department_code
		FROM users u
		JOIN admins a ON u.id = a.id
		WHERE u.user_type = 'admin' AND u.is_active = 1 AND u.account_status <> 'suspended' AND (
			u.username LIKE ? OR
			a.first_name LIKE ? OR
			a.last_name LIKE ? OR
			a.middle_name LIKE ? OR
			a.admin_id LIKE ? OR
			CONVERT(VARCHAR(10), u.created_at, 120) LIKE ?
		)
		UNION ALL
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			t.first_name, t.middle_name, t.last_name,
			t.teacher_id, NULL as student_id,
			t.email, t.contact_number, t.department_code
		FROM users u
		JOIN teachers t ON u.id = t.id
		WHERE u.user_type = 'teacher' AND u.is_active = 1 AND u.account_status <> 'suspended' AND (
			u.username LIKE ? OR
			t.first_name LIKE ? OR
			t.last_name LIKE ? OR
			t.middle_name LIKE ? OR
			t.teacher_id LIKE ? OR
			CONVERT(VARCHAR(10), u.created_at, 120) LIKE ?
		)
		UNION ALL
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			s.first_name, s.middle_name, s.last_name,
			NULL as admin_id, s.student_id,
			s.email, s.contact_number, NULL as department_code
		FROM users u
		JOIN students s ON u.id = s.id
		WHERE u.user_type IN ('student', 'working_student') AND u.is_active = 1 AND u.account_status <> 'suspended' AND (
			u.username LIKE ? OR
			s.first_name LIKE ? OR
			s.last_name LIKE ? OR
			s.middle_name LIKE ? OR
			s.student_id LIKE ? OR
			CONVERT(VARCHAR(10), u.created_at, 120) LIKE ?
		)
	`
	searchPattern := "%" + sanitizedTerm + "%"
	args := []interface{}{
		searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern,
		searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern,
		searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern,
	}

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

	return a.scanUsers(rows)
}

// CreateUser creates a new user
func (a *App) CreateUser(password, name, firstName, middleName, lastName, role, employeeID, studentID, email, contactNumber string, departmentCode string) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	// Input validation to prevent injection and malformed data
	if err := ValidateStrongPassword(password); err != nil {
		return err
	}
	if err := ValidateRequiredName(firstName, "first name"); err != nil {
		return err
	}
	if err := ValidateRequiredName(lastName, "last name"); err != nil {
		return err
	}
	if err := ValidateName(middleName, "middle name"); err != nil {
		return err
	}
	if err := ValidateUserType(role); err != nil {
		return err
	}
	if role == "admin" || role == "teacher" {
		if err := ValidateEmployeeID(employeeID); err != nil {
			return err
		}
	}
	if role == "student" || role == "working_student" {
		if err := ValidateStudentID(studentID); err != nil {
			return err
		}
	}
	if email != "" {
		if err := ValidateEmail(email); err != nil {
			return err
		}
	}
	if contactNumber != "" {
		if err := ValidateContactNumber(contactNumber); err != nil {
			return err
		}
	}
	if len(strings.TrimSpace(departmentCode)) > MaxLenDepartment {
		return fmt.Errorf("department code must be at most %d characters", MaxLenDepartment)
	}

	log.Printf("CreateUser called - Role: %s, StudentID: %s, Email: %s", role, studentID, email)

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

	// Check for duplicate registration
	if err := a.checkDuplicateUser(username, role); err != nil {
		return err
	}

	// Hash password before storing
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Insert into users table
	query := `INSERT INTO users (username, password, user_type) OUTPUT INSERTED.id VALUES (?, ?, ?)`
	var userID int64
	err = a.db.QueryRow(query, username, string(hashedPassword), role).Scan(&userID)
	if err != nil {
		log.Printf("Failed to insert into users table: %v", err)
		return fmt.Errorf("failed to create user account: %w", err)
	}

	log.Printf("Created user account with ID: %d", userID)

	// Insert into role-specific table
	if err := a.insertRoleSpecificProfile(userID, role, firstName, middleName, lastName, employeeID, studentID, email, contactNumber, departmentCode); err != nil {
		return err
	}

	log.Printf("Successfully created %s: %s %s (ID: %d)", role, firstName, lastName, userID)
	return nil
}

// UpdateUser updates an existing user
func (a *App) UpdateUser(id int, name, firstName, middleName, lastName, role, employeeID, studentID, email, contactNumber string, departmentCode string) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	var query string
	var err error

	switch role {
	case "admin":
		query = `UPDATE admins SET first_name = ?, middle_name = ?, last_name = ?, admin_id = ?, email = ? WHERE id = ?`
		_, err = a.db.Exec(query, firstName, nullString(middleName), lastName, nullString(employeeID), nullString(email), id)
	case "teacher":
		query = `UPDATE teachers SET first_name = ?, middle_name = ?, last_name = ?, teacher_id = ?, email = ?, contact_number = ?, department_code = ? WHERE id = ?`
		_, err = a.db.Exec(query, firstName, nullString(middleName), lastName, nullString(employeeID), nullString(email), nullString(contactNumber), nullString(departmentCode), id)
	case "student":
		query = `UPDATE students SET first_name = ?, middle_name = ?, last_name = ?, student_id = ?, email = ?, contact_number = ? WHERE id = ? AND is_working_student = 0`
		_, err = a.db.Exec(query, firstName, nullString(middleName), lastName, nullString(studentID), nullString(email), nullString(contactNumber), id)
	case "working_student":
		query = `UPDATE students SET first_name = ?, middle_name = ?, last_name = ?, student_id = ?, email = ?, contact_number = ? WHERE id = ? AND is_working_student = 1`
		_, err = a.db.Exec(query, firstName, nullString(middleName), lastName, nullString(studentID), nullString(email), nullString(contactNumber), id)
	}

	return err
}

// DeleteUser deletes a user
func (a *App) DeleteUser(id int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	query := `DELETE FROM users WHERE id = ?`
	_, err := a.db.Exec(query, id)
	return err
}

// DeleteExpiredDeactivatedUsers permanently deletes accounts that have been deactivated
// (suspended) for more than 30 days. Intended to be run periodically by an administrator.
func (a *App) DeleteExpiredDeactivatedUsers() (int, error) {
	if err := a.checkDB(); err != nil {
		return 0, err
	}

	const days = 30

	rows, err := a.db.Query(`
		SELECT id
		FROM users
		WHERE account_status = 'suspended'
		  AND is_active = 0
		  AND updated_at <= DATEADD(DAY, -?, GETDATE())
	`, days)
	if err != nil {
		return 0, fmt.Errorf("failed to query expired deactivated users: %w", err)
	}
	defer rows.Close()

	var ids []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return 0, fmt.Errorf("failed to scan deactivated user id: %w", err)
		}
		ids = append(ids, id)
	}

	if len(ids) == 0 {
		return 0, nil
	}

	placeholders := "?"
	args := make([]interface{}, len(ids))
	args[0] = ids[0]
	for i := 1; i < len(ids); i++ {
		placeholders += ",?"
		args[i] = ids[i]
	}

	deleteQuery := fmt.Sprintf(`DELETE FROM users WHERE id IN (%s)`, placeholders)
	result, err := a.db.Exec(deleteQuery, args...)
	if err != nil {
		return 0, fmt.Errorf("failed to delete expired deactivated users: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get affected row count: %w", err)
	}

	log.Printf("Deleted %d expired deactivated user account(s)", affected)
	return int(affected), nil
}

// DeactivateTeacher deactivates a teacher account instead of immediate deletion.
// The account remains in the system (inactive) for record purposes and can be reactivated.
func (a *App) DeactivateTeacher(id int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	var userType string
	err := a.db.QueryRow(`SELECT user_type FROM users WHERE id = ?`, id).Scan(&userType)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("user not found")
		}
		return err
	}

	if userType != "teacher" {
		return fmt.Errorf("only teacher accounts can be deactivated with this action")
	}

	result, err := a.db.Exec(`
		UPDATE users
		SET account_status = 'suspended', is_active = 0, updated_at = GETDATE()
		WHERE id = ? AND (is_active = 1 OR account_status <> 'suspended')
	`, id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("teacher account is already deactivated or not eligible for deactivation")
	}

	return nil
}

// ArchiveUser archives a user account (teachers cannot be archived)
func (a *App) ArchiveUser(id int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	var userType string
	err := a.db.QueryRow(`SELECT user_type FROM users WHERE id = ?`, id).Scan(&userType)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("user not found")
		}
		return err
	}

	if userType == "teacher" {
		return fmt.Errorf("teacher accounts cannot be archived; delete the account instead")
	}

	result, err := a.db.Exec(`
		UPDATE users
		SET account_status = 'suspended', is_active = 0, updated_at = GETDATE()
		WHERE id = ? AND (is_active = 1 OR account_status <> 'suspended')
	`, id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("user is already archived or not eligible for archiving")
	}

	return nil
}

// UnarchiveUser restores an archived user account back to active state
func (a *App) UnarchiveUser(id int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	result, err := a.db.Exec(`
		UPDATE users
		SET account_status = 'active', is_active = 1, updated_at = GETDATE()
		WHERE id = ? AND (is_active = 0 OR account_status = 'suspended')
	`, id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("user is not archived")
	}

	return nil
}

// GetArchivedUsers returns archived accounts for admin review
func (a *App) GetArchivedUsers() ([]User, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			u.id, u.username, u.user_type, u.updated_at,
			a.first_name, a.middle_name, a.last_name,
			a.admin_id, NULL as student_id,
			a.email, a.contact_number, NULL as department_code
		FROM users u
		JOIN admins a ON u.id = a.id
		WHERE (u.is_active = 0 OR u.account_status = 'suspended')
		UNION ALL
		SELECT 
			u.id, u.username, u.user_type, u.updated_at,
			s.first_name, s.middle_name, s.last_name,
			NULL as admin_id, s.student_id,
			s.email, s.contact_number, NULL as department_code
		FROM users u
		JOIN students s ON u.id = s.id
		WHERE u.user_type IN ('student', 'working_student')
		  AND (u.is_active = 0 OR u.account_status = 'suspended')
		ORDER BY updated_at DESC
	`

	rows, err := a.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return a.scanUsers(rows)
}

// ==============================================================================
// HELPER METHODS
// ==============================================================================

// scanUsers scans database rows into User structs
func (a *App) scanUsers(rows *sql.Rows) ([]User, error) {
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

		// Load profile photo from database
		a.loadUserPhotoURL(&user)

		users = append(users, user)
	}

	return users, nil
}

// checkDuplicateUser checks if a username already exists
func (a *App) checkDuplicateUser(username, role string) error {
	var existingUserID int
	var existingRole string
	checkQuery := `SELECT id, user_type FROM users WHERE username = ?`
	err := a.db.QueryRow(checkQuery, username).Scan(&existingUserID, &existingRole)

	if err == nil {
		if role == "student" || role == "working_student" {
			return fmt.Errorf("?? This Student ID is already registered. If you already have an account, please use the login form instead")
		}
		return fmt.Errorf("?? This %s ID is already registered in the system", role)
	} else if err != sql.ErrNoRows {
		log.Printf("Error checking for duplicate user: %v", err)
		return fmt.Errorf("failed to check existing registration: %w", err)
	}

	return nil
}

// insertRoleSpecificProfile inserts user profile into role-specific table
func (a *App) insertRoleSpecificProfile(userID int64, role, firstName, middleName, lastName, employeeID, studentID, email, contactNumber, departmentCode string) error {
	var query string
	var err error

	switch role {
	case "admin":
		query = `INSERT INTO admins (id, admin_id, first_name, middle_name, last_name, email) VALUES (?, ?, ?, ?, ?, ?)`
		_, err = a.db.Exec(query, userID, nullString(employeeID), firstName, nullString(middleName), lastName, nullString(email))
	case "teacher":
		query = `INSERT INTO teachers (id, teacher_id, first_name, middle_name, last_name, email, contact_number, department_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		_, err = a.db.Exec(query, userID, nullString(employeeID), firstName, nullString(middleName), lastName, nullString(email), nullString(contactNumber), nullString(departmentCode))
	case "student":
		query = `INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		_, err = a.db.Exec(query, userID, nullString(studentID), firstName, nullString(middleName), lastName, nullString(email), nullString(contactNumber), 0)
	case "working_student":
		query = `INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		log.Printf("Inserting working student - id: %d, student_id: %s, name: %s %s, email: %s", userID, studentID, firstName, lastName, email)
		_, err = a.db.Exec(query, userID, nullString(studentID), firstName, nullString(middleName), lastName, nullString(email), nullString(contactNumber), 1)
	}

	if err != nil {
		log.Printf("Failed to insert into %s table: %v", role, err)
		return fmt.Errorf("failed to create %s profile: %w", role, err)
	}

	return nil
}

// detectColumns detects column indices from header row
func detectColumns(headers []string) map[string]int {
	columnMap := make(map[string]int)

	for colIdx, header := range headers {
		headerLower := strings.ToLower(strings.TrimSpace(header))

		if _, exists := columnMap["student_code"]; !exists &&
			(strings.Contains(headerLower, "student") && (strings.Contains(headerLower, "code") || strings.Contains(headerLower, "id")) ||
				strings.Contains(headerLower, "student_id") ||
				strings.Contains(headerLower, "student code") ||
				(strings.Contains(headerLower, "id") && !strings.Contains(headerLower, "email") && !strings.Contains(headerLower, "contact"))) {
			columnMap["student_code"] = colIdx
		}

		if _, exists := columnMap["first_name"]; !exists &&
			(strings.Contains(headerLower, "first") && strings.Contains(headerLower, "name") ||
				strings.Contains(headerLower, "firstname") ||
				strings.Contains(headerLower, "fname") ||
				headerLower == "first") {
			columnMap["first_name"] = colIdx
		}

		if _, exists := columnMap["last_name"]; !exists &&
			(strings.Contains(headerLower, "last") && strings.Contains(headerLower, "name") ||
				strings.Contains(headerLower, "lastname") ||
				strings.Contains(headerLower, "lname") ||
				headerLower == "last" ||
				strings.Contains(headerLower, "surname")) {
			columnMap["last_name"] = colIdx
		}

		if _, exists := columnMap["middle_name"]; !exists &&
			(strings.Contains(headerLower, "middle") && strings.Contains(headerLower, "name") ||
				strings.Contains(headerLower, "middlename") ||
				strings.Contains(headerLower, "mname") ||
				headerLower == "middle" ||
				strings.Contains(headerLower, "mi")) {
			columnMap["middle_name"] = colIdx
		}

		if _, exists := columnMap["email"]; !exists &&
			(strings.Contains(headerLower, "email") ||
				strings.Contains(headerLower, "e-mail") ||
				strings.Contains(headerLower, "mail")) {
			columnMap["email"] = colIdx
		}

		if _, exists := columnMap["contact"]; !exists &&
			(strings.Contains(headerLower, "contact") ||
				strings.Contains(headerLower, "phone") ||
				strings.Contains(headerLower, "mobile") ||
				strings.Contains(headerLower, "cell") ||
				(strings.Contains(headerLower, "number") && !strings.Contains(headerLower, "student") && !strings.Contains(headerLower, "id"))) {
			columnMap["contact"] = colIdx
		}
	}

	return columnMap
}

// getColumnValue safely retrieves a column value
func getColumnValue(record []string, colIdx int, found bool) string {
	if found && colIdx >= 0 && colIdx < len(record) {
		return strings.TrimSpace(record[colIdx])
	}
	return ""
}

// ==============================================================================
// PROFILE PHOTO MANAGEMENT
// ==============================================================================

// UpdateUserProfilePhoto updates the profile photo for a user
// Accepts Base64-encoded image data (with or without data URL prefix)
// Stores the data URL directly in the database.
func (a *App) UpdateUserProfilePhoto(userID int, imageBase64 string) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	// Ensure it has data URL prefix
	photoDataURL := imageBase64
	if !strings.HasPrefix(imageBase64, "data:") {
		photoDataURL = "data:image/jpeg;base64," + imageBase64
	}

	err := a.SaveProfilePhoto(userID, photoDataURL)
	if err != nil {
		return fmt.Errorf("failed to update profile photo: %w", err)
	}

	log.Printf("Profile photo updated for user ID %d", userID)
	return nil
}

// DeleteUserProfilePhoto removes the profile photo for a user
func (a *App) DeleteUserProfilePhoto(userID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	err := a.DeleteProfilePhoto(userID)
	if err != nil {
		return fmt.Errorf("failed to delete profile photo: %w", err)
	}

	log.Printf("Profile photo deleted for user ID %d", userID)
	return nil
}

// ==============================================================================
// STUDENT ARCHIVE MANAGEMENT (For Working Students)
// ==============================================================================

// ArchivedStudent represents a student that has been archived (graduated)
type ArchivedStudent struct {
	UserID              int     `json:"user_id"`
	StudentID           string  `json:"student_id"`
	FirstName           string  `json:"first_name"`
	MiddleName          *string `json:"middle_name"`
	LastName            string  `json:"last_name"`
	Email               *string `json:"email"`
	ContactNumber       *string `json:"contact_number"`
	ArchivedAt          string  `json:"archived_at"`
	DeletionScheduledAt string  `json:"deletion_scheduled_at"`
	DaysUntilDeletion   int     `json:"days_until_deletion"`
}

// ArchiveStudent archives a graduated student account
// The account will be scheduled for deletion after 360 days
func (a *App) ArchiveStudent(studentUserID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	now := time.Now()
	deletionDate := now.AddDate(0, 0, 360) // 360 days from now

	query := `
		UPDATE students 
		SET archived_at = ?,
			deletion_scheduled_at = ?
		WHERE id = ? AND archived_at IS NULL
	`

	result, err := a.db.Exec(query, now, deletionDate, studentUserID)
	if err != nil {
		return fmt.Errorf("failed to archive student: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("student not found or already archived")
	}

	// Also deactivate the user account
	_, err = a.db.Exec("UPDATE users SET is_active = 0 WHERE id = ?", studentUserID)
	if err != nil {
		return fmt.Errorf("failed to deactivate user account: %w", err)
	}

	log.Printf("Student archived: user_id=%d, deletion_scheduled=%s",
		studentUserID, deletionDate.Format("2006-01-02"))

	return nil
}

// UnarchiveStudent restores an archived student account
func (a *App) UnarchiveStudent(studentUserID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	query := `
		UPDATE students 
		SET archived_at = NULL, 
		    deletion_scheduled_at = NULL
		WHERE id = ? AND archived_at IS NOT NULL
	`

	result, err := a.db.Exec(query, studentUserID)
	if err != nil {
		return fmt.Errorf("failed to unarchive student: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("student not found or not archived")
	}

	// Reactivate the user account
	_, err = a.db.Exec("UPDATE users SET is_active = 1 WHERE id = ?", studentUserID)
	if err != nil {
		return fmt.Errorf("failed to reactivate user account: %w", err)
	}

	log.Printf("Student unarchived: user_id=%d", studentUserID)
	return nil
}

// GetArchivedStudents returns all archived students with deletion schedule info
func (a *App) GetArchivedStudents() ([]ArchivedStudent, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			s.id,
			s.student_id,
			s.first_name,
			s.middle_name,
			s.last_name,
			s.email,
			s.contact_number,
			s.archived_at,
			s.deletion_scheduled_at,
			DATEDIFF(day, GETDATE(), s.deletion_scheduled_at) as days_until_deletion
		FROM students s
		WHERE s.archived_at IS NOT NULL
		ORDER BY s.deletion_scheduled_at ASC
	`

	rows, err := a.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get archived students: %w", err)
	}
	defer rows.Close()

	var students []ArchivedStudent
	for rows.Next() {
		var student ArchivedStudent
		var archivedAt, deletionScheduledAt time.Time
		err := rows.Scan(
			&student.UserID,
			&student.StudentID,
			&student.FirstName,
			&student.MiddleName,
			&student.LastName,
			&student.Email,
			&student.ContactNumber,
			&archivedAt,
			&deletionScheduledAt,
			&student.DaysUntilDeletion,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan archived student: %w", err)
		}

		// Format time fields as strings
		student.ArchivedAt = archivedAt.Format("2006-01-02 15:04:05")
		student.DeletionScheduledAt = deletionScheduledAt.Format("2006-01-02 15:04:05")

		students = append(students, student)
	}

	return students, nil
}

// DeleteExpiredStudents permanently deletes student accounts that have passed their deletion date
// This should be called periodically (e.g., daily cron job)
func (a *App) DeleteExpiredStudents() (int, error) {
	if err := a.checkDB(); err != nil {
		return 0, err
	}

	// Get students to delete for logging
	query := `
		SELECT id, student_id 
		FROM students 
		WHERE archived_at IS NOT NULL 
		AND deletion_scheduled_at <= GETDATE()
	`
	rows, err := a.db.Query(query)
	if err != nil {
		return 0, fmt.Errorf("failed to query expired students: %w", err)
	}

	var userIDs []int
	studentInfo := make(map[int]string)
	for rows.Next() {
		var userID int
		var studentID string
		if err := rows.Scan(&userID, &studentID); err != nil {
			rows.Close()
			return 0, fmt.Errorf("failed to scan expired student: %w", err)
		}
		userIDs = append(userIDs, userID)
		studentInfo[userID] = studentID
	}
	rows.Close()

	if len(userIDs) == 0 {
		return 0, nil
	}

	// Delete the user accounts (CASCADE will delete students records)
	deleteQuery := `DELETE FROM users WHERE id IN (?` + strings.Repeat(",?", len(userIDs)-1) + `)`
	args := make([]interface{}, len(userIDs))
	for i, id := range userIDs {
		args[i] = id
	}

	result, err := a.db.Exec(deleteQuery, args...)
	if err != nil {
		return 0, fmt.Errorf("failed to delete expired students: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get rows affected: %w", err)
	}

	for userID, studentID := range studentInfo {
		log.Printf("Deleted expired student: user_id=%d, student_id=%s", userID, studentID)
	}

	return int(rowsAffected), nil
}

// DeleteExpiredStudentAccounts permanently deletes student and working_student accounts
// that are at least 4 years old based on their user account creation date.
// This should be called periodically (e.g., daily) as an additional safety net
// beyond the login-time expiry checks.
func (a *App) DeleteExpiredStudentAccounts() (int, error) {
	if err := a.checkDB(); err != nil {
		return 0, err
	}

	// Find student/working_student users whose account age is >= 4 years
	rows, err := a.db.Query(`
		SELECT id
		FROM users
		WHERE user_type IN ('student', 'working_student')
		  AND created_at <= DATEADD(YEAR, -4, GETDATE())
	`)
	if err != nil {
		return 0, fmt.Errorf("failed to query expired student accounts: %w", err)
	}
	defer rows.Close()

	var ids []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return 0, fmt.Errorf("failed to scan expired student account id: %w", err)
		}
		ids = append(ids, id)
	}

	if len(ids) == 0 {
		return 0, nil
	}

	placeholders := "?"
	args := make([]interface{}, len(ids))
	args[0] = ids[0]
	for i := 1; i < len(ids); i++ {
		placeholders += ",?"
		args[i] = ids[i]
	}

	deleteQuery := fmt.Sprintf(`DELETE FROM users WHERE id IN (%s)`, placeholders)
	result, err := a.db.Exec(deleteQuery, args...)
	if err != nil {
		return 0, fmt.Errorf("failed to delete expired student accounts: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get affected row count: %w", err)
	}

	log.Printf("Deleted %d student/working_student account(s) that reached 4-year validity", affected)
	return int(affected), nil
}

// GetActiveStudentsForArchiving returns active students that can be archived
func (a *App) GetActiveStudentsForArchiving() ([]User, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			u.id,
			u.username,
			u.user_type,
			s.first_name,
			s.middle_name,
			s.last_name,
			s.student_id,
			s.email,
			s.contact_number,
			u.created_at
		FROM users u
		JOIN students s ON u.id = s.id
		WHERE u.user_type = 'student' 
		AND u.is_active = 1
		AND s.archived_at IS NULL
		ORDER BY s.last_name, s.first_name
	`

	rows, err := a.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get active students: %w", err)
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		var username, userType string
		var createdAt string
		err := rows.Scan(
			&user.ID,
			&username,
			&userType,
			&user.FirstName,
			&user.MiddleName,
			&user.LastName,
			&user.StudentID,
			&user.Email,
			&user.ContactNumber,
			&createdAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan student: %w", err)
		}
		user.Role = userType
		user.Created = createdAt
		users = append(users, user)
	}

	return users, nil
}
