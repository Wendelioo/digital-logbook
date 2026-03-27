package backend

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

// ==============================================================================
// LOGIN LOG QUERIES
// ==============================================================================

const maxActiveLogEntries = 500

// repairLogoutTimeWhenNewerLoginExists sets logout_time to the next session's login_time
// for rows that are still open but the user logged in again later (e.g. PC shutdown without
// graceful logout). closeStaleSessions alone misses these because the heartbeat is refreshed
// on the new login, so the old log row still looks "active" by user_id.
func (a *App) repairLogoutTimeWhenNewerLoginExists(forUserID *int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	var err error
	if forUserID != nil {
		_, err = a.db.Exec(`
;WITH ordered AS (
  SELECT id,
         LEAD(login_time) OVER (PARTITION BY user_id ORDER BY login_time ASC, id ASC) AS next_login
  FROM log_entries
  WHERE user_id = ?
)
UPDATE le
SET le.logout_time = o.next_login
FROM log_entries le
INNER JOIN ordered o ON o.id = le.id
WHERE le.logout_time IS NULL AND o.next_login IS NOT NULL
`, *forUserID)
	} else {
		_, err = a.db.Exec(`
;WITH ordered AS (
  SELECT id,
         LEAD(login_time) OVER (PARTITION BY user_id ORDER BY login_time ASC, id ASC) AS next_login
  FROM log_entries
)
UPDATE le
SET le.logout_time = o.next_login
FROM log_entries le
INNER JOIN ordered o ON o.id = le.id
WHERE le.logout_time IS NULL AND o.next_login IS NOT NULL
`)
	}
	if err != nil {
		return fmt.Errorf("repair logout_time from next login: %w", err)
	}
	return nil
}

// autoArchiveLogsIfNeeded checks the number of non-archived log entries and,
// if a configured limit is exceeded, automatically archives the oldest logs by date.
func (a *App) autoArchiveLogsIfNeeded() error {
	if err := a.checkDB(); err != nil {
		return err
	}

	var activeCount int
	if err := a.db.QueryRow(`SELECT COUNT(*) FROM log_entries WHERE is_archived = 0 OR is_archived IS NULL`).Scan(&activeCount); err != nil {
		return fmt.Errorf("failed to count active log entries: %w", err)
	}

	if activeCount <= maxActiveLogEntries {
		return nil
	}

	// Find the oldest login date that is still unarchived.
	var oldestDate time.Time
	err := a.db.QueryRow(`
		SELECT MIN(CAST(login_time AS DATE)) 
		FROM log_entries 
		WHERE is_archived = 0 OR is_archived IS NULL`,
	).Scan(&oldestDate)
	if err != nil {
		return fmt.Errorf("failed to find oldest log date: %w", err)
	}

	dateStr := oldestDate.Format("2006-01-02")
	// Archive the oldest date worth of logs; this uses existing archival logic.
	_, err = a.ArchiveLogsByDate(dateStr, 0)
	if err != nil {
		return fmt.Errorf("failed to auto-archive logs for date %s: %w", dateStr, err)
	}

	log.Printf("autoArchiveLogsIfNeeded archived logs for date %s to keep active log entries under limit", dateStr)
	return nil
}

