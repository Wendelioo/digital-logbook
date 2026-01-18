package main

import (
	"database/sql"
	"encoding/csv"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/jung-kurt/gofpdf"
)

// ==============================================================================
// LOGIN LOG QUERIES
// ==============================================================================

// GetAllLogs returns all login logs (limited to 1000 most recent)
func (a *App) GetAllLogs() ([]LoginLog, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	// Query login_logs directly with joins to ensure all logs are returned
	// even if user profile data is missing
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
