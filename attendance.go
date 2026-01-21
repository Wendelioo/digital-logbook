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

// RecordAttendance records or updates attendance for a student in a class
func (a *App) RecordAttendance(classID, studentID int, timeIn, timeOut, status, remarks string, recordedBy int) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Verify student is enrolled in the class
	var exists int
	err := a.db.QueryRow(
		`SELECT 1 FROM classlist WHERE class_id = ? AND student_user_id = ? AND status = 'active' LIMIT 1`,
		classID, studentID,
	).Scan(&exists)
	if err != nil {
		log.Printf("⚠ Student %d not enrolled in class %d: %v", studentID, classID, err)
		return fmt.Errorf("student not enrolled in this class")
	}

	// Record or update attendance using composite key (class_id, student_user_id, date)
	query := `
		INSERT INTO attendance (class_id, student_user_id, date, time_in, time_out, status, remarks)
		VALUES (?, ?, CURDATE(), ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE 
			time_in = COALESCE(VALUES(time_in), time_in),
			time_out = COALESCE(VALUES(time_out), time_out),
			status = VALUES(status),
			remarks = VALUES(remarks),
			updated_at = CURRENT_TIMESTAMP
	`
	_, err = a.db.Exec(query, classID, studentID, nullString(timeIn), nullString(timeOut), status, nullString(remarks))
	if err != nil {
		log.Printf("⚠ Failed to record attendance: %v", err)
		return err
	}

	log.Printf("✓ Attendance recorded: student=%d, class=%d, status=%s", studentID, classID, status)
	return nil
}

// UpdateAttendanceTime updates time in/out for an attendance record
func (a *App) UpdateAttendanceTime(classID, studentUserID int, date, timeIn, timeOut string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	query := `
		UPDATE attendance 
		SET time_in = COALESCE(?, time_in), 
		    time_out = COALESCE(?, time_out),
		    updated_at = CURRENT_TIMESTAMP
		WHERE class_id = ? AND student_user_id = ? AND date = ?
	`
	_, err := a.db.Exec(query, nullString(timeIn), nullString(timeOut), classID, studentUserID, date)
	if err != nil {
		log.Printf("⚠ Failed to update attendance time: %v", err)
		return err
	}

	log.Printf("✓ Attendance time updated: class_id=%d, student_user_id=%d, date=%s", classID, studentUserID, date)
	return nil
}