// GetArchivedLogs returns all archived logs grouped by archive date
func (a *App) GetArchivedLogs() ([]LoginLog, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
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
					THEN s.last_name + ', ' + s.first_name +
						CASE WHEN s.middle_name IS NOT NULL THEN ' ' + s.middle_name ELSE '' END
					ELSE NULL END,
				CASE WHEN t.last_name IS NOT NULL AND t.first_name IS NOT NULL
					THEN t.last_name + ', ' + t.first_name +
						CASE WHEN t.middle_name IS NOT NULL THEN ' ' + t.middle_name ELSE '' END
					ELSE NULL END,
				CASE WHEN a.last_name IS NOT NULL AND a.first_name IS NOT NULL
					THEN a.last_name + ', ' + a.first_name +
						CASE WHEN a.middle_name IS NOT NULL THEN ' ' + a.middle_name ELSE '' END
					ELSE NULL END,
				u.username
			) as full_name,
			COALESCE(
				s.student_id,
				t.teacher_id,
				a.admin_id,
				u.username
			) as user_id_number
		FROM log_entries ll
		JOIN users u ON ll.user_id = u.id
		LEFT JOIN students s ON u.id = s.id AND u.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t ON u.id = t.id AND u.user_type = 'teacher'
		LEFT JOIN admins a ON u.id = a.id AND u.user_type = 'admin'
		WHERE ll.is_archived = 1
		ORDER BY ll.archived_at DESC, ll.login_time DESC
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
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	// Ensure logout_time is finalized for clients that disconnected/shut down
	// before the query runs (admin view uses GetAllLogs()).
	if err := a.closeStaleSessions(); err != nil {
		// Best-effort: still return logs even if cleanup fails.
		log.Printf("Failed to close stale sessions before GetAllLogs: %v", err)
	}
	if err := a.repairLogoutTimeWhenNewerLoginExists(nil); err != nil {
		log.Printf("Failed to repair logout_time before GetAllLogs: %v", err)
	}

	// Ensure we keep only the most recent maxActiveLogEntries as "active"
	if err := a.autoArchiveLogsIfNeeded(); err != nil {
		log.Printf("autoArchiveLogsIfNeeded failed: %v", err)
	}

	// Query log_entries directly with joins to ensure all logs are returned
	// even if user profile data is missing
	// Only returns non-archived logs (is_archived = 0 or NULL for backwards compatibility)
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
					THEN s.last_name + ', ' + s.first_name +
						CASE WHEN s.middle_name IS NOT NULL THEN ' ' + s.middle_name ELSE '' END
					ELSE NULL END,
				CASE WHEN t.last_name IS NOT NULL AND t.first_name IS NOT NULL
					THEN t.last_name + ', ' + t.first_name +
						CASE WHEN t.middle_name IS NOT NULL THEN ' ' + t.middle_name ELSE '' END
					ELSE NULL END,
				CASE WHEN a.last_name IS NOT NULL AND a.first_name IS NOT NULL
					THEN a.last_name + ', ' + a.first_name +
						CASE WHEN a.middle_name IS NOT NULL THEN ' ' + a.middle_name ELSE '' END
					ELSE NULL END,
				u.username
			) as full_name,
			COALESCE(
				s.student_id,
				t.teacher_id,
				a.admin_id,
				u.username
			) as user_id_number
		FROM log_entries ll
		JOIN users u ON ll.user_id = u.id
		LEFT JOIN students s ON u.id = s.id AND u.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t ON u.id = t.id AND u.user_type = 'teacher'
		LEFT JOIN admins a ON u.id = a.id AND u.user_type = 'admin'
		WHERE (ll.is_archived = 0 OR ll.is_archived IS NULL)
		ORDER BY ll.login_time DESC
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
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	// If a client PC was shut down or the app closed unexpectedly, `logout_time`
	// might still be NULL until stale-session cleanup runs.
	// Calling it here ensures the student's login history shows the correct logout time.
	if err := a.closeStaleSessions(); err != nil {
		// Best-effort: still return logs even if cleanup fails.
		log.Printf("Failed to close stale sessions before GetStudentLoginLogs: %v", err)
	}
	if err := a.repairLogoutTimeWhenNewerLoginExists(&userID); err != nil {
		log.Printf("Failed to repair logout_time before GetStudentLoginLogs: %v", err)
	}

	log.Printf("GetStudentLoginLogs called for userID: %d", userID)

	// Query the log_entries table directly and join with users to get the name
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
					THEN s.last_name + ', ' + s.first_name +
						CASE WHEN s.middle_name IS NOT NULL THEN ' ' + s.middle_name ELSE '' END
					ELSE NULL END,
				CASE WHEN t.last_name IS NOT NULL AND t.first_name IS NOT NULL
					THEN t.last_name + ', ' + t.first_name +
						CASE WHEN t.middle_name IS NOT NULL THEN ' ' + t.middle_name ELSE '' END
					ELSE NULL END,
				CASE WHEN a.last_name IS NOT NULL AND a.first_name IS NOT NULL
					THEN a.last_name + ', ' + a.first_name +
						CASE WHEN a.middle_name IS NOT NULL THEN ' ' + a.middle_name ELSE '' END
					ELSE NULL END,
				u.username
			) as full_name,
			COALESCE(
				s.student_id,
				t.teacher_id,
				a.admin_id,
				u.username
			) as user_id_number
		FROM log_entries ll
		JOIN users u ON ll.user_id = u.id
		LEFT JOIN students s ON u.id = s.id AND u.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t ON u.id = t.id AND u.user_type = 'teacher'
		LEFT JOIN admins a ON u.id = a.id AND u.user_type = 'admin'
		WHERE ll.user_id = ?
		ORDER BY ll.login_time DESC
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
// LOGIN LOG RANGE EXPORT FUNCTIONS
// ==============================================================================

// GetLogsRangeCount returns the count of non-archived log entries within a date range.
func (a *App) GetLogsRangeCount(startDate, endDate string) (int, error) {
	if err := a.checkDB(); err != nil {
		return 0, err
	}
	var count int
	err := a.db.QueryRow(`
		SELECT COUNT(*) FROM log_entries
		WHERE (is_archived = 0 OR is_archived IS NULL)
		AND CAST(login_time AS DATE) BETWEEN ? AND ?`,
		startDate, endDate,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count logs in range: %w", err)
	}
	return count, nil
}

