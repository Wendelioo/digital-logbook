-- Ensure users.account_status supports full lifecycle states.
-- SQL Server

DECLARE @dropSql NVARCHAR(MAX) = N'';

SELECT @dropSql = @dropSql + N'ALTER TABLE users DROP CONSTRAINT [' + cc.name + N'];'
FROM sys.check_constraints cc
INNER JOIN sys.columns c
    ON cc.parent_object_id = c.object_id
    AND cc.parent_column_id = c.column_id
INNER JOIN sys.tables t
    ON cc.parent_object_id = t.object_id
WHERE t.name = 'users'
  AND c.name = 'account_status';

IF LEN(@dropSql) > 0
BEGIN
    EXEC sp_executesql @dropSql;
END

IF COL_LENGTH('users', 'archived_at') IS NULL
BEGIN
  ALTER TABLE users ADD archived_at DATETIME NULL;
END

ALTER TABLE users WITH NOCHECK
ADD CONSTRAINT CK_users_account_status
CHECK (account_status IN ('pending', 'active', 'archived', 'deactivated', 'deleted', 'rejected'));

IF COL_LENGTH('users', 'archived_at') IS NOT NULL
BEGIN
  EXEC sp_executesql N'
    UPDATE users
    SET archived_at = updated_at
    WHERE account_status = ''archived''
      AND archived_at IS NULL;
  ';
END

UPDATE users
SET account_status = 'deleted',
    updated_at = GETDATE()
WHERE deleted_at IS NOT NULL
  AND account_status <> 'deleted';
