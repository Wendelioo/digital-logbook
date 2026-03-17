package backend

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"
)

func normalizeAttendanceRemark(status string, remarks sql.NullString) *string {
	if remarks.Valid {
		trimmedRemark := strings.TrimSpace(remarks.String)
		placeholderTrimmed := strings.Trim(trimmedRemark, "-—–_")
		if trimmedRemark != "" && strings.TrimSpace(placeholderTrimmed) != "" {
			return &trimmedRemark
		}
	}

	normalizedStatus := strings.ToLower(strings.TrimSpace(status))
	switch normalizedStatus {
	case "present", "seat-in", "seat in":
		defaultRemark := "Present"
		return &defaultRemark
	case "late":
		defaultRemark := "Late"
		return &defaultRemark
	case "absent":
		defaultRemark := "Absent"
		return &defaultRemark
	default:
		return nil
	}
}

// ==============================================================================
// ATTENDANCE MANAGEMENT
// ==============================================================================

// OpenClassAttendance is the primary method for viewing/creating attendance.
// It auto-creates attendance for today the first time a teacher opens it.
// Rule: attendance is auto-created (default status='absent') for all active students.
// Returns the attendance records for the given date.
func (a *App) OpenClassAttendance(classID int, date string) ([]Attendance, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	// Validate date format
	_, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, fmt.Errorf("invalid date format: %w", err)
	}

	// Check if class exists and get its status
	var classIsActive bool
	var isArchived bool
	err = a.db.QueryRow(`SELECT is_active, COALESCE(is_archived, 0) FROM classes WHERE class_id = ?`, classID).Scan(&classIsActive, &isArchived)
	if err != nil {
		return nil, fmt.Errorf("class not found")
	}

	today := time.Now().Format("2006-01-02")

	// For today: ensure an open attendance_sessions row exists so enrolled students
	// see "Attendance Today" and the Time In button on their dashboard.
	if date == today && classIsActive && !isArchived {
		if err := a.ensureAttendanceSessionsTable(); err != nil {
			log.Printf("Failed to ensure attendance sessions table in OpenClassAttendance: %v", err)
		} else if err := a.closeExpiredAttendanceSessions(); err != nil {
			log.Printf("Failed to close expired sessions in OpenClassAttendance: %v", err)
		} else {
			var openSessionID int
			errSession := a.db.QueryRow(`
				SELECT TOP 1 session_id FROM attendance_sessions
				WHERE class_id = ? AND attendance_date = ? AND status = 'open' AND COALESCE(is_archived, 0) = 0
				ORDER BY session_id DESC
			`, classID, date).Scan(&openSessionID)
			switch errSession {
			case nil:
				if ensureErr := a.ensureAttendanceRowsForSession(openSessionID, classID, date); ensureErr != nil {
					log.Printf("Failed to ensure attendance rows for existing session %d: %v", openSessionID, ensureErr)
				}
			case sql.ErrNoRows:
				// No open session: create one so students get Time In
				var teacherID int
				if errTeacher := a.db.QueryRow(`SELECT teacher_id FROM classes WHERE class_id = ?`, classID).Scan(&teacherID); errTeacher != nil {
					teacherID = 0
				}
				sessionName := fmt.Sprintf("Attendance %s", date)
				var newSessionID int
				insertErr := a.db.QueryRow(`
					INSERT INTO attendance_sessions
					(class_id, attendance_date, session_name, status, class_duration_minutes, grace_period_minutes, opened_at, created_by_user_id, created_at, updated_at)
					OUTPUT INSERTED.session_id
					VALUES (?, ?, ?, 'open', 90, 10, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
				`, classID, date, sessionName, teacherID).Scan(&newSessionID)
				if insertErr != nil {
					log.Printf("Failed to create open session when teacher opens attendance: %v", insertErr)
				} else if ensureErr := a.ensureAttendanceRowsForSession(newSessionID, classID, date); ensureErr != nil {
					log.Printf("Failed to ensure attendance rows for new session %d: %v", newSessionID, ensureErr)
				} else {
					log.Printf("Auto-created open attendance session %d for class %d on %s (students can time in)", newSessionID, classID, date)

					// Notify enrolled students about the opened session
					go func(cID, sID int, sName string) {
						studentRows, qErr := a.db.Query(
							`SELECT student_id FROM classlist WHERE class_id = ? AND status = 'active'`, cID)
						if qErr != nil || studentRows == nil {
							return
						}
						defer studentRows.Close()
						for studentRows.Next() {
							var sid int
							if studentRows.Scan(&sid) == nil {
								a.createNotification(sid, "attendance",
									"Attendance Session Open",
									fmt.Sprintf("Attendance session opened: %s.", sName),
									"info", notifRef("attendance_session"), notifRefID(sID))
							}
						}
					}(classID, newSessionID, sessionName)
				}
			}
		}
	}

	// Return the attendance records for this date
	return a.GetClassAttendance(classID, date)
}

// GetClassAttendance gets attendance records for a specific class on a specific date.
// Adds is_editable field: true only if date == TODAY and class is not archived.
func (a *App) GetClassAttendance(classID int, date string) ([]Attendance, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}
	if err := a.ensureAttendanceSessionsTable(); err != nil {
		return nil, err
	}

	today := time.Now().Format("2006-01-02")

	query := `
		SELECT 
			a.class_id,
			a.student_id,
			CONVERT(VARCHAR(10), a.attendance_date, 23) as date,
			stu.student_id,
			stu.first_name,
			stu.middle_name,
			stu.last_name,
			s.subject_code,
			s.description as subject_name,
			CASE
				WHEN LOWER(LTRIM(RTRIM(ISNULL(a.status, '')))) IN ('present', 'late') THEN (
					COALESCE(
						CONVERT(VARCHAR(8), a.time_in_at, 108),
						(
							SELECT TOP 1 CONVERT(VARCHAR(8), le.login_time, 108)
							FROM log_entries le
							WHERE le.user_id = stu.id AND CAST(le.login_time AS DATE) = a.attendance_date
							ORDER BY le.login_time ASC
						),
						CONVERT(VARCHAR(8), a.updated_at, 108)
					)
				)
				ELSE NULL
			END as time_in,
			a.status,
			a.remarks,
			COALESCE(a.is_archived, 0) as is_archived
		FROM attendance a
		JOIN students stu ON a.student_id = stu.id
		JOIN classes c ON a.class_id = c.class_id
		JOIN subjects s ON c.subject_code = s.subject_code
		WHERE a.class_id = ? AND a.attendance_date = ?
		ORDER BY stu.last_name, stu.first_name
	`

	rows, err := a.db.Query(query, classID, date)
	if err != nil {
		log.Printf("Failed to query attendance: %v", err)
		return nil, err
	}
	defer rows.Close()

	var attendances []Attendance
	for rows.Next() {
		var att Attendance
		var middleName, remarks, status, timeIn sql.NullString
		var isArchived bool

		err := rows.Scan(
			&att.ClassID, &att.StudentUserID, &att.Date,
			&att.StudentCode, &att.FirstName, &middleName, &att.LastName,
			&att.SubjectCode, &att.SubjectName,
			&timeIn, &status, &remarks, &isArchived,
		)
		if err != nil {
			log.Printf("Failed to scan attendance row: %v", err)
			continue
		}

		if middleName.Valid {
			att.MiddleName = &middleName.String
		}
		if status.Valid {
			att.Status = strings.TrimSpace(status.String)
		}
		att.Remarks = normalizeAttendanceRemark(att.Status, remarks)
		if timeIn.Valid {
			att.TimeIn = &timeIn.String
		}
		att.IsArchived = isArchived
		// CRITICAL: editable only if date is TODAY and not archived
		att.IsEditable = (date == today) && !isArchived

		attendances = append(attendances, att)
	}

	return attendances, nil
}

// UpdateAttendanceRecord updates a specific attendance record.
// CRITICAL RULE: Only allows updates if attendance_date == TODAY.
func (a *App) UpdateAttendanceRecord(classID, studentUserID int, date, status, remarks string) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	return fmt.Errorf("manual attendance editing is disabled. Attendance remarks are set automatically from Time In and session close")
}

