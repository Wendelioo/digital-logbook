package main

import (
	"database/sql"
	"encoding/csv"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
)

// ==============================================================================
// LOGIN LOG QUERIES
// ==============================================================================

// GetTodayLogs returns only today's non-archived login logs
func (a *App) GetTodayLogs() ([]LoginLog, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			ll.id, 
			ll.user_id, 
			COALESCE(u.user_type, 'unknown') as user_type, 
			ll.pc_number, 
			ll.login_time, 
			ll.logout_time,
			COALESCE(
				CASE WHEN s.last_name IS NOT NULL AND s.first_name IS NOT NULL
					THEN CONCAT(s.last_name, ', ', s.first_name,
						CASE WHEN s.middle_name IS NOT NULL THEN CONCAT(' ', s.middle_name) ELSE '' END)
					ELSE NULL END,
				CASE WHEN t.last_name IS NOT NULL AND t.first_name IS NOT NULL
					THEN CONCAT(t.last_name, ', ', t.first_name,
						CASE WHEN t.middle_name IS NOT NULL THEN CONCAT(' ', t.middle_name) ELSE '' END)
					ELSE NULL END,
				CASE WHEN a.last_name IS NOT NULL AND a.first_name IS NOT NULL
					THEN CONCAT(a.last_name, ', ', a.first_name,
						CASE WHEN a.middle_name IS NOT NULL THEN CONCAT(' ', a.middle_name) ELSE '' END)
					ELSE NULL END,
				u.username
			) as full_name,
			COALESCE(
				s.student_number,
				t.employee_number,
				a.employee_number,
				u.username
			) as user_id_number
		FROM login_logs ll
		JOIN users u ON ll.user_id = u.id
		LEFT JOIN students s ON u.id = s.user_id AND u.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t ON u.id = t.user_id AND u.user_type = 'teacher'
		LEFT JOIN admins a ON u.id = a.user_id AND u.user_type = 'admin'
		WHERE DATE(ll.login_time) = CURDATE()
		AND (ll.is_archived = FALSE OR ll.is_archived IS NULL)
		ORDER BY ll.login_time DESC
	`

	rows, err := a.db.Query(query)
	if err != nil {
		log.Printf("Error querying today's logs: %v", err)
		return nil, fmt.Errorf("failed to query today's logs: %w", err)
	}
	defer rows.Close()

	var logs []LoginLog
	for rows.Next() {
		var logEntry LoginLog
		var pcNumber sql.NullString
		var loginTime time.Time
		var logoutTime sql.NullTime
		var userIDNumber sql.NullString

		err := rows.Scan(&logEntry.ID, &logEntry.UserID, &logEntry.UserType, &pcNumber, &loginTime, &logoutTime, &logEntry.UserName, &userIDNumber)
		if err != nil {
			log.Printf("Error scanning today's log row: %v", err)
			continue
		}

		logEntry.LoginTime = loginTime.Format("2006-01-02 15:04:05")
		if pcNumber.Valid {
			logEntry.PCNumber = &pcNumber.String
		}
		if logoutTime.Valid {
			formattedLogoutTime := logoutTime.Time.Format("2006-01-02 15:04:05")
			logEntry.LogoutTime = &formattedLogoutTime
		}
		if userIDNumber.Valid {
			logEntry.UserIDNumber = userIDNumber.String
		} else {
			logEntry.UserIDNumber = logEntry.UserName
		}

		logs = append(logs, logEntry)
	}

	log.Printf("GetTodayLogs returning %d logs", len(logs))
	return logs, nil
}

// GetPastLogs returns non-archived logs from previous days within a date range
func (a *App) GetPastLogs(startDate, endDate string) ([]LoginLog, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			ll.id, 
			ll.user_id, 
			COALESCE(u.user_type, 'unknown') as user_type, 
			ll.pc_number, 
			ll.login_time, 
			ll.logout_time,
			COALESCE(
				CASE WHEN s.last_name IS NOT NULL AND s.first_name IS NOT NULL
					THEN CONCAT(s.last_name, ', ', s.first_name,
						CASE WHEN s.middle_name IS NOT NULL THEN CONCAT(' ', s.middle_name) ELSE '' END)
					ELSE NULL END,
				CASE WHEN t.last_name IS NOT NULL AND t.first_name IS NOT NULL
					THEN CONCAT(t.last_name, ', ', t.first_name,
						CASE WHEN t.middle_name IS NOT NULL THEN CONCAT(' ', t.middle_name) ELSE '' END)
					ELSE NULL END,
				CASE WHEN a.last_name IS NOT NULL AND a.first_name IS NOT NULL
					THEN CONCAT(a.last_name, ', ', a.first_name,
						CASE WHEN a.middle_name IS NOT NULL THEN CONCAT(' ', a.middle_name) ELSE '' END)
					ELSE NULL END,
				u.username
			) as full_name,
			COALESCE(
				s.student_number,
				t.employee_number,
				a.employee_number,
				u.username
			) as user_id_number
		FROM login_logs ll
		JOIN users u ON ll.user_id = u.id
		LEFT JOIN students s ON u.id = s.user_id AND u.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t ON u.id = t.user_id AND u.user_type = 'teacher'
		LEFT JOIN admins a ON u.id = a.user_id AND u.user_type = 'admin'
		WHERE DATE(ll.login_time) < CURDATE()
		AND (ll.is_archived = FALSE OR ll.is_archived IS NULL)
		AND DATE(ll.login_time) BETWEEN ? AND ?
		ORDER BY ll.login_time DESC
		LIMIT 1000
	`

	rows, err := a.db.Query(query, startDate, endDate)
	if err != nil {
		log.Printf("Error querying past logs: %v", err)
		return nil, fmt.Errorf("failed to query past logs: %w", err)
	}
	defer rows.Close()

	var logs []LoginLog
	for rows.Next() {
		var logEntry LoginLog
		var pcNumber sql.NullString
		var loginTime time.Time
		var logoutTime sql.NullTime
		var userIDNumber sql.NullString

		err := rows.Scan(&logEntry.ID, &logEntry.UserID, &logEntry.UserType, &pcNumber, &loginTime, &logoutTime, &logEntry.UserName, &userIDNumber)
		if err != nil {
			log.Printf("Error scanning past log row: %v", err)
			continue
		}

		logEntry.LoginTime = loginTime.Format("2006-01-02 15:04:05")
		if pcNumber.Valid {
			logEntry.PCNumber = &pcNumber.String
		}
		if logoutTime.Valid {
			formattedLogoutTime := logoutTime.Time.Format("2006-01-02 15:04:05")
			logEntry.LogoutTime = &formattedLogoutTime
		}
		if userIDNumber.Valid {
			logEntry.UserIDNumber = userIDNumber.String
		} else {
			logEntry.UserIDNumber = logEntry.UserName
		}

		logs = append(logs, logEntry)
	}

	log.Printf("GetPastLogs returning %d logs for range %s to %s", len(logs), startDate, endDate)
	return logs, nil
}

