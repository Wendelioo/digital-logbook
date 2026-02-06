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
// CLASS & SUBJECT MANAGEMENT
// ==============================================================================

// GetSubjects returns all subjects
func (a *App) GetSubjects() ([]Subject, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
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
		var teacherName, description sql.NullString
		var createdAt time.Time
		err := rows.Scan(&subj.Code, &subj.Name, &subj.TeacherUserID, &createdAt, &teacherName, &description)
		if err != nil {
			continue
		}
		subj.CreatedAt = createdAt.Format("2006-01-02 15:04:05")
		if teacherName.Valid {
			subj.TeacherName = &teacherName.String
		}
		if description.Valid {
			subj.Description = &description.String
		}
		subjects = append(subjects, subj)
	}

	return subjects, nil
}

// CreateSubject creates a new subject (or updates if exists)
// Note: Teacher assignment is now handled at the class level, not subject level
func (a *App) CreateSubject(code, name string, teacherUserID int, description string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Use INSERT ... ON DUPLICATE KEY UPDATE to handle existing subjects gracefully
	// Note: teacher_id removed from subjects table - teacher assignment is at class level
	query := `
		INSERT INTO subjects (subject_code, description) 
		VALUES (?, ?)
		ON DUPLICATE KEY UPDATE 
			description = VALUES(description)
	`
	_, err := a.db.Exec(query, code, nullString(name))
	if err != nil {
		log.Printf("⚠ Failed to create/update subject: %v", err)
		return err
	}
	log.Printf("✓ Subject created/updated: %s - %s", code, name)
	return nil
}

// ==============================================================================
// CLASS QUERIES
// ==============================================================================