func (a *App) GetSessionAttendance(sessionID int, teacherUserID int) ([]Attendance, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			a.class_id,
			a.student_id,
			CONVERT(VARCHAR(10), a.attendance_date, 23) as date,
			stu.student_id,
			stu.first_name,
			stu.middle_name,
			stu.last_name,
			c.subject_code,
			s.description as subject_name,
			CASE
				WHEN LOWER(LTRIM(RTRIM(ISNULL(a.status, '')))) IN ('present', 'late') THEN (
					COALESCE(CONVERT(VARCHAR(8), a.time_in_at, 108), CONVERT(VARCHAR(8), a.updated_at, 108))
				)
				ELSE NULL
			END as time_in,
			a.status,
			a.remarks,
			COALESCE(a.is_archived, 0) as is_archived
		FROM attendance a
		JOIN students stu ON a.student_id = stu.id
		JOIN classes c ON a.class_id = c.class_id
		JOIN subjects s ON c.subject_code = s.subject_code
		WHERE a.session_id = ?
		ORDER BY stu.last_name, stu.first_name
	`

	rows, err := a.db.Query(query, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attendances []Attendance
	for rows.Next() {
		var att Attendance
		var middleName, remarks, status, timeIn sql.NullString
		var isArchived bool

		err := rows.Scan(
			&att.ClassID, &att.StudentUserID, &att.Date,
			&att.StudentCode, &att.FirstName, &middleName, &att.LastName,
			&att.SubjectCode, &att.SubjectName,
			&timeIn, &status, &remarks, &isArchived,
		)
		if err != nil {
			log.Printf("Failed to scan session attendance row: %v", err)
			continue
		}

		if middleName.Valid {
			att.MiddleName = &middleName.String
		}
		if status.Valid {
			att.Status = strings.TrimSpace(status.String)
		}
		att.Remarks = normalizeAttendanceRemark(att.Status, remarks)
		if timeIn.Valid {
			att.TimeIn = &timeIn.String
		}
		att.IsArchived = isArchived
		att.IsEditable = false

		attendances = append(attendances, att)
	}

	return attendances, nil
}

type attendanceExportClassInfo struct {
	SubjectCode string
	SubjectName string
	Schedule    string
	Room        string
	TeacherName string
}

func (a *App) getAttendanceExportClassInfo(classID int) attendanceExportClassInfo {
	info := attendanceExportClassInfo{
		SubjectCode: fmt.Sprintf("CLASS %d", classID),
		SubjectName: "Unknown Subject",
		Schedule:    "",
		Room:        "",
		TeacherName: "",
	}

	var subjectCode string
	var subjectName, schedule, room, teacherName sql.NullString
	classQuery := `
		SELECT
			c.subject_code,
			s.description,
			c.schedule,
			c.room,
			(t.last_name + ', ' + t.first_name) as teacher_name
		FROM classes c
		JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN teachers t ON c.teacher_id = t.id
		WHERE c.class_id = ?
	`

	err := a.db.QueryRow(classQuery, classID).Scan(&subjectCode, &subjectName, &schedule, &room, &teacherName)
	if err != nil {
		log.Printf("Failed to get class info for attendance export: %v", err)
		return info
	}

	if strings.TrimSpace(subjectCode) != "" {
		info.SubjectCode = strings.TrimSpace(subjectCode)
	}
	if subjectName.Valid && strings.TrimSpace(subjectName.String) != "" {
		info.SubjectName = strings.TrimSpace(subjectName.String)
	}
	if schedule.Valid && strings.TrimSpace(schedule.String) != "" {
		info.Schedule = strings.TrimSpace(schedule.String)
	}
	if room.Valid && strings.TrimSpace(room.String) != "" {
		info.Room = strings.TrimSpace(room.String)
	}
	if teacherName.Valid && strings.TrimSpace(teacherName.String) != "" {
		info.TeacherName = strings.TrimSpace(teacherName.String)
	}

	return info
}

func formatAttendanceExportDate(date string) string {
	parsedDate, err := time.Parse("2006-01-02", date)
	if err != nil {
		return date
	}

	return parsedDate.Format("01/02/2006")
}

func buildAttendanceExportName(att Attendance) string {
	middleInitial := ""
	if att.MiddleName != nil {
		middleName := strings.TrimSpace(*att.MiddleName)
		if middleName != "" {
			middleInitial = fmt.Sprintf(" %s.", strings.ToUpper(string(middleName[0])))
		}
	}

	return fmt.Sprintf("%s, %s%s", att.LastName, att.FirstName, middleInitial)
}

func buildAttendanceExportRows(attendances []Attendance) ([][]string, int, int, int) {
	exportRows := make([][]string, 0, len(attendances))
	presentCount := 0
	lateCount := 0
	absentCount := 0

	for index, att := range attendances {
		switch strings.ToLower(strings.TrimSpace(att.Status)) {
		case "present":
			presentCount++
		case "late":
			lateCount++
		default:
			absentCount++
		}

		timeInValue := ""
		if att.TimeIn != nil && strings.TrimSpace(*att.TimeIn) != "" {
			timeInValue = strings.TrimSpace(*att.TimeIn)
		}

		remarksValue := ""
		if att.Remarks != nil && strings.TrimSpace(*att.Remarks) != "" {
			remarksValue = strings.TrimSpace(*att.Remarks)
		}

		exportRows = append(exportRows, []string{
			fmt.Sprintf("%d", index+1),
			att.StudentCode,
			buildAttendanceExportName(att),
			timeInValue,
			remarksValue,
		})
	}

	return exportRows, presentCount, lateCount, absentCount
}

func buildAttendancePrintableDocument(title string, classInfo attendanceExportClassInfo, date string, attendances []Attendance) printableExportDocument {
	exportRows, presentCount, lateCount, absentCount := buildAttendanceExportRows(attendances)

	return printableExportDocument{
		// Keep title consistent with the on-screen attendance sheet heading
		Title:    strings.ToUpper(title),
		Subtitle: formatAttendanceExportDate(date),
		Details: []printableExportField{
			{Label: "Subject", Value: fmt.Sprintf("%s - %s", classInfo.SubjectCode, classInfo.SubjectName)},
			{Label: "Instructor", Value: classInfo.TeacherName},
			{Label: "Schedule", Value: classInfo.Schedule},
			{Label: "Room", Value: classInfo.Room},
		},
		// Match section/title text and column labels with the UI
		TableTitle:       "DAILY ATTENDANCE RECORD",
		TableNote:        fmt.Sprintf("Total Students: %d", len(exportRows)),
		Headers:          []string{"NO.", "STUDENT ID", "STUDENT NAME", "TIME IN", "REMARKS"},
		Rows:             exportRows,
		Footer:           []printableExportField{{Label: "Present", Value: fmt.Sprintf("%d", presentCount)}, {Label: "Late", Value: fmt.Sprintf("%d", lateCount)}, {Label: "Absent", Value: fmt.Sprintf("%d", absentCount)}, {Label: "Total", Value: fmt.Sprintf("%d", len(exportRows))}},
		ColumnWidths:     []float64{12, 28, 90, 24, 36},
		ColumnAlignments: []string{"C", "L", "L", "C", "L"},
		Orientation:      "P",
		GeneratedAt:      time.Now(),
	}
}

func (a *App) queryAttendanceExportRecords(query string, args ...interface{}) ([]Attendance, error) {
	rows, err := a.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	attendances := make([]Attendance, 0)
	for rows.Next() {
		var att Attendance
		var middleName, remarks, status, timeIn sql.NullString
		var isArchived bool

		err := rows.Scan(
			&att.ClassID,
			&att.StudentUserID,
			&att.Date,
			&att.StudentCode,
			&att.FirstName,
			&middleName,
			&att.LastName,
			&att.SubjectCode,
			&att.SubjectName,
			&timeIn,
			&status,
			&remarks,
			&isArchived,
		)
		if err != nil {
			log.Printf("Failed to scan attendance export row: %v", err)
			continue
		}

		if middleName.Valid {
			att.MiddleName = &middleName.String
		}
		if status.Valid {
			att.Status = strings.TrimSpace(status.String)
		}
		att.Remarks = normalizeAttendanceRemark(att.Status, remarks)
		if timeIn.Valid {
			trimmedTimeIn := strings.TrimSpace(timeIn.String)
			if trimmedTimeIn != "" {
				att.TimeIn = &trimmedTimeIn
			}
		}
		att.IsArchived = isArchived

		attendances = append(attendances, att)
	}

	return attendances, nil
}

func (a *App) getAttendanceExportRecords(classID int, date string, sessionID int, archivedOnly bool) ([]Attendance, error) {
	archiveFlag := 0
	if archivedOnly {
		archiveFlag = 1
	}

	if sessionID > 0 {
		query := `
			SELECT
				a.class_id,
				a.student_id,
				CONVERT(VARCHAR(10), a.attendance_date, 23) as date,
				stu.student_id,
				stu.first_name,
				stu.middle_name,
				stu.last_name,
				c.subject_code,
				s.description as subject_name,
				CASE
					WHEN LOWER(LTRIM(RTRIM(ISNULL(a.status, '')))) IN ('present', 'late') THEN (
						COALESCE(
							CONVERT(VARCHAR(8), a.time_in_at, 108),
							CONVERT(VARCHAR(8), a.updated_at, 108)
						)
					)
					ELSE NULL
				END as time_in,
				a.status,
				a.remarks,
				COALESCE(a.is_archived, 0) as is_archived
			FROM attendance a
			JOIN students stu ON a.student_id = stu.id
			JOIN classes c ON a.class_id = c.class_id
			JOIN subjects s ON c.subject_code = s.subject_code
			WHERE a.session_id = ?
				AND COALESCE(a.is_archived, 0) = ?
			ORDER BY stu.last_name, stu.first_name
		`

		return a.queryAttendanceExportRecords(query, sessionID, archiveFlag)
	}

	query := `
		SELECT
			a.class_id,
			a.student_id,
			CONVERT(VARCHAR(10), a.attendance_date, 23) as date,
			stu.student_id,
			stu.first_name,
			stu.middle_name,
			stu.last_name,
			c.subject_code,
			s.description as subject_name,
			CASE
				WHEN LOWER(LTRIM(RTRIM(ISNULL(a.status, '')))) IN ('present', 'late') THEN (
					COALESCE(
						CONVERT(VARCHAR(8), a.time_in_at, 108),
						(
							SELECT TOP 1 CONVERT(VARCHAR(8), le.login_time, 108)
							FROM log_entries le
							WHERE le.user_id = stu.id AND CAST(le.login_time AS DATE) = a.attendance_date
							ORDER BY le.login_time ASC
						),
						CONVERT(VARCHAR(8), a.updated_at, 108)
					)
				)
				ELSE NULL
			END as time_in,
			a.status,
			a.remarks,
			COALESCE(a.is_archived, 0) as is_archived
		FROM attendance a
		JOIN students stu ON a.student_id = stu.id
		JOIN classes c ON a.class_id = c.class_id
		JOIN subjects s ON c.subject_code = s.subject_code
		WHERE a.class_id = ?
			AND a.attendance_date = ?
			AND COALESCE(a.is_archived, 0) = ?
		ORDER BY stu.last_name, stu.first_name
	`

	return a.queryAttendanceExportRecords(query, classID, date, archiveFlag)
}

func (a *App) exportAttendanceDocument(classID int, date string, sessionID int, archivedOnly bool, format string, savePath string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}

	if _, err := time.Parse("2006-01-02", date); err != nil {
		return "", fmt.Errorf("invalid date format: %w", err)
	}

	classInfo := a.getAttendanceExportClassInfo(classID)
	attendances, err := a.getAttendanceExportRecords(classID, date, sessionID, archivedOnly)
	if err != nil {
		return "", err
	}

	title := "Attendance Sheet"
	if archivedOnly {
		title = "Attendance Sheet (Archived)"
	}
	doc := buildAttendancePrintableDocument(title, classInfo, date, attendances)

	filePrefix := "attendance"
	if archivedOnly {
		filePrefix = "archived_attendance"
	}

	defaultName := fmt.Sprintf("%s_%d_%s_%s.%s", filePrefix, classID, date, time.Now().Format("150405"), format)
	filename := resolveExportPath(savePath, defaultName)

	switch format {
	case "csv":
		if err := writePrintableCSV(filename, doc); err != nil {
			return "", err
		}
	case "pdf":
		if err := writePrintablePDF(filename, doc); err != nil {
			return "", err
		}
	case "docx":
		data, err := generatePrintableDocx(doc)
		if err != nil {
			return "", err
		}
		if err := os.WriteFile(filename, data, 0644); err != nil {
			return "", fmt.Errorf("failed to write docx: %w", err)
		}
	default:
		return "", fmt.Errorf("unsupported attendance export format: %s", format)
	}

	return filename, nil
}

// ExportAttendanceCSVByDate exports attendance to CSV for a specific class and date.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportAttendanceCSVByDate(classID int, date string, savePath string) (string, error) {
	filename, err := a.exportAttendanceDocument(classID, date, 0, false, "csv", savePath)
	if err != nil {
		return "", err
	}
	log.Printf("Attendance exported to CSV by date: class=%d, date=%s, file=%s", classID, date, filename)
	return filename, nil
}

// ExportAttendancePDFByDate exports attendance to PDF for a specific class and date.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportAttendancePDFByDate(classID int, date string, savePath string) (string, error) {
	filename, err := a.exportAttendanceDocument(classID, date, 0, false, "pdf", savePath)
	if err != nil {
		return "", err
	}
	log.Printf("Attendance exported to PDF by date: class=%d, date=%s, file=%s", classID, date, filename)
	return filename, nil
}

// ExportAttendanceDOCXByDate exports attendance to DOCX for a specific class and date.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportAttendanceDOCXByDate(classID int, date string, savePath string) (string, error) {
	filename, err := a.exportAttendanceDocument(classID, date, 0, false, "docx", savePath)
	if err != nil {
		return "", err
	}
	log.Printf("Attendance exported to DOCX by date: class=%d, date=%s, file=%s", classID, date, filename)
	return filename, nil
}
func (a *App) ExportAttendanceCSVBySession(classID int, date string, sessionID int, savePath string) (string, error) {
	filename, err := a.exportAttendanceDocument(classID, date, sessionID, false, "csv", savePath)
	if err != nil {
		return "", err
	}
	log.Printf("Attendance exported to CSV by session: class=%d, date=%s, session=%d, file=%s", classID, date, sessionID, filename)
	return filename, nil
}

func (a *App) ExportAttendancePDFBySession(classID int, date string, sessionID int, savePath string) (string, error) {
	filename, err := a.exportAttendanceDocument(classID, date, sessionID, false, "pdf", savePath)
	if err != nil {
		return "", err
	}
	log.Printf("Attendance exported to PDF by session: class=%d, date=%s, session=%d, file=%s", classID, date, sessionID, filename)
	return filename, nil
}

func (a *App) ExportAttendanceDOCXBySession(classID int, date string, sessionID int, savePath string) (string, error) {
	filename, err := a.exportAttendanceDocument(classID, date, sessionID, false, "docx", savePath)
	if err != nil {
		return "", err
	}
	log.Printf("Attendance exported to DOCX by session: class=%d, date=%s, session=%d, file=%s", classID, date, sessionID, filename)
	return filename, nil
}
func (a *App) ExportArchivedAttendanceCSVByDate(classID int, date string, sessionID int, savePath string) (string, error) {
	filename, err := a.exportAttendanceDocument(classID, date, sessionID, true, "csv", savePath)
	if err != nil {
		return "", err
	}
	log.Printf("Archived attendance exported to CSV by date: class=%d, date=%s, session=%d, file=%s", classID, date, sessionID, filename)
	return filename, nil
}

// ExportArchivedAttendancePDFByDate exports only archived attendance records for a specific class/date/session.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportArchivedAttendancePDFByDate(classID int, date string, sessionID int, savePath string) (string, error) {
	filename, err := a.exportAttendanceDocument(classID, date, sessionID, true, "pdf", savePath)
	if err != nil {
		return "", err
	}
	log.Printf("Archived attendance exported to PDF by date: class=%d, date=%s, session=%d, file=%s", classID, date, sessionID, filename)
	return filename, nil
}

// ExportArchivedAttendanceDOCXByDate exports archived attendance records for a specific class/date/session to DOCX.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportArchivedAttendanceDOCXByDate(classID int, date string, sessionID int, savePath string) (string, error) {
	filename, err := a.exportAttendanceDocument(classID, date, sessionID, true, "docx", savePath)
	if err != nil {
		return "", err
	}

	log.Printf("Archived attendance exported to DOCX by date: class=%d, date=%s, session=%d, file=%s", classID, date, sessionID, filename)
	return filename, nil
}

// ==============================================================================
// ATTENDANCE ARCHIVING
// ==============================================================================

// ArchiveAttendanceSheet marks all attendance records for a class on a specific date as archived.
// Rule:
// - Past attendance can be archived.
// - Today's attendance can be archived only if its session is closed.
// - Future attendance cannot be archived.
func (a *App) ArchiveAttendanceSheet(classID int, date string) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	if err := a.ensureAttendanceSessionsTable(); err != nil {
		return fmt.Errorf("failed to initialize attendance sessions table: %w", err)
	}

	// Enforce archive rules
	today := time.Now().Format("2006-01-02")
	if date > today {
		return fmt.Errorf("cannot archive future attendance")
	}

	if date == today {
		var sessionStatus string
		err := a.db.QueryRow(
			`SELECT TOP 1 status FROM attendance_sessions WHERE class_id = ? AND attendance_date = ? AND COALESCE(is_archived, 0) = 0 ORDER BY session_id DESC`,
			classID, date,
		).Scan(&sessionStatus)
		if err != nil {
			return fmt.Errorf("cannot archive today's attendance unless the session is saved/closed")
		}
		if sessionStatus != "closed" {
			return fmt.Errorf("cannot archive today's attendance while session is still open")
		}
	}

	// Archive attendance records
	query := `
		UPDATE attendance 
		SET is_archived = 1,
			updated_at = CURRENT_TIMESTAMP
		WHERE class_id = ? AND attendance_date = ?
	`

	result, err := a.db.Exec(query, classID, date)
	if err != nil {
		log.Printf("Failed to archive attendance records: %v", err)
		return err
	}

	_, sessionArchiveErr := a.db.Exec(`
		UPDATE attendance_sessions
		SET is_archived = 1,
			updated_at = CURRENT_TIMESTAMP
		WHERE class_id = ? AND attendance_date = ? AND status = 'closed'
	`, classID, date)
	if sessionArchiveErr != nil {
		log.Printf("Warning: failed to archive attendance sessions for class_id=%d date=%s: %v", classID, date, sessionArchiveErr)
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("Archived attendance sheet: class_id=%d, date=%s, records=%d", classID, date, rowsAffected)
	return nil
}

// ArchiveAttendanceSession marks attendance records for a specific session as archived.
// This allows archiving one saved attendance row at a time even if there are other sessions on the same date.
func (a *App) ArchiveAttendanceSession(sessionID int, teacherUserID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	if err := a.ensureAttendanceSessionsTable(); err != nil {
		return fmt.Errorf("failed to initialize attendance sessions table: %w", err)
	}

	var attendanceDate string
	var sessionStatus string
	err := a.db.QueryRow(`
		SELECT
			CONVERT(VARCHAR(10), s.attendance_date, 23) AS attendance_date,
			s.status
		FROM attendance_sessions s
		JOIN classes c ON s.class_id = c.class_id
		WHERE s.session_id = ? AND c.teacher_id = ? AND COALESCE(s.is_archived, 0) = 0
	`, sessionID, teacherUserID).Scan(&attendanceDate, &sessionStatus)
	if err == sql.ErrNoRows {
		return fmt.Errorf("session not found or not authorized")
	}
	if err != nil {
		return err
	}

	today := time.Now().Format("2006-01-02")
	if attendanceDate > today {
		return fmt.Errorf("cannot archive future attendance")
	}
	if attendanceDate == today && sessionStatus != "closed" {
		return fmt.Errorf("cannot archive today's attendance while session is still open")
	}

	result, err := a.db.Exec(`
		UPDATE attendance
		SET is_archived = 1,
			updated_at = CURRENT_TIMESTAMP
		WHERE session_id = ?
	`, sessionID)
	if err != nil {
		log.Printf("Failed to archive attendance records by session: %v", err)
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	_, sessionArchiveErr := a.db.Exec(`
		UPDATE attendance_sessions
		SET is_archived = 1,
			updated_at = CURRENT_TIMESTAMP
		WHERE session_id = ?
	`, sessionID)
	if sessionArchiveErr != nil {
		log.Printf("Warning: failed to mark attendance session archived: session_id=%d err=%v", sessionID, sessionArchiveErr)
	}

	log.Printf("Archived attendance session: session_id=%d, records=%d", sessionID, rowsAffected)
	return nil
}

// UnarchiveAttendanceSession removes the archived flag from one specific attendance session.
// This is used when there are multiple sessions on the same class/date and only one should be restored.
func (a *App) UnarchiveAttendanceSession(sessionID int, teacherUserID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	if err := a.ensureAttendanceSessionsTable(); err != nil {
		return fmt.Errorf("failed to initialize attendance sessions table: %w", err)
	}

	var classID int
	var attendanceDate string
	err := a.db.QueryRow(`
		SELECT s.class_id, CONVERT(VARCHAR(10), s.attendance_date, 23) AS attendance_date
		FROM attendance_sessions s
		JOIN classes c ON s.class_id = c.class_id
		WHERE s.session_id = ? AND c.teacher_id = ?
	`, sessionID, teacherUserID).Scan(&classID, &attendanceDate)
	if err == sql.ErrNoRows {
		return fmt.Errorf("session not found or not authorized")
	}
	if err != nil {
		return err
	}

	result, err := a.db.Exec(`
		UPDATE attendance
		SET is_archived = 0,
			updated_at = CURRENT_TIMESTAMP
		WHERE session_id = ?
	`, sessionID)
	if err != nil {
		log.Printf("Failed to unarchive attendance records by session: %v", err)
		return err
	}

	_, sessionUnarchiveErr := a.db.Exec(`
		UPDATE attendance_sessions
		SET is_archived = 0,
			updated_at = CURRENT_TIMESTAMP
		WHERE session_id = ?
	`, sessionID)
	if sessionUnarchiveErr != nil {
		log.Printf("Warning: failed to unarchive attendance session flag: session_id=%d err=%v", sessionID, sessionUnarchiveErr)
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("Unarchived attendance session: session_id=%d, class_id=%d, date=%s, records=%d", sessionID, classID, attendanceDate, rowsAffected)
	return nil
}

// ArchivedAttendanceSheet represents a summary of an archived attendance sheet
type ArchivedAttendanceSheet struct {
	SessionID    int    `json:"session_id"`
	ClassID      int    `json:"class_id"`
	Date         string `json:"date"`
	SubjectCode  string `json:"subject_code"`
	SubjectName  string `json:"subject_name"`
	EdpCode      string `json:"edp_code"`
	Schedule     string `json:"schedule"`
	StudentCount int    `json:"student_count"`
	PresentCount int    `json:"present_count"`
	AbsentCount  int    `json:"absent_count"`
	LateCount    int    `json:"late_count"`
}

// GetArchivedAttendanceSheets gets all archived attendance sheets for a teacher
func (a *App) GetArchivedAttendanceSheets(teacherUserID int) ([]ArchivedAttendanceSheet, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
				SELECT
						s.session_id,
						s.class_id,
						CONVERT(VARCHAR(10), s.attendance_date, 23) AS date,
						subj.subject_code,
						subj.description AS subject_name,
						c.edp_code,
						c.schedule,
						-- Count based on archived attendance rows for the session (unique students).
						-- Join attendance rows that are archived and either belong to the same session
						-- OR (have no session_id but match by class_id + attendance_date). This
						-- ensures sheets archived by date (where attendance.session_id may be NULL)
						-- are still counted correctly.
						COUNT(DISTINCT a.student_id) AS student_count,
						SUM(CASE WHEN LOWER(ISNULL(a.status, '')) = 'present' THEN 1 ELSE 0 END) AS present_count,
						SUM(CASE WHEN LOWER(ISNULL(a.status, '')) = 'absent' THEN 1 ELSE 0 END) AS absent_count,
						SUM(CASE WHEN LOWER(ISNULL(a.status, '')) = 'late' THEN 1 ELSE 0 END) AS late_count
				FROM attendance_sessions s
				JOIN classes c ON s.class_id = c.class_id
				JOIN subjects subj ON c.subject_code = subj.subject_code
				LEFT JOIN attendance a ON COALESCE(a.is_archived, 0) = 1
						AND (
								a.session_id = s.session_id
								OR (a.session_id IS NULL AND a.class_id = s.class_id AND a.attendance_date = s.attendance_date)
						)
				WHERE c.teacher_id = ?
					AND (
						COALESCE(s.is_archived, 0) = 1
						OR a.student_id IS NOT NULL
					)
				GROUP BY s.session_id, s.class_id, s.attendance_date, subj.subject_code, subj.description, c.edp_code, c.schedule
				ORDER BY s.attendance_date DESC, s.session_id DESC, subj.subject_code
		`

	rows, err := a.db.Query(query, teacherUserID)
	if err != nil {
		log.Printf("Failed to query archived attendance sheets: %v", err)
		return nil, err
	}
	defer rows.Close()

	var sheets []ArchivedAttendanceSheet
	for rows.Next() {
		var sheet ArchivedAttendanceSheet
		var edpCode, schedule sql.NullString

		err := rows.Scan(
			&sheet.SessionID,
			&sheet.ClassID, &sheet.Date,
			&sheet.SubjectCode, &sheet.SubjectName,
			&edpCode, &schedule,
			&sheet.StudentCount, &sheet.PresentCount, &sheet.AbsentCount, &sheet.LateCount,
		)
		if err != nil {
			log.Printf("Failed to scan archived attendance sheet: %v", err)
			continue
		}

		if edpCode.Valid {
			sheet.EdpCode = edpCode.String
		}
		if schedule.Valid {
			sheet.Schedule = schedule.String
		}

		sheets = append(sheets, sheet)
	}

	return sheets, nil
}

