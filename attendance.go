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
				log.Printf("⚠ Failed to auto-create attendance: %v", err)
				return nil, fmt.Errorf("failed to create attendance: %w", err)
			}
			log.Printf("✓ Auto-created attendance for class %d on %s", classID, date)
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
		log.Printf("⚠ Failed to query attendance: %v", err)
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
			log.Printf("⚠ Failed to scan attendance row: %v", err)
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
		log.Printf("⚠ Failed to update attendance record: %v", err)
		return err
	}

	log.Printf("✓ Attendance record updated: class_id=%d, student_id=%d, date=%s, status=%s", classID, studentUserID, date, status)
	return nil
}

// RecordAttendance records or updates attendance for a student in a class (same-day only)
func (a *App) RecordAttendance(classID, studentID int, status, remarks string, recordedBy int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	today := time.Now().Format("2006-01-02")

	// Verify student is enrolled in the class
	var exists int
	err := a.db.QueryRow(
		`SELECT 1 FROM classlist WHERE class_id = ? AND student_id = ? AND status = 'active' AND (is_archived = 0 OR is_archived IS NULL)`,
		classID, studentID,
	).Scan(&exists)
	if err != nil {
		log.Printf("⚠ Student %d not enrolled in class %d: %v", studentID, classID, err)
		return fmt.Errorf("student not enrolled in this class")
	}

	// Validate status
	validStatuses := map[string]bool{"absent": true, "present": true, "late": true}
	if !validStatuses[status] {
		return fmt.Errorf("invalid status: %s. Must be 'absent', 'present', or 'late'", status)
	}

	// Record or update attendance for TODAY only
	query := `
		MERGE attendance AS target
		USING (SELECT ? AS class_id, ? AS student_id, ? AS attendance_date, ? AS status, ? AS remarks) AS source
		ON target.class_id = source.class_id AND target.student_id = source.student_id AND target.attendance_date = source.attendance_date
		WHEN MATCHED AND target.is_archived = 0 THEN
			UPDATE SET status = source.status, remarks = source.remarks, updated_at = CURRENT_TIMESTAMP
		WHEN NOT MATCHED THEN
			INSERT (class_id, student_id, attendance_date, status, remarks, is_archived)
			VALUES (source.class_id, source.student_id, source.attendance_date, source.status, source.remarks, 0);
	`
	_, err = a.db.Exec(query, classID, studentID, today, status, nullString(remarks))
	if err != nil {
		log.Printf("⚠ Failed to record attendance: %v", err)
		return err
	}

	log.Printf("✓ Attendance recorded: student=%d, class=%d, status=%s", studentID, classID, status)
	return nil
}

// RecordStudentLogin records when a student logs in during class time
func (a *App) RecordStudentLogin(classID, studentID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	today := time.Now().Format("2006-01-02")

	// Verify student is enrolled in the class
	var exists int
	err := a.db.QueryRow(
		`SELECT TOP 1 1 FROM classlist WHERE class_id = ? AND student_id = ? AND status = 'active' AND (is_archived = 0 OR is_archived IS NULL)`,
		classID, studentID,
	).Scan(&exists)
	if err != nil {
		return fmt.Errorf("student not enrolled in this class")
	}

	// Record attendance as present (today only)
	query := `
		MERGE attendance AS target
		USING (SELECT ? AS class_id, ? AS student_id, ? AS attendance_date, 'present' AS status, NULL AS remarks) AS source
		ON target.class_id = source.class_id AND target.student_id = source.student_id AND target.attendance_date = source.attendance_date
		WHEN MATCHED AND target.is_archived = 0 THEN
			UPDATE SET status = 'present', updated_at = CURRENT_TIMESTAMP
		WHEN NOT MATCHED THEN
			INSERT (class_id, student_id, attendance_date, status, remarks, is_archived)
			VALUES (source.class_id, source.student_id, source.attendance_date, source.status, source.remarks, 0);
	`

	_, err = a.db.Exec(query, classID, studentID, today)
	if err != nil {
		log.Printf("⚠ Failed to record student login: %v", err)
		return err
	}

	log.Printf("✓ Student login recorded: student=%d, class=%d", studentID, classID)
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

	log.Printf("✓ Attendance exported to CSV: %s", filename)
	return filename, nil
}

// ==============================================================================
// HELPER FUNCTIONS
// ==============================================================================

