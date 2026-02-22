# Digital Logbook MVP ERD (Clean Version)

This ERD focuses on the **minimum core tables** needed for login, class enrollment, attendance, and feedback workflows.

## Core MVP Tables

1. `users` - authentication and role
2. `students` - student profile
3. `teachers` - teacher profile
4. `admins` - admin profile
5. `subjects` - subject master list
6. `classes` - class offerings
7. `classlist` - student-class enrollment
8. `attendance` - daily attendance per class
9. `log_entries` - login/logout sessions
10. `feedback` - lab equipment reports
11. `departments` - teacher grouping

## Optional / Secondary Module

- `profile_photos` (can be excluded from MVP if photo feature is not needed)
- `registration_approvals` (can be excluded from MVP if self-registration approval flow is not needed)

## Mermaid ERD

```mermaid
erDiagram
    USERS {
        int id PK
        string username
        string password
        enum user_type
        enum account_status
        bool account_lock
        bool is_active
        datetime created_at
    }

    ADMINS {
        int id PK, FK
        string admin_id
        string first_name
        string last_name
        string email
    }

    TEACHERS {
        int id PK, FK
        string teacher_id
        string first_name
        string last_name
        string email
        string department_code FK
    }

    STUDENTS {
        int id PK, FK
        string student_id
        string first_name
        string last_name
        string email
        bool is_working_student
        datetime archived_at
        datetime deletion_scheduled_at
    }

    DEPARTMENTS {
        string department_code PK
        string department_name
        bool is_active
    }

    SUBJECTS {
        string subject_code PK
        string description
    }

    CLASSES {
        int class_id PK
        string subject_code FK
        int teacher_id FK
        string edp_code
        string descriptive_title
        string section
        string schedule
        string room
        string semester
        string school_year
        bool is_active
        bool is_archived
        int created_by_user_id FK
    }

    CLASSLIST {
        int class_id PK, FK
        int student_id PK, FK
        date enrollment_date
        enum status
        bool is_archived
    }

    ATTENDANCE {
        int id PK
        int class_id FK
        int student_id FK
        date attendance_date
        enum status
        string remarks
        bool is_archived
    }

    LOG_ENTRIES {
        int id PK
        int user_id FK
        string pc_number
        datetime login_time
        datetime logout_time
        bool is_archived
    }

    FEEDBACK {
        int id PK
        int student_id FK
        string pc_number
        enum equipment_condition
        enum monitor_condition
        enum keyboard_condition
        enum mouse_condition
        string comments
        enum status
        enum priority
        int forwarded_by_user_id FK
        datetime forwarded_at
        datetime date_submitted
        bool is_archived
    }

    USERS ||--o| ADMINS : has_profile
    USERS ||--o| TEACHERS : has_profile
    USERS ||--o| STUDENTS : has_profile
    DEPARTMENTS ||--o{ TEACHERS : groups
    SUBJECTS ||--o{ CLASSES : defines
    TEACHERS ||--o{ CLASSES : teaches
    USERS ||--o{ CLASSES : created_by
    CLASSES ||--o{ CLASSLIST : includes
    STUDENTS ||--o{ CLASSLIST : enrolls
    CLASSES ||--o{ ATTENDANCE : records
    STUDENTS ||--o{ ATTENDANCE : has
    USERS ||--o{ LOG_ENTRIES : logs
    STUDENTS ||--o{ FEEDBACK : submits
    USERS ||--o{ FEEDBACK : forwards
```

## Minimal ERD View (if you want very simple)

If your panel wants a very simple diagram, use only:

- `users`
- `students`
- `teachers`
- `classes`
- `classlist`
- `attendance`

Then add `feedback` and `log_entries` as separate feature modules.

## Revised Attendance Flow (Straight, Simple, Practical)

To address the "manual attendance" concern, use this operational flow:

1. Teacher creates class and enrolls students in `classlist`.
2. Student logs in to a lab PC (`log_entries` records login time and workstation).
3. System gets all active classlist enrollments of the student.
4. For each enrolled class, system auto-initializes today's attendance sheet (default `absent` for active enrolled students).
5. System immediately updates the logging-in student to `present` in `attendance`.
6. Teacher only reviews/adjusts edge cases (late, valid absences), not encode from scratch.

This makes attendance primarily **system-generated** and only secondarily **teacher-corrected**.

## Attendance Rules (Current System Behavior)

- **Trigger**: Attendance automation runs on student login.
- **Class scope**: Only active, non-archived classes where student enrollment is active.
- **Sheet generation**: If today's class sheet does not exist, system creates it automatically and sets all enrolled students to `absent` by default.
- **Auto-marking**: Logging-in student is upserted to `present` for today.
- **Edit control**: Teachers can edit only today's attendance; past dates are read-only.
- **Archive control**: Only past attendance can be archived.

## Recommendations (For IT Teachers and Panelists)

- Keep `attendance` as the official class record, and treat `log_entries` as objective evidence/audit trail.
- Continue same-day edit rule for teachers; lock past dates to protect data integrity.
- Keep default status as `absent`; promote to `present` automatically on student login for active classlist enrollments.
- Add a small grace window policy (e.g., first 10 minutes = `present`, after = `late`) and document it in system policy.
- Show "Auto-recorded by login" indicator in UI for transparency during checking.
- Include exception workflow: students without login evidence require teacher remark (`remarks`) before status change.
- If needed by policy, introduce teacher validation rules for late/excused cases while keeping classlist-based auto-generation.
- For defense/demo, prepare one scenario: student logs in -> attendance row appears automatically -> teacher only verifies.

## Suggested Defense Line

"Our attendance is not encoded manually. The system auto-generates attendance from active classlists and auto-updates records from authenticated lab logins, while teachers only validate exceptions for academic control."
