-- ============================================================================
-- Digital Logbook Database Seed Data
-- Database: logbookdb
-- Description: Initial admin account(s) for system access
-- Version: 4.0
-- Last Updated: 2025-01-XX
-- Schema Changes:
--   - admin_id → employee_number (admins table)
--   - teacher_id → employee_number (teachers table)
--   - student_id → student_number (students table)
--   - working_students table merged into students table with is_working_student flag
--   - Removed gender field from all user type tables
-- ============================================================================

USE logbookdb;

-- ============================================================================
-- CLEAR EXISTING SEED DATA (Optional - Uncomment if needed)
-- ============================================================================
-- DELETE FROM admins WHERE user_id IN (1, 2);
-- DELETE FROM users WHERE id IN (1, 2);

-- ============================================================================
-- INSERT DEFAULT ADMIN ACCOUNTS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Admin Account #1: Primary System Administrator
-- ----------------------------------------------------------------------------
-- Username: 2211172
-- Password: admin123 (PLAIN TEXT - should be hashed in production)
-- Purpose: Primary system administrator account
-- ----------------------------------------------------------------------------
INSERT INTO users (id, username, password, user_type, is_active, created_at) VALUES 
(1, '2211172', 'admin123', 'admin', TRUE, CURRENT_TIMESTAMP);

INSERT INTO admins (id, admin_id, first_name, middle_name, last_name, email, created_at) VALUES 
(1, '2211172', 'System', NULL, 'Administrator', 'admin@logbook.edu', CURRENT_TIMESTAMP);

-- ----------------------------------------------------------------------------
-- Admin Account #2: Secondary Administrator (Optional)
-- ----------------------------------------------------------------------------
-- Uncomment the following lines to add a second admin account
/*
INSERT INTO users (id, username, password, user_type, is_active, created_at) VALUES 
(2, 'admin002', 'admin123', 'admin', TRUE, CURRENT_TIMESTAMP);

INSERT INTO admins (id, admin_id, first_name, middle_name, last_name, email, created_at) VALUES 
(2, 'ADM-002', 'Secondary', NULL, 'Administrator', 'admin2@logbook.edu', CURRENT_TIMESTAMP);
*/

-- ============================================================================
-- VERIFICATION QUERIES (Optional - Run to verify seed data)
-- ============================================================================
-- SELECT * FROM v_users_complete WHERE user_type = 'admin';
-- SELECT u.username, u.user_type, a.first_name, a.last_name, a.email 
-- FROM users u 
-- JOIN admins a ON u.id = a.id;

-- ============================================================================
-- IMPORTANT NOTES
-- ============================================================================
-- 1. Default admin credentials:
--    - Username: 2211172
--    - Password: admin123
--
-- 2. SECURITY WARNING: 
--    - Change default passwords immediately after first login
--    - In production, passwords should be hashed (bcrypt, argon2, etc.)
--    - Current passwords are stored in PLAIN TEXT for development only
--
-- 3. To add more admin accounts:
--    - Copy the INSERT statements above
--    - Change the id, username, admin_id, and personal details
--    - Ensure id in admins table matches id in users table
--
-- 4. Admin privileges:
--    - Full system access
--    - User management (create/edit/delete all user types)
--    - View all reports and analytics
--    - System configuration
--    - Feedback management and resolution
--
-- 5. To reset admin password:
--    UPDATE users SET password = 'newpassword123' WHERE username = '2211172';
--
-- ============================================================================
-- TEMPLATE: Add New Admin Account
-- ============================================================================
/*
-- Replace [ID], [USERNAME], [ADMIN_ID], [FIRSTNAME], [LASTNAME], [EMAIL]
INSERT INTO users (id, username, password, user_type, is_active, created_at) VALUES 
([ID], '[USERNAME]', 'admin123', 'admin', TRUE, CURRENT_TIMESTAMP);

INSERT INTO admins (id, admin_id, first_name, middle_name, last_name, email, created_at) VALUES 
([ID], '[ADMIN_ID]', '[FIRSTNAME]', NULL, '[LASTNAME]', '[EMAIL]', CURRENT_TIMESTAMP);
*/

-- ============================================================================
-- INSERT STUDENT ACCOUNTS (10 Students)
-- ============================================================================

-- Student 1
INSERT INTO users (id, username, password, user_type, is_active, created_at) VALUES 
(2, '2000001', 'student123', 'student', TRUE, CURRENT_TIMESTAMP);

INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student, created_at) VALUES 
(2, '2000001', 'John', 'Michael', 'Doe', 'john.doe@student.edu', '09123456789', FALSE, CURRENT_TIMESTAMP);

-- Student 2
INSERT INTO users (id, username, password, user_type, is_active, created_at) VALUES 
(3, '2000002', 'student123', 'student', TRUE, CURRENT_TIMESTAMP);

INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student, created_at) VALUES 
(3, '2000002', 'Jane', 'Marie', 'Smith', 'jane.smith@student.edu', '09123456790', FALSE, CURRENT_TIMESTAMP);

-- Student 3
INSERT INTO users (id, username, password, user_type, is_active, created_at) VALUES 
(4, '2000003', 'student123', 'student', TRUE, CURRENT_TIMESTAMP);

INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student, created_at) VALUES 
(4, '2000003', 'Robert', 'James', 'Johnson', 'robert.johnson@student.edu', '09123456791', FALSE, CURRENT_TIMESTAMP);

