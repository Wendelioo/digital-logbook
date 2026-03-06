package backend

import (
	"database/sql"
	"encoding/csv"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
)

// ==============================================================================
// FEEDBACK MANAGEMENT
// ==============================================================================

const maxActiveFeedbackEntries = 10000

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
		var verifiedBy sql.NullInt64
		var verifiedAt sql.NullTime
		var forwardedBy sql.NullInt64
		var forwardedAt sql.NullTime

		err := rows.Scan(&fb.ID, &fb.StudentUserID, &studentIDStr, &fb.FirstName, &middleName, &fb.LastName,
			&fb.PCNumber, &fb.EquipmentCondition, &fb.MonitorCondition,
			&fb.KeyboardCondition, &fb.MouseCondition, &comments, &dateSubmitted, &fb.Status,
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

	// Workflow status:
	// All feedback (with or without issues) starts as "pending" so that
	// working students can review and then forward it to the admin.
	status := "pending"

	query := `INSERT INTO feedback (student_id, pc_number, 
			  equipment_condition, monitor_condition, keyboard_condition, mouse_condition, 
			  comments, priority, status, date_submitted) 
			  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())`

	_, err := a.db.Exec(query, userID, pcNumber,
		equipmentCondition, monitorCondition, keyboardCondition, mouseCondition, nullString(combinedComments), priority, status)

	if err != nil {
		log.Printf("Failed to save equipment feedback: %v", err)
		return fmt.Errorf("failed to save feedback: %w", err)
	}

	log.Printf("Equipment feedback saved for user %d", userID)
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
	return int(rowsAffected), nil
}

// ==============================================================================
// FEEDBACK EXPORT FUNCTIONS
// ==============================================================================

// ExportFeedbackCSV exports feedback to CSV
func (a *App) ExportFeedbackCSV() (string, error) {
	feedbacks, err := a.GetFeedback()
	if err != nil {
		return "", err
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("feedback_%s.csv", time.Now().Format("20060102_150405")))

	file, err := os.Create(filename)
	if err != nil {
		return "", err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// Write header
	writer.Write([]string{"ID", "Student Name", "Student ID", "PC Number", "Equipment", "Monitor", "Keyboard", "Mouse", "Comments", "Date"})

	// Write data
	for _, fb := range feedbacks {
		comments := ""
		if fb.Comments != nil {
			comments = *fb.Comments
		}

		writer.Write([]string{
			strconv.Itoa(fb.ID),
			fb.StudentName,
			fb.StudentIDStr,
			fb.PCNumber,
			fb.EquipmentCondition,
			fb.MonitorCondition,
			fb.KeyboardCondition,
			fb.MouseCondition,
			comments,
			fb.DateSubmitted,
		})
	}

	return filename, nil
}

// ExportFeedbackPDF exports feedback to PDF
func (a *App) ExportFeedbackPDF() (string, error) {
	feedbacks, err := a.GetFeedback()
	if err != nil {
		return "", err
	}

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 16)
	pdf.Cell(0, 10, "Equipment Feedback Report")
	pdf.Ln(12)

	pdf.SetFont("Arial", "B", 8)
	pdf.Cell(15, 7, "ID")
	pdf.Cell(45, 7, "Student Name")
	pdf.Cell(25, 7, "PC Number")
	pdf.Cell(30, 7, "Equipment")
	pdf.Cell(30, 7, "Monitor")
	pdf.Cell(30, 7, "Keyboard")
	pdf.Cell(30, 7, "Mouse")
	pdf.Cell(60, 7, "Date")
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 7)
	for _, fb := range feedbacks {
		pdf.Cell(15, 6, strconv.Itoa(fb.ID))
		pdf.Cell(45, 6, fb.StudentName)
		pdf.Cell(25, 6, fb.PCNumber)
		pdf.Cell(30, 6, fb.EquipmentCondition)
		pdf.Cell(30, 6, fb.MonitorCondition)
		pdf.Cell(30, 6, fb.KeyboardCondition)
		pdf.Cell(30, 6, fb.MouseCondition)
		pdf.Cell(60, 6, fb.DateSubmitted)
		pdf.Ln(-1)
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("feedback_%s.pdf", time.Now().Format("20060102_150405")))
	err = pdf.OutputFileAndClose(filename)
	return filename, err
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
			&fb.KeyboardCondition, &fb.MouseCondition, &comments, &dateSubmitted, &fb.Status,
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

