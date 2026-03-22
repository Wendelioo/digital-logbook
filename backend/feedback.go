package backend

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

// ==============================================================================
// FEEDBACK MANAGEMENT
// ==============================================================================

const maxActiveFeedbackEntries = 500

func (a *App) ensureFeedbackAdminResolvedAtColumn() error {
	if a.db == nil {
		return fmt.Errorf("database not initialized")
	}

	query := `
		IF COL_LENGTH('feedback', 'admin_resolved_at') IS NULL
		BEGIN
			ALTER TABLE feedback
			ADD admin_resolved_at DATETIME NULL;
		END
	`

	if _, err := a.db.Exec(query); err != nil {
		return fmt.Errorf("failed to ensure feedback.admin_resolved_at column: %w", err)
	}

	return nil
}

// autoArchiveFeedbackIfNeeded checks the number of non-archived forwarded feedback rows
// and, if a configured limit is exceeded, automatically archives the oldest day's feedback.
func (a *App) autoArchiveFeedbackIfNeeded() error {
	if err := a.checkDB(); err != nil {
		return err
	}

	var activeCount int
	if err := a.db.QueryRow(`
		SELECT COUNT(*) 
		FROM feedback 
		WHERE status = 'forwarded' AND (is_archived = 0 OR is_archived IS NULL)
	`).Scan(&activeCount); err != nil {
		return fmt.Errorf("failed to count active feedback entries: %w", err)
	}

	if activeCount <= maxActiveFeedbackEntries {
		return nil
	}

	// Find the oldest submitted date among unarchived forwarded feedback
	var oldestDate time.Time
	err := a.db.QueryRow(`
		SELECT MIN(CAST(date_submitted AS DATE)) 
		FROM feedback 
		WHERE status = 'forwarded' AND (is_archived = 0 OR is_archived IS NULL)
	`).Scan(&oldestDate)
	if err != nil {
		return fmt.Errorf("failed to find oldest feedback date: %w", err)
	}

	dateStr := oldestDate.Format("2006-01-02")
	_, err = a.ArchiveFeedbackByDate(dateStr, 0)
	if err != nil {
		return fmt.Errorf("failed to auto-archive feedback for date %s: %w", dateStr, err)
	}

	log.Printf("autoArchiveFeedbackIfNeeded archived feedback for date %s to keep active feedback under limit", dateStr)
	return nil
}

// GetFeedback returns all non-archived feedback that has been forwarded to admin
func (a *App) GetFeedback() ([]Feedback, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	// Automatic archiving: when the number of non-archived forwarded feedback entries
	// exceeds the configured limit, archive the oldest day's feedback.
	if err := a.autoArchiveFeedbackIfNeeded(); err != nil {
		log.Printf("autoArchiveFeedbackIfNeeded failed: %v", err)
	}

	// Only returns non-archived feedback (is_archived = 0 or NULL for backwards compatibility)
	query := `
		SELECT 
			f.id, 
			f.student_id, 
			COALESCE(s.student_id, 'N/A') as student_id_str,
			s.first_name, 
			s.middle_name, 
			s.last_name, 
			f.pc_number, 
			f.equipment_condition, 
			f.monitor_condition, 
			f.keyboard_condition, 
			f.mouse_condition, 
			f.comments, 
			f.date_submitted,
			f.status,
			COALESCE(f.admin_status, 'pending') as admin_status,
			f.admin_resolved_at,
			f.verified_by_user_id,
			f.verified_at,
			f.forwarded_by_user_id,
			f.forwarded_at,
			f.working_student_notes,
			COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name, '') + 
				CASE WHEN COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name) IS NOT NULL THEN ', ' ELSE '' END +
				COALESCE(s_fwd.first_name, t_fwd.first_name, a_fwd.first_name, '') +
				CASE WHEN COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name) IS NOT NULL 
					THEN ' ' + COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name) 
					ELSE '' END
			as forwarded_by_name
		FROM feedback f
		LEFT JOIN students s ON f.student_id = s.id
		LEFT JOIN users u_fwd ON f.forwarded_by_user_id = u_fwd.id
		LEFT JOIN students s_fwd ON u_fwd.id = s_fwd.id AND u_fwd.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t_fwd ON u_fwd.id = t_fwd.id AND u_fwd.user_type = 'teacher'
		LEFT JOIN admins a_fwd ON u_fwd.id = a_fwd.id AND u_fwd.user_type = 'admin'
		WHERE f.status = 'forwarded' AND (f.is_archived = 0 OR f.is_archived IS NULL)
		ORDER BY f.date_submitted DESC`
	rows, err := a.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var feedbacks []Feedback
	for rows.Next() {
		var fb Feedback
		var middleName, comments, studentIDStr, forwardedByName, workingStudentNotes sql.NullString
		var dateSubmitted time.Time
		var adminResolvedAt sql.NullTime
		var verifiedBy sql.NullInt64
		var verifiedAt sql.NullTime
		var forwardedBy sql.NullInt64
		var forwardedAt sql.NullTime

		err := rows.Scan(&fb.ID, &fb.StudentUserID, &studentIDStr, &fb.FirstName, &middleName, &fb.LastName,
			&fb.PCNumber, &fb.EquipmentCondition, &fb.MonitorCondition,
			&fb.KeyboardCondition, &fb.MouseCondition, &comments, &dateSubmitted, &fb.Status,
			&fb.AdminStatus, &adminResolvedAt,
			&verifiedBy, &verifiedAt, &forwardedBy, &forwardedAt, &workingStudentNotes, &forwardedByName)
		if err != nil {
			continue
		}

		if studentIDStr.Valid {
			fb.StudentIDStr = studentIDStr.String
		} else {
			fb.StudentIDStr = "N/A"
		}
		if middleName.Valid {
			fb.MiddleName = &middleName.String
		}
		if comments.Valid {
			fb.Comments = &comments.String
		}
		if verifiedBy.Valid {
			v := int(verifiedBy.Int64)
			fb.VerifiedByUserID = &v
		}
		if adminResolvedAt.Valid {
			resolvedAtStr := adminResolvedAt.Time.Format("2006-01-02 15:04:05")
			fb.AdminResolvedAt = &resolvedAtStr
		}
		if verifiedAt.Valid {
			t := verifiedAt.Time.Format("2006-01-02 15:04:05")
			fb.VerifiedAt = &t
		}
		if forwardedBy.Valid {
			forwardedByInt := int(forwardedBy.Int64)
			fb.ForwardedByUserID = &forwardedByInt
		}
		if forwardedAt.Valid {
			forwardedAtStr := forwardedAt.Time.Format("2006-01-02 15:04:05")
			fb.ForwardedAt = &forwardedAtStr
		}
		if forwardedByName.Valid && forwardedByName.String != "" {
			fb.ForwardedByName = &forwardedByName.String
		}
		if workingStudentNotes.Valid {
			fb.WorkingStudentNotes = &workingStudentNotes.String
		}

		fb.StudentName = fmt.Sprintf("%s, %s", fb.LastName, fb.FirstName)
		if middleName.Valid {
			fb.StudentName += " " + middleName.String
		}
		fb.DateSubmitted = dateSubmitted.Format("2006-01-02 15:04:05")

		feedbacks = append(feedbacks, fb)
	}

	return feedbacks, nil
}

