package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
)

// DatabaseSettings holds the database configuration
type DatabaseSettings struct {
	Server   string `json:"server"`
	Port     string `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	Database string `json:"database"`
	Instance string `json:"instance"`
}

// GetConfigFilePath returns the path to the config file
func GetConfigFilePath() (string, error) {
	execPath, err := os.Executable()
	if err != nil {
		return "", err
	}
	dir := filepath.Dir(execPath)
	return filepath.Join(dir, "db_config.json"), nil
}

// LoadDatabaseSettings loads database configuration from file or environment
func LoadDatabaseSettings() DatabaseSettings {
	// First try to load from config file
	configPath, err := GetConfigFilePath()
	if err == nil {
		if data, err := ioutil.ReadFile(configPath); err == nil {
			var settings DatabaseSettings
			if json.Unmarshal(data, &settings) == nil && settings.Server != "" {
				log.Println("Loaded database configuration from", configPath)
				return settings
			}
		}
	}

	// Fall back to environment variables or defaults
	return DatabaseSettings{
		Server:   getEnv("DB_SERVER", "192.168.1.200"),
		Port:     getEnv("DB_PORT", "1433"),
		Instance: getEnv("DB_INSTANCE", ""),
		Username: getEnv("DB_USERNAME", "logbook_app"),
		Password: getEnv("DB_PASSWORD", "SecurePassword123!"),
		Database: getEnv("DB_DATABASE", "logbookdb"),
	}
}

// SaveDatabaseSettings saves database configuration to file
func (a *App) SaveDatabaseSettings(settings DatabaseSettings) error {
	configPath, err := GetConfigFilePath()
	if err != nil {
		return err
	}

	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}

	return ioutil.WriteFile(configPath, data, 0644)
}

// TestDatabaseConnection tests a database connection with given settings
func (a *App) TestDatabaseConnection(settings DatabaseSettings) error {
	var dsn string
	if settings.Instance != "" {
		dsn = fmt.Sprintf(
			"server=%s\\%s;port=%s;user id=%s;password=%s;database=%s",
			settings.Server,
			settings.Instance,
			settings.Port,
			settings.Username,
			settings.Password,
			settings.Database,
		)
	} else {
		dsn = fmt.Sprintf(
			"server=%s;port=%s;user id=%s;password=%s;database=%s",
			settings.Server,
			settings.Port,
			settings.Username,
			settings.Password,
			settings.Database,
		)
	}

	db, err := sql.Open("mssql", dsn)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	return nil
}

// GetCurrentDatabaseSettings returns the current database configuration
func (a *App) GetCurrentDatabaseSettings() DatabaseSettings {
	settings := LoadDatabaseSettings()
	// Mask password for security
	settings.Password = "********"
	return settings
}

// UpdateDatabaseConnection updates the database connection with new settings
func (a *App) UpdateDatabaseConnection(settings DatabaseSettings) error {
	// Test the connection first
	if err := a.TestDatabaseConnection(settings); err != nil {
		return err
	}

	// Save the settings
	if err := a.SaveDatabaseSettings(settings); err != nil {
		return err
	}

	// Close existing connection
	if a.db != nil {
		a.db.Close()
	}

	// Reconnect with new settings
	db, err := InitDatabaseWithSettings(settings)
	if err != nil {
		return err
	}

	a.db = db
	log.Println("Database connection updated successfully")
	return nil
}

// InitDatabaseWithSettings initializes database with specific settings
func InitDatabaseWithSettings(settings DatabaseSettings) (*sql.DB, error) {
	var dsn string
	if settings.Instance != "" {
		dsn = fmt.Sprintf(
			"server=%s\\%s;port=%s;user id=%s;password=%s;database=%s",
			settings.Server,
			settings.Instance,
			settings.Port,
			settings.Username,
			settings.Password,
			settings.Database,
		)
	} else {
		dsn = fmt.Sprintf(
			"server=%s;port=%s;user id=%s;password=%s;database=%s",
			settings.Server,
			settings.Port,
			settings.Username,
			settings.Password,
			settings.Database,
		)
	}

	db, err := sql.Open("mssql", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	return db, nil
}
