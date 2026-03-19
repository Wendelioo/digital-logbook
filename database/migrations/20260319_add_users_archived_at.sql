-- Add users.archived_at as a dedicated archive timestamp column.
-- SQL Server (idempotent)

IF COL_LENGTH('users', 'archived_at') IS NULL
BEGIN
    ALTER TABLE users ADD archived_at DATETIME NULL;
END

-- Backfill archived_at for already archived accounts, when missing.
IF COL_LENGTH('users', 'archived_at') IS NOT NULL
BEGIN
    EXEC sp_executesql N'
        UPDATE users
        SET archived_at = updated_at
        WHERE account_status = ''archived''
          AND archived_at IS NULL;
    ';
END