// ExportFeedbackCSVByRange exports feedback within a date range to CSV.
func (a *App) ExportFeedbackCSVByRange(startDate, endDate string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	feedbacks, err := a.getFeedbackByDateRange(startDate, endDate)
	if err != nil {
		return "", err
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("feedback_%s_to_%s_%s.csv", startDate, endDate, time.Now().Format("150405")))
	file, err := os.Create(filename)
	if err != nil {
		return "", err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	writer.Write([]string{"ID", "Student Name", "Student ID", "PC Number", "Equipment", "Monitor", "Keyboard", "Mouse", "Status", "Date Submitted", "Forwarded By"})
	for _, fb := range feedbacks {
		comments := ""
		if fb.Comments != nil {
			comments = *fb.Comments
		}
		fwdBy := ""
		if fb.ForwardedByName != nil {
			fwdBy = *fb.ForwardedByName
		}
		_ = comments
		writer.Write([]string{
			strconv.Itoa(fb.ID), fb.StudentName, fb.StudentIDStr, fb.PCNumber,
			fb.EquipmentCondition, fb.MonitorCondition, fb.KeyboardCondition, fb.MouseCondition,
			fb.Status, fb.DateSubmitted, fwdBy,
		})
	}
	return filename, nil
}

// ExportFeedbackPDFByRange exports feedback within a date range to PDF.
func (a *App) ExportFeedbackPDFByRange(startDate, endDate string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	feedbacks, err := a.getFeedbackByDateRange(startDate, endDate)
	if err != nil {
		return "", err
	}

	pdf := gofpdf.New("L", "mm", "A4", "")
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 14)
	pdf.Cell(0, 10, fmt.Sprintf("Equipment Reports: %s to %s", startDate, endDate))
	pdf.Ln(12)

	pdf.SetFont("Arial", "B", 8)
	pdf.SetFillColor(31, 56, 100)
	pdf.SetTextColor(255, 255, 255)
	cols := []struct {
		label string
		width float64
	}{
		{"Student Name", 55}, {"Student ID", 28}, {"PC", 20}, {"Equipment", 25}, {"Monitor", 25}, {"Keyboard", 25}, {"Mouse", 25}, {"Status", 20}, {"Date", 40}, {"Forwarded By", 37},
	}
	for _, c := range cols {
		pdf.CellFormat(c.width, 7, c.label, "1", 0, "", true, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 7)
	pdf.SetTextColor(0, 0, 0)
	for i, fb := range feedbacks {
		if i%2 == 0 {
			pdf.SetFillColor(255, 255, 255)
		} else {
			pdf.SetFillColor(220, 230, 241)
		}
		fwdBy := ""
		if fb.ForwardedByName != nil {
			fwdBy = *fb.ForwardedByName
		}
		pdf.CellFormat(55, 6, fb.StudentName, "1", 0, "", true, 0, "")
		pdf.CellFormat(28, 6, fb.StudentIDStr, "1", 0, "", true, 0, "")
		pdf.CellFormat(20, 6, fb.PCNumber, "1", 0, "", true, 0, "")
		pdf.CellFormat(25, 6, fb.EquipmentCondition, "1", 0, "", true, 0, "")
		pdf.CellFormat(25, 6, fb.MonitorCondition, "1", 0, "", true, 0, "")
		pdf.CellFormat(25, 6, fb.KeyboardCondition, "1", 0, "", true, 0, "")
		pdf.CellFormat(25, 6, fb.MouseCondition, "1", 0, "", true, 0, "")
		pdf.CellFormat(20, 6, fb.Status, "1", 0, "", true, 0, "")
		pdf.CellFormat(40, 6, fb.DateSubmitted, "1", 0, "", true, 0, "")
		pdf.CellFormat(37, 6, fwdBy, "1", 0, "", true, 0, "")
		pdf.Ln(-1)
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("feedback_%s_to_%s_%s.pdf", startDate, endDate, time.Now().Format("150405")))
	err = pdf.OutputFileAndClose(filename)
	return filename, err
}

// ExportFeedbackDOCXByRange exports feedback within a date range to DOCX.
func (a *App) ExportFeedbackDOCXByRange(startDate, endDate string) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	feedbacks, err := a.getFeedbackByDateRange(startDate, endDate)
	if err != nil {
		return "", err
	}

	headers := []string{"Student Name", "Student ID", "PC", "Equipment", "Monitor", "Keyboard", "Mouse", "Date Submitted", "Forwarded By"}
	var rows [][]string
	for _, fb := range feedbacks {
		fwdBy := ""
		if fb.ForwardedByName != nil {
			fwdBy = *fb.ForwardedByName
		}
		rows = append(rows, []string{fb.StudentName, fb.StudentIDStr, fb.PCNumber,
			fb.EquipmentCondition, fb.MonitorCondition, fb.KeyboardCondition, fb.MouseCondition,
			fb.DateSubmitted, fwdBy})
	}

	data, err := generateDocx(fmt.Sprintf("Equipment Reports: %s to %s", startDate, endDate), headers, rows)
	if err != nil {
		return "", err
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("feedback_%s_to_%s_%s.docx", startDate, endDate, time.Now().Format("150405")))
	if err := os.WriteFile(filename, data, 0644); err != nil {
		return "", fmt.Errorf("failed to write docx: %w", err)
	}
	return filename, nil
}

