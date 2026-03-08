package backend

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

	"github.com/jung-kurt/gofpdf"
)

// ==============================================================================
// ENROLLMENT MANAGEMENT - Student enrollment in classes
// ==============================================================================

// GetAllStudentsForEnrollment returns all students with their enrollment status for a specific class
func (a *App) GetAllStudentsForEnrollment(classID int) ([]ClassStudent, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			s.id as id, s.student_id, s.first_name, s.middle_name, s.last_name,
			CASE WHEN EXISTS(
				SELECT 1 FROM classlist cl 
				WHERE cl.student_id = s.id AND cl.class_id = ? AND cl.status = 'active' AND (cl.is_archived = 0 OR cl.is_archived IS NULL)
			) THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END as is_enrolled
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
// Rule: Class must be ACTIVE for enrollment. When student joins and today's attendance exists,
// auto-insert an attendance record for the student with status='absent'.
func (a *App) EnrollStudentInClass(studentID int, classID int, enrolledBy int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	// Check class is active (not closed or archived)
	var isActive bool
	var isArchived bool
	err := a.db.QueryRow(`SELECT is_active, COALESCE(is_archived, 0) FROM classes WHERE class_id = ?`, classID).Scan(&isActive, &isArchived)
	if err != nil {
		return fmt.Errorf("class not found")
	}
	if !isActive || isArchived {
		return fmt.Errorf("cannot enroll students in a closed or archived class")
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
	_, err = a.db.Exec(query, classID, studentID)
	if err != nil {
		log.Printf("Failed to enroll student %d in class %d: %v", studentID, classID, err)
		return err
	}

	// Auto-insert attendance for today if today's attendance sheet already exists
	today := time.Now().Format("2006-01-02")
	var attendanceExists int
	err = a.db.QueryRow(
		`SELECT COUNT(*) FROM attendance WHERE class_id = ? AND attendance_date = ?`,
		classID, today,
	).Scan(&attendanceExists)
	if err == nil && attendanceExists > 0 {
		// Insert attendance record for this student with status='absent'
		insertQuery := `
			MERGE attendance AS target
			USING (SELECT ? AS class_id, ? AS student_id, ? AS attendance_date, 'absent' AS status, 0 AS is_archived) AS source
			ON target.class_id = source.class_id AND target.student_id = source.student_id AND target.attendance_date = source.attendance_date
			WHEN NOT MATCHED THEN
				INSERT (class_id, student_id, attendance_date, status, is_archived)
				VALUES (source.class_id, source.student_id, source.attendance_date, source.status, source.is_archived);
		`
		_, err = a.db.Exec(insertQuery, classID, studentID, today)
		if err != nil {
			log.Printf("Warning: Failed to auto-insert attendance for late joiner student %d: %v", studentID, err)
		} else {
			log.Printf("Auto-inserted attendance for late joiner: student=%d, class=%d, date=%s", studentID, classID, today)
		}
	}

	log.Printf("Student %d enrolled in class %d", studentID, classID)
	return nil
}

// EnrollMultipleStudents enrolls multiple students in a class at once
// If students were previously enrolled and archived, it will reactivate and unarchive their enrollments
// Rule: Class must be ACTIVE for enrollment.
func (a *App) EnrollMultipleStudents(studentIDs []int, classID int, enrolledBy int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	// Check class is active (not closed or archived)
	var isActive bool
	var isArchived bool
	err := a.db.QueryRow(`SELECT is_active, COALESCE(is_archived, 0) FROM classes WHERE class_id = ?`, classID).Scan(&isActive, &isArchived)
	if err != nil {
		return fmt.Errorf("class not found")
	}
	if !isActive || isArchived {
		return fmt.Errorf("cannot enroll students in a closed or archived class")
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
			log.Printf("Failed to enroll student %d: %v", studentID, err)
			return err
		}
	}

	if err = tx.Commit(); err != nil {
		return err
	}

	log.Printf("Enrolled %d students in class %d", len(studentIDs), classID)
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
		log.Printf("Failed to unenroll student %d from class %d: %v", studentID, classID, err)
		return err
	}

	log.Printf("Student %d unenrolled from class %d", studentID, classID)
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
	if err := a.ensureStudentArchivedClassesTable(); err != nil {
		return 0, err
	}

	if err := ValidatePositiveID(studentUserID, "student ID"); err != nil {
		return 0, err
	}

	edpCode, err := ValidateEDPCode(edpCode)
	if err != nil {
		return 0, err
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
		checkQuery := `SELECT 1 FROM classlist WHERE class_id = ? AND student_id = ? AND status = 'active'`
		err := a.db.QueryRow(checkQuery, class.ClassID, studentUserID).Scan(&exists)
		if err == nil {
			_, _ = a.db.Exec(
				"DELETE FROM student_archived_classes WHERE student_id = ? AND class_id = ?",
				studentUserID, class.ClassID,
			)
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

	log.Printf("Student %d joined class %d via EDP code %s", studentUserID, classID, edpCode)
	return classID, nil
}

// ==============================================================================
// ENROLLMENT ARCHIVING
// ==============================================================================

func (a *App) ensureStudentArchivedClassesTable() error {
	if err := a.checkDB(); err != nil {
		return err
	}

	createQuery := `
		IF OBJECT_ID('student_archived_classes', 'U') IS NULL
		BEGIN
			CREATE TABLE student_archived_classes (
				student_id INT NOT NULL,
				class_id INT NOT NULL,
				archived_at DATETIME NOT NULL DEFAULT GETDATE(),
				updated_at DATETIME NOT NULL DEFAULT GETDATE(),
				CONSTRAINT PK_student_archived_classes PRIMARY KEY (student_id, class_id),
				CONSTRAINT FK_student_archived_classes_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
				CONSTRAINT FK_student_archived_classes_class FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE
			)
		END
	`

	if _, err := a.db.Exec(createQuery); err != nil {
		return err
	}

	// Compatibility migration: if old table name exists, copy data once.
	_, _ = a.db.Exec(`
		IF OBJECT_ID('student_hidden_classes', 'U') IS NOT NULL
		BEGIN
			INSERT INTO student_archived_classes (student_id, class_id, archived_at, updated_at)
			SELECT sh.student_id, sh.class_id, GETDATE(), GETDATE()
			FROM student_hidden_classes sh
			LEFT JOIN student_archived_classes sac ON sac.student_id = sh.student_id AND sac.class_id = sh.class_id
			WHERE sac.student_id IS NULL
		END
	`)

	// Legacy migration: old student personal archives were stored in classlist.is_archived.
	// Move only ACTIVE (non-globally-archived) classes to personal archive table.
	_, _ = a.db.Exec(`
		INSERT INTO student_archived_classes (student_id, class_id, archived_at, updated_at)
		SELECT cl.student_id, cl.class_id, GETDATE(), GETDATE()
		FROM classlist cl
		INNER JOIN classes c ON c.class_id = cl.class_id
		LEFT JOIN student_archived_classes sac ON sac.student_id = cl.student_id AND sac.class_id = cl.class_id
		WHERE cl.status = 'active'
			AND COALESCE(cl.is_archived, 0) = 1
			AND COALESCE(c.is_archived, 0) = 0
			AND sac.student_id IS NULL
	`)

	_, _ = a.db.Exec(`
		UPDATE cl
		SET cl.is_archived = 0,
			cl.updated_at = CURRENT_TIMESTAMP
		FROM classlist cl
		INNER JOIN classes c ON c.class_id = cl.class_id
		WHERE cl.status = 'active'
			AND COALESCE(cl.is_archived, 0) = 1
			AND COALESCE(c.is_archived, 0) = 0
	`)

	return nil
}

// ArchiveStudentEnrollment archives a student's enrollment in a specific class
func (a *App) ArchiveStudentEnrollment(studentUserID int, classID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureStudentArchivedClassesTable(); err != nil {
		return err
	}

	var enrollmentExists int
	err := a.db.QueryRow(
		`SELECT COUNT(*) FROM classlist WHERE student_id = ? AND class_id = ? AND status = 'active'`,
		studentUserID, classID,
	).Scan(&enrollmentExists)
	if err != nil {
		return err
	}
	if enrollmentExists == 0 {
		return fmt.Errorf("enrollment not found")
	}

	var classArchived bool
	err = a.db.QueryRow(`SELECT COALESCE(is_archived, 0) FROM classes WHERE class_id = ?`, classID).Scan(&classArchived)
	if err != nil {
		return fmt.Errorf("class not found")
	}
	if classArchived {
		return fmt.Errorf("class is already archived by teacher")
	}

	result, err := a.db.Exec(
		`MERGE student_archived_classes AS target
		 USING (SELECT ? AS student_id, ? AS class_id) AS source
		 ON target.student_id = source.student_id AND target.class_id = source.class_id
		 WHEN MATCHED THEN
		 	UPDATE SET updated_at = GETDATE()
		 WHEN NOT MATCHED THEN
		 	INSERT (student_id, class_id, archived_at, updated_at)
		 	VALUES (source.student_id, source.class_id, GETDATE(), GETDATE());`,
		studentUserID, classID,
	)
	if err != nil {
		log.Printf("Failed to hide student class: %v", err)
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("failed to hide class")
	}

	log.Printf("Student hid class from My Classes: student_id=%d class_id=%d", studentUserID, classID)
	return nil
}

// UnarchiveStudentEnrollment restores a student's archived enrollment
func (a *App) UnarchiveStudentEnrollment(studentUserID int, classID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureStudentArchivedClassesTable(); err != nil {
		return err
	}

	var classArchived bool
	err := a.db.QueryRow(`SELECT COALESCE(is_archived, 0) FROM classes WHERE class_id = ?`, classID).Scan(&classArchived)
	if err == nil && classArchived {
		return fmt.Errorf("class is archived by teacher and cannot be restored to My Classes")
	}

	result, err := a.db.Exec(
		"DELETE FROM student_archived_classes WHERE student_id = ? AND class_id = ?",
		studentUserID, classID,
	)
	if err != nil {
		log.Printf("Failed to restore hidden student class: %v", err)
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("class is not in your archived list")
	}

	log.Printf("Student restored class to My Classes: student_id=%d class_id=%d", studentUserID, classID)
	return nil
}

// ==============================================================================
// CLASSLIST EXPORT
// ==============================================================================

// ExportClasslistCSV exports the classlist (enrolled students) for a class to CSV
func (a *App) ExportClasslistCSV(classID int) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}

	var subjectCode string
	var subjectName, schedule, room, teacherName, semester, schoolYear sql.NullString
	classQuery := `
		SELECT
			c.subject_code,
			s.description,
			c.schedule,
			c.room,
			(t.last_name + ', ' + t.first_name) as teacher_name,
			c.semester,
			c.school_year
		FROM classes c
		JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN teachers t ON c.teacher_id = t.id
		WHERE c.class_id = ?
	`
	err := a.db.QueryRow(classQuery, classID).Scan(&subjectCode, &subjectName, &schedule, &room, &teacherName, &semester, &schoolYear)
	if err != nil {
		log.Printf("Failed to get class info for export: %v", err)
		subjectCode = fmt.Sprintf("class_%d", classID)
		subjectName = sql.NullString{String: "Unknown Subject", Valid: true}
	}

	query := `
		SELECT 
			stu.student_id, stu.first_name, stu.middle_name, stu.last_name,
			stu.email, stu.contact_number
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
		StudentID     string
		FirstName     string
		MiddleName    string
		LastName      string
		Email         string
		ContactNumber string
	}

	var students []StudentRecord
	for rows.Next() {
		var s StudentRecord
		var middleName, email, contactNumber sql.NullString
		err := rows.Scan(
			&s.StudentID, &s.FirstName, &middleName, &s.LastName,
			&email, &contactNumber,
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

	subjectNameValue := "N/A"
	if subjectName.Valid && strings.TrimSpace(subjectName.String) != "" {
		subjectNameValue = subjectName.String
	}
	scheduleValue := "N/A"
	if schedule.Valid && strings.TrimSpace(schedule.String) != "" {
		scheduleValue = schedule.String
	}
	roomValue := "N/A"
	if room.Valid && strings.TrimSpace(room.String) != "" {
		roomValue = room.String
	}
	teacherValue := "N/A"
	if teacherName.Valid && strings.TrimSpace(teacherName.String) != "" {
		teacherValue = teacherName.String
	}
	semesterValue := "N/A"
	if semester.Valid && strings.TrimSpace(semester.String) != "" {
		semesterValue = semester.String
	}
	schoolYearValue := "N/A"
	if schoolYear.Valid && strings.TrimSpace(schoolYear.String) != "" {
		schoolYearValue = schoolYear.String
	}

	writer.Write([]string{"CLASS LIST"})
	writer.Write([]string{fmt.Sprintf("School Year %s • %s", schoolYearValue, semesterValue)})
	writer.Write([]string{""})
	writer.Write([]string{"CLASS INFORMATION"})
	writer.Write([]string{"Subject Code", subjectCode, "Schedule", scheduleValue})
	writer.Write([]string{"Subject Name", subjectNameValue, "Room", roomValue})
	writer.Write([]string{"Instructor", teacherValue})
	writer.Write([]string{""})
	writer.Write([]string{"STUDENTS LIST"})
	writer.Write([]string{"No.", "Student ID", "Name", "Email", "Contact"})

	for index, s := range students {
		middleInitial := ""
		if strings.TrimSpace(s.MiddleName) != "" {
			middleInitial = fmt.Sprintf(" %s.", strings.ToUpper(string(s.MiddleName[0])))
		}
		fullName := fmt.Sprintf("%s, %s%s", s.LastName, s.FirstName, middleInitial)
		email := s.Email
		if strings.TrimSpace(email) == "" {
			email = "—"
		}
		contact := s.ContactNumber
		if strings.TrimSpace(contact) == "" {
			contact = "—"
		}

		writer.Write([]string{
			fmt.Sprintf("%d", index+1),
			s.StudentID,
			fullName,
			email,
			contact,
		})
	}

	log.Printf("Classlist exported to CSV: %s (%d students)", filename, len(students))
	return filename, nil
}

// ExportClasslistPDF exports the classlist (enrolled students) for a class to PDF
func (a *App) ExportClasslistPDF(classID int) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}

	var subjectCode string
	var subjectName, schedule, room, teacherName, semester, schoolYear sql.NullString
	classQuery := `
		SELECT
			c.subject_code,
			s.description,
			c.schedule,
			c.room,
			(t.last_name + ', ' + t.first_name) as teacher_name,
			c.semester,
			c.school_year
		FROM classes c
		JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN teachers t ON c.teacher_id = t.id
		WHERE c.class_id = ?
	`
	err := a.db.QueryRow(classQuery, classID).Scan(&subjectCode, &subjectName, &schedule, &room, &teacherName, &semester, &schoolYear)
	if err != nil {
		log.Printf("Failed to get class info for PDF export: %v", err)
		subjectCode = fmt.Sprintf("class_%d", classID)
		subjectName = sql.NullString{String: "Unknown Subject", Valid: true}
	}

	query := `
		SELECT 
			stu.student_id, stu.first_name, stu.middle_name, stu.last_name,
			stu.email, stu.contact_number
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
		StudentID     string
		FirstName     string
		MiddleName    string
		LastName      string
		Email         string
		ContactNumber string
	}

	var students []StudentRecord
	for rows.Next() {
		var s StudentRecord
		var middleName, email, contactNumber sql.NullString
		err := rows.Scan(
			&s.StudentID, &s.FirstName, &middleName, &s.LastName,
			&email, &contactNumber,
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
		students = append(students, s)
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("classlist_%s_%s.pdf", subjectCode, time.Now().Format("20060102_150405")))

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(10, 10, 10)
	pdf.SetAutoPageBreak(true, 10)
	pdf.AddPage()

	subjectNameValue := "N/A"
	if subjectName.Valid && strings.TrimSpace(subjectName.String) != "" {
		subjectNameValue = subjectName.String
	}
	scheduleValue := "N/A"
	if schedule.Valid && strings.TrimSpace(schedule.String) != "" {
		scheduleValue = schedule.String
	}
	roomValue := "N/A"
	if room.Valid && strings.TrimSpace(room.String) != "" {
		roomValue = room.String
	}
	teacherValue := "N/A"
	if teacherName.Valid && strings.TrimSpace(teacherName.String) != "" {
		teacherValue = teacherName.String
	}
	semesterValue := "N/A"
	if semester.Valid && strings.TrimSpace(semester.String) != "" {
		semesterValue = semester.String
	}
	schoolYearValue := "N/A"
	if schoolYear.Valid && strings.TrimSpace(schoolYear.String) != "" {
		schoolYearValue = schoolYear.String
	}

	truncate := func(value string, max int) string {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return "—"
		}
		runes := []rune(trimmed)
		if len(runes) <= max {
			return trimmed
		}
		if max <= 1 {
			return string(runes[:max])
		}
		return string(runes[:max-1]) + "…"
	}

	pdf.SetFont("Arial", "B", 14)
	pdf.Cell(0, 8, "CLASS LIST")
	pdf.Ln(9)
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(0, 6, fmt.Sprintf("School Year %s • %s", schoolYearValue, semesterValue))
	pdf.Ln(6)
	pdf.SetFont("Arial", "B", 10)
	pdf.Cell(0, 6, "CLASS INFORMATION")
	pdf.Ln(7)
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(30, 6, "Subject Code:", "", 0, "L", false, 0, "")
	pdf.CellFormat(70, 6, subjectCode, "", 0, "L", false, 0, "")
	pdf.CellFormat(25, 6, "Schedule:", "", 0, "L", false, 0, "")
	pdf.CellFormat(65, 6, scheduleValue, "", 1, "L", false, 0, "")
	pdf.CellFormat(30, 6, "Subject Name:", "", 0, "L", false, 0, "")
	pdf.CellFormat(70, 6, subjectNameValue, "", 0, "L", false, 0, "")
	pdf.CellFormat(25, 6, "Room:", "", 0, "L", false, 0, "")
	pdf.CellFormat(65, 6, roomValue, "", 1, "L", false, 0, "")
	pdf.CellFormat(30, 6, "Instructor:", "", 0, "L", false, 0, "")
	pdf.CellFormat(160, 6, teacherValue, "", 1, "L", false, 0, "")
	pdf.Ln(2)
	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(120, 6, "STUDENTS LIST", "", 0, "L", false, 0, "")
	pdf.CellFormat(70, 6, fmt.Sprintf("Total: %d", len(students)), "", 1, "R", false, 0, "")
	pdf.Ln(1)

	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(12, 7, "#", "1", 0, "C", false, 0, "")
	pdf.CellFormat(28, 7, "Student ID", "1", 0, "C", false, 0, "")
	pdf.CellFormat(60, 7, "Name", "1", 0, "C", false, 0, "")
	pdf.CellFormat(55, 7, "Email", "1", 0, "C", false, 0, "")
	pdf.CellFormat(35, 7, "Contact", "1", 1, "C", false, 0, "")

	pdf.SetFont("Arial", "", 9)
	for index, s := range students {
		middleInitial := ""
		if s.MiddleName != "" {
			middleInitial = fmt.Sprintf(" %s.", strings.ToUpper(string(s.MiddleName[0])))
		}
		fullName := fmt.Sprintf("%s, %s%s", s.LastName, s.FirstName, middleInitial)

		pdf.CellFormat(12, 7, fmt.Sprintf("%d", index+1), "1", 0, "C", false, 0, "")
		pdf.CellFormat(28, 7, s.StudentID, "1", 0, "L", false, 0, "")
		pdf.CellFormat(60, 7, truncate(fullName, 34), "1", 0, "L", false, 0, "")
		pdf.CellFormat(55, 7, truncate(s.Email, 30), "1", 0, "L", false, 0, "")
		pdf.CellFormat(35, 7, truncate(s.ContactNumber, 20), "1", 1, "L", false, 0, "")
	}

	if err := pdf.OutputFileAndClose(filename); err != nil {
		return "", err
	}

	log.Printf("Classlist exported to PDF: %s (%d students)", filename, len(students))
	return filename, nil
}

