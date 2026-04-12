-- MySQL sample data generated from SQL Server script
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS logbookdb
   CHARACTER SET utf8mb4
   COLLATE utf8mb4_unicode_ci;
USE logbookdb;

/* ================================
   DIGITAL LOGBOOK - SAMPLE USER ACCOUNTS
   Generated: February 8, 2026
   
   IMPORTANT: Passwords are stored as bcrypt hashes
   Default password for all accounts: "password123"
   
   Note: This application uses bcrypt verification in auth.go
   For production, implement proper password hashing!
================================ */
/* ================================
   SAMPLE DEPARTMENTS
================================ */
-- Clear existing departments first (optional - comment out if departments already exist)
-- DELETE FROM departments;

INSERT INTO departments (department_code, department_name, description, is_active) VALUES
('BSIT', 'Bachelor of Science in Information Technology', 'IT and Computer Science programs', 1),
('BSCS', 'Bachelor of Science in Computer Science', 'Computer Science and Software Engineering', 1),
('BSBA', 'Bachelor of Science in Business Administration', 'Business and Management programs', 1),
('BSED', 'Bachelor of Secondary Education', 'Education programs', 1),
('BSEE', 'Bachelor of Science in Electrical Engineering', 'Engineering programs', 1);
/* ================================
   ADMIN ACCOUNTS
   Username format: 7-digit numeric ID (matches admin_id)
   Default password: password123
================================ */

-- Admin 1: Head Administrator
INSERT INTO users (username, password, user_type, account_status) VALUES
('1000001', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'admin', 'active');
INSERT INTO admins (id, admin_id, first_name, middle_name, last_name, email, contact_number) VALUES
(LAST_INSERT_ID(), '1000001', 'Maria', 'Santos', 'Cruz', 'maria.cruz@institution.edu', '+63-917-123-4567');

-- Admin 2: System Administrator
INSERT INTO users (username, password, user_type, account_status) VALUES
('1000002', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'admin', 'active');
INSERT INTO admins (id, admin_id, first_name, middle_name, last_name, email, contact_number) VALUES
(LAST_INSERT_ID(), '1000002', 'Juan', 'Dela', 'Garcia', 'juan.garcia@institution.edu', '+63-917-234-5678');

-- Admin 3: Lab Manager
INSERT INTO users (username, password, user_type, account_status) VALUES
('1000003', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'admin', 'active');
INSERT INTO admins (id, admin_id, first_name, middle_name, last_name, email, contact_number) VALUES
(LAST_INSERT_ID(), '1000003', 'Rosario', 'Flores', 'Reyes', 'rosario.reyes@institution.edu', '+63-917-345-6789');
/* ================================
   TEACHER ACCOUNTS
   Username format: 7-digit numeric ID (matches teacher_id)
   Default password: password123
================================ */

-- Teacher 1: BSIT Department
INSERT INTO users (username, password, user_type, account_status) VALUES
('2000001', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'teacher', 'active');
INSERT INTO teachers (id, teacher_id, first_name, middle_name, last_name, email, contact_number, department_code) VALUES
(LAST_INSERT_ID(), '2000001', 'Roberto', 'Manuel', 'Santos', 'roberto.santos@institution.edu', '+63-918-123-4567', 'BSIT');

-- Teacher 2: BSCS Department
INSERT INTO users (username, password, user_type, account_status) VALUES
('2000002', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'teacher', 'active');
INSERT INTO teachers (id, teacher_id, first_name, middle_name, last_name, email, contact_number, department_code) VALUES
(LAST_INSERT_ID(), '2000002', 'Ana', 'Marie', 'Lopez', 'ana.lopez@institution.edu', '+63-918-234-5678', 'BSCS');

-- Teacher 3: BSIT Department
INSERT INTO users (username, password, user_type, account_status) VALUES
('2000003', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'teacher', 'active');
INSERT INTO teachers (id, teacher_id, first_name, middle_name, last_name, email, contact_number, department_code) VALUES
(LAST_INSERT_ID(), '2000003', 'Carlos', 'Jose', 'Mendoza', 'carlos.mendoza@institution.edu', '+63-918-345-6789', 'BSIT');

