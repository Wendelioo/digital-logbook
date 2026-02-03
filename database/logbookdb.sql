/* ================================
   SAFE INITIALIZATION
================================ */
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS logbookdb;
USE logbookdb;

/* ================================
   DROP TABLES
================================ */
DROP TABLE IF EXISTS registration_approvals;
DROP TABLE IF EXISTS feedback;
DROP TABLE IF EXISTS log_entries;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS classlist;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS teachers;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS profile_photos;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS users;

/* ================================
   USERS
================================ */
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    user_type ENUM('admin','teacher','student','working_student') NOT NULL,
    account_status ENUM('pending','active','suspended','rejected') DEFAULT 'active',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

/* ================================
   PROFILE PHOTOS
================================ */
CREATE TABLE profile_photos (
    user_id INT PRIMARY KEY,
    photo_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ================================
   DEPARTMENTS
================================ */
CREATE TABLE departments (
    department_code VARCHAR(20) PRIMARY KEY,
    department_name VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

/* ================================
   ADMINS
================================ */
CREATE TABLE admins (
    id INT PRIMARY KEY,
    admin_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    contact_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ================================
   TEACHERS
================================ */
CREATE TABLE teachers (
    id INT PRIMARY KEY,
    teacher_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    contact_number VARCHAR(20),
    department_code VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_code) REFERENCES departments(department_code)
) ENGINE=InnoDB;

/* ================================
   STUDENTS
================================ */
CREATE TABLE students (
    id INT PRIMARY KEY,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    contact_number VARCHAR(20),
    is_working_student BOOLEAN DEFAULT FALSE,
    archived_at DATETIME,
    deletion_scheduled_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ================================
   SUBJECTS
================================ */
CREATE TABLE subjects (
    subject_code VARCHAR(20) PRIMARY KEY,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

/* ================================
   CLASSES
================================ */
CREATE TABLE classes (
    class_id INT AUTO_INCREMENT PRIMARY KEY,
    subject_code VARCHAR(20) NOT NULL,
    teacher_id INT NOT NULL,
    edp_code VARCHAR(50) UNIQUE,
    descriptive_title VARCHAR(255),
    schedule VARCHAR(100),
    room VARCHAR(50),
    semester VARCHAR(20),
    school_year VARCHAR(9),
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_by_user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_code) REFERENCES subjects(subject_code),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id),
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

/* ================================
   CLASSLIST
================================ */
CREATE TABLE classlist (
    class_id INT NOT NULL,
    student_id INT NOT NULL,
    enrollment_date DATE NOT NULL,
    status ENUM('active','dropped','completed') DEFAULT 'active',
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (class_id, student_id),
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ================================
   ATTENDANCE
================================ */
CREATE TABLE attendance (
    class_id INT NOT NULL,
    student_id INT NOT NULL,
    date DATE NOT NULL,
    status ENUM('present','absent','late','excused') DEFAULT 'present',
    remarks TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    is_finalized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (class_id, student_id, date),
    FOREIGN KEY (class_id, student_id)
        REFERENCES classlist(class_id, student_id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ================================
   LOG ENTRIES
================================ */
CREATE TABLE log_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    pc_number VARCHAR(50),
    login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    logout_time DATETIME,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at DATETIME,
    archived_by_user_id INT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (archived_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

/* ================================
   FEEDBACK
================================ */
CREATE TABLE feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    pc_number VARCHAR(50) NOT NULL,
    equipment_condition ENUM('Good','Minor Issue','Not Working') DEFAULT 'Good',
    monitor_condition ENUM('Good','Minor Issue','Not Working') DEFAULT 'Good',
    keyboard_condition ENUM('Good','Minor Issue','Not Working') DEFAULT 'Good',
    mouse_condition ENUM('Good','Minor Issue','Not Working') DEFAULT 'Good',
    comments TEXT,
    working_student_notes TEXT,
    status ENUM('pending','forwarded','resolved') DEFAULT 'pending',
    priority ENUM('low','medium','high','critical') DEFAULT 'medium',
    forwarded_by_user_id INT,
    forwarded_at DATETIME,
    date_submitted DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at DATETIME,
    archived_by_user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (forwarded_by_user_id) REFERENCES users(id),
    FOREIGN KEY (archived_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

/* ================================
   REGISTRATION APPROVALS
================================ */
CREATE TABLE registration_approvals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    approved_by_user_id INT,
    status ENUM('pending','approved','rejected') DEFAULT 'pending',
    rejection_reason TEXT,
    processed_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

/* ================================
   ENABLE FK CHECKS
================================ */
SET FOREIGN_KEY_CHECKS = 1;

/* ================================
   VERIFY
================================ */
SHOW TABLES;