// AttendanceSheetSummary represents a summary of an attendance sheet with its status
type AttendanceSheetSummary struct {
	SessionID    int    `json:"session_id"`
	ClassID      int    `json:"class_id"`
	Date         string `json:"date"`
	SubjectCode  string `json:"subject_code"`
	SubjectName  string `json:"subject_name"`
	EdpCode      string `json:"edp_code"`
	Schedule     string `json:"schedule"`
	Status       string `json:"status"`
	OpenedAt     string `json:"opened_at,omitempty"`
	StudentCount int    `json:"student_count"`
	PresentCount int    `json:"present_count"`
	AbsentCount  int    `json:"absent_count"`
	LateCount    int    `json:"late_count"`
	IsArchived   bool   `json:"is_archived"`
	IsEditable   bool   `json:"is_editable"`
}

// GetActiveAttendanceSheets gets all active (not archived) attendance sheets for a teacher
func (a *App) GetActiveAttendanceSheets(teacherUserID int) ([]AttendanceSheetSummary, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}
	if err := a.ensureAttendanceSessionsTable(); err != nil {
		return nil, fmt.Errorf("failed to initialize attendance sessions table: %w", err)
	}

	today := time.Now().Format("2006-01-02")

	query := `
		SELECT
			s.session_id,
			s.class_id,
			CONVERT(VARCHAR(10), s.attendance_date, 23) AS date,
			subj.subject_code,
			subj.description AS subject_name,
			c.edp_code,
			c.schedule,
			s.status,
			CONVERT(VARCHAR(19), s.opened_at, 120) AS opened_at,
			COUNT(a.student_id) AS student_count,
			SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_count,
			SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
			SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late_count,
			COALESCE(MAX(CAST(a.is_archived AS INT)), 0) AS is_archived
		FROM attendance_sessions s
		JOIN classes c ON s.class_id = c.class_id
		JOIN subjects subj ON c.subject_code = subj.subject_code
		LEFT JOIN attendance a ON a.session_id = s.session_id
		WHERE c.teacher_id = ?
		  AND s.status = 'closed'
		  AND COALESCE(s.is_archived, 0) = 0
		  AND COALESCE(c.is_archived, 0) = 0
		  AND (a.session_id IS NULL OR COALESCE(a.is_archived, 0) = 0)
		GROUP BY s.session_id, s.class_id, s.attendance_date, subj.subject_code, subj.description, c.edp_code, c.schedule, s.status, s.opened_at
		ORDER BY s.attendance_date DESC, s.session_id DESC, subj.subject_code
	`

	rows, err := a.db.Query(query, teacherUserID)
	if err != nil {
		log.Printf("Failed to query active attendance sheets: %v", err)
		return nil, err
	}
	defer rows.Close()

	var sheets []AttendanceSheetSummary
	for rows.Next() {
		var sheet AttendanceSheetSummary
		var edpCode, schedule, openedAt, status sql.NullString

		err := rows.Scan(
			&sheet.SessionID,
			&sheet.ClassID, &sheet.Date,
			&sheet.SubjectCode, &sheet.SubjectName,
			&edpCode, &schedule,
			&status, &openedAt,
			&sheet.StudentCount, &sheet.PresentCount, &sheet.AbsentCount, &sheet.LateCount,
			&sheet.IsArchived,
		)
		if err != nil {
			log.Printf("Failed to scan active attendance sheet: %v", err)
			continue
		}

		if edpCode.Valid {
			sheet.EdpCode = edpCode.String
		}
		if schedule.Valid {
			sheet.Schedule = schedule.String
		}
		if status.Valid {
			sheet.Status = status.String
		}
		if openedAt.Valid {
			sheet.OpenedAt = openedAt.String
		}
		// Is editable only if date == today
		sheet.IsEditable = (sheet.Date == today)

		sheets = append(sheets, sheet)
	}

	return sheets, nil
}