// GetClassAttendance gets attendance records for a specific class on a specific date
func (a *App) GetClassAttendance(classID int, date string) ([]Attendance, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			cl.class_id,
			cl.student_user_id,
			COALESCE(a.date, ?) as date,
			stu.student_number,
			stu.first_name,
			stu.middle_name,
			stu.last_name,
			s.subject_code,
			s.description as subject_name,
			a.time_in,
			a.time_out,
			a.pc_number,
			a.status,
			a.remarks
		FROM classlist cl
		JOIN students stu ON cl.student_user_id = stu.user_id
		JOIN classes c ON cl.class_id = c.class_id
		JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN attendance a ON cl.class_id = a.class_id AND cl.student_user_id = a.student_user_id AND a.date = ?
		WHERE cl.class_id = ? AND cl.status = 'active'
		ORDER BY stu.last_name, stu.first_name
	`

	rows, err := a.db.Query(query, date, date, classID)
	if err != nil {
		log.Printf("⚠ Failed to query attendance: %v", err)
		return nil, err
	}
	defer rows.Close()

	var attendances []Attendance
	for rows.Next() {
		var att Attendance
		var middleName, timeIn, timeOut, pcNumber, remarks, status sql.NullString

		err := rows.Scan(
			&att.ClassID, &att.StudentUserID, &att.Date,
			&att.StudentCode, &att.FirstName, &middleName, &att.LastName,
			&att.SubjectCode, &att.SubjectName,
			&timeIn, &timeOut, &pcNumber, &status, &remarks,
		)
		if err != nil {
			log.Printf("⚠ Failed to scan attendance row: %v", err)
			continue
		}

		if middleName.Valid {
			att.MiddleName = &middleName.String
		}
		if timeIn.Valid {
			att.TimeIn = &timeIn.String
		}
		if timeOut.Valid {
			att.TimeOut = &timeOut.String
		}
		if pcNumber.Valid {
			att.PCNumber = &pcNumber.String
		}
		if remarks.Valid {
			att.Remarks = &remarks.String
		}
		if status.Valid {
			att.Status = status.String
		} else {
			att.Status = "" // Empty string when no status is set yet
		}

		attendances = append(attendances, att)
	}

	return attendances, nil
}

// InitializeAttendanceForClass creates attendance records for all students in a class for a date
// Status is initially set to 'absent' so teachers can mark who is present
func (a *App) InitializeAttendanceForClass(classID int, date string, recordedBy int) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	query := `
		INSERT INTO attendance (class_id, student_user_id, date, status, remarks, created_at)
		SELECT 
			cl.class_id,
			cl.student_user_id,
			?,
			'absent',
			'Not yet logged in',
			CURRENT_TIMESTAMP
		FROM classlist cl
		WHERE cl.class_id = ? AND cl.status = 'active'
		ON DUPLICATE KEY UPDATE 
			remarks = CASE 
				WHEN time_in IS NULL AND (remarks IS NULL OR remarks = '') THEN 'Not yet logged in'
				ELSE remarks
			END,
			class_id=class_id
	`

	_, err := a.db.Exec(query, date, classID)
	if err != nil {
		log.Printf("⚠ Failed to initialize attendance: %v", err)
		return err
	}

	log.Printf("✓ Attendance initialized for class %d on %s", classID, date)
	return nil
}

// UpdateAttendanceRecord updates a specific attendance record with new details
func (a *App) UpdateAttendanceRecord(classID, studentUserID int, date, timeIn, timeOut, pcNumber, status, remarks string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	query := `
		UPDATE attendance 
		SET time_in = ?,
		    time_out = ?,
		    pc_number = ?,
		    status = ?,
		    remarks = ?,
		    updated_at = CURRENT_TIMESTAMP
		WHERE class_id = ? AND student_user_id = ? AND date = ?
	`

	_, err := a.db.Exec(query, nullString(timeIn), nullString(timeOut), nullString(pcNumber), status, nullString(remarks), classID, studentUserID, date)
	if err != nil {
		log.Printf("⚠ Failed to update attendance record: %v", err)
		return err
	}

	log.Printf("✓ Attendance record updated: class_id=%d, student_user_id=%d, date=%s, status=%s", classID, studentUserID, date, status)
	return nil
}

// RecordStudentLogin records when a student logs in during class time
func (a *App) RecordStudentLogin(classID, studentID int, pcNumber string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Verify student is enrolled in the class
	var exists int
	err := a.db.QueryRow(
		`SELECT 1 FROM classlist WHERE class_id = ? AND student_user_id = ? AND status = 'active' LIMIT 1`,
		classID, studentID,
	).Scan(&exists)
	if err != nil {
		return fmt.Errorf("student not enrolled in this class")
	}

	// Record attendance as present with login time using composite key
	// Clear "Not yet logged in" remark when student logs in
	query := `
		INSERT INTO attendance (class_id, student_user_id, date, time_in, pc_number, status, remarks)
		VALUES (?, ?, CURDATE(), CURTIME(), ?, 'present', NULL)
		ON DUPLICATE KEY UPDATE 
			time_in = COALESCE(time_in, CURTIME()),
			pc_number = VALUES(pc_number),
			status = 'present',
			remarks = CASE 
				WHEN remarks = 'Not yet logged in' THEN NULL
				ELSE remarks
			END,
			updated_at = CURRENT_TIMESTAMP
	`

	_, err = a.db.Exec(query, classID, studentID, pcNumber)
	if err != nil {
		log.Printf("⚠ Failed to record student login: %v", err)
		return err
	}

	log.Printf("✓ Student login recorded: student=%d, class=%d, pc=%s", studentID, classID, pcNumber)
	return nil
}

// ExportAttendanceCSV exports attendance to CSV for a specific class
func (a *App) ExportAttendanceCSV(classID int) (string, error) {
	if a.db == nil {
		return "", fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			a.class_id, a.student_user_id, a.date, a.time_in, a.time_out, a.status, a.remarks,
			stu.student_number, stu.first_name, stu.middle_name, stu.last_name,
			c.subject_code, s.description as subject_name
		FROM attendance a
		JOIN students stu ON a.student_user_id = stu.user_id
		JOIN classes c ON a.class_id = c.class_id
		JOIN subjects s ON c.subject_code = s.subject_code
		WHERE a.class_id = ?
		ORDER BY a.date DESC, stu.last_name, stu.first_name
	`
	rows, err := a.db.Query(query, classID)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	var attendances []Attendance
	for rows.Next() {
		var att Attendance
		var timeIn, timeOut, remarks, middleName sql.NullString
		err := rows.Scan(
			&att.ClassID, &att.StudentUserID, &att.Date, &timeIn, &timeOut, &att.Status, &remarks,
			&att.StudentCode, &att.FirstName, &middleName, &att.LastName,
			&att.SubjectCode, &att.SubjectName,
		)
		if err != nil {
			continue
		}

		if timeIn.Valid {
			att.TimeIn = &timeIn.String
		}
		if timeOut.Valid {
			att.TimeOut = &timeOut.String
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
	writer.Write([]string{"Date", "Student ID", "First Name", "Middle Name", "Last Name", "Subject", "Time In", "Time Out", "Status", "Remarks"})

	// Write data
	for _, att := range attendances {
		timeIn := ""
		if att.TimeIn != nil {
			timeIn = *att.TimeIn
		}
		timeOut := ""
		if att.TimeOut != nil {
			timeOut = *att.TimeOut
		}
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
			timeIn,
			timeOut,
			att.Status,
			remarks,
		})
	}

	log.Printf("✓ Attendance exported to CSV: %s", filename)
	return filename, nil
}

