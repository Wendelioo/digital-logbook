/* Migration: add admin_status column to feedback table
   Date: 2026-03-17
   Purpose: Track admin workflow status (pending / resolved) for equipment feedback.
*/

IF COL_LENGTH('feedback', 'admin_status') IS NULL
BEGIN
    ALTER TABLE feedback
    ADD admin_status NVARCHAR(20) NULL;
END;
GO

/* Backfill existing rows with default admin_status = 'pending' where NULL */
UPDATE feedback
SET admin_status = 'pending'
WHERE admin_status IS NULL;
GO

/* Add default constraint if it does not already exist */
IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
    INNER JOIN sys.tables t ON t.object_id = c.object_id
    WHERE t.name = 'feedback'
      AND c.name = 'admin_status'
)
BEGIN
    ALTER TABLE feedback
    ADD CONSTRAINT DF_feedback_admin_status DEFAULT 'pending' FOR admin_status;
END;
GO

/* Add CHECK constraint for allowed values if it does not already exist */
IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints cc
    INNER JOIN sys.tables t ON t.object_id = cc.parent_object_id
    WHERE t.name = 'feedback'
      AND cc.name = 'CK_feedback_admin_status_values'
)
BEGIN
    ALTER TABLE feedback
    ADD CONSTRAINT CK_feedback_admin_status_values
    CHECK (admin_status IN ('pending', 'resolved'));
END;
GO

