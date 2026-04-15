package backend

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"regexp"
	"strings"
	"time"
)

const (
	joinClassStatusJoin    = "join"
	joinClassStatusLeft    = "left"
	joinClassStatusAdded   = "added"
	joinClassStatusRemoved = "removed"
)

// ==============================================================================
// JOIN CLASS MANAGEMENT - Student class joining and teacher class membership updates
// ==============================================================================

func (a *App) notifyTeacherOfStudentJoinClassChange(studentUserID int, classID int, action string) {
	if a.db == nil {
		return
	}

	var teacherUserID int
	var subjectCode, studentFirstName, studentLastName sql.NullString
	err := a.db.QueryRow(`
		SELECT c.teacher_id, c.subject_code, s.first_name, s.last_name
		FROM classes c
		JOIN students s ON s.id = ?
		WHERE c.class_id = ?
	`, studentUserID, classID).Scan(&teacherUserID, &subjectCode, &studentFirstName, &studentLastName)
	if err != nil {
		log.Printf("Failed to build join-class notification payload: student_id=%d class_id=%d err=%v", studentUserID, classID, err)
		return
	}

	studentName := strings.TrimSpace(strings.TrimSpace(studentFirstName.String) + " " + strings.TrimSpace(studentLastName.String))
	if studentName == "" {
		studentName = fmt.Sprintf("Student #%d", studentUserID)
	}

	subjectLabel := strings.TrimSpace(subjectCode.String)
	if subjectLabel == "" {
		subjectLabel = fmt.Sprintf("class #%d", classID)
	}

	var title string
	var message string
	switch action {
	case joinClassStatusJoin, "joined":
		title = "Student joined class"
		message = fmt.Sprintf("%s joined your class %s.", studentName, subjectLabel)
	case joinClassStatusLeft:
		title = "Student left class"
		message = fmt.Sprintf("%s left your class %s.", studentName, subjectLabel)
	case joinClassStatusAdded:
		title = "Student added to class"
		message = fmt.Sprintf("%s was added to your class %s.", studentName, subjectLabel)
	case joinClassStatusRemoved:
		title = "Student removed from class"
		message = fmt.Sprintf("You removed %s from your class %s.", studentName, subjectLabel)
	default:
		return
	}

	a.createNotification(teacherUserID, "classlist", title, message, "info", notifRef("class"), notifRefID(classID))
}

func (a *App) notifyStudentOfTeacherClassMembershipChange(studentUserID int, classID int, action string) {
	if a.db == nil {
		return
	}

	var subjectCode sql.NullString
	err := a.db.QueryRow(`
		SELECT subject_code
		FROM classes
		WHERE class_id = ?
	`, classID).Scan(&subjectCode)
	if err != nil {
		log.Printf("Failed to build student class-membership notification payload: student_id=%d class_id=%d err=%v", studentUserID, classID, err)
		return
	}

	subjectLabel := strings.TrimSpace(subjectCode.String)
	if subjectLabel == "" {
		subjectLabel = fmt.Sprintf("class #%d", classID)
	}

	var title string
	var message string
	switch action {
	case joinClassStatusAdded:
		title = "Added to class"
		message = fmt.Sprintf("You were added to class %s.", subjectLabel)
	case joinClassStatusRemoved:
		title = "Removed from class"
		message = fmt.Sprintf("You were removed from class %s.", subjectLabel)
	default:
		return
	}

	a.createNotification(studentUserID, "classlist", title, message, "info", notifRef("class"), notifRefID(classID))
}

// GetAllStudentsForJoinClasses returns all students with their class membership status for a specific class.
func (a *App) GetAllStudentsForJoinClasses(classID int) ([]ClassStudent, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			s.id as id, s.student_id, s.first_name, s.middle_name, s.last_name,
			CASE WHEN EXISTS(
				SELECT 1 FROM joined_classes cl 
				WHERE cl.student_id = s.id AND cl.class_id = ? AND cl.status IN ('join', 'added') AND (cl.is_archived = 0 OR cl.is_archived IS NULL)
			) THEN 1 ELSE 0 END as is_joined
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
			&student.LastName, &student.IsJoined)
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

