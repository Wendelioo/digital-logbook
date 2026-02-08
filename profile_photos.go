package main

import (
	"database/sql"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"strings"
)

// ==============================================================================
// PROFILE PHOTO MANAGEMENT
// ==============================================================================

const (
	MaxPhotoSize     = 5 * 1024 * 1024 // 5MB
	PhotoUploadDir   = "uploads/profiles"
	AllowedMimeTypes = "image/jpeg,image/jpg,image/png,image/gif"
)

// ProfilePhoto represents profile photo metadata
type ProfilePhoto struct {
	UserID     int    `json:"user_id"`
	PhotoPath  string `json:"photo_path"`
	FileName   string `json:"file_name"`
	FileSize   int    `json:"file_size"`
	MimeType   string `json:"mime_type"`
	UploadedAt string `json:"uploaded_at"`
}

// UploadProfilePhoto handles profile photo upload and storage
func (a *App) UploadProfilePhoto(userID int, photoData []byte, fileName string, mimeType string) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Validate file size
	if len(photoData) > MaxPhotoSize {
		return fmt.Errorf("file size exceeds maximum allowed size of 5MB")
	}

	// Validate MIME type
	if !strings.Contains(AllowedMimeTypes, mimeType) {
		return fmt.Errorf("invalid file type. Allowed types: jpeg, jpg, png, gif")
	}

	// Create upload directory if it doesn't exist
	if err := os.MkdirAll(PhotoUploadDir, 0755); err != nil {
		return fmt.Errorf("failed to create upload directory: %w", err)
	}

	// Generate file path
	ext := filepath.Ext(fileName)
	if ext == "" {
		// Determine extension from MIME type
		switch mimeType {
		case "image/jpeg", "image/jpg":
			ext = ".jpg"
		case "image/png":
			ext = ".png"
		case "image/gif":
			ext = ".gif"
		default:
			ext = ".jpg"
		}
	}

	photoFileName := fmt.Sprintf("user_%d%s", userID, ext)
	photoPath := filepath.Join(PhotoUploadDir, photoFileName)

	// Save file to disk
	if err := ioutil.WriteFile(photoPath, photoData, 0644); err != nil {
		return fmt.Errorf("failed to write photo file: %w", err)
	}

	log.Printf("Saved profile photo to: %s", photoPath)

	// Insert or update profile_photos table
	query := `
		MERGE profile_photos AS target
		USING (SELECT ? AS user_id, ? AS photo_path, ? AS file_name, ? AS file_size, ? AS mime_type) AS source
		ON target.user_id = source.user_id
		WHEN MATCHED THEN
			UPDATE SET photo_path = source.photo_path, file_name = source.file_name, file_size = source.file_size, mime_type = source.mime_type, uploaded_at = CURRENT_TIMESTAMP
		WHEN NOT MATCHED THEN
			INSERT (user_id, photo_path, file_name, file_size, mime_type)
			VALUES (source.user_id, source.photo_path, source.file_name, source.file_size, source.mime_type);
	`

	_, err := a.db.Exec(query, userID, photoPath, fileName, len(photoData), mimeType)
	if err != nil {
		// Clean up file if database insert fails
		os.Remove(photoPath)
		return fmt.Errorf("failed to save photo metadata: %w", err)
	}

	log.Printf("Profile photo uploaded successfully for user %d", userID)
	return nil
}