// ==============================================================================
// FEEDBACK ARCHIVE FUNCTIONS (DOCUMENT-BASED)
// ==============================================================================

// ArchivedFeedbackSheet represents a summary of archived feedback for a specific date
type ArchivedFeedbackSheet struct {
	Date           string `json:"date"`
	TotalReports   int    `json:"total_reports"`
	GoodCount      int    `json:"good_count"`
	IssueCount     int    `json:"issue_count"`
	UniquePCs      int    `json:"unique_pcs"`
	UniqueStudents int    `json:"unique_students"`
}

// GetArchivedFeedbackSheets returns all archived feedback sheets grouped by date
func (a *App) GetArchivedFeedbackSheets() ([]ArchivedFeedbackSheet, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			CAST(f.date_submitted AS DATE) as feedback_date,
			COUNT(*) as total_reports,
			SUM(CASE WHEN f.equipment_condition = 'Good' AND f.monitor_condition = 'Good' 
			         AND f.keyboard_condition = 'Good' AND f.mouse_condition = 'Good' THEN 1 ELSE 0 END) as good_count,
			SUM(CASE WHEN f.equipment_condition != 'Good' OR f.monitor_condition != 'Good' 
			         OR f.keyboard_condition != 'Good' OR f.mouse_condition != 'Good' THEN 1 ELSE 0 END) as issue_count,
			COUNT(DISTINCT f.pc_number) as unique_pcs,
			COUNT(DISTINCT f.student_id) as unique_students
		FROM feedback f
		WHERE f.is_archived = 1
		GROUP BY CAST(f.date_submitted AS DATE)
		ORDER BY feedback_date DESC
	`

	rows, err := a.db.Query(query)
	if err != nil {
		log.Printf("Failed to query archived feedback sheets: %v", err)
		return nil, err
	}
	defer rows.Close()

	var sheets []ArchivedFeedbackSheet
	for rows.Next() {
		var sheet ArchivedFeedbackSheet
		err := rows.Scan(
			&sheet.Date, &sheet.TotalReports,
			&sheet.GoodCount, &sheet.IssueCount,
			&sheet.UniquePCs, &sheet.UniqueStudents,
		)
		if err != nil {
			log.Printf("Failed to scan archived feedback sheet: %v", err)
			continue
		}
		sheets = append(sheets, sheet)
	}

	log.Printf("GetArchivedFeedbackSheets returning %d sheets", len(sheets))
	return sheets, nil
}

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
			&fb.KeyboardCondition, &fb.MouseCondition, &comments, &dateSubmitted, &fb.Status,
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

// UnarchiveFeedbackSheet unarchives all feedback for a specific date
func (a *App) UnarchiveFeedbackSheet(date string) (int, error) {
	if err := a.checkDB(); err != nil {
		return 0, err
	}

	query := `UPDATE feedback 
		SET is_archived = 0, 
		    archived_at = NULL, 
		    archived_by_user_id = NULL
		WHERE CAST(date_submitted AS DATE) = ? AND is_archived = 1`

	result, err := a.db.Exec(query, date)
	if err != nil {
		log.Printf("Failed to unarchive feedback sheet: %v", err)
		return 0, fmt.Errorf("failed to unarchive feedback: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	log.Printf("%d feedback unarchived for date %s", rowsAffected, date)
	return int(rowsAffected), nil
}

// GetFeedbackDates returns distinct dates with available (non-archived) feedback
func (a *App) GetFeedbackDates() ([]string, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT DISTINCT CAST(date_submitted AS DATE) as feedback_date
		FROM feedback
		WHERE status = 'forwarded' AND (is_archived = 0 OR is_archived IS NULL)
		ORDER BY feedback_date DESC
	`

	rows, err := a.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var dates []string
	for rows.Next() {
		var date string
		if err := rows.Scan(&date); err != nil {
			continue
		}
		dates = append(dates, date)
	}

	return dates, nil
}