// GetStudentFeedback returns feedback history for a specific student
func (a *App) GetStudentFeedback(studentID int) ([]Feedback, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			f.id, 
			f.student_id, 
			COALESCE(s.student_id, 'N/A') as student_id_str,
			s.first_name,
			s.middle_name,
			s.last_name,
			f.pc_number, 
			f.equipment_condition, 
			f.monitor_condition, 
			f.keyboard_condition, 
			f.mouse_condition, 
			f.comments, 
			f.date_submitted 
		FROM feedback f
		LEFT JOIN students s ON f.student_id = s.id
		WHERE f.student_id = ? 
		ORDER BY f.date_submitted DESC`
	rows, err := a.db.Query(query, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var feedbacks []Feedback
	for rows.Next() {
		var fb Feedback
		var middleName, comments, studentIDStr sql.NullString
		var dateSubmitted time.Time

		err := rows.Scan(&fb.ID, &fb.StudentUserID, &studentIDStr, &fb.FirstName, &middleName, &fb.LastName,
			&fb.PCNumber, &fb.EquipmentCondition, &fb.MonitorCondition,
			&fb.KeyboardCondition, &fb.MouseCondition, &comments, &dateSubmitted)
		if err != nil {
			continue
		}

		if studentIDStr.Valid {
			fb.StudentIDStr = studentIDStr.String
		} else {
			fb.StudentIDStr = "N/A"
		}
		if middleName.Valid {
			fb.MiddleName = &middleName.String
		}
		if comments.Valid {
			fb.Comments = &comments.String
		}

		fb.StudentName = fmt.Sprintf("%s, %s", fb.LastName, fb.FirstName)
		if middleName.Valid {
			fb.StudentName += " " + middleName.String
		}
		fb.DateSubmitted = dateSubmitted.Format("2006-01-02 15:04:05")

		feedbacks = append(feedbacks, fb)
	}

	return feedbacks, nil
}

// SaveEquipmentFeedback saves equipment feedback from a student.
// optionalPCNumber: if non-empty, the report is for that PC (e.g. "PC-12"); otherwise the current machine's hostname is used.
func (a *App) SaveEquipmentFeedback(userID int, userName, computerStatus, computerIssue, mouseStatus, mouseIssue, keyboardStatus, keyboardIssue, monitorStatus, monitorIssue, additionalComments, optionalPCNumber string) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := ValidatePositiveID(userID, "user ID"); err != nil {
		return err
	}

	// Sanitize and validate optional PC number
	if strings.TrimSpace(optionalPCNumber) != "" {
		pc, err := ValidatePCNumber(optionalPCNumber)
		if err != nil {
			return err
		}
		optionalPCNumber = pc
	}

	reportedForAnotherPC := strings.TrimSpace(optionalPCNumber) != ""
	pcNumber := strings.TrimSpace(optionalPCNumber)
	if pcNumber == "" {
		hostname, err := os.Hostname()
		if err != nil {
			log.Printf("Failed to get hostname: %v", err)
			hostname = "Unknown"
		}
		pcNumber = hostname
	}

	// Determine equipment conditions based on status
	// ENUM values: 'Good' + 'Minor Issue' + 'Not Working'
	equipmentCondition := "Good"
	if computerStatus == "no" {
		equipmentCondition = "Not Working"
	}

	monitorCondition := "Good"
	if monitorStatus == "no" {
		monitorCondition = "Not Working"
	}

	keyboardCondition := "Good"
	if keyboardStatus == "no" {
		keyboardCondition = "Not Working"
	}

	mouseCondition := "Good"
	if mouseStatus == "no" {
		mouseCondition = "Not Working"
	}

	// Sanitize comment fields (length and control chars)
	sanitizedComment := func(s string) string { out, _ := ValidateComments(s); return out }
	computerIssue = sanitizedComment(computerIssue)
	monitorIssue = sanitizedComment(monitorIssue)
	keyboardIssue = sanitizedComment(keyboardIssue)
	mouseIssue = sanitizedComment(mouseIssue)
	additionalComments = sanitizedComment(additionalComments)

	// Build detailed comments with all issues
	var commentsParts []string
	if computerIssue != "" {
		commentsParts = append(commentsParts, fmt.Sprintf("Computer: %s", computerIssue))
	}
	if monitorIssue != "" {
		commentsParts = append(commentsParts, fmt.Sprintf("Monitor: %s", monitorIssue))
	}
	if keyboardIssue != "" {
		commentsParts = append(commentsParts, fmt.Sprintf("Keyboard: %s", keyboardIssue))
	}
	if mouseIssue != "" {
		commentsParts = append(commentsParts, fmt.Sprintf("Mouse: %s", mouseIssue))
	}
	if additionalComments != "" {
		commentsParts = append(commentsParts, fmt.Sprintf("Additional: %s", additionalComments))
	}
	// When report is for another PC, record which machine submitted so it's visible in the UI
	if reportedForAnotherPC {
		submittedFrom, err := os.Hostname()
		if err != nil {
			log.Printf("Failed to get hostname for submitted-from: %v", err)
			submittedFrom = "Unknown"
		}
		commentsParts = append(commentsParts, fmt.Sprintf("Submitted from: %s", submittedFrom))
	}

	combinedComments := ""
	if len(commentsParts) > 0 {
		combinedComments = commentsParts[0]
		for i := 1; i < len(commentsParts); i++ {
			combinedComments = fmt.Sprintf("%s; %s", combinedComments, commentsParts[i])
		}
	}

	// Insert feedback into database with priority auto-detection
	// Priority: critical if Not Working, high if Minor Issue, medium otherwise
	priority := "medium"
	if equipmentCondition == "Not Working" || monitorCondition == "Not Working" ||
		keyboardCondition == "Not Working" || mouseCondition == "Not Working" {
		priority = "critical"
	} else if equipmentCondition == "Minor Issue" || monitorCondition == "Minor Issue" ||
		keyboardCondition == "Minor Issue" || mouseCondition == "Minor Issue" {
		priority = "high"
	}

	// Determine if this report actually has any issues
	noIssue := strings.EqualFold(equipmentCondition, "good") &&
		strings.EqualFold(monitorCondition, "good") &&
		strings.EqualFold(keyboardCondition, "good") &&
		strings.EqualFold(mouseCondition, "good") &&
		strings.TrimSpace(combinedComments) == ""

	// Workflow status:
	// - Reports WITH issues start as "pending" (awaiting verification).
	// - Reports with NO issues skip verification and are immediately "confirmed"
	//   so they appear in the "Ready to Forward" list for working students.
	status := "pending"
	if noIssue {
		status = "confirmed"
	}

	// AdminStatus:
	// - Always starts as "pending" when feedback is first created.
	adminStatus := "pending"

	query := `INSERT INTO feedback (student_id, pc_number, 
			  equipment_condition, monitor_condition, keyboard_condition, mouse_condition, 
			  comments, priority, status, admin_status, date_submitted) 
			  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())`

	_, err := a.db.Exec(query, userID, pcNumber,
		equipmentCondition, monitorCondition, keyboardCondition, mouseCondition, nullString(combinedComments), priority, status, adminStatus)

	if err != nil {
		log.Printf("Failed to save equipment feedback: %v", err)
		return fmt.Errorf("failed to save feedback: %w", err)
	}

	log.Printf("Equipment feedback saved for user %d", userID)

	// Notify all working students about new feedback
	go a.createNotificationForRole("working_student", "feedback",
		"New Equipment Feedback",
		fmt.Sprintf("New feedback submitted for %s.", pcNumber),
		"info", notifRef("feedback"), nil)

	return nil
}

// GetPendingFeedback returns all pending feedback for working students to review
func (a *App) GetPendingFeedback() ([]Feedback, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			f.id, 
			f.student_id, 
			COALESCE(s.student_id, 'N/A') as student_id_str,
			s.first_name, 
			s.middle_name, 
			s.last_name, 
			f.pc_number, 
			f.equipment_condition, 
			f.monitor_condition, 
			f.keyboard_condition, 
			f.mouse_condition, 
			f.comments, 
			f.date_submitted,
			f.status
		FROM feedback f
		LEFT JOIN students s ON f.student_id = s.id
		WHERE f.status = 'pending'
		  AND (
			LOWER(ISNULL(f.equipment_condition, '')) <> 'good'
			OR LOWER(ISNULL(f.monitor_condition, '')) <> 'good'
			OR LOWER(ISNULL(f.keyboard_condition, '')) <> 'good'
			OR LOWER(ISNULL(f.mouse_condition, '')) <> 'good'
			OR LTRIM(RTRIM(ISNULL(f.comments, ''))) <> ''
		  )
		ORDER BY f.date_submitted DESC`
	rows, err := a.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var feedbacks []Feedback
	for rows.Next() {
		var fb Feedback
		var middleName, comments, studentIDStr sql.NullString
		var dateSubmitted time.Time

		err := rows.Scan(&fb.ID, &fb.StudentUserID, &studentIDStr, &fb.FirstName, &middleName, &fb.LastName,
			&fb.PCNumber, &fb.EquipmentCondition, &fb.MonitorCondition,
			&fb.KeyboardCondition, &fb.MouseCondition, &comments, &dateSubmitted, &fb.Status)
		if err != nil {
			continue
		}

		if studentIDStr.Valid {
			fb.StudentIDStr = studentIDStr.String
		} else {
			fb.StudentIDStr = "N/A"
		}
		if middleName.Valid {
			fb.MiddleName = &middleName.String
		}
		if comments.Valid {
			fb.Comments = &comments.String
		}

		fb.StudentName = fmt.Sprintf("%s, %s", fb.LastName, fb.FirstName)
		if middleName.Valid {
			fb.StudentName += " " + middleName.String
		}
		fb.DateSubmitted = dateSubmitted.Format("2006-01-02 15:04:05")

		feedbacks = append(feedbacks, fb)
	}

	return feedbacks, nil
}