-- Teacher 4: BSBA Department
INSERT INTO users (username, password, user_type, account_status) VALUES
('2000004', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'teacher', 'active');
INSERT INTO teachers (id, teacher_id, first_name, middle_name, last_name, email, contact_number, department_code) VALUES
(LAST_INSERT_ID(), '2000004', 'Patricia', 'Cruz', 'Ramos', 'patricia.ramos@institution.edu', '+63-918-456-7890', 'BSBA');

-- Teacher 5: BSED Department
INSERT INTO users (username, password, user_type, account_status) VALUES
('2000005', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'teacher', 'active');
INSERT INTO teachers (id, teacher_id, first_name, middle_name, last_name, email, contact_number, department_code) VALUES
(LAST_INSERT_ID(), '2000005', 'Francisco', 'Antonio', 'Torres', 'francisco.torres@institution.edu', '+63-918-567-8901', 'BSED');
/* ================================
   STUDENT ACCOUNTS (Regular Students)
   Username format: 7-digit numeric ID (matches student_id)
   Default password: password123
================================ */

-- Student 1
INSERT INTO users (username, password, user_type, account_status) VALUES
('3000001', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'student', 'active');
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(LAST_INSERT_ID(), '3000001', 'Miguel', 'Angel', 'Rivera', 'miguel.rivera@student.edu', '+63-919-123-4567', 0);

-- Student 2
INSERT INTO users (username, password, user_type, account_status) VALUES
('3000002', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'student', 'active');
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(LAST_INSERT_ID(), '3000002', 'Sofia', 'Marie', 'Gonzales', 'sofia.gonzales@student.edu', '+63-919-234-5678', 0);

-- Student 3
INSERT INTO users (username, password, user_type, account_status) VALUES
('3000003', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'student', 'active');
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(LAST_INSERT_ID(), '3000003', 'Diego', 'Luis', 'Fernandez', 'diego.fernandez@student.edu', '+63-919-345-6789', 0);

-- Student 4
INSERT INTO users (username, password, user_type, account_status) VALUES
('3000004', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'student', 'active');
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(LAST_INSERT_ID(), '3000004', 'Isabella', 'Grace', 'Morales', 'isabella.morales@student.edu', '+63-919-456-7890', 0);

-- Student 5
INSERT INTO users (username, password, user_type, account_status) VALUES
('3000005', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'student', 'active');
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(LAST_INSERT_ID(), '3000005', 'Gabriel', 'Jose', 'Castillo', 'gabriel.castillo@student.edu', '+63-919-567-8901', 0);

-- Student 6
INSERT INTO users (username, password, user_type, account_status) VALUES
('3000006', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'student', 'active');
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(LAST_INSERT_ID(), '3000006', 'Valentina', 'Rose', 'Jimenez', 'valentina.jimenez@student.edu', '+63-919-678-9012', 0);

-- Student 7
INSERT INTO users (username, password, user_type, account_status) VALUES
('3000007', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'student', 'active');
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(LAST_INSERT_ID(), '3000007', 'Lucas', 'Daniel', 'Vega', 'lucas.vega@student.edu', '+63-919-789-0123', 0);

-- Student 8
INSERT INTO users (username, password, user_type, account_status) VALUES
('3000008', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'student', 'active');
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(LAST_INSERT_ID(), '3000008', 'Camila', 'Nicole', 'Romero', 'camila.romero@student.edu', '+63-919-890-1234', 0);

-- Student 9
INSERT INTO users (username, password, user_type, account_status) VALUES
('3000009', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'student', 'active');
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(LAST_INSERT_ID(), '3000009', 'Sebastian', 'Miguel', 'Navarro', 'sebastian.navarro@student.edu', '+63-919-901-2345', 0);

-- Student 10
INSERT INTO users (username, password, user_type, account_status) VALUES
('3000010', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'student', 'active');
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(LAST_INSERT_ID(), '3000010', 'Emma', 'Sophia', 'Diaz', 'emma.diaz@student.edu', '+63-920-012-3456', 0);
/* ================================
   WORKING STUDENT ACCOUNTS
   Username format: 7-digit numeric ID (matches student_id)
   Default password: password123
   Note: is_working_student = 1
================================ */

