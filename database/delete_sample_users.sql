/* ================================
   DIGITAL LOGBOOK - DELETE SAMPLE USER ACCOUNTS
   Generated: February 8, 2026
   
   WARNING: This script will permanently delete all sample accounts
   created by the sample_users.sql script.
   
   USE WITH CAUTION - This action cannot be undone!
================================ */

USE logbookdb;
GO

/* ================================
   METHOD 1: DELETE BY USERNAME (RECOMMENDED)
   
   This is the safest method as it targets specific usernames.
   CASCADE DELETE will automatically remove related records from:
   - admins table
   - teachers table
   - students table
   - profile_photos table
   - login_logs table
   - attendance table
   - Any other tables with foreign key relationships
================================ */

-- Delete all sample user accounts
DELETE FROM users WHERE username IN (
    -- Admin accounts (3)
    'ADM-2026-001', 'ADM-2026-002', 'ADM-2026-003',
    
    -- Teacher accounts (5)
    'TCH-BSIT-001', 'TCH-BSCS-001', 'TCH-BSIT-002', 'TCH-BSBA-001', 'TCH-BSED-001',
    
    -- Regular student accounts (10)
    '2023-00001', '2023-00002', '2023-00003', '2023-00004', '2023-00005',
    '2023-00006', '2023-00007', '2023-00008', '2023-00009', '2023-00010',
    
    -- Working student accounts (5)
    'WS-2023-001', 'WS-2023-002', 'WS-2023-003', 'WS-2023-004', 'WS-2023-005',
    
    -- Pending registration accounts (2)
    '2024-00001', '2024-00002'
);

PRINT 'Successfully deleted 25 sample user accounts';
GO

/* ================================
   OPTIONAL: DELETE SAMPLE DEPARTMENTS
   
   Uncomment this section if you want to delete the sample departments too.
   WARNING: This will fail if any other records reference these departments!
================================ */
/*
DELETE FROM departments WHERE department_code IN (
    'BSIT',  -- Bachelor of Science in Information Technology
    'BSCS',  -- Bachelor of Science in Computer Science
    'BSBA',  -- Bachelor of Science in Business Administration
    'BSED',  -- Bachelor of Secondary Education
    'BSEE'   -- Bachelor of Science in Electrical Engineering
);

PRINT 'Successfully deleted 5 sample departments';
GO
*/

/* ================================
   METHOD 2: DELETE BY SPECIFIC IDs
   
   Use this if usernames were changed but you still want to target
   the sample accounts based on their ID patterns.
================================ */
/*
DELETE FROM users WHERE id IN (
    -- Find by admin IDs
    SELECT id FROM admins WHERE admin_id IN ('ADM-2026-001', 'ADM-2026-002', 'ADM-2026-003')
    UNION
    -- Find by teacher IDs
    SELECT id FROM teachers WHERE teacher_id LIKE 'TCH-%'
    UNION
    -- Find by student IDs
    SELECT id FROM students WHERE 
        student_id LIKE '2023-%' OR 
        student_id LIKE 'WS-2023-%' OR 
        student_id LIKE '2024-%'
);

PRINT 'Deleted sample accounts by ID patterns';
GO
*/

/* ================================
   METHOD 3: DELETE BY DATE RANGE
   
   Delete all accounts created on a specific date (when you ran sample_users.sql)
   Adjust the date to match when you created the sample accounts.
================================ */
/*
DELETE FROM users 
WHERE CAST(created_at AS DATE) = '2026-02-08'  -- Change this date!
  AND username IN (
      SELECT username FROM users 
      WHERE username LIKE 'admin%' 
         OR username LIKE 'teacher%' 
         OR username LIKE 'student%' 
         OR username LIKE 'ws%'
         OR username LIKE 'pending%'
  );

PRINT 'Deleted accounts created on specified date';
GO
*/

/* ================================
   VERIFICATION QUERIES
   
   Run these after deletion to verify the cleanup was successful
================================ */

-- Check total remaining users
SELECT COUNT(*) AS TotalRemainingUsers FROM users;
GO

-- Count users by type
SELECT 
    user_type, 
    COUNT(*) AS Count,
    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS ActiveCount,
    SUM(CASE WHEN account_status = 'pending' THEN 1 ELSE 0 END) AS PendingCount
FROM users 
GROUP BY user_type
ORDER BY user_type;
GO

-- List remaining usernames (to verify sample accounts are gone)
SELECT 
    username, 
    user_type, 
    account_status, 
    created_at 
FROM users 
ORDER BY created_at DESC;
GO

/* ================================
   ROLLBACK INFORMATION
   
   If you need to restore the deleted accounts, you have two options:
   
   1. If you have a database backup, restore from backup
   2. Re-run the sample_users.sql script to recreate the accounts
   
   Note: Re-running sample_users.sql will create new records with 
   different IDs, but the same usernames and data.
================================ */
