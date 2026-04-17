package backend

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	_ "github.com/go-sql-driver/mysql"
)

// DBConfig holds database configuration
type DBConfig struct {
	Host     string
	Port     string `json:"port"`
	DBName   string
	Username string `json:"username"`
	Password string `json:"password"`
}

// AppConfig holds application-level configuration (lock mode, etc.)
type AppConfig struct {
	LockMode    bool   `json:"lock_mode"`
	ComputerLab string `json:"computer_lab"`
	PCNumber    string `json:"pc_number"`
}

type appConfigFile struct {
	LockMode    *bool  `json:"lock_mode"`
	ComputerLab string `json:"computer_lab"`
	PCNumber    string `json:"pc_number"`
}

const (
	defaultInactivityDeactivationDays = 183
	maxInactivityDeactivationDays     = 3650
	defaultDeactivatedDeletionDays    = 1460
	maxDeactivatedDeletionDays        = 36500
	runtimeModeDevelopment            = "development"
	runtimeModeProduction             = "production"
)

// LoadInactivityDeactivationDays returns the inactivity threshold (in days)
// used for automatic account deactivation.
//
// Precedence:
//  1. INACTIVITY_DEACTIVATION_DAYS environment variable
//  2. [policy] inactivity_deactivation_days in config.ini
//  3. Built-in default (183)
func LoadInactivityDeactivationDays() int {
	if days, provided, err := parseInactivityDaysValue(os.Getenv("INACTIVITY_DEACTIVATION_DAYS")); provided {
		if err != nil {
			log.Printf("Invalid INACTIVITY_DEACTIVATION_DAYS: %v (using fallback settings)", err)
		} else {
			return days
		}
	}

	for _, configPath := range getConfigINIPaths() {
		days, found, err := parseInactivityDaysFromConfigINI(configPath)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				continue
			}
			log.Printf("Unable to parse inactivity policy from %s: %v", configPath, err)
			continue
		}

		if found {
			return days
		}
	}

	return defaultInactivityDeactivationDays
}

// LoadDeactivatedDeletionDays returns the threshold (in days) for when
// already-deactivated accounts are flagged as deleted.
//
// Precedence:
//  1. DEACTIVATED_DELETION_DAYS environment variable
//  2. [policy] deactivated_deletion_days in config.ini
//  3. Built-in default (1460)
func LoadDeactivatedDeletionDays() int {
	if days, provided, err := parseDeactivatedDeletionDaysValue(os.Getenv("DEACTIVATED_DELETION_DAYS")); provided {
		if err != nil {
			log.Printf("Invalid DEACTIVATED_DELETION_DAYS: %v (using fallback settings)", err)
		} else {
			return days
		}
	}

	for _, configPath := range getConfigINIPaths() {
		days, found, err := parseDeactivatedDeletionDaysFromConfigINI(configPath)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				continue
			}
			log.Printf("Unable to parse deletion policy from %s: %v", configPath, err)
			continue
		}

		if found {
			return days
		}
	}

	return defaultDeactivatedDeletionDays
}

// LoadConfiguredPolicyThresholds returns policy values from config.ini only
// (without env-var overrides). Missing keys use built-in defaults.
func LoadConfiguredPolicyThresholds() (int, int) {
	inactivityDays := defaultInactivityDeactivationDays
	deletionDays := defaultDeactivatedDeletionDays

	for _, configPath := range getConfigINIPaths() {
		info, err := os.Stat(configPath)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				continue
			}
			log.Printf("Unable to inspect config file %s: %v", configPath, err)
			continue
		}
		if info.IsDir() {
			continue
		}

		if days, found, err := parseInactivityDaysFromConfigINI(configPath); err != nil {
			log.Printf("Unable to parse inactivity policy from %s: %v", configPath, err)
			continue
		} else if found {
			inactivityDays = days
		}

		if days, found, err := parseDeactivatedDeletionDaysFromConfigINI(configPath); err != nil {
			log.Printf("Unable to parse deletion policy from %s: %v", configPath, err)
			continue
		} else if found {
			deletionDays = days
		}

		return inactivityDays, deletionDays
	}

	return inactivityDays, deletionDays
}

