package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/denisenkom/go-mssqldb"
)

// DBConfig holds database configuration
type DBConfig struct {
	Server   string
	Port     string
	Username string
	Password string
	Database string
	Instance string
}

// GetDBConfig returns database configuration from environment variables or defaults
func GetDBConfig() DBConfig {
	return DBConfig{
		Server:   getEnv("DB_SERVER", "localhost"),
		Port:     getEnv("DB_PORT", "1433"),
		Instance: getEnv("DB_INSTANCE", "SQLEXPRESS"),
		Username: getEnv("DB_USERNAME", "logbook_app"),
		Password: getEnv("DB_PASSWORD", "SecurePassword123!"),
		Database: getEnv("DB_DATABASE", "logbookdb"),
	}
}

// getEnv gets an environment variable or returns a default value
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// InitDatabase initializes and returns a database connection
func InitDatabase() (*sql.DB, error) {
	config := GetDBConfig()

	// SQL Server connection string format
	var dsn string
	if config.Instance != "" {
		// With instance name (e.g., SQLEXPRESS)
		dsn = fmt.Sprintf(
			"server=%s\\%s;port=%s;user id=%s;password=%s;database=%s",
			config.Server,
			config.Instance,
			config.Port,
			config.Username,
			config.Password,
			config.Database,
		)
	} else {
		// Without instance name (default instance or cloud)
		dsn = fmt.Sprintf(
			"server=%s;port=%s;user id=%s;password=%s;database=%s",
			config.Server,
			config.Port,
			config.Username,
			config.Password,
			config.Database,
		)
	}

	db, err := sql.Open("mssql", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test the connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Println("Database connection established successfully")
	return db, nil
}
