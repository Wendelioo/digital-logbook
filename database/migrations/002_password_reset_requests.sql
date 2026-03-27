-- Migration 002: Password Reset Requests
-- Adds the password_reset_requests table to support the student forgot-password
-- flow where students submit a reset request and a teacher approves it.

USE logbookdb;
GO

IF OBJECT_ID('password_reset_requests', 'U') IS NULL
BEGIN
    CREATE TABLE password_reset_requests (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        student_user_id     INT NOT NULL,
        teacher_user_id     INT NOT NULL,
        new_password_hash   NVARCHAR(255) NOT NULL,
        status              NVARCHAR(20) NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'rejected')),
        requested_at        DATETIME DEFAULT GETDATE(),
        resolved_at         DATETIME NULL,
        CONSTRAINT fk_prr_student FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_prr_teacher FOREIGN KEY (teacher_user_id) REFERENCES users(id)
    );

    CREATE INDEX idx_prr_student_id ON password_reset_requests(student_user_id);
    CREATE INDEX idx_prr_teacher_id ON password_reset_requests(teacher_user_id);
    CREATE INDEX idx_prr_status ON password_reset_requests(status);

    PRINT 'password_reset_requests table created.';
END
ELSE
BEGIN
    PRINT 'password_reset_requests table already exists, skipping.';
END
GO