// GetAllClasses returns all active classes
func (a *App) GetAllClasses() ([]CourseClass, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	log.Printf("🔍 GetAllClasses: Starting query...")

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
		WHERE c.is_active = TRUE 
		ORDER BY c.subject_code
	`
	rows, err := a.db.Query(query)
	if err != nil {
		log.Printf("❌ GetAllClasses: Query failed: %v", err)
		return nil, err
	}
	defer rows.Close()

	log.Printf("🔍 GetAllClasses: Query executed successfully, processing rows...")
	var classes []CourseClass
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

	log.Printf("✅ GetAllClasses: Successfully retrieved %d classes", len(classes))
	return classes, nil
}

// GetTeacherClassesByUserID returns all classes for a teacher given their user ID
func (a *App) GetTeacherClassesByUserID(userID int) ([]CourseClass, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
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
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
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
		WHERE c.teacher_id = ? AND c.is_active = TRUE AND (c.is_archived = FALSE OR c.is_archived IS NULL)
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

// GetTeacherClassesWithAttendance returns only classes that have attendance records initialized
func (a *App) GetTeacherClassesWithAttendance(userID int) ([]CourseClass, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	// First get the teacher ID from the user ID
	teacherID, err := a.GetTeacherID(userID)
	if err != nil {
		return nil, fmt.Errorf("teacher not found for user ID %d: %v", userID, err)
	}

	log.Printf("🔍 GetTeacherClassesWithAttendance: userID=%d, teacherID=%d", userID, teacherID)

	query := `
		SELECT 
			c.class_id, c.subject_code, s.description as subject_name, c.descriptive_title, c.edp_code,
			c.teacher_id, CONCAT(t.last_name, ', ', t.first_name) as teacher_name,
			c.schedule, c.room, c.semester, c.school_year,
			COALESCE(enrollment_count.count, 0) as enrolled_count,
			c.is_active, c.created_by_user_id,
			DATE_FORMAT(
				(SELECT MAX(a.date) FROM attendance a WHERE a.class_id = c.class_id AND (a.is_archived = FALSE OR a.is_archived IS NULL)),
			'%Y-%m-%d') as latest_attendance_date,
			COALESCE(
				(SELECT MAX(a.is_finalized) FROM attendance a WHERE a.class_id = c.class_id AND (a.is_archived = FALSE OR a.is_archived IS NULL) 
				 AND a.date = (SELECT MAX(a2.date) FROM attendance a2 WHERE a2.class_id = c.class_id AND (a2.is_archived = FALSE OR a2.is_archived IS NULL))),
				FALSE
			) as is_attendance_finalized
		FROM classes c
		LEFT JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN teachers t ON c.teacher_id = t.id
		LEFT JOIN (
			SELECT class_id, COUNT(*) as count 
			FROM classlist 
			GROUP BY class_id
		) enrollment_count ON c.class_id = enrollment_count.class_id
		WHERE c.teacher_id = ? AND c.is_active = TRUE 
		AND EXISTS (SELECT 1 FROM attendance WHERE attendance.class_id = c.class_id AND (attendance.is_archived = FALSE OR attendance.is_archived IS NULL))
		ORDER BY c.subject_code, c.semester, c.school_year
	`
	rows, err := a.db.Query(query, teacherID)
	if err != nil {
		log.Printf("⚠ Query error: %v", err)
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
		var isAttendanceFinalized bool
		err := rows.Scan(
			&class.ClassID, &class.SubjectCode, &subjectName, &descriptiveTitle, &edpCode,
			&class.TeacherUserID, &teacherName,
			&schedule, &room, &semester, &schoolYear,
			&class.EnrolledCount, &class.IsActive, &createdBy, &latestDate, &isAttendanceFinalized,
		)
		if err != nil {
			log.Printf("⚠ Failed to scan class row: %v", err)
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
		class.IsAttendanceFinalized = isAttendanceFinalized
		classes = append(classes, class)
	}

	log.Printf("✓ GetTeacherClassesWithAttendance: Found %d classes with attendance", len(classes))
	return classes, nil
}

// GetClassesByCreator returns classes created by a specific working student
func (a *App) GetClassesByCreator(createdBy int) ([]CourseClass, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			c.class_id, c.subject_code, c.descriptive_title,
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
		WHERE c.is_active = TRUE AND c.created_by_user_id = ?
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
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
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
		LEFT JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN teachers t ON c.teacher_id = t.id
		LEFT JOIN (
			SELECT class_id, COUNT(*) as count 
			FROM classlist 
			WHERE status = 'active'
			GROUP BY class_id
		) enrollment_count ON c.class_id = enrollment_count.class_id
		WHERE cl.student_id = ? AND cl.status = 'active' AND c.is_active = TRUE AND cl.is_archived = FALSE
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
func (a *App) CreateClass(subjectCode string, teacherUserID int, edpCode, schedule, room, yearLevel, section, semester, schoolYear, descriptiveTitle string, createdBy int) (int, error) {
	if a.db == nil {
		return 0, fmt.Errorf("database not connected")
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
				log.Printf("⚠ Class with EDP code %s already exists and is active (class_id=%d)", edpCode, existingClassID)
				return 0, fmt.Errorf("a class with EDP code '%s' already exists", edpCode)
			}

			// Class exists but is archived or inactive - reactivate and update it
			log.Printf("ℹ Reactivating archived/inactive class with EDP code %s (class_id=%d)", edpCode, existingClassID)

			updateQuery := `
				UPDATE classes 
				SET subject_code = ?, 
				    teacher_id = ?, 
				    schedule = ?, 
				    room = ?, 
				    semester = ?, 
				    school_year = ?, 
				    descriptive_title = ?,
				    is_active = TRUE,
				    is_archived = FALSE,
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
				log.Printf("⚠ Failed to reactivate class: %v", err)
				return 0, err
			}

			log.Printf("✓ Class reactivated: class_id=%d, edp_code=%s", existingClassID, edpCode)
			return existingClassID, nil
		}
		// If error is sql.ErrNoRows, class doesn't exist, proceed with creation
	}

	// No existing class found, create a new one
	query := `
		INSERT INTO classes (subject_code, teacher_id, edp_code, schedule, room, semester, school_year, descriptive_title, created_by_user_id, is_active)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
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
		log.Printf("⚠ Failed to create class: %v", err)
		return 0, err
	}

	classID, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}

	log.Printf("✓ Class created: class_id=%d, subject_code=%s, teacher_id=%d", classID, subjectCode, teacherUserID)
	return int(classID), nil
}

// UpdateClass updates a class
func (a *App) UpdateClass(classID int, schedule, room, yearLevel, section, semester, schoolYear string, isActive bool) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	query := `
		UPDATE classes 
		SET schedule = ?, room = ?, year_level = ?, section = ?, semester = ?, school_year = ?, is_active = ?
		WHERE class_id = ?
	`
	_, err := a.db.Exec(
		query,
		nullString(schedule), nullString(room),
		nullString(yearLevel), nullString(section),
		nullString(semester), nullString(schoolYear),
		isActive, classID,
	)
	if err != nil {
		log.Printf("⚠ Failed to update class: %v", err)
		return err
	}

	log.Printf("✓ Class updated: class_id=%d", classID)
	return nil
}

// DeleteClass soft-deletes a class by setting is_active to false
func (a *App) DeleteClass(classID int) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	query := `UPDATE classes SET is_active = FALSE WHERE class_id = ?`
	_, err := a.db.Exec(query, classID)
	if err != nil {
		log.Printf("⚠ Failed to delete class: %v", err)
		return err
	}

	log.Printf("✓ Class deactivated: class_id=%d", classID)
	return nil
}

// ==============================================================================
// ENROLLMENT MANAGEMENT
// ==============================================================================

// GetClassStudents returns students enrolled in a specific class
func (a *App) GetClassStudents(classID int) ([]ClasslistEntry, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
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
		WHERE cl.class_id = ? AND cl.status = 'active' AND (cl.is_archived = FALSE OR cl.is_archived IS NULL)
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

// GetAvailableStudents returns students not enrolled in a specific class
func (a *App) GetAvailableStudents(classID int) ([]ClassStudent, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			s.id as id, s.student_id, s.first_name, s.middle_name, s.last_name,
			EXISTS(
				SELECT 1 FROM classlist cl 
				WHERE cl.student_id = s.id AND cl.class_id = ? AND cl.status = 'active' AND (cl.is_archived = FALSE OR cl.is_archived IS NULL)
			) as is_enrolled
		FROM students s
		WHERE NOT EXISTS (
			SELECT 1 FROM classlist cl 
			WHERE cl.student_id = s.id AND cl.class_id = ? AND cl.status = 'active' AND (cl.is_archived = FALSE OR cl.is_archived IS NULL)
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
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			s.id as id, s.student_id, s.first_name, s.middle_name, s.last_name,
			EXISTS(
				SELECT 1 FROM classlist cl 
				WHERE cl.student_id = s.id AND cl.class_id = ? AND cl.status = 'active' AND (cl.is_archived = FALSE OR cl.is_archived IS NULL)
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
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	query := `
		INSERT INTO classlist (class_id, student_id, enrollment_date, status, is_archived)
		VALUES (?, ?, CURDATE(), 'active', FALSE)
		ON DUPLICATE KEY UPDATE status = 'active', is_archived = FALSE, updated_at = CURRENT_TIMESTAMP
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
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT INTO classlist (class_id, student_id, enrollment_date, status, is_archived)
		VALUES (?, ?, CURDATE(), 'active', FALSE)
		ON DUPLICATE KEY UPDATE status = 'active', is_archived = FALSE, updated_at = CURRENT_TIMESTAMP
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
	if a.db == nil {
		return fmt.Errorf("database not connected")
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
	if a.db == nil {
		return fmt.Errorf("database not connected")
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
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
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
			c.teacher_id, CONCAT(t.last_name, ', ', t.first_name) as teacher_name,
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
		WHERE c.edp_code = ? AND c.is_active = TRUE
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
	if a.db == nil {
		return 0, fmt.Errorf("database not connected")
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
		checkQuery := `SELECT 1 FROM classlist WHERE class_id = ? AND student_id = ? AND status = 'active' AND (is_archived = FALSE OR is_archived IS NULL)`
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
// HELPER FUNCTIONS
// ==============================================================================

// GetTeacherID returns the teacher user_id for a given user ID (now just returns the user_id since there's no separate id)
func (a *App) GetTeacherID(userID int) (int, error) {
	if a.db == nil {
		return 0, fmt.Errorf("database not connected")
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
	if a.db == nil {
		return 0, fmt.Errorf("database not connected")
	}

	// Verify the user is actually a working student (students table with is_working_student = TRUE)
	var exists int
	query := `SELECT 1 FROM students WHERE id = ? AND is_working_student = TRUE`
	err := a.db.QueryRow(query, userID).Scan(&exists)
	if err != nil {
		return 0, err
	}
	return userID, nil
}

// GetAllTeachers returns all teachers for assignment purposes
func (a *App) GetAllTeachers() ([]User, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
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

// GetAllRegisteredStudents returns all registered students with optional year level filter
func (a *App) GetAllRegisteredStudents(yearLevelFilter, sectionFilter string) ([]ClassStudent, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	// Base query that gets all students with photo paths from profile_photos table
	query := `
		SELECT 
			s.id as id, s.student_id, s.first_name, s.middle_name, s.last_name, 
			s.email, s.contact_number, pp.photo_path
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
		var middleName, email, contactNumber, photoPath sql.NullString
		err := rows.Scan(&student.ID, &student.StudentID, &student.FirstName, &middleName,
			&student.LastName, &email, &contactNumber, &photoPath)
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
		if photoPath.Valid {
			student.PhotoPath = &photoPath.String
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
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	query := `
		UPDATE classes 
		SET is_active = ?,
		    updated_at = CURRENT_TIMESTAMP
		WHERE class_id = ?
	`

	result, err := a.db.Exec(query, isActive, classID)
	if err != nil {
		log.Printf("⚠ Failed to update class active status: %v", err)
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("✓ Updated class active status: class_id=%d, is_active=%v, affected=%d", classID, isActive, rowsAffected)
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

// GetInactiveClasses returns all inactive (but not archived) classes for a teacher
func (a *App) GetInactiveClasses(teacherUserID int) ([]CourseClass, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			c.class_id, c.subject_code, s.description as subject_name, c.descriptive_title, c.edp_code,
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
		WHERE c.teacher_id = ? AND c.is_active = FALSE AND (c.is_archived = FALSE OR c.is_archived IS NULL)
		ORDER BY c.school_year DESC, c.semester DESC, s.subject_code
	`

	rows, err := a.db.Query(query, teacherUserID)
	if err != nil {
		log.Printf("⚠ Failed to query inactive classes: %v", err)
		return nil, err
	}
	defer rows.Close()

	var classes []CourseClass
	for rows.Next() {
		var cls CourseClass
		var subjectName, descriptiveTitle, edpCode, teacherName, schedule, room, semester, schoolYear sql.NullString
		var isArchived sql.NullBool
		var createdByUserID sql.NullInt64

		err := rows.Scan(
			&cls.ClassID, &cls.SubjectCode, &subjectName, &descriptiveTitle, &edpCode,
			&cls.TeacherUserID, &teacherName,
			&schedule, &room, &semester, &schoolYear,
			&cls.EnrolledCount, &cls.IsActive, &isArchived, &createdByUserID,
		)
		if err != nil {
			log.Printf("⚠ Error scanning inactive class: %v", err)
			continue
		}

		if subjectName.Valid {
			cls.SubjectName = subjectName.String
		}
		if descriptiveTitle.Valid {
			cls.DescriptiveTitle = &descriptiveTitle.String
		}
		if edpCode.Valid {
			cls.EdpCode = &edpCode.String
		}
		if teacherName.Valid {
			cls.TeacherName = &teacherName.String
		}
		if schedule.Valid {
			cls.Schedule = &schedule.String
		}
		if room.Valid {
			cls.Room = &room.String
		}
		if semester.Valid {
			cls.Semester = &semester.String
		}
		if schoolYear.Valid {
			cls.SchoolYear = &schoolYear.String
		}
		if isArchived.Valid {
			cls.IsArchived = isArchived.Bool
		}
		if createdByUserID.Valid {
			id := int(createdByUserID.Int64)
			cls.CreatedByUserID = &id
		}

		classes = append(classes, cls)
	}

	return classes, nil
}

// ==============================================================================
// CLASS ARCHIVING
// ==============================================================================

// ArchiveClass marks a class as archived
func (a *App) ArchiveClass(classID int) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	query := `
		UPDATE classes 
		SET is_archived = TRUE,
		    updated_at = CURRENT_TIMESTAMP
		WHERE class_id = ?
	`

	result, err := a.db.Exec(query, classID)
	if err != nil {
		log.Printf("⚠ Failed to archive class: %v", err)
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("✓ Archived class: class_id=%d, affected=%d", classID, rowsAffected)
	return nil
}

// UnarchiveClass removes the archived flag from a class
func (a *App) UnarchiveClass(classID int) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	query := `
		UPDATE classes 
		SET is_archived = FALSE,
		    updated_at = CURRENT_TIMESTAMP
		WHERE class_id = ?
	`

	result, err := a.db.Exec(query, classID)
	if err != nil {
		log.Printf("⚠ Failed to unarchive class: %v", err)
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("✓ Unarchived class: class_id=%d, affected=%d", classID, rowsAffected)
	return nil
}

// GetArchivedClasses returns all archived classes for a teacher
func (a *App) GetArchivedClasses(teacherUserID int) ([]CourseClass, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			c.class_id, c.subject_code, s.description as subject_name, c.descriptive_title, c.edp_code,
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
		WHERE c.teacher_id = ? AND c.is_archived = TRUE
		ORDER BY c.school_year DESC, c.semester DESC, s.subject_code
	`

	rows, err := a.db.Query(query, teacherUserID)
	if err != nil {
		log.Printf("⚠ Failed to query archived classes: %v", err)
		return nil, err
	}
	defer rows.Close()

	var classes []CourseClass
	for rows.Next() {
		var cls CourseClass
		var subjectName, descriptiveTitle, edpCode, teacherName, schedule, room, semester, schoolYear sql.NullString
		var createdByUserID sql.NullInt64

		err := rows.Scan(
			&cls.ClassID, &cls.SubjectCode, &subjectName, &descriptiveTitle, &edpCode,
			&cls.TeacherUserID, &teacherName,
			&schedule, &room, &semester, &schoolYear,
			&cls.EnrolledCount, &cls.IsActive, &cls.IsArchived, &createdByUserID,
		)
		if err != nil {
			log.Printf("⚠ Failed to scan archived class: %v", err)
			continue
		}

		if subjectName.Valid {
			cls.SubjectName = subjectName.String
		}
		if descriptiveTitle.Valid {
			dt := descriptiveTitle.String
			cls.DescriptiveTitle = &dt
		}
		if edpCode.Valid {
			oc := edpCode.String
			cls.EdpCode = &oc
		}
		if teacherName.Valid {
			tn := teacherName.String
			cls.TeacherName = &tn
		}
		if schedule.Valid {
			s := schedule.String
			cls.Schedule = &s
		}
		if room.Valid {
			r := room.String
			cls.Room = &r
		}
		if semester.Valid {
			sem := semester.String
			cls.Semester = &sem
		}
		if schoolYear.Valid {
			sy := schoolYear.String
			cls.SchoolYear = &sy
		}
		if createdByUserID.Valid {
			id := int(createdByUserID.Int64)
			cls.CreatedByUserID = &id
		}

		classes = append(classes, cls)
	}

	return classes, nil
}

// GetStudentArchivedClasses returns all archived classes a student was enrolled in
func (a *App) GetStudentArchivedClasses(studentUserID int) ([]CourseClass, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			c.class_id, c.subject_code, s.description as subject_name, c.descriptive_title, c.edp_code,
			c.teacher_id, CONCAT(t.last_name, ', ', t.first_name) as teacher_name,
			c.schedule, c.room, c.semester, c.school_year,
			COALESCE(enrollment_count.count, 0) as enrolled_count,
			c.is_active, c.is_archived, c.created_by_user_id, c.created_at
		FROM classlist cl
		JOIN classes c ON cl.class_id = c.class_id
		LEFT JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN teachers t ON c.teacher_id = t.id
		LEFT JOIN (
			SELECT class_id, COUNT(*) as count 
			FROM classlist 
			WHERE status = 'active'
			GROUP BY class_id
		) enrollment_count ON c.class_id = enrollment_count.class_id
		WHERE cl.student_id = ? AND cl.is_archived = TRUE
		ORDER BY c.school_year DESC, c.semester DESC, c.subject_code ASC
	`

	rows, err := a.db.Query(query, studentUserID)
	if err != nil {
		log.Printf("⚠ Failed to query student archived classes: %v", err)
		return nil, err
	}
	defer rows.Close()

	var classes []CourseClass
	for rows.Next() {
		var cls CourseClass
		var subjectName, descriptiveTitle, edpCode, teacherName, schedule, room, semester, schoolYear sql.NullString
		var createdByUserID sql.NullInt64
		var createdAt time.Time

		err := rows.Scan(
			&cls.ClassID, &cls.SubjectCode, &subjectName, &descriptiveTitle, &edpCode,
			&cls.TeacherUserID, &teacherName,
			&schedule, &room, &semester, &schoolYear,
			&cls.EnrolledCount, &cls.IsActive, &cls.IsArchived, &createdByUserID, &createdAt,
		)
		if err != nil {
			log.Printf("⚠ Failed to scan student archived class: %v", err)
			continue
		}

		if subjectName.Valid {
			cls.SubjectName = subjectName.String
		}
		if descriptiveTitle.Valid {
			dt := descriptiveTitle.String
			cls.DescriptiveTitle = &dt
		}
		if edpCode.Valid {
			ec := edpCode.String
			cls.EdpCode = &ec
		}
		if teacherName.Valid {
			tn := teacherName.String
			cls.TeacherName = &tn
		}
		if schedule.Valid {
			s := schedule.String
			cls.Schedule = &s
		}
		if room.Valid {
			r := room.String
			cls.Room = &r
		}
		if semester.Valid {
			sem := semester.String
			cls.Semester = &sem
		}
		if schoolYear.Valid {
			sy := schoolYear.String
			cls.SchoolYear = &sy
		}
		if createdByUserID.Valid {
			id := int(createdByUserID.Int64)
			cls.CreatedByUserID = &id
		}
		cls.CreatedAt = createdAt.Format("2006-01-02 15:04:05")

		classes = append(classes, cls)
	}

	log.Printf("✓ Found %d archived classes for student user_id=%d", len(classes), studentUserID)
	return classes, nil
}

// GetClassByID returns a class by ID (including archived classes)
func (a *App) GetClassByID(classID int) (*CourseClass, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			c.class_id, c.subject_code, s.description as subject_name, c.descriptive_title, c.edp_code,
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
		LIMIT 1
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
		log.Printf("⚠ Failed to get class by ID: %v", err)
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

	log.Printf("✓ Retrieved class: ID=%d, Subject=%s, Active=%t, Archived=%t", class.ClassID, class.SubjectCode, class.IsActive, class.IsArchived)
	return &class, nil
}

// ArchiveStudentEnrollment archives a student's enrollment in a specific class
func (a *App) ArchiveStudentEnrollment(studentUserID int, classID int) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	result, err := a.db.Exec(
		"UPDATE classlist SET is_archived = TRUE WHERE student_id = ? AND class_id = ?",
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
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	result, err := a.db.Exec(
		"UPDATE classlist SET is_archived = FALSE WHERE student_id = ? AND class_id = ?",
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
// status can be: 'active', 'dropped', 'completed'
func (a *App) SetStudentEnrollmentStatus(studentUserID int, classID int, status string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Validate status
	validStatuses := map[string]bool{"active": true, "dropped": true, "completed": true}
	if !validStatuses[status] {
		return fmt.Errorf("invalid status: %s. Must be 'active', 'dropped', or 'completed'", status)
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
	if a.db == nil {
		return fmt.Errorf("database not connected")
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
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
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

// ExportClasslistCSV exports the classlist (enrolled students) for a class to CSV
func (a *App) ExportClasslistCSV(classID int) (string, error) {
	if a.db == nil {
		return "", fmt.Errorf("database not connected")
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
