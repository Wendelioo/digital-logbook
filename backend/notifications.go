package backend

import (
	"database/sql"
	"fmt"
	"log"
)

// ==============================================================================
// NOTIFICATION SYSTEM
// ==============================================================================

// Notification represents a persistent notification for a user
type Notification struct {
	ID            int     `json:"id"`
	UserID        int     `json:"user_id"`
	Category      string  `json:"category"`
	Title         string  `json:"title"`
	Message       string  `json:"message"`
	Tone          string  `json:"tone"`
	IsRead        bool    `json:"is_read"`
	ReferenceType *string `json:"reference_type,omitempty"`
	ReferenceID   *int    `json:"reference_id,omitempty"`
	CreatedAt     string  `json:"created_at"`
	ReadAt        *string `json:"read_at,omitempty"`
}

// NotificationSummary wraps a list of notifications with the unread count
type NotificationSummary struct {
	Notifications []Notification `json:"notifications"`
	UnreadCount   int            `json:"unread_count"`
}

// ensureNotificationsTable creates the notifications table if it does not exist
func (a *App) ensureNotificationsTable() error {
	if err := a.checkDB(); err != nil {
		return err
	}

	query := `
		CREATE TABLE IF NOT EXISTS notifications (
			id              INT AUTO_INCREMENT PRIMARY KEY,
			user_id         INT NOT NULL,
			category        VARCHAR(50) NOT NULL,
			title           VARCHAR(200) NOT NULL,
			message         VARCHAR(500) NOT NULL,
			tone            VARCHAR(20) NOT NULL DEFAULT 'info',
			is_read         TINYINT(1) NOT NULL DEFAULT 0,
			reference_type  VARCHAR(50) NULL,
			reference_id    INT NULL,
			created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			read_at         DATETIME NULL,
			CONSTRAINT FK_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`

	if _, err := a.db.Exec(query); err != nil {
		return err
	}
	_, _ = a.db.Exec(`CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read)`)
	_, _ = a.db.Exec(`CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at)`)
	_, _ = a.db.Exec(`CREATE INDEX idx_notifications_category ON notifications(category)`)
	return nil
}

// GetNotifications returns recent notifications for a user plus the unread count
func (a *App) GetNotifications(userID int, limit int) (NotificationSummary, error) {
	var summary NotificationSummary
	if err := a.checkDB(); err != nil {
		return summary, err
	}
	// limit semantics:
	// - 0: fetch all notifications
	// - >0: fetch that many, capped for safety
	// - <0: fallback to default
	if limit < 0 {
		limit = 20
	}
	if limit > 500 {
		limit = 500
	}

	// Unread count
	_ = a.db.QueryRow(`SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0`, userID).Scan(&summary.UnreadCount)

	// Recent notifications
	query := `
		SELECT id, user_id, category, title, message, tone, is_read,
		       reference_type, reference_id,
		       DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
		       CASE WHEN read_at IS NOT NULL THEN DATE_FORMAT(read_at, '%Y-%m-%d %H:%i:%s') ELSE NULL END AS read_at
		FROM notifications
		WHERE user_id = ?
		ORDER BY created_at DESC
	`

	args := []interface{}{userID}
	if limit > 0 {
		query += ` LIMIT ?`
		args = append(args, limit)
	}

	rows, err := a.db.Query(query, args...)
	if err != nil {
		return summary, fmt.Errorf("failed to fetch notifications: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var n Notification
		var refType, readAt sql.NullString
		var refID sql.NullInt64
		err := rows.Scan(&n.ID, &n.UserID, &n.Category, &n.Title, &n.Message, &n.Tone, &n.IsRead,
			&refType, &refID, &n.CreatedAt, &readAt)
		if err != nil {
			log.Printf("Failed to scan notification row: %v", err)
			continue
		}
		if refType.Valid {
			n.ReferenceType = &refType.String
		}
		if refID.Valid {
			id := int(refID.Int64)
			n.ReferenceID = &id
		}
		if readAt.Valid {
			n.ReadAt = &readAt.String
		}
		summary.Notifications = append(summary.Notifications, n)
	}

	if summary.Notifications == nil {
		summary.Notifications = []Notification{}
	}

	return summary, nil
}

// MarkNotificationRead marks a single notification as read
func (a *App) MarkNotificationRead(notificationID int, userID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	_, err := a.db.Exec(`
		UPDATE notifications SET is_read = 1, read_at = NOW()
		WHERE id = ? AND user_id = ?
	`, notificationID, userID)
	return err
}

// MarkAllNotificationsRead marks all unread notifications as read for a user
func (a *App) MarkAllNotificationsRead(userID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	_, err := a.db.Exec(`
		UPDATE notifications SET is_read = 1, read_at = NOW()
		WHERE user_id = ? AND is_read = 0
	`, userID)
	return err
}

// CleanOldNotifications deletes notifications older than 30 days
func (a *App) CleanOldNotifications() error {
	if err := a.checkDB(); err != nil {
		return err
	}
	_, err := a.db.Exec(`DELETE FROM notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`)
	return err
}

// createNotification inserts a notification for a specific user.
// It deduplicates by skipping if an identical notification was created in the last 60 seconds.
// This is a private helper — not exposed to the frontend.
func (a *App) createNotification(userID int, category, title, message, tone string, refType *string, refID *int) {
	if a.db == nil {
		return
	}

	// Dedup: skip if identical notification exists in last 60 seconds
	var exists int
	_ = a.db.QueryRow(`
		SELECT COUNT(*) FROM notifications
		WHERE user_id = ? AND category = ? AND message = ?
		AND created_at >= DATE_SUB(NOW(), INTERVAL 60 SECOND)
	`, userID, category, message).Scan(&exists)
	if exists > 0 {
		return
	}

	_, err := a.db.Exec(`
		INSERT INTO notifications (user_id, category, title, message, tone, reference_type, reference_id)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, userID, category, title, message, tone, nullStringPtr(refType), nullIntPtr(refID))
	if err != nil {
		log.Printf("Failed to create notification for user %d: %v", userID, err)
	}
}

// createNotificationForRole creates a notification for all accounts in active lifecycle state for a given role.
func (a *App) createNotificationForRole(role, category, title, message, tone string, refType *string, refID *int) {
	if a.db == nil {
		return
	}

	rows, err := a.db.Query(`
		SELECT id FROM users WHERE user_type = ? AND account_status = 'active'
	`, role)
	if err != nil {
		log.Printf("Failed to query users for role notification: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var uid int
		if rows.Scan(&uid) == nil {
			a.createNotification(uid, category, title, message, tone, refType, refID)
		}
	}
}

// nullStringPtr converts a *string to sql.NullString for parameterized queries
func nullStringPtr(s *string) sql.NullString {
	if s == nil {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: *s, Valid: true}
}

// nullIntPtr converts a *int to sql.NullInt64 for parameterized queries
func nullIntPtr(i *int) sql.NullInt64 {
	if i == nil {
		return sql.NullInt64{Valid: false}
	}
	return sql.NullInt64{Int64: int64(*i), Valid: true}
}

// notifRef is a small helper to get a string pointer for reference_type
func notifRef(s string) *string {
	return &s
}

// notifRefID is a small helper to get an int pointer for reference_id
func notifRefID(id int) *int {
	return &id
}

// notifRefID64 converts int64 to *int for reference_id
func notifRefID64(id int64) *int {
	v := int(id)
	return &v
}

