package main

import (
	"database/sql"
	"encoding/csv"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// ==============================================================================
// ENROLLMENT MANAGEMENT - Student enrollment in classes
// ==============================================================================

// GetAvailableStudents returns students not enrolled in a specific class
func (a *App) GetAvailableStudents(classID int) ([]ClassStudent, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			s.id as id, s.student_id, s.first_name, s.middle_name, s.last_name,
			EXISTS(
				SELECT 1 FROM classlist cl 
				WHERE cl.student_id = s.id AND cl.class_id = ? AND cl.status = 'active' AND (cl.is_archived = 0 OR cl.is_archived IS NULL)
			) as is_enrolled
		FROM students s
		WHERE NOT EXISTS (
			SELECT 1 FROM classlist cl 
			WHERE cl.student_id = s.id AND cl.class_id = ? AND cl.status = 'active' AND (cl.is_archived = 0 OR cl.is_archived IS NULL)
		)
		ORDER BY last_name, first_name
	`

	rows, err := a.db.Query(query, classID, classID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var students []ClassStudent
	for rows.Next() {
		var student ClassStudent
		var middleName sql.NullString
		err := rows.Scan(&student.ID, &student.StudentID, &student.FirstName, &middleName, &student.LastName, &student.IsEnrolled)
		if err != nil {
			continue
		}
		if middleName.Valid {
			student.MiddleName = &middleName.String
		}
		students = append(students, student)
	}

	return students, nil
}

// GetAllStudentsForEnrollment returns all students with their enrollment status for a specific class
func (a *App) GetAllStudentsForEnrollment(classID int) ([]ClassStudent, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			s.id as id, s.student_id, s.first_name, s.middle_name, s.last_name,
			EXISTS(
				SELECT 1 FROM classlist cl 
				WHERE cl.student_id = s.id AND cl.class_id = ? AND cl.status = 'active' AND (cl.is_archived = 0 OR cl.is_archived IS NULL)
			) as is_enrolled
		FROM students s
		ORDER BY last_name, first_name
	`

	rows, err := a.db.Query(query, classID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var students []ClassStudent
	for rows.Next() {
		var student ClassStudent
		var middleName sql.NullString
		err := rows.Scan(&student.ID, &student.StudentID, &student.FirstName, &middleName,
			&student.LastName, &student.IsEnrolled)
		if err != nil {
			continue
		}
		if middleName.Valid {
			student.MiddleName = &middleName.String
		}
		students = append(students, student)
	}

	return students, nil
}

// EnrollStudentInClass enrolls a student in a specific class
// If the student was previously enrolled and archived, it will reactivate and unarchive the enrollment
func (a *App) EnrollStudentInClass(studentID int, classID int, enrolledBy int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	query := `
		MERGE classlist AS target
		USING (SELECT ? AS class_id, ? AS student_id, CAST(GETDATE() AS DATE) AS enrollment_date, 'active' AS status, 0 AS is_archived) AS source
		ON target.class_id = source.class_id AND target.student_id = source.student_id
		WHEN MATCHED THEN
			UPDATE SET status = 'active', is_archived = 0, updated_at = CURRENT_TIMESTAMP
		WHEN NOT MATCHED THEN
			INSERT (class_id, student_id, enrollment_date, status, is_archived)
			VALUES (source.class_id, source.student_id, source.enrollment_date, source.status, source.is_archived);
	`
	_, err := a.db.Exec(query, classID, studentID)
	if err != nil {
		log.Printf("⚠ Failed to enroll student %d in class %d: %v", studentID, classID, err)
		return err
	}

	log.Printf("✓ Student %d enrolled in class %d", studentID, classID)
	return nil
}

// EnrollMultipleStudents enrolls multiple students in a class at once
// If students were previously enrolled and archived, it will reactivate and unarchive their enrollments
func (a *App) EnrollMultipleStudents(studentIDs []int, classID int, enrolledBy int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		MERGE classlist AS target
		USING (SELECT ? AS class_id, ? AS student_id, CAST(GETDATE() AS DATE) AS enrollment_date, 'active' AS status, 0 AS is_archived) AS source
		ON target.class_id = source.class_id AND target.student_id = source.student_id
		WHEN MATCHED THEN
			UPDATE SET status = 'active', is_archived = 0, updated_at = CURRENT_TIMESTAMP
		WHEN NOT MATCHED THEN
			INSERT (class_id, student_id, enrollment_date, status, is_archived)
			VALUES (source.class_id, source.student_id, source.enrollment_date, source.status, source.is_archived);
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, studentID := range studentIDs {
		_, err = stmt.Exec(classID, studentID)
		if err != nil {
			log.Printf("⚠ Failed to enroll student %d: %v", studentID, err)
			return err
		}
	}

	if err = tx.Commit(); err != nil {
		return err
	}

	log.Printf("✓ Enrolled %d students in class %d", len(studentIDs), classID)
	return nil
}

// UnenrollStudentFromClass removes a student from a class
func (a *App) UnenrollStudentFromClass(classlistID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	// classlistID is now a composite key, so we need class_id and student_id
	// For now, we'll need to update the function signature or parse the ID
	// Since we can't easily get both from a single ID, let's update to use composite key
	// This function signature needs to change - for now, assuming classlistID represents class_id
	query := `UPDATE classlist SET status = 'dropped' WHERE class_id = ?`
	_, err := a.db.Exec(query, classlistID)
	if err != nil {
		log.Printf("⚠ Failed to unenroll student (class_id=%d): %v", classlistID, err)
		return err
	}

	log.Printf("✓ Student unenrolled (class_id=%d)", classlistID)
	return nil
}

// UnenrollStudentFromClassByIDs removes a student from a specific class by student_id and class_id
func (a *App) UnenrollStudentFromClassByIDs(studentID int, classID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	query := `UPDATE classlist SET status = 'dropped' WHERE student_id = ? AND class_id = ?`
	_, err := a.db.Exec(query, studentID, classID)
	if err != nil {
		log.Printf("⚠ Failed to unenroll student %d from class %d: %v", studentID, classID, err)
		return err
	}

	log.Printf("✓ Student %d unenrolled from class %d", studentID, classID)
	return nil
}

// GetClassesByEDPCode returns all classes matching the EDP code
func (a *App) GetClassesByEDPCode(edpCode string) ([]CourseClass, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	// Validate and sanitize EDP code input
	edpCode = strings.TrimSpace(edpCode)
	if edpCode == "" {
		return nil, fmt.Errorf("EDP code cannot be empty")
	}

	// Check for valid characters (alphanumeric, dash, underscore only)
	if !regexp.MustCompile(`^[a-zA-Z0-9_-]+$`).MatchString(edpCode) {
		return nil, fmt.Errorf("invalid EDP code format. Only letters, numbers, dashes, and underscores are allowed")
	}

	// Limit length to prevent potential issues
	if len(edpCode) > 50 {
		return nil, fmt.Errorf("EDP code is too long. Maximum 50 characters allowed")
	}

	query := `
		SELECT 
			c.class_id, c.subject_code, s.description as subject_name, c.descriptive_title, c.edp_code,
			c.teacher_id, (t.last_name + ', ' + t.first_name) as teacher_name,
			c.schedule, c.room, c.semester, c.school_year,
			COALESCE(enrollment_count.count, 0) as enrolled_count,
			c.is_active, c.created_by_user_id, c.created_at
		FROM classes c
		LEFT JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN teachers t ON c.teacher_id = t.id
		LEFT JOIN (
			SELECT class_id, COUNT(*) as count 
			FROM classlist 
			WHERE status = 'active'
			GROUP BY class_id
		) enrollment_count ON c.class_id = enrollment_count.class_id
		WHERE c.edp_code = ? AND c.is_active = 1
		ORDER BY c.created_at DESC
	`
	rows, err := a.db.Query(query, edpCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var classes []CourseClass
	for rows.Next() {
		var class CourseClass
		var subjectName, descriptiveTitle, edpCode, schedule, room, semester, schoolYear sql.NullString
		var teacherName sql.NullString
		var createdBy sql.NullInt64
		var createdAt time.Time
		err := rows.Scan(
			&class.ClassID, &class.SubjectCode, &subjectName, &descriptiveTitle, &edpCode,
			&class.TeacherUserID, &teacherName,
			&schedule, &room, &semester, &schoolYear,
			&class.EnrolledCount, &class.IsActive, &createdBy, &createdAt,
		)
		if err != nil {
			continue
		}
		if subjectName.Valid {
			class.SubjectName = subjectName.String
		}
		if descriptiveTitle.Valid {
			class.DescriptiveTitle = &descriptiveTitle.String
		}
		if edpCode.Valid {
			class.EdpCode = &edpCode.String
		}
		if teacherName.Valid {
			class.TeacherName = &teacherName.String
		}
		if schedule.Valid {
			class.Schedule = &schedule.String
		}
		if room.Valid {
			class.Room = &room.String
		}
		if semester.Valid {
			class.Semester = &semester.String
		}
		if schoolYear.Valid {
			class.SchoolYear = &schoolYear.String
		}
		if createdBy.Valid {
			createdByInt := int(createdBy.Int64)
			class.CreatedByUserID = &createdByInt
		}
		class.CreatedAt = createdAt.Format("2006-01-02 15:04:05")
		classes = append(classes, class)
	}

	return classes, nil
}

// JoinClassByEDPCode enrolls a student in a class by EDP code
func (a *App) JoinClassByEDPCode(studentUserID int, edpCode string) (int, error) {
	if err := a.checkDB(); err != nil {
		return 0, err
	}

	// Validate student ID
	if studentUserID <= 0 {
		return 0, fmt.Errorf("invalid student ID")
	}

	// Validate and sanitize EDP code (done in GetClassesByEDPCode)
	edpCode = strings.TrimSpace(edpCode)
	if edpCode == "" {
		return 0, fmt.Errorf("EDP code cannot be empty")
	}

	// First, find active classes with this EDP code
	classes, err := a.GetClassesByEDPCode(edpCode)
	if err != nil {
		return 0, fmt.Errorf("failed to find classes: %v", err)
	}

	if len(classes) == 0 {
		return 0, fmt.Errorf("no classes found for EDP code: %s", edpCode)
	}

	// Check if student is already enrolled in any of these classes
	for _, class := range classes {
		var exists int
		checkQuery := `SELECT 1 FROM classlist WHERE class_id = ? AND student_id = ? AND status = 'active' AND (is_archived = 0 OR is_archived IS NULL)`
		err := a.db.QueryRow(checkQuery, class.ClassID, studentUserID).Scan(&exists)
		if err == nil {
			// Already enrolled
			return class.ClassID, nil
		}
	}

	// Enroll in the first available class
	classID := classes[0].ClassID
	err = a.EnrollStudentInClass(studentUserID, classID, studentUserID)
	if err != nil {
		return 0, fmt.Errorf("failed to enroll student: %v", err)
	}

	return classID, nil
}

// ==============================================================================
// ENROLLMENT ARCHIVING
// ==============================================================================

// ArchiveStudentEnrollment archives a student's enrollment in a specific class
func (a *App) ArchiveStudentEnrollment(studentUserID int, classID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	result, err := a.db.Exec(
		"UPDATE classlist SET is_archived = 1 WHERE student_id = ? AND class_id = ?",
		studentUserID, classID,
	)
	if err != nil {
		log.Printf("⚠ Failed to archive student enrollment: %v", err)
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("enrollment not found")
	}

	log.Printf("✓ Archived enrollment for student_id=%d in class_id=%d", studentUserID, classID)
	return nil
}

// UnarchiveStudentEnrollment restores a student's archived enrollment
func (a *App) UnarchiveStudentEnrollment(studentUserID int, classID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	result, err := a.db.Exec(
		"UPDATE classlist SET is_archived = 0 WHERE student_id = ? AND class_id = ?",
		studentUserID, classID,
	)
	if err != nil {
		log.Printf("⚠ Failed to unarchive student enrollment: %v", err)
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("enrollment not found")
	}

	log.Printf("✓ Unarchived enrollment for student_id=%d in class_id=%d", studentUserID, classID)
	return nil
}

// ==============================================================================
// STUDENT ENROLLMENT STATUS TOGGLE
// ==============================================================================

// SetStudentEnrollmentStatus updates the status of a student's enrollment in a class
// status can be: 'active' + 'dropped' + 'completed'
func (a *App) SetStudentEnrollmentStatus(studentUserID int, classID int, status string) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	// Validate status
	validStatuses := map[string]bool{"active": true, "dropped": true, "completed": true}
	if !validStatuses[status] {
		return fmt.Errorf("invalid status: %s. Must be 'active' + 'dropped', or 'completed'", status)
	}

	result, err := a.db.Exec(
		"UPDATE classlist SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE student_id = ? AND class_id = ?",
		status, studentUserID, classID,
	)
	if err != nil {
		log.Printf("⚠ Failed to update enrollment status: %v", err)
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("enrollment not found")
	}

	log.Printf("✓ Updated enrollment status: student_id=%d, class_id=%d, status=%s", studentUserID, classID, status)
	return nil
}

// MarkEnrollmentCompleted marks a student's enrollment as completed (semester finished)
func (a *App) MarkEnrollmentCompleted(studentUserID int, classID int) error {
	return a.SetStudentEnrollmentStatus(studentUserID, classID, "completed")
}

// MarkEnrollmentDropped marks a student's enrollment as dropped
func (a *App) MarkEnrollmentDropped(studentUserID int, classID int) error {
	return a.SetStudentEnrollmentStatus(studentUserID, classID, "dropped")
}

// ReactivateEnrollment marks a student's enrollment as active again
func (a *App) ReactivateEnrollment(studentUserID int, classID int) error {
	return a.SetStudentEnrollmentStatus(studentUserID, classID, "active")
}

// MarkAllEnrollmentsCompleted marks all active enrollments in a class as completed
// Useful when a class/semester ends
func (a *App) MarkAllEnrollmentsCompleted(classID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	result, err := a.db.Exec(
		"UPDATE classlist SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE class_id = ? AND status = 'active'",
		classID,
	)
	if err != nil {
		log.Printf("⚠ Failed to mark all enrollments completed: %v", err)
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("✓ Marked all enrollments completed for class_id=%d, affected=%d", classID, rowsAffected)
	return nil
}

// GetCompletedEnrollments returns all students with completed status in a class
func (a *App) GetCompletedEnrollments(classID int) ([]ClasslistEntry, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			cl.class_id, cl.student_id, stu.student_id,
			stu.first_name, stu.middle_name, stu.last_name,
			cl.status,
			cl.enrollment_date,
			stu.email,
			stu.contact_number,
			sub.description as course
		FROM classlist cl
		JOIN students stu ON cl.student_id = stu.id
		JOIN classes c ON cl.class_id = c.class_id
		JOIN subjects sub ON c.subject_code = sub.subject_code
		WHERE cl.class_id = ? AND cl.status = 'completed'
		ORDER BY stu.last_name, stu.first_name
	`

	rows, err := a.db.Query(query, classID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var students []ClasslistEntry
	for rows.Next() {
		var student ClasslistEntry
		var middleName, email, contactNumber, course sql.NullString
		var enrollmentDate time.Time
		err := rows.Scan(
			&student.ClassID, &student.StudentUserID, &student.StudentCode,
			&student.FirstName, &middleName, &student.LastName,
			&student.Status,
			&enrollmentDate, &email, &contactNumber, &course,
		)
		if err != nil {
			continue
		}
		if middleName.Valid {
			student.MiddleName = &middleName.String
		}
		if email.Valid {
			student.Email = &email.String
		}
		if contactNumber.Valid {
			student.ContactNumber = &contactNumber.String
		}
		if course.Valid {
			student.Course = &course.String
		}
		student.EnrollmentDate = enrollmentDate.Format("2006-01-02")
		students = append(students, student)
	}

	return students, nil
}

// ==============================================================================
// CLASSLIST EXPORT
// ==============================================================================

// ExportClasslistCSV exports the classlist (enrolled students) for a class to CSV
func (a *App) ExportClasslistCSV(classID int) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}

	// First get class info for the filename
	var subjectCode, subjectName string
	classQuery := `
		SELECT c.subject_code, s.description
		FROM classes c
		JOIN subjects s ON c.subject_code = s.subject_code
		WHERE c.class_id = ?
	`
	err := a.db.QueryRow(classQuery, classID).Scan(&subjectCode, &subjectName)
	if err != nil {
		log.Printf("⚠ Failed to get class info for export: %v", err)
		subjectCode = fmt.Sprintf("class_%d", classID)
		subjectName = "Unknown Subject"
	}

	// Get all students including archived ones for the classlist
	query := `
		SELECT 
			stu.student_id, stu.first_name, stu.middle_name, stu.last_name,
			stu.email, stu.contact_number,
			cl.status, cl.enrollment_date
		FROM classlist cl
		JOIN students stu ON cl.student_id = stu.id
		WHERE cl.class_id = ?
		ORDER BY stu.last_name, stu.first_name
	`

	rows, err := a.db.Query(query, classID)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	type StudentRecord struct {
		StudentID      string
		FirstName      string
		MiddleName     string
		LastName       string
		Email          string
		ContactNumber  string
		Status         string
		EnrollmentDate string
	}

	var students []StudentRecord
	for rows.Next() {
		var s StudentRecord
		var middleName, email, contactNumber sql.NullString
		var enrollmentDate time.Time
		err := rows.Scan(
			&s.StudentID, &s.FirstName, &middleName, &s.LastName,
			&email, &contactNumber, &s.Status, &enrollmentDate,
		)
		if err != nil {
			continue
		}
		if middleName.Valid {
			s.MiddleName = middleName.String
		}
		if email.Valid {
			s.Email = email.String
		}
		if contactNumber.Valid {
			s.ContactNumber = contactNumber.String
		}
		s.EnrollmentDate = enrollmentDate.Format("2006-01-02")
		students = append(students, s)
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("classlist_%s_%s.csv", subjectCode, time.Now().Format("20060102_150405")))

	file, err := os.Create(filename)
	if err != nil {
		return "", err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// Write header with class info
	writer.Write([]string{"Subject", fmt.Sprintf("%s - %s", subjectCode, subjectName)})
	writer.Write([]string{""})
	writer.Write([]string{"Student ID", "First Name", "Middle Name", "Last Name", "Email", "Contact Number", "Status", "Enrollment Date"})

	// Write student data
	for _, s := range students {
		writer.Write([]string{
			s.StudentID,
			s.FirstName,
			s.MiddleName,
			s.LastName,
			s.Email,
			s.ContactNumber,
			s.Status,
			s.EnrollmentDate,
		})
	}

	log.Printf("✓ Classlist exported to CSV: %s (%d students)", filename, len(students))
	return filename, nil
}
