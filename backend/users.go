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
		WHERE u.user_type = 'admin' AND u.is_active = 1 AND u.account_status = 'active'
		UNION ALL
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			t.first_name, t.middle_name, t.last_name,
			t.teacher_id, NULL as student_id,
			t.email, t.contact_number, t.department_code
		FROM users u
		JOIN teachers t ON u.id = t.id
		WHERE u.user_type IN ('teacher') AND u.is_active = 1 AND u.account_status = 'active'
		UNION ALL
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			s.first_name, s.middle_name, s.last_name,
			NULL as admin_id, s.student_id,
			s.email, s.contact_number, s.department_code
		FROM users u
		JOIN students s ON u.id = s.id
		WHERE u.user_type IN ('student', 'working_student') AND u.is_active = 1 AND u.account_status = 'active'
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
		WHERE u.user_type = 'admin' AND u.user_type = ? AND u.is_active = 1 AND u.account_status = 'active'
		UNION ALL
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			t.first_name, t.middle_name, t.last_name,
			t.teacher_id, NULL as student_id,
			t.email, t.contact_number, t.department_code
		FROM users u
		JOIN teachers t ON u.id = t.id
		WHERE u.user_type = 'teacher' AND u.user_type = ? AND u.is_active = 1 AND u.account_status = 'active'
		UNION ALL
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			s.first_name, s.middle_name, s.last_name,
			NULL as admin_id, s.student_id,
			s.email, s.contact_number, s.department_code
		FROM users u
		JOIN students s ON u.id = s.id
		WHERE u.user_type IN ('student', 'working_student') AND u.user_type = ? AND u.is_active = 1 AND u.account_status = 'active'
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
		WHERE u.user_type = 'admin' AND u.is_active = 1 AND u.account_status = 'active' AND (
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
		WHERE u.user_type = 'teacher' AND u.is_active = 1 AND u.account_status = 'active' AND (
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
			s.email, s.contact_number, s.department_code
		FROM users u
		JOIN students s ON u.id = s.id
		WHERE u.user_type IN ('student', 'working_student') AND u.is_active = 1 AND u.account_status = 'active' AND (
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

	// Wrap the UNION ALL in a subquery so the user_type filter applies to all
	// branches, not just the last one.
	outerQuery := `SELECT * FROM (` + query + `) AS combined_results`
	if userType != "" {
		outerQuery += ` WHERE user_type = ?`
		args = append(args, userType)
	}
	outerQuery += ` ORDER BY created_at DESC`

	rows, err := a.db.Query(outerQuery, args...)
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
		if strings.TrimSpace(departmentCode) == "" {
			return fmt.Errorf("department is required for %s", strings.ReplaceAll(role, "_", " "))
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

	if role == "student" || role == "working_student" {
		normalizedDepartmentCode, err := a.validateActiveDepartmentCode(departmentCode)
		if err != nil {
			return err
		}
		departmentCode = normalizedDepartmentCode
	} else if role == "teacher" && strings.TrimSpace(departmentCode) != "" {
		normalizedDepartmentCode, err := a.validateActiveDepartmentCode(departmentCode)
		if err != nil {
			return err
		}
		departmentCode = normalizedDepartmentCode
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
		if strings.TrimSpace(departmentCode) != "" {
			normalizedDepartmentCode, deptErr := a.validateActiveDepartmentCode(departmentCode)
			if deptErr != nil {
				return deptErr
			}
			departmentCode = normalizedDepartmentCode
		}
		query = `UPDATE teachers SET first_name = ?, middle_name = ?, last_name = ?, teacher_id = ?, email = ?, contact_number = ?, department_code = ? WHERE id = ?`
		_, err = a.db.Exec(query, firstName, nullString(middleName), lastName, nullString(employeeID), nullString(email), nullString(contactNumber), nullString(departmentCode), id)
	case "student":
		normalizedDepartmentCode, deptErr := a.validateActiveDepartmentCode(departmentCode)
		if deptErr != nil {
			return deptErr
		}
		departmentCode = normalizedDepartmentCode
		query = `UPDATE students SET first_name = ?, middle_name = ?, last_name = ?, student_id = ?, email = ?, contact_number = ?, department_code = ? WHERE id = ? AND is_working_student = 0`
		_, err = a.db.Exec(query, firstName, nullString(middleName), lastName, nullString(studentID), nullString(email), nullString(contactNumber), nullString(departmentCode), id)
	case "working_student":
		normalizedDepartmentCode, deptErr := a.validateActiveDepartmentCode(departmentCode)
		if deptErr != nil {
			return deptErr
		}
		departmentCode = normalizedDepartmentCode
		query = `UPDATE students SET first_name = ?, middle_name = ?, last_name = ?, student_id = ?, email = ?, contact_number = ?, department_code = ? WHERE id = ? AND is_working_student = 1`
		_, err = a.db.Exec(query, firstName, nullString(middleName), lastName, nullString(studentID), nullString(email), nullString(contactNumber), nullString(departmentCode), id)
	}

	return err
}

// deleteUserByID removes a user row. Used only for automated system flows (not admin UI).
func (a *App) deleteUserByID(id int) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	query := `DELETE FROM users WHERE id = ?`
	_, err := a.db.Exec(query, id)
	return err
}

// DeleteUser is bound for Wails; administrators cannot permanently delete accounts from the app.
func (a *App) DeleteUser(id int) error {
	_ = id
	return fmt.Errorf("manual account deletion is not supported")
}

// DeleteExpiredDeactivatedUsers is bound for Wails; bulk deletion from the admin UI is not supported.
func (a *App) DeleteExpiredDeactivatedUsers(days int) (int, error) {
	_ = days
	return 0, fmt.Errorf("bulk account deletion is not supported")
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
		SET account_status = 'deactivated',
		    is_active = 0,
		    deactivated_at = COALESCE(deactivated_at, GETDATE()),
		    updated_at = GETDATE()
		WHERE id = ? AND account_status <> 'deactivated'
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
		SET account_status = 'archived',
		    is_active = 0,
		    archived_at = COALESCE(archived_at, GETDATE()),
		    updated_at = GETDATE()
		WHERE id = ? AND account_status <> 'archived'
	`, id)
	if err != nil {
		return err
	}

	rows, rowsErr := result.RowsAffected()
	if rowsErr != nil {
		// SQL Server ODBC driver can return RowsAffected errors even when UPDATE succeeded
		return nil
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
		SET account_status = 'active',
		    is_active = 1,
		    archived_at = NULL,
		    updated_at = GETDATE()
		WHERE id = ? AND account_status = 'archived'
	`, id)
	if err != nil {
		return err
	}

	rows, rowsErr := result.RowsAffected()
	if rowsErr != nil {
		// SQL Server ODBC driver can return RowsAffected errors even when UPDATE succeeded
		return nil
	}
	if rows == 0 {
		return fmt.Errorf("user is not archived")
	}

	return nil
}

// GetArchivedUsers returns manually archived accounts for admin review.
func (a *App) GetArchivedUsers() ([]User, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			u.id, u.username, u.user_type, COALESCE(u.archived_at, u.updated_at),
			a.first_name, a.middle_name, a.last_name,
			a.admin_id, NULL as student_id,
			a.email, a.contact_number, NULL as department_code
		FROM users u
		JOIN admins a ON u.id = a.id
		WHERE u.account_status = 'archived'
		UNION ALL
		SELECT 
			u.id, u.username, u.user_type, COALESCE(u.archived_at, u.updated_at),
			t.first_name, t.middle_name, t.last_name,
			t.teacher_id, NULL as student_id,
			t.email, t.contact_number, t.department_code
		FROM users u
		JOIN teachers t ON u.id = t.id
		WHERE u.user_type = 'teacher'
		  AND u.account_status = 'archived'
		UNION ALL
		SELECT 
			u.id, u.username, u.user_type, COALESCE(u.archived_at, u.updated_at),
			s.first_name, s.middle_name, s.last_name,
			NULL as admin_id, s.student_id,
			s.email, s.contact_number, s.department_code
		FROM users u
		JOIN students s ON u.id = s.id
		WHERE u.user_type IN ('student', 'working_student')
		  AND u.account_status = 'archived'
		ORDER BY COALESCE(archived_at, updated_at) DESC
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

// validateActiveDepartmentCode ensures the selected department exists and is active.
func (a *App) validateActiveDepartmentCode(departmentCode string) (string, error) {
	normalized := strings.TrimSpace(departmentCode)
	if normalized == "" {
		return "", fmt.Errorf("department is required")
	}

	var isActive bool
	err := a.db.QueryRow(`SELECT is_active FROM departments WHERE department_code = ?`, normalized).Scan(&isActive)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("selected department does not exist")
	}
	if err != nil {
		return "", fmt.Errorf("failed to validate department: %w", err)
	}
	if !isActive {
		return "", fmt.Errorf("selected department is archived or inactive")
	}

	return normalized, nil
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
		query = `INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, department_code, is_working_student) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		_, err = a.db.Exec(query, userID, nullString(studentID), firstName, nullString(middleName), lastName, nullString(email), nullString(contactNumber), nullString(departmentCode), 0)
	case "working_student":
		query = `INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, department_code, is_working_student) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		log.Printf("Inserting working student - id: %d, student_id: %s, name: %s %s, email: %s", userID, studentID, firstName, lastName, email)
		_, err = a.db.Exec(query, userID, nullString(studentID), firstName, nullString(middleName), lastName, nullString(email), nullString(contactNumber), nullString(departmentCode), 1)
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

// ==============================================================================
// ACCOUNT ACTIVITY STATUS MANAGEMENT
// ==============================================================================

// ensureActivityTrackingColumns ensures the archived_at, deactivated_at and deleted_at columns
// exist in the users table. Called at startup as a lightweight auto-migration.
func (a *App) ensureActivityTrackingColumns() error {
	_, err := a.db.Exec(`
		IF NOT EXISTS (
			SELECT * FROM INFORMATION_SCHEMA.COLUMNS
			WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'archived_at'
		)
		BEGIN
			ALTER TABLE users ADD archived_at DATETIME NULL
		END
	`)
	if err != nil {
		return fmt.Errorf("failed to ensure archived_at column: %w", err)
	}

	_, err = a.db.Exec(`
		IF NOT EXISTS (
			SELECT * FROM INFORMATION_SCHEMA.COLUMNS
			WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'deactivated_at'
		)
		BEGIN
			ALTER TABLE users ADD deactivated_at DATETIME NULL
		END
	`)
	if err != nil {
		return fmt.Errorf("failed to ensure deactivated_at column: %w", err)
	}

	_, err = a.db.Exec(`
		IF NOT EXISTS (
			SELECT * FROM INFORMATION_SCHEMA.COLUMNS
			WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'deleted_at'
		)
		BEGIN
			ALTER TABLE users ADD deleted_at DATETIME NULL
		END
	`)
	if err != nil {
		return fmt.Errorf("failed to ensure deleted_at column: %w", err)
	}

	return nil
}

// ensureAccountStatusConstraint ensures users.account_status supports full lifecycle states.
func (a *App) ensureAccountStatusConstraint() error {
	_, err := a.db.Exec(`
		UPDATE users
		SET archived_at = updated_at
		WHERE account_status = 'archived'
		  AND archived_at IS NULL;

		UPDATE users
		SET account_status = 'deleted', updated_at = GETDATE()
		WHERE deleted_at IS NOT NULL
		  AND account_status <> 'deleted';

		DECLARE @dropSql NVARCHAR(MAX) = N'';

		SELECT @dropSql = @dropSql + N'ALTER TABLE users DROP CONSTRAINT [' + cc.name + N'];'
		FROM sys.check_constraints cc
		INNER JOIN sys.columns c
			ON cc.parent_object_id = c.object_id
			AND cc.parent_column_id = c.column_id
		INNER JOIN sys.tables t
			ON cc.parent_object_id = t.object_id
		WHERE t.name = 'users'
		  AND c.name = 'account_status';

		IF LEN(@dropSql) > 0
		BEGIN
			EXEC sp_executesql @dropSql;
		END

		ALTER TABLE users WITH NOCHECK
		ADD CONSTRAINT CK_users_account_status
		CHECK (account_status IN ('pending', 'active', 'archived', 'deactivated', 'deleted', 'rejected'));
	`)
	if err != nil {
		return fmt.Errorf("failed to ensure account status check constraint: %w", err)
	}

	return nil
}

// GetUsersByActivityStatus returns users filtered by activity status with last-login info.
//
// statusFilter values:
//
//	"active"      – is_active = 1, account_status = 'active', not soft-deleted
//	"archived"    – manually archived (account_status = 'archived')
//	"deactivated" – auto-deactivated after 6+ months of inactivity
//	"deleted"     – soft-deleted (account_status = 'deleted')
func (a *App) GetUsersByActivityStatus(statusFilter string) ([]User, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	var condition string
	switch statusFilter {
	case "active":
		condition = `up.is_active = 1 AND up.account_status = 'active' AND up.deleted_at IS NULL`
	case "archived":
		condition = `up.account_status = 'archived' AND up.deleted_at IS NULL`
	case "deactivated":
		condition = `up.account_status = 'deactivated' AND up.deactivated_at IS NOT NULL AND up.deleted_at IS NULL`
	case "deleted":
		condition = `up.account_status = 'deleted' OR up.deleted_at IS NOT NULL`
	default:
		return nil, fmt.Errorf("invalid status filter: %s", statusFilter)
	}

	// Build CTE query: profile UNION + last-login sub-query
	query := fmt.Sprintf(`
		WITH UserProfiles AS (
			SELECT
				u.id, u.username, u.user_type, u.created_at,
				a.first_name, a.middle_name, a.last_name,
				a.admin_id AS employee_id,
				CAST(NULL AS NVARCHAR(50)) AS student_id,
				a.email, a.contact_number,
				CAST(NULL AS NVARCHAR(20)) AS department_code,
				u.deactivated_at, u.deleted_at, u.is_active, u.account_status
			FROM users u
			JOIN admins a ON u.id = a.id
			WHERE u.user_type = 'admin'

			UNION ALL

			SELECT
				u.id, u.username, u.user_type, u.created_at,
				t.first_name, t.middle_name, t.last_name,
				t.teacher_id AS employee_id,
				CAST(NULL AS NVARCHAR(50)) AS student_id,
				t.email, t.contact_number, t.department_code,
				u.deactivated_at, u.deleted_at, u.is_active, u.account_status
			FROM users u
			JOIN teachers t ON u.id = t.id
			WHERE u.user_type = 'teacher'

			UNION ALL

			SELECT
				u.id, u.username, u.user_type, u.created_at,
				s.first_name, s.middle_name, s.last_name,
				CAST(NULL AS NVARCHAR(50)) AS employee_id, s.student_id,
				s.email, s.contact_number,
				s.department_code,
				u.deactivated_at, u.deleted_at, u.is_active, u.account_status
			FROM users u
			JOIN students s ON u.id = s.id
			WHERE u.user_type IN ('student', 'working_student')
		),
		LastLogins AS (
			SELECT user_id, MAX(login_time) AS last_login_at
			FROM log_entries
			GROUP BY user_id
		)
		SELECT
			up.id, up.username, up.user_type, up.created_at,
			up.first_name, up.middle_name, up.last_name,
			up.employee_id, up.student_id,
			up.email, up.contact_number, up.department_code,
			ll.last_login_at, up.deactivated_at, up.deleted_at, up.account_status
		FROM UserProfiles up
		LEFT JOIN LastLogins ll ON up.id = ll.user_id
		WHERE %s
		ORDER BY COALESCE(ll.last_login_at, up.created_at) DESC
	`, condition)

	rows, err := a.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query users by activity status: %w", err)
	}
	defer rows.Close()

	return a.scanUsersWithActivity(rows)
}