// ExportArchivedFeedbackSheetCSV exports archived feedback for a specific date to CSV
func (a *App) ExportArchivedFeedbackSheetCSV(date string) (string, error) {
	feedbacks, err := a.GetArchivedFeedbackByDate(date)
	if err != nil {
		return "", err
	}

	if len(feedbacks) == 0 {
		return "", fmt.Errorf("no archived feedback for date %s", date)
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("equipment_reports_%s.csv", date))

	file, err := os.Create(filename)
	if err != nil {
		return "", err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// Write header
	writer.Write([]string{"ID", "Student Name", "Student ID", "PC Number", "Equipment", "Monitor", "Keyboard", "Mouse", "Comments", "Date"})

	// Write data
	for _, fb := range feedbacks {
		comments := ""
		if fb.Comments != nil {
			comments = *fb.Comments
		}

		writer.Write([]string{
			strconv.Itoa(fb.ID),
			fb.StudentName,
			fb.StudentIDStr,
			fb.PCNumber,
			fb.EquipmentCondition,
			fb.MonitorCondition,
			fb.KeyboardCondition,
			fb.MouseCondition,
			comments,
			fb.DateSubmitted,
		})
	}

	return filename, nil
}

// ExportArchivedFeedbackSheetPDF exports archived feedback for a specific date to PDF
func (a *App) ExportArchivedFeedbackSheetPDF(date string) (string, error) {
	feedbacks, err := a.GetArchivedFeedbackByDate(date)
	if err != nil {
		return "", err
	}

	if len(feedbacks) == 0 {
		return "", fmt.Errorf("no archived feedback for date %s", date)
	}

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 16)
	pdf.Cell(0, 10, fmt.Sprintf("Equipment Feedback Report - %s", date))
	pdf.Ln(12)

	pdf.SetFont("Arial", "", 10)
	pdf.Cell(0, 6, fmt.Sprintf("Generated: %s", time.Now().Format("January 02, 2006 3:04 PM")))
	pdf.Ln(10)

	pdf.SetFont("Arial", "B", 8)
	pdf.Cell(15, 7, "ID")
	pdf.Cell(45, 7, "Student Name")
	pdf.Cell(25, 7, "PC Number")
	pdf.Cell(30, 7, "Equipment")
	pdf.Cell(30, 7, "Monitor")
	pdf.Cell(30, 7, "Keyboard")
	pdf.Cell(30, 7, "Mouse")
	pdf.Cell(60, 7, "Date")
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 7)
	for _, fb := range feedbacks {
		pdf.Cell(15, 6, strconv.Itoa(fb.ID))
		pdf.Cell(45, 6, truncateString(fb.StudentName, 22))
		pdf.Cell(25, 6, fb.PCNumber)
		pdf.Cell(30, 6, fb.EquipmentCondition)
		pdf.Cell(30, 6, fb.MonitorCondition)
		pdf.Cell(30, 6, fb.KeyboardCondition)
		pdf.Cell(30, 6, fb.MouseCondition)
		pdf.Cell(60, 6, fb.DateSubmitted)
		pdf.Ln(-1)
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("equipment_reports_%s.pdf", date))
	err = pdf.OutputFileAndClose(filename)
	return filename, err
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
			&fb.KeyboardCondition, &fb.MouseCondition, &comments, &dateSubmitted, &fb.Status,
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

