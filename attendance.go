package main

import (
	"database/sql"
	"encoding/csv"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
)

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

	// Only auto-create attendance if:
	// 1. The requested date is TODAY
	// 2. The class is ACTIVE (not closed)
	// 3. The class is NOT archived
	// 4. Attendance does NOT already exist for this date
	if date == today && classIsActive && !isArchived {
		var count int
		err = a.db.QueryRow(
			`SELECT COUNT(*) FROM attendance WHERE class_id = ? AND attendance_date = ?`,
			classID, date,
		).Scan(&count)
		if err != nil {
			return nil, fmt.Errorf("failed to check existing attendance: %w", err)
		}

		if count == 0 {
			// Auto-create attendance rows for all active students
			insertQuery := `
				INSERT INTO attendance (class_id, student_id, attendance_date, status, remarks, is_archived, created_at)
				SELECT 
					cl.class_id,
					cl.student_id,
					?,
					'absent',
					NULL,
					0,
					CURRENT_TIMESTAMP
				FROM classlist cl
				WHERE cl.class_id = ? AND cl.status = 'active' AND (cl.is_archived = 0 OR cl.is_archived IS NULL)
				AND NOT EXISTS (
					SELECT 1 FROM attendance a 
					WHERE a.class_id = cl.class_id AND a.student_id = cl.student_id AND a.attendance_date = ?
				)
			`
			_, err = a.db.Exec(insertQuery, date, classID, date)
			if err != nil {
				log.Printf("Failed to auto-create attendance: %v", err)
				return nil, fmt.Errorf("failed to create attendance: %w", err)
			}
			log.Printf("Auto-created attendance for class %d on %s", classID, date)
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
		var middleName, remarks, status sql.NullString
		var isArchived bool

		err := rows.Scan(
			&att.ClassID, &att.StudentUserID, &att.Date,
			&att.StudentCode, &att.FirstName, &middleName, &att.LastName,
			&att.SubjectCode, &att.SubjectName,
			&status, &remarks, &isArchived,
		)
		if err != nil {
			log.Printf("Failed to scan attendance row: %v", err)
			continue
		}

		if middleName.Valid {
			att.MiddleName = &middleName.String
		}
		if remarks.Valid {
			att.Remarks = &remarks.String
		}
		if status.Valid {
			att.Status = status.String
		} else {
			att.Status = "absent"
		}
		att.IsArchived = isArchived
		// CRITICAL: editable only if date is TODAY and not archived
		att.IsEditable = (date == today) && !isArchived

		attendances = append(attendances, att)
	}

	return attendances, nil
}

// CheckAttendanceExists checks if an attendance sheet already exists for a class on a given date
func (a *App) CheckAttendanceExists(classID int, date string) (bool, error) {
	if err := a.checkDB(); err != nil {
		return false, err
	}

	var count int
	query := `SELECT COUNT(*) FROM attendance WHERE class_id = ? AND attendance_date = ?`
	err := a.db.QueryRow(query, classID, date).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("failed to check existing attendance: %w", err)
	}
	return count > 0, nil
}

// UpdateAttendanceRecord updates a specific attendance record.
// CRITICAL RULE: Only allows updates if attendance_date == TODAY.
func (a *App) UpdateAttendanceRecord(classID, studentUserID int, date, status, remarks string) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	// Enforce same-day edit rule
	today := time.Now().Format("2006-01-02")
	if date != today {
		return fmt.Errorf("attendance can only be edited on the same day. Date %s is read-only", date)
	}

	// Verify the record is not archived
	var isArchived bool
	err := a.db.QueryRow(
		`SELECT COALESCE(is_archived, 0) FROM attendance WHERE class_id = ? AND student_id = ? AND attendance_date = ?`,
		classID, studentUserID, date,
	).Scan(&isArchived)
	if err != nil {
		return fmt.Errorf("attendance record not found")
	}
	if isArchived {
		return fmt.Errorf("archived attendance cannot be edited")
	}

	// Validate status
	validStatuses := map[string]bool{"absent": true, "present": true, "late": true}
	if !validStatuses[status] {
		return fmt.Errorf("invalid status: %s. Must be 'absent', 'present', or 'late'", status)
	}

	query := `
		UPDATE attendance 
		SET status = ?,
		    remarks = ?,
		    updated_at = CURRENT_TIMESTAMP
		WHERE class_id = ? AND student_id = ? AND attendance_date = ?
	`

	_, err = a.db.Exec(query, status, nullString(remarks), classID, studentUserID, date)
	if err != nil {
		log.Printf("Failed to update attendance record: %v", err)
		return err
	}

	log.Printf("Attendance record updated: class_id=%d, student_id=%d, date=%s, status=%s", classID, studentUserID, date, status)
	return nil
}

