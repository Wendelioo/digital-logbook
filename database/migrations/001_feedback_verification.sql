-- Migration: Add working-student verification step before forwarding feedback to admin
-- Run this on existing databases. New installs use the updated logbookdb_sqlserver.sql.

-- Add columns for verification by working student
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('feedback') AND name = 'verified_by_user_id')
BEGIN
  ALTER TABLE feedback ADD verified_by_user_id INT NULL;
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('feedback') AND name = 'verified_at')
BEGIN
  ALTER TABLE feedback ADD verified_at DATETIME NULL;
END
GO

-- Add FK for verified_by_user_id (if column was just added)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('feedback') AND name = 'verified_by_user_id')
  AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('feedback') AND name = 'fk_feedback_verified_by')
BEGIN
  ALTER TABLE feedback ADD CONSTRAINT fk_feedback_verified_by 
    FOREIGN KEY (verified_by_user_id) REFERENCES users(id);
END
GO

-- Allow new status values: confirmed, rejected
DECLARE @ConstraintName NVARCHAR(200);
SELECT @ConstraintName = name FROM sys.check_constraints 
  WHERE parent_object_id = OBJECT_ID('feedback') 
  AND definition LIKE N'%status%';
IF @ConstraintName IS NOT NULL
  EXEC('ALTER TABLE feedback DROP CONSTRAINT ' + @ConstraintName);
ALTER TABLE feedback ADD CONSTRAINT CK_feedback_status 
  CHECK (status IN ('pending', 'confirmed', 'rejected', 'forwarded', 'resolved'));
GO
