package backend

import (
	"database/sql"
	"fmt"
	"log"
	"time"
)

// ==============================================================================
// CLASS & SUBJECT MANAGEMENT
// ==============================================================================

// CreateSubject creates a new subject (or updates if exists)
// Note: Teacher assignment is now handled at the class level, not subject level
func (a *App) CreateSubject(code, name string, teacherUserID int, description string) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	// Upsert subject for MySQL.
	query := `
		INSERT INTO subjects (subject_code, description)
		VALUES (?, ?)
		ON DUPLICATE KEY UPDATE description = VALUES(description)
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
			c.teacher_id, CONCAT(t.last_name, ', ', t.first_name) as teacher_name,
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
			c.teacher_id, CONCAT(t.last_name, ', ', t.first_name) as teacher_name,
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
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
	`
	// Handle created_by_user_id
	var createdByValue interface{}
	if createdBy == 0 {
		createdByValue = nil
	} else {
		createdByValue = createdBy
	}

	result, err := a.db.Exec(
		query,
		subjectCode, teacherUserID,
		nullString(edpCode),
		nullString(schedule), nullString(room),
		nullString(semester), nullString(schoolYear),
		nullString(descriptiveTitle),
		createdByValue,
	)
	if err != nil {
		log.Printf("Failed to create class: %v", err)
		return 0, err
	}

	classID, err := result.LastInsertId()
	if err != nil {
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
		SELECT c.class_id, c.subject_code, s.description as subject_name, c.descriptive_title, c.edp_code,
			c.teacher_id, CONCAT(t.last_name, ', ', t.first_name) as teacher_name,
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

// GetAllRegisteredStudents returns all registered students.
// NOTE: This endpoint is safe to expose to working students because it deliberately omits
// sensitive identifiers such as email, contact number, and internal student ID.
func (a *App) GetAllRegisteredStudents() ([]ClassStudent, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	// This query intentionally excludes email and contact_number for privacy.
	query := `
		SELECT 
			s.id as id, s.student_id, s.first_name, s.middle_name, s.last_name, 
			NULL as email, NULL as contact_number, pp.photo_data
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