// ExportClasslistDOCX exports the classlist for a class to DOCX
func (a *App) ExportClasslistDOCX(classID int) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}

	var subjectCode string
	var subjectName, schedule, room, teacherName, semester, schoolYear sql.NullString
	classQuery := `
		SELECT
			c.subject_code,
			s.description,
			c.schedule,
			c.room,
			(t.last_name + ', ' + t.first_name) as teacher_name,
			c.semester,
			c.school_year
		FROM classes c
		JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN teachers t ON c.teacher_id = t.id
		WHERE c.class_id = ?
	`
	err := a.db.QueryRow(classQuery, classID).Scan(&subjectCode, &subjectName, &schedule, &room, &teacherName, &semester, &schoolYear)
	if err != nil {
		log.Printf("Failed to get class info for DOCX export: %v", err)
		subjectCode = fmt.Sprintf("class_%d", classID)
		subjectName = sql.NullString{String: "Unknown Subject", Valid: true}
	}

	query := `
		SELECT 
			stu.student_id, stu.first_name, stu.middle_name, stu.last_name,
			stu.email, stu.contact_number
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
		StudentID, FirstName, MiddleName, LastName, Email, ContactNumber string
	}
	var students []StudentRecord
	for rows.Next() {
		var s StudentRecord
		var middleName, email, contactNumber sql.NullString
		if err := rows.Scan(&s.StudentID, &s.FirstName, &middleName, &s.LastName, &email, &contactNumber); err != nil {
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
		students = append(students, s)
	}

	subjectNameVal := "N/A"
	if subjectName.Valid && strings.TrimSpace(subjectName.String) != "" {
		subjectNameVal = subjectName.String
	}
	scheduleVal := "N/A"
	if schedule.Valid && strings.TrimSpace(schedule.String) != "" {
		scheduleVal = schedule.String
	}
	roomVal := "N/A"
	if room.Valid && strings.TrimSpace(room.String) != "" {
		roomVal = room.String
	}
	syVal := "N/A"
	if schoolYear.Valid && strings.TrimSpace(schoolYear.String) != "" {
		syVal = schoolYear.String
	}
	semVal := "N/A"
	if semester.Valid && strings.TrimSpace(semester.String) != "" {
		semVal = semester.String
	}

	title := fmt.Sprintf("Class List — %s: %s | SY %s %s", subjectCode, subjectNameVal, syVal, semVal)
	headers := []string{"No.", "Student ID", "Name", "Email", "Contact"}
	var docxRows [][]string
	for i, s := range students {
		middleInitial := ""
		if strings.TrimSpace(s.MiddleName) != "" {
			middleInitial = fmt.Sprintf(" %s.", strings.ToUpper(string(s.MiddleName[0])))
		}
		fullName := fmt.Sprintf("%s, %s%s", s.LastName, s.FirstName, middleInitial)
		email := s.Email
		if strings.TrimSpace(email) == "" {
			email = "—"
		}
		contact := s.ContactNumber
		if strings.TrimSpace(contact) == "" {
			contact = "—"
		}
		docxRows = append(docxRows, []string{fmt.Sprintf("%d", i+1), s.StudentID, fullName, email, contact})
	}
	_ = scheduleVal
	_ = roomVal

	data, err := generateDocx(title, headers, docxRows)
	if err != nil {
		return "", err
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("classlist_%s_%s.docx", subjectCode, time.Now().Format("20060102_150405")))
	if err := os.WriteFile(filename, data, 0644); err != nil {
		return "", fmt.Errorf("failed to write docx: %w", err)
	}
	log.Printf("Classlist exported to DOCX: %s (%d students)", filename, len(students))
	return filename, nil
}