// getLogsByDateRange fetches non-archived log entries within a date range.
func (a *App) getLogsByDateRange(startDate, endDate string) ([]LoginLog, error) {
	query := `
		SELECT
			ll.id, ll.user_id,
			COALESCE(u.user_type, 'unknown') as user_type,
			ll.pc_number, ll.login_time, ll.logout_time,
			COALESCE(
				CASE WHEN s.last_name IS NOT NULL AND s.first_name IS NOT NULL
					THEN s.last_name + ', ' + s.first_name +
						CASE WHEN s.middle_name IS NOT NULL THEN ' ' + s.middle_name ELSE '' END
					ELSE NULL END,
				CASE WHEN t.last_name IS NOT NULL AND t.first_name IS NOT NULL
					THEN t.last_name + ', ' + t.first_name +
						CASE WHEN t.middle_name IS NOT NULL THEN ' ' + t.middle_name ELSE '' END
					ELSE NULL END,
				CASE WHEN adm.last_name IS NOT NULL AND adm.first_name IS NOT NULL
					THEN adm.last_name + ', ' + adm.first_name +
						CASE WHEN adm.middle_name IS NOT NULL THEN ' ' + adm.middle_name ELSE '' END
					ELSE NULL END,
				u.username
			) as full_name,
			COALESCE(s.student_id, t.teacher_id, adm.admin_id, u.username) as user_id_number
		FROM log_entries ll
		JOIN users u ON ll.user_id = u.id
		LEFT JOIN students s ON u.id = s.id AND u.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t ON u.id = t.id AND u.user_type = 'teacher'
		LEFT JOIN admins adm ON u.id = adm.id AND u.user_type = 'admin'
		WHERE (ll.is_archived = 0 OR ll.is_archived IS NULL)
		AND CAST(ll.login_time AS DATE) BETWEEN ? AND ?
		ORDER BY ll.login_time DESC`

	rows, err := a.db.Query(query, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to query logs by range: %w", err)
	}
	defer rows.Close()

	var logs []LoginLog
	for rows.Next() {
		var logEntry LoginLog
		var pcNumber sql.NullString
		var loginTime time.Time
		var logoutTime sql.NullTime
		var userIDNumber sql.NullString

		if err := rows.Scan(&logEntry.ID, &logEntry.UserID, &logEntry.UserType, &pcNumber, &loginTime, &logoutTime, &logEntry.UserName, &userIDNumber); err != nil {
			continue
		}
		logEntry.LoginTime = loginTime.Format("2006-01-02 15:04:05")
		if pcNumber.Valid {
			logEntry.PCNumber = &pcNumber.String
		}
		if logoutTime.Valid {
			s := logoutTime.Time.Format("2006-01-02 15:04:05")
			logEntry.LogoutTime = &s
		}
		if userIDNumber.Valid {
			logEntry.UserIDNumber = userIDNumber.String
		} else {
			logEntry.UserIDNumber = logEntry.UserName
		}
		logs = append(logs, logEntry)
	}
	return logs, nil
}

func parseLogExportTimestamp(value string) (time.Time, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return time.Time{}, false
	}

	formats := []string{
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		time.RFC3339,
		"2006-01-02",
	}

	for _, format := range formats {
		parsed, err := time.Parse(format, trimmed)
		if err == nil {
			return parsed, true
		}
	}

	return time.Time{}, false
}

func formatLogExportDate(value string) string {
	parsed, ok := parseLogExportTimestamp(value)
	if !ok {
		return value
	}
	return parsed.Format("01/02/2006")
}

func formatLogExportDateTime(value string) string {
	parsed, ok := parseLogExportTimestamp(value)
	if !ok {
		return value
	}
	return parsed.Format("01/02 3:04 PM")
}

func calculateLogExportDuration(loginTime string, logoutTime *string) string {
	if logoutTime == nil || strings.TrimSpace(*logoutTime) == "" {
		return ""
	}

	loginParsed, loginOK := parseLogExportTimestamp(loginTime)
	logoutParsed, logoutOK := parseLogExportTimestamp(*logoutTime)
	if !loginOK || !logoutOK || logoutParsed.Before(loginParsed) {
		return ""
	}

	diff := logoutParsed.Sub(loginParsed)
	hours := int(diff.Hours())
	minutes := int(diff.Minutes()) % 60
	return fmt.Sprintf("%dh %dm", hours, minutes)
}