// GetConfirmedFeedback returns feedback that working student has confirmed (issue is true), ready to forward to admin
func (a *App) GetConfirmedFeedback() ([]Feedback, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			f.id, 
			f.student_id, 
			COALESCE(s.student_id, 'N/A') as student_id_str,
			s.first_name, 
			s.middle_name, 
			s.last_name, 
			f.pc_number, 
			f.equipment_condition, 
			f.monitor_condition, 
			f.keyboard_condition, 
			f.mouse_condition, 
			f.comments, 
			f.date_submitted,
			f.status,
			f.verified_by_user_id,
			f.verified_at,
			f.working_student_notes
		FROM feedback f
		LEFT JOIN students s ON f.student_id = s.id
		WHERE f.status = 'confirmed'
		ORDER BY f.date_submitted DESC`
	rows, err := a.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var feedbacks []Feedback
	for rows.Next() {
		var fb Feedback
		var middleName, comments, studentIDStr, workingStudentNotes sql.NullString
		var dateSubmitted time.Time
		var verifiedBy sql.NullInt64
		var verifiedAt sql.NullTime

		err := rows.Scan(&fb.ID, &fb.StudentUserID, &studentIDStr, &fb.FirstName, &middleName, &fb.LastName,
			&fb.PCNumber, &fb.EquipmentCondition, &fb.MonitorCondition,
			&fb.KeyboardCondition, &fb.MouseCondition, &comments, &dateSubmitted, &fb.Status,
			&verifiedBy, &verifiedAt, &workingStudentNotes)
		if err != nil {
			continue
		}

		if studentIDStr.Valid {
			fb.StudentIDStr = studentIDStr.String
		} else {
			fb.StudentIDStr = "N/A"
		}
		if middleName.Valid {
			fb.MiddleName = &middleName.String
		}
		if comments.Valid {
			fb.Comments = &comments.String
		}
		if verifiedBy.Valid {
			v := int(verifiedBy.Int64)
			fb.VerifiedByUserID = &v
		}
		if verifiedAt.Valid {
			t := verifiedAt.Time.Format("2006-01-02 15:04:05")
			fb.VerifiedAt = &t
		}
		if workingStudentNotes.Valid {
			fb.WorkingStudentNotes = &workingStudentNotes.String
		}

		fb.StudentName = fmt.Sprintf("%s, %s", fb.LastName, fb.FirstName)
		if middleName.Valid {
			fb.StudentName += " " + middleName.String
		}
		fb.DateSubmitted = dateSubmitted.Format("2006-01-02 15:04:05")

		feedbacks = append(feedbacks, fb)
	}

	return feedbacks, nil
}

// GetRejectedFeedback returns feedback that working student has rejected.
func (a *App) GetRejectedFeedback() ([]Feedback, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			f.id, 
			f.student_id, 
			COALESCE(s.student_id, 'N/A') as student_id_str,
			s.first_name, 
			s.middle_name, 
			s.last_name, 
			f.pc_number, 
			f.equipment_condition, 
			f.monitor_condition, 
			f.keyboard_condition, 
			f.mouse_condition, 
			f.comments, 
			f.date_submitted,
			f.status,
			f.verified_by_user_id,
			f.verified_at,
			f.working_student_notes
		FROM feedback f
		LEFT JOIN students s ON f.student_id = s.id
		WHERE f.status = 'rejected'
		ORDER BY f.verified_at DESC, f.date_submitted DESC`
	rows, err := a.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var feedbacks []Feedback
	for rows.Next() {
		var fb Feedback
		var middleName, comments, studentIDStr, workingStudentNotes sql.NullString
		var dateSubmitted time.Time
		var verifiedBy sql.NullInt64
		var verifiedAt sql.NullTime

		err := rows.Scan(&fb.ID, &fb.StudentUserID, &studentIDStr, &fb.FirstName, &middleName, &fb.LastName,
			&fb.PCNumber, &fb.EquipmentCondition, &fb.MonitorCondition,
			&fb.KeyboardCondition, &fb.MouseCondition, &comments, &dateSubmitted, &fb.Status,
			&verifiedBy, &verifiedAt, &workingStudentNotes)
		if err != nil {
			continue
		}

		if studentIDStr.Valid {
			fb.StudentIDStr = studentIDStr.String
		} else {
			fb.StudentIDStr = "N/A"
		}
		if middleName.Valid {
			fb.MiddleName = &middleName.String
		}
		if comments.Valid {
			fb.Comments = &comments.String
		}
		if verifiedBy.Valid {
			v := int(verifiedBy.Int64)
			fb.VerifiedByUserID = &v
		}
		if verifiedAt.Valid {
			t := verifiedAt.Time.Format("2006-01-02 15:04:05")
			fb.VerifiedAt = &t
		}
		if workingStudentNotes.Valid {
			fb.WorkingStudentNotes = &workingStudentNotes.String
		}

		fb.StudentName = fmt.Sprintf("%s, %s", fb.LastName, fb.FirstName)
		if middleName.Valid {
			fb.StudentName += " " + middleName.String
		}
		fb.DateSubmitted = dateSubmitted.Format("2006-01-02 15:04:05")

		feedbacks = append(feedbacks, fb)
	}

	return feedbacks, nil
}

// ConfirmFeedback sets working-student verification: issue confirmed (true) or rejected (not true). Only confirmed can be forwarded.
func (a *App) ConfirmFeedback(feedbackID int, workingStudentID int, confirmed bool, notes string) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	status := "rejected"
	if confirmed {
		status = "confirmed"
	}

	query := `UPDATE feedback 
			  SET status = ?, 
			      verified_by_user_id = ?, 
			      verified_at = GETDATE(), 
			      working_student_notes = ?
			  WHERE id = ? AND status = 'pending'`

	result, err := a.db.Exec(query, status, workingStudentID, nullString(notes), feedbackID)
	if err != nil {
		log.Printf("Failed to confirm feedback %d: %v", feedbackID, err)
		return fmt.Errorf("failed to confirm feedback: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("feedback not found or already verified")
	}

	log.Printf("Feedback %d %s by working student %d", feedbackID, status, workingStudentID)
	return nil
}

// ForwardFeedbackToAdmin forwards feedback from working student to admin. Only feedback with status 'confirmed' can be forwarded.
func (a *App) ForwardFeedbackToAdmin(feedbackID int, workingStudentID int, notes string) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	// Update feedback to forwarded status (only if already confirmed by working student)
	query := `UPDATE feedback 
			  SET status = 'forwarded', 
			      forwarded_by_user_id = ?, 
			      forwarded_at = GETDATE(), 
			      working_student_notes = ?
			  WHERE id = ? AND status = 'confirmed'`

	result, err := a.db.Exec(query, workingStudentID, nullString(notes), feedbackID)
	if err != nil {
		log.Printf("Failed to forward feedback %d: %v", feedbackID, err)
		return fmt.Errorf("failed to forward feedback: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("feedback not found or not confirmed (only confirmed reports can be forwarded)")
	}

	log.Printf("Feedback %d forwarded to admin by working student %d", feedbackID, workingStudentID)

	// Notify all admins about forwarded feedback
	go a.createNotificationForRole("admin", "feedback",
		"Feedback Issue Forwarded",
		fmt.Sprintf("Feedback issue #%d forwarded for admin review.", feedbackID),
		"warning", notifRef("feedback"), notifRefID(feedbackID))

	return nil
}