type AttendanceSession struct {
	SessionID            int     `json:"session_id"`
	ClassID              int     `json:"class_id"`
	AttendanceDate       string  `json:"attendance_date"`
	SessionName          string  `json:"session_name"`
	Status               string  `json:"status"`
	ClassDurationMinutes *int    `json:"class_duration_minutes,omitempty"`
	GracePeriodMinutes   *int    `json:"grace_period_minutes,omitempty"`
	OpenedAt             *string `json:"opened_at,omitempty"`
	PausedAt             *string `json:"paused_at,omitempty"`
	ClosedAt             *string `json:"closed_at,omitempty"`
	SubjectCode          string  `json:"subject_code"`
	SubjectName          string  `json:"subject_name"`
	EdpCode              string  `json:"edp_code"`
	PresentCount         int     `json:"present_count"`
	AbsentCount          int     `json:"absent_count"`
	LateCount            int     `json:"late_count"`
}

func (a *App) ensureAttendanceSessionsTable() error {
	if err := a.checkDB(); err != nil {
		return err
	}

	query := `
		IF OBJECT_ID('attendance_sessions', 'U') IS NULL
		BEGIN
			CREATE TABLE attendance_sessions (
				session_id INT IDENTITY(1,1) PRIMARY KEY,
				class_id INT NOT NULL,
				attendance_date DATE NOT NULL,
				session_name NVARCHAR(255) NOT NULL,
				status NVARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
				is_archived BIT NOT NULL DEFAULT 0,
				class_duration_minutes INT NULL,
				grace_period_minutes INT NULL,
				opened_at DATETIME NULL,
				paused_at DATETIME NULL,
				closed_at DATETIME NULL,
				created_by_user_id INT NOT NULL,
				created_at DATETIME DEFAULT GETDATE(),
				updated_at DATETIME DEFAULT GETDATE(),
				CONSTRAINT FK_attendance_sessions_class FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
				CONSTRAINT FK_attendance_sessions_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id)
			)
		END

		IF OBJECT_ID('attendance_sessions', 'U') IS NOT NULL
			AND EXISTS (
				SELECT 1
				FROM sys.key_constraints
				WHERE name = 'UQ_attendance_sessions_class_date'
					AND [type] = 'UQ'
					AND parent_object_id = OBJECT_ID('attendance_sessions')
			)
		BEGIN
			ALTER TABLE attendance_sessions DROP CONSTRAINT UQ_attendance_sessions_class_date
		END
	`

	_, err := a.db.Exec(query)
	if err != nil {
		return err
	}

	migrateAttendanceQuery := `
		IF OBJECT_ID('attendance_sessions', 'U') IS NOT NULL
			AND COL_LENGTH('attendance_sessions', 'is_archived') IS NULL
		BEGIN
			ALTER TABLE attendance_sessions ADD is_archived BIT NOT NULL DEFAULT 0
		END

		IF OBJECT_ID('attendance_sessions', 'U') IS NOT NULL
			AND COL_LENGTH('attendance_sessions', 'class_duration_minutes') IS NULL
		BEGIN
			ALTER TABLE attendance_sessions ADD class_duration_minutes INT NULL
		END

		IF OBJECT_ID('attendance_sessions', 'U') IS NOT NULL
			AND COL_LENGTH('attendance_sessions', 'grace_period_minutes') IS NULL
		BEGIN
			ALTER TABLE attendance_sessions ADD grace_period_minutes INT NULL
		END

		IF OBJECT_ID('attendance_sessions', 'U') IS NOT NULL
			AND COL_LENGTH('attendance_sessions', 'paused_at') IS NULL
		BEGIN
			ALTER TABLE attendance_sessions ADD paused_at DATETIME NULL
		END

		IF OBJECT_ID('attendance', 'U') IS NOT NULL
			AND COL_LENGTH('attendance', 'session_id') IS NULL
		BEGIN
			ALTER TABLE attendance ADD session_id INT NULL
		END

		IF OBJECT_ID('attendance', 'U') IS NOT NULL
			AND COL_LENGTH('attendance', 'time_in_at') IS NULL
		BEGIN
			ALTER TABLE attendance ADD time_in_at DATETIME NULL
		END

		IF OBJECT_ID('attendance', 'U') IS NOT NULL
		BEGIN
			IF COL_LENGTH('attendance', 'time_in_at') IS NOT NULL
			BEGIN
				EXEC sp_executesql N'UPDATE attendance
				SET time_in_at = COALESCE(time_in_at, updated_at)
				WHERE time_in_at IS NULL
					AND LOWER(LTRIM(RTRIM(COALESCE(status, '''')))) IN (''present'', ''late'', ''seat-in'', ''seat in'')';
			END
		END

		IF OBJECT_ID('attendance', 'U') IS NOT NULL
			AND COL_LENGTH('attendance', 'session_id') IS NOT NULL
			AND EXISTS (
				SELECT 1
				FROM attendance a
				WHERE a.session_id IS NULL
			)
		BEGIN
			EXEC sp_executesql N'UPDATE a
			SET a.session_id = s.latest_session_id
			FROM attendance a
			JOIN (
				SELECT class_id, attendance_date, MAX(session_id) AS latest_session_id
				FROM attendance_sessions
				GROUP BY class_id, attendance_date
			) s
				ON a.class_id = s.class_id
				AND a.attendance_date = s.attendance_date
			WHERE a.session_id IS NULL';
		END

		DECLARE @dropUniqueAttendanceSql NVARCHAR(MAX);
		SELECT TOP 1 @dropUniqueAttendanceSql = 'ALTER TABLE attendance DROP CONSTRAINT [' + kc.name + ']'
		FROM sys.key_constraints kc
		WHERE kc.parent_object_id = OBJECT_ID('attendance')
			AND kc.[type] = 'UQ'
			AND EXISTS (
				SELECT 1
				FROM sys.index_columns ic
				JOIN sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id
				WHERE ic.object_id = kc.parent_object_id
					AND ic.index_id = kc.unique_index_id
					AND col.name IN ('class_id', 'student_id', 'attendance_date')
			)
			AND NOT EXISTS (
				SELECT 1
				FROM sys.index_columns ic
				JOIN sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id
				WHERE ic.object_id = kc.parent_object_id
					AND ic.index_id = kc.unique_index_id
					AND col.name = 'session_id'
			);
		IF @dropUniqueAttendanceSql IS NOT NULL
		BEGIN
			EXEC sp_executesql @dropUniqueAttendanceSql;
		END

		IF OBJECT_ID('attendance', 'U') IS NOT NULL
			AND NOT EXISTS (
				SELECT 1
				FROM sys.key_constraints
				WHERE name = 'UQ_attendance_class_student_date_session'
					AND [type] = 'UQ'
					AND parent_object_id = OBJECT_ID('attendance')
			)
		BEGIN
			ALTER TABLE attendance
			ADD CONSTRAINT UQ_attendance_class_student_date_session UNIQUE (class_id, student_id, attendance_date, session_id)
		END

		IF OBJECT_ID('attendance', 'U') IS NOT NULL
			AND NOT EXISTS (
				SELECT 1
				FROM sys.indexes
				WHERE name = 'IX_attendance_class_date_session_student'
					AND object_id = OBJECT_ID('attendance')
			)
		BEGIN
			CREATE INDEX IX_attendance_class_date_session_student
			ON attendance (class_id, attendance_date, session_id, student_id)
		END
	`

	_, err = a.db.Exec(migrateAttendanceQuery)
	return err
}