// autoRecordAttendanceOnLogin automatically records attendance when a student logs in during class time
func (a *App) autoRecordAttendanceOnLogin(studentID int) {
	if a.db == nil {
		if err := a.reconnectDB(); err != nil {
			log.Printf("⚠️  Cannot auto-record attendance: %v", err)
			return
		}
	}

	today := time.Now().Format("2006-01-02")
	currentTime := time.Now()

	// Get all enrolled classes for this student with attendance initialized for today
	query := `
		SELECT 
			cl.class_id,
			c.schedule,
			c.school_year,
			c.semester
		FROM classlist cl
		JOIN classes c ON cl.class_id = c.class_id
		LEFT JOIN attendance a ON cl.class_id = a.class_id AND cl.student_id = a.student_id AND a.attendance_date = ?
		WHERE cl.student_id = ? 
			AND cl.status = 'active'
			AND (cl.is_archived = 0 OR cl.is_archived IS NULL)
			AND c.is_active = 1
			AND a.class_id IS NOT NULL
	`

	rows, err := a.db.Query(query, today, studentID)
	if err != nil {
		log.Printf("Failed to query enrolled classes for auto-attendance: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var classID int
		var schedule sql.NullString
		var schoolYear, semester sql.NullString

		err := rows.Scan(&classID, &schedule, &schoolYear, &semester)
		if err != nil {
			continue
		}

		// Check if current time matches class schedule
		if schedule.Valid && a.isWithinClassSchedule(schedule.String, currentTime) {
			// Update attendance to present
			updateQuery := `
				UPDATE attendance 
				SET status = 'present',
					updated_at = CURRENT_TIMESTAMP
				WHERE class_id = ? AND student_id = ? AND attendance_date = ? AND COALESCE(is_archived, 0) = 0
			`
			_, err := a.db.Exec(updateQuery, classID, studentID, today)
			if err != nil {
				log.Printf("Failed to auto-record attendance for student %d, class %d: %v", studentID, classID, err)
			} else {
				log.Printf("Auto-recorded attendance: student=%d, class=%d", studentID, classID)
			}
		}
	}
}

// isWithinClassSchedule checks if the current time is within the class schedule window
func (a *App) isWithinClassSchedule(schedule string, currentTime time.Time) bool {
	// Parse schedule format: "Monday 8:00 AM - 10:00 AM" or "Mon-Wed 2:00 PM - 4:00 PM"
	parts := strings.Split(schedule, " ")
	if len(parts) < 5 {
		return false
	}

	// Check if current day matches schedule
	currentDay := currentTime.Weekday().String()
	daysPart := parts[0]

	// Handle day ranges (Mon-Fri) or specific days (Monday)
	if !strings.Contains(strings.ToLower(daysPart), strings.ToLower(currentDay[:3])) {
		return false
	}

	// Parse start time
	startTimeStr := parts[1] + " " + parts[2] // "8:00 AM"
	startTime, err := time.Parse("3:04 PM", startTimeStr)
	if err != nil {
		return false
	}

	// Parse end time (parts[4] + parts[5])
	endTimeStr := parts[4] + " " + parts[5] // "10:00 AM"
	endTime, err := time.Parse("3:04 PM", endTimeStr)
	if err != nil {
		return false
	}

	// Compare times (ignore date, only check time)
	currentTimeOnly := time.Date(0, 1, 1, currentTime.Hour(), currentTime.Minute(), 0, 0, time.UTC)
	startTimeOnly := time.Date(0, 1, 1, startTime.Hour(), startTime.Minute(), 0, 0, time.UTC)
	endTimeOnly := time.Date(0, 1, 1, endTime.Hour(), endTime.Minute(), 0, 0, time.UTC)

	// Allow logging in 10 minutes before scheduled time
	tenMinutesBefore := startTimeOnly.Add(-10 * time.Minute)

	return (currentTimeOnly.After(tenMinutesBefore) || currentTimeOnly.Equal(tenMinutesBefore)) &&
		(currentTimeOnly.Before(endTimeOnly) || currentTimeOnly.Equal(endTimeOnly))
}

// ==============================================================================
// ATTENDANCE ARCHIVING
// ==============================================================================

// ArchiveAttendanceSheet marks all attendance records for a class on a specific date as archived.
// Rule: Only allowed for attendance_date < TODAY. Same-day attendance cannot be archived.
func (a *App) ArchiveAttendanceSheet(classID int, date string) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	// Enforce: cannot archive today's attendance
	today := time.Now().Format("2006-01-02")
	if date >= today {
		return fmt.Errorf("cannot archive today's or future attendance. Only past attendance can be archived")
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
		log.Printf("⚠ Failed to archive attendance records: %v", err)
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("✓ Archived attendance sheet: class_id=%d, date=%s, records=%d", classID, date, rowsAffected)
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
		log.Printf("⚠ Failed to unarchive attendance records: %v", err)
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("✓ Unarchived attendance sheet: class_id=%d, date=%s, records=%d", classID, date, rowsAffected)
	return nil
}

// ArchivedAttendanceSheet represents a summary of an archived attendance sheet
type ArchivedAttendanceSheet struct {
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
			a.class_id,
			CONVERT(VARCHAR(10), a.attendance_date, 23) AS date,
			subj.subject_code,
			subj.description AS subject_name,
			c.edp_code,
			c.schedule,
			COUNT(a.student_id) AS student_count,
			SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_count,
			SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
			SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late_count
		FROM attendance a
		JOIN classes c ON a.class_id = c.class_id
		JOIN subjects subj ON c.subject_code = subj.subject_code
		WHERE c.teacher_id = ?
		  AND a.is_archived = 1
		GROUP BY a.class_id, a.attendance_date, subj.subject_code, subj.description, c.edp_code, c.schedule
		ORDER BY a.attendance_date DESC, subj.subject_code
	`

	rows, err := a.db.Query(query, teacherUserID)
	if err != nil {
		log.Printf("⚠ Failed to query archived attendance sheets: %v", err)
		return nil, err
	}
	defer rows.Close()

	var sheets []ArchivedAttendanceSheet
	for rows.Next() {
		var sheet ArchivedAttendanceSheet
		var edpCode, schedule sql.NullString

		err := rows.Scan(
			&sheet.ClassID, &sheet.Date,
			&sheet.SubjectCode, &sheet.SubjectName,
			&edpCode, &schedule,
			&sheet.StudentCount, &sheet.PresentCount, &sheet.AbsentCount, &sheet.LateCount,
		)
		if err != nil {
			log.Printf("⚠ Failed to scan archived attendance sheet: %v", err)
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
	IsArchived   bool   `json:"is_archived"`
	IsEditable   bool   `json:"is_editable"`
}

// GetActiveAttendanceSheets gets all active (not archived) attendance sheets for a teacher
func (a *App) GetActiveAttendanceSheets(teacherUserID int) ([]AttendanceSheetSummary, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	today := time.Now().Format("2006-01-02")

	query := `
		SELECT
			a.class_id,
			CONVERT(VARCHAR(10), a.attendance_date, 23) AS date,
			subj.subject_code,
			subj.description AS subject_name,
			c.edp_code,
			c.schedule,
			COUNT(a.student_id) AS student_count,
			SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_count,
			SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
			SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late_count,
			COALESCE(MAX(CAST(a.is_archived AS INT)), 0) AS is_archived
		FROM attendance a
		JOIN classes c ON a.class_id = c.class_id
		JOIN subjects subj ON c.subject_code = subj.subject_code
		WHERE c.teacher_id = ?
		  AND COALESCE(a.is_archived, 0) = 0
		  AND COALESCE(c.is_archived, 0) = 0
		GROUP BY a.class_id, a.attendance_date, subj.subject_code, subj.description, c.edp_code, c.schedule
		ORDER BY a.attendance_date DESC, subj.subject_code
	`

	rows, err := a.db.Query(query, teacherUserID)
	if err != nil {
		log.Printf("⚠ Failed to query active attendance sheets: %v", err)
		return nil, err
	}
	defer rows.Close()

	var sheets []AttendanceSheetSummary
	for rows.Next() {
		var sheet AttendanceSheetSummary
		var edpCode, schedule sql.NullString

		err := rows.Scan(
			&sheet.ClassID, &sheet.Date,
			&sheet.SubjectCode, &sheet.SubjectName,
			&edpCode, &schedule,
			&sheet.StudentCount, &sheet.PresentCount, &sheet.AbsentCount, &sheet.LateCount,
			&sheet.IsArchived,
		)
		if err != nil {
			log.Printf("⚠ Failed to scan active attendance sheet: %v", err)
			continue
		}

		if edpCode.Valid {
			sheet.EdpCode = edpCode.String
		}
		if schedule.Valid {
			sheet.Schedule = schedule.String
		}
		// Is editable only if date == today
		sheet.IsEditable = (sheet.Date == today)

		sheets = append(sheets, sheet)
	}

	return sheets, nil
}
