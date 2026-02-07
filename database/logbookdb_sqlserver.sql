/* ================================
   DIGITAL LOGBOOK - SQL SERVER VERSION
   Converted from MySQL schema
================================ */

USE logbookdb;
GO

/* ================================
   DROP TABLES (if exists)
================================ */
IF OBJECT_ID('registration_approvals', 'U') IS NOT NULL DROP TABLE registration_approvals;
IF OBJECT_ID('feedback', 'U') IS NOT NULL DROP TABLE feedback;
IF OBJECT_ID('log_entries', 'U') IS NOT NULL DROP TABLE log_entries;
IF OBJECT_ID('attendance', 'U') IS NOT NULL DROP TABLE attendance;
IF OBJECT_ID('classlist', 'U') IS NOT NULL DROP TABLE classlist;
IF OBJECT_ID('classes', 'U') IS NOT NULL DROP TABLE classes;
IF OBJECT_ID('subjects', 'U') IS NOT NULL DROP TABLE subjects;
IF OBJECT_ID('students', 'U') IS NOT NULL DROP TABLE students;
IF OBJECT_ID('teachers', 'U') IS NOT NULL DROP TABLE teachers;
IF OBJECT_ID('admins', 'U') IS NOT NULL DROP TABLE admins;
IF OBJECT_ID('profile_photos', 'U') IS NOT NULL DROP TABLE profile_photos;
IF OBJECT_ID('departments', 'U') IS NOT NULL DROP TABLE departments;
IF OBJECT_ID('users', 'U') IS NOT NULL DROP TABLE users;
GO

/* ================================
   USERS TABLE
================================ */
CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(50) NOT NULL UNIQUE,
    password NVARCHAR(255) NOT NULL,
    user_type NVARCHAR(20) NOT NULL CHECK (user_type IN ('admin', 'teacher', 'student', 'working_student')),
    account_status NVARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('pending', 'active', 'suspended', 'rejected')),
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);
GO

/* ================================
   PROFILE PHOTOS TABLE
================================ */
CREATE TABLE profile_photos (
    user_id INT PRIMARY KEY,
    photo_path NVARCHAR(500) NOT NULL,
    file_name NVARCHAR(255) NOT NULL,
    file_size INT NOT NULL,
    mime_type NVARCHAR(50) NOT NULL,
    uploaded_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
GO

/* ================================
   DEPARTMENTS TABLE
================================ */
CREATE TABLE departments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL UNIQUE,
    description NVARCHAR(MAX),
    created_at DATETIME DEFAULT GETDATE()
);
GO

/* ================================
   ADMINS TABLE
================================ */
CREATE TABLE admins (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    first_name NVARCHAR(50) NOT NULL,
    last_name NVARCHAR(50) NOT NULL,
    middle_name NVARCHAR(50),
    email NVARCHAR(100) UNIQUE,
    phone_number NVARCHAR(20),
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
GO

/* ================================
   TEACHERS TABLE
================================ */
CREATE TABLE teachers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    teacher_id NVARCHAR(20) NOT NULL UNIQUE,
    first_name NVARCHAR(50) NOT NULL,
    last_name NVARCHAR(50) NOT NULL,
    middle_name NVARCHAR(50),
    department_id INT,
    email NVARCHAR(100) UNIQUE,
    phone_number NVARCHAR(20),
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);
GO

/* ================================
   STUDENTS TABLE
================================ */
CREATE TABLE students (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    student_id NVARCHAR(20) NOT NULL UNIQUE,
    first_name NVARCHAR(50) NOT NULL,
    last_name NVARCHAR(50) NOT NULL,
    middle_name NVARCHAR(50),
    department_id INT,
    year_level INT CHECK (year_level BETWEEN 1 AND 5),
    email NVARCHAR(100) UNIQUE,
    phone_number NVARCHAR(20),
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);
GO

/* ================================
   SUBJECTS TABLE
================================ */
CREATE TABLE subjects (
    id INT IDENTITY(1,1) PRIMARY KEY,
    subject_code NVARCHAR(20) NOT NULL UNIQUE,
    subject_name NVARCHAR(100) NOT NULL,
    description NVARCHAR(MAX),
    units INT DEFAULT 3,
    created_at DATETIME DEFAULT GETDATE()
);
GO