func buildActiveLogExportRows(logs []LoginLog) [][]string {
	rows := make([][]string, 0, len(logs))
	for _, entry := range logs {
		pc := "N/A"
		if entry.PCNumber != nil && strings.TrimSpace(*entry.PCNumber) != "" {
			pc = *entry.PCNumber
		}

		logout := ""
		if entry.LogoutTime != nil && strings.TrimSpace(*entry.LogoutTime) != "" {
			logout = formatLogExportDateTime(*entry.LogoutTime)
		}

		rows = append(rows, []string{
			entry.UserName,
			entry.UserIDNumber,
			strings.ReplaceAll(entry.UserType, "_", " "),
			pc,
			formatLogExportDateTime(entry.LoginTime),
			logout,
			calculateLogExportDuration(entry.LoginTime, entry.LogoutTime),
		})
	}
	return rows
}

func buildArchivedLogExportRows(logs []LoginLog) [][]string {
	rows := make([][]string, 0, len(logs))
	for _, entry := range logs {
		pc := "N/A"
		if entry.PCNumber != nil && strings.TrimSpace(*entry.PCNumber) != "" {
			pc = *entry.PCNumber
		}

		logout := ""
		if entry.LogoutTime != nil && strings.TrimSpace(*entry.LogoutTime) != "" {
			logout = formatLogExportDateTime(*entry.LogoutTime)
		}

		rows = append(rows, []string{
			formatLogExportDate(entry.LoginTime),
			entry.UserName,
			entry.UserIDNumber,
			strings.ReplaceAll(entry.UserType, "_", " "),
			pc,
			formatLogExportDateTime(entry.LoginTime),
			logout,
		})
	}
	return rows
}

func buildActiveLogExportDocumentByCount(requestedCount int, logs []LoginLog) printableExportDocument {
	rows := buildActiveLogExportRows(logs)
	subtitle := fmt.Sprintf("Latest %d records", requestedCount)
	if len(rows) == 1 {
		subtitle = fmt.Sprintf("Latest %d record", requestedCount)
	}
	if len(rows) < requestedCount {
		subtitle = fmt.Sprintf("Latest %d records (only %d available)", requestedCount, len(rows))
	}

	return printableExportDocument{
		Title:            "Log Entries",
		Subtitle:         subtitle,
		Details:          nil,
		TableNote:        "",
		Headers:          []string{"Name", "ID Number", "User Type", "PC Number", "Login Time", "Logout Time", "Duration"},
		Rows:             rows,
		Footer:           []printableExportField{{Label: "Total Records", Value: strconv.Itoa(len(rows))}},
		ColumnWidths:     []float64{52, 28, 26, 24, 34, 34, 18},
		ColumnAlignments: []string{"L", "L", "L", "L", "L", "L", "L"},
		Orientation:      "P",
		GeneratedAt:      time.Now(),
	}
}

func buildActiveLogExportDocumentByRowRange(fromRow, toRow int, logs []LoginLog) printableExportDocument {
	rows := buildActiveLogExportRows(logs)
	subtitle := fmt.Sprintf("Rows %d to %d (latest-first)", fromRow, toRow)
	if len(rows) < (toRow - fromRow + 1) {
		subtitle = fmt.Sprintf("Rows %d to %d (latest-first, only %d available)", fromRow, toRow, len(rows))
	}

	return printableExportDocument{
		Title:            "Log Entries",
		Subtitle:         subtitle,
		Details:          nil,
		TableNote:        "",
		Headers:          []string{"Name", "ID Number", "User Type", "PC Number", "Login Time", "Logout Time", "Duration"},
		Rows:             rows,
		Footer:           []printableExportField{{Label: "Total Records", Value: strconv.Itoa(len(rows))}},
		ColumnWidths:     []float64{52, 28, 26, 24, 34, 34, 18},
		ColumnAlignments: []string{"L", "L", "L", "L", "L", "L", "L"},
		Orientation:      "P",
		GeneratedAt:      time.Now(),
	}
}

func buildActiveLogExportDocument(startDate, endDate string, logs []LoginLog) printableExportDocument {
	rows := buildActiveLogExportRows(logs)
	return printableExportDocument{
		Title:            "Log Entries",
		Subtitle:         fmt.Sprintf("Date Range: %s to %s", startDate, endDate),
		Details:          nil,
		TableNote:        "",
		Headers:          []string{"Name", "ID Number", "User Type", "PC Number", "Login Time", "Logout Time", "Duration"},
		Rows:             rows,
		Footer:           []printableExportField{{Label: "Total Records", Value: strconv.Itoa(len(rows))}},
		ColumnWidths:     []float64{52, 28, 26, 24, 34, 34, 18},
		ColumnAlignments: []string{"L", "L", "L", "L", "L", "L", "L"},
		Orientation:      "P",
		GeneratedAt:      time.Now(),
	}
}