func (a *App) ensureAttendanceRowsForSession(sessionID, classID int, date string) error {
	query := `
		INSERT INTO attendance (class_id, student_id, attendance_date, session_id, status, remarks, is_archived, created_at)
		SELECT
			cl.class_id,
			cl.student_id,
			?,
			?,
			NULL,
			NULL,
			0,
			CURRENT_TIMESTAMP
		FROM classlist cl
		JOIN classes c ON cl.class_id = c.class_id
		WHERE cl.class_id = ?
			AND cl.status = 'active'
			AND (cl.is_archived = 0 OR cl.is_archived IS NULL)
			AND COALESCE(c.is_archived, 0) = 0
			AND NOT EXISTS (
				SELECT 1
				FROM attendance a
				WHERE a.class_id = cl.class_id
					AND a.student_id = cl.student_id
					AND a.attendance_date = ?
					AND a.session_id = ?
			)
	`

	_, err := a.db.Exec(query, date, sessionID, classID, date, sessionID)
	return err
}

func (a *App) closeExpiredAttendanceSessions() error {
	_, normalizeErr := a.db.Exec(`
		UPDATE att
		SET
			att.status = 'absent',
			att.remarks = 'Absent',
			att.time_in_at = NULL,
			att.updated_at = CURRENT_TIMESTAMP
		FROM attendance att
		JOIN attendance_sessions s ON att.session_id = s.session_id
		WHERE s.status = 'open'
			AND COALESCE(s.is_archived, 0) = 0
			AND s.paused_at IS NULL
			AND COALESCE(att.is_archived, 0) = 0
			AND s.opened_at IS NOT NULL
			AND COALESCE(NULLIF(s.class_duration_minutes, 0), 0) > 0
			AND DATEADD(MINUTE, COALESCE(NULLIF(s.class_duration_minutes, 0), 0), s.opened_at) <= GETDATE()
			AND LOWER(LTRIM(RTRIM(COALESCE(att.status, '')))) NOT IN ('present', 'late', 'seat-in', 'seat in', 'absent')
	`)
	if normalizeErr != nil {
		return normalizeErr
	}

	result, err := a.db.Exec(`
		UPDATE attendance_sessions
		SET
			status = 'closed',
			closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
			updated_at = CURRENT_TIMESTAMP
		WHERE status = 'open'
			AND COALESCE(is_archived, 0) = 0
			AND paused_at IS NULL
			AND opened_at IS NOT NULL
			AND COALESCE(NULLIF(class_duration_minutes, 0), 0) > 0
			AND DATEADD(MINUTE, COALESCE(NULLIF(class_duration_minutes, 0), 0), opened_at) <= GETDATE()
	`)
	if err != nil {
		return err
	}

	if rowsAffected, rowsErr := result.RowsAffected(); rowsErr == nil && rowsAffected > 0 {
		log.Printf("Auto-closed %d expired attendance session(s)", rowsAffected)
	}

	return nil
}

