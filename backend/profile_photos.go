package backend

import (
	"database/sql"
	"encoding/base64"
	"fmt"
	"log"
	"strings"
)

// ==============================================================================
// PROFILE PHOTO MANAGEMENT
// Stores profile photos as base64 data URLs directly in the database.
// No file system access needed — avoids permission issues in installed apps.
// ==============================================================================

const (
	MaxPhotoSizeBytes = 5 * 1024 * 1024 // 5MB (decoded binary size)
)

// SaveProfilePhoto saves a base64 data URL to the profile_photos table.
// photoDataURL should be in format: "data:image/jpeg;base64,/9j/4AAQ..."
func (a *App) SaveProfilePhoto(userID int, photoDataURL string) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	// Validate it's a data URL
	if !strings.HasPrefix(photoDataURL, "data:image/") {
		return fmt.Errorf("invalid photo format: expected a data URL starting with data:image/")
	}

	// Validate rough size (base64 string is ~1.33x the binary size)
	parts := strings.SplitN(photoDataURL, ",", 2)
	if len(parts) != 2 {
		return fmt.Errorf("invalid data URL format")
	}

	decoded, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return fmt.Errorf("invalid base64 data: %w", err)
	}
	if len(decoded) > MaxPhotoSizeBytes {
		return fmt.Errorf("photo exceeds maximum size of 5MB")
	}

	// Upsert: insert or update the photo_data for this user
	query := `
		MERGE profile_photos AS target
		USING (SELECT ? AS user_id, ? AS photo_data) AS source
		ON target.user_id = source.user_id
		WHEN MATCHED THEN
			UPDATE SET photo_data = source.photo_data, uploaded_at = CURRENT_TIMESTAMP
		WHEN NOT MATCHED THEN
			INSERT (user_id, photo_data) VALUES (source.user_id, source.photo_data);
	`

	_, err = a.db.Exec(query, userID, photoDataURL)
	if err != nil {
		return fmt.Errorf("failed to save profile photo: %w", err)
	}

	log.Printf("Profile photo saved to database for user %d (%d bytes)", userID, len(decoded))
	return nil
}

// GetProfilePhotoURL retrieves the base64 data URL for a user's profile photo.
// Returns empty string if no photo exists.
func (a *App) GetProfilePhotoURL(userID int) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}

	var photoData sql.NullString
	err := a.db.QueryRow(`SELECT photo_data FROM profile_photos WHERE user_id = ?`, userID).Scan(&photoData)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", err
	}

	if !photoData.Valid {
		return "", nil
	}

	return photoData.String, nil
}

// DeleteProfilePhoto removes a user's profile photo from the database.
func (a *App) DeleteProfilePhoto(userID int) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	result, err := a.db.Exec("DELETE FROM profile_photos WHERE user_id = ?", userID)
	if err != nil {
		return fmt.Errorf("failed to delete profile photo: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("no profile photo found for user %d", userID)
	}

	log.Printf("Profile photo deleted for user %d", userID)
	return nil
}

// loadUserPhotoURL is a helper that loads a user's photo data URL from the DB
// and sets the PhotoURL field on the user struct. Used during login and user listing.
func (a *App) loadUserPhotoURL(user *User) {
	var photoData sql.NullString
	err := a.db.QueryRow(`SELECT photo_data FROM profile_photos WHERE user_id = ?`, user.ID).Scan(&photoData)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("Warning: Failed to load profile photo for user %d: %v", user.ID, err)
		return
	}
	if photoData.Valid {
		user.PhotoURL = &photoData.String
	}
}