// ForwardMultipleFeedbackToAdmin forwards multiple confirmed feedback items from working student to admin in batch
func (a *App) ForwardMultipleFeedbackToAdmin(feedbackIDs []int, workingStudentID int, notes string) (int, error) {
	if err := a.checkDB(); err != nil {
		return 0, err
	}

	if len(feedbackIDs) == 0 {
		return 0, fmt.Errorf("no feedback IDs provided")
	}

	// Build placeholders for the IN clause
	placeholders := make([]string, len(feedbackIDs))
	args := make([]interface{}, 0, len(feedbackIDs)+2)

	// Add workingStudentID and notes first (for SET clause)
	args = append(args, workingStudentID)
	args = append(args, nullString(notes))

	// Add feedback IDs for WHERE clause
	for i, id := range feedbackIDs {
		placeholders[i] = "?"
		args = append(args, id)
	}

	// Update all feedback items to forwarded status (only those already confirmed)
	query := fmt.Sprintf(`UPDATE feedback 
			  SET status = 'forwarded', 
			      forwarded_by_user_id = ?, 
			      forwarded_at = GETDATE(), 
			      working_student_notes = ?
			  WHERE id IN (%s) AND status = 'confirmed'`, strings.Join(placeholders, ","))

	result, err := a.db.Exec(query, args...)
	if err != nil {
		log.Printf("Failed to forward multiple feedback: %v", err)
		return 0, fmt.Errorf("failed to forward feedback: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	if rowsAffected == 0 {
		return 0, fmt.Errorf("no feedback items were forwarded (only confirmed reports can be forwarded)")
	}

	log.Printf("%d feedback items forwarded to admin by working student %d", rowsAffected, workingStudentID)

	// Notify all admins about the batch forward
	go a.createNotificationForRole("admin", "feedback",
		"Feedback Issues Forwarded",
		fmt.Sprintf("%d feedback issue report(s) forwarded for admin review.", rowsAffected),
		"warning", notifRef("feedback"), nil)

	return int(rowsAffected), nil
}

// ConfirmAndForwardMultiple confirms and forwards multiple pending feedback items to admin in one step.
// Use this so working students can batch "confirm & forward" (e.g. no-issue logs) without doing each one by one.
func (a *App) ConfirmAndForwardMultiple(feedbackIDs []int, workingStudentID int, notes string) (int, error) {
	if err := a.checkDB(); err != nil {
		return 0, err
	}

	if len(feedbackIDs) == 0 {
		return 0, fmt.Errorf("no feedback IDs provided")
	}

	placeholders := make([]string, len(feedbackIDs))
	args := make([]interface{}, 0, len(feedbackIDs)+3)
	args = append(args, workingStudentID)
	args = append(args, nullString(notes))
	args = append(args, workingStudentID)
	for i, id := range feedbackIDs {
		placeholders[i] = "?"
		args = append(args, id)
	}

	query := fmt.Sprintf(`UPDATE feedback 
			  SET status = 'forwarded', 
			      verified_by_user_id = ?, 
			      verified_at = GETDATE(), 
			      forwarded_by_user_id = ?, 
			      forwarded_at = GETDATE(), 
			      working_student_notes = ?
			  WHERE id IN (%s) AND status = 'pending'`, strings.Join(placeholders, ","))

	result, err := a.db.Exec(query, args...)
	if err != nil {
		log.Printf("Failed to confirm and forward multiple feedback: %v", err)
		return 0, fmt.Errorf("failed to confirm and forward feedback: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	if rowsAffected == 0 {
		return 0, fmt.Errorf("no feedback items were updated (only pending reports can be confirmed and forwarded)")
	}

	log.Printf("%d feedback items confirmed and forwarded to admin by working student %d", rowsAffected, workingStudentID)

	// Notify all admins about the confirm-and-forward batch
	go a.createNotificationForRole("admin", "feedback",
		"Feedback Issues Forwarded",
		fmt.Sprintf("%d feedback issue report(s) confirmed and forwarded for admin review.", rowsAffected),
		"warning", notifRef("feedback"), nil)

	return int(rowsAffected), nil
}

// ==============================================================================
// FEEDBACK RANGE EXPORT FUNCTIONS
// ==============================================================================

// GetFeedbackRangeCount returns the count of non-archived forwarded feedback within a date range.
func (a *App) GetFeedbackRangeCount(startDate, endDate string) (int, error) {
	if err := a.checkDB(); err != nil {
		return 0, err
	}
	var count int
	err := a.db.QueryRow(`
		SELECT COUNT(*) FROM feedback
		WHERE status = 'forwarded' AND (is_archived = 0 OR is_archived IS NULL)
		AND CAST(date_submitted AS DATE) BETWEEN ? AND ?`,
		startDate, endDate,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count feedback in range: %w", err)
	}
	return count, nil
}

// getFeedbackByDateRange fetches non-archived forwarded feedback within a date range.
func (a *App) getFeedbackByDateRange(startDate, endDate string) ([]Feedback, error) {
	query := `
		SELECT
			f.id, f.student_id,
			COALESCE(s.student_id, 'N/A') as student_id_str,
			s.first_name, s.middle_name, s.last_name,
			f.pc_number, f.equipment_condition, f.monitor_condition,
			f.keyboard_condition, f.mouse_condition, f.comments,
			f.date_submitted, f.status,
			COALESCE(f.admin_status, 'pending') as admin_status,
			f.verified_by_user_id, f.verified_at,
			f.forwarded_by_user_id, f.forwarded_at, f.working_student_notes,
			COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name, '') +
				CASE WHEN COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name) IS NOT NULL THEN ', ' ELSE '' END +
				COALESCE(s_fwd.first_name, t_fwd.first_name, a_fwd.first_name, '') +
				CASE WHEN COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name) IS NOT NULL
					THEN ' ' + COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name)
					ELSE '' END
			as forwarded_by_name
		FROM feedback f
		LEFT JOIN students s ON f.student_id = s.id
		LEFT JOIN users u_fwd ON f.forwarded_by_user_id = u_fwd.id
		LEFT JOIN students s_fwd ON u_fwd.id = s_fwd.id AND u_fwd.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t_fwd ON u_fwd.id = t_fwd.id AND u_fwd.user_type = 'teacher'
		LEFT JOIN admins a_fwd ON u_fwd.id = a_fwd.id AND u_fwd.user_type = 'admin'
		WHERE f.status = 'forwarded' AND (f.is_archived = 0 OR f.is_archived IS NULL)
		AND CAST(f.date_submitted AS DATE) BETWEEN ? AND ?
		ORDER BY f.date_submitted DESC`

	rows, err := a.db.Query(query, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to query feedback by range: %w", err)
	}
	defer rows.Close()

	var feedbacks []Feedback
	for rows.Next() {
		var fb Feedback
		var middleName, comments, studentIDStr, forwardedByName, workingStudentNotes sql.NullString
		var dateSubmitted time.Time
		var verifiedBy sql.NullInt64
		var verifiedAt sql.NullTime
		var forwardedBy sql.NullInt64
		var forwardedAt sql.NullTime

		if err := rows.Scan(&fb.ID, &fb.StudentUserID, &studentIDStr, &fb.FirstName, &middleName, &fb.LastName,
			&fb.PCNumber, &fb.EquipmentCondition, &fb.MonitorCondition,
			&fb.KeyboardCondition, &fb.MouseCondition, &comments, &dateSubmitted, &fb.Status, &fb.AdminStatus,
			&verifiedBy, &verifiedAt, &forwardedBy, &forwardedAt, &workingStudentNotes, &forwardedByName); err != nil {
			continue
		}
		if studentIDStr.Valid {
			fb.StudentIDStr = studentIDStr.String
		} else {
			fb.StudentIDStr = "N/A"
		}
		if middleName.Valid {
			fb.MiddleName = &middleName.String
		}
		if comments.Valid {
			fb.Comments = &comments.String
		}
		if verifiedBy.Valid {
			v := int(verifiedBy.Int64)
			fb.VerifiedByUserID = &v
		}
		if verifiedAt.Valid {
			t := verifiedAt.Time.Format("2006-01-02 15:04:05")
			fb.VerifiedAt = &t
		}
		if forwardedBy.Valid {
			v := int(forwardedBy.Int64)
			fb.ForwardedByUserID = &v
		}
		if forwardedAt.Valid {
			s := forwardedAt.Time.Format("2006-01-02 15:04:05")
			fb.ForwardedAt = &s
		}
		if forwardedByName.Valid && forwardedByName.String != "" {
			fb.ForwardedByName = &forwardedByName.String
		}
		if workingStudentNotes.Valid {
			fb.WorkingStudentNotes = &workingStudentNotes.String
		}
		fb.StudentName = fmt.Sprintf("%s, %s", fb.LastName, fb.FirstName)
		if middleName.Valid {
			fb.StudentName += " " + middleName.String
		}
		fb.DateSubmitted = dateSubmitted.Format("2006-01-02 15:04:05")
		feedbacks = append(feedbacks, fb)
	}
	return feedbacks, nil
}

func parseFeedbackExportTimestamp(value string) (time.Time, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return time.Time{}, false
	}

	formats := []string{
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		time.RFC3339,
		"2006-01-02",
	}

	for _, format := range formats {
		parsed, err := time.Parse(format, trimmed)
		if err == nil {
			return parsed, true
		}
	}

	return time.Time{}, false
}

func formatFeedbackExportDate(value string) string {
	parsed, ok := parseFeedbackExportTimestamp(value)
	if !ok {
		return value
	}
	return parsed.Format("01/02/2006")
}

func formatFeedbackExportDateTime(value *string) string {
	if value == nil {
		return ""
	}
	parsed, ok := parseFeedbackExportTimestamp(*value)
	if !ok {
		return *value
	}
	return parsed.Format("01/02 3:04 PM")
}

func formatFeedbackForwardedTime(value *string) string {
	if value == nil {
		return ""
	}
	parsed, ok := parseFeedbackExportTimestamp(*value)
	if !ok {
		return ""
	}
	return parsed.Format("3:04 PM")
}

func feedbackHasNoIssue(fb Feedback) bool {
	comments := ""
	if fb.Comments != nil {
		comments = strings.TrimSpace(*fb.Comments)
	}

	return strings.EqualFold(fb.EquipmentCondition, "good") &&
		strings.EqualFold(fb.MonitorCondition, "good") &&
		strings.EqualFold(fb.KeyboardCondition, "good") &&
		strings.EqualFold(fb.MouseCondition, "good") &&
		comments == ""
}

func feedbackIssueCount(fb Feedback) int {
	count := 0
	for _, condition := range []string{fb.EquipmentCondition, fb.MonitorCondition, fb.KeyboardCondition, fb.MouseCondition} {
		if !strings.EqualFold(strings.TrimSpace(condition), "good") {
			count++
		}
	}
	return count
}

func feedbackStatusLabel(fb Feedback) string {
	issues := feedbackIssueCount(fb)
	if issues == 0 {
		return "No Issues"
	}
	if issues == 1 {
		return "1 Issue"
	}
	return fmt.Sprintf("%d Issues", issues)
}

func feedbackSubmittedFrom(comments *string) string {
	if comments == nil {
		return ""
	}
	trimmed := strings.TrimSpace(*comments)
	if trimmed == "" {
		return ""
	}

	marker := "Submitted from:"
	start := strings.Index(trimmed, marker)
	if start == -1 {
		return ""
	}

	remaining := strings.TrimSpace(trimmed[start+len(marker):])
	if remaining == "" {
		return ""
	}

	for _, separator := range []string{";", "\n", "\r"} {
		if index := strings.Index(remaining, separator); index >= 0 {
			remaining = remaining[:index]
			break
		}
	}

	return strings.TrimSpace(remaining)
}

func feedbackStudentDisplay(fb Feedback) string {
	studentID := strings.TrimSpace(fb.StudentIDStr)
	if studentID == "" || studentID == "N/A" {
		return fb.StudentName
	}
	return fmt.Sprintf("%s (%s)", fb.StudentName, studentID)
}

func feedbackPCOriginDisplay(fb Feedback) string {
	submittedFrom := feedbackSubmittedFrom(fb.Comments)
	if submittedFrom != "" {
		return fmt.Sprintf("%s (from %s)", fb.PCNumber, submittedFrom)
	}
	return fb.PCNumber
}

func feedbackForwardedByDisplay(fb Feedback) string {
	name := "Unknown"
	if fb.ForwardedByName != nil && strings.TrimSpace(*fb.ForwardedByName) != "" {
		name = strings.TrimSpace(*fb.ForwardedByName)
	}

	forwardedTime := formatFeedbackForwardedTime(fb.ForwardedAt)
	if forwardedTime == "" {
		return name
	}
	return fmt.Sprintf("%s (%s)", name, forwardedTime)
}

func buildActiveFeedbackExportRows(feedbacks []Feedback) [][]string {
	rows := make([][]string, 0, len(feedbacks))
	for _, fb := range feedbacks {
		rows = append(rows, []string{
			feedbackStudentDisplay(fb),
			feedbackPCOriginDisplay(fb),
			formatFeedbackExportDate(fb.DateSubmitted),
			feedbackStatusLabel(fb),
			formatFeedbackExportDateTime(fb.VerifiedAt),
			feedbackForwardedByDisplay(fb),
		})
	}
	return rows
}

func buildArchivedFeedbackExportRows(feedbacks []Feedback) [][]string {
	rows := make([][]string, 0, len(feedbacks))
	for _, fb := range feedbacks {
		rows = append(rows, []string{
			formatFeedbackExportDate(fb.DateSubmitted),
			fb.StudentIDStr,
			fb.StudentName,
			fb.PCNumber,
			fb.EquipmentCondition,
			fb.MonitorCondition,
			fb.KeyboardCondition,
			fb.MouseCondition,
		})
	}
	return rows
}

func buildActiveFeedbackExportDocument(startDate, endDate string, feedbacks []Feedback) printableExportDocument {
	rows := buildActiveFeedbackExportRows(feedbacks)
	return printableExportDocument{
		Title:            "Equipment Reports",
		Subtitle:         fmt.Sprintf("Date Range: %s to %s", startDate, endDate),
		Details:          nil,
		TableNote:        "",
		Headers:          []string{"Student", "PC / Origin", "Date", "Status", "Verified At", "Forwarded By"},
		Rows:             rows,
		Footer:           []printableExportField{{Label: "Total Records", Value: strconv.Itoa(len(rows))}},
		ColumnWidths:     []float64{58, 40, 24, 24, 28, 38},
		ColumnAlignments: []string{"L", "L", "L", "L", "L", "L"},
		Orientation:      "P",
		GeneratedAt:      time.Now(),
	}
}

func buildActiveFeedbackExportDocumentByCount(requestedCount int, feedbacks []Feedback) printableExportDocument {
	rows := buildActiveFeedbackExportRows(feedbacks)
	subtitle := fmt.Sprintf("Latest %d records", requestedCount)
	if len(rows) == 1 {
		subtitle = fmt.Sprintf("Latest %d record", requestedCount)
	}
	if len(rows) < requestedCount {
		subtitle = fmt.Sprintf("Latest %d records (only %d available)", requestedCount, len(rows))
	}

	return printableExportDocument{
		Title:            "Equipment Reports",
		Subtitle:         subtitle,
		Details:          nil,
		TableNote:        "",
		Headers:          []string{"Student", "PC / Origin", "Date", "Status", "Verified At", "Forwarded By"},
		Rows:             rows,
		Footer:           []printableExportField{{Label: "Total Records", Value: strconv.Itoa(len(rows))}},
		ColumnWidths:     []float64{58, 40, 24, 24, 28, 38},
		ColumnAlignments: []string{"L", "L", "L", "L", "L", "L"},
		Orientation:      "P",
		GeneratedAt:      time.Now(),
	}
}

func buildActiveFeedbackExportDocumentByRowRange(fromRow, toRow int, feedbacks []Feedback) printableExportDocument {
	rows := buildActiveFeedbackExportRows(feedbacks)
	subtitle := fmt.Sprintf("Rows %d to %d (latest-first)", fromRow, toRow)
	if len(rows) < (toRow - fromRow + 1) {
		subtitle = fmt.Sprintf("Rows %d to %d (latest-first, only %d available)", fromRow, toRow, len(rows))
	}

	return printableExportDocument{
		Title:            "Equipment Reports",
		Subtitle:         subtitle,
		Details:          nil,
		TableNote:        "",
		Headers:          []string{"Student", "PC / Origin", "Date", "Status", "Verified At", "Forwarded By"},
		Rows:             rows,
		Footer:           []printableExportField{{Label: "Total Records", Value: strconv.Itoa(len(rows))}},
		ColumnWidths:     []float64{58, 40, 24, 24, 28, 38},
		ColumnAlignments: []string{"L", "L", "L", "L", "L", "L"},
		Orientation:      "P",
		GeneratedAt:      time.Now(),
	}
}

// getFeedbackByCount fetches the latest non-archived forwarded feedback, limited by count.
func (a *App) getFeedbackByCount(count int) ([]Feedback, error) {
	if count <= 0 {
		return nil, fmt.Errorf("count must be greater than zero")
	}
	if count > maxActiveFeedbackEntries {
		return nil, fmt.Errorf("count cannot exceed %d", maxActiveFeedbackEntries)
	}

	query := `
		SELECT
			f.id, f.student_id,
			COALESCE(s.student_id, 'N/A') as student_id_str,
			s.first_name, s.middle_name, s.last_name,
			f.pc_number, f.equipment_condition, f.monitor_condition,
			f.keyboard_condition, f.mouse_condition, f.comments,
			f.date_submitted, f.status,
			COALESCE(f.admin_status, 'pending') as admin_status,
			f.verified_by_user_id, f.verified_at,
			f.forwarded_by_user_id, f.forwarded_at, f.working_student_notes,
			COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name, '') +
				CASE WHEN COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name) IS NOT NULL THEN ', ' ELSE '' END +
				COALESCE(s_fwd.first_name, t_fwd.first_name, a_fwd.first_name, '') +
				CASE WHEN COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name) IS NOT NULL
					THEN ' ' + COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name)
					ELSE '' END
			as forwarded_by_name
		FROM feedback f
		LEFT JOIN students s ON f.student_id = s.id
		LEFT JOIN users u_fwd ON f.forwarded_by_user_id = u_fwd.id
		LEFT JOIN students s_fwd ON u_fwd.id = s_fwd.id AND u_fwd.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t_fwd ON u_fwd.id = t_fwd.id AND u_fwd.user_type = 'teacher'
		LEFT JOIN admins a_fwd ON u_fwd.id = a_fwd.id AND u_fwd.user_type = 'admin'
		WHERE f.status = 'forwarded' AND (f.is_archived = 0 OR f.is_archived IS NULL)
		ORDER BY f.date_submitted DESC
		OFFSET 0 ROWS FETCH NEXT ? ROWS ONLY`

	rows, err := a.db.Query(query, count)
	if err != nil {
		return nil, fmt.Errorf("failed to query feedback by count: %w", err)
	}
	defer rows.Close()

	feedbacks := make([]Feedback, 0, count)
	for rows.Next() {
		var fb Feedback
		var middleName, comments, studentIDStr, forwardedByName, workingStudentNotes sql.NullString
		var dateSubmitted time.Time
		var verifiedBy sql.NullInt64
		var verifiedAt sql.NullTime
		var forwardedBy sql.NullInt64
		var forwardedAt sql.NullTime

		if err := rows.Scan(&fb.ID, &fb.StudentUserID, &studentIDStr, &fb.FirstName, &middleName, &fb.LastName,
			&fb.PCNumber, &fb.EquipmentCondition, &fb.MonitorCondition,
			&fb.KeyboardCondition, &fb.MouseCondition, &comments, &dateSubmitted, &fb.Status, &fb.AdminStatus,
			&verifiedBy, &verifiedAt, &forwardedBy, &forwardedAt, &workingStudentNotes, &forwardedByName); err != nil {
			continue
		}
		if studentIDStr.Valid {
			fb.StudentIDStr = studentIDStr.String
		} else {
			fb.StudentIDStr = "N/A"
		}
		if middleName.Valid {
			fb.MiddleName = &middleName.String
		}
		if comments.Valid {
			fb.Comments = &comments.String
		}
		if verifiedBy.Valid {
			v := int(verifiedBy.Int64)
			fb.VerifiedByUserID = &v
		}
		if verifiedAt.Valid {
			t := verifiedAt.Time.Format("2006-01-02 15:04:05")
			fb.VerifiedAt = &t
		}
		if forwardedBy.Valid {
			v := int(forwardedBy.Int64)
			fb.ForwardedByUserID = &v
		}
		if forwardedAt.Valid {
			s := forwardedAt.Time.Format("2006-01-02 15:04:05")
			fb.ForwardedAt = &s
		}
		if forwardedByName.Valid && forwardedByName.String != "" {
			fb.ForwardedByName = &forwardedByName.String
		}
		if workingStudentNotes.Valid {
			fb.WorkingStudentNotes = &workingStudentNotes.String
		}
		fb.StudentName = fmt.Sprintf("%s, %s", fb.LastName, fb.FirstName)
		if middleName.Valid {
			fb.StudentName += " " + middleName.String
		}
		fb.DateSubmitted = dateSubmitted.Format("2006-01-02 15:04:05")
		feedbacks = append(feedbacks, fb)
	}
	return feedbacks, nil
}

// getFeedbackByRowRange fetches latest non-archived forwarded feedback from a 1-based row range.
func (a *App) getFeedbackByRowRange(fromRow, toRow int) ([]Feedback, error) {
	if fromRow <= 0 || toRow <= 0 {
		return nil, fmt.Errorf("row range must be greater than zero")
	}
	if fromRow > toRow {
		return nil, fmt.Errorf("from row cannot be greater than to row")
	}
	if toRow > maxActiveFeedbackEntries {
		return nil, fmt.Errorf("to row cannot exceed %d", maxActiveFeedbackEntries)
	}

	offset := fromRow - 1
	count := toRow - fromRow + 1

	query := `
		SELECT
			f.id, f.student_id,
			COALESCE(s.student_id, 'N/A') as student_id_str,
			s.first_name, s.middle_name, s.last_name,
			f.pc_number, f.equipment_condition, f.monitor_condition,
			f.keyboard_condition, f.mouse_condition, f.comments,
			f.date_submitted, f.status,
			COALESCE(f.admin_status, 'pending') as admin_status,
			f.verified_by_user_id, f.verified_at,
			f.forwarded_by_user_id, f.forwarded_at, f.working_student_notes,
			COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name, '') +
				CASE WHEN COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name) IS NOT NULL THEN ', ' ELSE '' END +
				COALESCE(s_fwd.first_name, t_fwd.first_name, a_fwd.first_name, '') +
				CASE WHEN COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name) IS NOT NULL
					THEN ' ' + COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name)
					ELSE '' END
			as forwarded_by_name
		FROM feedback f
		LEFT JOIN students s ON f.student_id = s.id
		LEFT JOIN users u_fwd ON f.forwarded_by_user_id = u_fwd.id
		LEFT JOIN students s_fwd ON u_fwd.id = s_fwd.id AND u_fwd.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t_fwd ON u_fwd.id = t_fwd.id AND u_fwd.user_type = 'teacher'
		LEFT JOIN admins a_fwd ON u_fwd.id = a_fwd.id AND u_fwd.user_type = 'admin'
		WHERE f.status = 'forwarded' AND (f.is_archived = 0 OR f.is_archived IS NULL)
		ORDER BY f.date_submitted DESC
		OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`

	rows, err := a.db.Query(query, offset, count)
	if err != nil {
		return nil, fmt.Errorf("failed to query feedback by row range: %w", err)
	}
	defer rows.Close()

	feedbacks := make([]Feedback, 0, count)
	for rows.Next() {
		var fb Feedback
		var middleName, comments, studentIDStr, forwardedByName, workingStudentNotes sql.NullString
		var dateSubmitted time.Time
		var verifiedBy sql.NullInt64
		var verifiedAt sql.NullTime
		var forwardedBy sql.NullInt64
		var forwardedAt sql.NullTime

		if err := rows.Scan(&fb.ID, &fb.StudentUserID, &studentIDStr, &fb.FirstName, &middleName, &fb.LastName,
			&fb.PCNumber, &fb.EquipmentCondition, &fb.MonitorCondition,
			&fb.KeyboardCondition, &fb.MouseCondition, &comments, &dateSubmitted, &fb.Status, &fb.AdminStatus,
			&verifiedBy, &verifiedAt, &forwardedBy, &forwardedAt, &workingStudentNotes, &forwardedByName); err != nil {
			continue
		}
		if studentIDStr.Valid {
			fb.StudentIDStr = studentIDStr.String
		} else {
			fb.StudentIDStr = "N/A"
		}
		if middleName.Valid {
			fb.MiddleName = &middleName.String
		}
		if comments.Valid {
			fb.Comments = &comments.String
		}
		if verifiedBy.Valid {
			v := int(verifiedBy.Int64)
			fb.VerifiedByUserID = &v
		}
		if verifiedAt.Valid {
			t := verifiedAt.Time.Format("2006-01-02 15:04:05")
			fb.VerifiedAt = &t
		}
		if forwardedBy.Valid {
			v := int(forwardedBy.Int64)
			fb.ForwardedByUserID = &v
		}
		if forwardedAt.Valid {
			s := forwardedAt.Time.Format("2006-01-02 15:04:05")
			fb.ForwardedAt = &s
		}
		if forwardedByName.Valid && forwardedByName.String != "" {
			fb.ForwardedByName = &forwardedByName.String
		}
		if workingStudentNotes.Valid {
			fb.WorkingStudentNotes = &workingStudentNotes.String
		}
		fb.StudentName = fmt.Sprintf("%s, %s", fb.LastName, fb.FirstName)
		if middleName.Valid {
			fb.StudentName += " " + middleName.String
		}
		fb.DateSubmitted = dateSubmitted.Format("2006-01-02 15:04:05")
		feedbacks = append(feedbacks, fb)
	}
	return feedbacks, nil
}

// ExportFeedbackCSVByRowRange exports forwarded feedback within a row range to CSV.
func (a *App) ExportFeedbackCSVByRowRange(fromRow, toRow int, savePath string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	feedbacks, err := a.getFeedbackByRowRange(fromRow, toRow)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("feedback_rows_%d_to_%d_%s.csv", fromRow, toRow, time.Now().Format("150405"))
	filename := resolveExportPath(savePath, defaultName)
	doc := buildActiveFeedbackExportDocumentByRowRange(fromRow, toRow, feedbacks)

	if err := writePrintableCSV(filename, doc); err != nil {
		return "", err
	}
	return filename, nil
}

// ExportFeedbackPDFByRowRange exports forwarded feedback within a row range to PDF.
func (a *App) ExportFeedbackPDFByRowRange(fromRow, toRow int, savePath string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	feedbacks, err := a.getFeedbackByRowRange(fromRow, toRow)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("feedback_rows_%d_to_%d_%s.pdf", fromRow, toRow, time.Now().Format("150405"))
	filename := resolveExportPath(savePath, defaultName)
	doc := buildActiveFeedbackExportDocumentByRowRange(fromRow, toRow, feedbacks)
	if err := writePrintablePDF(filename, doc); err != nil {
		return "", err
	}
	return filename, nil
}

// ExportFeedbackDOCXByRowRange exports forwarded feedback within a row range to DOCX.
func (a *App) ExportFeedbackDOCXByRowRange(fromRow, toRow int, savePath string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	feedbacks, err := a.getFeedbackByRowRange(fromRow, toRow)
	if err != nil {
		return "", err
	}

	doc := buildActiveFeedbackExportDocumentByRowRange(fromRow, toRow, feedbacks)

	data, err := generatePrintableDocx(doc)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("feedback_rows_%d_to_%d_%s.docx", fromRow, toRow, time.Now().Format("150405"))
	filename := resolveExportPath(savePath, defaultName)
	if err := os.WriteFile(filename, data, 0644); err != nil {
		return "", fmt.Errorf("failed to write docx: %w", err)
	}
	return filename, nil
}

// ExportFeedbackCSVByCount exports the latest forwarded feedback to CSV.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportFeedbackCSVByCount(count int, savePath string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	feedbacks, err := a.getFeedbackByCount(count)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("feedback_latest_%d_%s.csv", count, time.Now().Format("150405"))
	filename := resolveExportPath(savePath, defaultName)
	doc := buildActiveFeedbackExportDocumentByCount(count, feedbacks)

	if err := writePrintableCSV(filename, doc); err != nil {
		return "", err
	}
	return filename, nil
}

