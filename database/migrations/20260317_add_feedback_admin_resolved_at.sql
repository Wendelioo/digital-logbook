/* Migration: add admin_resolved_at column to feedback table
   Date: 2026-03-17
   Purpose: Track exact datetime when admin marks a feedback item as resolved.
*/

IF COL_LENGTH('feedback', 'admin_resolved_at') IS NULL
BEGIN
    ALTER TABLE feedback
    ADD admin_resolved_at DATETIME NULL;
END;
GO