func (a *App) GetSessionAttendance(sessionID int, teacherUserID int) ([]Attendance, error) {
	if err := a.checkDB(); err != nil {
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
			subj.subject_code,
			subj.description as subject_name,
			a.status,
			a.remarks,
			COALESCE(a.is_archived, 0) as is_archived,
			sess.status as session_status
		FROM attendance a
		JOIN attendance_sessions sess ON a.session_id = sess.session_id
		JOIN students stu ON a.student_id = stu.id
		JOIN classes c ON a.class_id = c.class_id
		JOIN subjects subj ON c.subject_code = subj.subject_code
		WHERE a.session_id = ? AND c.teacher_id = ?
		ORDER BY stu.last_name, stu.first_name
	`

	rows, err := a.db.Query(query, sessionID, teacherUserID)
	if err != nil {
		log.Printf("Failed to query session attendance: %v", err)
		return nil, err
	}
	defer rows.Close()

	var attendances []Attendance
	for rows.Next() {
		var att Attendance
		var middleName, remarks, status sql.NullString
		var isArchived bool
		var sessionStatus string

		err := rows.Scan(
			&att.ClassID, &att.StudentUserID, &att.Date,
			&att.StudentCode, &att.FirstName, &middleName, &att.LastName,
			&att.SubjectCode, &att.SubjectName,
			&status, &remarks, &isArchived, &sessionStatus,
		)
		if err != nil {
			log.Printf("Failed to scan session attendance row: %v", err)
			continue
		}

		if middleName.Valid {
			att.MiddleName = &middleName.String
		}
		if remarks.Valid {
			att.Remarks = &remarks.String
		}
		if status.Valid {
			att.Status = status.String
		} else {
			att.Status = "absent"
		}
		att.IsArchived = isArchived
		att.IsEditable = (att.Date == today) && !isArchived && sessionStatus == "open"

		attendances = append(attendances, att)
	}

	return attendances, nil
}

func (a *App) UpdateSessionAttendanceRecord(sessionID, studentUserID, teacherUserID int, status, remarks string) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	validStatuses := map[string]bool{"absent": true, "present": true, "late": true}
	if !validStatuses[status] {
		return fmt.Errorf("invalid status: %s. Must be 'absent', 'present', or 'late'", status)
	}

	var classID int
	var attendanceDate string
	var sessionStatus string
	err := a.db.QueryRow(`
		SELECT s.class_id, CONVERT(VARCHAR(10), s.attendance_date, 23), s.status
		FROM attendance_sessions s
		JOIN classes c ON s.class_id = c.class_id
		WHERE s.session_id = ? AND c.teacher_id = ? AND COALESCE(s.is_archived, 0) = 0
	`, sessionID, teacherUserID).Scan(&classID, &attendanceDate, &sessionStatus)
	if err != nil {
		return fmt.Errorf("attendance session not found or not authorized")
	}

	today := time.Now().Format("2006-01-02")
	if attendanceDate != today {
		return fmt.Errorf("attendance can only be edited on the same day. Date %s is read-only", attendanceDate)
	}
	if sessionStatus != "open" {
		return fmt.Errorf("attendance session is already saved")
	}

	result, err := a.db.Exec(`
		UPDATE attendance
		SET status = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP
		WHERE session_id = ?
			AND class_id = ?
			AND student_id = ?
			AND attendance_date = ?
			AND COALESCE(is_archived, 0) = 0
	`, status, nullString(remarks), sessionID, classID, studentUserID, attendanceDate)
	if err != nil {
		return err
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("attendance record not found")
	}

	return nil
}

// ExportAttendanceCSV exports attendance to CSV for a specific class
func (a *App) ExportAttendanceCSV(classID int) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}

	query := `
		SELECT 
			a.class_id, a.student_id, CONVERT(VARCHAR(10), a.attendance_date, 23) as date, a.status, a.remarks,
			stu.student_id, stu.first_name, stu.middle_name, stu.last_name,
			c.subject_code, s.description as subject_name
		FROM attendance a
		JOIN students stu ON a.student_id = stu.id
		JOIN classes c ON a.class_id = c.class_id
		JOIN subjects s ON c.subject_code = s.subject_code
		WHERE a.class_id = ?
		ORDER BY a.attendance_date DESC, stu.last_name, stu.first_name
	`
	rows, err := a.db.Query(query, classID)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	var attendances []Attendance
	for rows.Next() {
		var att Attendance
		var remarks, middleName sql.NullString
		err := rows.Scan(
			&att.ClassID, &att.StudentUserID, &att.Date, &att.Status, &remarks,
			&att.StudentCode, &att.FirstName, &middleName, &att.LastName,
			&att.SubjectCode, &att.SubjectName,
		)
		if err != nil {
			continue
		}

		if remarks.Valid {
			att.Remarks = &remarks.String
		}
		if middleName.Valid {
			att.MiddleName = &middleName.String
		}

		attendances = append(attendances, att)
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("attendance_%s.csv", time.Now().Format("20060102_150405")))

	file, err := os.Create(filename)
	if err != nil {
		return "", err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// Write header
	writer.Write([]string{"Date", "Student ID", "First Name", "Middle Name", "Last Name", "Subject", "Status", "Remarks"})

	// Write data
	for _, att := range attendances {
		middleName := ""
		if att.MiddleName != nil {
			middleName = *att.MiddleName
		}
		remarks := ""
		if att.Remarks != nil {
			remarks = *att.Remarks
		}

		writer.Write([]string{
			att.Date,
			att.StudentCode,
			att.FirstName,
			middleName,
			att.LastName,
			fmt.Sprintf("%s - %s", att.SubjectCode, att.SubjectName),
			att.Status,
			remarks,
		})
	}

	log.Printf("Attendance exported to CSV: %s", filename)
	return filename, nil
}

// ExportAttendanceCSVByDate exports attendance to CSV for a specific class and date.
func (a *App) ExportAttendanceCSVByDate(classID int, date string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}

	if _, err := time.Parse("2006-01-02", date); err != nil {
		return "", fmt.Errorf("invalid date format: %w", err)
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
		log.Printf("Failed to get class info for attendance CSV export: %v", err)
		subjectCode = fmt.Sprintf("CLASS %d", classID)
		subjectName = sql.NullString{String: "Unknown Subject", Valid: true}
	}

	query := `
		SELECT 
			a.class_id, a.student_id, CONVERT(VARCHAR(10), a.attendance_date, 23) as date, a.status,
			stu.student_id, stu.first_name, stu.middle_name, stu.last_name,
			c.subject_code, s.description as subject_name
		FROM attendance a
		JOIN students stu ON a.student_id = stu.id
		JOIN classes c ON a.class_id = c.class_id
		JOIN subjects s ON c.subject_code = s.subject_code
		WHERE a.class_id = ? AND a.attendance_date = ?
		ORDER BY stu.last_name, stu.first_name
	`
	rows, err := a.db.Query(query, classID, date)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	var attendances []Attendance
	for rows.Next() {
		var att Attendance
		var middleName sql.NullString
		err := rows.Scan(
			&att.ClassID, &att.StudentUserID, &att.Date, &att.Status,
			&att.StudentCode, &att.FirstName, &middleName, &att.LastName,
			&att.SubjectCode, &att.SubjectName,
		)
		if err != nil {
			continue
		}

		if middleName.Valid {
			att.MiddleName = &middleName.String
		}

		attendances = append(attendances, att)
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("attendance_%d_%s_%s.csv", classID, date, time.Now().Format("150405")))

	file, err := os.Create(filename)
	if err != nil {
		return "", err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	subjectNameValue := "—"
	if subjectName.Valid && strings.TrimSpace(subjectName.String) != "" {
		subjectNameValue = subjectName.String
	}
	scheduleValue := "—"
	if schedule.Valid && strings.TrimSpace(schedule.String) != "" {
		scheduleValue = schedule.String
	}
	roomValue := "—"
	if room.Valid && strings.TrimSpace(room.String) != "" {
		roomValue = room.String
	}
	teacherValue := "—"
	if teacherName.Valid && strings.TrimSpace(teacherName.String) != "" {
		teacherValue = teacherName.String
	}

	displayDate := date
	if parsedDate, parseErr := time.Parse("2006-01-02", date); parseErr == nil {
		displayDate = parsedDate.Format("January 2, 2006")
	}

	writer.Write([]string{"ATTENDANCE SHEET"})
	writer.Write([]string{displayDate})
	writer.Write([]string{""})
	writer.Write([]string{"CLASS INFORMATION"})
	writer.Write([]string{"Subject", fmt.Sprintf("%s - %s", subjectCode, subjectNameValue), "Schedule", scheduleValue})
	writer.Write([]string{"Instructor", teacherValue, "Room", roomValue})
	writer.Write([]string{""})
	writer.Write([]string{"DAILY ATTENDANCE RECORD"})
	writer.Write([]string{"Total Students", fmt.Sprintf("%d", len(attendances))})
	writer.Write([]string{"No.", "Student ID", "Student Name", "Status"})

	presentCount := 0
	lateCount := 0
	absentCount := 0

	for index, att := range attendances {
		middleName := ""
		if att.MiddleName != nil {
			middleName = strings.TrimSpace(*att.MiddleName)
		}

		middleInitial := ""
		if middleName != "" {
			middleInitial = fmt.Sprintf(" %s.", strings.ToUpper(string(middleName[0])))
		}
		fullName := fmt.Sprintf("%s, %s%s", att.LastName, att.FirstName, middleInitial)
		status := strings.ToLower(strings.TrimSpace(att.Status))
		switch status {
		case "present":
			presentCount++
		case "late":
			lateCount++
		default:
			absentCount++
		}

		writer.Write([]string{
			fmt.Sprintf("%d", index+1),
			att.StudentCode,
			fullName,
			strings.Title(status),
		})
	}

	writer.Write([]string{""})
	writer.Write([]string{"SUMMARY"})
	writer.Write([]string{"Present", fmt.Sprintf("%d", presentCount)})
	writer.Write([]string{"Late", fmt.Sprintf("%d", lateCount)})
	writer.Write([]string{"Absent", fmt.Sprintf("%d", absentCount)})
	writer.Write([]string{"Total", fmt.Sprintf("%d", len(attendances))})

	log.Printf("Attendance exported to CSV by date: class=%d, date=%s, file=%s", classID, date, filename)
	return filename, nil
}

// ExportAttendancePDFByDate exports attendance to PDF for a specific class and date.
func (a *App) ExportAttendancePDFByDate(classID int, date string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}

	if _, err := time.Parse("2006-01-02", date); err != nil {
		return "", fmt.Errorf("invalid date format: %w", err)
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
		log.Printf("Failed to get class info for attendance PDF export: %v", err)
		subjectCode = fmt.Sprintf("CLASS %d", classID)
		subjectName = sql.NullString{String: "Unknown Subject", Valid: true}
	}

	query := `
		SELECT 
			a.class_id, a.student_id, CONVERT(VARCHAR(10), a.attendance_date, 23) as date, a.status,
			stu.student_id, stu.first_name, stu.middle_name, stu.last_name,
			c.subject_code, s.description as subject_name
		FROM attendance a
		JOIN students stu ON a.student_id = stu.id
		JOIN classes c ON a.class_id = c.class_id
		JOIN subjects s ON c.subject_code = s.subject_code
		WHERE a.class_id = ? AND a.attendance_date = ?
		ORDER BY stu.last_name, stu.first_name
	`
	rows, err := a.db.Query(query, classID, date)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	var attendances []Attendance
	for rows.Next() {
		var att Attendance
		var middleName sql.NullString
		err := rows.Scan(
			&att.ClassID, &att.StudentUserID, &att.Date, &att.Status,
			&att.StudentCode, &att.FirstName, &middleName, &att.LastName,
			&att.SubjectCode, &att.SubjectName,
		)
		if err != nil {
			continue
		}

		if middleName.Valid {
			att.MiddleName = &middleName.String
		}

		attendances = append(attendances, att)
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("attendance_%d_%s_%s.pdf", classID, date, time.Now().Format("150405")))

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(10, 10, 10)
	pdf.SetAutoPageBreak(true, 10)
	pdf.AddPage()

	subjectNameValue := "—"
	if subjectName.Valid && strings.TrimSpace(subjectName.String) != "" {
		subjectNameValue = subjectName.String
	}
	scheduleValue := "—"
	if schedule.Valid && strings.TrimSpace(schedule.String) != "" {
		scheduleValue = schedule.String
	}
	roomValue := "—"
	if room.Valid && strings.TrimSpace(room.String) != "" {
		roomValue = room.String
	}
	teacherValue := "—"
	if teacherName.Valid && strings.TrimSpace(teacherName.String) != "" {
		teacherValue = teacherName.String
	}

	displayDate := date
	if parsedDate, parseErr := time.Parse("2006-01-02", date); parseErr == nil {
		displayDate = parsedDate.Format("January 2, 2006")
	}

	pdf.SetFont("Arial", "B", 14)
	pdf.Cell(0, 8, "Attendance Sheet")
	pdf.Ln(9)
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(0, 6, displayDate)
	pdf.Ln(6)
	pdf.SetFont("Arial", "B", 10)
	pdf.Cell(0, 6, "CLASS INFORMATION")
	pdf.Ln(7)
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(25, 6, "Subject:", "", 0, "L", false, 0, "")
	pdf.CellFormat(90, 6, fmt.Sprintf("%s - %s", subjectCode, subjectNameValue), "", 0, "L", false, 0, "")
	pdf.CellFormat(20, 6, "Schedule:", "", 0, "L", false, 0, "")
	pdf.CellFormat(55, 6, scheduleValue, "", 1, "L", false, 0, "")
	pdf.CellFormat(25, 6, "Instructor:", "", 0, "L", false, 0, "")
	pdf.CellFormat(90, 6, teacherValue, "", 0, "L", false, 0, "")
	pdf.CellFormat(20, 6, "Room:", "", 0, "L", false, 0, "")
	pdf.CellFormat(55, 6, roomValue, "", 1, "L", false, 0, "")
	pdf.Ln(8)
	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(120, 6, "DAILY ATTENDANCE RECORD", "", 0, "L", false, 0, "")
	pdf.CellFormat(70, 6, fmt.Sprintf("Total Students: %d", len(attendances)), "", 1, "R", false, 0, "")
	pdf.Ln(1)

	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(12, 7, "#", "1", 0, "C", false, 0, "")
	pdf.CellFormat(32, 7, "Student ID", "1", 0, "C", false, 0, "")
	pdf.CellFormat(106, 7, "Student Name", "1", 0, "C", false, 0, "")
	pdf.CellFormat(40, 7, "Status", "1", 1, "C", false, 0, "")

	pdf.SetFont("Arial", "", 9)
	presentCount := 0
	lateCount := 0
	absentCount := 0
	for index, att := range attendances {
		middleInitial := ""
		if att.MiddleName != nil && *att.MiddleName != "" {
			middleInitial = fmt.Sprintf(" %s.", strings.ToUpper(string((*att.MiddleName)[0])))
		}
		fullName := fmt.Sprintf("%s, %s%s", att.LastName, att.FirstName, middleInitial)
		status := strings.ToLower(strings.TrimSpace(att.Status))
		switch status {
		case "present":
			presentCount++
		case "late":
			lateCount++
		default:
			absentCount++
		}

		pdf.CellFormat(12, 7, fmt.Sprintf("%d", index+1), "1", 0, "C", false, 0, "")
		pdf.CellFormat(32, 7, att.StudentCode, "1", 0, "L", false, 0, "")
		pdf.CellFormat(106, 7, fullName, "1", 0, "L", false, 0, "")
		pdf.CellFormat(40, 7, strings.Title(status), "1", 1, "C", false, 0, "")
	}

	pdf.Ln(3)
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(190, 6, "SUMMARY", "", 1, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(40, 6, fmt.Sprintf("Present: %d", presentCount), "", 0, "L", false, 0, "")
	pdf.CellFormat(40, 6, fmt.Sprintf("Late: %d", lateCount), "", 0, "L", false, 0, "")
	pdf.CellFormat(40, 6, fmt.Sprintf("Absent: %d", absentCount), "", 0, "L", false, 0, "")
	pdf.CellFormat(70, 6, fmt.Sprintf("Total: %d", len(attendances)), "", 1, "R", false, 0, "")

	if err := pdf.OutputFileAndClose(filename); err != nil {
		return "", err
	}

	log.Printf("Attendance exported to PDF by date: class=%d, date=%s, file=%s", classID, date, filename)
	return filename, nil
}

// ExportArchivedAttendanceCSVByDate exports only archived attendance records for a specific class/date/session.
func (a *App) ExportArchivedAttendanceCSVByDate(classID int, date string, sessionID int) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}

	if sessionID <= 0 {
		return "", fmt.Errorf("invalid archived attendance session")
	}

	if _, err := time.Parse("2006-01-02", date); err != nil {
		return "", fmt.Errorf("invalid date format: %w", err)
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
		log.Printf("Failed to get class info for archived attendance CSV export: %v", err)
		subjectCode = fmt.Sprintf("CLASS %d", classID)
		subjectName = sql.NullString{String: "Unknown Subject", Valid: true}
	}

	query := `
		WITH ranked_attendance AS (
			SELECT 
				a.class_id, a.student_id, CONVERT(VARCHAR(10), a.attendance_date, 23) as date, a.status, a.remarks,
				stu.student_id AS student_code, stu.first_name, stu.middle_name, stu.last_name,
				c.subject_code, s.description as subject_name,
				ROW_NUMBER() OVER (
					PARTITION BY a.student_id
					ORDER BY a.updated_at DESC, a.created_at DESC, a.id DESC
				) AS rn
			FROM attendance a
			JOIN students stu ON a.student_id = stu.id
			JOIN classes c ON a.class_id = c.class_id
			JOIN subjects s ON c.subject_code = s.subject_code
			WHERE a.class_id = ?
			  AND a.attendance_date = ?
			  AND a.session_id = ?
			  AND COALESCE(a.is_archived, 0) = 1
		)
		SELECT
			class_id, student_id, date, status, remarks,
			student_code, first_name, middle_name, last_name,
			subject_code, subject_name
		FROM ranked_attendance
		WHERE rn = 1
		ORDER BY last_name, first_name
	`
	args := []interface{}{classID, date, sessionID}

	rows, err := a.db.Query(query, args...)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	var attendances []Attendance
	for rows.Next() {
		var att Attendance
		var remarks, middleName sql.NullString
		err := rows.Scan(
			&att.ClassID, &att.StudentUserID, &att.Date, &att.Status, &remarks,
			&att.StudentCode, &att.FirstName, &middleName, &att.LastName,
			&att.SubjectCode, &att.SubjectName,
		)
		if err != nil {
			continue
		}

		if remarks.Valid {
			att.Remarks = &remarks.String
		}
		if middleName.Valid {
			att.MiddleName = &middleName.String
		}

		attendances = append(attendances, att)
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("archived_attendance_%d_%s_%s.csv", classID, date, time.Now().Format("150405")))

	file, err := os.Create(filename)
	if err != nil {
		return "", err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	subjectNameValue := "—"
	if subjectName.Valid && strings.TrimSpace(subjectName.String) != "" {
		subjectNameValue = subjectName.String
	}
	scheduleValue := "—"
	if schedule.Valid && strings.TrimSpace(schedule.String) != "" {
		scheduleValue = schedule.String
	}
	roomValue := "—"
	if room.Valid && strings.TrimSpace(room.String) != "" {
		roomValue = room.String
	}
	teacherValue := "—"
	if teacherName.Valid && strings.TrimSpace(teacherName.String) != "" {
		teacherValue = teacherName.String
	}

	displayDate := date
	if parsedDate, parseErr := time.Parse("2006-01-02", date); parseErr == nil {
		displayDate = parsedDate.Format("January 2, 2006")
	}

	writer.Write([]string{"ATTENDANCE SHEET"})
	writer.Write([]string{displayDate})
	writer.Write([]string{""})
	writer.Write([]string{"CLASS INFORMATION"})
	writer.Write([]string{"Subject", fmt.Sprintf("%s - %s", subjectCode, subjectNameValue), "Schedule", scheduleValue})
	writer.Write([]string{"Instructor", teacherValue, "Room", roomValue})
	writer.Write([]string{""})
	writer.Write([]string{"DAILY ATTENDANCE RECORD"})
	writer.Write([]string{"Total Students", fmt.Sprintf("%d", len(attendances))})
	writer.Write([]string{"No.", "Student ID", "Student Name", "Status"})

	presentCount := 0
	lateCount := 0
	absentCount := 0

	for index, att := range attendances {
		middleName := ""
		if att.MiddleName != nil {
			middleName = strings.TrimSpace(*att.MiddleName)
		}

		middleInitial := ""
		if middleName != "" {
			middleInitial = fmt.Sprintf(" %s.", strings.ToUpper(string(middleName[0])))
		}
		fullName := fmt.Sprintf("%s, %s%s", att.LastName, att.FirstName, middleInitial)
		status := strings.ToLower(strings.TrimSpace(att.Status))
		switch status {
		case "present":
			presentCount++
		case "late":
			lateCount++
		default:
			absentCount++
		}

		writer.Write([]string{
			fmt.Sprintf("%d", index+1),
			att.StudentCode,
			fullName,
			strings.Title(status),
		})
	}

	writer.Write([]string{""})
	writer.Write([]string{"SUMMARY"})
	writer.Write([]string{"Present", fmt.Sprintf("%d", presentCount)})
	writer.Write([]string{"Late", fmt.Sprintf("%d", lateCount)})
	writer.Write([]string{"Absent", fmt.Sprintf("%d", absentCount)})
	writer.Write([]string{"Total", fmt.Sprintf("%d", len(attendances))})

	log.Printf("Archived attendance exported to CSV by date: class=%d, date=%s, session=%d, file=%s", classID, date, sessionID, filename)
	return filename, nil
}

// ExportArchivedAttendancePDFByDate exports only archived attendance records for a specific class/date/session.
func (a *App) ExportArchivedAttendancePDFByDate(classID int, date string, sessionID int) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}

	if sessionID <= 0 {
		return "", fmt.Errorf("invalid archived attendance session")
	}

	if _, err := time.Parse("2006-01-02", date); err != nil {
		return "", fmt.Errorf("invalid date format: %w", err)
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
		log.Printf("Failed to get class info for archived attendance PDF export: %v", err)
		subjectCode = fmt.Sprintf("CLASS %d", classID)
		subjectName = sql.NullString{String: "Unknown Subject", Valid: true}
	}

	query := `
		WITH ranked_attendance AS (
			SELECT 
				a.class_id, a.student_id, CONVERT(VARCHAR(10), a.attendance_date, 23) as date, a.status, a.remarks,
				stu.student_id AS student_code, stu.first_name, stu.middle_name, stu.last_name,
				c.subject_code, s.description as subject_name,
				ROW_NUMBER() OVER (
					PARTITION BY a.student_id
					ORDER BY a.updated_at DESC, a.created_at DESC, a.id DESC
				) AS rn
			FROM attendance a
			JOIN students stu ON a.student_id = stu.id
			JOIN classes c ON a.class_id = c.class_id
			JOIN subjects s ON c.subject_code = s.subject_code
			WHERE a.class_id = ?
			  AND a.attendance_date = ?
			  AND a.session_id = ?
			  AND COALESCE(a.is_archived, 0) = 1
		)
		SELECT
			class_id, student_id, date, status, remarks,
			student_code, first_name, middle_name, last_name,
			subject_code, subject_name
		FROM ranked_attendance
		WHERE rn = 1
		ORDER BY last_name, first_name
	`
	args := []interface{}{classID, date, sessionID}

	rows, err := a.db.Query(query, args...)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	var attendances []Attendance
	for rows.Next() {
		var att Attendance
		var remarks, middleName sql.NullString
		err := rows.Scan(
			&att.ClassID, &att.StudentUserID, &att.Date, &att.Status, &remarks,
			&att.StudentCode, &att.FirstName, &middleName, &att.LastName,
			&att.SubjectCode, &att.SubjectName,
		)
		if err != nil {
			continue
		}

		if remarks.Valid {
			att.Remarks = &remarks.String
		}
		if middleName.Valid {
			att.MiddleName = &middleName.String
		}

		attendances = append(attendances, att)
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("archived_attendance_%d_%s_%s.pdf", classID, date, time.Now().Format("150405")))

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(10, 10, 10)
	pdf.SetAutoPageBreak(true, 10)
	pdf.AddPage()

	subjectNameValue := "—"
	if subjectName.Valid && strings.TrimSpace(subjectName.String) != "" {
		subjectNameValue = subjectName.String
	}
	scheduleValue := "—"
	if schedule.Valid && strings.TrimSpace(schedule.String) != "" {
		scheduleValue = schedule.String
	}
	roomValue := "—"
	if room.Valid && strings.TrimSpace(room.String) != "" {
		roomValue = room.String
	}
	teacherValue := "—"
	if teacherName.Valid && strings.TrimSpace(teacherName.String) != "" {
		teacherValue = teacherName.String
	}

	displayDate := date
	if parsedDate, parseErr := time.Parse("2006-01-02", date); parseErr == nil {
		displayDate = parsedDate.Format("January 2, 2006")
	}

	pdf.SetFont("Arial", "B", 14)
	pdf.Cell(0, 8, "Attendance Sheet")
	pdf.Ln(9)
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(0, 6, displayDate)
	pdf.Ln(6)
	pdf.SetFont("Arial", "B", 10)
	pdf.Cell(0, 6, "CLASS INFORMATION")
	pdf.Ln(7)
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(25, 6, "Subject:", "", 0, "L", false, 0, "")
	pdf.CellFormat(90, 6, fmt.Sprintf("%s - %s", subjectCode, subjectNameValue), "", 0, "L", false, 0, "")
	pdf.CellFormat(20, 6, "Schedule:", "", 0, "L", false, 0, "")
	pdf.CellFormat(55, 6, scheduleValue, "", 1, "L", false, 0, "")
	pdf.CellFormat(25, 6, "Instructor:", "", 0, "L", false, 0, "")
	pdf.CellFormat(90, 6, teacherValue, "", 0, "L", false, 0, "")
	pdf.CellFormat(20, 6, "Room:", "", 0, "L", false, 0, "")
	pdf.CellFormat(55, 6, roomValue, "", 1, "L", false, 0, "")
	pdf.Ln(8)
	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(120, 6, "DAILY ATTENDANCE RECORD", "", 0, "L", false, 0, "")
	pdf.CellFormat(70, 6, fmt.Sprintf("Total Students: %d", len(attendances)), "", 1, "R", false, 0, "")
	pdf.Ln(1)

	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(12, 7, "#", "1", 0, "C", false, 0, "")
	pdf.CellFormat(32, 7, "Student ID", "1", 0, "C", false, 0, "")
	pdf.CellFormat(106, 7, "Student Name", "1", 0, "C", false, 0, "")
	pdf.CellFormat(40, 7, "Status", "1", 1, "C", false, 0, "")

	pdf.SetFont("Arial", "", 9)
	presentCount := 0
	lateCount := 0
	absentCount := 0
	for index, att := range attendances {
		middleInitial := ""
		if att.MiddleName != nil && *att.MiddleName != "" {
			middleInitial = fmt.Sprintf(" %s.", strings.ToUpper(string((*att.MiddleName)[0])))
		}
		fullName := fmt.Sprintf("%s, %s%s", att.LastName, att.FirstName, middleInitial)
		status := strings.ToLower(strings.TrimSpace(att.Status))
		switch status {
		case "present":
			presentCount++
		case "late":
			lateCount++
		default:
			absentCount++
		}

		pdf.CellFormat(12, 7, fmt.Sprintf("%d", index+1), "1", 0, "C", false, 0, "")
		pdf.CellFormat(32, 7, att.StudentCode, "1", 0, "L", false, 0, "")
		pdf.CellFormat(106, 7, fullName, "1", 0, "L", false, 0, "")
		pdf.CellFormat(40, 7, strings.Title(status), "1", 1, "C", false, 0, "")
	}

	pdf.Ln(3)
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(190, 6, "SUMMARY", "", 1, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(40, 6, fmt.Sprintf("Present: %d", presentCount), "", 0, "L", false, 0, "")
	pdf.CellFormat(40, 6, fmt.Sprintf("Late: %d", lateCount), "", 0, "L", false, 0, "")
	pdf.CellFormat(40, 6, fmt.Sprintf("Absent: %d", absentCount), "", 0, "L", false, 0, "")
	pdf.CellFormat(70, 6, fmt.Sprintf("Total: %d", len(attendances)), "", 1, "R", false, 0, "")

	if err := pdf.OutputFileAndClose(filename); err != nil {
		return "", err
	}

	log.Printf("Archived attendance exported to PDF by date: class=%d, date=%s, session=%d, file=%s", classID, date, sessionID, filename)
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

// UnarchiveAttendanceSheet removes the archived flag from attendance records.
// Note: unarchived past attendance is still read-only (only today's is editable).
func (a *App) UnarchiveAttendanceSheet(classID int, date string) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	// Unarchive attendance records
	query := `
		UPDATE attendance 
		SET is_archived = 0,
			updated_at = CURRENT_TIMESTAMP
		WHERE class_id = ? AND attendance_date = ?
	`

	result, err := a.db.Exec(query, classID, date)
	if err != nil {
		log.Printf("Failed to unarchive attendance records: %v", err)
		return err
	}

	_, sessionUnarchiveErr := a.db.Exec(`
		UPDATE attendance_sessions
		SET is_archived = 0,
			updated_at = CURRENT_TIMESTAMP
		WHERE class_id = ? AND attendance_date = ?
	`, classID, date)
	if sessionUnarchiveErr != nil {
		log.Printf("Warning: failed to unarchive attendance sessions for class_id=%d date=%s: %v", classID, date, sessionUnarchiveErr)
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("Unarchived attendance sheet: class_id=%d, date=%s, records=%d", classID, date, rowsAffected)
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
			COUNT(a.student_id) AS student_count,
			SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_count,
			SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
			SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late_count
		FROM attendance_sessions s
		JOIN classes c ON s.class_id = c.class_id
		JOIN subjects subj ON c.subject_code = subj.subject_code
		LEFT JOIN attendance a ON a.session_id = s.session_id AND COALESCE(a.is_archived, 0) = 1
		WHERE c.teacher_id = ?
		  AND (
			COALESCE(s.is_archived, 0) = 1
			OR a.session_id IS NOT NULL
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
	LateThresholdMinutes *int    `json:"late_threshold_minutes,omitempty"`
	OpenedAt             *string `json:"opened_at,omitempty"`
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
				late_threshold_minutes INT NULL,
				opened_at DATETIME NULL,
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

		IF OBJECT_ID('attendance', 'U') IS NOT NULL
			AND COL_LENGTH('attendance', 'session_id') IS NULL
		BEGIN
			ALTER TABLE attendance ADD session_id INT NULL
		END

		IF OBJECT_ID('attendance', 'U') IS NOT NULL
			AND EXISTS (
				SELECT 1
				FROM attendance a
				WHERE a.session_id IS NULL
			)
		BEGIN
			UPDATE a
			SET a.session_id = s.latest_session_id
			FROM attendance a
			JOIN (
				SELECT class_id, attendance_date, MAX(session_id) AS latest_session_id
				FROM attendance_sessions
				GROUP BY class_id, attendance_date
			) s
				ON a.class_id = s.class_id
				AND a.attendance_date = s.attendance_date
			WHERE a.session_id IS NULL
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

func (a *App) ensureAttendanceRowsForClassDate(classID int, date string) error {
	query := `
		INSERT INTO attendance (class_id, student_id, attendance_date, status, remarks, is_archived, created_at)
		SELECT
			cl.class_id,
			cl.student_id,
			?,
			'absent',
			NULL,
			0,
			CURRENT_TIMESTAMP
		FROM classlist cl
		JOIN classes c ON cl.class_id = c.class_id
		WHERE cl.class_id = ?
			AND cl.status = 'active'
			AND (cl.is_archived = 0 OR cl.is_archived IS NULL)
			AND c.is_active = 1
			AND COALESCE(c.is_archived, 0) = 0
			AND NOT EXISTS (
				SELECT 1
				FROM attendance a
				WHERE a.class_id = cl.class_id
					AND a.student_id = cl.student_id
					AND a.attendance_date = ?
			)
	`

	_, err := a.db.Exec(query, date, classID, date)
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
			'absent',
			NULL,
			0,
			CURRENT_TIMESTAMP
		FROM classlist cl
		JOIN classes c ON cl.class_id = c.class_id
		WHERE cl.class_id = ?
			AND cl.status = 'active'
			AND (cl.is_archived = 0 OR cl.is_archived IS NULL)
			AND c.is_active = 1
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

func (a *App) getAttendanceSessionByID(sessionID int) (*AttendanceSession, error) {
	query := `
		SELECT
			s.session_id,
			s.class_id,
			CONVERT(VARCHAR(10), s.attendance_date, 23) AS attendance_date,
			s.session_name,
			s.status,
			s.late_threshold_minutes,
			CONVERT(VARCHAR(19), s.opened_at, 120) AS opened_at,
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
		GROUP BY s.session_id, s.class_id, s.attendance_date, s.session_name, s.status, s.late_threshold_minutes,
			s.opened_at, s.closed_at, subj.subject_code, subj.description, c.edp_code
	`

	var session AttendanceSession
	var lateThreshold sql.NullInt64
	var openedAt, closedAt sql.NullString
	err := a.db.QueryRow(query, sessionID).Scan(
		&session.SessionID,
		&session.ClassID,
		&session.AttendanceDate,
		&session.SessionName,
		&session.Status,
		&lateThreshold,
		&openedAt,
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

	if lateThreshold.Valid {
		v := int(lateThreshold.Int64)
		session.LateThresholdMinutes = &v
	}
	if openedAt.Valid {
		v := openedAt.String
		session.OpenedAt = &v
	}
	if closedAt.Valid {
		v := closedAt.String
		session.ClosedAt = &v
	}

	return &session, nil
}

func (a *App) CreateAttendanceSession(classID int, date, sessionName string, teacherUserID int, lateThresholdMinutes int) (*AttendanceSession, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}
	if err := a.ensureAttendanceSessionsTable(); err != nil {
		return nil, fmt.Errorf("failed to initialize attendance sessions table: %w", err)
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
		(class_id, attendance_date, session_name, status, late_threshold_minutes, opened_at, created_by_user_id, created_at, updated_at)
		OUTPUT INSERTED.session_id
		VALUES (?, ?, ?, 'open', ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, classID, date, sessionName, nullInt(lateThresholdMinutes), teacherUserID).Scan(&newSessionID)
	if err != nil {
		return nil, err
	}

	if err := a.ensureAttendanceRowsForSession(newSessionID, classID, date); err != nil {
		return nil, fmt.Errorf("failed to prepare attendance rows: %w", err)
	}

	return a.getAttendanceSessionByID(newSessionID)
}

func (a *App) GetTeacherAttendanceSessions(teacherUserID int) ([]AttendanceSession, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}
	if err := a.ensureAttendanceSessionsTable(); err != nil {
		return nil, fmt.Errorf("failed to initialize attendance sessions table: %w", err)
	}

	query := `
		SELECT
			s.session_id,
			s.class_id,
			CONVERT(VARCHAR(10), s.attendance_date, 23) AS attendance_date,
			s.session_name,
			s.status,
			s.late_threshold_minutes,
			CONVERT(VARCHAR(19), s.opened_at, 120) AS opened_at,
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
		GROUP BY s.session_id, s.class_id, s.attendance_date, s.session_name, s.status, s.late_threshold_minutes,
			s.opened_at, s.closed_at, subj.subject_code, subj.description, c.edp_code
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
		var lateThreshold sql.NullInt64
		var openedAt, closedAt sql.NullString

		err := rows.Scan(
			&session.SessionID,
			&session.ClassID,
			&session.AttendanceDate,
			&session.SessionName,
			&session.Status,
			&lateThreshold,
			&openedAt,
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

		if lateThreshold.Valid {
			v := int(lateThreshold.Int64)
			session.LateThresholdMinutes = &v
		}
		if openedAt.Valid {
			v := openedAt.String
			session.OpenedAt = &v
		}
		if closedAt.Valid {
			v := closedAt.String
			session.ClosedAt = &v
		}

		sessions = append(sessions, session)
	}

	return sessions, nil
}

func (a *App) OpenAttendanceSession(sessionID int, teacherUserID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureAttendanceSessionsTable(); err != nil {
		return err
	}

	result, err := a.db.Exec(`
		UPDATE s
		SET
			s.status = 'open',
			s.opened_at = COALESCE(s.opened_at, CURRENT_TIMESTAMP),
			s.closed_at = NULL,
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

	return nil
}

func (a *App) SaveAttendanceSession(sessionID int, teacherUserID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureAttendanceSessionsTable(); err != nil {
		return err
	}

	result, err := a.db.Exec(`
		UPDATE s
		SET
			s.status = 'closed',
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

func (a *App) GetStudentOpenAttendanceSessions(studentUserID int) ([]AttendanceSession, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}
	if err := a.ensureAttendanceSessionsTable(); err != nil {
		return nil, err
	}

	query := `
		SELECT
			s.session_id,
			s.class_id,
			CONVERT(VARCHAR(10), s.attendance_date, 23) AS attendance_date,
			s.session_name,
			s.status,
			s.late_threshold_minutes,
			CONVERT(VARCHAR(19), s.opened_at, 120) AS opened_at,
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
		LEFT JOIN attendance a ON a.session_id = s.session_id
		WHERE cl.student_id = ?
			AND cl.status = 'active'
			AND (cl.is_archived = 0 OR cl.is_archived IS NULL)
			AND s.status = 'open'
			AND COALESCE(s.is_archived, 0) = 0
			AND CONVERT(VARCHAR(10), s.attendance_date, 23) = CONVERT(VARCHAR(10), GETDATE(), 23)
		GROUP BY s.session_id, s.class_id, s.attendance_date, s.session_name, s.status, s.late_threshold_minutes,
			s.opened_at, s.closed_at, subj.subject_code, subj.description, c.edp_code
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
		var lateThreshold sql.NullInt64
		var openedAt, closedAt sql.NullString

		err := rows.Scan(
			&session.SessionID,
			&session.ClassID,
			&session.AttendanceDate,
			&session.SessionName,
			&session.Status,
			&lateThreshold,
			&openedAt,
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

		if lateThreshold.Valid {
			v := int(lateThreshold.Int64)
			session.LateThresholdMinutes = &v
		}
		if openedAt.Valid {
			v := openedAt.String
			session.OpenedAt = &v
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

	var classID int
	var attendanceDate string
	var status string
	var lateThreshold sql.NullInt64
	var openedAt sql.NullTime
	err := a.db.QueryRow(`
		SELECT s.class_id, CONVERT(VARCHAR(10), s.attendance_date, 23), s.status, s.late_threshold_minutes, s.opened_at
		FROM attendance_sessions s
		WHERE s.session_id = ?
	`, sessionID).Scan(&classID, &attendanceDate, &status, &lateThreshold, &openedAt)
	if err != nil {
		return fmt.Errorf("attendance session not found")
	}

	if status != "open" {
		return fmt.Errorf("attendance session is closed")
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

	finalStatus := "present"
	if lateThreshold.Valid && openedAt.Valid {
		lateCutoff := openedAt.Time.Add(time.Duration(lateThreshold.Int64) * time.Minute)
		if time.Now().After(lateCutoff) {
			finalStatus = "late"
		}
	}

	result, err := a.db.Exec(`
		UPDATE attendance
		SET status = ?, updated_at = CURRENT_TIMESTAMP
		WHERE class_id = ? AND student_id = ? AND attendance_date = ? AND session_id = ? AND COALESCE(is_archived, 0) = 0
	`, finalStatus, classID, studentUserID, attendanceDate, sessionID)
	if err != nil {
		return err
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("attendance record not found")
	}

	return nil
}

func nullInt(value int) interface{} {
	if value < 0 {
		return nil
	}
	return value
}
