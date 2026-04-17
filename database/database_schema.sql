-- MySQL schema
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

CREATE DATABASE IF NOT EXISTS logbookdb
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE logbookdb;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS user_recovery_codes;
DROP TABLE IF EXISTS registration_approvals;
DROP TABLE IF EXISTS feedback;
DROP TABLE IF EXISTS user_session_heartbeats;
DROP TABLE IF EXISTS log_entries;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS attendance_sessions;
DROP TABLE IF EXISTS student_archived_classes;
DROP TABLE IF EXISTS joined_classes;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS teachers;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS profile_photos;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('admin', 'teacher', 'student', 'working_student')),
    account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('pending', 'active', 'archived', 'deactivated', 'deleted', 'rejected')),
    archived_at DATETIME NULL,
    deactivated_at DATETIME NULL,
    deleted_at DATETIME NULL,
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW()
);
CREATE TABLE profile_photos (
    user_id INT PRIMARY KEY,
    photo_data LONGTEXT NOT NULL,
    uploaded_at DATETIME DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE departments (
    department_code VARCHAR(20) PRIMARY KEY,
    department_name VARCHAR(200) UNIQUE NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    is_archived TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW()
);
CREATE TABLE admins (
    id INT PRIMARY KEY,
    admin_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    contact_number VARCHAR(20),
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW(),
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE teachers (
    id INT PRIMARY KEY,
    teacher_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    contact_number VARCHAR(20),
    department_code VARCHAR(20),
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW(),
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_code) REFERENCES departments(department_code)
);
CREATE TABLE students (
    id INT PRIMARY KEY,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    contact_number VARCHAR(20),
    department_code VARCHAR(20),
    is_working_student TINYINT(1) DEFAULT 0,
    archived_at DATETIME,
    deletion_scheduled_at DATETIME,
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW(),
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_code) REFERENCES departments(department_code)
);
CREATE TABLE subjects (
    subject_code VARCHAR(20) PRIMARY KEY,
    description LONGTEXT,
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW()
);
CREATE TABLE classes (
    class_id INT AUTO_INCREMENT PRIMARY KEY,
    subject_code VARCHAR(20) NOT NULL,
    teacher_id INT NOT NULL,
    edp_code VARCHAR(50),
    join_code VARCHAR(50) UNIQUE,
    descriptive_title VARCHAR(255),
    section VARCHAR(50),
    schedule VARCHAR(100),
    room VARCHAR(50),
    semester VARCHAR(20),
    school_year VARCHAR(9),
    is_active TINYINT(1) DEFAULT 1,
    is_archived TINYINT(1) DEFAULT 0,
    created_by_user_id INT NOT NULL,
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW(),
    FOREIGN KEY (subject_code) REFERENCES subjects(subject_code),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id),
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
CREATE TABLE joined_classes (
    class_id INT NOT NULL,
    student_id INT NOT NULL,
    joined_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'added' CHECK (status IN ('join', 'left', 'added', 'removed')),
    is_archived TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW(),
    PRIMARY KEY (class_id, student_id),
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE TABLE student_archived_classes (
    student_id INT NOT NULL,
    class_id INT NOT NULL,
    archived_at DATETIME NOT NULL DEFAULT NOW(),
    updated_at DATETIME NOT NULL DEFAULT NOW(),
    PRIMARY KEY (student_id, class_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE
);
CREATE TABLE attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    student_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    session_id INT NULL,
    status VARCHAR(20) NULL DEFAULT NULL CHECK (status IN ('present', 'absent', 'late') OR status IS NULL),
    time_in_at DATETIME NULL,
    remarks LONGTEXT,
    is_archived TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW(),
    UNIQUE (class_id, student_id, attendance_date, session_id),
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE TABLE attendance_sessions (
    session_id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    session_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    is_archived TINYINT(1) NOT NULL DEFAULT 0,
    class_duration_minutes INT NULL,
    grace_period_minutes INT NULL,
    opened_at DATETIME NULL,
    closed_at DATETIME NULL,
    created_by_user_id INT NOT NULL,
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW(),
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
CREATE TABLE log_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    pc_number VARCHAR(50),
    login_time DATETIME DEFAULT NOW(),
    logout_time DATETIME,
    is_archived TINYINT(1) DEFAULT 0,
    archived_at DATETIME,
    archived_by_user_id INT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (archived_by_user_id) REFERENCES users(id)
);
CREATE TABLE user_session_heartbeats (
    user_id INT NOT NULL PRIMARY KEY,
    last_seen DATETIME NOT NULL DEFAULT NOW(),
    created_at DATETIME NOT NULL DEFAULT NOW(),
    updated_at DATETIME NOT NULL DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reported_by_user_id INT NOT NULL,
    pc_number VARCHAR(50) NOT NULL,
    equipment_condition VARCHAR(20) DEFAULT 'Good' CHECK (equipment_condition IN ('Good', 'Minor Issue', 'Not Working')),
    monitor_condition VARCHAR(20) DEFAULT 'Good' CHECK (monitor_condition IN ('Good', 'Minor Issue', 'Not Working')),
    keyboard_condition VARCHAR(20) DEFAULT 'Good' CHECK (keyboard_condition IN ('Good', 'Minor Issue', 'Not Working')),
    mouse_condition VARCHAR(20) DEFAULT 'Good' CHECK (mouse_condition IN ('Good', 'Minor Issue', 'Not Working')),
    additional_comments LONGTEXT,
    forward_notes LONGTEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'forwarded', 'resolved')),
    admin_status VARCHAR(20) NULL
        DEFAULT 'pending' CHECK (admin_status IN ('pending', 'resolved')),
    admin_resolved_at DATETIME,
    verified_by_user_id INT,
    verified_at DATETIME,
    forwarded_by_user_id INT,
    forwarded_at DATETIME,
    date_submitted DATETIME DEFAULT NOW(),
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW(),
    FOREIGN KEY (reported_by_user_id) REFERENCES users(id),
    FOREIGN KEY (verified_by_user_id) REFERENCES users(id),
    FOREIGN KEY (forwarded_by_user_id) REFERENCES users(id)
);
CREATE TABLE registration_approvals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    approved_by_user_id INT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason LONGTEXT,
    processed_at DATETIME,
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
);
CREATE TABLE user_recovery_codes (
    user_id INT PRIMARY KEY,
    code_hash CHAR(64) NOT NULL,
    code_ciphertext TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    rotated_at DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_urc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message VARCHAR(500) NOT NULL,
    tone VARCHAR(20) NOT NULL DEFAULT 'info'
        CHECK (tone IN ('info', 'warning', 'success')),
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    reference_type VARCHAR(50) NULL,
    reference_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    read_at DATETIME NULL,
    CONSTRAINT FK_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_urc_updated ON user_recovery_codes(updated_at);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_category ON notifications(category);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_log_entries_user_id ON log_entries(user_id);
CREATE INDEX idx_log_entries_login_time ON log_entries(login_time);
CREATE INDEX idx_log_entries_is_archived ON log_entries(is_archived);
CREATE INDEX idx_user_session_heartbeats_last_seen ON user_session_heartbeats(last_seen);
CREATE INDEX idx_student_archived_classes_class_id ON student_archived_classes(class_id);
CREATE INDEX idx_feedback_reported_by_user_id ON feedback(reported_by_user_id);
CREATE INDEX idx_attendance_date ON attendance(attendance_date);
CREATE INDEX idx_attendance_class_date_session_student ON attendance(class_id, attendance_date, session_id, student_id);
CREATE INDEX idx_attendance_sessions_class_date ON attendance_sessions(class_id, attendance_date);
CREATE INDEX idx_joined_classes_class_id ON joined_classes(class_id);
CREATE INDEX idx_joined_classes_student_id ON joined_classes(student_id);
CREATE INDEX idx_teachers_teacher_id ON teachers(teacher_id);
CREATE INDEX idx_students_student_id ON students(student_id);

SET FOREIGN_KEY_CHECKS=1;