// ExportFeedbackPDFByCount exports the latest forwarded feedback to PDF.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportFeedbackPDFByCount(count int, savePath string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	feedbacks, err := a.getFeedbackByCount(count)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("feedback_latest_%d_%s.pdf", count, time.Now().Format("150405"))
	filename := resolveExportPath(savePath, defaultName)
	doc := buildActiveFeedbackExportDocumentByCount(count, feedbacks)
	if err := writePrintablePDF(filename, doc); err != nil {
		return "", err
	}
	return filename, nil
}

// ExportFeedbackDOCXByCount exports the latest forwarded feedback to DOCX.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportFeedbackDOCXByCount(count int, savePath string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	feedbacks, err := a.getFeedbackByCount(count)
	if err != nil {
		return "", err
	}

	doc := buildActiveFeedbackExportDocumentByCount(count, feedbacks)

	data, err := generatePrintableDocx(doc)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("feedback_latest_%d_%s.docx", count, time.Now().Format("150405"))
	filename := resolveExportPath(savePath, defaultName)
	if err := os.WriteFile(filename, data, 0644); err != nil {
		return "", fmt.Errorf("failed to write docx: %w", err)
	}
	return filename, nil
}

func buildArchivedFeedbackExportDocument(date string, feedbacks []Feedback) printableExportDocument {
	rows := buildArchivedFeedbackExportRows(feedbacks)
	return printableExportDocument{
		Title:            "Equipment Reports",
		Subtitle:         fmt.Sprintf("Date: %s", date),
		Details:          nil,
		TableNote:        "",
		Headers:          []string{"Date", "Student ID", "Full Name", "PC", "System", "Monitor", "Keyboard", "Mouse"},
		Rows:             rows,
		Footer:           []printableExportField{{Label: "Total Records", Value: strconv.Itoa(len(rows))}},
		ColumnWidths:     []float64{24, 22, 46, 18, 20, 20, 20, 20},
		ColumnAlignments: []string{"L", "L", "L", "L", "L", "L", "L", "L"},
		Orientation:      "P",
		GeneratedAt:      time.Now(),
	}
}