// UnarchiveFeedback unarchives selected feedback by their IDs
func (a *App) UnarchiveFeedback(feedbackIDs []int) (int, error) {
	if err := a.checkDB(); err != nil {
		return 0, err
	}

	if len(feedbackIDs) == 0 {
		return 0, fmt.Errorf("no feedback IDs provided")
	}
	if err := ValidatePositiveIDs(feedbackIDs, "feedback ID"); err != nil {
		return 0, err
	}

	// Build placeholders for the IN clause
	placeholders := make([]string, len(feedbackIDs))
	args := make([]interface{}, len(feedbackIDs))

	for i, id := range feedbackIDs {
		placeholders[i] = "?"
		args[i] = id
	}

	query := fmt.Sprintf(`UPDATE feedback 
		SET is_archived = 0, 
		    archived_at = NULL, 
		    archived_by_user_id = NULL
		WHERE id IN (%s) AND is_archived = 1`, strings.Join(placeholders, ","))

	result, err := a.db.Exec(query, args...)
	if err != nil {
		log.Printf("Failed to unarchive feedback: %v", err)
		return 0, fmt.Errorf("failed to unarchive feedback: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	log.Printf("%d feedback items unarchived", rowsAffected)
	return int(rowsAffected), nil
}

// ExportArchivedFeedbackCSV exports only archived feedback to CSV
func (a *App) ExportArchivedFeedbackCSV() (string, error) {
	feedbacks, err := a.GetArchivedFeedback()
	if err != nil {
		return "", err
	}

	if len(feedbacks) == 0 {
		return "", fmt.Errorf("no archived feedback to export")
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("archived_feedback_%s.csv", time.Now().Format("20060102_150405")))

	file, err := os.Create(filename)
	if err != nil {
		return "", err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// Write header
	writer.Write([]string{"ID", "Student Name", "Student ID", "PC Number", "Equipment", "Monitor", "Keyboard", "Mouse", "Comments", "Date Submitted", "Forwarded By", "Notes"})

	// Write data
	for _, fb := range feedbacks {
		comments := ""
		if fb.Comments != nil {
			comments = *fb.Comments
		}
		forwardedBy := ""
		if fb.ForwardedByName != nil {
			forwardedBy = *fb.ForwardedByName
		}
		notes := ""
		if fb.WorkingStudentNotes != nil {
			notes = *fb.WorkingStudentNotes
		}

		writer.Write([]string{
			strconv.Itoa(fb.ID),
			fb.StudentName,
			fb.StudentIDStr,
			fb.PCNumber,
			fb.EquipmentCondition,
			fb.MonitorCondition,
			fb.KeyboardCondition,
			fb.MouseCondition,
			comments,
			fb.DateSubmitted,
			forwardedBy,
			notes,
		})
	}

	return filename, nil
}

// ExportArchivedFeedbackPDF exports only archived feedback to PDF
func (a *App) ExportArchivedFeedbackPDF() (string, error) {
	feedbacks, err := a.GetArchivedFeedback()
	if err != nil {
		return "", err
	}

	if len(feedbacks) == 0 {
		return "", fmt.Errorf("no archived feedback to export")
	}

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 16)
	pdf.Cell(0, 10, "Archived Equipment Feedback Report")
	pdf.Ln(12)

	// Add generation date
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(0, 6, fmt.Sprintf("Generated: %s", time.Now().Format("January 02, 2006 3:04 PM")))
	pdf.Ln(10)

	pdf.SetFont("Arial", "B", 8)
	pdf.Cell(15, 7, "ID")
	pdf.Cell(45, 7, "Student Name")
	pdf.Cell(25, 7, "PC Number")
	pdf.Cell(28, 7, "Equipment")
	pdf.Cell(28, 7, "Monitor")
	pdf.Cell(28, 7, "Keyboard")
	pdf.Cell(28, 7, "Mouse")
	pdf.Cell(50, 7, "Date Submitted")
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 7)
	for _, fb := range feedbacks {
		pdf.Cell(15, 6, strconv.Itoa(fb.ID))
		pdf.Cell(45, 6, fb.StudentName)
		pdf.Cell(25, 6, fb.PCNumber)
		pdf.Cell(28, 6, fb.EquipmentCondition)
		pdf.Cell(28, 6, fb.MonitorCondition)
		pdf.Cell(28, 6, fb.KeyboardCondition)
		pdf.Cell(28, 6, fb.MouseCondition)
		pdf.Cell(50, 6, fb.DateSubmitted)
		pdf.Ln(-1)
	}

	homeDir, _ := os.UserHomeDir()
	filename := filepath.Join(homeDir, "Downloads", fmt.Sprintf("archived_feedback_%s.pdf", time.Now().Format("20060102_150405")))
	err = pdf.OutputFileAndClose(filename)
	return filename, err
}