func (a *App) getAttendanceSessionByID(sessionID int) (*AttendanceSession, error) {
	query := `
		SELECT
			s.session_id,
			s.class_id,
			CONVERT(VARCHAR(10), s.attendance_date, 23) AS attendance_date,
			s.session_name,
			s.status,
			s.class_duration_minutes,
			s.grace_period_minutes,
			CONVERT(VARCHAR(19), s.opened_at, 120) AS opened_at,
			CONVERT(VARCHAR(19), s.paused_at, 120) AS paused_at,
			CONVERT(VARCHAR(19), s.closed_at, 120) AS closed_at,
			subj.subject_code,
			subj.description,
			COALESCE(c.edp_code, ''),
			SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_count,
			SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
			SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late_count
		FROM attendance_sessions s
		JOIN classes c ON s.class_id = c.class_id
		JOIN subjects subj ON c.subject_code = subj.subject_code
		LEFT JOIN attendance a ON a.session_id = s.session_id
		WHERE s.session_id = ?
		GROUP BY s.session_id, s.class_id, s.attendance_date, s.session_name, s.status, s.class_duration_minutes, s.grace_period_minutes,
			s.opened_at, s.paused_at, s.closed_at, subj.subject_code, subj.description, c.edp_code
	`

	var session AttendanceSession
	var classDuration, gracePeriod sql.NullInt64
	var openedAt, pausedAt, closedAt sql.NullString
	err := a.db.QueryRow(query, sessionID).Scan(
		&session.SessionID,
		&session.ClassID,
		&session.AttendanceDate,
		&session.SessionName,
		&session.Status,
		&classDuration,
		&gracePeriod,
		&openedAt,
		&pausedAt,
		&closedAt,
		&session.SubjectCode,
		&session.SubjectName,
		&session.EdpCode,
		&session.PresentCount,
		&session.AbsentCount,
		&session.LateCount,
	)
	if err != nil {
		return nil, err
	}

	if classDuration.Valid {
		v := int(classDuration.Int64)
		session.ClassDurationMinutes = &v
	}
	if gracePeriod.Valid {
		v := int(gracePeriod.Int64)
		session.GracePeriodMinutes = &v
	}
	if openedAt.Valid {
		v := openedAt.String
		session.OpenedAt = &v
	}
	if pausedAt.Valid {
		v := pausedAt.String
		session.PausedAt = &v
	}
	if closedAt.Valid {
		v := closedAt.String
		session.ClosedAt = &v
	}

	return &session, nil
}