// scanUsersWithActivity scans rows from GetUsersByActivityStatus query into User structs.
func (a *App) scanUsersWithActivity(rows *sql.Rows) ([]User, error) {
	var users []User
	for rows.Next() {
		var user User
		var createdAt time.Time
		var firstName, middleName, lastName sql.NullString
		var employeeID, studentID sql.NullString
		var email, contactNumber, departmentCode sql.NullString
		var lastLoginAt, deactivatedAt, deletedAt sql.NullTime
		var accountStatus sql.NullString

		err := rows.Scan(
			&user.ID, &user.Name, &user.Role, &createdAt,
			&firstName, &middleName, &lastName,
			&employeeID, &studentID,
			&email, &contactNumber, &departmentCode,
			&lastLoginAt, &deactivatedAt, &deletedAt, &accountStatus,
		)
		if err != nil {
			log.Printf("Error scanning user with activity: %v", err)
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

		if lastLoginAt.Valid {
			formatted := lastLoginAt.Time.Format("2006-01-02 15:04:05")
			user.LastLoginAt = &formatted
			user.LastLoginAgo = timeAgo(lastLoginAt.Time)
		} else {
			user.LastLoginAgo = "Never logged in"
		}

		if deactivatedAt.Valid {
			formatted := deactivatedAt.Time.Format("2006-01-02 15:04:05")
			user.DeactivatedAt = &formatted
		}

		if deletedAt.Valid {
			formatted := deletedAt.Time.Format("2006-01-02 15:04:05")
			user.DeletedAt = &formatted
			user.ActivityStatus = "deleted"
		} else if accountStatus.Valid && accountStatus.String == "archived" {
			user.ActivityStatus = "archived"
		}

		if user.ActivityStatus == "" {
			if deactivatedAt.Valid || (accountStatus.Valid && accountStatus.String == "deactivated") {
				user.ActivityStatus = "deactivated"
			} else {
				user.ActivityStatus = "active"
			}
		}

		a.loadUserPhotoURL(&user)
		users = append(users, user)
	}

	return users, nil
}

// RunInactivityCheck scans all non-admin users and:
//   - Deactivates accounts with no login for 6+ months (sets deactivated_at)
//   - Soft-deletes accounts deactivated for 4+ years (sets deleted_at)
//
// Returns a map with keys "deactivated" and "deleted" reporting counts,
// and an error if either step fails.
func (a *App) RunInactivityCheck() (map[string]int, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	// Step 1: auto-deactivate accounts inactive for 6+ months
	deactivateResult, err := a.db.Exec(`
		UPDATE users
		SET is_active      = 0,
		    account_status = 'deactivated',
		    deactivated_at = GETDATE(),
		    updated_at     = GETDATE()
		WHERE id IN (
			SELECT u.id
			FROM users u
			LEFT JOIN (
				SELECT user_id, MAX(login_time) AS last_login_at
				FROM log_entries
				GROUP BY user_id
			) ll ON u.id = ll.user_id
			WHERE u.user_type != 'admin'
			  AND u.is_active    = 1
			  AND u.deleted_at  IS NULL
			  AND (
			      (ll.last_login_at IS NOT NULL AND ll.last_login_at <= DATEADD(MONTH, -6, GETDATE()))
			   OR (ll.last_login_at IS NULL      AND u.created_at    <= DATEADD(MONTH, -6, GETDATE()))
			  )
		)
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to deactivate inactive accounts: %w", err)
	}
	deactivated, _ := deactivateResult.RowsAffected()

	// Step 2: soft-delete accounts that have been deactivated for 4+ years
	softDeleteResult, err := a.db.Exec(`
		UPDATE users
		SET account_status = 'deleted',
		    deleted_at  = GETDATE(),
		    updated_at  = GETDATE()
		WHERE is_active       = 0
		  AND deactivated_at IS NOT NULL
		  AND deleted_at     IS NULL
		  AND deactivated_at <= DATEADD(YEAR, -4, GETDATE())
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to soft-delete expired accounts: %w", err)
	}
	softDeleted, _ := softDeleteResult.RowsAffected()

	log.Printf("Inactivity check complete: %d account(s) deactivated, %d account(s) flagged for deletion",
		deactivated, softDeleted)

	return map[string]int{
		"deactivated": int(deactivated),
		"deleted":     int(softDeleted),
	}, nil
}

// ReactivateUser restores a deactivated (or soft-deleted) account back to active.
// Only admins should be allowed to call this.
func (a *App) ReactivateUser(id int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	result, err := a.db.Exec(`
		UPDATE users
		SET is_active      = 1,
		    account_status = 'active',
		    deactivated_at = NULL,
		    deleted_at     = NULL,
		    updated_at     = GETDATE()
		WHERE id = ?
		  AND (is_active = 0 OR account_status != 'active')
	`, id)
	if err != nil {
		return fmt.Errorf("failed to reactivate user: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return fmt.Errorf("user not found or already active")
	}

	log.Printf("Admin reactivated user with ID: %d", id)
	return nil
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
