package backend

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

const (
	recoveryCodeLength = 10
)

const recoveryCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

type sqlExecer interface {
	Exec(query string, args ...interface{}) (sql.Result, error)
}

func (a *App) ensureUserRecoveryCodesTable() error {
	if err := a.checkDB(); err != nil {
		return err
	}

	query := `
		CREATE TABLE IF NOT EXISTS user_recovery_codes (
			user_id INT PRIMARY KEY,
			code_hash CHAR(64) NOT NULL,
			code_ciphertext TEXT NULL,
			created_at DATETIME NOT NULL DEFAULT NOW(),
			rotated_at DATETIME NULL,
			updated_at DATETIME NOT NULL DEFAULT NOW(),
			CONSTRAINT fk_urc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`

	if _, err := a.db.Exec(query); err != nil {
		return fmt.Errorf("failed to ensure user_recovery_codes table: %w", err)
	}

	var codeCipherExists int
	if err := a.db.QueryRow(`
		SELECT COUNT(*)
		FROM INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE()
		  AND TABLE_NAME = 'user_recovery_codes'
		  AND COLUMN_NAME = 'code_ciphertext'
	`).Scan(&codeCipherExists); err != nil {
		return fmt.Errorf("failed to inspect user_recovery_codes.code_ciphertext column: %w", err)
	}

	if codeCipherExists == 0 {
		if _, err := a.db.Exec(`ALTER TABLE user_recovery_codes ADD COLUMN code_ciphertext TEXT NULL AFTER code_hash`); err != nil {
			return fmt.Errorf("failed to add user_recovery_codes.code_ciphertext column: %w", err)
		}
	}

	return nil
}

func hashRecoveryCode(code string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(strings.ToUpper(code))))
	return hex.EncodeToString(sum[:])
}

func normalizeRecoveryCode(code string) string {
	normalized := strings.TrimSpace(strings.ToUpper(code))
	normalized = strings.ReplaceAll(normalized, " ", "")
	normalized = strings.ReplaceAll(normalized, "-", "")
	return normalized
}

func formatRecoveryCode(code string) string {
	if len(code) <= 5 {
		return code
	}
	return code[:5] + "-" + code[5:]
}

func generateRecoveryCode() (string, error) {
	buf := make([]byte, recoveryCodeLength)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("failed to generate recovery code: %w", err)
	}

	for i := range buf {
		buf[i] = recoveryCodeAlphabet[int(buf[i])%len(recoveryCodeAlphabet)]
	}

	return string(buf), nil
}

func recoveryCodeEncryptionKey() ([]byte, error) {
	secret := strings.TrimSpace(os.Getenv("RECOVERY_CODE_SECRET"))
	if secret == "" {
		cfg, err := LoadDatabaseSettings()
		if err != nil {
			log.Printf("Unable to derive RECOVERY_CODE_SECRET from config.ini: %v", err)
		} else {
			secret = strings.TrimSpace(fmt.Sprintf("%s|%s|%s|%s", cfg.Host, cfg.DBName, cfg.Username, cfg.Password))
		}
	}

	if secret == "" {
		return nil, fmt.Errorf("recovery code encryption secret is not configured")
	}

	sum := sha256.Sum256([]byte(secret))
	key := make([]byte, len(sum))
	copy(key, sum[:])
	return key, nil
}

func encryptRecoveryCode(code string) (string, error) {
	key, err := recoveryCodeEncryptionKey()
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to initialize recovery-code cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to initialize recovery-code cipher mode: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("failed to generate recovery-code nonce: %w", err)
	}

	cipherText := gcm.Seal(nil, nonce, []byte(code), nil)
	payload := append(nonce, cipherText...)
	return base64.StdEncoding.EncodeToString(payload), nil
}