func (a *App) CreateAttendanceSession(classID int, date, sessionName string, teacherUserID int, classDurationMinutes int, gracePeriodMinutes int) (*AttendanceSession, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}
	if err := a.ensureAttendanceSessionsTable(); err != nil {
		return nil, fmt.Errorf("failed to initialize attendance sessions table: %w", err)
	}
	if err := a.closeExpiredAttendanceSessions(); err != nil {
		log.Printf("Warning: failed to close expired attendance sessions before create: %v", err)
	}

	if _, err := time.Parse("2006-01-02", date); err != nil {
		return nil, fmt.Errorf("invalid date format")
	}

	var ownerClassID int
	err := a.db.QueryRow(`
		SELECT class_id FROM classes
		WHERE class_id = ? AND teacher_id = ? AND is_active = 1 AND COALESCE(is_archived, 0) = 0
	`, classID, teacherUserID).Scan(&ownerClassID)
	if err != nil {
		return nil, fmt.Errorf("class not found or not authorized")
	}

	if strings.TrimSpace(sessionName) == "" {
		sessionName = fmt.Sprintf("Attendance %s %s", date, time.Now().Format("15:04:05"))
	}

	var openSessionID int
	err = a.db.QueryRow(`
		SELECT TOP 1 session_id
		FROM attendance_sessions
		WHERE class_id = ? AND attendance_date = ? AND status = 'open' AND COALESCE(is_archived, 0) = 0
		ORDER BY session_id DESC
	`, classID, date).Scan(&openSessionID)
	if err == nil {
		if ensureErr := a.ensureAttendanceRowsForSession(openSessionID, classID, date); ensureErr != nil {
			return nil, fmt.Errorf("failed to prepare attendance rows: %w", ensureErr)
		}
		return a.getAttendanceSessionByID(openSessionID)
	}
	if err != sql.ErrNoRows {
		return nil, err
	}

	if strings.TrimSpace(sessionName) == fmt.Sprintf("Attendance %s", date) {
		var existingCount int
		countErr := a.db.QueryRow(`
			SELECT COUNT(*)
			FROM attendance_sessions
			WHERE class_id = ? AND attendance_date = ? AND COALESCE(is_archived, 0) = 0
		`, classID, date).Scan(&existingCount)
		if countErr == nil && existingCount > 0 {
			sessionName = fmt.Sprintf("Attendance %s (%d)", date, existingCount+1)
		}
	}

	var newSessionID int
	err = a.db.QueryRow(`
		INSERT INTO attendance_sessions
		(class_id, attendance_date, session_name, status, class_duration_minutes, grace_period_minutes, opened_at, created_by_user_id, created_at, updated_at)
		OUTPUT INSERTED.session_id
		VALUES (?, ?, ?, 'open', ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, classID, date, sessionName, nullInt(classDurationMinutes), nullInt(gracePeriodMinutes), teacherUserID).Scan(&newSessionID)
	if err != nil {
		return nil, err
	}

	if err := a.ensureAttendanceRowsForSession(newSessionID, classID, date); err != nil {
		return nil, fmt.Errorf("failed to prepare attendance rows: %w", err)
	}

	// Notify enrolled students about the opened session
	go func(cID, sID int, sName string) {
		studentRows, qErr := a.db.Query(
			`SELECT student_id FROM classlist WHERE class_id = ? AND status = 'active'`, cID)
		if qErr != nil || studentRows == nil {
			return
		}
		defer studentRows.Close()
		for studentRows.Next() {
			var sid int
			if studentRows.Scan(&sid) == nil {
				a.createNotification(sid, "attendance",
					"Attendance Session Open",
					fmt.Sprintf("Attendance session opened: %s.", sName),
					"info", notifRef("attendance_session"), notifRefID(sID))
			}
		}
	}(classID, newSessionID, sessionName)

	return a.getAttendanceSessionByID(newSessionID)
}

func (a *App) GetTeacherAttendanceSessions(teacherUserID int) ([]AttendanceSession, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}
	if err := a.ensureAttendanceSessionsTable(); err != nil {
		return nil, fmt.Errorf("failed to initialize attendance sessions table: %w", err)
	}
	if err := a.closeExpiredAttendanceSessions(); err != nil {
		log.Printf("Warning: failed to close expired attendance sessions before teacher fetch: %v", err)
	}

	query := `
		SELECT
			s.session_id,
			s.class_id,
			CONVERT(VARCHAR(10), s.attendance_date, 23) AS attendance_date,
			s.session_name,
			s.status,
			s.class_duration_minutes,
			s.grace_period_minutes,
			CONVERT(VARCHAR(19), s.opened_at, 120) AS opened_at,
			CONVERT(VARCHAR(19), s.paused_at, 120) AS paused_at,
			CONVERT(VARCHAR(19), s.closed_at, 120) AS closed_at,
			subj.subject_code,
			subj.description,
			COALESCE(c.edp_code, ''),
			SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_count,
			SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
			SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late_count
		FROM attendance_sessions s
		JOIN classes c ON s.class_id = c.class_id
		JOIN subjects subj ON c.subject_code = subj.subject_code
		LEFT JOIN attendance a ON a.session_id = s.session_id
		WHERE c.teacher_id = ?
			AND COALESCE(s.is_archived, 0) = 0
		GROUP BY s.session_id, s.class_id, s.attendance_date, s.session_name, s.status, s.class_duration_minutes, s.grace_period_minutes,
			s.opened_at, s.paused_at, s.closed_at, subj.subject_code, subj.description, c.edp_code
		ORDER BY s.attendance_date DESC, s.session_id DESC
	`

	rows, err := a.db.Query(query, teacherUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sessions := make([]AttendanceSession, 0)
	for rows.Next() {
		var session AttendanceSession
		var classDuration, gracePeriod sql.NullInt64
		var openedAt, pausedAt, closedAt sql.NullString

		err := rows.Scan(
			&session.SessionID,
			&session.ClassID,
			&session.AttendanceDate,
			&session.SessionName,
			&session.Status,
			&classDuration,
			&gracePeriod,
			&openedAt,
			&pausedAt,
			&closedAt,
			&session.SubjectCode,
			&session.SubjectName,
			&session.EdpCode,
			&session.PresentCount,
			&session.AbsentCount,
			&session.LateCount,
		)
		if err != nil {
			continue
		}

		if classDuration.Valid {
			v := int(classDuration.Int64)
			session.ClassDurationMinutes = &v
		}
		if gracePeriod.Valid {
			v := int(gracePeriod.Int64)
			session.GracePeriodMinutes = &v
		}
		if openedAt.Valid {
			v := openedAt.String
			session.OpenedAt = &v
		}
		if pausedAt.Valid {
			v := pausedAt.String
			session.PausedAt = &v
		}
		if closedAt.Valid {
			v := closedAt.String
			session.ClosedAt = &v
		}

		sessions = append(sessions, session)
	}

	return sessions, nil
}

func (a *App) SaveAttendanceSession(sessionID int, teacherUserID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureAttendanceSessionsTable(); err != nil {
		return err
	}

	_, normalizeErr := a.db.Exec(`
		UPDATE attendance
		SET
			status = COALESCE(NULLIF(status, ''), 'absent'),
			remarks = CASE
				WHEN COALESCE(NULLIF(status, ''), 'absent') = 'present' THEN 'Present'
				WHEN COALESCE(NULLIF(status, ''), 'absent') = 'late' THEN 'Late'
				ELSE 'Absent'
			END,
			time_in_at = CASE
				WHEN COALESCE(NULLIF(status, ''), 'absent') IN ('present', 'late', 'seat-in', 'seat in')
					THEN COALESCE(time_in_at, updated_at)
				ELSE NULL
			END,
			updated_at = CURRENT_TIMESTAMP
		WHERE session_id = ? AND COALESCE(is_archived, 0) = 0
	`, sessionID)
	if normalizeErr != nil {
		return normalizeErr
	}

	result, err := a.db.Exec(`
		UPDATE s
		SET
			s.status = 'closed',
			s.paused_at = NULL,
			s.closed_at = CURRENT_TIMESTAMP,
			s.updated_at = CURRENT_TIMESTAMP
		FROM attendance_sessions s
		JOIN classes c ON s.class_id = c.class_id
		WHERE s.session_id = ? AND c.teacher_id = ? AND COALESCE(s.is_archived, 0) = 0
	`, sessionID, teacherUserID)
	if err != nil {
		return err
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("session not found or not authorized")
	}

	// Notify enrolled students that the session has been closed by the teacher.
	go func(sessID int) {
		var classID int
		var sessionName string
		if err := a.db.QueryRow(`
			SELECT class_id, session_name
			FROM attendance_sessions
			WHERE session_id = ?
		`, sessID).Scan(&classID, &sessionName); err != nil {
			log.Printf("Failed to load session info for close notification: session_id=%d err=%v", sessID, err)
			return
		}

		studentRows, err := a.db.Query(`
			SELECT student_id
			FROM classlist
			WHERE class_id = ? AND status = 'active' AND (is_archived = 0 OR is_archived IS NULL)
		`, classID)
		if err != nil || studentRows == nil {
			if err != nil {
				log.Printf("Failed to query students for close notification: class_id=%d err=%v", classID, err)
			}
			return
		}
		defer studentRows.Close()

		title := "Attendance Session Closed"
		msg := fmt.Sprintf("Attendance session closed: %s.", sessionName)
		for studentRows.Next() {
			var sid int
			if studentRows.Scan(&sid) == nil {
				a.createNotification(sid, "attendance", title, msg, "info", notifRef("attendance_session"), notifRefID(sessID))
			}
		}
	}(sessionID)

	return nil
}

func (a *App) RenameAttendanceSession(sessionID int, sessionName string, teacherUserID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureAttendanceSessionsTable(); err != nil {
		return err
	}

	sessionName = strings.TrimSpace(sessionName)
	if sessionName == "" {
		return fmt.Errorf("session name is required")
	}

	result, err := a.db.Exec(`
		UPDATE s
		SET
			s.session_name = ?,
			s.updated_at = CURRENT_TIMESTAMP
		FROM attendance_sessions s
		JOIN classes c ON s.class_id = c.class_id
		WHERE s.session_id = ? AND c.teacher_id = ? AND COALESCE(s.is_archived, 0) = 0
	`, sessionName, sessionID, teacherUserID)
	if err != nil {
		return err
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("session not found or not authorized")
	}

	return nil
}

func (a *App) PauseAttendanceSession(sessionID int, teacherUserID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureAttendanceSessionsTable(); err != nil {
		return err
	}

	result, err := a.db.Exec(`
		UPDATE s
		SET
			s.paused_at = COALESCE(s.paused_at, CURRENT_TIMESTAMP),
			s.updated_at = CURRENT_TIMESTAMP
		FROM attendance_sessions s
		JOIN classes c ON s.class_id = c.class_id
		WHERE s.session_id = ?
			AND c.teacher_id = ?
			AND s.status = 'open'
			AND COALESCE(s.is_archived, 0) = 0
	`, sessionID, teacherUserID)
	if err != nil {
		return err
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("session not found, already closed, or not authorized")
	}

	return nil
}

func (a *App) ResumeAttendanceSession(sessionID int, teacherUserID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureAttendanceSessionsTable(); err != nil {
		return err
	}

	result, err := a.db.Exec(`
		UPDATE s
		SET
			s.opened_at = CASE
				WHEN s.paused_at IS NULL THEN s.opened_at
				ELSE DATEADD(SECOND, DATEDIFF(SECOND, s.paused_at, CURRENT_TIMESTAMP), COALESCE(s.opened_at, CURRENT_TIMESTAMP))
			END,
			s.paused_at = NULL,
			s.updated_at = CURRENT_TIMESTAMP
		FROM attendance_sessions s
		JOIN classes c ON s.class_id = c.class_id
		WHERE s.session_id = ?
			AND c.teacher_id = ?
			AND s.status = 'open'
			AND COALESCE(s.is_archived, 0) = 0
	`, sessionID, teacherUserID)
	if err != nil {
		return err
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("session not found, already closed, or not authorized")
	}

	return nil
}

func (a *App) GetStudentOpenAttendanceSessions(studentUserID int) ([]AttendanceSession, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}
	if err := a.ensureAttendanceSessionsTable(); err != nil {
		return nil, err
	}
	if err := a.closeExpiredAttendanceSessions(); err != nil {
		log.Printf("Warning: failed to close expired attendance sessions before student fetch: %v", err)
	}

	query := `
		SELECT
			s.session_id,
			s.class_id,
			CONVERT(VARCHAR(10), s.attendance_date, 23) AS attendance_date,
			s.session_name,
			s.status,
			s.class_duration_minutes,
			s.grace_period_minutes,
			CONVERT(VARCHAR(19), s.opened_at, 120) AS opened_at,
			CONVERT(VARCHAR(19), s.paused_at, 120) AS paused_at,
			CONVERT(VARCHAR(19), s.closed_at, 120) AS closed_at,
			subj.subject_code,
			subj.description,
			COALESCE(c.edp_code, ''),
			SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_count,
			SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
			SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late_count
		FROM attendance_sessions s
		JOIN classes c ON s.class_id = c.class_id
		JOIN classlist cl ON cl.class_id = c.class_id
		JOIN subjects subj ON c.subject_code = subj.subject_code
		LEFT JOIN attendance sa
			ON sa.session_id = s.session_id
			AND sa.class_id = s.class_id
			AND sa.student_id = cl.student_id
			AND sa.attendance_date = s.attendance_date
		LEFT JOIN attendance a ON a.session_id = s.session_id
		WHERE cl.student_id = ?
			AND cl.status = 'active'
			AND (cl.is_archived = 0 OR cl.is_archived IS NULL)
			AND s.status = 'open'
			AND COALESCE(s.is_archived, 0) = 0
			AND LOWER(LTRIM(RTRIM(COALESCE(sa.status, '')))) NOT IN ('present', 'late', 'seat-in', 'seat in')
		GROUP BY s.session_id, s.class_id, s.attendance_date, s.session_name, s.status, s.class_duration_minutes, s.grace_period_minutes,
			s.opened_at, s.paused_at, s.closed_at, subj.subject_code, subj.description, c.edp_code
		ORDER BY s.opened_at DESC, s.session_id DESC
	`

	rows, err := a.db.Query(query, studentUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]AttendanceSession, 0)
	for rows.Next() {
		var session AttendanceSession
		var classDuration, gracePeriod sql.NullInt64
		var openedAt, pausedAt, closedAt sql.NullString

		err := rows.Scan(
			&session.SessionID,
			&session.ClassID,
			&session.AttendanceDate,
			&session.SessionName,
			&session.Status,
			&classDuration,
			&gracePeriod,
			&openedAt,
			&pausedAt,
			&closedAt,
			&session.SubjectCode,
			&session.SubjectName,
			&session.EdpCode,
			&session.PresentCount,
			&session.AbsentCount,
			&session.LateCount,
		)
		if err != nil {
			continue
		}

		if classDuration.Valid {
			v := int(classDuration.Int64)
			session.ClassDurationMinutes = &v
		}
		if gracePeriod.Valid {
			v := int(gracePeriod.Int64)
			session.GracePeriodMinutes = &v
		}
		if openedAt.Valid {
			v := openedAt.String
			session.OpenedAt = &v
		}
		if pausedAt.Valid {
			v := pausedAt.String
			session.PausedAt = &v
		}
		if closedAt.Valid {
			v := closedAt.String
			session.ClosedAt = &v
		}

		result = append(result, session)
	}

	return result, nil
}

func (a *App) StudentTimeIn(sessionID int, studentUserID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureAttendanceSessionsTable(); err != nil {
		return err
	}

	if err := a.closeStaleSessions(); err != nil {
		log.Printf("Failed to close stale sessions before student time-in: %v", err)
	}
	if err := a.closeExpiredAttendanceSessions(); err != nil {
		log.Printf("Failed to close expired attendance sessions before student time-in: %v", err)
	}

	var classID int
	var attendanceDate string
	var status string
	var classDuration sql.NullInt64
	var gracePeriod sql.NullInt64
	var openedAt sql.NullTime
	var pausedAt sql.NullTime
	err := a.db.QueryRow(`
		SELECT s.class_id, CONVERT(VARCHAR(10), s.attendance_date, 23), s.status, s.class_duration_minutes, s.grace_period_minutes, s.opened_at, s.paused_at
		FROM attendance_sessions s
		WHERE s.session_id = ?
	`, sessionID).Scan(&classID, &attendanceDate, &status, &classDuration, &gracePeriod, &openedAt, &pausedAt)
	if err != nil {
		return fmt.Errorf("attendance session not found")
	}

	if status != "open" {
		return fmt.Errorf("attendance session is closed")
	}
	if pausedAt.Valid {
		return fmt.Errorf("attendance session is paused")
	}

	var enrolled int
	err = a.db.QueryRow(`
		SELECT 1 FROM classlist
		WHERE class_id = ? AND student_id = ? AND status = 'active' AND (is_archived = 0 OR is_archived IS NULL)
	`, classID, studentUserID).Scan(&enrolled)
	if err != nil {
		return fmt.Errorf("student is not enrolled in this class")
	}

	var activeLogin int
	err = a.db.QueryRow(`
		SELECT TOP 1 1
		FROM log_entries le
		WHERE le.user_id = ?
			AND le.logout_time IS NULL
			AND EXISTS (
				SELECT 1 FROM user_session_heartbeats sh
				WHERE sh.user_id = le.user_id
				AND sh.last_seen >= DATEADD(SECOND, -?, GETDATE())
			)
		ORDER BY le.login_time DESC
	`, studentUserID, sessionHeartbeatTimeoutSeconds).Scan(&activeLogin)
	if err != nil {
		return fmt.Errorf("student must be logged in to time in")
	}

	if err := a.ensureAttendanceRowsForSession(sessionID, classID, attendanceDate); err != nil {
		return err
	}

	resolvedClassDuration := int64(0)
	if classDuration.Valid {
		resolvedClassDuration = classDuration.Int64
	}

	// Use class duration as the session expiry window. Do NOT treat the grace
	// period as the cutoff for closing the session; grace only affects late
	// determination. If class duration is unset (0) we won't auto-close the
	// session based on grace expiration which would prevent marking students
	// as late.
	attendanceWindowMinutes := resolvedClassDuration

	if openedAt.Valid {
		if attendanceWindowMinutes > 0 {
			expiresAt := openedAt.Time.Add(time.Duration(attendanceWindowMinutes) * time.Minute)
			if time.Now().After(expiresAt) {
				_, _ = a.db.Exec(`
					UPDATE attendance_sessions
					SET status = 'closed', closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
					WHERE session_id = ? AND status = 'open'
				`, sessionID)
				return fmt.Errorf("attendance session class duration is over")
			}
		}
	}

	// Determine present vs late using the database clock so timezone and server
	// consistency match. Late = time-in is after (opened_at + grace_period_minutes).
	result, err := a.db.Exec(`
		UPDATE a
		SET
			a.status = CASE
				WHEN s.opened_at IS NULL THEN 'present'
				WHEN GETDATE() <= DATEADD(MINUTE, COALESCE(NULLIF(s.grace_period_minutes, 0), 0), s.opened_at) THEN 'present'
				ELSE 'late'
			END,
			a.remarks = CASE
				WHEN s.opened_at IS NULL THEN 'Present'
				WHEN GETDATE() <= DATEADD(MINUTE, COALESCE(NULLIF(s.grace_period_minutes, 0), 0), s.opened_at) THEN 'Present'
				ELSE 'Late'
			END,
			a.time_in_at = COALESCE(a.time_in_at, CURRENT_TIMESTAMP),
			a.updated_at = CURRENT_TIMESTAMP
		FROM attendance a
		INNER JOIN attendance_sessions s ON s.session_id = a.session_id
		WHERE a.class_id = ? AND a.student_id = ? AND a.attendance_date = ? AND a.session_id = ? AND COALESCE(a.is_archived, 0) = 0
	`, classID, studentUserID, attendanceDate, sessionID)
	if err != nil {
		return err
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("attendance record not found")
	}

	// Notify the student about their time-in status
	go func(sID, sessID, cID int) {
		var resultStatus string
		_ = a.db.QueryRow(`
			SELECT status FROM attendance
			WHERE student_id = ? AND session_id = ? AND class_id = ? AND COALESCE(is_archived, 0) = 0
		`, sID, sessID, cID).Scan(&resultStatus)
		if resultStatus == "" {
			return
		}
		tone := "success"
		if resultStatus == "late" {
			tone = "warning"
		}
		title := "Attendance Recorded"
		label := resultStatus
		if len(label) > 0 {
			label = strings.ToUpper(label[:1]) + label[1:]
		}
		msg := fmt.Sprintf("You timed in as %s.", label)
		a.createNotification(sID, "attendance", title, msg, tone, notifRef("attendance_session"), notifRefID(sessID))
	}(studentUserID, sessionID, classID)

	return nil
}

func nullInt(value int) interface{} {
	if value < 0 {
		return nil
	}
	return value
}

// ==============================================================================
// STUDENT ATTENDANCE HISTORY
// ==============================================================================

// AttendanceHistoryRecord represents a single attendance record for the student history view.
type AttendanceHistoryRecord struct {
	ClassID     int     `json:"class_id"`
	SubjectCode string  `json:"subject_code"`
	SubjectName string  `json:"subject_name"`
	Section     string  `json:"section"`
	Date        string  `json:"date"`
	SessionName *string `json:"session_name,omitempty"`
	Status      string  `json:"status"`
	TimeIn      *string `json:"time_in,omitempty"`
}

// GetStudentAttendanceHistory returns all attendance records for a student ordered by date descending.
func (a *App) GetStudentAttendanceHistory(userID int) ([]AttendanceHistoryRecord, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	rows, err := a.db.Query(`
		SELECT
			a.class_id,
			c.subject_code,
			s.description as subject_name,
			ISNULL(c.section, '') as section,
			CONVERT(VARCHAR(10), a.attendance_date, 23) as date,
			sess.session_name,
			ISNULL(a.status, 'absent') as status,
			CONVERT(VARCHAR(8), a.time_in_at, 108) as time_in
		FROM attendance a
		JOIN classes c ON a.class_id = c.class_id
		JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN attendance_sessions sess ON a.session_id = sess.session_id
		WHERE a.student_id = ?
		ORDER BY a.attendance_date DESC, a.id DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []AttendanceHistoryRecord
	for rows.Next() {
		var rec AttendanceHistoryRecord
		var sessionName, timeIn sql.NullString
		err := rows.Scan(
			&rec.ClassID, &rec.SubjectCode, &rec.SubjectName, &rec.Section,
			&rec.Date, &sessionName, &rec.Status, &timeIn,
		)
		if err != nil {
			log.Printf("Failed to scan attendance history record: %v", err)
			continue
		}
		if sessionName.Valid && sessionName.String != "" {
			rec.SessionName = &sessionName.String
		}
		if timeIn.Valid && strings.TrimSpace(timeIn.String) != "" {
			v := strings.TrimSpace(timeIn.String)
			rec.TimeIn = &v
		}
		rec.Status = strings.TrimSpace(rec.Status)
		records = append(records, rec)
	}
	return records, nil
}
