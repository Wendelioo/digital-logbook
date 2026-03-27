package backend

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
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

func valueOrFallback(ns sql.NullString) string {
	if ns.Valid && ns.String != "" {
		return ns.String
	}
	return "N/A"
}

// formatTime formats time.Time to "2006-01-02 15:04:05"
func formatTime(t time.Time) string {
	return t.Format("2006-01-02 15:04:05")
}

// resolveExportPath returns savePath if non-empty; otherwise returns path under user's Downloads with defaultFilename.
func resolveExportPath(savePath string, defaultFilename string) string {
	if savePath != "" {
		return savePath
	}
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, "Downloads", defaultFilename)
}

// truncateString truncates a string to maxLen, appending "..." if needed
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

// timeAgo returns a human-readable duration since the given time.
// Examples: "just now", "45 seconds ago", "3 minutes ago", "2 hours ago",
//
//	"5 days ago", "3 months ago", "2 years ago"
func timeAgo(t time.Time) string {
	d := time.Since(t)
	seconds := int(d.Seconds())

	if seconds < 60 {
		if seconds <= 1 {
			return "just now"
		}
		return fmt.Sprintf("%d seconds ago", seconds)
	}

	minutes := int(d.Minutes())
	if minutes < 60 {
		if minutes == 1 {
			return "1 minute ago"
		}
		return fmt.Sprintf("%d minutes ago", minutes)
	}

	hours := int(d.Hours())
	if hours < 24 {
		if hours == 1 {
			return "1 hour ago"
		}
		return fmt.Sprintf("%d hours ago", hours)
	}

	days := int(d.Hours() / 24)
	if days < 30 {
		if days == 1 {
			return "1 day ago"
		}
		return fmt.Sprintf("%d days ago", days)
	}

	months := int(days / 30)
	if months < 12 {
		if months == 1 {
			return "1 month ago"
		}
		return fmt.Sprintf("%d months ago", months)
	}

	years := int(days / 365)
	if years == 1 {
		return "1 year ago"
	}
	return fmt.Sprintf("%d years ago", years)
}
