package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "github.com/denisenkom/go-mssqldb"
)

// DBConfig holds database configuration
type DBConfig struct {
	Server   string `json:"server"`
	Port     string `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	Database string `json:"database"`
}

// AppConfig holds application-level configuration (kiosk mode, etc.)
type AppConfig struct {
	KioskMode bool `json:"kiosk_mode"`
}

// LoadAppSettings loads application settings from config.json
// Returns default config (kiosk_mode=false) if config file is not found
func LoadAppSettings() AppConfig {
	defaultConfig := AppConfig{KioskMode: false}

	// Try multiple locations for config.json
	var configPaths []string

	// 1. Executable directory (production - installed app)
	exeDir, err := getExecutableDir()
	if err == nil {
		configPaths = append(configPaths, filepath.Join(exeDir, "config.json"))
	}

	// 2. Current working directory (development / wails dev)
	cwd, err := os.Getwd()
	if err == nil {
		configPaths = append(configPaths, filepath.Join(cwd, "config.json"))
	}

	// Try each path
	for _, configPath := range configPaths {
		data, err := os.ReadFile(configPath)
		if err != nil {
			continue
		}

		var config AppConfig
		if err := json.Unmarshal(data, &config); err != nil {
			log.Printf("Failed to parse kiosk settings from %s: %v", configPath, err)
			continue
		}

		if config.KioskMode {
			log.Printf("Kiosk mode is ENABLED (loaded from %s)", configPath)
		} else {
			log.Printf("Kiosk mode is DISABLED (loaded from %s)", configPath)
		}
		return config
	}

	log.Println("No config.json found for kiosk settings - defaulting to kiosk_mode=false")
	log.Printf("   Searched paths: %v", configPaths)
	return defaultConfig
}

// getExecutableDir returns the directory where the executable is located
func getExecutableDir() (string, error) {
	exePath, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.Dir(exePath), nil
}

// LoadDatabaseSettings loads database configuration from config.json or returns defaults
func LoadDatabaseSettings() DBConfig {
	// Try to get executable directory
	exeDir, err := getExecutableDir()
	if err != nil {
		log.Printf("Unable to determine executable directory: %v", err)
		log.Println("Using default configuration")
		return getDefaultConfig()
	}

	// Path to config.json next to executable
	configPath := filepath.Join(exeDir, "config.json")
	log.Printf("Looking for config file at: %s", configPath)

	// Try to read config file
	data, err := os.ReadFile(configPath)
	if err != nil {
		log.Printf("Config file not found or unreadable: %v", err)
		log.Println("Using default configuration")
		return getDefaultConfig()
	}

	// Parse JSON
	var config DBConfig
	if err := json.Unmarshal(data, &config); err != nil {
		log.Printf("Failed to parse config.json: %v", err)
		log.Println("Using default configuration")
		return getDefaultConfig()
	}

	// Validate required fields and apply defaults for empty values
	if config.Server == "" {
		config.Server = "192.168.1.200"
	}
	if config.Port == "" {
		config.Port = "1433"
	}
	if config.Username == "" {
		config.Username = "logbook_app"
	}
	if config.Password == "" {
		config.Password = "SecurePassword123!"
	}
	if config.Database == "" {
		config.Database = "logbookdb"
	}

	log.Println("Configuration loaded successfully from config.json")
	return config
}

// getDefaultConfig returns default database configuration
func getDefaultConfig() DBConfig {
	return DBConfig{
		Server:   "192.168.1.200",
		Port:     "1433",
		Username: "logbook_app",
		Password: "SecurePassword123!",
		Database: "logbookdb",
	}
}

// InitDatabase initializes and returns a database connection
func InitDatabase() (*sql.DB, error) {
	config := LoadDatabaseSettings()

	log.Printf("Attempting to connect to database:")
	log.Printf("   Server: %s", config.Server)
	log.Printf("   Port: %s", config.Port)
	log.Printf("   Database: %s", config.Database)
	log.Printf("   Username: %s", config.Username)

	// SQL Server connection string format for TCP/IP connections
	// Using encrypt=disable to avoid SSL certificate errors on LAN
	dsn := fmt.Sprintf(
		"server=%s;port=%s;user id=%s;password=%s;database=%s;encrypt=disable",
		config.Server,
		config.Port,
		config.Username,
		config.Password,
		config.Database,
	)

	db, err := sql.Open("mssql", dsn)
	if err != nil {
		log.Printf("Failed to open database: %v", err)
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test the connection
	if err := db.Ping(); err != nil {
		log.Printf("Failed to ping database: %v", err)
		log.Printf("Troubleshooting tips:")
		log.Printf("   - Verify SQL Server is running on %s:%s", config.Server, config.Port)
		log.Printf("   - Check firewall allows TCP port %s", config.Port)
		log.Printf("   - Ensure SQL Server authentication is enabled")
		log.Printf("   - Verify credentials: username=%s", config.Username)
		log.Printf("   - Check network connectivity to server")
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Println("Database connection established successfully")
	return db, nil
}