func decryptRecoveryCode(cipherText string) (string, error) {
	key, err := recoveryCodeEncryptionKey()
	if err != nil {
		return "", err
	}

	rawPayload, err := base64.StdEncoding.DecodeString(strings.TrimSpace(cipherText))
	if err != nil {
		return "", fmt.Errorf("invalid encrypted recovery code")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to initialize recovery-code cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to initialize recovery-code cipher mode: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(rawPayload) <= nonceSize {
		return "", fmt.Errorf("invalid encrypted recovery code payload")
	}

	nonce := rawPayload[:nonceSize]
	encrypted := rawPayload[nonceSize:]
	plainText, err := gcm.Open(nil, nonce, encrypted, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt recovery code")
	}

	return string(plainText), nil
}

func upsertRecoveryCodeHash(exec sqlExecer, userID int, codeHash, codeCiphertext string) error {
	_, err := exec.Exec(`
		INSERT INTO user_recovery_codes (user_id, code_hash, code_ciphertext, created_at, updated_at)
		VALUES (?, ?, ?, NOW(), NOW())
		ON DUPLICATE KEY UPDATE
			code_hash = VALUES(code_hash),
			code_ciphertext = VALUES(code_ciphertext),
			rotated_at = NOW(),
			updated_at = NOW()
	`, userID, codeHash, codeCiphertext)
	if err != nil {
		return fmt.Errorf("failed to store recovery code: %w", err)
	}

	return nil
}

func issueRecoveryCode(exec sqlExecer, userID int) (string, error) {
	if userID <= 0 {
		return "", fmt.Errorf("invalid user ID")
	}

	code, err := generateRecoveryCode()
	if err != nil {
		return "", err
	}

	encryptedCode, err := encryptRecoveryCode(code)
	if err != nil {
		return "", fmt.Errorf("failed to protect recovery code: %w", err)
	}

	if err := upsertRecoveryCodeHash(exec, userID, hashRecoveryCode(code), encryptedCode); err != nil {
		return "", err
	}

	return code, nil
}

func (a *App) getStoredRecoveryCode(userID int) (string, error) {
	var storedEncrypted sql.NullString
	err := a.db.QueryRow(`SELECT code_ciphertext FROM user_recovery_codes WHERE user_id = ?`, userID).Scan(&storedEncrypted)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("no recovery code is available for this account yet")
	}
	if err != nil {
		return "", fmt.Errorf("failed to load recovery code")
	}

	if !storedEncrypted.Valid || strings.TrimSpace(storedEncrypted.String) == "" {
		return "", fmt.Errorf("recovery code cannot be displayed for this account yet; generate a new one")
	}

	decrypted, err := decryptRecoveryCode(storedEncrypted.String)
	if err != nil {
		return "", fmt.Errorf("failed to decode recovery code")
	}

	return decrypted, nil
}

func (a *App) issueRecoveryCodeForUser(userID int) (string, error) {
	if err := a.ensureUserRecoveryCodesTable(); err != nil {
		return "", err
	}

	return issueRecoveryCode(a.db, userID)
}

func (a *App) issueRecoveryCodeForUserTx(tx *sql.Tx, userID int) (string, error) {
	if tx == nil {
		return "", fmt.Errorf("recovery code transaction is required")
	}

	return issueRecoveryCode(tx, userID)
}

func (a *App) resolveRecoveryResetUserByIdentifier(identifier string) (int, string, error) {
	identifier = strings.TrimSpace(identifier)
	if err := ValidateUsername(identifier); err != nil {
		return 0, "", err
	}

	var requesterUserID int
	var requesterRole string
	err := a.db.QueryRow(`
		SELECT u.id, u.user_type
		FROM users u
		LEFT JOIN students st ON st.id = u.id
		LEFT JOIN teachers t ON t.id = u.id
		LEFT JOIN admins ad ON ad.id = u.id
		WHERE u.account_status = 'active'
		  AND (u.username = ? OR st.student_id = ? OR t.teacher_id = ? OR ad.admin_id = ?)
		LIMIT 1
	`, identifier, identifier, identifier, identifier).Scan(&requesterUserID, &requesterRole)
	if err == sql.ErrNoRows {
		return 0, "", fmt.Errorf("account identifier not found")
	}
	if err != nil {
		return 0, "", fmt.Errorf("failed to look up account: %w", err)
	}

	return requesterUserID, requesterRole, nil
}