// SavePolicyThresholds persists policy thresholds in config.ini [policy] section.
// It updates existing keys or inserts them if missing.
func SavePolicyThresholds(inactivityDays, deletionDays int) error {
	if _, _, err := parseInactivityDaysValue(strconv.Itoa(inactivityDays)); err != nil {
		return fmt.Errorf("invalid inactivity deactivation days: %w", err)
	}
	if _, _, err := parseDeactivatedDeletionDaysValue(strconv.Itoa(deletionDays)); err != nil {
		return fmt.Errorf("invalid deactivated deletion days: %w", err)
	}

	configPath, err := resolvePolicyConfigINIPathForWrite()
	if err != nil {
		return err
	}

	contentBytes, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to read config.ini for policy update: %w", err)
	}

	updatedContent, err := upsertPolicyThresholdsInINI(string(contentBytes), inactivityDays, deletionDays)
	if err != nil {
		return err
	}

	if err := os.WriteFile(configPath, []byte(updatedContent), 0644); err != nil {
		return fmt.Errorf("failed to save policy settings to config.ini: %w", err)
	}

	log.Printf("Policy settings saved to %s", configPath)
	return nil
}

func resolvePolicyConfigINIPathForWrite() (string, error) {
	configPaths := getConfigINIPaths()
	if len(configPaths) == 0 {
		return "", fmt.Errorf("unable to determine config.ini search paths")
	}

	firstExisting := ""
	for _, configPath := range configPaths {
		info, err := os.Stat(configPath)
		if err != nil || info.IsDir() {
			continue
		}

		if firstExisting == "" {
			firstExisting = configPath
		}

		if _, err := parseDatabaseConfigINI(configPath); err == nil {
			return configPath, nil
		}
	}

	if firstExisting != "" {
		return firstExisting, nil
	}

	return "", fmt.Errorf("config.ini not found; searched paths: %v", configPaths)
}

func upsertPolicyThresholdsInINI(content string, inactivityDays, deletionDays int) (string, error) {
	normalized := strings.ReplaceAll(content, "\r\n", "\n")
	lines := strings.Split(normalized, "\n")
	if len(lines) == 1 && lines[0] == "" {
		lines = []string{}
	}

	policyStart := -1
	policyEnd := len(lines)
	for i, line := range lines {
		section, ok := parseINISection(line)
		if !ok {
			continue
		}

		if strings.EqualFold(section, "policy") && policyStart == -1 {
			policyStart = i
			policyEnd = len(lines)
			continue
		}

		if policyStart != -1 {
			policyEnd = i
			break
		}
	}

	inactivityLine := fmt.Sprintf("inactivity_deactivation_days=%d", inactivityDays)
	deletionLine := fmt.Sprintf("deactivated_deletion_days=%d", deletionDays)

	if policyStart == -1 {
		if len(lines) > 0 && strings.TrimSpace(lines[len(lines)-1]) != "" {
			lines = append(lines, "")
		}
		lines = append(lines, "[policy]", inactivityLine, deletionLine)
		return strings.Join(lines, "\n"), nil
	}

	inactivityIdx := -1
	deletionIdx := -1
	for i := policyStart + 1; i < policyEnd; i++ {
		trimmed := strings.TrimSpace(lines[i])
		if trimmed == "" || strings.HasPrefix(trimmed, "#") || strings.HasPrefix(trimmed, ";") {
			continue
		}

		key, _, found := strings.Cut(trimmed, "=")
		if !found {
			continue
		}

		switch strings.ToLower(strings.TrimSpace(key)) {
		case "inactivity_deactivation_days":
			inactivityIdx = i
		case "deactivated_deletion_days":
			deletionIdx = i
		}
	}

	if inactivityIdx != -1 {
		lines[inactivityIdx] = inactivityLine
	} else {
		lines = append(lines[:policyEnd], append([]string{inactivityLine}, lines[policyEnd:]...)...)
		policyEnd++
	}

	if deletionIdx != -1 {
		lines[deletionIdx] = deletionLine
	} else {
		lines = append(lines[:policyEnd], append([]string{deletionLine}, lines[policyEnd:]...)...)
	}

	return strings.Join(lines, "\n"), nil
}

func parseINISection(line string) (string, bool) {
	trimmed := strings.TrimSpace(line)
	if !strings.HasPrefix(trimmed, "[") || !strings.HasSuffix(trimmed, "]") {
		return "", false
	}

	section := strings.TrimSpace(trimmed[1 : len(trimmed)-1])
	if section == "" {
		return "", false
	}

	return section, true
}

