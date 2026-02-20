-- Fix for attendance table foreign key errors
-- Run this in your SQL Server database

USE logbookdb;
GO

-- Drop the attendance table if it exists (will fail if it doesn't exist, which is fine)
IF OBJECT_ID('attendance', 'U') IS NOT NULL 
    DROP TABLE attendance;
GO

-- Recreate with correct foreign key references
CREATE TABLE attendance (
    id INT IDENTITY(1,1) PRIMARY KEY,
    class_id INT NOT NULL,
    student_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    status NVARCHAR(20) DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'late')),
    remarks NVARCHAR(MAX),
    is_archived BIT DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    UNIQUE (class_id, student_id, attendance_date),
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
GO

SELECT 'Attendance table recreated successfully!' AS Result;
GO