// ExportFeedbackCSVByRange exports feedback within a date range to CSV.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportFeedbackCSVByRange(startDate, endDate string, savePath string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	feedbacks, err := a.getFeedbackByDateRange(startDate, endDate)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("feedback_%s_to_%s_%s.csv", startDate, endDate, time.Now().Format("150405"))
	filename := resolveExportPath(savePath, defaultName)
	doc := buildActiveFeedbackExportDocument(startDate, endDate, feedbacks)

	if err := writePrintableCSV(filename, doc); err != nil {
		return "", err
	}
	return filename, nil
}

// ExportFeedbackPDFByRange exports feedback within a date range to PDF.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportFeedbackPDFByRange(startDate, endDate string, savePath string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	feedbacks, err := a.getFeedbackByDateRange(startDate, endDate)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("feedback_%s_to_%s_%s.pdf", startDate, endDate, time.Now().Format("150405"))
	filename := resolveExportPath(savePath, defaultName)
	doc := buildActiveFeedbackExportDocument(startDate, endDate, feedbacks)
	if err := writePrintablePDF(filename, doc); err != nil {
		return "", err
	}
	return filename, nil
}

// ExportFeedbackDOCXByRange exports feedback within a date range to DOCX.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportFeedbackDOCXByRange(startDate, endDate string, savePath string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	feedbacks, err := a.getFeedbackByDateRange(startDate, endDate)
	if err != nil {
		return "", err
	}

	doc := buildActiveFeedbackExportDocument(startDate, endDate, feedbacks)

	data, err := generatePrintableDocx(doc)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("feedback_%s_to_%s_%s.docx", startDate, endDate, time.Now().Format("150405"))
	filename := resolveExportPath(savePath, defaultName)
	if err := os.WriteFile(filename, data, 0644); err != nil {
		return "", fmt.Errorf("failed to write docx: %w", err)
	}
	return filename, nil
}