func parseInactivityDaysFromConfigINI(configPath string) (int, bool, error) {
	file, err := os.Open(configPath)
	if err != nil {
		return 0, false, err
	}
	defer file.Close()

	inPolicySection := false
	scanner := bufio.NewScanner(file)
	lineNumber := 0

	for scanner.Scan() {
		lineNumber++
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, ";") {
			continue
		}

		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			section := strings.ToLower(strings.TrimSpace(line[1 : len(line)-1]))
			inPolicySection = section == "policy"
			continue
		}

		if !inPolicySection {
			continue
		}

		key, value, found := strings.Cut(line, "=")
		if !found {
			return 0, false, fmt.Errorf("invalid policy key/value on line %d", lineNumber)
		}

		key = strings.ToLower(strings.TrimSpace(key))
		if key != "inactivity_deactivation_days" {
			continue
		}

		days, _, err := parseInactivityDaysValue(value)
		if err != nil {
			return 0, false, fmt.Errorf("invalid inactivity_deactivation_days on line %d: %w", lineNumber, err)
		}

		return days, true, nil
	}

	if err := scanner.Err(); err != nil {
		return 0, false, fmt.Errorf("failed to read file: %w", err)
	}

	return 0, false, nil
}

func parseDeactivatedDeletionDaysFromConfigINI(configPath string) (int, bool, error) {
	file, err := os.Open(configPath)
	if err != nil {
		return 0, false, err
	}
	defer file.Close()

	inPolicySection := false
	scanner := bufio.NewScanner(file)
	lineNumber := 0

	for scanner.Scan() {
		lineNumber++
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, ";") {
			continue
		}

		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			section := strings.ToLower(strings.TrimSpace(line[1 : len(line)-1]))
			inPolicySection = section == "policy"
			continue
		}

		if !inPolicySection {
			continue
		}

		key, value, found := strings.Cut(line, "=")
		if !found {
			return 0, false, fmt.Errorf("invalid policy key/value on line %d", lineNumber)
		}

		key = strings.ToLower(strings.TrimSpace(key))
		if key != "deactivated_deletion_days" {
			continue
		}

		days, _, err := parseDeactivatedDeletionDaysValue(value)
		if err != nil {
			return 0, false, fmt.Errorf("invalid deactivated_deletion_days on line %d: %w", lineNumber, err)
		}

		return days, true, nil
	}

	if err := scanner.Err(); err != nil {
		return 0, false, fmt.Errorf("failed to read file: %w", err)
	}

	return 0, false, nil
}

func parseInactivityDaysValue(raw string) (int, bool, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return 0, false, nil
	}

	value = strings.Trim(value, `"'`)
	days, err := strconv.Atoi(value)
	if err != nil {
		return 0, true, fmt.Errorf("must be an integer")
	}

	if days < 1 || days > maxInactivityDeactivationDays {
		return 0, true, fmt.Errorf("must be between 1 and %d", maxInactivityDeactivationDays)
	}

	return days, true, nil
}

func parseDeactivatedDeletionDaysValue(raw string) (int, bool, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return 0, false, nil
	}

	value = strings.Trim(value, `"'`)
	days, err := strconv.Atoi(value)
	if err != nil {
		return 0, true, fmt.Errorf("must be an integer")
	}

	if days < 1 || days > maxDeactivatedDeletionDays {
		return 0, true, fmt.Errorf("must be between 1 and %d", maxDeactivatedDeletionDays)
	}

	return days, true, nil
}

func getUserAppConfigPath() (string, error) {
	if getRuntimeMode() == runtimeModeDevelopment {
		cwd, err := os.Getwd()
		if err != nil {
			return "", fmt.Errorf("unable to determine development app settings path: %w", err)
		}

		return filepath.Join(cwd, "config.dev.json"), nil
	}

	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(configDir, "digital-logbook", "app-settings.json"), nil
}

func getUserConfigINIPath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(configDir, "digital-logbook", "config.ini"), nil
}

func getRuntimeMode() string {
	forcedMode := strings.ToLower(strings.TrimSpace(os.Getenv("DIGITAL_LOGBOOK_MODE")))
	switch forcedMode {
	case "dev", "development":
		return runtimeModeDevelopment
	case "prod", "production", "release":
		return runtimeModeProduction
	}

	cwd, err := os.Getwd()
	if err != nil {
		log.Printf("Unable to determine current working directory for runtime mode detection: %v", err)
		return runtimeModeProduction
	}

	if _, err := os.Stat(filepath.Join(cwd, "wails.json")); err == nil {
		if info, err := os.Stat(filepath.Join(cwd, "frontend")); err == nil && info.IsDir() {
			return runtimeModeDevelopment
		}
	}

	return runtimeModeProduction
}