// getLogsByCount fetches the latest non-archived log entries, limited by count.
func (a *App) getLogsByCount(count int) ([]LoginLog, error) {
	if count <= 0 {
		return nil, fmt.Errorf("count must be greater than zero")
	}
	if count > maxActiveLogEntries {
		return nil, fmt.Errorf("count cannot exceed %d", maxActiveLogEntries)
	}

	query := `
		SELECT
			ll.id, ll.user_id,
			COALESCE(u.user_type, 'unknown') as user_type,
			ll.pc_number, ll.login_time, ll.logout_time,
			COALESCE(
				CASE WHEN s.last_name IS NOT NULL AND s.first_name IS NOT NULL
					THEN s.last_name + ', ' + s.first_name +
						CASE WHEN s.middle_name IS NOT NULL THEN ' ' + s.middle_name ELSE '' END
					ELSE NULL END,
				CASE WHEN t.last_name IS NOT NULL AND t.first_name IS NOT NULL
					THEN t.last_name + ', ' + t.first_name +
						CASE WHEN t.middle_name IS NOT NULL THEN ' ' + t.middle_name ELSE '' END
					ELSE NULL END,
				CASE WHEN adm.last_name IS NOT NULL AND adm.first_name IS NOT NULL
					THEN adm.last_name + ', ' + adm.first_name +
						CASE WHEN adm.middle_name IS NOT NULL THEN ' ' + adm.middle_name ELSE '' END
					ELSE NULL END,
				u.username
			) as full_name,
			COALESCE(s.student_id, t.teacher_id, adm.admin_id, u.username) as user_id_number
		FROM log_entries ll
		JOIN users u ON ll.user_id = u.id
		LEFT JOIN students s ON u.id = s.id AND u.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t ON u.id = t.id AND u.user_type = 'teacher'
		LEFT JOIN admins adm ON u.id = adm.id AND u.user_type = 'admin'
		WHERE (ll.is_archived = 0 OR ll.is_archived IS NULL)
		ORDER BY ll.login_time DESC
		OFFSET 0 ROWS FETCH NEXT ? ROWS ONLY`

	rows, err := a.db.Query(query, count)
	if err != nil {
		return nil, fmt.Errorf("failed to query logs by count: %w", err)
	}
	defer rows.Close()

	logs := make([]LoginLog, 0, count)
	for rows.Next() {
		var logEntry LoginLog
		var pcNumber sql.NullString
		var loginTime time.Time
		var logoutTime sql.NullTime
		var userIDNumber sql.NullString

		if err := rows.Scan(&logEntry.ID, &logEntry.UserID, &logEntry.UserType, &pcNumber, &loginTime, &logoutTime, &logEntry.UserName, &userIDNumber); err != nil {
			continue
		}
		logEntry.LoginTime = loginTime.Format("2006-01-02 15:04:05")
		if pcNumber.Valid {
			logEntry.PCNumber = &pcNumber.String
		}
		if logoutTime.Valid {
			s := logoutTime.Time.Format("2006-01-02 15:04:05")
			logEntry.LogoutTime = &s
		}
		if userIDNumber.Valid {
			logEntry.UserIDNumber = userIDNumber.String
		} else {
			logEntry.UserIDNumber = logEntry.UserName
		}
		logs = append(logs, logEntry)
	}
	return logs, nil
}

