
USE logbookdb;
GO

IF OBJECT_ID('registration_approvals', 'U') IS NOT NULL DROP TABLE registration_approvals;
IF OBJECT_ID('feedback', 'U') IS NOT NULL DROP TABLE feedback;
IF OBJECT_ID('user_session_heartbeats', 'U') IS NOT NULL DROP TABLE user_session_heartbeats;
IF OBJECT_ID('log_entries', 'U') IS NOT NULL DROP TABLE log_entries;
IF OBJECT_ID('attendance', 'U') IS NOT NULL DROP TABLE attendance;
IF OBJECT_ID('student_archived_classes', 'U') IS NOT NULL DROP TABLE student_archived_classes;
-- Backward compatibility: old name used in previous build
IF OBJECT_ID('student_hidden_classes', 'U') IS NOT NULL DROP TABLE student_hidden_classes;
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

CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(50) NOT NULL UNIQUE,
    password NVARCHAR(255) NOT NULL,
    user_type NVARCHAR(20) NOT NULL CHECK (user_type IN ('admin', 'teacher', 'student', 'working_student')),
    account_status NVARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('pending', 'active', 'suspended', 'rejected')),
    account_lock BIT DEFAULT 0,
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);
GO

CREATE TABLE profile_photos (
    user_id INT PRIMARY KEY,
    photo_data NVARCHAR(MAX) NOT NULL,
    uploaded_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
GO

CREATE TABLE departments (
    department_code NVARCHAR(20) PRIMARY KEY,
    department_name NVARCHAR(200) UNIQUE NOT NULL,
    description NVARCHAR(MAX),
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);
GO

CREATE TABLE admins (
    id INT PRIMARY KEY,
    admin_id NVARCHAR(50) UNIQUE NOT NULL,
    first_name NVARCHAR(100) NOT NULL,
    middle_name NVARCHAR(100),
    last_name NVARCHAR(100) NOT NULL,
    email NVARCHAR(255),
    contact_number NVARCHAR(20),
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);
GO


CREATE TABLE teachers (
    id INT PRIMARY KEY,
    teacher_id NVARCHAR(50) UNIQUE NOT NULL,
    first_name NVARCHAR(100) NOT NULL,
    middle_name NVARCHAR(100),
    last_name NVARCHAR(100) NOT NULL,
    email NVARCHAR(255),
    contact_number NVARCHAR(20),
    department_code NVARCHAR(20),
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_code) REFERENCES departments(department_code)
);
GO

CREATE TABLE students (
    id INT PRIMARY KEY,
    student_id NVARCHAR(50) UNIQUE NOT NULL,
    first_name NVARCHAR(100) NOT NULL,
    middle_name NVARCHAR(100),
    last_name NVARCHAR(100) NOT NULL,
    email NVARCHAR(255),
    contact_number NVARCHAR(20),
    is_working_student BIT DEFAULT 0,
    archived_at DATETIME,
    deletion_scheduled_at DATETIME,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);
GO

CREATE TABLE subjects (
    subject_code NVARCHAR(20) PRIMARY KEY,
    description NVARCHAR(MAX),
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);
GO

CREATE TABLE classes (
    class_id INT IDENTITY(1,1) PRIMARY KEY,
    subject_code NVARCHAR(20) NOT NULL,
    teacher_id INT NOT NULL,
    edp_code NVARCHAR(50) UNIQUE,
    descriptive_title NVARCHAR(255),
    section NVARCHAR(50),
    schedule NVARCHAR(100),
    room NVARCHAR(50),
    semester NVARCHAR(20),
    school_year NVARCHAR(9),
    is_active BIT DEFAULT 1,
    is_archived BIT DEFAULT 0,
    created_by_user_id INT NOT NULL,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (subject_code) REFERENCES subjects(subject_code),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id),
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
GO

CREATE TABLE classlist (
    class_id INT NOT NULL,
    student_id INT NOT NULL,
    enrollment_date DATE NOT NULL,
    status NVARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'dropped', 'completed')),
    is_archived BIT DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    PRIMARY KEY (class_id, student_id),
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
GO