// ==============================================================================
// FEEDBACK ARCHIVE FUNCTIONS (DOCUMENT-BASED)
// ==============================================================================

// GetArchivedFeedbackByDate returns all archived feedback for a specific date
func (a *App) GetArchivedFeedbackByDate(date string) ([]Feedback, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			f.id, 
			f.student_id, 
			COALESCE(s.student_id, 'N/A') as student_id_str,
			s.first_name, 
			s.middle_name, 
			s.last_name, 
			f.pc_number, 
			f.equipment_condition, 
			f.monitor_condition, 
			f.keyboard_condition, 
			f.mouse_condition, 
			f.comments, 
			f.date_submitted,
			f.status,
			f.forwarded_by_user_id,
			f.forwarded_at,
			f.working_student_notes,
			COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name, '') + 
				CASE WHEN COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name) IS NOT NULL THEN ', ' ELSE '' END +
				COALESCE(s_fwd.first_name, t_fwd.first_name, a_fwd.first_name, '') +
				CASE WHEN COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name) IS NOT NULL 
					THEN ' ' + COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name) 
					ELSE '' END
			as forwarded_by_name
		FROM feedback f
		LEFT JOIN students s ON f.student_id = s.id
		LEFT JOIN users u_fwd ON f.forwarded_by_user_id = u_fwd.id
		LEFT JOIN students s_fwd ON u_fwd.id = s_fwd.id AND u_fwd.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t_fwd ON u_fwd.id = t_fwd.id AND u_fwd.user_type = 'teacher'
		LEFT JOIN admins a_fwd ON u_fwd.id = a_fwd.id AND u_fwd.user_type = 'admin'
		WHERE f.is_archived = 1 AND CAST(f.date_submitted AS DATE) = ?
		ORDER BY f.date_submitted DESC
	`

	rows, err := a.db.Query(query, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var feedbacks []Feedback
	for rows.Next() {
		var fb Feedback
		var middleName, comments, studentIDStr, forwardedByName, workingStudentNotes sql.NullString
		var dateSubmitted time.Time
		var forwardedBy sql.NullInt64
		var forwardedAt sql.NullTime

		err := rows.Scan(&fb.ID, &fb.StudentUserID, &studentIDStr, &fb.FirstName, &middleName, &fb.LastName,
			&fb.PCNumber, &fb.EquipmentCondition, &fb.MonitorCondition,
			&fb.KeyboardCondition, &fb.MouseCondition, &comments, &dateSubmitted, &fb.Status, &fb.AdminStatus,
			&forwardedBy, &forwardedAt, &workingStudentNotes, &forwardedByName)
		if err != nil {
			continue
		}

		if studentIDStr.Valid {
			fb.StudentIDStr = studentIDStr.String
		} else {
			fb.StudentIDStr = "N/A"
		}
		if middleName.Valid {
			fb.MiddleName = &middleName.String
		}
		if comments.Valid {
			fb.Comments = &comments.String
		}
		if forwardedBy.Valid {
			forwardedByInt := int(forwardedBy.Int64)
			fb.ForwardedByUserID = &forwardedByInt
		}
		if forwardedAt.Valid {
			forwardedAtStr := forwardedAt.Time.Format("2006-01-02 15:04:05")
			fb.ForwardedAt = &forwardedAtStr
		}
		if forwardedByName.Valid && forwardedByName.String != "" {
			fb.ForwardedByName = &forwardedByName.String
		}
		if workingStudentNotes.Valid {
			fb.WorkingStudentNotes = &workingStudentNotes.String
		}

		fb.StudentName = fmt.Sprintf("%s, %s", fb.LastName, fb.FirstName)
		if middleName.Valid {
			fb.StudentName += " " + middleName.String
		}
		fb.DateSubmitted = dateSubmitted.Format("2006-01-02 15:04:05")

		feedbacks = append(feedbacks, fb)
	}

	log.Printf("GetArchivedFeedbackByDate(%s) returning %d feedbacks", date, len(feedbacks))
	return feedbacks, nil
}

// ArchiveFeedbackByDate archives all feedback for a specific date
func (a *App) ArchiveFeedbackByDate(date string, adminUserID int) (int, error) {
	if err := a.checkDB(); err != nil {
		return 0, err
	}

	query := `UPDATE feedback 
		SET is_archived = 1, 
		    archived_at = GETDATE(), 
		    archived_by_user_id = ?
		WHERE CAST(date_submitted AS DATE) = ? AND status = 'forwarded' AND (is_archived = 0 OR is_archived IS NULL)`

	result, err := a.db.Exec(query, adminUserID, date)
	if err != nil {
		log.Printf("Failed to archive feedback by date: %v", err)
		return 0, fmt.Errorf("failed to archive feedback: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	log.Printf("%d feedback archived for date %s by admin %d", rowsAffected, date, adminUserID)
	return int(rowsAffected), nil
}

// ExportArchivedFeedbackSheetCSV exports archived feedback for a specific date to CSV.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportArchivedFeedbackSheetCSV(date string, savePath string) (string, error) {
	feedbacks, err := a.GetArchivedFeedbackByDate(date)
	if err != nil {
		return "", err
	}

	if len(feedbacks) == 0 {
		return "", fmt.Errorf("no archived feedback for date %s", date)
	}

	defaultName := fmt.Sprintf("equipment_reports_%s.csv", date)
	filename := resolveExportPath(savePath, defaultName)
	doc := buildArchivedFeedbackExportDocument(date, feedbacks)

	if err := writePrintableCSV(filename, doc); err != nil {
		return "", err
	}

	return filename, nil
}

// ExportArchivedFeedbackSheetPDF exports archived feedback for a specific date to PDF.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportArchivedFeedbackSheetPDF(date string, savePath string) (string, error) {
	feedbacks, err := a.GetArchivedFeedbackByDate(date)
	if err != nil {
		return "", err
	}

	if len(feedbacks) == 0 {
		return "", fmt.Errorf("no archived feedback for date %s", date)
	}

	defaultName := fmt.Sprintf("equipment_reports_%s.pdf", date)
	filename := resolveExportPath(savePath, defaultName)
	doc := buildArchivedFeedbackExportDocument(date, feedbacks)
	if err := writePrintablePDF(filename, doc); err != nil {
		return "", err
	}
	return filename, nil
}

// ExportArchivedFeedbackSheetDOCX exports archived feedback for a specific date to DOCX.
// If savePath is non-empty, the file is saved there; otherwise it is saved to the user's Downloads folder.
func (a *App) ExportArchivedFeedbackSheetDOCX(date string, savePath string) (string, error) {
	feedbacks, err := a.GetArchivedFeedbackByDate(date)
	if err != nil {
		return "", err
	}

	if len(feedbacks) == 0 {
		return "", fmt.Errorf("no archived feedback for date %s", date)
	}
	doc := buildArchivedFeedbackExportDocument(date, feedbacks)

	data, err := generatePrintableDocx(doc)
	if err != nil {
		return "", err
	}

	defaultName := fmt.Sprintf("equipment_reports_%s.docx", date)
	filename := resolveExportPath(savePath, defaultName)
	if err := os.WriteFile(filename, data, 0644); err != nil {
		return "", fmt.Errorf("failed to write docx: %w", err)
	}

	return filename, nil
}

// Legacy function kept for backwards compatibility - returns all archived feedback
func (a *App) GetArchivedFeedback() ([]Feedback, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			f.id, 
			f.student_id, 
			COALESCE(s.student_id, 'N/A') as student_id_str,
			s.first_name, 
			s.middle_name, 
			s.last_name, 
			f.pc_number, 
			f.equipment_condition, 
			f.monitor_condition, 
			f.keyboard_condition, 
			f.mouse_condition, 
			f.comments, 
			f.date_submitted,
			f.status,
			f.forwarded_by_user_id,
			f.forwarded_at,
			f.working_student_notes,
			COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name, '') + 
				CASE WHEN COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name) IS NOT NULL THEN ', ' ELSE '' END +
				COALESCE(s_fwd.first_name, t_fwd.first_name, a_fwd.first_name, '') +
				CASE WHEN COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name) IS NOT NULL 
					THEN ' ' + COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name) 
					ELSE '' END
			as forwarded_by_name
		FROM feedback f
		LEFT JOIN students s ON f.student_id = s.id
		LEFT JOIN users u_fwd ON f.forwarded_by_user_id = u_fwd.id
		LEFT JOIN students s_fwd ON u_fwd.id = s_fwd.id AND u_fwd.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t_fwd ON u_fwd.id = t_fwd.id AND u_fwd.user_type = 'teacher'
		LEFT JOIN admins a_fwd ON u_fwd.id = a_fwd.id AND u_fwd.user_type = 'admin'
		WHERE f.is_archived = 1
		ORDER BY f.archived_at DESC, f.date_submitted DESC`
	rows, err := a.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var feedbacks []Feedback
	for rows.Next() {
		var fb Feedback
		var middleName, comments, studentIDStr, forwardedByName, workingStudentNotes sql.NullString
		var dateSubmitted time.Time
		var forwardedBy sql.NullInt64
		var forwardedAt sql.NullTime

		err := rows.Scan(&fb.ID, &fb.StudentUserID, &studentIDStr, &fb.FirstName, &middleName, &fb.LastName,
			&fb.PCNumber, &fb.EquipmentCondition, &fb.MonitorCondition,
			&fb.KeyboardCondition, &fb.MouseCondition, &comments, &dateSubmitted, &fb.Status, &fb.AdminStatus,
			&forwardedBy, &forwardedAt, &workingStudentNotes, &forwardedByName)
		if err != nil {
			continue
		}

		if studentIDStr.Valid {
			fb.StudentIDStr = studentIDStr.String
		} else {
			fb.StudentIDStr = "N/A"
		}
		if middleName.Valid {
			fb.MiddleName = &middleName.String
		}
		if comments.Valid {
			fb.Comments = &comments.String
		}
		if forwardedBy.Valid {
			forwardedByInt := int(forwardedBy.Int64)
			fb.ForwardedByUserID = &forwardedByInt
		}
		if forwardedAt.Valid {
			forwardedAtStr := forwardedAt.Time.Format("2006-01-02 15:04:05")
			fb.ForwardedAt = &forwardedAtStr
		}
		if forwardedByName.Valid && forwardedByName.String != "" {
			fb.ForwardedByName = &forwardedByName.String
		}
		if workingStudentNotes.Valid {
			fb.WorkingStudentNotes = &workingStudentNotes.String
		}

		fb.StudentName = fmt.Sprintf("%s, %s", fb.LastName, fb.FirstName)
		if middleName.Valid {
			fb.StudentName += " " + middleName.String
		}
		fb.DateSubmitted = dateSubmitted.Format("2006-01-02 15:04:05")

		feedbacks = append(feedbacks, fb)
	}

	return feedbacks, nil
}

