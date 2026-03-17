-- Migration 003: Account Activity Tracking
-- Adds deactivated_at and deleted_at tracking columns to the users table.
--
-- deactivated_at: set automatically when a user is auto-deactivated after 6 months of inactivity.
--                 NULL means the account was manually archived (not auto-deactivated).
-- deleted_at:     set when a deactivated account has been inactive for 4+ years (soft-delete).
--                 A scheduled cleanup will permanently remove these records.
--
-- Run this script once against the logbookdb database before using the
-- new activity-status features in Admin > User Management.

IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'deactivated_at'
)
BEGIN
    ALTER TABLE users ADD deactivated_at DATETIME NULL;
    PRINT 'Added deactivated_at column to users table.';
END
GO

IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'deleted_at'
)
BEGIN
    ALTER TABLE users ADD deleted_at DATETIME NULL;
    PRINT 'Added deleted_at column to users table.';
END
GO