// getLogsByRowRange fetches latest non-archived log entries from a 1-based row range.
func (a *App) getLogsByRowRange(fromRow, toRow int) ([]LoginLog, error) {
	if fromRow <= 0 || toRow <= 0 {
		return nil, fmt.Errorf("row range must be greater than zero")
	}
	if fromRow > toRow {
		return nil, fmt.Errorf("from row cannot be greater than to row")
	}
	if toRow > maxActiveLogEntries {
		return nil, fmt.Errorf("to row cannot exceed %d", maxActiveLogEntries)
	}

	offset := fromRow - 1
	count := toRow - fromRow + 1

	query := `
		SELECT
			ll.id, ll.user_id,
			COALESCE(u.user_type, 'unknown') as user_type,
			ll.pc_number, ll.login_time, ll.logout_time,
			COALESCE(
				CASE WHEN s.last_name IS NOT NULL AND s.first_name IS NOT NULL
					THEN s.last_name + ', ' + s.first_name +
						CASE WHEN s.middle_name IS NOT NULL THEN ' ' + s.middle_name ELSE '' END
					ELSE NULL END,
				CASE WHEN t.last_name IS NOT NULL AND t.first_name IS NOT NULL
					THEN t.last_name + ', ' + t.first_name +
						CASE WHEN t.middle_name IS NOT NULL THEN ' ' + t.middle_name ELSE '' END
					ELSE NULL END,
				CASE WHEN adm.last_name IS NOT NULL AND adm.first_name IS NOT NULL
					THEN adm.last_name + ', ' + adm.first_name +
						CASE WHEN adm.middle_name IS NOT NULL THEN ' ' + adm.middle_name ELSE '' END
					ELSE NULL END,
				u.username
			) as full_name,
			COALESCE(s.student_id, t.teacher_id, adm.admin_id, u.username) as user_id_number
		FROM log_entries ll
		JOIN users u ON ll.user_id = u.id
		LEFT JOIN students s ON u.id = s.id AND u.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t ON u.id = t.id AND u.user_type = 'teacher'
		LEFT JOIN admins adm ON u.id = adm.id AND u.user_type = 'admin'
		WHERE (ll.is_archived = 0 OR ll.is_archived IS NULL)
		ORDER BY ll.login_time DESC
		OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`

	rows, err := a.db.Query(query, offset, count)
	if err != nil {
		return nil, fmt.Errorf("failed to query logs by row range: %w", err)
	}
	defer rows.Close()

	logs := make([]LoginLog, 0, count)
	for rows.Next() {
		var logEntry LoginLog
		var pcNumber sql.NullString
		var loginTime time.Time
		var logoutTime sql.NullTime
		var userIDNumber sql.NullString

		if err := rows.Scan(&logEntry.ID, &logEntry.UserID, &logEntry.UserType, &pcNumber, &loginTime, &logoutTime, &logEntry.UserName, &userIDNumber); err != nil {
			continue
		}
		logEntry.LoginTime = loginTime.Format("2006-01-02 15:04:05")
		if pcNumber.Valid {
			logEntry.PCNumber = &pcNumber.String
		}
		if logoutTime.Valid {
			s := logoutTime.Time.Format("2006-01-02 15:04:05")
			logEntry.LogoutTime = &s
		}
		if userIDNumber.Valid {
			logEntry.UserIDNumber = userIDNumber.String
		} else {
			logEntry.UserIDNumber = logEntry.UserName
		}
		logs = append(logs, logEntry)
	}
	return logs, nil
}

// ExportLogsCSVByRowRange exports non-archived log entries within a row range to CSV.
func (a *App) ExportLogsCSVByRowRange(fromRow, toRow int, savePath string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	logs, err := a.getLogsByRowRange(fromRow, toRow)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("log_entries_rows_%d_to_%d_%s.csv", fromRow, toRow, time.Now().Format("150405"))
	filename := resolveExportPath(savePath, defaultName)
	doc := buildActiveLogExportDocumentByRowRange(fromRow, toRow, logs)

	if err := writePrintableCSV(filename, doc); err != nil {
		return "", err
	}
	return filename, nil
}

// ExportLogsPDFByRowRange exports non-archived log entries within a row range to PDF.
func (a *App) ExportLogsPDFByRowRange(fromRow, toRow int, savePath string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	logs, err := a.getLogsByRowRange(fromRow, toRow)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("log_entries_rows_%d_to_%d_%s.pdf", fromRow, toRow, time.Now().Format("150405"))
	filename := resolveExportPath(savePath, defaultName)
	doc := buildActiveLogExportDocumentByRowRange(fromRow, toRow, logs)
	if err := writePrintablePDF(filename, doc); err != nil {
		return "", err
	}
	return filename, nil
}

// ExportLogsDOCXByRowRange exports non-archived log entries within a row range to DOCX.
func (a *App) ExportLogsDOCXByRowRange(fromRow, toRow int, savePath string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	logs, err := a.getLogsByRowRange(fromRow, toRow)
	if err != nil {
		return "", err
	}

	doc := buildActiveLogExportDocumentByRowRange(fromRow, toRow, logs)

	data, err := generatePrintableDocx(doc)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("log_entries_rows_%d_to_%d_%s.docx", fromRow, toRow, time.Now().Format("150405"))
	filename := resolveExportPath(savePath, defaultName)
	if err := os.WriteFile(filename, data, 0644); err != nil {
		return "", fmt.Errorf("failed to write docx: %w", err)
	}
	return filename, nil
}

// ExportLogsCSVByCount exports the latest non-archived log entries to CSV.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportLogsCSVByCount(count int, savePath string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	logs, err := a.getLogsByCount(count)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("log_entries_latest_%d_%s.csv", count, time.Now().Format("150405"))
	filename := resolveExportPath(savePath, defaultName)
	doc := buildActiveLogExportDocumentByCount(count, logs)

	if err := writePrintableCSV(filename, doc); err != nil {
		return "", err
	}
	return filename, nil
}

