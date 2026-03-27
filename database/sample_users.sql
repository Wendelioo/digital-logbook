/* ================================
   DIGITAL LOGBOOK - SAMPLE USER ACCOUNTS
   Generated: February 8, 2026
   
   IMPORTANT: Passwords are stored in PLAIN TEXT (not hashed)
   Default password for all accounts: "password123"
   
   Note: This application does NOT use bcrypt hashing (see auth.go line 35)
   For production, implement proper password hashing!
================================ */

USE logbookdb;
GO

/* ================================
   TO DELETE THESE SAMPLE ACCOUNTS LATER
   
   Run the separate script: delete_sample_users.sql
   Located in: database/delete_sample_users.sql
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
GO

/* ================================
   ADMIN ACCOUNTS
   Username format: ADM-YYYY-NNN (matches admin_id)
   Default password: password123
================================ */

-- Admin 1: Head Administrator
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('ADM-2026-001', 'password123', 'admin', 'active', 1);
INSERT INTO admins (id, admin_id, first_name, middle_name, last_name, email, contact_number) VALUES
(SCOPE_IDENTITY(), 'ADM-2026-001', 'Maria', 'Santos', 'Cruz', 'maria.cruz@institution.edu', '+63-917-123-4567');

-- Admin 2: System Administrator
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('ADM-2026-002', 'password123', 'admin', 'active', 1);
INSERT INTO admins (id, admin_id, first_name, middle_name, last_name, email, contact_number) VALUES
(SCOPE_IDENTITY(), 'ADM-2026-002', 'Juan', 'Dela', 'Garcia', 'juan.garcia@institution.edu', '+63-917-234-5678');

-- Admin 3: Lab Manager
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('ADM-2026-003', 'password123', 'admin', 'active', 1);
INSERT INTO admins (id, admin_id, first_name, middle_name, last_name, email, contact_number) VALUES
(SCOPE_IDENTITY(), 'ADM-2026-003', 'Rosario', 'Flores', 'Reyes', 'rosario.reyes@institution.edu', '+63-917-345-6789');
GO

/* ================================
   TEACHER ACCOUNTS
   Username format: TCH-DEPT-NNN (matches teacher_id)
   Default password: password123
================================ */

-- Teacher 1: BSIT Department
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('TCH-BSIT-001', 'password123', 'teacher', 'active', 1);
INSERT INTO teachers (id, teacher_id, first_name, middle_name, last_name, email, contact_number, department_code) VALUES
(SCOPE_IDENTITY(), 'TCH-BSIT-001', 'Roberto', 'Manuel', 'Santos', 'roberto.santos@institution.edu', '+63-918-123-4567', 'BSIT');

-- Teacher 2: BSCS Department
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('TCH-BSCS-001', 'password123', 'teacher', 'active', 1);
INSERT INTO teachers (id, teacher_id, first_name, middle_name, last_name, email, contact_number, department_code) VALUES
(SCOPE_IDENTITY(), 'TCH-BSCS-001', 'Ana', 'Marie', 'Lopez', 'ana.lopez@institution.edu', '+63-918-234-5678', 'BSCS');

-- Teacher 3: BSIT Department
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('TCH-BSIT-002', 'password123', 'teacher', 'active', 1);
INSERT INTO teachers (id, teacher_id, first_name, middle_name, last_name, email, contact_number, department_code) VALUES
(SCOPE_IDENTITY(), 'TCH-BSIT-002', 'Carlos', 'Jose', 'Mendoza', 'carlos.mendoza@institution.edu', '+63-918-345-6789', 'BSIT');

-- Teacher 4: BSBA Department
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('TCH-BSBA-001', 'password123', 'teacher', 'active', 1);
INSERT INTO teachers (id, teacher_id, first_name, middle_name, last_name, email, contact_number, department_code) VALUES
(SCOPE_IDENTITY(), 'TCH-BSBA-001', 'Patricia', 'Cruz', 'Ramos', 'patricia.ramos@institution.edu', '+63-918-456-7890', 'BSBA');

-- Teacher 5: BSED Department
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('TCH-BSED-001', 'password123', 'teacher', 'active', 1);
INSERT INTO teachers (id, teacher_id, first_name, middle_name, last_name, email, contact_number, department_code) VALUES
(SCOPE_IDENTITY(), 'TCH-BSED-001', 'Francisco', 'Antonio', 'Torres', 'francisco.torres@institution.edu', '+63-918-567-8901', 'BSED');
GO

/* ================================
   STUDENT ACCOUNTS (Regular Students)
   Username format: YYYY-NNNNN (matches student_id)
   Default password: password123
================================ */

-- Student 1
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('2023-00001', 'password123', 'student', 'active', 1);
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(SCOPE_IDENTITY(), '2023-00001', 'Miguel', 'Angel', 'Rivera', 'miguel.rivera@student.edu', '+63-919-123-4567', 0);

-- Student 2
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('2023-00002', 'password123', 'student', 'active', 1);
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(SCOPE_IDENTITY(), '2023-00002', 'Sofia', 'Marie', 'Gonzales', 'sofia.gonzales@student.edu', '+63-919-234-5678', 0);

-- Student 3
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('2023-00003', 'password123', 'student', 'active', 1);
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(SCOPE_IDENTITY(), '2023-00003', 'Diego', 'Luis', 'Fernandez', 'diego.fernandez@student.edu', '+63-919-345-6789', 0);

-- Student 4
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('2023-00004', 'password123', 'student', 'active', 1);
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(SCOPE_IDENTITY(), '2023-00004', 'Isabella', 'Grace', 'Morales', 'isabella.morales@student.edu', '+63-919-456-7890', 0);

