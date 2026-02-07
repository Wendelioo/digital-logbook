-- ============================================================================
-- Digital Logbook Database Seed Data (SQL Server Edition)
-- Database: logbookdb
-- Description: Initial admin, student, teacher, and working student accounts
-- Converted for Microsoft SQL Server
-- ============================================================================

USE logbookdb;
GO

-- ============================================================================
-- INSERT DEFAULT ADMIN ACCOUNTS
-- ============================================================================

-- Admin Account #1: Primary System Administrator
-- Username: 2211172
-- Password: admin123 (PLAIN TEXT - should be hashed in production)
DECLARE @user_id INT;
INSERT INTO users (username, password, user_type, created_at) VALUES ('2211172', 'admin123', 'admin', GETDATE());
SET @user_id = SCOPE_IDENTITY();
INSERT INTO admins (user_id, first_name, middle_name, last_name, email, created_at) VALUES (@user_id, 'System', NULL, 'Administrator', 'admin@logbook.edu', GETDATE());
GO

-- ============================================================================
-- INSERT STUDENT ACCOUNTS (10 Students)
-- ============================================================================


-- Insert 10 students
DECLARE @student_id INT;
INSERT INTO users (username, password, user_type, created_at) VALUES ('2000001', 'student123', 'student', GETDATE());
SET @student_id = SCOPE_IDENTITY();
INSERT INTO students (user_id, student_id, first_name, middle_name, last_name, email, department_id, created_at) VALUES (@student_id, '2000001', 'John', 'Michael', 'Doe', 'john.doe@student.edu', NULL, GETDATE());

INSERT INTO users (username, password, user_type, created_at) VALUES ('2000002', 'student123', 'student', GETDATE());
SET @student_id = SCOPE_IDENTITY();
INSERT INTO students (user_id, student_id, first_name, middle_name, last_name, email, department_id, created_at) VALUES (@student_id, '2000002', 'Jane', 'Marie', 'Smith', 'jane.smith@student.edu', NULL, GETDATE());

INSERT INTO users (username, password, user_type, created_at) VALUES ('2000003', 'student123', 'student', GETDATE());
SET @student_id = SCOPE_IDENTITY();
INSERT INTO students (user_id, student_id, first_name, middle_name, last_name, email, department_id, created_at) VALUES (@student_id, '2000003', 'Robert', 'James', 'Johnson', 'robert.johnson@student.edu', NULL, GETDATE());

INSERT INTO users (username, password, user_type, created_at) VALUES ('2000004', 'student123', 'student', GETDATE());
SET @student_id = SCOPE_IDENTITY();
INSERT INTO students (user_id, student_id, first_name, middle_name, last_name, email, department_id, created_at) VALUES (@student_id, '2000004', 'Maria', 'Grace', 'Williams', 'maria.williams@student.edu', NULL, GETDATE());

INSERT INTO users (username, password, user_type, created_at) VALUES ('2000005', 'student123', 'student', GETDATE());
SET @student_id = SCOPE_IDENTITY();
INSERT INTO students (user_id, student_id, first_name, middle_name, last_name, email, department_id, created_at) VALUES (@student_id, '2000005', 'David', 'Paul', 'Brown', 'david.brown@student.edu', NULL, GETDATE());

INSERT INTO users (username, password, user_type, created_at) VALUES ('2000006', 'student123', 'student', GETDATE());
SET @student_id = SCOPE_IDENTITY();
INSERT INTO students (user_id, student_id, first_name, middle_name, last_name, email, department_id, created_at) VALUES (@student_id, '2000006', 'Sarah', 'Ann', 'Jones', 'sarah.jones@student.edu', NULL, GETDATE());

INSERT INTO users (username, password, user_type, created_at) VALUES ('2000007', 'student123', 'student', GETDATE());
SET @student_id = SCOPE_IDENTITY();
INSERT INTO students (user_id, student_id, first_name, middle_name, last_name, email, department_id, created_at) VALUES (@student_id, '2000007', 'Michael', 'Thomas', 'Garcia', 'michael.garcia@student.edu', NULL, GETDATE());

INSERT INTO users (username, password, user_type, created_at) VALUES ('2000008', 'student123', 'student', GETDATE());
SET @student_id = SCOPE_IDENTITY();
INSERT INTO students (user_id, student_id, first_name, middle_name, last_name, email, department_id, created_at) VALUES (@student_id, '2000008', 'Emily', 'Rose', 'Miller', 'emily.miller@student.edu', NULL, GETDATE());

INSERT INTO users (username, password, user_type, created_at) VALUES ('2000009', 'student123', 'student', GETDATE());
SET @student_id = SCOPE_IDENTITY();
INSERT INTO students (user_id, student_id, first_name, middle_name, last_name, email, department_id, created_at) VALUES (@student_id, '2000009', 'Christopher', 'Lee', 'Davis', 'christopher.davis@student.edu', NULL, GETDATE());

INSERT INTO users (username, password, user_type, created_at) VALUES ('2000010', 'student123', 'student', GETDATE());
SET @student_id = SCOPE_IDENTITY();
INSERT INTO students (user_id, student_id, first_name, middle_name, last_name, email, department_id, created_at) VALUES (@student_id, '2000010', 'Jessica', 'Lynn', 'Rodriguez', 'jessica.rodriguez@student.edu', NULL, GETDATE());
GO

-- ============================================================================
-- INSERT WORKING STUDENT ACCOUNTS (2 Working Students)
-- ============================================================================


-- Insert 2 working students
DECLARE @working_id INT;
INSERT INTO users (username, password, user_type, created_at) VALUES ('3000001', 'working123', 'working_student', GETDATE());
SET @working_id = SCOPE_IDENTITY();
INSERT INTO students (user_id, student_id, first_name, middle_name, last_name, email, department_id, created_at) VALUES (@working_id, '3000001', 'Daniel', 'Mark', 'Martinez', 'daniel.martinez@student.edu', NULL, GETDATE());

INSERT INTO users (username, password, user_type, created_at) VALUES ('3000002', 'working123', 'working_student', GETDATE());
SET @working_id = SCOPE_IDENTITY();
INSERT INTO students (user_id, student_id, first_name, middle_name, last_name, email, department_id, created_at) VALUES (@working_id, '3000002', 'Amanda', 'Nicole', 'Anderson', 'amanda.anderson@student.edu', NULL, GETDATE());
GO

-- ============================================================================
-- INSERT TEACHER ACCOUNTS (2 Teachers)
-- ============================================================================


-- Insert 2 teachers
DECLARE @teacher_id INT;
INSERT INTO users (username, password, user_type, created_at) VALUES ('4000001', 'teacher123', 'teacher', GETDATE());
SET @teacher_id = SCOPE_IDENTITY();
INSERT INTO teachers (user_id, teacher_id, first_name, middle_name, last_name, email, department_id, created_at) VALUES (@teacher_id, '4000001', 'Dr. Patricia', 'Anne', 'Wilson', 'patricia.wilson@teacher.edu', NULL, GETDATE());

INSERT INTO users (username, password, user_type, created_at) VALUES ('4000002', 'teacher123', 'teacher', GETDATE());
SET @teacher_id = SCOPE_IDENTITY();
INSERT INTO teachers (user_id, teacher_id, first_name, middle_name, last_name, email, department_id, created_at) VALUES (@teacher_id, '4000002', 'Prof. Richard', 'John', 'Taylor', 'richard.taylor@teacher.edu', NULL, GETDATE());
GO

-- ============================================================================
-- END OF SEED DATA
-- ============================================================================