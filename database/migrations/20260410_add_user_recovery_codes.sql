
CREATE DATABASE IF NOT EXISTS logbookdb;
USE logbookdb;

SET @legacy_reset_table := (
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name LIKE 'password_reset_%'
    LIMIT 1
);

SET @drop_legacy_stmt := IF(
    @legacy_reset_table IS NULL,
    'SELECT 1',
    CONCAT('DROP TABLE IF EXISTS `', REPLACE(@legacy_reset_table, '`', '``'), '`')
);

PREPARE drop_legacy_stmt FROM @drop_legacy_stmt;
EXECUTE drop_legacy_stmt;
DEALLOCATE PREPARE drop_legacy_stmt;

CREATE TABLE IF NOT EXISTS user_recovery_codes (
    user_id INT PRIMARY KEY,
    code_hash CHAR(64) NOT NULL,
    code_ciphertext TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    rotated_at DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_urc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

SET @code_plain_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'user_recovery_codes'
      AND column_name = 'code_plain'
);

SET @add_code_plain_stmt := IF(
    @code_plain_exists = 1,
    'ALTER TABLE user_recovery_codes DROP COLUMN code_plain',
    'SELECT 1'
);

PREPARE add_code_plain_stmt FROM @add_code_plain_stmt;
EXECUTE add_code_plain_stmt;
DEALLOCATE PREPARE add_code_plain_stmt;

SET @code_ciphertext_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'user_recovery_codes'
      AND column_name = 'code_ciphertext'
);

SET @add_code_ciphertext_stmt := IF(
    @code_ciphertext_exists = 0,
    'ALTER TABLE user_recovery_codes ADD COLUMN code_ciphertext TEXT NULL AFTER code_hash',
    'SELECT 1'
);

PREPARE add_code_ciphertext_stmt FROM @add_code_ciphertext_stmt;
EXECUTE add_code_ciphertext_stmt;
DEALLOCATE PREPARE add_code_ciphertext_stmt;

CREATE INDEX idx_urc_updated ON user_recovery_codes(updated_at);
