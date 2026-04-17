package backend

import (
	"context"
	"fmt"
	"log"
	"time"
)

const sessionHeartbeatTimeoutSeconds = 120
const sessionCleanupIntervalSeconds = 30

func (a *App) startSessionCleanupLoop(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(sessionCleanupIntervalSeconds) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := a.closeStaleSessions(); err != nil {
				log.Printf("Background stale-session cleanup failed: %v", err)
			}
		}
	}
}

func (a *App) ensureSessionHeartbeatTable() error {
	if err := a.checkDB(); err != nil {
		return err
	}

	query := `
		CREATE TABLE IF NOT EXISTS user_session_heartbeats (
			user_id INT NOT NULL PRIMARY KEY,
			last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			CONSTRAINT FK_user_session_heartbeats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`

	_, err := a.db.Exec(query)
	return err
}

func (a *App) TouchSession(userID int) error {
	if err := a.ensureSessionHeartbeatTable(); err != nil {
		return err
	}

	query := `
		INSERT INTO user_session_heartbeats (user_id, last_seen, created_at, updated_at)
		VALUES (?, NOW(), NOW(), NOW())
		ON DUPLICATE KEY UPDATE
			last_seen = NOW(),
			updated_at = NOW()
	`

	_, err := a.db.Exec(query, userID)
	if err != nil {
		return fmt.Errorf("failed to update session heartbeat: %w", err)
	}
	return nil
}

func (a *App) clearSessionHeartbeat(userID int) error {
	if err := a.ensureSessionHeartbeatTable(); err != nil {
		return err
	}

	_, err := a.db.Exec(`DELETE FROM user_session_heartbeats WHERE user_id = ?`, userID)
	if err != nil {
		return fmt.Errorf("failed to clear session heartbeat: %w", err)
	}
	return nil
}

func (a *App) closeStaleSessions() error {
	if err := a.ensureSessionHeartbeatTable(); err != nil {
		return err
	}

	query := `
		UPDATE log_entries le
		LEFT JOIN user_session_heartbeats sh ON sh.user_id = le.user_id
		SET le.logout_time = COALESCE(sh.last_seen, NOW())
		WHERE le.logout_time IS NULL
			AND (
				(sh.user_id IS NULL AND le.login_time < DATE_SUB(NOW(), INTERVAL ? SECOND))
				OR (sh.user_id IS NOT NULL AND sh.last_seen < DATE_SUB(NOW(), INTERVAL ? SECOND))
			)
	`

	result, err := a.db.Exec(query, sessionHeartbeatTimeoutSeconds, sessionHeartbeatTimeoutSeconds)
	if err != nil {
		return fmt.Errorf("failed to close stale sessions: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err == nil && rowsAffected > 0 {
		log.Printf("Closed %d stale session(s)", rowsAffected)
	}

	_, _ = a.db.Exec(`
		DELETE FROM user_session_heartbeats
		WHERE last_seen < DATE_SUB(NOW(), INTERVAL ? SECOND)
	`, sessionHeartbeatTimeoutSeconds)

	return nil
}

func (a *App) CloseSessionsForCurrentHost() error {
	if err := a.checkDB(); err != nil {
		return err
	}

	stationLabel := a.currentStationLabel()

	result, err := a.db.Exec(`
		UPDATE log_entries
		SET logout_time = NOW()
		WHERE logout_time IS NULL
			AND pc_number = ?
	`, stationLabel)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err == nil && rowsAffected > 0 {
		log.Printf("Closed %d active session(s) for station %s", rowsAffected, stationLabel)
	}

	_, _ = a.db.Exec(`
		DELETE sh
		FROM user_session_heartbeats sh
		WHERE NOT EXISTS (
			SELECT 1 FROM log_entries le WHERE le.user_id = sh.user_id AND le.logout_time IS NULL
		)
	`)

	return nil
}