-- Working Student 1
INSERT INTO users (username, password, user_type, account_status) VALUES
('4000001', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'working_student', 'active');
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(LAST_INSERT_ID(), '4000001', 'Andres', 'Carlos', 'Herrera', 'andres.herrera@student.edu', '+63-920-123-4567', 1);

-- Working Student 2
INSERT INTO users (username, password, user_type, account_status) VALUES
('4000002', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'working_student', 'active');
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(LAST_INSERT_ID(), '4000002', 'Lucia', 'Andrea', 'Ruiz', 'lucia.ruiz@student.edu', '+63-920-234-5678', 1);

-- Working Student 3
INSERT INTO users (username, password, user_type, account_status) VALUES
('4000003', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'working_student', 'active');
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(LAST_INSERT_ID(), '4000003', 'Marco', 'Felipe', 'Vargas', 'marco.vargas@student.edu', '+63-920-345-6789', 1);

-- Working Student 4
INSERT INTO users (username, password, user_type, account_status) VALUES
('4000004', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'working_student', 'active');
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(LAST_INSERT_ID(), '4000004', 'Daniela', 'Isabel', 'Ortiz', 'daniela.ortiz@student.edu', '+63-920-456-7890', 1);

-- Working Student 5
INSERT INTO users (username, password, user_type, account_status) VALUES
('4000005', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'working_student', 'active');
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(LAST_INSERT_ID(), '4000005', 'Rafael', 'Eduardo', 'Medina', 'rafael.medina@student.edu', '+63-920-567-8901', 1);
/* ================================
   PENDING REGISTRATION ACCOUNTS
   These accounts are in 'pending' status for testing approval workflow
================================ */

-- Pending Student 1
INSERT INTO users (username, password, user_type, account_status) VALUES
('5000001', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'student', 'pending');
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(LAST_INSERT_ID(), '5000001', 'Pedro', 'Juan', 'Santiago', 'pedro.santiago@student.edu', '+63-920-678-9012', 0);

-- Pending Student 2
INSERT INTO users (username, password, user_type, account_status) VALUES
('5000002', '$2a$10$udTUqxrPk4TB62QjtmzynOZc4h.GBEzKYE31BLbl4fR1YouIMW/uu', 'student', 'pending');
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(LAST_INSERT_ID(), '5000002', 'Carmen', 'Luz', 'Flores', 'carmen.flores@student.edu', '+63-920-789-0123', 0);

/* ================================
   SAMPLE RECOVERY CODES
   Format for seeded users: RC[username]X
   Example: username 3000001 -> recovery code RC3000001X
================================ */
INSERT INTO user_recovery_codes (user_id, code_hash, created_at, updated_at)
SELECT id, SHA2(CONCAT('RC', username, 'X'), 256), NOW(), NOW()
FROM users
ON DUPLICATE KEY UPDATE
    code_hash = VALUES(code_hash),
    rotated_at = NOW(),
    updated_at = NOW();

/* ================================
   SUMMARY OF CREATED ACCOUNTS
================================ */
-- Total Accounts Created:
-- - 3 Admin accounts (1000001 to 1000003)
-- - 5 Teacher accounts (2000001, 2000002, 2000003, 2000004, 2000005)
-- - 10 Regular Student accounts (3000001 to 3000010)
-- - 5 Working Student accounts (4000001 to 4000005)
-- - 2 Pending Registration accounts (5000001, 5000002)
-- 
-- Total: 25 user accounts
-- 
-- DEFAULT LOGIN CREDENTIALS:
-- Username: [any of the above usernames]
-- Password: password123
-- 
-- IMPORTANT SECURITY NOTE:
-- Passwords in this file are bcrypt-hashed for development/testing use.
-- This application verifies passwords using bcrypt hashes.
-- 
-- âš ï¸ SECURITY WARNING for Production:
-- Implement proper password hashing before deployment!
-- 
-- In Go, you should use:
-- import "golang.org/x/crypto/bcrypt"
-- hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
-- bcrypt.CompareHashAndPassword(hashedPassword, []byte(inputPassword))
================================ */