// GenerateAttendanceFromLogs generates attendance records for a class based on login logs
// It determines status: present (login before 10 min to scheduled time), late (login 10 min after scheduled time), absent (no login)
func (a *App) GenerateAttendanceFromLogs(classID int, date string, recordedBy int) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Get class information including schedule
	var schedule sql.NullString
	err := a.db.QueryRow("SELECT schedule FROM classes WHERE class_id = ?", classID).Scan(&schedule)
	if err != nil {
		log.Printf("⚠ Failed to get class schedule: %v", err)
		return fmt.Errorf("failed to get class schedule: %w", err)
	}

	if !schedule.Valid || schedule.String == "" {
		return fmt.Errorf("class schedule not set")
	}

	// Parse schedule to get start time
	scheduleStr := schedule.String
	startTime, err := parseScheduleStartTime(scheduleStr)
	if err != nil {
		log.Printf("⚠ Failed to parse schedule: %v", err)
		return fmt.Errorf("failed to parse schedule: %w", err)
	}

	// Validate the date format
	_, err = time.Parse("2006-01-02", date)
	if err != nil {
		return fmt.Errorf("invalid date format: %w", err)
	}

	// Create attendance sheet record (even if no students enrolled)
	// This allows tracking of initialized attendance sessions
	sheetQuery := `
		INSERT INTO attendance_sheets (class_id, date, created_by, created_at)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP)
		ON DUPLICATE KEY UPDATE
			updated_at = CURRENT_TIMESTAMP
	`
	_, err = a.db.Exec(sheetQuery, classID, date, recordedBy)
	if err != nil {
		log.Printf("⚠ Failed to create attendance sheet: %v", err)
		// Continue anyway - this is not critical
	}

	// Get all enrolled students
	students, err := a.GetClassStudents(classID)
	if err != nil {
		return fmt.Errorf("failed to get class students: %w", err)
	}

	// If no students enrolled, still log success (sheet was created)
	if len(students) == 0 {
		log.Printf("✓ Attendance sheet created for class %d on %s (no students enrolled)", classID, date)
		return nil
	}

	// For each student, check login logs and create attendance record
	for _, student := range students {
		// Get login logs for this student on the attendance date
		query := `
			SELECT login_time, logout_time, pc_number
			FROM login_logs
			WHERE user_id = ? 
			AND DATE(login_time) = ?
			AND login_status = 'success'
			ORDER BY login_time ASC
			LIMIT 1
		`
		var loginTime sql.NullTime
		var logoutTime sql.NullTime
		var pcNumber sql.NullString

		err := a.db.QueryRow(query, student.StudentUserID, date).Scan(&loginTime, &logoutTime, &pcNumber)

		var status string
		var timeInStr, timeOutStr string
		var pcNumberStr string

		if err == nil && loginTime.Valid {
			// Student logged in - determine if present or late
			loginDateTime := loginTime.Time
			loginTimeOnly := time.Date(0, 1, 1, loginDateTime.Hour(), loginDateTime.Minute(), loginDateTime.Second(), 0, time.UTC)

			// Calculate 10 minutes after scheduled time (cutoff for late)
			tenMinutesAfter := startTime.Add(10 * time.Minute)

			timeInStr = loginDateTime.Format("15:04:05")
			if logoutTime.Valid {
				timeOutStr = logoutTime.Time.Format("15:04:05")
			}
			if pcNumber.Valid {
				pcNumberStr = pcNumber.String
			}

			// Determine status based on login time
			// Present: login within 10 minutes after scheduled time (allows 10 min before and 10 min after)
			// Late: login more than 10 minutes after scheduled time
			if loginTimeOnly.Before(tenMinutesAfter) || loginTimeOnly.Equal(tenMinutesAfter) {
				// Login before or within 10 minutes after scheduled time = Present
				status = "present"
			} else {
				// Login more than 10 minutes after scheduled time = Late
				status = "late"
			}
		} else {
			// No login found = Absent
			status = "absent"
		}

		// Set remarks for students who haven't logged in yet
		var remarksStr string
		if status == "absent" {
			remarksStr = "Not yet logged in"
		}

		// Insert or update attendance record
		// If student has logged in (time_in exists), clear the "Not yet logged in" remark
		insertQuery := `
			INSERT INTO attendance (class_id, student_user_id, date, time_in, time_out, pc_number, status, remarks, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON DUPLICATE KEY UPDATE
				time_in = COALESCE(VALUES(time_in), time_in),
				time_out = COALESCE(VALUES(time_out), time_out),
				pc_number = COALESCE(VALUES(pc_number), pc_number),
				status = VALUES(status),
				remarks = CASE 
					WHEN VALUES(time_in) IS NOT NULL AND (remarks = 'Not yet logged in' OR remarks IS NULL OR remarks = '') THEN NULL
					WHEN VALUES(time_in) IS NOT NULL THEN remarks
					WHEN VALUES(remarks) IS NOT NULL AND VALUES(remarks) != '' THEN VALUES(remarks)
					ELSE remarks
				END,
				updated_at = CURRENT_TIMESTAMP
		`

		_, err = a.db.Exec(insertQuery, classID, student.StudentUserID, date, nullString(timeInStr), nullString(timeOutStr), nullString(pcNumberStr), status, nullString(remarksStr))
		if err != nil {
			log.Printf("⚠ Failed to insert attendance for student %d: %v", student.StudentUserID, err)
			continue
		}
	}

	log.Printf("✓ Attendance generated from logs for class %d on %s", classID, date)
	return nil
}

