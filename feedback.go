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

// GetFeedback returns all feedback that has been forwarded to admin
func (a *App) GetFeedback() ([]Feedback, error) {
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
		WHERE f.status = 'forwarded'
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
