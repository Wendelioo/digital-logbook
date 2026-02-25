package main

import (
	"database/sql"
	"fmt"
	"log"
	"time"
)

// ==============================================================================
// CLASS & SUBJECT MANAGEMENT
// ==============================================================================

// GetSubjects returns all subjects
func (a *App) GetSubjects() ([]Subject, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			s.subject_code, s.created_at,
			s.description
		FROM subjects s
		ORDER BY s.subject_code
	`
	rows, err := a.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subjects []Subject
	for rows.Next() {
		var subj Subject
		var description sql.NullString
		var createdAt time.Time
		err := rows.Scan(&subj.Code, &createdAt, &description)
		if err != nil {
			continue
		}
		subj.CreatedAt = createdAt.Format("2006-01-02 15:04:05")
		if description.Valid {
			subj.Description = &description.String
			subj.Name = description.String
		}
		subjects = append(subjects, subj)
	}

	return subjects, nil
}

// CreateSubject creates a new subject (or updates if exists)
// Note: Teacher assignment is now handled at the class level, not subject level
func (a *App) CreateSubject(code, name string, teacherUserID int, description string) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	// Use MERGE to handle existing subjects gracefully
	// Note: teacher_id removed from subjects table - teacher assignment is at class level
	query := `
		MERGE subjects AS target
		USING (SELECT ? AS subject_code, ? AS description) AS source
		ON target.subject_code = source.subject_code
		WHEN MATCHED THEN
			UPDATE SET description = source.description
		WHEN NOT MATCHED THEN
			INSERT (subject_code, description)
			VALUES (source.subject_code, source.description);
	`
	_, err := a.db.Exec(query, code, nullString(name))
	if err != nil {
		log.Printf("Failed to create/update subject: %v", err)
		return err
	}
	log.Printf("Subject created/updated: %s - %s", code, name)
	return nil
}

// ==============================================================================
// CLASS QUERIES
// ==============================================================================

// GetAllClasses returns all active classes
func (a *App) GetAllClasses() ([]CourseClass, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	log.Printf("GetAllClasses: Starting query...")

	query := `
		SELECT 
			c.class_id, c.subject_code, s.description as subject_name, c.descriptive_title, c.edp_code,
			c.teacher_id, (t.last_name + ', ' + t.first_name) as teacher_name,
			c.schedule, c.room, c.semester, c.school_year,
			COALESCE(enrollment_count.count, 0) as enrolled_count,
			c.is_active, c.created_by_user_id
		FROM classes c
		LEFT JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN teachers t ON c.teacher_id = t.id
		LEFT JOIN (
			SELECT class_id, COUNT(*) as count 
			FROM classlist 
			GROUP BY class_id
		) enrollment_count ON c.class_id = enrollment_count.class_id
		WHERE c.is_active = 1 
		ORDER BY c.subject_code
	`
	rows, err := a.db.Query(query)
	if err != nil {
		log.Printf("GetAllClasses: Query failed: %v", err)
		return nil, err
	}
	defer rows.Close()

	log.Printf("GetAllClasses: Query executed successfully, processing rows...")
	classes := make([]CourseClass, 0)
	for rows.Next() {
		var class CourseClass
		var descriptiveTitle, edpCode, schedule, room, semester, schoolYear sql.NullString
		var createdBy sql.NullInt64
		err := rows.Scan(
			&class.ClassID, &class.SubjectCode, &descriptiveTitle, &edpCode,
			&class.TeacherUserID, &class.TeacherName,
			&schedule, &room, &semester, &schoolYear,
			&class.EnrolledCount, &class.IsActive, &createdBy,
		)
		if err != nil {
			continue
		}
		if descriptiveTitle.Valid {
			class.DescriptiveTitle = &descriptiveTitle.String
		}
		if edpCode.Valid {
			class.EdpCode = &edpCode.String
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
		classes = append(classes, class)
	}

	log.Printf("GetAllClasses: Successfully retrieved %d classes", len(classes))
	return classes, nil
}

// GetTeacherClassesByUserID returns all classes for a teacher given their user ID
func (a *App) GetTeacherClassesByUserID(userID int) ([]CourseClass, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	// First get the teacher ID from the user ID
	teacherID, err := a.GetTeacherID(userID)
	if err != nil {
		return nil, fmt.Errorf("teacher not found for user ID %d: %v", userID, err)
	}

	// Then get the classes for that teacher
	return a.GetTeacherClasses(teacherID)
}

// GetTeacherClasses returns all classes for a specific teacher
func (a *App) GetTeacherClasses(teacherID int) ([]CourseClass, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			c.class_id, c.subject_code, s.description as subject_name, c.descriptive_title, c.edp_code,
			c.teacher_id, t.last_name + ', ' + t.first_name as teacher_name,
			c.schedule, c.room, c.semester, c.school_year,
			COALESCE(enrollment_count.count, 0) as enrolled_count,
			c.is_active, c.created_by_user_id
		FROM classes c
		LEFT JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN teachers t ON c.teacher_id = t.id
		LEFT JOIN (
			SELECT class_id, COUNT(*) as count 
			FROM classlist 
			GROUP BY class_id
		) enrollment_count ON c.class_id = enrollment_count.class_id
		WHERE c.teacher_id = ? AND (c.is_archived = 0 OR c.is_archived IS NULL)
		ORDER BY c.subject_code, c.semester, c.school_year
	`
	rows, err := a.db.Query(query, teacherID)
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
		err := rows.Scan(
			&class.ClassID, &class.SubjectCode, &subjectName, &descriptiveTitle, &edpCode,
			&class.TeacherUserID, &teacherName,
			&schedule, &room, &semester, &schoolYear,
			&class.EnrolledCount, &class.IsActive, &createdBy,
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
		classes = append(classes, class)
	}

	return classes, nil
}

