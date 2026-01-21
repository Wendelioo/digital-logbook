package main

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

// GetFeedback returns all non-archived feedback that has been forwarded to admin
func (a *App) GetFeedback() ([]Feedback, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	// Only returns non-archived feedback (is_archived = FALSE or NULL for backwards compatibility)
	query := `
		SELECT 
			f.id, 
			f.student_user_id, 
			COALESCE(s.student_number, 'N/A') as student_id_str,
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
			CONCAT(
				COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name, ''), 
				CASE WHEN COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name) IS NOT NULL THEN ', ' ELSE '' END,
				COALESCE(s_fwd.first_name, t_fwd.first_name, a_fwd.first_name, ''),
				CASE WHEN COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name) IS NOT NULL 
					THEN CONCAT(' ', COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name)) 
					ELSE '' END
			) as forwarded_by_name
		FROM feedback f
		LEFT JOIN students s ON f.student_user_id = s.user_id
		LEFT JOIN users u_fwd ON f.forwarded_by_user_id = u_fwd.id
		LEFT JOIN students s_fwd ON u_fwd.id = s_fwd.user_id AND u_fwd.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t_fwd ON u_fwd.id = t_fwd.user_id AND u_fwd.user_type = 'teacher'
		LEFT JOIN admins a_fwd ON u_fwd.id = a_fwd.user_id AND u_fwd.user_type = 'admin'
		WHERE f.status = 'forwarded' AND (f.is_archived = FALSE OR f.is_archived IS NULL)
		ORDER BY f.date_submitted DESC 
		LIMIT 1000`
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

// GetStudentFeedback returns feedback history for a specific student
func (a *App) GetStudentFeedback(studentID int) ([]Feedback, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			f.id, 
			f.student_user_id, 
			COALESCE(s.student_number, 'N/A') as student_id_str,
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
		LEFT JOIN students s ON f.student_user_id = s.user_id
		WHERE f.student_user_id = ? 
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

// SaveEquipmentFeedback saves equipment feedback from a student
func (a *App) SaveEquipmentFeedback(userID int, userName, computerStatus, computerIssue, mouseStatus, mouseIssue, keyboardStatus, keyboardIssue, monitorStatus, monitorIssue, additionalComments string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Get the hostname (PC number) of this device
	hostname, err := os.Hostname()
	if err != nil {
		log.Printf("⚠ Failed to get hostname: %v", err)
		hostname = "Unknown"
	}
	pcNumber := hostname

	// Determine equipment conditions based on status
	// ENUM values: 'Good', 'Minor Issue', 'Not Working'
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

	combinedComments := ""
	if len(commentsParts) > 0 {
		combinedComments = commentsParts[0]
		for i := 1; i < len(commentsParts); i++ {
			combinedComments = fmt.Sprintf("%s; %s", combinedComments, commentsParts[i])
		}
	}

	// Insert feedback into database
	query := `INSERT INTO feedback (student_user_id, pc_number, 
			  equipment_condition, monitor_condition, keyboard_condition, mouse_condition, 
			  comments, date_submitted) 
			  VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`

	_, err = a.db.Exec(query, userID, pcNumber,
		equipmentCondition, monitorCondition, keyboardCondition, mouseCondition, nullString(combinedComments))

	if err != nil {
		log.Printf("Failed to save equipment feedback: %v", err)
		return fmt.Errorf("failed to save feedback: %w", err)
	}

	log.Printf("✓ Equipment feedback saved for user %d", userID)
	return nil
}

// GetPendingFeedback returns all pending feedback for working students to review
func (a *App) GetPendingFeedback() ([]Feedback, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			f.id, 
			f.student_user_id, 
			COALESCE(s.student_number, 'N/A') as student_id_str,
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
		LEFT JOIN students s ON f.student_user_id = s.user_id
		WHERE f.status = 'pending'
		ORDER BY f.date_submitted DESC 
		LIMIT 1000`
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

// ForwardFeedbackToAdmin forwards feedback from working student to admin
func (a *App) ForwardFeedbackToAdmin(feedbackID int, workingStudentID int, notes string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Update feedback to forwarded status
	query := `UPDATE feedback 
			  SET status = 'forwarded', 
			      forwarded_by_user_id = ?, 
			      forwarded_at = NOW(), 
			      working_student_notes = ?
			  WHERE id = ? AND status = 'pending'`

	result, err := a.db.Exec(query, workingStudentID, nullString(notes), feedbackID)
	if err != nil {
		log.Printf("⚠ Failed to forward feedback %d: %v", feedbackID, err)
		return fmt.Errorf("failed to forward feedback: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("feedback not found or already forwarded")
	}

	log.Printf("✓ Feedback %d forwarded to admin by working student %d", feedbackID, workingStudentID)
	return nil
}

// ForwardMultipleFeedbackToAdmin forwards multiple feedback items from working student to admin in batch
func (a *App) ForwardMultipleFeedbackToAdmin(feedbackIDs []int, workingStudentID int, notes string) (int, error) {
	if a.db == nil {
		return 0, fmt.Errorf("database not connected")
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

	// Update all feedback items to forwarded status in a single query
	query := fmt.Sprintf(`UPDATE feedback 
			  SET status = 'forwarded', 
			      forwarded_by_user_id = ?, 
			      forwarded_at = NOW(), 
			      working_student_notes = ?
			  WHERE id IN (%s) AND status = 'pending'`, strings.Join(placeholders, ","))

	result, err := a.db.Exec(query, args...)
	if err != nil {
		log.Printf("⚠ Failed to forward multiple feedback: %v", err)
		return 0, fmt.Errorf("failed to forward feedback: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	if rowsAffected == 0 {
		return 0, fmt.Errorf("no feedback items were forwarded (may already be forwarded or not found)")
	}

	log.Printf("✓ %d feedback items forwarded to admin by working student %d", rowsAffected, workingStudentID)
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

	pdf := gofpdf.New("L", "mm", "A4", "")
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
// FEEDBACK ARCHIVE FUNCTIONS (DOCUMENT-BASED)
// ==============================================================================

// ArchivedFeedbackSheet represents a summary of archived feedback for a specific date
type ArchivedFeedbackSheet struct {
	Date          string `json:"date"`
	TotalReports  int    `json:"total_reports"`
	GoodCount     int    `json:"good_count"`
	IssueCount    int    `json:"issue_count"`
	UniquePCs     int    `json:"unique_pcs"`
	UniqueStudents int   `json:"unique_students"`
}

// GetArchivedFeedbackSheets returns all archived feedback sheets grouped by date
func (a *App) GetArchivedFeedbackSheets() ([]ArchivedFeedbackSheet, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			DATE(f.date_submitted) as feedback_date,
			COUNT(*) as total_reports,
			SUM(CASE WHEN f.equipment_condition = 'Good' AND f.monitor_condition = 'Good' 
			         AND f.keyboard_condition = 'Good' AND f.mouse_condition = 'Good' THEN 1 ELSE 0 END) as good_count,
			SUM(CASE WHEN f.equipment_condition != 'Good' OR f.monitor_condition != 'Good' 
			         OR f.keyboard_condition != 'Good' OR f.mouse_condition != 'Good' THEN 1 ELSE 0 END) as issue_count,
			COUNT(DISTINCT f.pc_number) as unique_pcs,
			COUNT(DISTINCT f.student_user_id) as unique_students
		FROM feedback f
		WHERE f.is_archived = TRUE
		GROUP BY DATE(f.date_submitted)
		ORDER BY feedback_date DESC
	`

	rows, err := a.db.Query(query)
	if err != nil {
		log.Printf("⚠ Failed to query archived feedback sheets: %v", err)
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
			log.Printf("⚠ Failed to scan archived feedback sheet: %v", err)
			continue
		}
		sheets = append(sheets, sheet)
	}

	log.Printf("GetArchivedFeedbackSheets returning %d sheets", len(sheets))
	return sheets, nil
}

// GetArchivedFeedbackByDate returns all archived feedback for a specific date
func (a *App) GetArchivedFeedbackByDate(date string) ([]Feedback, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			f.id, 
			f.student_user_id, 
			COALESCE(s.student_number, 'N/A') as student_id_str,
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
			CONCAT(
				COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name, ''), 
				CASE WHEN COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name) IS NOT NULL THEN ', ' ELSE '' END,
				COALESCE(s_fwd.first_name, t_fwd.first_name, a_fwd.first_name, ''),
				CASE WHEN COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name) IS NOT NULL 
					THEN CONCAT(' ', COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name)) 
					ELSE '' END
			) as forwarded_by_name
		FROM feedback f
		LEFT JOIN students s ON f.student_user_id = s.user_id
		LEFT JOIN users u_fwd ON f.forwarded_by_user_id = u_fwd.id
		LEFT JOIN students s_fwd ON u_fwd.id = s_fwd.user_id AND u_fwd.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t_fwd ON u_fwd.id = t_fwd.user_id AND u_fwd.user_type = 'teacher'
		LEFT JOIN admins a_fwd ON u_fwd.id = a_fwd.user_id AND u_fwd.user_type = 'admin'
		WHERE f.is_archived = TRUE AND DATE(f.date_submitted) = ?
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
	if a.db == nil {
		return 0, fmt.Errorf("database not connected")
	}

	query := `UPDATE feedback 
		SET is_archived = TRUE, 
		    archived_at = NOW(), 
		    archived_by_user_id = ?
		WHERE DATE(date_submitted) = ? AND status = 'forwarded' AND (is_archived = FALSE OR is_archived IS NULL)`

	result, err := a.db.Exec(query, adminUserID, date)
	if err != nil {
		log.Printf("Failed to archive feedback by date: %v", err)
		return 0, fmt.Errorf("failed to archive feedback: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	log.Printf("✓ %d feedback archived for date %s by admin %d", rowsAffected, date, adminUserID)
	return int(rowsAffected), nil
}

// UnarchiveFeedbackSheet unarchives all feedback for a specific date
func (a *App) UnarchiveFeedbackSheet(date string) (int, error) {
	if a.db == nil {
		return 0, fmt.Errorf("database not connected")
	}

	query := `UPDATE feedback 
		SET is_archived = FALSE, 
		    archived_at = NULL, 
		    archived_by_user_id = NULL
		WHERE DATE(date_submitted) = ? AND is_archived = TRUE`

	result, err := a.db.Exec(query, date)
	if err != nil {
		log.Printf("Failed to unarchive feedback sheet: %v", err)
		return 0, fmt.Errorf("failed to unarchive feedback: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	log.Printf("✓ %d feedback unarchived for date %s", rowsAffected, date)
	return int(rowsAffected), nil
}

// GetFeedbackDates returns distinct dates with available (non-archived) feedback
func (a *App) GetFeedbackDates() ([]string, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT DISTINCT DATE(date_submitted) as feedback_date
		FROM feedback
		WHERE status = 'forwarded' AND (is_archived = FALSE OR is_archived IS NULL)
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

	pdf := gofpdf.New("L", "mm", "A4", "")
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
		pdf.Cell(45, 6, truncateStr(fb.StudentName, 22))
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

// truncateStr truncates a string to a maximum length (helper for PDF)
func truncateStr(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

// Legacy function kept for backwards compatibility - returns all archived feedback
func (a *App) GetArchivedFeedback() ([]Feedback, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			f.id, 
			f.student_user_id, 
			COALESCE(s.student_number, 'N/A') as student_id_str,
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
			CONCAT(
				COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name, ''), 
				CASE WHEN COALESCE(s_fwd.last_name, t_fwd.last_name, a_fwd.last_name) IS NOT NULL THEN ', ' ELSE '' END,
				COALESCE(s_fwd.first_name, t_fwd.first_name, a_fwd.first_name, ''),
				CASE WHEN COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name) IS NOT NULL 
					THEN CONCAT(' ', COALESCE(s_fwd.middle_name, t_fwd.middle_name, a_fwd.middle_name)) 
					ELSE '' END
			) as forwarded_by_name
		FROM feedback f
		LEFT JOIN students s ON f.student_user_id = s.user_id
		LEFT JOIN users u_fwd ON f.forwarded_by_user_id = u_fwd.id
		LEFT JOIN students s_fwd ON u_fwd.id = s_fwd.user_id AND u_fwd.user_type IN ('student', 'working_student')
		LEFT JOIN teachers t_fwd ON u_fwd.id = t_fwd.user_id AND u_fwd.user_type = 'teacher'
		LEFT JOIN admins a_fwd ON u_fwd.id = a_fwd.user_id AND u_fwd.user_type = 'admin'
		WHERE f.is_archived = TRUE
		ORDER BY f.archived_at DESC, f.date_submitted DESC 
		LIMIT 1000`
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
	if a.db == nil {
		return 0, fmt.Errorf("database not connected")
	}

	if len(feedbackIDs) == 0 {
		return 0, fmt.Errorf("no feedback IDs provided")
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
		SET is_archived = TRUE, 
		    archived_at = NOW(), 
		    archived_by_user_id = ?
		WHERE id IN (%s) AND is_archived = FALSE`, strings.Join(placeholders, ","))

	result, err := a.db.Exec(query, args...)
	if err != nil {
		log.Printf("Failed to archive feedback: %v", err)
		return 0, fmt.Errorf("failed to archive feedback: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	log.Printf("✓ %d feedback items archived by admin %d", rowsAffected, adminUserID)
	return int(rowsAffected), nil
}

// UnarchiveFeedback unarchives selected feedback by their IDs
func (a *App) UnarchiveFeedback(feedbackIDs []int) (int, error) {
	if a.db == nil {
		return 0, fmt.Errorf("database not connected")
	}

	if len(feedbackIDs) == 0 {
		return 0, fmt.Errorf("no feedback IDs provided")
	}

	// Build placeholders for the IN clause
	placeholders := make([]string, len(feedbackIDs))
	args := make([]interface{}, len(feedbackIDs))

	for i, id := range feedbackIDs {
		placeholders[i] = "?"
		args[i] = id
	}

	query := fmt.Sprintf(`UPDATE feedback 
		SET is_archived = FALSE, 
		    archived_at = NULL, 
		    archived_by_user_id = NULL
		WHERE id IN (%s) AND is_archived = TRUE`, strings.Join(placeholders, ","))

	result, err := a.db.Exec(query, args...)
	if err != nil {
		log.Printf("Failed to unarchive feedback: %v", err)
		return 0, fmt.Errorf("failed to unarchive feedback: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	log.Printf("✓ %d feedback items unarchived", rowsAffected)
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

	pdf := gofpdf.New("L", "mm", "A4", "")
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