/* ================================
   CLASSES TABLE
================================ */
CREATE TABLE classes (
    id INT IDENTITY(1,1) PRIMARY KEY,
    subject_id INT NOT NULL,
    teacher_id INT NOT NULL,
    class_code NVARCHAR(20) NOT NULL UNIQUE,
    section NVARCHAR(20),
    schedule NVARCHAR(100),
    room NVARCHAR(20),
    semester NVARCHAR(20),
    school_year NVARCHAR(20),
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);
GO

/* ================================
   CLASSLIST TABLE (Students enrolled in classes)
================================ */
CREATE TABLE classlist (
    id INT IDENTITY(1,1) PRIMARY KEY,
    class_id INT NOT NULL,
    student_id INT NOT NULL,
    enrolled_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE (class_id, student_id)
);
GO

/* ================================
   ATTENDANCE TABLE
================================ */
CREATE TABLE attendance (
    id INT IDENTITY(1,1) PRIMARY KEY,
    classlist_id INT NOT NULL,
    attendance_date DATE DEFAULT CAST(GETDATE() AS DATE),
    status NVARCHAR(20) CHECK (status IN ('present', 'absent', 'late', 'excused')),
    remarks NVARCHAR(MAX),
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (classlist_id) REFERENCES classlist(id) ON DELETE CASCADE
);
GO

/* ================================
   LOG ENTRIES TABLE (PC lab login/logout tracking)
================================ */
CREATE TABLE log_entries (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    login_time DATETIME DEFAULT GETDATE(),
    logout_time DATETIME,
    pc_hostname NVARCHAR(100),
    pc_ip_address NVARCHAR(45),
    session_duration_minutes INT,
    notes NVARCHAR(MAX),
    archived BIT DEFAULT 0,
    archived_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
GO

/* ================================
   FEEDBACK TABLE (Equipment condition reports)
================================ */
CREATE TABLE feedback (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    pc_hostname NVARCHAR(100),
    computer_status NVARCHAR(20) CHECK (computer_status IN ('excellent', 'good', 'fair', 'poor', 'not_working')),
    mouse_status NVARCHAR(20) CHECK (mouse_status IN ('excellent', 'good', 'fair', 'poor', 'not_working')),
    keyboard_status NVARCHAR(20) CHECK (keyboard_status IN ('excellent', 'good', 'fair', 'poor', 'not_working')),
    monitor_status NVARCHAR(20) CHECK (monitor_status IN ('excellent', 'good', 'fair', 'poor', 'not_working')),
    other_issues NVARCHAR(MAX),
    created_at DATETIME DEFAULT GETDATE(),
    archived BIT DEFAULT 0,
    archived_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
GO

/* ================================
   REGISTRATION APPROVALS TABLE (Pending user registrations)
================================ */
CREATE TABLE registration_approvals (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(50) NOT NULL UNIQUE,
    password NVARCHAR(255) NOT NULL,
    user_type NVARCHAR(20) NOT NULL CHECK (user_type IN ('teacher', 'student', 'working_student')),
    first_name NVARCHAR(50) NOT NULL,
    last_name NVARCHAR(50) NOT NULL,
    middle_name NVARCHAR(50),
    id_number NVARCHAR(20),
    department_id INT,
    email NVARCHAR(100),
    phone_number NVARCHAR(20),
    status NVARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at DATETIME DEFAULT GETDATE(),
    reviewed_at DATETIME,
    reviewed_by INT,
    rejection_reason NVARCHAR(MAX),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES admins(id) ON DELETE SET NULL
);
GO

/* ================================
   INDEXES FOR PERFORMANCE
================================ */
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_log_entries_user_id ON log_entries(user_id);
CREATE INDEX idx_log_entries_login_time ON log_entries(login_time);
CREATE INDEX idx_log_entries_archived ON log_entries(archived);
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_archived ON feedback(archived);
CREATE INDEX idx_attendance_date ON attendance(attendance_date);
CREATE INDEX idx_classlist_class_id ON classlist(class_id);
CREATE INDEX idx_classlist_student_id ON classlist(student_id);
CREATE INDEX idx_teachers_teacher_id ON teachers(teacher_id);
CREATE INDEX idx_students_student_id ON students(student_id);
GO

/* ================================
   TRIGGER FOR updated_at ON users TABLE
================================ */
CREATE TRIGGER trg_users_updated_at
ON users
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE users
    SET updated_at = GETDATE()
    FROM users u
    INNER JOIN inserted i ON u.id = i.id
END;
GO

PRINT 'Database schema created successfully for SQL Server!';
GO