// GetTeacherClassesWithAttendance returns classes that have attendance records (active, non-archived)
func (a *App) GetTeacherClassesWithAttendance(userID int) ([]CourseClass, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	// First get the teacher ID from the user ID
	teacherID, err := a.GetTeacherID(userID)
	if err != nil {
		return nil, fmt.Errorf("teacher not found for user ID %d: %v", userID, err)
	}

	log.Printf("GetTeacherClassesWithAttendance: userID=%d, teacherID=%d", userID, teacherID)

	query := `
		SELECT 
			c.class_id, c.subject_code, s.description as subject_name, c.descriptive_title, c.edp_code,
			c.teacher_id, t.last_name + ', ' + t.first_name as teacher_name,
			c.schedule, c.room, c.semester, c.school_year,
			COALESCE(enrollment_count.count, 0) as enrolled_count,
			c.is_active, c.created_by_user_id,
			CONVERT(VARCHAR(10), 
				(SELECT MAX(a.attendance_date) FROM attendance a WHERE a.class_id = c.class_id AND (a.is_archived = 0 OR a.is_archived IS NULL)),
			120) as latest_attendance_date
		FROM classes c
		LEFT JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN teachers t ON c.teacher_id = t.id
		LEFT JOIN (
			SELECT class_id, COUNT(*) as count 
			FROM classlist 
			WHERE status = 'active'
			GROUP BY class_id
		) enrollment_count ON c.class_id = enrollment_count.class_id
		WHERE c.teacher_id = ? AND (c.is_archived = 0 OR c.is_archived IS NULL)
		AND EXISTS (SELECT 1 FROM attendance WHERE attendance.class_id = c.class_id AND (attendance.is_archived = 0 OR attendance.is_archived IS NULL))
		ORDER BY c.subject_code, c.semester, c.school_year
	`
	rows, err := a.db.Query(query, teacherID)
	if err != nil {
		log.Printf("Query error: %v", err)
		return nil, err
	}
	defer rows.Close()

	var classes []CourseClass
	for rows.Next() {
		var class CourseClass
		var subjectName, descriptiveTitle, edpCode, schedule, room, semester, schoolYear sql.NullString
		var teacherName sql.NullString
		var createdBy sql.NullInt64
		var latestDate sql.NullString
		err := rows.Scan(
			&class.ClassID, &class.SubjectCode, &subjectName, &descriptiveTitle, &edpCode,
			&class.TeacherUserID, &teacherName,
			&schedule, &room, &semester, &schoolYear,
			&class.EnrolledCount, &class.IsActive, &createdBy, &latestDate,
		)
		if err != nil {
			log.Printf("Failed to scan class row: %v", err)
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
		if latestDate.Valid {
			class.LatestAttendanceDate = &latestDate.String
		}
		// Compute class status
		class.ClassStatus = a.computeClassStatus(class.IsActive, class.IsArchived)
		classes = append(classes, class)
	}

	log.Printf("GetTeacherClassesWithAttendance: Found %d classes with attendance", len(classes))
	return classes, nil
}

// GetClassesByCreator returns classes created by a specific working student
func (a *App) GetClassesByCreator(createdBy int) ([]CourseClass, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			c.class_id, c.subject_code, c.descriptive_title,
			c.teacher_id, (t.last_name + ', ' + t.first_name) as teacher_name,
			c.schedule, c.room, c.semester, c.school_year,
			COALESCE(enrollment_count.count, 0) as enrolled_count,
			c.is_active, c.created_by_user_id
		FROM classes c
		LEFT JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN teachers t ON c.teacher_id = t.id
		LEFT JOIN (
			SELECT class_id, COUNT(*) as count 
			FROM classlist 
			GROUP BY class_id
		) enrollment_count ON c.class_id = enrollment_count.class_id
		WHERE c.is_active = 1 AND c.created_by_user_id = ?
		ORDER BY c.subject_code
	`
	rows, err := a.db.Query(query, createdBy)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var classes []CourseClass
	for rows.Next() {
		var class CourseClass
		var descriptiveTitle, schedule, room, semester, schoolYear sql.NullString
		var createdByField sql.NullInt64
		err := rows.Scan(
			&class.ClassID, &class.SubjectCode, &descriptiveTitle,
			&class.TeacherUserID, &class.TeacherName,
			&schedule, &room, &semester, &schoolYear,
			&class.EnrolledCount, &class.IsActive, &createdByField,
		)
		if err != nil {
			continue
		}
		if descriptiveTitle.Valid {
			class.DescriptiveTitle = &descriptiveTitle.String
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
		if createdByField.Valid {
			createdByInt := int(createdByField.Int64)
			class.CreatedByUserID = &createdByInt
		}
		classes = append(classes, class)
	}

	return classes, nil
}

// GetStudentClasses returns all classes a student is enrolled in
func (a *App) GetStudentClasses(studentUserID int) ([]CourseClass, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}
	if err := a.ensureStudentArchivedClassesTable(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			c.class_id, c.subject_code, s.description as subject_name, c.descriptive_title, c.edp_code,
			c.teacher_id, (t.last_name + ', ' + t.first_name) as teacher_name,
			c.schedule, c.room, c.semester, c.school_year,
			COALESCE(enrollment_count.count, 0) as enrolled_count,
			c.is_active, c.created_by_user_id, c.created_at
		FROM classlist cl
		JOIN classes c ON cl.class_id = c.class_id
		LEFT JOIN student_archived_classes sac ON sac.student_id = cl.student_id AND sac.class_id = cl.class_id
		LEFT JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN teachers t ON c.teacher_id = t.id
		LEFT JOIN (
			SELECT class_id, COUNT(*) as count 
			FROM classlist 
			WHERE status = 'active'
			GROUP BY class_id
		) enrollment_count ON c.class_id = enrollment_count.class_id
		WHERE cl.student_id = ?
		  AND cl.status = 'active'
		  AND c.is_active = 1
		  AND COALESCE(c.is_archived, 0) = 0
		  AND sac.class_id IS NULL
		ORDER BY c.subject_code
	`
	rows, err := a.db.Query(query, studentUserID)
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

// ==============================================================================
// CLASS CRUD OPERATIONS
// ==============================================================================

// CreateClass creates a new class instance (by working student)
// If a class with the same EDP code exists and is archived, it will be reactivated
// If a class with the same EDP code exists and is NOT archived, it will return an error
func (a *App) CreateClass(subjectCode string, teacherUserID int, edpCode, schedule, room, section, semester, schoolYear, descriptiveTitle string, createdBy int) (int, error) {
	if err := a.checkDB(); err != nil {
		return 0, err
	}

	// Check if a class with the same EDP code already exists (only if edpCode is provided)
	if edpCode != "" {
		var existingClassID int
		var isArchived bool
		var isActive bool
		checkQuery := `
			SELECT class_id, is_archived, is_active 
			FROM classes 
			WHERE edp_code = ?
		`
		err := a.db.QueryRow(checkQuery, edpCode).Scan(&existingClassID, &isArchived, &isActive)
		if err == nil {
			// Class with this EDP code exists
			if !isArchived && isActive {
				// Class is active and not archived - this is a duplicate
				log.Printf("Class with EDP code %s already exists and is active (class_id=%d)", edpCode, existingClassID)
				return 0, fmt.Errorf("a class with EDP code '%s' already exists", edpCode)
			}

			// Class exists but is archived or inactive - reactivate and update it
			log.Printf("Reactivating archived/inactive class with EDP code %s (class_id=%d)", edpCode, existingClassID)

			updateQuery := `
				UPDATE classes 
				SET subject_code = ?, 
				    teacher_id = ?, 
				    schedule = ?, 
				    room = ?, 
				    semester = ?, 
				    school_year = ?, 
				    descriptive_title = ?,
				    is_active = 1,
				    is_archived = 0,
				    updated_at = CURRENT_TIMESTAMP
				WHERE class_id = ?
			`
			_, err = a.db.Exec(
				updateQuery,
				subjectCode, teacherUserID,
				nullString(schedule), nullString(room),
				nullString(semester), nullString(schoolYear),
				nullString(descriptiveTitle),
				existingClassID,
			)
			if err != nil {
				log.Printf("Failed to reactivate class: %v", err)
				return 0, err
			}

			log.Printf("Class reactivated: class_id=%d, edp_code=%s", existingClassID, edpCode)
			return existingClassID, nil
		}
		// If error is sql.ErrNoRows, class doesn't exist, proceed with creation
	}

	// No existing class found, create a new one
	query := `
		INSERT INTO classes (subject_code, teacher_id, edp_code, schedule, room, semester, school_year, descriptive_title, created_by_user_id, is_active)
		OUTPUT INSERTED.class_id
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
	`
	// Handle created_by_user_id
	var createdByValue interface{}
	if createdBy == 0 {
		createdByValue = nil
	} else {
		createdByValue = createdBy
	}

	var classID int64
	err := a.db.QueryRow(
		query,
		subjectCode, teacherUserID,
		nullString(edpCode),
		nullString(schedule), nullString(room),
		nullString(semester), nullString(schoolYear),
		nullString(descriptiveTitle),
		createdByValue,
	).Scan(&classID)
	if err != nil {
		log.Printf("Failed to create class: %v", err)
		return 0, err
	}

	log.Printf("Class created: class_id=%d, subject_code=%s, teacher_id=%d", classID, subjectCode, teacherUserID)
	return int(classID), nil
}

// UpdateClass updates a class
func (a *App) UpdateClass(classID int, schedule, room, section, semester, schoolYear string, isActive bool) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	query := `
		UPDATE classes 
		SET schedule = ?, room = ?, section = ?, semester = ?, school_year = ?, is_active = ?
		WHERE class_id = ?
	`
	_, err := a.db.Exec(
		query,
		nullString(schedule), nullString(room),
		nullString(section),
		nullString(semester), nullString(schoolYear),
		isActive, classID,
	)
	if err != nil {
		log.Printf("Failed to update class: %v", err)
		return err
	}

	log.Printf("Class updated: class_id=%d", classID)
	return nil
}

// DeleteClass soft-deletes a class by setting is_active to false (Close Class)
// Rule: No hard deletes. This is equivalent to "Close Class".
func (a *App) DeleteClass(classID int) error {
	return a.CloseClass(classID)
}

// CloseClass closes a class (ACTIVE → CLOSED).
// A closed class can no longer accept new enrollments or attendance.
// Students remain enrolled but no new attendance records are created.
func (a *App) CloseClass(classID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	// Check class exists and is active
	var isActive bool
	err := a.db.QueryRow(`SELECT is_active FROM classes WHERE class_id = ?`, classID).Scan(&isActive)
	if err != nil {
		return fmt.Errorf("class not found")
	}
	if !isActive {
		return fmt.Errorf("class is already closed")
	}

	query := `UPDATE classes SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE class_id = ?`
	_, err = a.db.Exec(query, classID)
	if err != nil {
		log.Printf("Failed to close class: %v", err)
		return err
	}

	log.Printf("Class closed: class_id=%d", classID)
	return nil
}

// ReopenClass reopens a previously closed class (CLOSED → ACTIVE)
func (a *App) ReopenClass(classID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	// Check class exists and is not archived
	var isActive bool
	var isArchived bool
	err := a.db.QueryRow(`SELECT is_active, COALESCE(is_archived, 0) FROM classes WHERE class_id = ?`, classID).Scan(&isActive, &isArchived)
	if err != nil {
		return fmt.Errorf("class not found")
	}
	if isActive {
		return fmt.Errorf("class is already active")
	}
	if isArchived {
		return fmt.Errorf("archived classes cannot be reopened. Unarchive first")
	}

	query := `UPDATE classes SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE class_id = ?`
	_, err = a.db.Exec(query, classID)
	if err != nil {
		log.Printf("Failed to reopen class: %v", err)
		return err
	}

	log.Printf("Class reopened: class_id=%d", classID)
	return nil
}

// computeClassStatus returns the human-readable class status string
func (a *App) computeClassStatus(isActive bool, isArchived bool) string {
	if isArchived {
		return "ARCHIVED"
	}
	if !isActive {
		return "CLOSED"
	}
	return "ACTIVE"
}

// ==============================================================================
// ENROLLMENT MANAGEMENT
// ==============================================================================

// GetClassStudents returns students enrolled in a specific class
func (a *App) GetClassStudents(classID int) ([]ClasslistEntry, error) {
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
		WHERE cl.class_id = ? 
		  AND cl.status = 'active'
		  AND (
			COALESCE(c.is_archived, 0) = 1
			OR cl.is_archived = 0
			OR cl.is_archived IS NULL
		  )
		ORDER BY stu.last_name, stu.first_name
	`

	rows, err := a.db.Query(query, classID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	students := make([]ClasslistEntry, 0)
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

// GetClassByID returns a class by ID (including archived classes)
func (a *App) GetClassByID(classID int) (*CourseClass, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT TOP 1
			c.class_id, c.subject_code, s.description as subject_name, c.descriptive_title, c.edp_code,
			c.teacher_id, (t.last_name + ', ' + t.first_name) as teacher_name,
			c.schedule, c.room, c.semester, c.school_year,
			COALESCE(enrollment_count.count, 0) as enrolled_count,
			c.is_active, c.is_archived, c.created_by_user_id
		FROM classes c
		LEFT JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN teachers t ON c.teacher_id = t.id
		LEFT JOIN (
			SELECT class_id, COUNT(*) as count 
			FROM classlist 
			WHERE status = 'active'
			GROUP BY class_id
		) enrollment_count ON c.class_id = enrollment_count.class_id
		WHERE c.class_id = ?
	`

	var class CourseClass
	var subjectName, descriptiveTitle, edpCode, schedule, room, semester, schoolYear sql.NullString
	var teacherName sql.NullString
	var createdBy sql.NullInt64

	err := a.db.QueryRow(query, classID).Scan(
		&class.ClassID, &class.SubjectCode, &subjectName, &descriptiveTitle, &edpCode,
		&class.TeacherUserID, &teacherName,
		&schedule, &room, &semester, &schoolYear,
		&class.EnrolledCount, &class.IsActive, &class.IsArchived, &createdBy,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("class not found")
	}
	if err != nil {
		log.Printf("Failed to get class by ID: %v", err)
		return nil, err
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

	log.Printf("Retrieved class: ID=%d, Subject=%s, Active=%t, Archived=%t", class.ClassID, class.SubjectCode, class.IsActive, class.IsArchived)
	return &class, nil
}

// ==============================================================================
// HELPER FUNCTIONS
// ==============================================================================

// GetTeacherID returns the teacher user_id for a given user ID (now just returns the user_id since there's no separate id)
func (a *App) GetTeacherID(userID int) (int, error) {
	if err := a.checkDB(); err != nil {
		return 0, err
	}

	// Since teachers table now uses id as PK, we just return the userID
	// But first verify the user is actually a teacher
	var exists int
	query := `SELECT 1 FROM teachers WHERE id = ?`
	err := a.db.QueryRow(query, userID).Scan(&exists)
	if err != nil {
		return 0, err
	}
	return userID, nil
}

// GetWorkingStudentID returns the working student user_id for a given user ID
func (a *App) GetWorkingStudentID(userID int) (int, error) {
	if err := a.checkDB(); err != nil {
		return 0, err
	}

	// Verify the user is actually a working student (students table with is_working_student = 1)
	var exists int
	query := `SELECT 1 FROM students WHERE id = ? AND is_working_student = 1`
	err := a.db.QueryRow(query, userID).Scan(&exists)
	if err != nil {
		return 0, err
	}
	return userID, nil
}

// GetAllTeachers returns all teachers for assignment purposes
func (a *App) GetAllTeachers() ([]User, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			t.id, t.id as id, t.teacher_id, t.first_name, t.middle_name, t.last_name
		FROM teachers t
		ORDER BY t.last_name, t.first_name
	`

	rows, err := a.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teachers []User
	for rows.Next() {
		var teacher User
		var middleName, employeeID sql.NullString
		var teachersTableID int
		err := rows.Scan(&teacher.ID, &teachersTableID, &employeeID, &teacher.FirstName, &middleName, &teacher.LastName)
		if err != nil {
			continue
		}
		if middleName.Valid {
			teacher.MiddleName = &middleName.String
		}
		if employeeID.Valid {
			teacher.EmployeeID = &employeeID.String
		}
		teacher.Role = "teacher"
		teachers = append(teachers, teacher)
	}

	return teachers, nil
}

// GetAllRegisteredStudents returns all registered students
func (a *App) GetAllRegisteredStudents() ([]ClassStudent, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	// Base query that gets all students with photo data from profile_photos table
	query := `
		SELECT 
			s.id as id, s.student_id, s.first_name, s.middle_name, s.last_name, 
			s.email, s.contact_number, pp.photo_data
		FROM students s
		LEFT JOIN profile_photos pp ON s.id = pp.user_id
		ORDER BY s.last_name, s.first_name
	`

	rows, err := a.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var students []ClassStudent
	for rows.Next() {
		var student ClassStudent
		var middleName, email, contactNumber, photoData sql.NullString
		err := rows.Scan(&student.ID, &student.StudentID, &student.FirstName, &middleName,
			&student.LastName, &email, &contactNumber, &photoData)
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
		if photoData.Valid {
			student.PhotoURL = &photoData.String
		}
		students = append(students, student)
	}

	return students, nil
}

// GetAvailableSections returns all unique sections from students and working_students tables
// Note: section column no longer exists in the schema, returning empty array
func (a *App) GetAvailableSections() ([]string, error) {
	return []string{}, nil
}

// ==============================================================================
// CLASS ACTIVE/INACTIVE TOGGLE
// ==============================================================================

// SetClassActiveStatus sets the is_active status of a class
func (a *App) SetClassActiveStatus(classID int, isActive bool) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	query := `
		UPDATE classes 
		SET is_active = ?,
		    updated_at = CURRENT_TIMESTAMP
		WHERE class_id = ?
	`

	result, err := a.db.Exec(query, isActive, classID)
	if err != nil {
		log.Printf("Failed to update class active status: %v", err)
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("Updated class active status: class_id=%d, is_active=%v, affected=%d", classID, isActive, rowsAffected)
	return nil
}

// DeactivateClass marks a class as inactive (semester/course ended)
func (a *App) DeactivateClass(classID int) error {
	return a.SetClassActiveStatus(classID, false)
}

// ActivateClass marks a class as active
func (a *App) ActivateClass(classID int) error {
	return a.SetClassActiveStatus(classID, true)
}