// GetRuntimeMode reports which config mode is active: development or production.
func GetRuntimeMode() string {
	return getRuntimeMode()
}

// LoadAppSettings loads lock/station settings from a runtime-mode-aware config path.
// Development uses project-root config.dev.json; production uses user config storage.
// Returns default config (lock mode off) if config file is not found.
func LoadAppSettings() AppConfig {
	defaultConfig := AppConfig{LockMode: false, ComputerLab: "", PCNumber: ""}

	configPath, err := getUserAppConfigPath()
	if err != nil {
		log.Printf("Unable to determine app settings path: %v", err)
		return defaultConfig
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			log.Printf("No app settings found at %s - defaulting to lock mode off", configPath)
		} else {
			log.Printf("Failed to read app settings from %s: %v", configPath, err)
		}
		return defaultConfig
	}

	var fileConfig appConfigFile
	if err := json.Unmarshal(data, &fileConfig); err != nil {
		log.Printf("Failed to parse lock-mode settings from %s: %v", configPath, err)
		return defaultConfig
	}

	config := AppConfig{
		LockMode:    false,
		ComputerLab: fileConfig.ComputerLab,
		PCNumber:    fileConfig.PCNumber,
	}

	if fileConfig.LockMode != nil {
		config.LockMode = *fileConfig.LockMode
	}

	config.ComputerLab = strings.TrimSpace(config.ComputerLab)
	config.PCNumber = strings.TrimSpace(config.PCNumber)

	return config
}

// SaveAppSettings saves lock/station settings to the runtime-mode-aware config path.
// In production this uses user config storage to avoid protected install directories.
func SaveAppSettings(config AppConfig) error {
	configPath, err := getUserAppConfigPath()
	if err != nil {
		return fmt.Errorf("failed to get user config path: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(configPath), 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal app settings: %w", err)
	}

	data = append(data, '\n')
	if err := os.WriteFile(configPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write app settings: %w", err)
	}

	log.Printf("App settings saved to %s", configPath)
	return nil
}

// getExecutableDir returns the directory where the executable is located
func getExecutableDir() (string, error) {
	exePath, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.Dir(exePath), nil
}

// LoadDatabaseSettings loads database configuration from config.ini using mode-aware lookup paths.
// Development prefers project-root config.ini; production prefers user-scoped config.ini.
func LoadDatabaseSettings() (DBConfig, error) {
	configPaths := getConfigINIPaths()
	if len(configPaths) == 0 {
		return DBConfig{}, fmt.Errorf("unable to determine config.ini search paths")
	}

	var parseErrors []string
	for _, configPath := range configPaths {
		config, err := parseDatabaseConfigINI(configPath)
		if err == nil {
			log.Printf("Database settings loaded from %s", configPath)
			return config, nil
		}

		if errors.Is(err, os.ErrNotExist) {
			continue
		}

		parseErrors = append(parseErrors, fmt.Sprintf("%s: %v", configPath, err))
	}

	if len(parseErrors) > 0 {
		return DBConfig{}, fmt.Errorf("config.ini is malformed: %s", strings.Join(parseErrors, "; "))
	}

	return DBConfig{}, fmt.Errorf("config.ini not found; searched paths: %v", configPaths)
}

func getConfigINIPaths() []string {
	mode := getRuntimeMode()
	paths := make([]string, 0, 2)

	if mode == runtimeModeDevelopment {
		if cwd, err := os.Getwd(); err == nil {
			paths = append(paths, filepath.Join(cwd, "config.ini"))
		} else {
			log.Printf("Unable to determine current working directory: %v", err)
		}

		if exeDir, err := getExecutableDir(); err == nil {
			paths = append(paths, filepath.Join(exeDir, "config.ini"))
		} else {
			log.Printf("Unable to determine executable directory: %v", err)
		}
	} else {
		if userConfigPath, err := getUserConfigINIPath(); err == nil {
			paths = append(paths, userConfigPath)
		} else {
			log.Printf("Unable to determine user config.ini path: %v", err)
		}

		if exeDir, err := getExecutableDir(); err == nil {
			paths = append(paths, filepath.Join(exeDir, "config.ini"))
		} else {
			log.Printf("Unable to determine executable directory: %v", err)
		}
	}

	seen := make(map[string]struct{})
	uniquePaths := make([]string, 0, len(paths))
	for _, p := range paths {
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}
		uniquePaths = append(uniquePaths, p)
	}

	return uniquePaths
}