// AddStudentToJoinClass adds or joins a student to a specific class.
// If the student was previously in the class and archived, it will reactivate and unarchive the row.
// Rule: Class must be ACTIVE. When student joins and today's attendance exists,
// auto-insert an attendance record for the student with status='absent'.
func (a *App) AddStudentToJoinClass(studentID int, classID int, addedBy int) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureJoinedClassesStatusVocabulary(); err != nil {
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
		return fmt.Errorf("cannot add students in a closed or archived class")
	}

	joinClassStatus := joinClassStatusAdded
	if addedBy == studentID {
		joinClassStatus = joinClassStatusJoin
	}

	query := `
		INSERT INTO joined_classes (class_id, student_id, joined_date, status, is_archived)
		VALUES (?, ?, CURDATE(), ?, 0)
		ON DUPLICATE KEY UPDATE
			status = ?,
			is_archived = 0,
			updated_at = CURRENT_TIMESTAMP
	`
	_, err = a.db.Exec(query, classID, studentID, joinClassStatus, joinClassStatus)
	if err != nil {
		log.Printf("Failed to add/join student %d in class %d: %v", studentID, classID, err)
		return err
	}

	// Auto-sync attendance for today if an open attendance session exists.
	today := time.Now().Format("2006-01-02")
	openSessionID := 0
	if sessionTableErr := a.ensureAttendanceSessionsTable(); sessionTableErr != nil {
		log.Printf("Warning: Failed to initialize attendance sessions while syncing late joiner attendance: %v", sessionTableErr)
	} else {
		sessionErr := a.db.QueryRow(
			`SELECT session_id
			 FROM attendance_sessions
			 WHERE class_id = ? AND attendance_date = ? AND status = 'open' AND COALESCE(is_archived, 0) = 0
			 ORDER BY session_id DESC
			 LIMIT 1`,
			classID, today,
		).Scan(&openSessionID)
		if sessionErr != nil && sessionErr != sql.ErrNoRows {
			log.Printf("Warning: Failed to query open attendance session for class %d on %s: %v", classID, today, sessionErr)
		}
	}

	if openSessionID > 0 {
		if syncErr := a.ensureAttendanceRowsForSession(openSessionID, classID, today); syncErr != nil {
			log.Printf("Warning: Failed to sync attendance rows for open session %d: %v", openSessionID, syncErr)
		} else {
			log.Printf("Synced attendance rows for open session %d after student join: class=%d date=%s", openSessionID, classID, today)
		}
	}

	log.Printf("Student %d membership set to %s in class %d", studentID, joinClassStatus, classID)
	if joinClassStatus == joinClassStatusAdded {
		go a.notifyStudentOfTeacherClassMembershipChange(studentID, classID, joinClassStatusAdded)
	}
	return nil
}

// AddMultipleStudentsToJoinClass adds multiple students in a class at once.
// If students were previously in the class and archived, it will reactivate and unarchive their rows.
// Rule: Class must be ACTIVE.
func (a *App) AddMultipleStudentsToJoinClass(studentIDs []int, classID int, addedBy int) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureJoinedClassesStatusVocabulary(); err != nil {
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
		return fmt.Errorf("cannot add students in a closed or archived class")
	}

	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT INTO joined_classes (class_id, student_id, joined_date, status, is_archived)
		VALUES (?, ?, CURDATE(), 'added', 0)
		ON DUPLICATE KEY UPDATE
			status = 'added',
			is_archived = 0,
			updated_at = CURRENT_TIMESTAMP
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, studentID := range studentIDs {
		_, err = stmt.Exec(classID, studentID)
		if err != nil {
			log.Printf("Failed to add student %d: %v", studentID, err)
			return err
		}
	}

	if err = tx.Commit(); err != nil {
		return err
	}

	today := time.Now().Format("2006-01-02")
	if sessionTableErr := a.ensureAttendanceSessionsTable(); sessionTableErr != nil {
		log.Printf("Warning: Failed to initialize attendance sessions while syncing added students: %v", sessionTableErr)
	} else {
		var openSessionID int
		sessionErr := a.db.QueryRow(
			`SELECT session_id
			 FROM attendance_sessions
			 WHERE class_id = ? AND attendance_date = ? AND status = 'open' AND COALESCE(is_archived, 0) = 0
			 ORDER BY session_id DESC
			 LIMIT 1`,
			classID, today,
		).Scan(&openSessionID)

		if sessionErr == nil && openSessionID > 0 {
			if syncErr := a.ensureAttendanceRowsForSession(openSessionID, classID, today); syncErr != nil {
				log.Printf("Warning: Failed to sync attendance rows for open session %d after bulk add: %v", openSessionID, syncErr)
			}
		} else if sessionErr != nil && sessionErr != sql.ErrNoRows {
			log.Printf("Warning: Failed to query open attendance session for bulk add sync: class=%d date=%s err=%v", classID, today, sessionErr)
		}
	}

	log.Printf("Added %d students in class %d", len(studentIDs), classID)
	for _, studentID := range studentIDs {
		go a.notifyStudentOfTeacherClassMembershipChange(studentID, classID, joinClassStatusAdded)
	}
	return nil
}

