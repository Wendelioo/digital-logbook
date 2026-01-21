-- Migration: Add archive columns to login_logs and feedback tables
-- Purpose: Allow admins to archive records before exporting to PDF/CSV
-- Date: 2026-01-21

-- Add archive columns to login_logs table
ALTER TABLE login_logs 
    ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether this log has been archived by admin',
    ADD COLUMN archived_at DATETIME NULL COMMENT 'Timestamp when the log was archived',
    ADD COLUMN archived_by_user_id INT NULL COMMENT 'User ID who archived this log',
    ADD INDEX idx_login_logs_archived (is_archived, login_time DESC),
    ADD INDEX idx_login_logs_archived_at (archived_at);

-- Add foreign key for archived_by_user_id
ALTER TABLE login_logs
    ADD CONSTRAINT fk_login_logs_archived_by 
    FOREIGN KEY (archived_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add archive columns to feedback table
ALTER TABLE feedback 
    ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether this feedback has been archived by admin',
    ADD COLUMN archived_at DATETIME NULL COMMENT 'Timestamp when the feedback was archived',
    ADD COLUMN archived_by_user_id INT NULL COMMENT 'User ID who archived this feedback',
    ADD INDEX idx_feedback_archived (is_archived, date_submitted DESC),
    ADD INDEX idx_feedback_archived_at (archived_at);

-- Add foreign key for archived_by_user_id in feedback
ALTER TABLE feedback
    ADD CONSTRAINT fk_feedback_archived_by 
    FOREIGN KEY (archived_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
