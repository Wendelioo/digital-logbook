package main

import (
	"database/sql"
	"encoding/base64"
	"encoding/csv"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	docx "github.com/lukasjarosch/go-docx"
)

// ==============================================================================
// USER MANAGEMENT METHODS
// ==============================================================================

// GetUsers returns all users with complete details
func (a *App) GetUsers() ([]User, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			a.first_name, a.middle_name, a.last_name,
			a.admin_id, NULL as student_id,
			a.email, a.contact_number, NULL as department_code
		FROM users u
		JOIN admins a ON u.id = a.id
		WHERE u.user_type = 'admin'
		UNION ALL
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			t.first_name, t.middle_name, t.last_name,
			t.teacher_id, NULL as student_id,
			t.email, t.contact_number, t.department_code
		FROM users u
		JOIN teachers t ON u.id = t.id
		WHERE u.user_type IN ('teacher')
		UNION ALL
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			s.first_name, s.middle_name, s.last_name,
			NULL as admin_id, s.student_id,
			s.email, s.contact_number, NULL as department_code
		FROM users u
		JOIN students s ON u.id = s.id
		WHERE u.user_type IN ('student', 'working_student')
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
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			a.first_name, a.middle_name, a.last_name,
			a.admin_id, NULL as student_id,
			a.email, a.contact_number, NULL as department_code
		FROM users u
		JOIN admins a ON u.id = a.id
		WHERE u.user_type = 'admin' AND u.user_type = ?
		UNION ALL
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			t.first_name, t.middle_name, t.last_name,
			t.teacher_id, NULL as student_id,
			t.email, t.contact_number, t.department_code
		FROM users u
		JOIN teachers t ON u.id = t.id
		WHERE u.user_type = 'teacher' AND u.user_type = ?
		UNION ALL
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			s.first_name, s.middle_name, s.last_name,
			NULL as admin_id, s.student_id,
			s.email, s.contact_number, NULL as department_code
		FROM users u
		JOIN students s ON u.id = s.id
		WHERE u.user_type IN ('student', 'working_student') AND u.user_type = ?
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
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			u.id, u.username, u.user_type, u.created_at,
			a.first_name, a.middle_name, a.last_name,
			a.admin_id, NULL as student_id,
			a.email, a.contact_number, NULL as department_code
		FROM users u
		JOIN admins a ON u.id = a.id
		WHERE u.user_type = 'admin' AND (
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
		WHERE u.user_type = 'teacher' AND (
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
		WHERE u.user_type IN ('student', 'working_student') AND (
			u.username LIKE ? OR
			s.first_name LIKE ? OR
			s.last_name LIKE ? OR
			s.middle_name LIKE ? OR
			s.student_id LIKE ? OR
			CONVERT(VARCHAR(10), u.created_at, 120) LIKE ?
		)
	`
	searchPattern := "%" + searchTerm + "%"
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
	if a.db == nil {
		return fmt.Errorf("database not connected")
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

	// Insert into users table
	query := `INSERT INTO users (username, password, user_type) OUTPUT INSERTED.id VALUES (?, ?, ?)`
	var userID int64
	err := a.db.QueryRow(query, username, password, role).Scan(&userID)
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
	if a.db == nil {
		return fmt.Errorf("database not connected")
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
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	query := `DELETE FROM users WHERE id = ?`
	_, err := a.db.Exec(query, id)
	return err
}

// ==============================================================================
// BULK USER CREATION METHODS
// ==============================================================================

// CreateUsersBulkFromFile creates multiple students from uploaded file (PDF, DOCX, CSV, TXT)
func (a *App) CreateUsersBulkFromFile(fileDataBase64 string, fileName string) (map[string]interface{}, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	fileData, err := base64.StdEncoding.DecodeString(fileDataBase64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode file data: %w", err)
	}

	if len(fileData) == 0 {
		return nil, fmt.Errorf("file is empty")
	}

	ext := strings.ToLower(filepath.Ext(fileName))
	textContent, err := a.parseFileContent(fileData, ext)
	if err != nil {
		return nil, err
	}

	records := extractStudentDataFromText(textContent)
	if len(records) == 0 {
		return nil, fmt.Errorf("no student data found in file")
	}

	return a.processBulkRecords(records)
}

// CreateUsersBulk creates multiple students from CSV data
func (a *App) CreateUsersBulk(csvData string) (map[string]interface{}, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	reader := csv.NewReader(strings.NewReader(csvData))
	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to parse CSV: %w", err)
	}

	if len(records) == 0 {
		return nil, fmt.Errorf("CSV file is empty")
	}

	return a.processBulkRecordsSimple(records)
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

		// Load profile photo from profile_photos table
		var photoPath sql.NullString
		photoQuery := `SELECT photo_path FROM profile_photos WHERE user_id = ?`
		err = a.db.QueryRow(photoQuery, user.ID).Scan(&photoPath)
		if err == nil && photoPath.Valid {
			user.PhotoPath = &photoPath.String
			// Convert file path to base64 data URL for frontend display
			if photoDataURL, err := a.convertPhotoToDataURL(photoPath.String); err == nil {
				user.PhotoURL = &photoDataURL
			}
		}

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
			return fmt.Errorf("⚠️ This Student ID is already registered. If you already have an account, please use the login form instead")
		}
		return fmt.Errorf("⚠️ This %s ID is already registered in the system", role)
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
		log.Printf("📝 Inserting working student - id: %d, student_id: %s, name: %s %s, email: %s", userID, studentID, firstName, lastName, email)
		_, err = a.db.Exec(query, userID, nullString(studentID), firstName, nullString(middleName), lastName, nullString(email), nullString(contactNumber), 1)
	}

	if err != nil {
		log.Printf("Failed to insert into %s table: %v", role, err)
		return fmt.Errorf("failed to create %s profile: %w", role, err)
	}

	return nil
}

// parseFileContent parses file content based on extension
func (a *App) parseFileContent(fileData []byte, ext string) (string, error) {
	switch ext {
	case ".pdf":
		return parsePDF(fileData)
	case ".docx", ".doc":
		return parseDOCX(fileData)
	case ".csv", ".txt":
		return string(fileData), nil
	default:
		return string(fileData), nil
	}
}

// processBulkRecords processes bulk student records with header detection
func (a *App) processBulkRecords(records [][]string) (map[string]interface{}, error) {
	startIndex := 0
	columnMap := make(map[string]int)

	if len(records) > 0 {
		firstRow := records[0]
		firstRowLower := strings.ToLower(strings.Join(firstRow, " "))

		isHeader := strings.Contains(firstRowLower, "student") ||
			strings.Contains(firstRowLower, "code") ||
			strings.Contains(firstRowLower, "id") ||
			strings.Contains(firstRowLower, "name") ||
			strings.Contains(firstRowLower, "email") ||
			strings.Contains(firstRowLower, "contact")

		if isHeader {
			startIndex = 1
			columnMap = detectColumns(firstRow)
		}
	}

	if len(columnMap) == 0 {
		columnMap = map[string]int{
			"student_code": 0,
			"first_name":   1,
			"last_name":    2,
		}
		if len(records) > 0 && len(records[0]) > 3 {
			columnMap["middle_name"] = 3
		}
		if len(records) > 0 && len(records[0]) > 4 {
			columnMap["contact"] = 4
		}
	}

	var successCount, errorCount int
	var errors []string

	for i, record := range records[startIndex:] {
		rowNum := i + startIndex + 1

		for len(record) < 3 {
			record = append(record, "")
		}

		studentCode := getColumnValue(record, columnMap["student_code"], true)
		firstName := getColumnValue(record, columnMap["first_name"], true)
		lastName := getColumnValue(record, columnMap["last_name"], true)
		middleName := getColumnValue(record, columnMap["middle_name"], columnMap["middle_name"] >= 0)
		email := getColumnValue(record, columnMap["email"], columnMap["email"] >= 0)
		contactNumber := getColumnValue(record, columnMap["contact"], columnMap["contact"] >= 0)

		if studentCode == "" || firstName == "" || lastName == "" {
			errorCount++
			errors = append(errors, fmt.Sprintf("Row %d: Missing required field", rowNum))
			continue
		}

		fullName := fmt.Sprintf("%s, %s", lastName, firstName)
		if middleName != "" {
			fullName = fmt.Sprintf("%s, %s %s", lastName, firstName, middleName)
		}

		err := a.CreateUser(studentCode, fullName, firstName, middleName, lastName, "student", "", studentCode, email, contactNumber, "")
		if err != nil {
			errorCount++
			errors = append(errors, fmt.Sprintf("Row %d (%s): %v", rowNum, studentCode, err))
			log.Printf("❌ Failed to create student at row %d: %v", rowNum, err)
		} else {
			successCount++
			log.Printf("✅ Created student: %s %s (Code: %s)", firstName, lastName, studentCode)
		}
	}

	return map[string]interface{}{
		"success_count": successCount,
		"error_count":   errorCount,
		"total_count":   len(records) - startIndex,
		"errors":        errors,
	}, nil
}

// processBulkRecordsSimple processes CSV records with simple format
func (a *App) processBulkRecordsSimple(records [][]string) (map[string]interface{}, error) {
	startIndex := 0
	if len(records) > 0 {
		firstRow := strings.ToLower(strings.Join(records[0], " "))
		if strings.Contains(firstRow, "student") || strings.Contains(firstRow, "code") || strings.Contains(firstRow, "name") {
			startIndex = 1
		}
	}

	var successCount, errorCount int
	var errors []string

	for i, record := range records[startIndex:] {
		rowNum := i + startIndex + 1

		if len(record) < 3 {
			errorCount++
			errors = append(errors, fmt.Sprintf("Row %d: Insufficient columns", rowNum))
			continue
		}

		studentCode := strings.TrimSpace(record[0])
		firstName := strings.TrimSpace(record[1])
		lastName := strings.TrimSpace(record[2])
		middleName := ""
		contactNumber := ""

		if len(record) >= 4 {
			middleName = strings.TrimSpace(record[3])
		}
		if len(record) >= 5 {
			contactNumber = strings.TrimSpace(record[4])
		}

		if studentCode == "" || firstName == "" || lastName == "" {
			errorCount++
			errors = append(errors, fmt.Sprintf("Row %d: Missing required field", rowNum))
			continue
		}

		fullName := fmt.Sprintf("%s, %s", lastName, firstName)
		if middleName != "" {
			fullName = fmt.Sprintf("%s, %s %s", lastName, firstName, middleName)
		}

		err := a.CreateUser(studentCode, fullName, firstName, middleName, lastName, "student", "", studentCode, "", contactNumber, "")
		if err != nil {
			errorCount++
			errors = append(errors, fmt.Sprintf("Row %d (%s): %v", rowNum, studentCode, err))
			log.Printf("❌ Failed to create student at row %d: %v", rowNum, err)
		} else {
			successCount++
			log.Printf("✅ Created student: %s %s (Code: %s)", firstName, lastName, studentCode)
		}
	}

	return map[string]interface{}{
		"success_count": successCount,
		"error_count":   errorCount,
		"total_count":   len(records) - startIndex,
		"errors":        errors,
	}, nil
}

// ==============================================================================
// FILE PARSING UTILITIES
// ==============================================================================

// extractStudentDataFromText extracts student information from text content
func extractStudentDataFromText(text string) [][]string {
	var records [][]string
	lines := strings.Split(text, "\n")

	studentCodePattern := regexp.MustCompile(`(?i)(?:student\s*(?:code|id|number)[:\s]*)?([A-Z0-9\-]{3,})`)
	namePattern := regexp.MustCompile(`([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)`)

	var currentRecord []string
	var foundCode bool

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		codeMatches := studentCodePattern.FindStringSubmatch(line)
		if len(codeMatches) > 1 && !foundCode {
			if len(currentRecord) >= 2 {
				records = append(records, currentRecord)
			}
			currentRecord = []string{codeMatches[1]}
			foundCode = true
			continue
		}

		if foundCode {
			nameMatches := namePattern.FindAllString(line, -1)
			if len(nameMatches) >= 2 {
				currentRecord = append(currentRecord, nameMatches[0])
				if len(nameMatches) >= 3 {
					currentRecord = append(currentRecord, nameMatches[len(nameMatches)-1])
					currentRecord = append(currentRecord, nameMatches[1])
				} else {
					currentRecord = append(currentRecord, nameMatches[len(nameMatches)-1])
					currentRecord = append(currentRecord, "")
				}
				foundCode = false
				if len(currentRecord) >= 3 {
					records = append(records, currentRecord)
					currentRecord = []string{}
				}
			}
		}
	}

	if len(currentRecord) >= 3 {
		records = append(records, currentRecord)
	}

	if len(records) == 0 {
		reader := csv.NewReader(strings.NewReader(text))
		csvRecords, err := reader.ReadAll()
		if err == nil && len(csvRecords) > 0 {
			return csvRecords
		}

		for _, line := range lines {
			if strings.Contains(line, "\t") {
				fields := strings.Split(line, "\t")
				if len(fields) >= 3 {
					records = append(records, fields)
				}
			} else if strings.Contains(line, ",") {
				fields := strings.Split(line, ",")
				cleanedFields := make([]string, len(fields))
				for i, f := range fields {
					cleanedFields[i] = strings.TrimSpace(f)
				}
				if len(cleanedFields) >= 3 {
					records = append(records, cleanedFields)
				}
			}
		}
	}

	return records
}

// parsePDF extracts text from PDF file
func parsePDF(fileData []byte) (string, error) {
	_ = fileData
	return "", fmt.Errorf("PDF parsing is not available. Please convert your PDF to CSV or TXT format, or use DOCX format")
}

// parseDOCX extracts text from DOCX file
func parseDOCX(fileData []byte) (string, error) {
	tmpFile, err := os.CreateTemp("", "docx_*.docx")
	if err != nil {
		return "", fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.Write(fileData); err != nil {
		tmpFile.Close()
		return "", fmt.Errorf("failed to write temp file: %w", err)
	}
	tmpFile.Close()

	doc, err := docx.Open(tmpFile.Name())
	if err != nil {
		return "", fmt.Errorf("failed to open DOCX: %w", err)
	}
	defer doc.Close()

	var text strings.Builder
	docXML := doc.GetFile("word/document.xml")
	if len(docXML) == 0 {
		return "", fmt.Errorf("could not read document.xml from DOCX file")
	}

	runParser := docx.NewRunParser(docXML)
	if err := runParser.Execute(); err != nil {
		return "", fmt.Errorf("failed to parse DOCX runs: %w", err)
	}

	runs := runParser.Runs()
	for _, run := range runs {
		if run != nil && run.HasText {
			runText := run.GetText(docXML)
			if runText != "" {
				text.WriteString(runText)
				text.WriteString(" ")
			}
		}
	}

	result := text.String()
	if result == "" {
		return "", fmt.Errorf("could not extract text from DOCX")
	}

	return result, nil
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
// Stores as file in uploads/profiles/ directory (improved from BLOB storage)
func (a *App) UpdateUserProfilePhoto(userID int, imageBase64 string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
	base64Data := imageBase64
	mimeType := "image/jpeg" // Default MIME type

	if strings.HasPrefix(imageBase64, "data:") {
		parts := strings.Split(imageBase64, ",")
		if len(parts) == 2 {
			// Extract MIME type from data URL (e.g., "data:image/png;base64,")
			mimeTypePart := strings.TrimPrefix(parts[0], "data:")
			mimeTypePart = strings.TrimSuffix(mimeTypePart, ";base64")
			if mimeTypePart != "" {
				mimeType = mimeTypePart
			}
			base64Data = parts[1]
		}
	}

	// Decode Base64 to binary
	imageBytes, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return fmt.Errorf("failed to decode base64 image: %w", err)
	}

	// Validate minimum size
	if len(imageBytes) < 100 {
		return fmt.Errorf("image too small: %d bytes (minimum 100 bytes)", len(imageBytes))
	}

	// Generate file name based on MIME type
	fileName := fmt.Sprintf("user_%d_photo", userID)
	switch mimeType {
	case "image/png":
		fileName += ".png"
	case "image/gif":
		fileName += ".gif"
	default:
		fileName += ".jpg"
	}

	// Use the new file-based upload system
	err = a.UploadProfilePhoto(userID, imageBytes, fileName, mimeType)
	if err != nil {
		return fmt.Errorf("failed to upload profile photo: %w", err)
	}

	log.Printf("Profile photo updated for user ID %d - %d bytes", userID, len(imageBytes))
	return nil
}

// DeleteUserProfilePhoto removes the profile photo for a user
func (a *App) DeleteUserProfilePhoto(userID int) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Use the new file-based delete system
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
	UserID              int       `json:"user_id"`
	StudentID           string    `json:"student_id"`
	FirstName           string    `json:"first_name"`
	MiddleName          *string   `json:"middle_name"`
	LastName            string    `json:"last_name"`
	Email               *string `json:"email"`
	ContactNumber       *string `json:"contact_number"`
	ArchivedAt          string  `json:"archived_at"`
	DeletionScheduledAt string  `json:"deletion_scheduled_at"`
	DaysUntilDeletion   int     `json:"days_until_deletion"`
}

// ArchiveStudent archives a graduated student account
// The account will be scheduled for deletion after 360 days
func (a *App) ArchiveStudent(studentUserID int) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
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
	if a.db == nil {
		return fmt.Errorf("database not connected")
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
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
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
	if a.db == nil {
		return 0, fmt.Errorf("database not connected")
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

// GetActiveStudentsForArchiving returns active students that can be archived
func (a *App) GetActiveStudentsForArchiving() ([]User, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
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