// RemoveStudentFromJoinClassByIDs marks a class membership as removed when initiated by the teacher.
func (a *App) RemoveStudentFromJoinClassByIDs(studentID int, classID int) error {
	return a.updateJoinClassMembershipStatusByIDs(studentID, classID, joinClassStatusRemoved)
}

// LeaveClassByStudent marks a class membership as left when initiated by the student.
func (a *App) LeaveClassByStudent(studentID int, classID int) error {
	return a.updateJoinClassMembershipStatusByIDs(studentID, classID, joinClassStatusLeft)
}

func (a *App) updateJoinClassMembershipStatusByIDs(studentID int, classID int, nextStatus string) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureJoinedClassesStatusVocabulary(); err != nil {
		return err
	}
	if nextStatus != joinClassStatusLeft && nextStatus != joinClassStatusRemoved {
		return fmt.Errorf("invalid join-class status update: %s", nextStatus)
	}

	query := `
		UPDATE joined_classes
		SET status = ?, updated_at = CURRENT_TIMESTAMP
		WHERE student_id = ? AND class_id = ? AND status IN ('join', 'added')
	`
	result, err := a.db.Exec(query, nextStatus, studentID, classID)
	if err != nil {
		log.Printf("Failed to update class membership for student %d in class %d: %v", studentID, classID, err)
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("class membership not found")
	}

	_, _ = a.db.Exec(
		"DELETE FROM student_archived_classes WHERE student_id = ? AND class_id = ?",
		studentID, classID,
	)

	go a.notifyTeacherOfStudentJoinClassChange(studentID, classID, nextStatus)
	if nextStatus == joinClassStatusRemoved {
		go a.notifyStudentOfTeacherClassMembershipChange(studentID, classID, joinClassStatusRemoved)
	}

	log.Printf("Student %d status updated to %s for class %d", studentID, nextStatus, classID)
	return nil
}