func parseDatabaseConfigINI(configPath string) (DBConfig, error) {
	file, err := os.Open(configPath)
	if err != nil {
		return DBConfig{}, err
	}
	defer file.Close()

	config := DBConfig{}
	foundDatabaseSection := false
	inDatabaseSection := false

	scanner := bufio.NewScanner(file)
	lineNumber := 0
	for scanner.Scan() {
		lineNumber++
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, ";") {
			continue
		}

		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			section := strings.ToLower(strings.TrimSpace(line[1 : len(line)-1]))
			inDatabaseSection = section == "database"
			if inDatabaseSection {
				foundDatabaseSection = true
			}
			continue
		}

		if !inDatabaseSection {
			continue
		}

		key, value, found := strings.Cut(line, "=")
		if !found {
			return DBConfig{}, fmt.Errorf("invalid key/value on line %d", lineNumber)
		}

		key = strings.ToLower(strings.TrimSpace(key))
		value = strings.TrimSpace(value)
		value = strings.Trim(value, `"'`)

		switch key {
		case "host":
			config.Host = value
		case "port":
			config.Port = value
		case "dbname":
			config.DBName = value
		case "username":
			config.Username = value
		case "password":
			config.Password = value
		}
	}

	if err := scanner.Err(); err != nil {
		return DBConfig{}, fmt.Errorf("failed to read file: %w", err)
	}

	if !foundDatabaseSection {
		return DBConfig{}, fmt.Errorf("missing [database] section")
	}

	if err := validateDatabaseConfig(config); err != nil {
		return DBConfig{}, err
	}

	return config, nil
}

func parseDatabaseConfigINIOptional(configPath string) (DBConfig, bool, error) {
	file, err := os.Open(configPath)
	if err != nil {
		return DBConfig{}, false, err
	}
	defer file.Close()

	config := DBConfig{}
	foundDatabaseSection := false
	inDatabaseSection := false

	scanner := bufio.NewScanner(file)
	lineNumber := 0
	for scanner.Scan() {
		lineNumber++
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, ";") {
			continue
		}

		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			section := strings.ToLower(strings.TrimSpace(line[1 : len(line)-1]))
			inDatabaseSection = section == "database"
			if inDatabaseSection {
				foundDatabaseSection = true
			}
			continue
		}

		if !inDatabaseSection {
			continue
		}

		key, value, found := strings.Cut(line, "=")
		if !found {
			return DBConfig{}, false, fmt.Errorf("invalid key/value on line %d", lineNumber)
		}

		key = strings.ToLower(strings.TrimSpace(key))
		value = strings.TrimSpace(value)
		value = strings.Trim(value, `"'`)

		switch key {
		case "host":
			config.Host = value
		case "port":
			config.Port = value
		case "dbname":
			config.DBName = value
		case "username":
			config.Username = value
		case "password":
			config.Password = value
		}
	}

	if err := scanner.Err(); err != nil {
		return DBConfig{}, false, fmt.Errorf("failed to read file: %w", err)
	}

	return config, foundDatabaseSection, nil
}

func validateDatabaseConfig(config DBConfig) error {
	missing := make([]string, 0, 5)
	if strings.TrimSpace(config.Host) == "" {
		missing = append(missing, "database.host")
	}
	if strings.TrimSpace(config.Port) == "" {
		missing = append(missing, "database.port")
	}
	if strings.TrimSpace(config.DBName) == "" {
		missing = append(missing, "database.dbname")
	}
	if strings.TrimSpace(config.Username) == "" {
		missing = append(missing, "database.username")
	}
	if strings.TrimSpace(config.Password) == "" {
		missing = append(missing, "database.password")
	}
	if len(missing) > 0 {
		return fmt.Errorf("missing required settings: %s", strings.Join(missing, ", "))
	}

	port, err := strconv.Atoi(strings.TrimSpace(config.Port))
	if err != nil || port < 1 || port > 65535 {
		return fmt.Errorf("database.port must be a valid TCP port (1-65535)")
	}

	return nil
}

func resolveDatabaseConfigINIPathForWrite() (string, error) {
	if getRuntimeMode() == runtimeModeDevelopment {
		if cwd, err := os.Getwd(); err == nil {
			return filepath.Join(cwd, "config.ini"), nil
		}
	}

	if userConfigPath, err := getUserConfigINIPath(); err == nil {
		return userConfigPath, nil
	}

	configPaths := getConfigINIPaths()
	if len(configPaths) > 0 {
		return configPaths[0], nil
	}

	return "", fmt.Errorf("unable to determine config.ini write path")
}

