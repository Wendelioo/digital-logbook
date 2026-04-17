export namespace backend {
	
	export class AdminDashboard {
	    total_students: number;
	    total_teachers: number;
	    working_students: number;
	    recent_logins: number;
	    active_users_now: number;
	    students_logged_in: number;
	    teachers_logged_in: number;
	    working_students_logged_in: number;
	    today_logins: number;
	    today_teacher_logins: number;
	    today_admin_logins: number;
	    last_teacher_login_at?: string;
	    last_teacher_pc_number?: string;
	    last_admin_login_at?: string;
	    last_admin_pc_number?: string;
	    today_new_users: number;
	    issue_reports_today: number;
	    no_issue_reports_today: number;
	    pending_feedback: number;
	
	    static createFrom(source: any = {}) {
	        return new AdminDashboard(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total_students = source["total_students"];
	        this.total_teachers = source["total_teachers"];
	        this.working_students = source["working_students"];
	        this.recent_logins = source["recent_logins"];
	        this.active_users_now = source["active_users_now"];
	        this.students_logged_in = source["students_logged_in"];
	        this.teachers_logged_in = source["teachers_logged_in"];
	        this.working_students_logged_in = source["working_students_logged_in"];
	        this.today_logins = source["today_logins"];
	        this.today_teacher_logins = source["today_teacher_logins"];
	        this.today_admin_logins = source["today_admin_logins"];
	        this.last_teacher_login_at = source["last_teacher_login_at"];
	        this.last_teacher_pc_number = source["last_teacher_pc_number"];
	        this.last_admin_login_at = source["last_admin_login_at"];
	        this.last_admin_pc_number = source["last_admin_pc_number"];
	        this.today_new_users = source["today_new_users"];
	        this.issue_reports_today = source["issue_reports_today"];
	        this.no_issue_reports_today = source["no_issue_reports_today"];
	        this.pending_feedback = source["pending_feedback"];
	    }
	}
	export class ApprovalRequest {
	    user_id: number;
	    approved_by: number;
	    action: string;
	    rejection_reason?: string;
	
	    static createFrom(source: any = {}) {
	        return new ApprovalRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.user_id = source["user_id"];
	        this.approved_by = source["approved_by"];
	        this.action = source["action"];
	        this.rejection_reason = source["rejection_reason"];
	    }
	}
	export class ArchivedAttendanceSheet {
	    session_id: number;
	    class_id: number;
	    date: string;
	    subject_code: string;
	    subject_name: string;
	    edp_code: string;
	    schedule: string;
	    student_count: number;
	    present_count: number;
	    absent_count: number;
	    late_count: number;
	
	    static createFrom(source: any = {}) {
	        return new ArchivedAttendanceSheet(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.session_id = source["session_id"];
	        this.class_id = source["class_id"];
	        this.date = source["date"];
	        this.subject_code = source["subject_code"];
	        this.subject_name = source["subject_name"];
	        this.edp_code = source["edp_code"];
	        this.schedule = source["schedule"];
	        this.student_count = source["student_count"];
	        this.present_count = source["present_count"];
	        this.absent_count = source["absent_count"];
	        this.late_count = source["late_count"];
	    }
	}
	export class ArchivedStudent {
	    user_id: number;
	    student_id: string;
	    first_name: string;
	    middle_name?: string;
	    last_name: string;
	    email?: string;
	    contact_number?: string;
	    archived_at: string;
	    deletion_scheduled_at: string;
	    days_until_deletion: number;
	
	    static createFrom(source: any = {}) {
	        return new ArchivedStudent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.user_id = source["user_id"];
	        this.student_id = source["student_id"];
	        this.first_name = source["first_name"];
	        this.middle_name = source["middle_name"];
	        this.last_name = source["last_name"];
	        this.email = source["email"];
	        this.contact_number = source["contact_number"];
	        this.archived_at = source["archived_at"];
	        this.deletion_scheduled_at = source["deletion_scheduled_at"];
	        this.days_until_deletion = source["days_until_deletion"];
	    }
	}
	export class Attendance {
	    id: number;
	    class_id: number;
	    subject_code: string;
	    subject_name: string;
	    section: string;
	    schedule: string;
	    student_user_id: number;
	    student_id: string;
	    student_code: string;
	    student_name: string;
	    first_name: string;
	    middle_name?: string;
	    last_name: string;
	    date: string;
	    attendance_date: string;
	    time_in?: string;
	    status: string;
	    remarks?: string;
	    recorded_by: number;
	    recorded_by_name: string;
	    is_archived: boolean;
	    is_editable: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Attendance(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.class_id = source["class_id"];
	        this.subject_code = source["subject_code"];
	        this.subject_name = source["subject_name"];
	        this.section = source["section"];
	        this.schedule = source["schedule"];
	        this.student_user_id = source["student_user_id"];
	        this.student_id = source["student_id"];
	        this.student_code = source["student_code"];
	        this.student_name = source["student_name"];
	        this.first_name = source["first_name"];
	        this.middle_name = source["middle_name"];
	        this.last_name = source["last_name"];
	        this.date = source["date"];
	        this.attendance_date = source["attendance_date"];
	        this.time_in = source["time_in"];
	        this.status = source["status"];
	        this.remarks = source["remarks"];
	        this.recorded_by = source["recorded_by"];
	        this.recorded_by_name = source["recorded_by_name"];
	        this.is_archived = source["is_archived"];
	        this.is_editable = source["is_editable"];
	    }
	}
	export class AttendanceHistoryRecord {
	    class_id: number;
	    subject_code: string;
	    subject_name: string;
	    section: string;
	    date: string;
	    session_name?: string;
	    status: string;
	    time_in?: string;
	
	    static createFrom(source: any = {}) {
	        return new AttendanceHistoryRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.class_id = source["class_id"];
	        this.subject_code = source["subject_code"];
	        this.subject_name = source["subject_name"];
	        this.section = source["section"];
	        this.date = source["date"];
	        this.session_name = source["session_name"];
	        this.status = source["status"];
	        this.time_in = source["time_in"];
	    }
	}
	export class AttendanceSession {
	    session_id: number;
	    class_id: number;
	    attendance_date: string;
	    session_name: string;
	    status: string;
	    class_duration_minutes?: number;
	    grace_period_minutes?: number;
	    opened_at?: string;
	    paused_at?: string;
	    closed_at?: string;
	    subject_code: string;
	    subject_name: string;
	    edp_code: string;
	    present_count: number;
	    absent_count: number;
	    late_count: number;
	
	    static createFrom(source: any = {}) {
	        return new AttendanceSession(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.session_id = source["session_id"];
	        this.class_id = source["class_id"];
	        this.attendance_date = source["attendance_date"];
	        this.session_name = source["session_name"];
	        this.status = source["status"];
	        this.class_duration_minutes = source["class_duration_minutes"];
	        this.grace_period_minutes = source["grace_period_minutes"];
	        this.opened_at = source["opened_at"];
	        this.paused_at = source["paused_at"];
	        this.closed_at = source["closed_at"];
	        this.subject_code = source["subject_code"];
	        this.subject_name = source["subject_name"];
	        this.edp_code = source["edp_code"];
	        this.present_count = source["present_count"];
	        this.absent_count = source["absent_count"];
	        this.late_count = source["late_count"];
	    }
	}
	export class AttendanceSheetSummary {
	    session_id: number;
	    class_id: number;
	    date: string;
	    subject_code: string;
	    subject_name: string;
	    edp_code: string;
	    schedule: string;
	    status: string;
	    opened_at?: string;
	    student_count: number;
	    present_count: number;
	    absent_count: number;
	    late_count: number;
	    is_archived: boolean;
	    is_editable: boolean;
	
	    static createFrom(source: any = {}) {
	        return new AttendanceSheetSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.session_id = source["session_id"];
	        this.class_id = source["class_id"];
	        this.date = source["date"];
	        this.subject_code = source["subject_code"];
	        this.subject_name = source["subject_name"];
	        this.edp_code = source["edp_code"];
	        this.schedule = source["schedule"];
	        this.status = source["status"];
	        this.opened_at = source["opened_at"];
	        this.student_count = source["student_count"];
	        this.present_count = source["present_count"];
	        this.absent_count = source["absent_count"];
	        this.late_count = source["late_count"];
	        this.is_archived = source["is_archived"];
	        this.is_editable = source["is_editable"];
	    }
	}
	export class ClassStudent {
	    id: number;
	    student_id: string;
	    first_name: string;
	    middle_name?: string;
	    last_name: string;
	    gender?: string;
	    email?: string;
	    contact_number?: string;
	    photo_url?: string;
	    class_id?: number;
	    is_joined: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ClassStudent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.student_id = source["student_id"];
	        this.first_name = source["first_name"];
	        this.middle_name = source["middle_name"];
	        this.last_name = source["last_name"];
	        this.gender = source["gender"];
	        this.email = source["email"];
	        this.contact_number = source["contact_number"];
	        this.photo_url = source["photo_url"];
	        this.class_id = source["class_id"];
	        this.is_joined = source["is_joined"];
	    }
	}
	export class ClasslistEntry {
	    class_id: number;
	    student_user_id: number;
	    student_code: string;
	    first_name: string;
	    middle_name?: string;
	    last_name: string;
	    joined_date: string;
	    status: string;
	    email?: string;
	    contact_number?: string;
	    course?: string;
	
	    static createFrom(source: any = {}) {
	        return new ClasslistEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.class_id = source["class_id"];
	        this.student_user_id = source["student_user_id"];
	        this.student_code = source["student_code"];
	        this.first_name = source["first_name"];
	        this.middle_name = source["middle_name"];
	        this.last_name = source["last_name"];
	        this.joined_date = source["joined_date"];
	        this.status = source["status"];
	        this.email = source["email"];
	        this.contact_number = source["contact_number"];
	        this.course = source["course"];
	    }
	}
	export class CourseClass {
	    id: number;
	    class_id: number;
	    subject_code: string;
	    subject_name: string;
	    descriptive_title?: string;
	    edp_code?: string;
	    join_code?: string;
	    section?: string;
	    schedule?: string;
	    room?: string;
	    school_year?: string;
	    semester?: string;
	    teacher_user_id: number;
	    teacher_name?: string;
	    student_count: number;
	    enrolled_count: number;
	    is_active: boolean;
	    is_archived: boolean;
	    created_by_user_id?: number;
	    created_at: string;
	    latest_attendance_date?: string;
	    class_status: string;
	
	    static createFrom(source: any = {}) {
	        return new CourseClass(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.class_id = source["class_id"];
	        this.subject_code = source["subject_code"];
	        this.subject_name = source["subject_name"];
	        this.descriptive_title = source["descriptive_title"];
	        this.edp_code = source["edp_code"];
	        this.join_code = source["join_code"];
	        this.section = source["section"];
	        this.schedule = source["schedule"];
	        this.room = source["room"];
	        this.school_year = source["school_year"];
	        this.semester = source["semester"];
	        this.teacher_user_id = source["teacher_user_id"];
	        this.teacher_name = source["teacher_name"];
	        this.student_count = source["student_count"];
	        this.enrolled_count = source["enrolled_count"];
	        this.is_active = source["is_active"];
	        this.is_archived = source["is_archived"];
	        this.created_by_user_id = source["created_by_user_id"];
	        this.created_at = source["created_at"];
	        this.latest_attendance_date = source["latest_attendance_date"];
	        this.class_status = source["class_status"];
	    }
	}
	export class DatabaseSetupSettings {
	    host: string;
	    port: string;
	    dbname: string;
	    username: string;
	    password: string;
	    source_path: string;
	    write_path: string;
	    is_configured: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DatabaseSetupSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.port = source["port"];
	        this.dbname = source["dbname"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.source_path = source["source_path"];
	        this.write_path = source["write_path"];
	        this.is_configured = source["is_configured"];
	    }
	}
	export class Department {
	    department_code: string;
	    department_name: string;
	    is_active: boolean;
	    is_archived: boolean;
	    created_at: string;
	    updated_at: string;
	
	    static createFrom(source: any = {}) {
	        return new Department(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.department_code = source["department_code"];
	        this.department_name = source["department_name"];
	        this.is_active = source["is_active"];
	        this.is_archived = source["is_archived"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class Feedback {
	    id: number;
	    student_user_id: number;
	    student_id_str: string;
	    first_name: string;
	    middle_name?: string;
	    last_name: string;
	    student_name: string;
	    pc_number: string;
	    equipment_condition: string;
	    monitor_condition: string;
	    keyboard_condition: string;
	    mouse_condition: string;
	    additional_comments?: string;
	    date_submitted: string;
	    status: string;
	    admin_status: string;
	    admin_resolved_at?: string;
	    verified_by_user_id?: number;
	    verified_at?: string;
	    forwarded_by_user_id?: number;
	    forwarded_by_name?: string;
	    forwarded_at?: string;
	    forward_notes?: string;
	
	    static createFrom(source: any = {}) {
	        return new Feedback(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.student_user_id = source["student_user_id"];
	        this.student_id_str = source["student_id_str"];
	        this.first_name = source["first_name"];
	        this.middle_name = source["middle_name"];
	        this.last_name = source["last_name"];
	        this.student_name = source["student_name"];
	        this.pc_number = source["pc_number"];
	        this.equipment_condition = source["equipment_condition"];
	        this.monitor_condition = source["monitor_condition"];
	        this.keyboard_condition = source["keyboard_condition"];
	        this.mouse_condition = source["mouse_condition"];
	        this.additional_comments = source["additional_comments"];
	        this.date_submitted = source["date_submitted"];
	        this.status = source["status"];
	        this.admin_status = source["admin_status"];
	        this.admin_resolved_at = source["admin_resolved_at"];
	        this.verified_by_user_id = source["verified_by_user_id"];
	        this.verified_at = source["verified_at"];
	        this.forwarded_by_user_id = source["forwarded_by_user_id"];
	        this.forwarded_by_name = source["forwarded_by_name"];
	        this.forwarded_at = source["forwarded_at"];
	        this.forward_notes = source["forward_notes"];
	    }
	}
	export class InactivityPolicySettings {
	    configured_inactivity_deactivation_days: number;
	    configured_deactivated_deletion_days: number;
	    effective_inactivity_deactivation_days: number;
	    effective_deactivated_deletion_days: number;
	    env_override_inactivity: boolean;
	    env_override_deletion: boolean;
	
	    static createFrom(source: any = {}) {
	        return new InactivityPolicySettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.configured_inactivity_deactivation_days = source["configured_inactivity_deactivation_days"];
	        this.configured_deactivated_deletion_days = source["configured_deactivated_deletion_days"];
	        this.effective_inactivity_deactivation_days = source["effective_inactivity_deactivation_days"];
	        this.effective_deactivated_deletion_days = source["effective_deactivated_deletion_days"];
	        this.env_override_inactivity = source["env_override_inactivity"];
	        this.env_override_deletion = source["env_override_deletion"];
	    }
	}
	export class LockSettings {
	    lock_mode: boolean;
	    computer_lab: string;
	    pc_number: string;
	    station_label: string;
	
	    static createFrom(source: any = {}) {
	        return new LockSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.lock_mode = source["lock_mode"];
	        this.computer_lab = source["computer_lab"];
	        this.pc_number = source["pc_number"];
	        this.station_label = source["station_label"];
	    }
	}
	export class LoginLog {
	    id: number;
	    user_id: number;
	    user_name: string;
	    user_id_number: string;
	    user_type: string;
	    pc_number?: string;
	    login_time: string;
	    logout_time?: string;
	
	    static createFrom(source: any = {}) {
	        return new LoginLog(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.user_id = source["user_id"];
	        this.user_name = source["user_name"];
	        this.user_id_number = source["user_id_number"];
	        this.user_type = source["user_type"];
	        this.pc_number = source["pc_number"];
	        this.login_time = source["login_time"];
	        this.logout_time = source["logout_time"];
	    }
	}
	export class Notification {
	    id: number;
	    user_id: number;
	    category: string;
	    title: string;
	    message: string;
	    tone: string;
	    is_read: boolean;
	    reference_type?: string;
	    reference_id?: number;
	    created_at: string;
	    read_at?: string;
	
	    static createFrom(source: any = {}) {
	        return new Notification(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.user_id = source["user_id"];
	        this.category = source["category"];
	        this.title = source["title"];
	        this.message = source["message"];
	        this.tone = source["tone"];
	        this.is_read = source["is_read"];
	        this.reference_type = source["reference_type"];
	        this.reference_id = source["reference_id"];
	        this.created_at = source["created_at"];
	        this.read_at = source["read_at"];
	    }
	}
	export class NotificationSummary {
	    notifications: Notification[];
	    unread_count: number;
	
	    static createFrom(source: any = {}) {
	        return new NotificationSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.notifications = this.convertValues(source["notifications"], Notification);
	        this.unread_count = source["unread_count"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PendingRegistration {
	    user_id: number;
	    student_id: string;
	    last_name: string;
	    first_name: string;
	    middle_name?: string;
	    contact_number: string;
	    email: string;
	    submitted_at: string;
	
	    static createFrom(source: any = {}) {
	        return new PendingRegistration(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.user_id = source["user_id"];
	        this.student_id = source["student_id"];
	        this.last_name = source["last_name"];
	        this.first_name = source["first_name"];
	        this.middle_name = source["middle_name"];
	        this.contact_number = source["contact_number"];
	        this.email = source["email"];
	        this.submitted_at = source["submitted_at"];
	    }
	}
	export class RegistrationHistoryEntry {
	    first_name: string;
	    last_name: string;
	    middle_name?: string;
	    submitted_at: string;
	    processed_at: string;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new RegistrationHistoryEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.first_name = source["first_name"];
	        this.last_name = source["last_name"];
	        this.middle_name = source["middle_name"];
	        this.submitted_at = source["submitted_at"];
	        this.processed_at = source["processed_at"];
	        this.status = source["status"];
	    }
	}
	export class RegistrationRequest {
	    student_id: string;
	    department_code: string;
	    last_name: string;
	    first_name: string;
	    middle_name: string;
	    contact_number: string;
	    email: string;
	    password: string;
	    confirm_password: string;
	
	    static createFrom(source: any = {}) {
	        return new RegistrationRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.student_id = source["student_id"];
	        this.department_code = source["department_code"];
	        this.last_name = source["last_name"];
	        this.first_name = source["first_name"];
	        this.middle_name = source["middle_name"];
	        this.contact_number = source["contact_number"];
	        this.email = source["email"];
	        this.password = source["password"];
	        this.confirm_password = source["confirm_password"];
	    }
	}
	export class RegistrationSubmissionResult {
	    recovery_code: string;
	
	    static createFrom(source: any = {}) {
	        return new RegistrationSubmissionResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.recovery_code = source["recovery_code"];
	    }
	}
	export class StudentDashboard {
	    attendance: Attendance[];
	    today_log?: Attendance;
	    attendance_rate: number;
	    currently_logged_in: boolean;
	    current_pc_number?: string;
	    enrolled_classes: number;
	    archived_classes: number;
	
	    static createFrom(source: any = {}) {
	        return new StudentDashboard(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.attendance = this.convertValues(source["attendance"], Attendance);
	        this.today_log = this.convertValues(source["today_log"], Attendance);
	        this.attendance_rate = source["attendance_rate"];
	        this.currently_logged_in = source["currently_logged_in"];
	        this.current_pc_number = source["current_pc_number"];
	        this.enrolled_classes = source["enrolled_classes"];
	        this.archived_classes = source["archived_classes"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class User {
	    id: number;
	    password: string;
	    name: string;
	    first_name?: string;
	    middle_name?: string;
	    last_name?: string;
	    role: string;
	    employee_id?: string;
	    student_id?: string;
	    email?: string;
	    contact_number?: string;
	    photo_url?: string;
	    department_code?: string;
	    created: string;
	    login_log_id: number;
	    last_login_at?: string;
	    last_login_ago?: string;
	    currently_logged_in: boolean;
	    deactivated_at?: string;
	    deleted_at?: string;
	    activity_status?: string;
	
	    static createFrom(source: any = {}) {
	        return new User(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.password = source["password"];
	        this.name = source["name"];
	        this.first_name = source["first_name"];
	        this.middle_name = source["middle_name"];
	        this.last_name = source["last_name"];
	        this.role = source["role"];
	        this.employee_id = source["employee_id"];
	        this.student_id = source["student_id"];
	        this.email = source["email"];
	        this.contact_number = source["contact_number"];
	        this.photo_url = source["photo_url"];
	        this.department_code = source["department_code"];
	        this.created = source["created"];
	        this.login_log_id = source["login_log_id"];
	        this.last_login_at = source["last_login_at"];
	        this.last_login_ago = source["last_login_ago"];
	        this.currently_logged_in = source["currently_logged_in"];
	        this.deactivated_at = source["deactivated_at"];
	        this.deleted_at = source["deleted_at"];
	        this.activity_status = source["activity_status"];
	    }
	}
	export class WorkingStudentDashboard {
	    students_registered: number;
	    classlists_created: number;
	    pending_feedback: number;
	    issue_reports: number;
	    no_issue_reports: number;
	    forwarded_reports: number;
	    today_registrations: number;
	    active_students_now: number;
	    pending_registrations: number;
	
	    static createFrom(source: any = {}) {
	        return new WorkingStudentDashboard(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.students_registered = source["students_registered"];
	        this.classlists_created = source["classlists_created"];
	        this.pending_feedback = source["pending_feedback"];
	        this.issue_reports = source["issue_reports"];
	        this.no_issue_reports = source["no_issue_reports"];
	        this.forwarded_reports = source["forwarded_reports"];
	        this.today_registrations = source["today_registrations"];
	        this.active_students_now = source["active_students_now"];
	        this.pending_registrations = source["pending_registrations"];
	    }
	}

}