// ==============================================================================
// HELPER FUNCTIONS
// ==============================================================================

// autoRecordAttendanceOnLogin automatically records attendance when a student logs in during class time
func (a *App) autoRecordAttendanceOnLogin(studentID int, pcNumber string) {
	if a.db == nil {
		return
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
		LEFT JOIN attendance a ON cl.class_id = a.class_id AND cl.student_user_id = a.student_user_id AND a.date = ?
		WHERE cl.student_user_id = ? 
			AND cl.status = 'active'
			AND c.is_active = TRUE
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
			// Update attendance to present with login time and PC number using composite key
			updateQuery := `
				UPDATE attendance 
				SET time_in = CURTIME(),
					pc_number = ?,
					status = 'present',
					updated_at = CURRENT_TIMESTAMP
				WHERE class_id = ? AND student_user_id = ? AND date = ?
			`
			_, err := a.db.Exec(updateQuery, pcNumber, classID, studentID, today)
			if err != nil {
				log.Printf("Failed to auto-record attendance for student %d, class %d: %v", studentID, classID, err)
			} else {
				log.Printf("Auto-recorded attendance: student=%d, class=%d, pc=%s", studentID, classID, pcNumber)
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

// parseScheduleStartTime extracts the start time from a schedule string
func parseScheduleStartTime(schedule string) (time.Time, error) {
	// Parse schedule format: "MWF 8:00 AM - 10:00 AM" or "MWF 2:00 PM-4:00 PM" or "Monday 8:00 AM - 10:00 AM"
	parts := strings.Split(schedule, " ")
	if len(parts) < 3 {
		return time.Time{}, fmt.Errorf("invalid schedule format")
	}

	// Extract AM/PM part - it might contain dash (e.g., "PM-6:00")
	// Split on dash to separate start AM/PM from end time
	amPmPart := parts[2]
	dashIndex := strings.Index(amPmPart, "-")
	if dashIndex != -1 {
		// Remove everything after dash (e.g., "PM-6:00" becomes "PM")
		amPmPart = amPmPart[:dashIndex]
	}

	// Parse start time
	startTimeStr := parts[1] + " " + amPmPart // "8:00 AM" or "4:30 PM"
	startTime, err := time.Parse("3:04 PM", startTimeStr)
	if err != nil {
		return time.Time{}, fmt.Errorf("failed to parse start time: %w", err)
	}

	// Convert to today's date with the parsed time
	return time.Date(0, 1, 1, startTime.Hour(), startTime.Minute(), 0, 0, time.UTC), nil
}

// ==============================================================================
// ATTENDANCE ARCHIVING
// ==============================================================================

// ArchiveAttendanceSheet marks all attendance records for a class on a specific date as archived
func (a *App) ArchiveAttendanceSheet(classID int, date string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	query := `
		UPDATE attendance 
		SET is_archived = TRUE,
		    updated_at = CURRENT_TIMESTAMP
		WHERE class_id = ? AND date = ?
	`

	result, err := a.db.Exec(query, classID, date)
	if err != nil {
		log.Printf("⚠ Failed to archive attendance sheet: %v", err)
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("✓ Archived attendance sheet: class_id=%d, date=%s, records=%d", classID, date, rowsAffected)
	return nil
}

// UnarchiveAttendanceSheet removes the archived flag from attendance records
func (a *App) UnarchiveAttendanceSheet(classID int, date string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	query := `
		UPDATE attendance 
		SET is_archived = FALSE,
		    updated_at = CURRENT_TIMESTAMP
		WHERE class_id = ? AND date = ?
	`

	result, err := a.db.Exec(query, classID, date)
	if err != nil {
		log.Printf("⚠ Failed to unarchive attendance sheet: %v", err)
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("✓ Unarchived attendance sheet: class_id=%d, date=%s, records=%d", classID, date, rowsAffected)
	return nil
}

// ArchivedAttendanceSheet represents a summary of an archived attendance sheet
type ArchivedAttendanceSheet struct {
	ClassID       int    `json:"class_id"`
	Date          string `json:"date"`
	SubjectCode   string `json:"subject_code"`
	SubjectName   string `json:"subject_name"`
	EdpCode       string `json:"edp_code"`
	Schedule      string `json:"schedule"`
	StudentCount  int    `json:"student_count"`
	PresentCount  int    `json:"present_count"`
	AbsentCount   int    `json:"absent_count"`
	LateCount     int    `json:"late_count"`
	ExcusedCount  int    `json:"excused_count"`
}

// GetArchivedAttendanceSheets gets all archived attendance sheets for a teacher
func (a *App) GetArchivedAttendanceSheets(teacherUserID int) ([]ArchivedAttendanceSheet, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			a.class_id,
			a.date,
			s.subject_code,
			s.description as subject_name,
			c.edp_code,
			c.schedule,
			COUNT(*) as student_count,
			SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
			SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
			SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
			SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused_count
		FROM attendance a
		JOIN classes c ON a.class_id = c.class_id
		JOIN subjects s ON c.subject_code = s.subject_code
		WHERE c.teacher_user_id = ? AND a.is_archived = TRUE
		GROUP BY a.class_id, a.date, s.subject_code, s.description, c.edp_code, c.schedule
		ORDER BY a.date DESC, s.subject_code
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
			&sheet.StudentCount, &sheet.PresentCount, &sheet.AbsentCount, &sheet.LateCount, &sheet.ExcusedCount,
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