// ExportLogsPDFByCount exports the latest non-archived log entries to PDF.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportLogsPDFByCount(count int, savePath string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	logs, err := a.getLogsByCount(count)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("log_entries_latest_%d_%s.pdf", count, time.Now().Format("150405"))
	filename := resolveExportPath(savePath, defaultName)
	doc := buildActiveLogExportDocumentByCount(count, logs)
	if err := writePrintablePDF(filename, doc); err != nil {
		return "", err
	}
	return filename, nil
}

// ExportLogsDOCXByCount exports the latest non-archived log entries to DOCX.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportLogsDOCXByCount(count int, savePath string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	logs, err := a.getLogsByCount(count)
	if err != nil {
		return "", err
	}

	doc := buildActiveLogExportDocumentByCount(count, logs)

	data, err := generatePrintableDocx(doc)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("log_entries_latest_%d_%s.docx", count, time.Now().Format("150405"))
	filename := resolveExportPath(savePath, defaultName)
	if err := os.WriteFile(filename, data, 0644); err != nil {
		return "", fmt.Errorf("failed to write docx: %w", err)
	}
	return filename, nil
}

func buildArchivedLogExportDocument(date string, logs []LoginLog) printableExportDocument {
	rows := buildArchivedLogExportRows(logs)
	return printableExportDocument{
		Title:            "Log Entries",
		Subtitle:         fmt.Sprintf("Date: %s", date),
		Details:          nil,
		TableNote:        "",
		Headers:          []string{"Date", "Name", "ID Number", "User Type", "PC", "Login", "Logout"},
		Rows:             rows,
		Footer:           []printableExportField{{Label: "Total Records", Value: strconv.Itoa(len(rows))}},
		ColumnWidths:     []float64{24, 48, 28, 24, 20, 32, 32},
		ColumnAlignments: []string{"L", "L", "L", "L", "L", "L", "L"},
		Orientation:      "P",
		GeneratedAt:      time.Now(),
	}
}

// ExportLogsCSVByRange exports log entries within a date range to CSV.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportLogsCSVByRange(startDate, endDate string, savePath string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	logs, err := a.getLogsByDateRange(startDate, endDate)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("log_entries_%s_to_%s_%s.csv", startDate, endDate, time.Now().Format("150405"))
	filename := resolveExportPath(savePath, defaultName)
	doc := buildActiveLogExportDocument(startDate, endDate, logs)

	if err := writePrintableCSV(filename, doc); err != nil {
		return "", err
	}
	return filename, nil
}

// ExportLogsPDFByRange exports log entries within a date range to PDF.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportLogsPDFByRange(startDate, endDate string, savePath string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	logs, err := a.getLogsByDateRange(startDate, endDate)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("log_entries_%s_to_%s_%s.pdf", startDate, endDate, time.Now().Format("150405"))
	filename := resolveExportPath(savePath, defaultName)
	doc := buildActiveLogExportDocument(startDate, endDate, logs)
	if err := writePrintablePDF(filename, doc); err != nil {
		return "", err
	}
	return filename, nil
}

// ExportLogsDOCXByRange exports log entries within a date range to DOCX.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportLogsDOCXByRange(startDate, endDate string, savePath string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	logs, err := a.getLogsByDateRange(startDate, endDate)
	if err != nil {
		return "", err
	}

	doc := buildActiveLogExportDocument(startDate, endDate, logs)

	data, err := generatePrintableDocx(doc)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("log_entries_%s_to_%s_%s.docx", startDate, endDate, time.Now().Format("150405"))
	filename := resolveExportPath(savePath, defaultName)
	if err := os.WriteFile(filename, data, 0644); err != nil {
		return "", fmt.Errorf("failed to write docx: %w", err)
	}
	return filename, nil
}

// ==============================================================================
// LOGIN LOG ARCHIVE FUNCTIONS (DOCUMENT-BASED)
// ==============================================================================