// GetProfilePhoto retrieves profile photo path for a user
func (a *App) GetProfilePhoto(userID int) (*ProfilePhoto, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT user_id, photo_path, file_name, file_size, mime_type, uploaded_at
		FROM profile_photos
		WHERE user_id = ?
	`

	var photo ProfilePhoto
	err := a.db.QueryRow(query, userID).Scan(
		&photo.UserID,
		&photo.PhotoPath,
		&photo.FileName,
		&photo.FileSize,
		&photo.MimeType,
		&photo.UploadedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // No photo found
		}
		return nil, err
	}

	return &photo, nil
}

// DeleteProfilePhoto removes a user's profile photo
func (a *App) DeleteProfilePhoto(userID int) error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	// Get photo path before deleting from database
	photo, err := a.GetProfilePhoto(userID)
	if err != nil {
		return err
	}

	if photo == nil {
		return fmt.Errorf("no profile photo found for user %d", userID)
	}

	// Delete from database
	_, err = a.db.Exec("DELETE FROM profile_photos WHERE user_id = ?", userID)
	if err != nil {
		return fmt.Errorf("failed to delete photo metadata: %w", err)
	}

	// Delete file from disk
	if err := os.Remove(photo.PhotoPath); err != nil {
		log.Printf("Warning: Failed to delete photo file %s: %v", photo.PhotoPath, err)
		// Don't return error if file deletion fails - database record is already deleted
	}

	log.Printf("Profile photo deleted for user %d", userID)
	return nil
}

// MigrateProfilePhotosFromBlob migrates existing BLOB photos to file system
// This should be run once during migration from old schema to new schema
func (a *App) MigrateProfilePhotosFromBlob() error {
	if a.db == nil {
		return fmt.Errorf("database not connected")
	}

	log.Println("Starting profile photo migration from BLOB to file system...")

	// Create upload directory
	if err := os.MkdirAll(PhotoUploadDir, 0755); err != nil {
		return fmt.Errorf("failed to create upload directory: %w", err)
	}

	migratedCount := 0
	errorCount := 0

	// Migrate admin photos
	adminQuery := `SELECT user_id, profile_photo FROM admins WHERE profile_photo IS NOT NULL`
	if count, errors := a.migratePhotosFromTable(adminQuery); errors == 0 {
		migratedCount += count
	} else {
		errorCount += errors
	}

	// Migrate teacher photos
	teacherQuery := `SELECT user_id, profile_photo FROM teachers WHERE profile_photo IS NOT NULL`
	if count, errors := a.migratePhotosFromTable(teacherQuery); errors == 0 {
		migratedCount += count
	} else {
		errorCount += errors
	}

	// Migrate student photos
	studentQuery := `SELECT user_id, profile_photo FROM students WHERE profile_photo IS NOT NULL`
	if count, errors := a.migratePhotosFromTable(studentQuery); errors == 0 {
		migratedCount += count
	} else {
		errorCount += errors
	}

	log.Printf("Migration complete: %d photos migrated, %d errors", migratedCount, errorCount)

	if errorCount > 0 {
		return fmt.Errorf("migration completed with %d errors", errorCount)
	}

	return nil
}

// Helper function to migrate photos from a specific table
func (a *App) migratePhotosFromTable(query string) (int, int) {
	rows, err := a.db.Query(query)
	if err != nil {
		log.Printf("Error querying photos: %v", err)
		return 0, 1
	}
	defer rows.Close()

	migratedCount := 0
	errorCount := 0

	for rows.Next() {
		var userID int
		var photoBlob []byte

		if err := rows.Scan(&userID, &photoBlob); err != nil {
			log.Printf("Error scanning photo row: %v", err)
			errorCount++
			continue
		}

		// Save photo to file system
		photoFileName := fmt.Sprintf("user_%d.jpg", userID)
		photoPath := filepath.Join(PhotoUploadDir, photoFileName)

		if err := ioutil.WriteFile(photoPath, photoBlob, 0644); err != nil {
			log.Printf("Error writing photo file for user %d: %v", userID, err)
			errorCount++
			continue
		}

		// Insert into profile_photos table
		insertQuery := `
			MERGE profile_photos AS target
			USING (SELECT ? AS user_id, ? AS photo_path, ? AS file_name, ? AS file_size, ? AS mime_type) AS source
			ON target.user_id = source.user_id
			WHEN MATCHED THEN
				UPDATE SET photo_path = source.photo_path, file_size = source.file_size
			WHEN NOT MATCHED THEN
				INSERT (user_id, photo_path, file_name, file_size, mime_type)
				VALUES (source.user_id, source.photo_path, source.file_name, source.file_size, source.mime_type);
		`

		_, err = a.db.Exec(insertQuery, userID, photoPath, photoFileName, len(photoBlob), "image/jpeg")
		if err != nil {
			log.Printf("Error inserting photo metadata for user %d: %v", userID, err)
			os.Remove(photoPath) // Clean up file
			errorCount++
			continue
		}

		migratedCount++
		if migratedCount%100 == 0 {
			log.Printf("Migrated %d photos...", migratedCount)
		}
	}

	return migratedCount, errorCount
}