-- Student 5
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('2023-00005', 'password123', 'student', 'active', 1);
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(SCOPE_IDENTITY(), '2023-00005', 'Gabriel', 'Jose', 'Castillo', 'gabriel.castillo@student.edu', '+63-919-567-8901', 0);

-- Student 6
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('2023-00006', 'password123', 'student', 'active', 1);
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(SCOPE_IDENTITY(), '2023-00006', 'Valentina', 'Rose', 'Jimenez', 'valentina.jimenez@student.edu', '+63-919-678-9012', 0);

-- Student 7
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('2023-00007', 'password123', 'student', 'active', 1);
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(SCOPE_IDENTITY(), '2023-00007', 'Lucas', 'Daniel', 'Vega', 'lucas.vega@student.edu', '+63-919-789-0123', 0);

-- Student 8
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('2023-00008', 'password123', 'student', 'active', 1);
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(SCOPE_IDENTITY(), '2023-00008', 'Camila', 'Nicole', 'Romero', 'camila.romero@student.edu', '+63-919-890-1234', 0);

-- Student 9
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('2023-00009', 'password123', 'student', 'active', 1);
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(SCOPE_IDENTITY(), '2023-00009', 'Sebastian', 'Miguel', 'Navarro', 'sebastian.navarro@student.edu', '+63-919-901-2345', 0);

-- Student 10
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('2023-00010', 'password123', 'student', 'active', 1);
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(SCOPE_IDENTITY(), '2023-00010', 'Emma', 'Sophia', 'Diaz', 'emma.diaz@student.edu', '+63-920-012-3456', 0);
GO

/* ================================
   WORKING STUDENT ACCOUNTS
   Username format: WS-YYYY-NNN (matches student_id)
   Default password: password123
   Note: is_working_student = 1
================================ */

-- Working Student 1
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('WS-2023-001', 'password123', 'working_student', 'active', 1);
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(SCOPE_IDENTITY(), 'WS-2023-001', 'Andres', 'Carlos', 'Herrera', 'andres.herrera@student.edu', '+63-920-123-4567', 1);

-- Working Student 2
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('WS-2023-002', 'password123', 'working_student', 'active', 1);
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(SCOPE_IDENTITY(), 'WS-2023-002', 'Lucia', 'Andrea', 'Ruiz', 'lucia.ruiz@student.edu', '+63-920-234-5678', 1);

-- Working Student 3
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('WS-2023-003', 'password123', 'working_student', 'active', 1);
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(SCOPE_IDENTITY(), 'WS-2023-003', 'Marco', 'Felipe', 'Vargas', 'marco.vargas@student.edu', '+63-920-345-6789', 1);

-- Working Student 4
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('WS-2023-004', 'password123', 'working_student', 'active', 1);
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(SCOPE_IDENTITY(), 'WS-2023-004', 'Daniela', 'Isabel', 'Ortiz', 'daniela.ortiz@student.edu', '+63-920-456-7890', 1);

-- Working Student 5
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('WS-2023-005', 'password123', 'working_student', 'active', 1);
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(SCOPE_IDENTITY(), 'WS-2023-005', 'Rafael', 'Eduardo', 'Medina', 'rafael.medina@student.edu', '+63-920-567-8901', 1);
GO

/* ================================
   PENDING REGISTRATION ACCOUNTS
   These accounts are in 'pending' status for testing approval workflow
================================ */

-- Pending Student 1
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('2024-00001', 'password123', 'student', 'pending', 0);
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(SCOPE_IDENTITY(), '2024-00001', 'Pedro', 'Juan', 'Santiago', 'pedro.santiago@student.edu', '+63-920-678-9012', 0);

-- Pending Student 2
INSERT INTO users (username, password, user_type, account_status, is_active) VALUES
('2024-00002', 'password123', 'student', 'pending', 0);
INSERT INTO students (id, student_id, first_name, middle_name, last_name, email, contact_number, is_working_student) VALUES
(SCOPE_IDENTITY(), '2024-00002', 'Carmen', 'Luz', 'Flores', 'carmen.flores@student.edu', '+63-920-789-0123', 0);
GO

/* ================================
   SUMMARY OF CREATED ACCOUNTS
================================ */
-- Total Accounts Created:
-- - 3 Admin accounts (ADM-2026-001 to ADM-2026-003)
-- - 5 Teacher accounts (TCH-BSIT-001, TCH-BSCS-001, TCH-BSIT-002, TCH-BSBA-001, TCH-BSED-001)
-- - 10 Regular Student accounts (2023-00001 to 2023-00010)
-- - 5 Working Student accounts (WS-2023-001 to WS-2023-005)
-- - 2 Pending Registration accounts (2024-00001, 2024-00002)
-- 
-- Total: 25 user accounts
-- 
-- DEFAULT LOGIN CREDENTIALS:
-- Username: [any of the above usernames]
-- Password: password123
-- 
-- IMPORTANT SECURITY NOTE:
-- The passwords are stored in PLAIN TEXT for development/testing purposes.
-- This application does NOT use bcrypt or any password hashing (see auth.go line 35).
-- 
-- ⚠️ SECURITY WARNING for Production:
-- Implement proper password hashing before deployment!
-- 
-- In Go, you should use:
-- import "golang.org/x/crypto/bcrypt"
-- hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
-- bcrypt.CompareHashAndPassword(hashedPassword, []byte(inputPassword))
================================ */

PRINT 'Sample user accounts created successfully!';
PRINT 'Total: 25 accounts (3 admins, 5 teachers, 10 students, 5 working students, 2 pending)';
PRINT 'Default password for all accounts: password123';
PRINT '';
PRINT 'To delete these sample accounts, run the delete_sample_users.sql script.';
GO