// GetClassesByJoinCode returns all active classes matching a provided JOIN code.
func (a *App) GetClassesByJoinCode(joinCode string) ([]CourseClass, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	// Validate and sanitize class code input
	joinCode = strings.TrimSpace(joinCode)
	if joinCode == "" {
		return nil, fmt.Errorf("code cannot be empty")
	}

	// Check for valid characters (alphanumeric, dash, underscore only)
	if !regexp.MustCompile(`^[a-zA-Z0-9_-]+$`).MatchString(joinCode) {
		return nil, fmt.Errorf("invalid join code format. Only letters, numbers, dashes, and underscores are allowed")
	}

	// Limit length to prevent potential issues
	if len(joinCode) > 50 {
		return nil, fmt.Errorf("code is too long. Maximum 50 characters allowed")
	}

	query := `
		SELECT 
			c.class_id, c.subject_code, s.description as subject_name, c.descriptive_title, c.edp_code, c.join_code,
			c.teacher_id, (CONCAT(t.last_name, ', ', t.first_name)) as teacher_name,
			c.schedule, c.room, c.semester, c.school_year,
			COALESCE(enrollment_count.count, 0) as enrolled_count,
			c.is_active, c.created_by_user_id, c.created_at
		FROM classes c
		LEFT JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN teachers t ON c.teacher_id = t.id
		LEFT JOIN (
			SELECT class_id, COUNT(*) as count 
			FROM joined_classes 
			WHERE status IN ('join', 'added') AND COALESCE(is_archived, 0) = 0
			GROUP BY class_id
		) enrollment_count ON c.class_id = enrollment_count.class_id
		WHERE c.join_code = ? AND c.is_active = 1
		ORDER BY c.created_at DESC
	`
	rows, err := a.db.Query(query, joinCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var classes []CourseClass
	for rows.Next() {
		var class CourseClass
		var subjectName, descriptiveTitle, edpCode, joinCode, schedule, room, semester, schoolYear sql.NullString
		var teacherName sql.NullString
		var createdBy sql.NullInt64
		var createdAt time.Time
		err := rows.Scan(
			&class.ClassID, &class.SubjectCode, &subjectName, &descriptiveTitle, &edpCode, &joinCode,
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
		if joinCode.Valid {
			class.JoinCode = &joinCode.String
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

// JoinClassByJoinCode joins a student in a class by generated JOIN code.
func (a *App) JoinClassByJoinCode(studentUserID int, joinCode string) (int, error) {
	if err := a.checkDB(); err != nil {
		return 0, err
	}
	if err := a.ensureStudentArchivedClassesTable(); err != nil {
		return 0, err
	}

	if err := ValidatePositiveID(studentUserID, "student ID"); err != nil {
		return 0, err
	}

	joinCode, err := ValidateJoinCode(joinCode)
	if err != nil {
		return 0, err
	}

	// First, find active classes with this class code
	classes, err := a.GetClassesByJoinCode(joinCode)
	if err != nil {
		return 0, fmt.Errorf("failed to find classes: %v", err)
	}

	if len(classes) == 0 {
		return 0, fmt.Errorf("no classes found for code: %s", joinCode)
	}

	// Check if student is already in any of these classes
	for _, class := range classes {
		var exists int
		checkQuery := `SELECT 1 FROM joined_classes WHERE class_id = ? AND student_id = ? AND status IN ('join', 'added')`
		err := a.db.QueryRow(checkQuery, class.ClassID, studentUserID).Scan(&exists)
		if err == nil {
			_, _ = a.db.Exec(
				"DELETE FROM student_archived_classes WHERE student_id = ? AND class_id = ?",
				studentUserID, class.ClassID,
			)
			// Already joined
			return class.ClassID, nil
		}
	}

	// Join the first available class
	classID := classes[0].ClassID
	err = a.AddStudentToJoinClass(studentUserID, classID, studentUserID)
	if err != nil {
		return 0, fmt.Errorf("failed to join class: %v", err)
	}

	go a.notifyTeacherOfStudentJoinClassChange(studentUserID, classID, joinClassStatusJoin)

	log.Printf("Student %d joined class %d via class code %s", studentUserID, classID, joinCode)
	return classID, nil
}

// ensureStudentCanJoinClassDepartment validates student/class department compatibility.
// A mismatch is blocked when both sides have non-empty department codes.
func (a *App) ensureStudentCanJoinClassDepartment(studentUserID int, classID int) error {
	var studentDepartment sql.NullString
	err := a.db.QueryRow(`SELECT department_code FROM students WHERE id = ?`, studentUserID).Scan(&studentDepartment)
	if err == sql.ErrNoRows {
		return fmt.Errorf("student not found")
	}
	if err != nil {
		return fmt.Errorf("failed to check student department: %w", err)
	}

	var classDepartment sql.NullString
	err = a.db.QueryRow(`
		SELECT t.department_code
		FROM classes c
		LEFT JOIN teachers t ON c.teacher_id = t.id
		WHERE c.class_id = ?
	`, classID).Scan(&classDepartment)
	if err == sql.ErrNoRows {
		return fmt.Errorf("class not found")
	}
	if err != nil {
		return fmt.Errorf("failed to check class department: %w", err)
	}

	studentDept := strings.TrimSpace(studentDepartment.String)
	classDept := strings.TrimSpace(classDepartment.String)

	// Normalize department values so strict comparisons do not incorrectly block valid enrollments.
	studentDeptNormalized, err := a.resolveDepartmentCode(studentDept)
	if err != nil {
		return fmt.Errorf("failed to normalize student department: %w", err)
	}
	classDeptNormalized, err := a.resolveDepartmentCode(classDept)
	if err != nil {
		return fmt.Errorf("failed to normalize class department: %w", err)
	}

	if studentDeptNormalized != "" {
		studentDept = studentDeptNormalized
	}
	if classDeptNormalized != "" {
		classDept = classDeptNormalized
	}

	if studentDept != "" && classDept != "" && !strings.EqualFold(studentDept, classDept) {
		return fmt.Errorf("cannot join class: student department (%s) does not match class department (%s)", studentDept, classDept)
	}

	return nil
}

// resolveDepartmentCode returns a canonical department_code when a provided value
// matches either departments.department_code or departments.department_name.
func (a *App) resolveDepartmentCode(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", nil
	}

	var code sql.NullString
	err := a.db.QueryRow(`
		SELECT department_code
		FROM departments
		WHERE (
			UPPER(LTRIM(RTRIM(department_code))) = UPPER(?)
			OR UPPER(LTRIM(RTRIM(department_name))) = UPPER(?)
		)
		  AND COALESCE(is_deleted, 0) = 0
	`, trimmed, trimmed).Scan(&code)
	if err == sql.ErrNoRows {
		// Keep original value when no mapping exists; caller can still compare safely.
		return trimmed, nil
	}
	if err != nil {
		return "", err
	}
	if !code.Valid {
		return trimmed, nil
	}

	return strings.TrimSpace(code.String), nil
}

func (a *App) ensureJoinedClassesStatusVocabulary() error {
	if err := a.checkDB(); err != nil {
		return err
	}

	_, _ = a.db.Exec(`
		ALTER TABLE joined_classes
		MODIFY COLUMN status VARCHAR(20) DEFAULT 'added'
	`)

	rows, err := a.db.Query(`
		SELECT tc.CONSTRAINT_NAME
		FROM information_schema.TABLE_CONSTRAINTS tc
		WHERE tc.TABLE_SCHEMA = DATABASE()
		  AND tc.TABLE_NAME = 'joined_classes'
		  AND tc.CONSTRAINT_TYPE = 'CHECK'
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var constraintName string
			if scanErr := rows.Scan(&constraintName); scanErr != nil {
				continue
			}
			safeName := strings.ReplaceAll(constraintName, "`", "")
			if safeName == "" {
				continue
			}
			_, dropErr := a.db.Exec(fmt.Sprintf("ALTER TABLE joined_classes DROP CHECK `%s`", safeName))
			if dropErr != nil {
				_, _ = a.db.Exec(fmt.Sprintf("ALTER TABLE joined_classes DROP CONSTRAINT `%s`", safeName))
			}
		}
	}

	_, _ = a.db.Exec(`
		ALTER TABLE joined_classes
		ADD CONSTRAINT chk_joined_classes_status
		CHECK (status IN ('join', 'left', 'added', 'removed'))
	`)

	return nil
}

// ==============================================================================
// JOIN CLASS ARCHIVING
// ==============================================================================

func (a *App) ensureStudentArchivedClassesTable() error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureJoinedClassesStatusVocabulary(); err != nil {
		return err
	}

	createQuery := `
		CREATE TABLE IF NOT EXISTS student_archived_classes (
			student_id INT NOT NULL,
			class_id INT NOT NULL,
			archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			CONSTRAINT PK_student_archived_classes PRIMARY KEY (student_id, class_id),
			CONSTRAINT FK_student_archived_classes_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
			CONSTRAINT FK_student_archived_classes_class FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE
		)
	`

	if _, err := a.db.Exec(createQuery); err != nil {
		return err
	}

	return nil
}

// ArchiveJoinedClassByStudent archives a student's joined class in My Classes.
func (a *App) ArchiveJoinedClassByStudent(studentUserID int, classID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureStudentArchivedClassesTable(); err != nil {
		return err
	}

	var joinedClassExists int
	err := a.db.QueryRow(
		`SELECT COUNT(*) FROM joined_classes WHERE student_id = ? AND class_id = ? AND status IN ('join', 'added')`,
		studentUserID, classID,
	).Scan(&joinedClassExists)
	if err != nil {
		return err
	}
	if joinedClassExists == 0 {
		return fmt.Errorf("joined class not found")
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
		`INSERT INTO student_archived_classes (student_id, class_id, archived_at, updated_at)
		 VALUES (?, ?, NOW(), NOW())
		 ON DUPLICATE KEY UPDATE updated_at = NOW()`,
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

	log.Printf("Student archived joined class from My Classes: student_id=%d class_id=%d", studentUserID, classID)
	return nil
}

// RestoreArchivedJoinedClassByStudent restores a student's archived joined class.
func (a *App) RestoreArchivedJoinedClassByStudent(studentUserID int, classID int) error {
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

	log.Printf("Student restored archived joined class to My Classes: student_id=%d class_id=%d", studentUserID, classID)
	return nil
}

// ==============================================================================
// CLASSLIST EXPORT
// ==============================================================================

// buildClasslistPrintableDocument prepares a printableExportDocument and metadata
// for all enrolled students in a class. It is used by the different export
// formats (CSV, PDF, DOCX) so the export logic lives in one place.
func (a *App) buildClasslistPrintableDocument(classID int) (printableExportDocument, string, int, error) {
	if err := a.checkDB(); err != nil {
		return printableExportDocument{}, "", 0, err
	}

	var subjectCode string
	var subjectName, schedule, room, teacherName, semester, schoolYear sql.NullString
	classQuery := `
		SELECT
			c.subject_code,
			s.description,
			c.schedule,
			c.room,
			(CONCAT(t.last_name, ', ', t.first_name)) as teacher_name,
			c.semester,
			c.school_year
		FROM classes c
		JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN teachers t ON c.teacher_id = t.id
		WHERE c.class_id = ?
	`
	err := a.db.QueryRow(classQuery, classID).Scan(&subjectCode, &subjectName, &schedule, &room, &teacherName, &semester, &schoolYear)
	if err != nil {
		log.Printf("Failed to get class info for classlist export: %v", err)
		subjectCode = fmt.Sprintf("class_%d", classID)
		subjectName = sql.NullString{String: "Unknown Subject", Valid: true}
	}

	query := `
		SELECT 
			stu.student_id, stu.first_name, stu.middle_name, stu.last_name,
			stu.email, stu.contact_number
		FROM joined_classes cl
		JOIN students stu ON cl.student_id = stu.id
		WHERE cl.class_id = ?
		  AND cl.status IN ('join', 'added')
		  AND (cl.is_archived = 0 OR cl.is_archived IS NULL)
		ORDER BY stu.last_name, stu.first_name
	`

	rows, err := a.db.Query(query, classID)
	if err != nil {
		return printableExportDocument{}, "", 0, err
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
		if err := rows.Scan(
			&s.StudentID, &s.FirstName, &middleName, &s.LastName,
			&email, &contactNumber,
		); err != nil {
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

	subjectNameValue := ""
	if subjectName.Valid && strings.TrimSpace(subjectName.String) != "" {
		subjectNameValue = subjectName.String
	}
	scheduleValue := ""
	if schedule.Valid && strings.TrimSpace(schedule.String) != "" {
		scheduleValue = schedule.String
	}
	roomValue := ""
	if room.Valid && strings.TrimSpace(room.String) != "" {
		roomValue = room.String
	}
	teacherValue := ""
	if teacherName.Valid && strings.TrimSpace(teacherName.String) != "" {
		teacherValue = teacherName.String
	}
	semesterValue := ""
	if semester.Valid && strings.TrimSpace(semester.String) != "" {
		semesterValue = semester.String
	}
	schoolYearValue := ""
	if schoolYear.Valid && strings.TrimSpace(schoolYear.String) != "" {
		schoolYearValue = schoolYear.String
	}

	var exportRows [][]string
	for index, s := range students {
		middleInitial := ""
		if strings.TrimSpace(s.MiddleName) != "" {
			middleInitial = fmt.Sprintf(" %s.", strings.ToUpper(string(s.MiddleName[0])))
		}
		fullName := fmt.Sprintf("%s, %s%s", s.LastName, s.FirstName, middleInitial)
		email := s.Email
		if strings.TrimSpace(email) == "" {
			email = ""
		}
		contact := s.ContactNumber
		if strings.TrimSpace(contact) == "" {
			contact = ""
		}

		exportRows = append(exportRows, []string{
			fmt.Sprintf("%d", index+1),
			s.StudentID,
			fullName,
			email,
			contact,
		})
	}

	doc := printableExportDocument{
		Title:    "CLASS LIST",
		Subtitle: fmt.Sprintf("School Year %s - %s", schoolYearValue, semesterValue),
		Details: []printableExportField{
			{Label: "Subject Code", Value: subjectCode},
			{Label: "Subject Name", Value: subjectNameValue},
			{Label: "Instructor", Value: teacherValue},
			{Label: "Schedule", Value: scheduleValue},
			{Label: "Room", Value: roomValue},
		},
		TableNote:        "",
		Headers:          []string{"NO.", "STUDENT ID", "NAME", "EMAIL", "CONTACT"},
		Rows:             exportRows,
		Footer:           nil,
		ColumnWidths:     []float64{12, 28, 60, 55, 35},
		ColumnAlignments: []string{"C", "L", "L", "L", "L"},
		Orientation:      "P",
		GeneratedAt:      time.Now(),
	}

	return doc, subjectCode, len(exportRows), nil
}

// ExportClasslistCSV exports the classlist (enrolled students) for a class to CSV.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportClasslistCSV(classID int, savePath string) (string, error) {
	doc, subjectCode, studentCount, err := a.buildClasslistPrintableDocument(classID)
	if err != nil {
		return "", err
	}
	defaultName := fmt.Sprintf("classlist_%s_%s.csv", subjectCode, time.Now().Format("20060102_150405"))
	filename := resolveExportPath(savePath, defaultName)
	if err := writePrintableCSV(filename, doc); err != nil {
		return "", err
	}

	log.Printf("Classlist exported to CSV: %s (%d students)", filename, studentCount)
	return filename, nil
}

// ExportClasslistPDF exports the classlist (enrolled students) for a class to PDF.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportClasslistPDF(classID int, savePath string) (string, error) {
	doc, subjectCode, studentCount, err := a.buildClasslistPrintableDocument(classID)
	if err != nil {
		return "", err
	}
	defaultName := fmt.Sprintf("classlist_%s_%s.pdf", subjectCode, time.Now().Format("20060102_150405"))
	filename := resolveExportPath(savePath, defaultName)
	if err := writePrintablePDF(filename, doc); err != nil {
		return "", err
	}

	log.Printf("Classlist exported to PDF: %s (%d students)", filename, studentCount)
	return filename, nil
}

// ExportClasslistDOCX exports the classlist for a class to DOCX.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportClasslistDOCX(classID int, savePath string) (string, error) {
	doc, subjectCode, studentCount, err := a.buildClasslistPrintableDocument(classID)
	if err != nil {
		return "", err
	}
	data, err := generatePrintableDocx(doc)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("classlist_%s_%s.docx", subjectCode, time.Now().Format("20060102_150405"))
	filename := resolveExportPath(savePath, defaultName)
	if err := os.WriteFile(filename, data, 0644); err != nil {
		return "", fmt.Errorf("failed to write docx: %w", err)
	}
	log.Printf("Classlist exported to DOCX: %s (%d students)", filename, studentCount)
	return filename, nil
}
