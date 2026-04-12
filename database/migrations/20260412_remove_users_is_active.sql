-- Remove legacy users.is_active lifecycle flag.
-- Account lifecycle is now governed by account_status + archived_at/deactivated_at/deleted_at.

-- When running manually in MySQL Workbench, ensure a target database is selected.
USE logbookdb;

-- Workbench safe-update mode can block this migration update step.
SET @previous_sql_safe_updates = @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

-- Normalize inconsistent legacy rows before dropping column:
-- rows marked inactive but still status='active' become 'deactivated'.
SET @normalize_is_active_sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'is_active'
    ),
    'UPDATE users SET account_status = ''deactivated'', deactivated_at = COALESCE(deactivated_at, NOW()), updated_at = NOW() WHERE account_status = ''active'' AND is_active = 0',
    'SELECT 1'
  )
);

PREPARE stmt_normalize_is_active FROM @normalize_is_active_sql;
EXECUTE stmt_normalize_is_active;
DEALLOCATE PREPARE stmt_normalize_is_active;

-- Restore caller's safe-update setting.
SET SQL_SAFE_UPDATES = @previous_sql_safe_updates;

-- Drop legacy column when present.
SET @drop_is_active_sql = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'users'
              AND COLUMN_NAME = 'is_active'
        ),
        'ALTER TABLE users DROP COLUMN is_active',
        'SELECT 1'
    )
);

PREPARE stmt_drop_is_active FROM @drop_is_active_sql;
EXECUTE stmt_drop_is_active;
DEALLOCATE PREPARE stmt_drop_is_active;