func (a *App) verifyRecoveryCodeForUser(userID int, recoveryCode string) error {
	normalizedCode := normalizeRecoveryCode(recoveryCode)
	if len(normalizedCode) != recoveryCodeLength {
		return fmt.Errorf("recovery code must be %d characters", recoveryCodeLength)
	}

	var storedCodeHash string
	err := a.db.QueryRow(`SELECT code_hash FROM user_recovery_codes WHERE user_id = ?`, userID).Scan(&storedCodeHash)
	if err == sql.ErrNoRows {
		return fmt.Errorf("no recovery code is available for this account yet; contact your administrator")
	}
	if err != nil {
		return fmt.Errorf("failed to verify recovery code: %w", err)
	}

	if hashRecoveryCode(normalizedCode) != storedCodeHash {
		return fmt.Errorf("invalid recovery code")
	}

	return nil
}

// VerifyPasswordResetIdentifier validates that an account ID exists and has a recovery code configured.
func (a *App) VerifyPasswordResetIdentifier(identifier string) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureUserRecoveryCodesTable(); err != nil {
		return err
	}

	requesterUserID, _, err := a.resolveRecoveryResetUserByIdentifier(identifier)
	if err != nil {
		return err
	}

	var storedHash string
	err = a.db.QueryRow(`SELECT code_hash FROM user_recovery_codes WHERE user_id = ?`, requesterUserID).Scan(&storedHash)
	if err == sql.ErrNoRows {
		return fmt.Errorf("no recovery code is available for this account yet; contact your administrator")
	}
	if err != nil {
		return fmt.Errorf("failed to verify recovery setup: %w", err)
	}

	return nil
}

// VerifyRecoveryCodeForIdentifier validates that a recovery code belongs to the provided account ID.
func (a *App) VerifyRecoveryCodeForIdentifier(identifier, recoveryCode string) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureUserRecoveryCodesTable(); err != nil {
		return err
	}

	requesterUserID, _, err := a.resolveRecoveryResetUserByIdentifier(identifier)
	if err != nil {
		return err
	}

	return a.verifyRecoveryCodeForUser(requesterUserID, recoveryCode)
}

// ResetPasswordWithIdentifierRecoveryCode resets password using account ID plus recovery code.
func (a *App) ResetPasswordWithIdentifierRecoveryCode(identifier, recoveryCode, newPassword string) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureUserRecoveryCodesTable(); err != nil {
		return err
	}
	if err := ValidateStrongPassword(newPassword); err != nil {
		return err
	}

	requesterUserID, role, err := a.resolveRecoveryResetUserByIdentifier(identifier)
	if err != nil {
		return err
	}

	if err := a.verifyRecoveryCodeForUser(requesterUserID, recoveryCode); err != nil {
		return err
	}

	newPasswordHashBytes, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to process password")
	}

	if _, err := a.db.Exec(`UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?`, string(newPasswordHashBytes), requesterUserID); err != nil {
		return fmt.Errorf("failed to update password")
	}

	log.Printf("Password reset completed through identifier + recovery code: user=%d role=%s", requesterUserID, role)

	go a.createNotification(requesterUserID, "password_reset",
		"Password Reset Completed",
		"Your password was successfully reset using your recovery code.",
		"success", notifRef("password_reset"), nil)

	return nil
}

// GetUserRecoveryCode returns the currently assigned recovery code for the user.
func (a *App) GetUserRecoveryCode(userID int) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	if err := ValidatePositiveID(userID, "user ID"); err != nil {
		return "", err
	}
	if err := a.ensureUserRecoveryCodesTable(); err != nil {
		return "", err
	}

	storedCode, err := a.getStoredRecoveryCode(userID)
	if err != nil {
		return "", err
	}

	return formatRecoveryCode(storedCode), nil
}

// GenerateUserRecoveryCode rotates and returns a new recovery code for the user.
func (a *App) GenerateUserRecoveryCode(userID int) (string, error) {
	if err := a.checkDB(); err != nil {
		return "", err
	}
	if err := ValidatePositiveID(userID, "user ID"); err != nil {
		return "", err
	}
	if err := a.ensureUserRecoveryCodesTable(); err != nil {
		return "", err
	}

	rotatedCode, issueErr := a.issueRecoveryCodeForUser(userID)
	if issueErr != nil {
		return "", fmt.Errorf("failed to issue recovery code")
	}

	return formatRecoveryCode(rotatedCode), nil
}
