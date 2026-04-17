package backend

import (
	"database/sql"
	"fmt"
	"log"
	"time"
)

// ==============================================================================
// CLASS ARCHIVING
// ==============================================================================

// ArchiveClass marks a class as archived.
// Google Classroom-like behavior: teacher can archive an active or closed class.
// The class remains restorable with its original active/closed state.
// When archiving a class, also archive all attendance records and enrollments.
func (a *App) ArchiveClass(classID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	// Check class status
	var isArchived bool
	err := a.db.QueryRow(`SELECT COALESCE(is_archived, 0) FROM classes WHERE class_id = ?`, classID).Scan(&isArchived)
	if err != nil {
		return fmt.Errorf("class not found")
	}
	if isArchived {
		return fmt.Errorf("class is already archived")
	}

	// Archive the class
	query := `
		UPDATE classes 
		SET is_archived = 1,
		    updated_at = CURRENT_TIMESTAMP
		WHERE class_id = ?
	`
	_, err = a.db.Exec(query, classID)
	if err != nil {
		log.Printf("Failed to archive class: %v", err)
		return err
	}

	// Also archive attendance records for this class (ONLY past attendance, not today or future)
	today := time.Now().Format("2006-01-02")
	_, err = a.db.Exec(
		`UPDATE attendance SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE class_id = ? AND attendance_date < ?`,
		classID, today,
	)
	if err != nil {
		log.Printf("Warning: Failed to archive past attendance for class %d: %v", classID, err)
	}

	// Also archive all enrollment records for this class
	_, err = a.db.Exec(
		`UPDATE joined_classes SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE class_id = ?`,
		classID,
	)
	if err != nil {
		log.Printf("Warning: Failed to archive enrollments for class %d: %v", classID, err)
	}

	log.Printf("Archived class and related records: class_id=%d", classID)
	return nil
}