// ArchiveSelectedLogs archives multiple logs at once
func (a *App) ArchiveSelectedLogs(logIDs []int, archivedByUserID int) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	if len(logIDs) == 0 {
		return fmt.Errorf("no log IDs provided")
	}

	// Build placeholders for IN clause
	placeholders := make([]string, len(logIDs))
	args := make([]interface{}, len(logIDs)+1)
	args[0] = archivedByUserID
	
	for i, id := range logIDs {
		placeholders[i] = "?"
		args[i+1] = id
	}

	query := fmt.Sprintf(`
		UPDATE login_logs 
		SET is_archived = TRUE, 
			archived_at = NOW(), 
			archived_by_user_id = ?
		WHERE id IN (%s)
	`, strings.Join(placeholders, ","))

	result, err := a.db.Exec(query, args...)
	if err != nil {
		log.Printf("Error archiving logs: %v", err)
		return fmt.Errorf("failed to archive logs: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("Archived %d log entries", rowsAffected)
	return nil
}

// UnarchiveLogs restores archived logs back to active state
func (a *App) UnarchiveLogs(logIDs []int) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	if len(logIDs) == 0 {
		return fmt.Errorf("no log IDs provided")
	}

	placeholders := make([]string, len(logIDs))
	args := make([]interface{}, len(logIDs))
	
	for i, id := range logIDs {
		placeholders[i] = "?"
		args[i] = id
	}

	query := fmt.Sprintf(`
		UPDATE login_logs 
		SET is_archived = FALSE, 
			archived_at = NULL, 
			archived_by_user_id = NULL
		WHERE id IN (%s)
	`, strings.Join(placeholders, ","))

	result, err := a.db.Exec(query, args...)
	if err != nil {
		log.Printf("Error unarchiving logs: %v", err)
		return fmt.Errorf("failed to unarchive logs: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("Unarchived %d log entries", rowsAffected)
	return nil
}

// GetArchivedLogs returns all archived logs grouped by archive date
func (a *App) GetArchivedLogs() ([]LoginLog, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			ll.id, 
			ll.user_id, 
			COALESCE(u.user_type, 'unknown') as user_type, 
			ll.pc_number, 
			ll.login_time, 
			ll.logout_time,
			COALESCE(
				CASE WHEN s.last_name IS NOT NULL AND s.first_name IS NOT NULL
					THEN CONCAT(s.last_name, ', ', s.first_name,
						CASE WHEN s.middle_name IS NOT NULL THEN CONCAT(' ', s.middle_name) ELSE '' END)
					ELSE NULL END,
				CASE WHEN t.last_name IS NOT NULL AND t.first_name IS NOT NULL
					THEN CONCAT(t.last_name, ', ', t.first_name,
						CASE WHEN t.middle_name IS NOT NULL THEN CONCAT(' ', t.middle_name) ELSE '' END)
					ELSE NULL END,
				CASE WHEN a.last_name IS NOT NULL AND a.first_name IS NOT NULL
					THEN CONCAT(a.last_name, ', ', a.first_name,
						CASE WHEN a.middle_name IS NOT NULL THEN CONCAT(' ', a.middle_name) ELSE '' END)
					ELSE NULL END,
				u.username
			) as full_name,
			COALESCE(
				s.student_number,
				t.employee_number,
				a.employee_number,
				u.username
			) as user_id_number
		FROM login_logs ll
		JOIN users u ON ll.user_id = u.id
		LEFT JOIN students s ON u.id = s.user_id AND u.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t ON u.id = t.user_id AND u.user_type = 'teacher'
		LEFT JOIN admins a ON u.id = a.user_id AND u.user_type = 'admin'
		WHERE ll.is_archived = TRUE
		ORDER BY ll.archived_at DESC, ll.login_time DESC
		LIMIT 2000
	`

	rows, err := a.db.Query(query)
	if err != nil {
		log.Printf("Error querying archived logs: %v", err)
		return nil, fmt.Errorf("failed to query archived logs: %w", err)
	}
	defer rows.Close()

	var logs []LoginLog
	for rows.Next() {
		var logEntry LoginLog
		var pcNumber sql.NullString
		var loginTime time.Time
		var logoutTime sql.NullTime
		var userIDNumber sql.NullString

		err := rows.Scan(&logEntry.ID, &logEntry.UserID, &logEntry.UserType, &pcNumber, &loginTime, &logoutTime, &logEntry.UserName, &userIDNumber)
		if err != nil {
			log.Printf("Error scanning archived log row: %v", err)
			continue
		}

		logEntry.LoginTime = loginTime.Format("2006-01-02 15:04:05")
		if pcNumber.Valid {
			logEntry.PCNumber = &pcNumber.String
		}
		if logoutTime.Valid {
			formattedLogoutTime := logoutTime.Time.Format("2006-01-02 15:04:05")
			logEntry.LogoutTime = &formattedLogoutTime
		}
		if userIDNumber.Valid {
			logEntry.UserIDNumber = userIDNumber.String
		} else {
			logEntry.UserIDNumber = logEntry.UserName
		}

		logs = append(logs, logEntry)
	}

	log.Printf("GetArchivedLogs returning %d logs", len(logs))
	return logs, nil
}

// GetAllLogs returns all non-archived login logs (limited to 1000 most recent)
func (a *App) GetAllLogs() ([]LoginLog, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	// Query login_logs directly with joins to ensure all logs are returned
	// even if user profile data is missing
	// Only returns non-archived logs (is_archived = FALSE or NULL for backwards compatibility)
	query := `
		SELECT 
			ll.id, 
			ll.user_id, 
			COALESCE(u.user_type, 'unknown') as user_type, 
			ll.pc_number, 
			ll.login_time, 
			ll.logout_time,
			COALESCE(
				CASE WHEN s.last_name IS NOT NULL AND s.first_name IS NOT NULL
					THEN CONCAT(s.last_name, ', ', s.first_name,
						CASE WHEN s.middle_name IS NOT NULL THEN CONCAT(' ', s.middle_name) ELSE '' END)
					ELSE NULL END,
				CASE WHEN t.last_name IS NOT NULL AND t.first_name IS NOT NULL
					THEN CONCAT(t.last_name, ', ', t.first_name,
						CASE WHEN t.middle_name IS NOT NULL THEN CONCAT(' ', t.middle_name) ELSE '' END)
					ELSE NULL END,
				CASE WHEN a.last_name IS NOT NULL AND a.first_name IS NOT NULL
					THEN CONCAT(a.last_name, ', ', a.first_name,
						CASE WHEN a.middle_name IS NOT NULL THEN CONCAT(' ', a.middle_name) ELSE '' END)
					ELSE NULL END,
				u.username
			) as full_name,
			COALESCE(
				s.student_number,
				t.employee_number,
				a.employee_number,
				u.username
			) as user_id_number
		FROM login_logs ll
		JOIN users u ON ll.user_id = u.id
		LEFT JOIN students s ON u.id = s.user_id AND u.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t ON u.id = t.user_id AND u.user_type = 'teacher'
		LEFT JOIN admins a ON u.id = a.user_id AND u.user_type = 'admin'
		WHERE (ll.is_archived = FALSE OR ll.is_archived IS NULL)
		ORDER BY ll.login_time DESC 
		LIMIT 1000
	`
	rows, err := a.db.Query(query)
	if err != nil {
		log.Printf("Error querying login logs in GetAllLogs: %v", err)
		return nil, fmt.Errorf("failed to query login logs: %w", err)
	}
	defer rows.Close()

	var logs []LoginLog
	for rows.Next() {
		var logEntry LoginLog
		var pcNumber sql.NullString
		var loginTime time.Time
		var logoutTime sql.NullTime
		var userIDNumber sql.NullString

		err := rows.Scan(&logEntry.ID, &logEntry.UserID, &logEntry.UserType, &pcNumber, &loginTime, &logoutTime, &logEntry.UserName, &userIDNumber)
		if err != nil {
			log.Printf("Error scanning login log row in GetAllLogs: %v", err)
			continue
		}

		logEntry.LoginTime = loginTime.Format("2006-01-02 15:04:05")
		if pcNumber.Valid {
			logEntry.PCNumber = &pcNumber.String
		}
		if logoutTime.Valid {
			formattedLogoutTime := logoutTime.Time.Format("2006-01-02 15:04:05")
			logEntry.LogoutTime = &formattedLogoutTime
		}
		if userIDNumber.Valid {
			logEntry.UserIDNumber = userIDNumber.String
		} else {
			logEntry.UserIDNumber = logEntry.UserName // Fallback to username if ID number not found
		}

		logs = append(logs, logEntry)
	}

	log.Printf("GetAllLogs returning %d logs", len(logs))
	return logs, nil
}

// GetStudentLoginLogs returns login logs for a specific student (limited to 100 most recent)
func (a *App) GetStudentLoginLogs(userID int) ([]LoginLog, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	log.Printf("GetStudentLoginLogs called for userID: %d", userID)

	// Query the login_logs table directly and join with users to get the name
	query := `
		SELECT 
			ll.id, 
			ll.user_id, 
			COALESCE(u.user_type, 'unknown') as user_type, 
			ll.pc_number, 
			ll.login_time, 
			ll.logout_time,
			COALESCE(
				CASE WHEN s.last_name IS NOT NULL AND s.first_name IS NOT NULL
					THEN CONCAT(s.last_name, ', ', s.first_name,
						CASE WHEN s.middle_name IS NOT NULL THEN CONCAT(' ', s.middle_name) ELSE '' END)
					ELSE NULL END,
				CASE WHEN t.last_name IS NOT NULL AND t.first_name IS NOT NULL
					THEN CONCAT(t.last_name, ', ', t.first_name,
						CASE WHEN t.middle_name IS NOT NULL THEN CONCAT(' ', t.middle_name) ELSE '' END)
					ELSE NULL END,
				CASE WHEN a.last_name IS NOT NULL AND a.first_name IS NOT NULL
					THEN CONCAT(a.last_name, ', ', a.first_name,
						CASE WHEN a.middle_name IS NOT NULL THEN CONCAT(' ', a.middle_name) ELSE '' END)
					ELSE NULL END,
				u.username
			) as full_name,
			COALESCE(
				s.student_number,
				t.employee_number,
				a.employee_number,
				u.username
			) as user_id_number
		FROM login_logs ll
		JOIN users u ON ll.user_id = u.id
		LEFT JOIN students s ON u.id = s.user_id AND u.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t ON u.id = t.user_id AND u.user_type = 'teacher'
		LEFT JOIN admins a ON u.id = a.user_id AND u.user_type = 'admin'
		WHERE ll.user_id = ?
		ORDER BY ll.login_time DESC 
		LIMIT 100
	`
	rows, err := a.db.Query(query, userID)
	if err != nil {
		log.Printf("Error querying login logs: %v", err)
		return nil, fmt.Errorf("failed to query login logs: %w", err)
	}
	defer rows.Close()

	var logs []LoginLog
	for rows.Next() {
		var logEntry LoginLog
		var pcNumber sql.NullString
		var loginTime time.Time
		var logoutTime sql.NullTime
		var userIDNumber sql.NullString

		err := rows.Scan(&logEntry.ID, &logEntry.UserID, &logEntry.UserType, &pcNumber, &loginTime, &logoutTime, &logEntry.UserName, &userIDNumber)
		if err != nil {
			log.Printf("Error scanning login log row: %v", err)
			continue
		}

		logEntry.LoginTime = loginTime.Format("2006-01-02 15:04:05")
		if pcNumber.Valid {
			logEntry.PCNumber = &pcNumber.String
		}
		if logoutTime.Valid {
			formattedLogoutTime := logoutTime.Time.Format("2006-01-02 15:04:05")
			logEntry.LogoutTime = &formattedLogoutTime
		}
		if userIDNumber.Valid {
			logEntry.UserIDNumber = userIDNumber.String
		} else {
			logEntry.UserIDNumber = logEntry.UserName // Fallback to username if ID number not found
		}

		logs = append(logs, logEntry)
	}

	log.Printf("GetStudentLoginLogs returning %d logs for user %d", len(logs), userID)
	return logs, nil
}

// GetTeacherLoginLogs returns login logs for a specific teacher (limited to 100 most recent)
func (a *App) GetTeacherLoginLogs(userID int) ([]LoginLog, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	log.Printf("GetTeacherLoginLogs called for userID: %d", userID)

	query := `
		SELECT 
			ll.id, 
			ll.user_id, 
			COALESCE(u.user_type, 'unknown') as user_type, 
			ll.pc_number, 
			ll.login_time, 
			ll.logout_time,
			COALESCE(
				CASE WHEN s.last_name IS NOT NULL AND s.first_name IS NOT NULL
					THEN CONCAT(s.last_name, ', ', s.first_name,
						CASE WHEN s.middle_name IS NOT NULL THEN CONCAT(' ', s.middle_name) ELSE '' END)
					ELSE NULL END,
				CASE WHEN t.last_name IS NOT NULL AND t.first_name IS NOT NULL
					THEN CONCAT(t.last_name, ', ', t.first_name,
						CASE WHEN t.middle_name IS NOT NULL THEN CONCAT(' ', t.middle_name) ELSE '' END)
					ELSE NULL END,
				CASE WHEN a.last_name IS NOT NULL AND a.first_name IS NOT NULL
					THEN CONCAT(a.last_name, ', ', a.first_name,
						CASE WHEN a.middle_name IS NOT NULL THEN CONCAT(' ', a.middle_name) ELSE '' END)
					ELSE NULL END,
				u.username
			) as full_name,
			COALESCE(
				s.student_number,
				t.employee_number,
				a.employee_number,
				u.username
			) as user_id_number
		FROM login_logs ll
		JOIN users u ON ll.user_id = u.id
		LEFT JOIN students s ON u.id = s.user_id AND u.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t ON u.id = t.user_id AND u.user_type = 'teacher'
		LEFT JOIN admins a ON u.id = a.user_id AND u.user_type = 'admin'
		WHERE ll.user_id = ? AND u.user_type = 'teacher'
		ORDER BY ll.login_time DESC 
		LIMIT 100
	`

	rows, err := a.db.Query(query, userID)
	if err != nil {
		log.Printf("Error querying teacher login logs: %v", err)
		return nil, fmt.Errorf("failed to query login logs: %w", err)
	}
	defer rows.Close()

	var logs []LoginLog
	for rows.Next() {
		var logEntry LoginLog
		var pcNumber sql.NullString
		var loginTime time.Time
		var logoutTime sql.NullTime
		var userIDNumber sql.NullString

		err := rows.Scan(&logEntry.ID, &logEntry.UserID, &logEntry.UserType, &pcNumber, &loginTime, &logoutTime, &logEntry.UserName, &userIDNumber)
		if err != nil {
			log.Printf("Error scanning login log row for teacher: %v", err)
			continue
		}

		logEntry.LoginTime = loginTime.Format("2006-01-02 15:04:05")
		if pcNumber.Valid {
			logEntry.PCNumber = &pcNumber.String
		}
		if logoutTime.Valid {
			formattedLogoutTime := logoutTime.Time.Format("2006-01-02 15:04:05")
			logEntry.LogoutTime = &formattedLogoutTime
		}
		if userIDNumber.Valid {
			logEntry.UserIDNumber = userIDNumber.String
		} else {
			logEntry.UserIDNumber = logEntry.UserName
		}

		logs = append(logs, logEntry)
	}

	log.Printf("GetTeacherLoginLogs returning %d logs for user %d", len(logs), userID)
	return logs, nil
}

// ==============================================================================
// LOGIN LOG EXPORT FUNCTIONS
// ==============================================================================

// ExportLogsCSV exports login logs to CSV format
func (a *App) ExportLogsCSV() (string, error) {
	logs, err := a.GetAllLogs()
	if err != nil {
		return "", err
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("login_logs_%s.csv", time.Now().Format("20060102_150405")))

	file, err := os.Create(filename)
	if err != nil {
		return "", err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// Write header
	writer.Write([]string{"ID", "User ID", "User Type", "PC Number", "Login Time", "Logout Time"})

	// Write data
	for _, log := range logs {
		pcNum := ""
		if log.PCNumber != nil {
			pcNum = *log.PCNumber
		}
		logoutTime := ""
		if log.LogoutTime != nil {
			logoutTime = *log.LogoutTime
		}

		writer.Write([]string{
			strconv.Itoa(log.ID),
			strconv.Itoa(log.UserID),
			log.UserType,
			pcNum,
			log.LoginTime,
			logoutTime,
		})
	}

	return filename, nil
}

// ExportLogsPDF exports login logs to PDF format
func (a *App) ExportLogsPDF() (string, error) {
	logs, err := a.GetAllLogs()
	if err != nil {
		return "", err
	}

	pdf := gofpdf.New("L", "mm", "A4", "")
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 16)
	pdf.Cell(0, 10, "Login Logs Report")
	pdf.Ln(12)

	pdf.SetFont("Arial", "B", 10)
	pdf.Cell(20, 7, "ID")
	pdf.Cell(30, 7, "User ID")
	pdf.Cell(40, 7, "User Type")
	pdf.Cell(40, 7, "PC Number")
	pdf.Cell(70, 7, "Login Time")
	pdf.Cell(70, 7, "Logout Time")
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 9)
	for _, log := range logs {
		pcNum := ""
		if log.PCNumber != nil {
			pcNum = *log.PCNumber
		}
		logoutTime := ""
		if log.LogoutTime != nil {
			logoutTime = *log.LogoutTime
		}

		pdf.Cell(20, 6, strconv.Itoa(log.ID))
		pdf.Cell(30, 6, strconv.Itoa(log.UserID))
		pdf.Cell(40, 6, log.UserType)
		pdf.Cell(40, 6, pcNum)
		pdf.Cell(70, 6, log.LoginTime)
		pdf.Cell(70, 6, logoutTime)
		pdf.Ln(-1)
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("login_logs_%s.pdf", time.Now().Format("20060102_150405")))
	err = pdf.OutputFileAndClose(filename)
	return filename, err
}

// ==============================================================================
// LOGIN LOG ARCHIVE FUNCTIONS (DOCUMENT-BASED)
// ==============================================================================

// ArchivedLogSheet represents a summary of archived login logs for a specific date
type ArchivedLogSheet struct {
	Date           string `json:"date"`
	TotalLogins    int    `json:"total_logins"`
	StudentCount   int    `json:"student_count"`
	TeacherCount   int    `json:"teacher_count"`
	AdminCount     int    `json:"admin_count"`
	WorkingStudentCount int `json:"working_student_count"`
	UniquePCs      int    `json:"unique_pcs"`
}

// GetArchivedLogSheets returns all archived log sheets grouped by date
func (a *App) GetArchivedLogSheets() ([]ArchivedLogSheet, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			DATE(ll.login_time) as log_date,
			COUNT(*) as total_logins,
			SUM(CASE WHEN u.user_type = 'student' THEN 1 ELSE 0 END) as student_count,
			SUM(CASE WHEN u.user_type = 'teacher' THEN 1 ELSE 0 END) as teacher_count,
			SUM(CASE WHEN u.user_type = 'admin' THEN 1 ELSE 0 END) as admin_count,
			SUM(CASE WHEN u.user_type = 'working_student' THEN 1 ELSE 0 END) as working_student_count,
			COUNT(DISTINCT ll.pc_number) as unique_pcs
		FROM login_logs ll
		JOIN users u ON ll.user_id = u.id
		WHERE ll.is_archived = TRUE
		GROUP BY DATE(ll.login_time)
		ORDER BY log_date DESC
	`

	rows, err := a.db.Query(query)
	if err != nil {
		log.Printf("⚠ Failed to query archived log sheets: %v", err)
		return nil, err
	}
	defer rows.Close()

	var sheets []ArchivedLogSheet
	for rows.Next() {
		var sheet ArchivedLogSheet
		err := rows.Scan(
			&sheet.Date, &sheet.TotalLogins,
			&sheet.StudentCount, &sheet.TeacherCount,
			&sheet.AdminCount, &sheet.WorkingStudentCount,
			&sheet.UniquePCs,
		)
		if err != nil {
			log.Printf("⚠ Failed to scan archived log sheet: %v", err)
			continue
		}
		sheets = append(sheets, sheet)
	}

	log.Printf("GetArchivedLogSheets returning %d sheets", len(sheets))
	return sheets, nil
}

// GetArchivedLogsByDate returns all archived login logs for a specific date
func (a *App) GetArchivedLogsByDate(date string) ([]LoginLog, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			ll.id, 
			ll.user_id, 
			COALESCE(u.user_type, 'unknown') as user_type, 
			ll.pc_number, 
			ll.login_time, 
			ll.logout_time,
			COALESCE(
				CASE WHEN s.last_name IS NOT NULL AND s.first_name IS NOT NULL
					THEN CONCAT(s.last_name, ', ', s.first_name,
						CASE WHEN s.middle_name IS NOT NULL THEN CONCAT(' ', s.middle_name) ELSE '' END)
					ELSE NULL END,
				CASE WHEN t.last_name IS NOT NULL AND t.first_name IS NOT NULL
					THEN CONCAT(t.last_name, ', ', t.first_name,
						CASE WHEN t.middle_name IS NOT NULL THEN CONCAT(' ', t.middle_name) ELSE '' END)
					ELSE NULL END,
				CASE WHEN ad.last_name IS NOT NULL AND ad.first_name IS NOT NULL
					THEN CONCAT(ad.last_name, ', ', ad.first_name,
						CASE WHEN ad.middle_name IS NOT NULL THEN CONCAT(' ', ad.middle_name) ELSE '' END)
					ELSE NULL END,
				u.username
			) as full_name,
			COALESCE(
				s.student_number,
				t.employee_number,
				ad.employee_number,
				u.username
			) as user_id_number
		FROM login_logs ll
		JOIN users u ON ll.user_id = u.id
		LEFT JOIN students s ON u.id = s.user_id AND u.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t ON u.id = t.user_id AND u.user_type = 'teacher'
		LEFT JOIN admins ad ON u.id = ad.user_id AND u.user_type = 'admin'
		WHERE ll.is_archived = TRUE AND DATE(ll.login_time) = ?
		ORDER BY ll.login_time DESC
	`

	rows, err := a.db.Query(query, date)
	if err != nil {
		log.Printf("Error querying archived logs by date: %v", err)
		return nil, fmt.Errorf("failed to query archived logs: %w", err)
	}
	defer rows.Close()

	var logs []LoginLog
	for rows.Next() {
		var logEntry LoginLog
		var pcNumber sql.NullString
		var loginTime time.Time
		var logoutTime sql.NullTime
		var userIDNumber sql.NullString

		err := rows.Scan(&logEntry.ID, &logEntry.UserID, &logEntry.UserType, &pcNumber, &loginTime, &logoutTime, &logEntry.UserName, &userIDNumber)
		if err != nil {
			log.Printf("Error scanning archived login log row: %v", err)
			continue
		}

		logEntry.LoginTime = loginTime.Format("2006-01-02 15:04:05")
		if pcNumber.Valid {
			logEntry.PCNumber = &pcNumber.String
		}
		if logoutTime.Valid {
			formattedLogoutTime := logoutTime.Time.Format("2006-01-02 15:04:05")
			logEntry.LogoutTime = &formattedLogoutTime
		}
		if userIDNumber.Valid {
			logEntry.UserIDNumber = userIDNumber.String
		} else {
			logEntry.UserIDNumber = logEntry.UserName
		}

		logs = append(logs, logEntry)
	}

	log.Printf("GetArchivedLogsByDate(%s) returning %d logs", date, len(logs))
	return logs, nil
}

// ArchiveLogsByDate archives all login logs for a specific date
func (a *App) ArchiveLogsByDate(date string, adminUserID int) (int, error) {
	if a.db == nil {
		return 0, fmt.Errorf("database not connected")
	}

	query := `UPDATE login_logs 
		SET is_archived = TRUE, 
		    archived_at = NOW(), 
		    archived_by_user_id = ?
		WHERE DATE(login_time) = ? AND (is_archived = FALSE OR is_archived IS NULL)`

	result, err := a.db.Exec(query, adminUserID, date)
	if err != nil {
		log.Printf("Failed to archive logs by date: %v", err)
		return 0, fmt.Errorf("failed to archive logs: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	log.Printf("✓ %d login logs archived for date %s by admin %d", rowsAffected, date, adminUserID)
	return int(rowsAffected), nil
}

// UnarchiveLogSheet unarchives all login logs for a specific date
func (a *App) UnarchiveLogSheet(date string) (int, error) {
	if a.db == nil {
		return 0, fmt.Errorf("database not connected")
	}

	query := `UPDATE login_logs 
		SET is_archived = FALSE, 
		    archived_at = NULL, 
		    archived_by_user_id = NULL
		WHERE DATE(login_time) = ? AND is_archived = TRUE`

	result, err := a.db.Exec(query, date)
	if err != nil {
		log.Printf("Failed to unarchive log sheet: %v", err)
		return 0, fmt.Errorf("failed to unarchive logs: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	log.Printf("✓ %d login logs unarchived for date %s", rowsAffected, date)
	return int(rowsAffected), nil
}

// GetLogDates returns distinct dates with available (non-archived) logs
func (a *App) GetLogDates() ([]string, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT DISTINCT DATE(login_time) as log_date
		FROM login_logs
		WHERE is_archived = FALSE OR is_archived IS NULL
		ORDER BY log_date DESC
	`

	rows, err := a.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var dates []string
	for rows.Next() {
		var date string
		if err := rows.Scan(&date); err != nil {
			continue
		}
		dates = append(dates, date)
	}

	return dates, nil
}

// ExportArchivedLogSheetCSV exports archived logs for a specific date to CSV
func (a *App) ExportArchivedLogSheetCSV(date string) (string, error) {
	logs, err := a.GetArchivedLogsByDate(date)
	if err != nil {
		return "", err
	}

	if len(logs) == 0 {
		return "", fmt.Errorf("no archived logs for date %s", date)
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("login_logs_%s.csv", date))

	file, err := os.Create(filename)
	if err != nil {
		return "", err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// Write header
	writer.Write([]string{"ID", "User Name", "User ID Number", "User Type", "PC Number", "Login Time", "Logout Time"})

	// Write data
	for _, log := range logs {
		pcNum := ""
		if log.PCNumber != nil {
			pcNum = *log.PCNumber
		}
		logoutTime := ""
		if log.LogoutTime != nil {
			logoutTime = *log.LogoutTime
		}

		writer.Write([]string{
			strconv.Itoa(log.ID),
			log.UserName,
			log.UserIDNumber,
			log.UserType,
			pcNum,
			log.LoginTime,
			logoutTime,
		})
	}

	return filename, nil
}

// ExportArchivedLogSheetPDF exports archived logs for a specific date to PDF
func (a *App) ExportArchivedLogSheetPDF(date string) (string, error) {
	logs, err := a.GetArchivedLogsByDate(date)
	if err != nil {
		return "", err
	}

	if len(logs) == 0 {
		return "", fmt.Errorf("no archived logs for date %s", date)
	}

	pdf := gofpdf.New("L", "mm", "A4", "")
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 16)
	pdf.Cell(0, 10, fmt.Sprintf("Login Logs Report - %s", date))
	pdf.Ln(12)

	// Add generation date
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(0, 6, fmt.Sprintf("Generated: %s", time.Now().Format("January 02, 2006 3:04 PM")))
	pdf.Ln(10)

	pdf.SetFont("Arial", "B", 9)
	pdf.Cell(15, 7, "ID")
	pdf.Cell(50, 7, "User Name")
	pdf.Cell(35, 7, "ID Number")
	pdf.Cell(30, 7, "User Type")
	pdf.Cell(35, 7, "PC Number")
	pdf.Cell(50, 7, "Login Time")
	pdf.Cell(50, 7, "Logout Time")
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 8)
	for _, log := range logs {
		pcNum := ""
		if log.PCNumber != nil {
			pcNum = *log.PCNumber
		}
		logoutTime := ""
		if log.LogoutTime != nil {
			logoutTime = *log.LogoutTime
		}

		pdf.Cell(15, 6, strconv.Itoa(log.ID))
		pdf.Cell(50, 6, truncateString(log.UserName, 25))
		pdf.Cell(35, 6, log.UserIDNumber)
		pdf.Cell(30, 6, log.UserType)
		pdf.Cell(35, 6, pcNum)
		pdf.Cell(50, 6, log.LoginTime)
		pdf.Cell(50, 6, logoutTime)
		pdf.Ln(-1)
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("login_logs_%s.pdf", date))
	err = pdf.OutputFileAndClose(filename)
	return filename, err
}

// Legacy function kept for backwards compatibility - returns all archived logs
func (a *App) GetArchivedLogs() ([]LoginLog, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			ll.id, 
			ll.user_id, 
			COALESCE(u.user_type, 'unknown') as user_type, 
			ll.pc_number, 
			ll.login_time, 
			ll.logout_time,
			COALESCE(
				CASE WHEN s.last_name IS NOT NULL AND s.first_name IS NOT NULL
					THEN CONCAT(s.last_name, ', ', s.first_name,
						CASE WHEN s.middle_name IS NOT NULL THEN CONCAT(' ', s.middle_name) ELSE '' END)
					ELSE NULL END,
				CASE WHEN t.last_name IS NOT NULL AND t.first_name IS NOT NULL
					THEN CONCAT(t.last_name, ', ', t.first_name,
						CASE WHEN t.middle_name IS NOT NULL THEN CONCAT(' ', t.middle_name) ELSE '' END)
					ELSE NULL END,
				CASE WHEN ad.last_name IS NOT NULL AND ad.first_name IS NOT NULL
					THEN CONCAT(ad.last_name, ', ', ad.first_name,
						CASE WHEN ad.middle_name IS NOT NULL THEN CONCAT(' ', ad.middle_name) ELSE '' END)
					ELSE NULL END,
				u.username
			) as full_name,
			COALESCE(
				s.student_number,
				t.employee_number,
				ad.employee_number,
				u.username
			) as user_id_number
		FROM login_logs ll
		JOIN users u ON ll.user_id = u.id
		LEFT JOIN students s ON u.id = s.user_id AND u.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t ON u.id = t.user_id AND u.user_type = 'teacher'
		LEFT JOIN admins ad ON u.id = ad.user_id AND u.user_type = 'admin'
		WHERE ll.is_archived = TRUE
		ORDER BY ll.archived_at DESC, ll.login_time DESC 
		LIMIT 1000
	`
	rows, err := a.db.Query(query)
	if err != nil {
		log.Printf("Error querying archived login logs: %v", err)
		return nil, fmt.Errorf("failed to query archived login logs: %w", err)
	}
	defer rows.Close()

	var logs []LoginLog
	for rows.Next() {
		var logEntry LoginLog
		var pcNumber sql.NullString
		var loginTime time.Time
		var logoutTime sql.NullTime
		var userIDNumber sql.NullString

		err := rows.Scan(&logEntry.ID, &logEntry.UserID, &logEntry.UserType, &pcNumber, &loginTime, &logoutTime, &logEntry.UserName, &userIDNumber)
		if err != nil {
			log.Printf("Error scanning archived login log row: %v", err)
			continue
		}

		logEntry.LoginTime = loginTime.Format("2006-01-02 15:04:05")
		if pcNumber.Valid {
			logEntry.PCNumber = &pcNumber.String
		}
		if logoutTime.Valid {
			formattedLogoutTime := logoutTime.Time.Format("2006-01-02 15:04:05")
			logEntry.LogoutTime = &formattedLogoutTime
		}
		if userIDNumber.Valid {
			logEntry.UserIDNumber = userIDNumber.String
		} else {
			logEntry.UserIDNumber = logEntry.UserName
		}

		logs = append(logs, logEntry)
	}

	log.Printf("GetArchivedLogs returning %d logs", len(logs))
	return logs, nil
}

// ArchiveLogs archives selected login logs by their IDs
func (a *App) ArchiveLogs(logIDs []int, adminUserID int) (int, error) {
	if a.db == nil {
		return 0, fmt.Errorf("database not connected")
	}

	if len(logIDs) == 0 {
		return 0, fmt.Errorf("no log IDs provided")
	}

	// Build placeholders for the IN clause
	placeholders := make([]string, len(logIDs))
	args := make([]interface{}, 0, len(logIDs)+1)

	// Add admin user ID first (for SET clause)
	args = append(args, adminUserID)

	// Add log IDs for WHERE clause
	for i, id := range logIDs {
		placeholders[i] = "?"
		args = append(args, id)
	}

	query := fmt.Sprintf(`UPDATE login_logs 
		SET is_archived = TRUE, 
		    archived_at = NOW(), 
		    archived_by_user_id = ?
		WHERE id IN (%s) AND is_archived = FALSE`, strings.Join(placeholders, ","))

	result, err := a.db.Exec(query, args...)
	if err != nil {
		log.Printf("Failed to archive logs: %v", err)
		return 0, fmt.Errorf("failed to archive logs: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	log.Printf("✓ %d login logs archived by admin %d", rowsAffected, adminUserID)
	return int(rowsAffected), nil
}

// UnarchiveLogs unarchives selected login logs by their IDs
func (a *App) UnarchiveLogs(logIDs []int) (int, error) {
	if a.db == nil {
		return 0, fmt.Errorf("database not connected")
	}

	if len(logIDs) == 0 {
		return 0, fmt.Errorf("no log IDs provided")
	}

	// Build placeholders for the IN clause
	placeholders := make([]string, len(logIDs))
	args := make([]interface{}, len(logIDs))

	for i, id := range logIDs {
		placeholders[i] = "?"
		args[i] = id
	}

	query := fmt.Sprintf(`UPDATE login_logs 
		SET is_archived = FALSE, 
		    archived_at = NULL, 
		    archived_by_user_id = NULL
		WHERE id IN (%s) AND is_archived = TRUE`, strings.Join(placeholders, ","))

	result, err := a.db.Exec(query, args...)
	if err != nil {
		log.Printf("Failed to unarchive logs: %v", err)
		return 0, fmt.Errorf("failed to unarchive logs: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	log.Printf("✓ %d login logs unarchived", rowsAffected)
	return int(rowsAffected), nil
}

// ExportArchivedLogsCSV exports only archived login logs to CSV format
func (a *App) ExportArchivedLogsCSV() (string, error) {
	logs, err := a.GetArchivedLogs()
	if err != nil {
		return "", err
	}

	if len(logs) == 0 {
		return "", fmt.Errorf("no archived logs to export")
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("archived_login_logs_%s.csv", time.Now().Format("20060102_150405")))

	file, err := os.Create(filename)
	if err != nil {
		return "", err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// Write header
	writer.Write([]string{"ID", "User Name", "User ID Number", "User Type", "PC Number", "Login Time", "Logout Time"})

	// Write data
	for _, log := range logs {
		pcNum := ""
		if log.PCNumber != nil {
			pcNum = *log.PCNumber
		}
		logoutTime := ""
		if log.LogoutTime != nil {
			logoutTime = *log.LogoutTime
		}

		writer.Write([]string{
			strconv.Itoa(log.ID),
			log.UserName,
			log.UserIDNumber,
			log.UserType,
			pcNum,
			log.LoginTime,
			logoutTime,
		})
	}

	return filename, nil
}

// ExportArchivedLogsPDF exports only archived login logs to PDF format
func (a *App) ExportArchivedLogsPDF() (string, error) {
	logs, err := a.GetArchivedLogs()
	if err != nil {
		return "", err
	}

	if len(logs) == 0 {
		return "", fmt.Errorf("no archived logs to export")
	}

	pdf := gofpdf.New("L", "mm", "A4", "")
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 16)
	pdf.Cell(0, 10, "Archived Login Logs Report")
	pdf.Ln(12)

	// Add generation date
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(0, 6, fmt.Sprintf("Generated: %s", time.Now().Format("January 02, 2006 3:04 PM")))
	pdf.Ln(10)

	pdf.SetFont("Arial", "B", 9)
	pdf.Cell(15, 7, "ID")
	pdf.Cell(50, 7, "User Name")
	pdf.Cell(35, 7, "ID Number")
	pdf.Cell(30, 7, "User Type")
	pdf.Cell(35, 7, "PC Number")
	pdf.Cell(50, 7, "Login Time")
	pdf.Cell(50, 7, "Logout Time")
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 8)
	for _, log := range logs {
		pcNum := ""
		if log.PCNumber != nil {
			pcNum = *log.PCNumber
		}
		logoutTime := ""
		if log.LogoutTime != nil {
			logoutTime = *log.LogoutTime
		}

		pdf.Cell(15, 6, strconv.Itoa(log.ID))
		pdf.Cell(50, 6, truncateString(log.UserName, 25))
		pdf.Cell(35, 6, log.UserIDNumber)
		pdf.Cell(30, 6, log.UserType)
		pdf.Cell(35, 6, pcNum)
		pdf.Cell(50, 6, log.LoginTime)
		pdf.Cell(50, 6, logoutTime)
		pdf.Ln(-1)
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("archived_login_logs_%s.pdf", time.Now().Format("20060102_150405")))
	err = pdf.OutputFileAndClose(filename)
	return filename, err
}

// truncateString truncates a string to a maximum length
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