// ArchiveFeedback archives selected feedback by their IDs
func (a *App) ArchiveFeedback(feedbackIDs []int, adminUserID int) (int, error) {
	if err := a.checkDB(); err != nil {
		return 0, err
	}

	if len(feedbackIDs) == 0 {
		return 0, fmt.Errorf("no feedback IDs provided")
	}
	if err := ValidatePositiveIDs(feedbackIDs, "feedback ID"); err != nil {
		return 0, err
	}
	if err := ValidatePositiveID(adminUserID, "admin user ID"); err != nil {
		return 0, err
	}

	// Build placeholders for the IN clause
	placeholders := make([]string, len(feedbackIDs))
	args := make([]interface{}, 0, len(feedbackIDs)+1)

	// Add admin user ID first (for SET clause)
	args = append(args, adminUserID)

	// Add feedback IDs for WHERE clause
	for i, id := range feedbackIDs {
		placeholders[i] = "?"
		args = append(args, id)
	}

	query := fmt.Sprintf(`UPDATE feedback 
		SET is_archived = 1, 
		    archived_at = GETDATE(), 
		    archived_by_user_id = ?
		WHERE id IN (%s) AND is_archived = 0`, strings.Join(placeholders, ","))

	result, err := a.db.Exec(query, args...)
	if err != nil {
		log.Printf("Failed to archive feedback: %v", err)
		return 0, fmt.Errorf("failed to archive feedback: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	log.Printf("%d feedback items archived by admin %d", rowsAffected, adminUserID)
	return int(rowsAffected), nil
}
