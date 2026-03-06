package backend

import (
	"fmt"
	"log"
	"os"
)

const sessionHeartbeatTimeoutSeconds = 120

func (a *App) ensureSessionHeartbeatTable() error {
	if err := a.checkDB(); err != nil {
		return err
	}

	query := `
		IF OBJECT_ID('user_session_heartbeats', 'U') IS NULL
		BEGIN
			CREATE TABLE user_session_heartbeats (
				user_id INT NOT NULL PRIMARY KEY,
				last_seen DATETIME NOT NULL DEFAULT GETDATE(),
				created_at DATETIME NOT NULL DEFAULT GETDATE(),
				updated_at DATETIME NOT NULL DEFAULT GETDATE(),
				CONSTRAINT FK_user_session_heartbeats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			)
		END
	`

	_, err := a.db.Exec(query)
	return err
}

func (a *App) TouchSession(userID int) error {
	if err := a.ensureSessionHeartbeatTable(); err != nil {
		return err
	}

	query := `
		MERGE user_session_heartbeats AS target
		USING (SELECT ? AS user_id) AS source
		ON target.user_id = source.user_id
		WHEN MATCHED THEN
			UPDATE SET last_seen = GETDATE(), updated_at = GETDATE()
		WHEN NOT MATCHED THEN
			INSERT (user_id, last_seen, created_at, updated_at)
			VALUES (source.user_id, GETDATE(), GETDATE(), GETDATE());
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
		UPDATE le
		SET le.logout_time = GETDATE()
		FROM log_entries le
		LEFT JOIN user_session_heartbeats sh ON sh.user_id = le.user_id
		WHERE le.logout_time IS NULL
			AND (
				sh.user_id IS NULL
				OR sh.last_seen < DATEADD(SECOND, -?, GETDATE())
			)
	`

	result, err := a.db.Exec(query, sessionHeartbeatTimeoutSeconds)
	if err != nil {
		return fmt.Errorf("failed to close stale sessions: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err == nil && rowsAffected > 0 {
		log.Printf("Closed %d stale session(s)", rowsAffected)
	}

	_, _ = a.db.Exec(`
		DELETE FROM user_session_heartbeats
		WHERE last_seen < DATEADD(SECOND, -?, GETDATE())
	`, sessionHeartbeatTimeoutSeconds)

	return nil
}

func (a *App) CloseSessionsForCurrentHost() error {
	if err := a.checkDB(); err != nil {
		return err
	}

	hostname, err := os.Hostname()
	if err != nil {
		return err
	}

	result, err := a.db.Exec(`
		UPDATE log_entries
		SET logout_time = GETDATE()
		WHERE logout_time IS NULL
			AND pc_number = ?
	`, hostname)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err == nil && rowsAffected > 0 {
		log.Printf("Closed %d active session(s) for host %s", rowsAffected, hostname)
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