CREATE TABLE student_archived_classes (
    student_id INT NOT NULL,
    class_id INT NOT NULL,
    archived_at DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME NOT NULL DEFAULT GETDATE(),
    PRIMARY KEY (student_id, class_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE
);
GO

/* ================================
   ATTENDANCE
================================ */
CREATE TABLE attendance (
    id INT IDENTITY(1,1) PRIMARY KEY,
    class_id INT NOT NULL,
    student_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    session_id INT NULL,
    status NVARCHAR(20) NULL DEFAULT NULL CHECK (status IN ('present', 'absent', 'late') OR status IS NULL),
    time_in_at DATETIME2 NULL,
    remarks NVARCHAR(MAX),
    is_archived BIT DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    UNIQUE (class_id, student_id, attendance_date, session_id),
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
GO

/* ================================
   ATTENDANCE SESSIONS
================================ */
CREATE TABLE attendance_sessions (
    session_id INT IDENTITY(1,1) PRIMARY KEY,
    class_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    session_name NVARCHAR(255) NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    is_archived BIT NOT NULL DEFAULT 0,
    class_duration_minutes INT NULL,
    grace_period_minutes INT NULL,
    opened_at DATETIME NULL,
    closed_at DATETIME NULL,
    created_by_user_id INT NOT NULL,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
GO

/* ================================
   LOG ENTRIES
================================ */
CREATE TABLE log_entries (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    pc_number NVARCHAR(50),
    login_time DATETIME DEFAULT GETDATE(),
    logout_time DATETIME,
    is_archived BIT DEFAULT 0,
    archived_at DATETIME,
    archived_by_user_id INT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (archived_by_user_id) REFERENCES users(id)
);
GO


CREATE TABLE user_session_heartbeats (
     user_id INT NOT NULL PRIMARY KEY,
     last_seen DATETIME NOT NULL DEFAULT GETDATE(),
     created_at DATETIME NOT NULL DEFAULT GETDATE(),
     updated_at DATETIME NOT NULL DEFAULT GETDATE(),
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
GO

CREATE TABLE feedback (
    id INT IDENTITY(1,1) PRIMARY KEY,
    student_id INT NOT NULL,
    pc_number NVARCHAR(50) NOT NULL,
    equipment_condition NVARCHAR(20) DEFAULT 'Good' CHECK (equipment_condition IN ('Good', 'Minor Issue', 'Not Working')),
    monitor_condition NVARCHAR(20) DEFAULT 'Good' CHECK (monitor_condition IN ('Good', 'Minor Issue', 'Not Working')),
    keyboard_condition NVARCHAR(20) DEFAULT 'Good' CHECK (keyboard_condition IN ('Good', 'Minor Issue', 'Not Working')),
    mouse_condition NVARCHAR(20) DEFAULT 'Good' CHECK (mouse_condition IN ('Good', 'Minor Issue', 'Not Working')),
    comments NVARCHAR(MAX),
    working_student_notes NVARCHAR(MAX),
    status NVARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'forwarded', 'resolved')),
    priority NVARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    forwarded_by_user_id INT,
    forwarded_at DATETIME,
    date_submitted DATETIME DEFAULT GETDATE(),
    is_archived BIT DEFAULT 0,
    archived_at DATETIME,
    archived_by_user_id INT,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (forwarded_by_user_id) REFERENCES users(id),
    FOREIGN KEY (archived_by_user_id) REFERENCES users(id)
);
GO


CREATE TABLE registration_approvals (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    approved_by_user_id INT,
    status NVARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason NVARCHAR(MAX),
    processed_at DATETIME,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
);
GO

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_log_entries_user_id ON log_entries(user_id);
CREATE INDEX idx_log_entries_login_time ON log_entries(login_time);
CREATE INDEX idx_log_entries_is_archived ON log_entries(is_archived);
CREATE INDEX idx_user_session_heartbeats_last_seen ON user_session_heartbeats(last_seen);
CREATE INDEX idx_student_archived_classes_class_id ON student_archived_classes(class_id);
CREATE INDEX idx_feedback_student_id ON feedback(student_id);
CREATE INDEX idx_feedback_is_archived ON feedback(is_archived);
CREATE INDEX idx_attendance_date ON attendance(attendance_date);
CREATE INDEX idx_attendance_class_date_session_student ON attendance(class_id, attendance_date, session_id, student_id);
CREATE INDEX idx_attendance_sessions_class_date ON attendance_sessions(class_id, attendance_date);
CREATE INDEX idx_classlist_class_id ON classlist(class_id);
CREATE INDEX idx_classlist_student_id ON classlist(student_id);
CREATE INDEX idx_teachers_teacher_id ON teachers(teacher_id);
CREATE INDEX idx_students_student_id ON students(student_id);
GO

CREATE TRIGGER trg_users_updated_at
ON users
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE users
    SET updated_at = GETDATE()
    FROM users u
    INNER JOIN inserted i ON u.id = i.id;
END;
GO

CREATE TRIGGER trg_departments_updated_at
ON departments
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE departments
    SET updated_at = GETDATE()
    FROM departments d
    INNER JOIN inserted i ON d.department_code = i.department_code;
END;
GO

CREATE TRIGGER trg_admins_updated_at
ON admins
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE admins
    SET updated_at = GETDATE()
    FROM admins a
    INNER JOIN inserted i ON a.id = i.id;
END;
GO

CREATE TRIGGER trg_teachers_updated_at
ON teachers
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE teachers
    SET updated_at = GETDATE()
    FROM teachers t
    INNER JOIN inserted i ON t.id = i.id;
END;
GO

CREATE TRIGGER trg_students_updated_at
ON students
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE students
    SET updated_at = GETDATE()
    FROM students s
    INNER JOIN inserted i ON s.id = i.id;
END;
GO

CREATE TRIGGER trg_subjects_updated_at
ON subjects
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE subjects
    SET updated_at = GETDATE()
    FROM subjects s
    INNER JOIN inserted i ON s.subject_code = i.subject_code;
END;
GO

CREATE TRIGGER trg_classes_updated_at
ON classes
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE classes
    SET updated_at = GETDATE()
    FROM classes c
    INNER JOIN inserted i ON c.class_id = i.class_id;
END;
GO

CREATE TRIGGER trg_classlist_updated_at
ON classlist
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE classlist
    SET updated_at = GETDATE()
    FROM classlist cl
    INNER JOIN inserted i ON cl.class_id = i.class_id AND cl.student_id = i.student_id;
END;
GO

CREATE TRIGGER trg_attendance_updated_at
ON attendance
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE attendance
    SET updated_at = GETDATE()
    FROM attendance a
    INNER JOIN inserted i ON a.class_id = i.class_id AND a.student_id = i.student_id AND a.attendance_date = i.attendance_date;
END;
GO

CREATE TRIGGER trg_feedback_updated_at
ON feedback
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE feedback
    SET updated_at = GETDATE()
    FROM feedback f
    INNER JOIN inserted i ON f.id = i.id;
END;
GO

CREATE TRIGGER trg_registration_approvals_updated_at
ON registration_approvals
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE registration_approvals
    SET updated_at = GETDATE()
    FROM registration_approvals ra
    INNER JOIN inserted i ON ra.id = i.id;
END;