// UnarchiveClass removes the archived flag from a class
func (a *App) UnarchiveClass(classID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	var classArchived bool
	err := a.db.QueryRow(`SELECT COALESCE(is_archived, 0) FROM classes WHERE class_id = ?`, classID).Scan(&classArchived)
	if err != nil {
		return fmt.Errorf("class not found")
	}
	if !classArchived {
		return fmt.Errorf("class is not archived")
	}

	query := `
		UPDATE classes 
		SET is_archived = 0,
		    updated_at = CURRENT_TIMESTAMP
		WHERE class_id = ?
	`

	result, err := a.db.Exec(query, classID)
	if err != nil {
		log.Printf("Failed to unarchive class: %v", err)
		return err
	}

	// Restore archived attendance rows for this class.
	// Personal student hide state is handled separately in student_archived_classes.
	_, err = a.db.Exec(
		`UPDATE attendance SET is_archived = 0, updated_at = CURRENT_TIMESTAMP WHERE class_id = ?`,
		classID,
	)
	if err != nil {
		log.Printf("Warning: Failed to restore attendance archive flags for class %d: %v", classID, err)
	}

	// Restore archived class enrollments so class membership returns after restore.
	_, err = a.db.Exec(
		`UPDATE joined_classes SET is_archived = 0, updated_at = CURRENT_TIMESTAMP WHERE class_id = ?`,
		classID,
	)
	if err != nil {
		log.Printf("Warning: Failed to restore classlist archive flags for class %d: %v", classID, err)
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("Unarchived class: class_id=%d, affected=%d", classID, rowsAffected)
	return nil
}

// GetArchivedClasses returns all archived classes for a teacher
func (a *App) GetArchivedClasses(teacherUserID int) ([]CourseClass, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			c.class_id, c.subject_code, s.description as subject_name, c.descriptive_title, c.edp_code, c.join_code,
			c.teacher_id, (CONCAT(t.last_name, ', ', t.first_name)) as teacher_name,
			c.schedule, c.room, c.semester, c.school_year,
			COALESCE(enrollment_count.count, 0) as enrolled_count,
			c.is_active, c.is_archived, c.created_by_user_id
		FROM classes c
		LEFT JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN teachers t ON c.teacher_id = t.id
		LEFT JOIN (
			SELECT class_id, COUNT(*) as count 
			FROM joined_classes 
			WHERE status IN ('join', 'added') AND COALESCE(is_archived, 0) = 0
			GROUP BY class_id
		) enrollment_count ON c.class_id = enrollment_count.class_id
		WHERE c.teacher_id = ?
		  AND c.is_archived = 1
		ORDER BY c.school_year DESC, c.semester DESC, s.subject_code
	`

	rows, err := a.db.Query(query, teacherUserID)
	if err != nil {
		log.Printf("Failed to query archived classes: %v", err)
		return nil, err
	}
	defer rows.Close()

	var classes []CourseClass
	for rows.Next() {
		var cls CourseClass
		var subjectName, descriptiveTitle, edpCode, joinCode, teacherName, schedule, room, semester, schoolYear sql.NullString
		var createdByUserID sql.NullInt64

		err := rows.Scan(
			&cls.ClassID, &cls.SubjectCode, &subjectName, &descriptiveTitle, &edpCode, &joinCode,
			&cls.TeacherUserID, &teacherName,
			&schedule, &room, &semester, &schoolYear,
			&cls.EnrolledCount, &cls.IsActive, &cls.IsArchived, &createdByUserID,
		)
		if err != nil {
			log.Printf("Failed to scan archived class: %v", err)
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
		if joinCode.Valid {
			jc := joinCode.String
			cls.JoinCode = &jc
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
	if err := a.checkDB(); err != nil {
		return nil, err
	}
	if err := a.ensureStudentArchivedClassesTable(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			c.class_id, c.subject_code, s.description as subject_name, c.descriptive_title, c.edp_code, c.join_code,
			c.teacher_id, (CONCAT(t.last_name, ', ', t.first_name)) as teacher_name,
			c.schedule, c.section, c.room, c.semester, c.school_year,
			COALESCE(enrollment_count.count, 0) as enrolled_count,
			c.is_active, c.is_archived, c.created_by_user_id, c.created_at
		FROM joined_classes cl
		JOIN classes c ON cl.class_id = c.class_id
		LEFT JOIN student_archived_classes sac ON sac.student_id = cl.student_id AND sac.class_id = cl.class_id
		LEFT JOIN subjects s ON c.subject_code = s.subject_code
		LEFT JOIN teachers t ON c.teacher_id = t.id
		LEFT JOIN (
			SELECT class_id, COUNT(*) as count 
			FROM joined_classes 
			WHERE status IN ('join', 'added') AND COALESCE(is_archived, 0) = 0
			GROUP BY class_id
		) enrollment_count ON c.class_id = enrollment_count.class_id
		WHERE cl.student_id = ?
		  AND cl.status IN ('join', 'added')
		  AND (
			COALESCE(c.is_archived, 0) = 1
			OR sac.class_id IS NOT NULL
		  )
		ORDER BY c.school_year DESC, c.semester DESC, c.subject_code ASC
	`

	rows, err := a.db.Query(query, studentUserID)
	if err != nil {
		log.Printf("Failed to query student archived classes: %v", err)
		return nil, err
	}
	defer rows.Close()

	var classes []CourseClass
	for rows.Next() {
		var cls CourseClass
		var subjectName, descriptiveTitle, edpCode, joinCode, teacherName, schedule, section, room, semester, schoolYear sql.NullString
		var createdByUserID sql.NullInt64
		var createdAt time.Time

		err := rows.Scan(
			&cls.ClassID, &cls.SubjectCode, &subjectName, &descriptiveTitle, &edpCode, &joinCode,
			&cls.TeacherUserID, &teacherName,
			&schedule, &section, &room, &semester, &schoolYear,
			&cls.EnrolledCount, &cls.IsActive, &cls.IsArchived, &createdByUserID, &createdAt,
		)
		if err != nil {
			log.Printf("Failed to scan student archived class: %v", err)
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
		if joinCode.Valid {
			jc := joinCode.String
			cls.JoinCode = &jc
		}
		if teacherName.Valid {
			tn := teacherName.String
			cls.TeacherName = &tn
		}
		if schedule.Valid {
			s := schedule.String
			cls.Schedule = &s
		}
		if section.Valid {
			sec := section.String
			cls.Section = &sec
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

	log.Printf("Found %d archived classes for student user_id=%d", len(classes), studentUserID)
	return classes, nil
}