// ResolveDatabaseConfigINIPathForWrite returns where runtime DB settings should be persisted.
func ResolveDatabaseConfigINIPathForWrite() (string, error) {
	return resolveDatabaseConfigINIPathForWrite()
}

// LoadDatabaseSettingsDraft returns database settings even when incomplete.
// The bool indicates whether all required DB fields are present and valid.
func LoadDatabaseSettingsDraft() (DBConfig, string, bool, error) {
	defaultConfig := DBConfig{Port: "3306"}
	configPaths := getConfigINIPaths()
	if len(configPaths) == 0 {
		return defaultConfig, "", false, fmt.Errorf("unable to determine config.ini search paths")
	}

	for _, configPath := range configPaths {
		config, foundSection, err := parseDatabaseConfigINIOptional(configPath)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				continue
			}
			return defaultConfig, "", false, fmt.Errorf("failed to parse database settings from %s: %w", configPath, err)
		}

		if !foundSection {
			continue
		}

		if strings.TrimSpace(config.Port) == "" {
			config.Port = "3306"
		}

		isConfigured := validateDatabaseConfig(config) == nil
		return config, configPath, isConfigured, nil
	}

	return defaultConfig, "", false, nil
}

func renderConfigINIContent(config DBConfig, inactivityDays, deletionDays int) string {
	return fmt.Sprintf(
		"[database]\n"+
			"host=%s\n"+
			"port=%s\n"+
			"dbname=%s\n"+
			"username=%s\n"+
			"password=%s\n\n"+
			"[policy]\n"+
			"inactivity_deactivation_days=%d\n"+
			"deactivated_deletion_days=%d\n",
		config.Host,
		config.Port,
		config.DBName,
		config.Username,
		config.Password,
		inactivityDays,
		deletionDays,
	)
}

// SaveDatabaseSettings persists database settings to the active config.ini write target.
// Development writes to project config.ini; production writes to user config directory.
func SaveDatabaseSettings(config DBConfig) (string, error) {
	toSave := DBConfig{
		Host:     strings.TrimSpace(config.Host),
		Port:     strings.TrimSpace(config.Port),
		DBName:   strings.TrimSpace(config.DBName),
		Username: strings.TrimSpace(config.Username),
		Password: strings.TrimSpace(config.Password),
	}

	if err := validateDatabaseConfig(toSave); err != nil {
		return "", err
	}

	writePath, err := resolveDatabaseConfigINIPathForWrite()
	if err != nil {
		return "", err
	}

	if err := os.MkdirAll(filepath.Dir(writePath), 0755); err != nil {
		return "", fmt.Errorf("failed to create config directory: %w", err)
	}

	inactivityDays, deletionDays := LoadConfiguredPolicyThresholds()
	content := renderConfigINIContent(toSave, inactivityDays, deletionDays)

	if err := os.WriteFile(writePath, []byte(content), 0644); err != nil {
		return "", fmt.Errorf("failed to write database settings: %w", err)
	}

	log.Printf("Database settings saved to %s", writePath)
	return writePath, nil
}

// InitDatabase initializes and returns a database connection
func InitDatabase() (*sql.DB, error) {
	config, err := LoadDatabaseSettings()
	if err != nil {
		return nil, fmt.Errorf("failed to load database settings: %w", err)
	}

	log.Printf("Attempting to connect to database:")
	log.Printf("   Host: %s", config.Host)
	log.Printf("   Port: %s", config.Port)
	log.Printf("   Database: %s", config.DBName)
	log.Printf("   Username: %s", config.Username)

	// MySQL DSN format for local XAMPP/MySQL usage.
	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?parseTime=true&charset=utf8mb4&loc=Local&multiStatements=true",
		config.Username,
		config.Password,
		config.Host,
		config.Port,
		config.DBName,
	)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Printf("Failed to open database: %v", err)
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test the connection
	if err := db.Ping(); err != nil {
		log.Printf("Failed to ping database: %v", err)
		log.Printf("Troubleshooting tips:")
		log.Printf("   - Verify MySQL server is running on %s:%s", config.Host, config.Port)
		log.Printf("   - Check firewall allows TCP port %s", config.Port)
		log.Printf("   - Ensure MySQL user has access to database %s", config.DBName)
		log.Printf("   - Verify credentials: username=%s", config.Username)
		log.Printf("   - Check network connectivity to server")
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Println("Database connection established successfully")
	return db, nil
}
