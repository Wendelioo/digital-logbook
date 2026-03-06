package backend

import (
	"database/sql"
	"fmt"
	"log"
	"time"
)

// checkDB validates database connection and attempts reconnection if needed
func (a *App) checkDB() error {
	if a.db == nil {
		log.Println("Database is nil, attempting to reconnect...")
		return a.reconnectDB()
	}

	// Verify the connection is still alive
	if err := a.db.Ping(); err != nil {
		log.Printf("Database ping failed: %v, attempting to reconnect...", err)
		a.db.Close()
		a.db = nil
		return a.reconnectDB()
	}

	return nil
}

// reconnectDB attempts to re-establish the database connection
func (a *App) reconnectDB() error {
	db, err := InitDatabase()
	if err != nil {
		log.Printf("Database reconnection failed: %v", err)
		return fmt.Errorf("database not connected - reconnection failed: %w", err)
	}
	a.db = db
	log.Println("Database reconnected successfully")
	return nil
}

// nullString converts empty string to sql.NullString
func nullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: s, Valid: true}
}

// scanNullString converts sql.NullString to *string
func scanNullString(ns sql.NullString) *string {
	if ns.Valid {
		return &ns.String
	}
	return nil
}

// formatTime formats time.Time to "2006-01-02 15:04:05"
func formatTime(t time.Time) string {
	return t.Format("2006-01-02 15:04:05")
}

// truncateString truncates a string to maxLen, appending "..." if needed
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