// GetArchivedLogsByDate returns all archived login logs for a specific date
func (a *App) GetArchivedLogsByDate(date string) ([]LoginLog, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
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
					THEN s.last_name + ', ' + s.first_name +
						CASE WHEN s.middle_name IS NOT NULL THEN ' ' + s.middle_name ELSE '' END
					ELSE NULL END,
				CASE WHEN t.last_name IS NOT NULL AND t.first_name IS NOT NULL
					THEN t.last_name + ', ' + t.first_name +
						CASE WHEN t.middle_name IS NOT NULL THEN ' ' + t.middle_name ELSE '' END
					ELSE NULL END,
				CASE WHEN ad.last_name IS NOT NULL AND ad.first_name IS NOT NULL
					THEN ad.last_name + ', ' + ad.first_name +
						CASE WHEN ad.middle_name IS NOT NULL THEN ' ' + ad.middle_name ELSE '' END
					ELSE NULL END,
				u.username
			) as full_name,
			COALESCE(
				s.student_id,
				t.teacher_id,
				ad.admin_id,
				u.username
			) as user_id_number
		FROM log_entries ll
		JOIN users u ON ll.user_id = u.id
		LEFT JOIN students s ON u.id = s.id AND u.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t ON u.id = t.id AND u.user_type = 'teacher'
		LEFT JOIN admins ad ON u.id = ad.id AND u.user_type = 'admin'
		WHERE ll.is_archived = 1 AND CAST(ll.login_time AS DATE) = ?
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
	if err := a.checkDB(); err != nil {
		return 0, err
	}

	query := `UPDATE log_entries 
		SET is_archived = 1, 
		    archived_at = GETDATE(), 
		    archived_by_user_id = ?
		WHERE CAST(login_time AS DATE) = ? AND (is_archived = 0 OR is_archived IS NULL)`

	result, err := a.db.Exec(query, adminUserID, date)
	if err != nil {
		log.Printf("Failed to archive logs by date: %v", err)
		return 0, fmt.Errorf("failed to archive logs: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	log.Printf("%d log entries archived for date %s by admin %d", rowsAffected, date, adminUserID)
	return int(rowsAffected), nil
}

// ExportArchivedLogSheetCSV exports archived logs for a specific date to CSV.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportArchivedLogSheetCSV(date string, savePath string) (string, error) {
	logs, err := a.GetArchivedLogsByDate(date)
	if err != nil {
		return "", err
	}

	if len(logs) == 0 {
		return "", fmt.Errorf("no archived logs for date %s", date)
	}

	defaultName := fmt.Sprintf("log_entries_%s.csv", date)
	filename := resolveExportPath(savePath, defaultName)
	doc := buildArchivedLogExportDocument(date, logs)

	if err := writePrintableCSV(filename, doc); err != nil {
		return "", err
	}

	return filename, nil
}

// ExportArchivedLogSheetPDF exports archived logs for a specific date to PDF.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportArchivedLogSheetPDF(date string, savePath string) (string, error) {
	logs, err := a.GetArchivedLogsByDate(date)
	if err != nil {
		return "", err
	}

	if len(logs) == 0 {
		return "", fmt.Errorf("no archived logs for date %s", date)
	}

	defaultName := fmt.Sprintf("log_entries_%s.pdf", date)
	filename := resolveExportPath(savePath, defaultName)
	doc := buildArchivedLogExportDocument(date, logs)
	if err := writePrintablePDF(filename, doc); err != nil {
		return "", err
	}
	return filename, nil
}

// ExportArchivedLogSheetDOCX exports archived logs for a specific date to DOCX.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportArchivedLogSheetDOCX(date string, savePath string) (string, error) {
	logs, err := a.GetArchivedLogsByDate(date)
	if err != nil {
		return "", err
	}

	if len(logs) == 0 {
		return "", fmt.Errorf("no archived logs for date %s", date)
	}
	doc := buildArchivedLogExportDocument(date, logs)

	data, err := generatePrintableDocx(doc)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("log_entries_%s.docx", date)
	filename := resolveExportPath(savePath, defaultName)
	if err := os.WriteFile(filename, data, 0644); err != nil {
		return "", fmt.Errorf("failed to write docx: %w", err)
	}

	return filename, nil
}

// ArchiveLogs archives selected login logs by their IDs
func (a *App) ArchiveLogs(logIDs []int, adminUserID int) (int, error) {
	if err := a.checkDB(); err != nil {
		return 0, err
	}

	if len(logIDs) == 0 {
		return 0, fmt.Errorf("no log IDs provided")
	}
	if err := ValidatePositiveIDs(logIDs, "log ID"); err != nil {
		return 0, err
	}
	if err := ValidatePositiveID(adminUserID, "admin user ID"); err != nil {
		return 0, err
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

	query := fmt.Sprintf(`UPDATE log_entries 
		SET is_archived = 1, 
		    archived_at = GETDATE(), 
		    archived_by_user_id = ?
		WHERE id IN (%s) AND is_archived = 0`, strings.Join(placeholders, ","))

	result, err := a.db.Exec(query, args...)
	if err != nil {
		log.Printf("Failed to archive logs: %v", err)
		return 0, fmt.Errorf("failed to archive logs: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	log.Printf("%d login logs archived by admin %d", rowsAffected, adminUserID)
	return int(rowsAffected), nil
}
