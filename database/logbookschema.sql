

CREATE DATABASE IF NOT EXISTS logbookdb 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

USE logbookdb;

-- Drop existing views and tables (in reverse dependency order)
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS attendance_sheets;
DROP TABLE IF EXISTS classlist;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS feedback;
DROP TABLE IF EXISTS login_logs;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS teachers;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS users;

-- ============================================================================
-- CORE USER MANAGEMENT
-- ============================================================================
-- Users table: Central authentication and authorization table
-- This table stores login credentials and user type classification.
-- Detailed user information is stored in type-specific tables (admins, teachers, students).
-- 
-- NOTE ON ENUM USAGE: This schema uses ENUM types for user_type, status fields, etc.
-- While ENUMs are acceptable for capstone-level projects, they have limitations:
-- - Adding new values requires ALTER TABLE statements
-- - Less flexible than lookup tables for large-scale systems
-- For production systems, consider migrating to lookup tables (user_types, attendance_status, etc.)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Internal database identifier (surrogate key)',
    username VARCHAR(50) NOT NULL UNIQUE COMMENT 'Unique login username',
    password VARCHAR(255) NOT NULL COMMENT 'Hashed password for authentication',
    user_type ENUM('admin', 'teacher', 'student', 'working_student') NOT NULL COMMENT 'User role classification',
    account_status ENUM('pending', 'active', 'suspended', 'rejected') DEFAULT 'active' COMMENT 'Account approval status for registration workflow',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Account status flag',
    password_changed_at DATETIME NULL COMMENT 'Timestamp when password was last changed',
    last_login_at DATETIME NULL COMMENT 'Timestamp of last successful login',
    failed_attempts INT DEFAULT 0 COMMENT 'Number of consecutive failed login attempts',
    account_locked_until DATETIME NULL COMMENT 'Timestamp until which account is locked (NULL if not locked)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_username (username),
    INDEX idx_user_type (user_type),
    INDEX idx_account_status (account_status),
    INDEX idx_is_active (is_active),
    INDEX idx_account_locked (account_locked_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ORGANIZATIONAL STRUCTURE
-- ============================================================================
-- Departments table: Organizational units (e.g., IT Department, Engineering Department)
CREATE TABLE departments (
    department_code VARCHAR(20) PRIMARY KEY COMMENT 'Unique department identifier (e.g., IT, ENG, CS)',
    department_name VARCHAR(200) NOT NULL COMMENT 'Full department name',
    description TEXT NULL COMMENT 'Department description and details',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Department status flag',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_department_name (department_name),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admins (
    user_id INT PRIMARY KEY COMMENT 'Foreign key to users.id - internal database identifier',
    employee_number VARCHAR(50) UNIQUE COMMENT 'Organizational employee ID number (e.g., EMP001, ADM-2024-001)',
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NULL,
    contact_number VARCHAR(20) NULL,
    profile_photo MEDIUMBLOB NULL COMMENT 'Binary image data (JPEG/PNG) - stores up to 16MB',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_employee_number (employee_number),
    INDEX idx_admin_email (email),
    INDEX idx_admin_name (last_name, first_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE teachers (
    user_id INT PRIMARY KEY COMMENT 'Foreign key to users.id - internal database identifier',
    employee_number VARCHAR(50) UNIQUE COMMENT 'Organizational employee ID number (e.g., TCH-2024-001, EMP12345)',
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NULL,
    contact_number VARCHAR(20) NULL,
    department_code VARCHAR(20) NULL COMMENT 'Foreign key to departments.department_code',
    profile_photo MEDIUMBLOB NULL COMMENT 'Binary image data (JPEG/PNG) - stores up to 16MB',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_code) REFERENCES departments(department_code) ON DELETE SET NULL,
    
    INDEX idx_employee_number (employee_number),
    INDEX idx_teacher_email (email),
    INDEX idx_teacher_name (last_name, first_name),
    INDEX idx_department_code (department_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Students table: Unified table for both regular students and working students
-- Uses is_working_student flag to distinguish between the two types
-- This eliminates redundancy and simplifies queries
CREATE TABLE students (
    user_id INT PRIMARY KEY COMMENT 'Foreign key to users.id - internal database identifier',
    student_number VARCHAR(50) UNIQUE COMMENT 'Organizational student ID number (e.g., 2024-00123, STU-2024-001)',
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NULL,
    contact_number VARCHAR(20) NULL,
    is_working_student BOOLEAN DEFAULT FALSE COMMENT 'Flag to distinguish working students from regular students',
    profile_photo MEDIUMBLOB NULL COMMENT 'Binary image data (JPEG/PNG) - stores up to 16MB',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_student_number (student_number),
    INDEX idx_student_email (email),
    INDEX idx_student_name (last_name, first_name),
    INDEX idx_is_working_student (is_working_student)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ACADEMIC MANAGEMENT
-- ============================================================================
-- Subjects table: Course subjects offered by the institution
-- Note: Teacher assignment is handled at the class level, not subject level
-- This allows multiple teachers to teach the same subject (different sections)
CREATE TABLE subjects (
    subject_code VARCHAR(20) PRIMARY KEY COMMENT 'Unique subject code (e.g., IT301, CS101)',
    description TEXT NULL COMMENT 'Subject description and learning objectives',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Classes table: Specific class instances of subjects (e.g., IT301 Section A, Semester 1, 2024)
CREATE TABLE classes (
    class_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Internal database identifier',
    subject_code VARCHAR(20) NOT NULL COMMENT 'Foreign key to subjects.subject_code',
    teacher_user_id INT NOT NULL COMMENT 'Foreign key to teachers.user_id - assigned instructor',
    edp_code VARCHAR(50) NULL COMMENT 'EDP code - Institutional offering code (e.g., IT301-A-2024-1)',
    descriptive_title VARCHAR(255) NULL COMMENT 'Descriptive title for the class (e.g., Introduction to Programming, Web Development)',
    schedule VARCHAR(100) NULL COMMENT 'Class schedule (e.g., MWF 8:00-9:00 AM)',
    room VARCHAR(50) NULL COMMENT 'Classroom or lab location',
    semester VARCHAR(20) NULL COMMENT 'Semester (e.g., 1st Semester, 2nd Semester)',
    school_year VARCHAR(20) NULL COMMENT 'Academic year (e.g., 2024-2025)',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Class status flag',
    is_archived BOOLEAN DEFAULT FALSE COMMENT 'Whether this class has been archived by teacher',
    created_by_user_id INT NULL COMMENT 'Foreign key to users.id - user who created this class record (can be admin, teacher, or working student)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (subject_code) REFERENCES subjects(subject_code) ON DELETE CASCADE,
    FOREIGN KEY (teacher_user_id) REFERENCES teachers(user_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_subject_code (subject_code),
    INDEX idx_teacher_user_id (teacher_user_id),
    INDEX idx_is_active (is_active),
    INDEX idx_semester_year (semester, school_year),
    INDEX idx_classes_teacher_active (teacher_user_id, is_active),
    INDEX idx_edp_code (edp_code),
    INDEX idx_created_by_user_id (created_by_user_id),
    INDEX idx_classes_archived (is_archived, teacher_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE classlist (
    class_id INT NOT NULL,
    student_user_id INT NOT NULL,
    enrollment_date DATE DEFAULT (CURDATE()),
    status ENUM('active', 'dropped', 'completed') DEFAULT 'active',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether this classlist entry has been archived',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (class_id, student_user_id),
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
    FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_status (status),
    INDEX idx_enrollment_date (enrollment_date),
    INDEX idx_classlist_class_status (class_id, status),
    INDEX idx_classlist_student_status (student_user_id, status),
    INDEX idx_classlist_archived (is_archived, class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ATTENDANCE TRACKING
-- ============================================================================
-- Attendance table: Records student attendance for each class session
-- Note: The composite primary key (class_id, student_user_id, date) ensures
-- only one attendance record per student per class per day. Application logic
-- should prevent duplicate time_in entries and lock records after time_out.
CREATE TABLE attendance (
    class_id INT NOT NULL COMMENT 'Foreign key to classes.class_id',
    student_user_id INT NOT NULL COMMENT 'Foreign key to users.id - student whose attendance is recorded',
    date DATE NOT NULL COMMENT 'Date of the class session',
    time_in TIME NULL COMMENT 'Time when student logged in/arrived',
    time_out TIME NULL COMMENT 'Time when student logged out/departed',
    pc_number VARCHAR(20) NULL COMMENT 'Computer/terminal number used by student',
    status ENUM('present', 'absent', 'late', 'excused') NOT NULL DEFAULT 'present' COMMENT 'Attendance status',
    remarks TEXT NULL COMMENT 'Additional notes or comments',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether this attendance record has been archived by teacher',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (class_id, student_user_id, date),
    FOREIGN KEY (class_id, student_user_id) REFERENCES classlist(class_id, student_user_id) ON DELETE CASCADE,
    
    INDEX idx_date (date),
    INDEX idx_status (status),
    INDEX idx_attendance_date_classlist (date DESC, class_id, student_user_id),
    INDEX idx_pc_number (pc_number),
    INDEX idx_attendance_status_date (status, date DESC),
    INDEX idx_attendance_student_date (student_user_id, date DESC),
    INDEX idx_attendance_archived (is_archived, class_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Attendance Sheets table: Tracks initialized attendance sessions
-- This allows tracking attendance generation even for classes with no enrolled students
CREATE TABLE attendance_sheets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL COMMENT 'Foreign key to classes.class_id',
    date DATE NOT NULL COMMENT 'Date of the attendance sheet',
    created_by INT NULL COMMENT 'User ID who created/initialized the attendance',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether this sheet is archived',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_class_date (class_id, date),
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_class_id (class_id),
    INDEX idx_date (date),
    INDEX idx_is_archived (is_archived)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE login_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    pc_number VARCHAR(50) NULL,
    login_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logout_time DATETIME NULL,
    login_status ENUM('success', 'failed', 'logout') DEFAULT 'success',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether this log has been archived by admin',
    archived_at DATETIME NULL COMMENT 'Timestamp when the log was archived',
    archived_by_user_id INT NULL COMMENT 'User ID who archived this log',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (archived_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_user_id (user_id),
    INDEX idx_login_time (login_time),
    INDEX idx_pc_number (pc_number),
    INDEX idx_login_status (login_status),
    INDEX idx_login_logs_user_time (user_id, login_time DESC),
    INDEX idx_login_logs_status_time (login_status, login_time DESC),
    INDEX idx_login_logs_archived (is_archived, login_time DESC),
    INDEX idx_login_logs_archived_at (archived_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- FEEDBACK MANAGEMENT
-- ============================================================================
-- Feedback table: Equipment and facility feedback submitted by students
CREATE TABLE feedback (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Internal database identifier',
    student_user_id INT NOT NULL COMMENT 'Foreign key to users.id - student who submitted feedback',
    pc_number VARCHAR(50) NOT NULL COMMENT 'Computer/terminal number being reported',
    equipment_condition ENUM('Good', 'Minor Issue', 'Not Working') NOT NULL DEFAULT 'Good' COMMENT 'Overall equipment condition',
    monitor_condition ENUM('Good', 'Minor Issue', 'Not Working') NOT NULL DEFAULT 'Good' COMMENT 'Monitor condition',
    keyboard_condition ENUM('Good', 'Minor Issue', 'Not Working') NOT NULL DEFAULT 'Good' COMMENT 'Keyboard condition',
    mouse_condition ENUM('Good', 'Minor Issue', 'Not Working') NOT NULL DEFAULT 'Good' COMMENT 'Mouse condition',
    comments TEXT NULL COMMENT 'Student comments and additional details',
    working_student_notes TEXT NULL COMMENT 'Notes added by working student during review',
    status ENUM('pending', 'forwarded', 'resolved') DEFAULT 'pending' COMMENT 'Feedback resolution status',
    forwarded_by_user_id INT NULL COMMENT 'Foreign key to users.id - working student who forwarded the feedback',
    forwarded_at DATETIME NULL COMMENT 'Timestamp when feedback was forwarded',
    reviewed_by_user_id INT NULL COMMENT 'Foreign key to users.id - admin/teacher who reviewed the feedback',
    date_submitted DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when feedback was submitted',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether this feedback has been archived by admin',
    archived_at DATETIME NULL COMMENT 'Timestamp when the feedback was archived',
    archived_by_user_id INT NULL COMMENT 'User ID who archived this feedback',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (forwarded_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (archived_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_student_user_id (student_user_id),
    INDEX idx_date_submitted (date_submitted),
    INDEX idx_feedback_date (date_submitted DESC),
    INDEX idx_pc_number (pc_number),
    INDEX idx_status (status),
    INDEX idx_equipment_condition (equipment_condition),
    INDEX idx_forwarded_by_user_id (forwarded_by_user_id),
    INDEX idx_forwarded_at (forwarded_at),
    INDEX idx_feedback_status_date (status, date_submitted DESC),
    INDEX idx_feedback_pc_date (pc_number, date_submitted DESC),
    INDEX idx_feedback_archived (is_archived, date_submitted DESC),
    INDEX idx_feedback_archived_at (archived_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- STUDENT REGISTRATION SYSTEM
-- ============================================================================
-- Registration approvals table: Tracks student self-registration approval workflow
CREATE TABLE registration_approvals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT 'Foreign key to users.id - the student being approved/rejected',
    approved_by_user_id INT NULL COMMENT 'Foreign key to users.id - working student or admin who processed the request',
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT 'Approval status',
    rejection_reason TEXT NULL COMMENT 'Reason for rejection (if applicable)',
    processed_at TIMESTAMP NULL COMMENT 'When the approval/rejection occurred',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_approved_by (approved_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT 'Tracks student registration approval workflow';


  