-- Student 4
INSERT INTO users (id, username, password, user_type, is_active, created_at) VALUES 
(5, '2000004', 'student123', 'student', TRUE, CURRENT_TIMESTAMP);

INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student, created_at) VALUES 
(5, '2000004', 'Maria', 'Grace', 'Williams', 'maria.williams@student.edu', '09123456792', FALSE, CURRENT_TIMESTAMP);

-- Student 5
INSERT INTO users (id, username, password, user_type, is_active, created_at) VALUES 
(6, '2000005', 'student123', 'student', TRUE, CURRENT_TIMESTAMP);

INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student, created_at) VALUES 
(6, '2000005', 'David', 'Paul', 'Brown', 'david.brown@student.edu', '09123456793', FALSE, CURRENT_TIMESTAMP);

-- Student 6
INSERT INTO users (id, username, password, user_type, is_active, created_at) VALUES 
(7, '2000006', 'student123', 'student', TRUE, CURRENT_TIMESTAMP);

INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student, created_at) VALUES 
(7, '2000006', 'Sarah', 'Ann', 'Jones', 'sarah.jones@student.edu', '09123456794', FALSE, CURRENT_TIMESTAMP);

-- Student 7
INSERT INTO users (id, username, password, user_type, is_active, created_at) VALUES 
(8, '2000007', 'student123', 'student', TRUE, CURRENT_TIMESTAMP);

INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student, created_at) VALUES 
(8, '2000007', 'Michael', 'Thomas', 'Garcia', 'michael.garcia@student.edu', '09123456795', FALSE, CURRENT_TIMESTAMP);

-- Student 8
INSERT INTO users (id, username, password, user_type, is_active, created_at) VALUES 
(9, '2000008', 'student123', 'student', TRUE, CURRENT_TIMESTAMP);

INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student, created_at) VALUES 
(9, '2000008', 'Emily', 'Rose', 'Miller', 'emily.miller@student.edu', '09123456796', FALSE, CURRENT_TIMESTAMP);

-- Student 9
INSERT INTO users (id, username, password, user_type, is_active, created_at) VALUES 
(10, '2000009', 'student123', 'student', TRUE, CURRENT_TIMESTAMP);

INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student, created_at) VALUES 
(10, '2000009', 'Christopher', 'Lee', 'Davis', 'christopher.davis@student.edu', '09123456797', FALSE, CURRENT_TIMESTAMP);

-- Student 10
INSERT INTO users (id, username, password, user_type, is_active, created_at) VALUES 
(11, '2000010', 'student123', 'student', TRUE, CURRENT_TIMESTAMP);

INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student, created_at) VALUES 
(11, '2000010', 'Jessica', 'Lynn', 'Rodriguez', 'jessica.rodriguez@student.edu', '09123456798', FALSE, CURRENT_TIMESTAMP);

-- ============================================================================
-- INSERT WORKING STUDENT ACCOUNTS (2 Working Students)
-- Note: Working students are now stored in the students table with is_working_student = TRUE
-- ============================================================================

-- Working Student 1
INSERT INTO users (id, username, password, user_type, is_active, created_at) VALUES 
(12, '3000001', 'working123', 'working_student', TRUE, CURRENT_TIMESTAMP);

INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student, created_at) VALUES 
(12, '3000001', 'Daniel', 'Mark', 'Martinez', 'daniel.martinez@student.edu', '09123456799', TRUE, CURRENT_TIMESTAMP);

-- Working Student 2
INSERT INTO users (id, username, password, user_type, is_active, created_at) VALUES 
(13, '3000002', 'working123', 'working_student', TRUE, CURRENT_TIMESTAMP);

INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student, created_at) VALUES 
(13, '3000002', 'Amanda', 'Nicole', 'Anderson', 'amanda.anderson@student.edu', '09123456800', TRUE, CURRENT_TIMESTAMP);

-- ============================================================================
-- INSERT TEACHER ACCOUNTS (2 Teachers)
-- ============================================================================

-- Teacher 1
INSERT INTO users (id, username, password, user_type, is_active, created_at) VALUES 
(14, '4000001', 'teacher123', 'teacher', TRUE, CURRENT_TIMESTAMP);

INSERT INTO teachers (id, teacher_id, first_name, middle_name, last_name, email, contact_number, created_at) VALUES 
(14, '4000001', 'Dr. Patricia', 'Anne', 'Wilson', 'patricia.wilson@teacher.edu', '09123456801', CURRENT_TIMESTAMP);

-- Teacher 2
INSERT INTO users (id, username, password, user_type, is_active, created_at) VALUES 
(15, '4000002', 'teacher123', 'teacher', TRUE, CURRENT_TIMESTAMP);

INSERT INTO teachers (id, teacher_id, first_name, middle_name, last_name, email, contact_number, created_at) VALUES 
(15, '4000002', 'Prof. Richard', 'John', 'Taylor', 'richard.taylor@teacher.edu', '09123456802', CURRENT_TIMESTAMP);

-- ============================================================================
-- VERIFICATION QUERIES (Optional - Run to verify seed data)
-- ============================================================================
-- SELECT * FROM v_users_complete WHERE user_type = 'student';
-- SELECT * FROM v_users_complete WHERE user_type = 'working_student';
-- SELECT * FROM v_users_complete WHERE user_type = 'teacher';

-- ============================================================================
-- END OF SEED DATA
-- ============================================================================

