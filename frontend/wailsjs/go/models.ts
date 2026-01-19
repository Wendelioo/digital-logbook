export namespace main {
	
	export class AdminDashboard {
	    total_students: number;
	    total_teachers: number;
	    working_students: number;
	    recent_logins: number;
	
	    static createFrom(source: any = {}) {
	        return new AdminDashboard(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total_students = source["total_students"];
	        this.total_teachers = source["total_teachers"];
	        this.working_students = source["working_students"];
	        this.recent_logins = source["recent_logins"];
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
	    time_out?: string;
	    pc_number?: string;
	    status: string;
	    remarks?: string;
	    recorded_by: number;
	    recorded_by_name: string;
	
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
	        this.time_out = source["time_out"];
	        this.pc_number = source["pc_number"];
	        this.status = source["status"];
	        this.remarks = source["remarks"];
	        this.recorded_by = source["recorded_by"];
	        this.recorded_by_name = source["recorded_by_name"];
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
	    profile_photo?: string;
	    class_id?: number;
	    is_enrolled: boolean;
	
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
	        this.profile_photo = source["profile_photo"];
	        this.class_id = source["class_id"];
	        this.is_enrolled = source["is_enrolled"];
	    }
	}
	export class ClasslistEntry {
	    class_id: number;
	    student_user_id: number;
	    student_code: string;
	    first_name: string;
	    middle_name?: string;
	    last_name: string;
	    enrollment_date: string;
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
	        this.enrollment_date = source["enrollment_date"];
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
	    offering_code?: string;
	    section?: string;
	    schedule?: string;
	    room?: string;
	    year_level?: string;
	    school_year?: string;
	    semester?: string;
	    teacher_user_id: number;
	    teacher_name?: string;
	    student_count: number;
	    enrolled_count: number;
	    is_active: boolean;
	    created_by_user_id?: number;
	    created_at: string;
	
	    static createFrom(source: any = {}) {
	        return new CourseClass(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.class_id = source["class_id"];
	        this.subject_code = source["subject_code"];
	        this.subject_name = source["subject_name"];
	        this.offering_code = source["offering_code"];
	        this.section = source["section"];
	        this.schedule = source["schedule"];
	        this.room = source["room"];
	        this.year_level = source["year_level"];
	        this.school_year = source["school_year"];
	        this.semester = source["semester"];
	        this.teacher_user_id = source["teacher_user_id"];
	        this.teacher_name = source["teacher_name"];
	        this.student_count = source["student_count"];
	        this.enrolled_count = source["enrolled_count"];
	        this.is_active = source["is_active"];
	        this.created_by_user_id = source["created_by_user_id"];
	        this.created_at = source["created_at"];
	    }
	}
	export class Department {
	    department_code: string;
	    department_name: string;
	    description?: string;
	    is_active: boolean;
	    created_at: string;
	    updated_at: string;
	
	    static createFrom(source: any = {}) {
	        return new Department(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.department_code = source["department_code"];
	        this.department_name = source["department_name"];
	        this.description = source["description"];
	        this.is_active = source["is_active"];
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
	    comments?: string;
	    date_submitted: string;
	    status: string;
	    forwarded_by_user_id?: number;
	    forwarded_by_name?: string;
	    forwarded_at?: string;
	    working_student_notes?: string;
	
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
	        this.comments = source["comments"];
	        this.date_submitted = source["date_submitted"];
	        this.status = source["status"];
	        this.forwarded_by_user_id = source["forwarded_by_user_id"];
	        this.forwarded_by_name = source["forwarded_by_name"];
	        this.forwarded_at = source["forwarded_at"];
	        this.working_student_notes = source["working_student_notes"];
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
	export class StudentDashboard {
	    attendance: Attendance[];
	    today_log?: Attendance;
	
	    static createFrom(source: any = {}) {
	        return new StudentDashboard(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.attendance = this.convertValues(source["attendance"], Attendance);
	        this.today_log = this.convertValues(source["today_log"], Attendance);
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
	export class Subject {
	    code: string;
	    name: string;
	    teacher_user_id: number;
	    teacher_name?: string;
	    description?: string;
	    created_at: string;
	
	    static createFrom(source: any = {}) {
	        return new Subject(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.code = source["code"];
	        this.name = source["name"];
	        this.teacher_user_id = source["teacher_user_id"];
	        this.teacher_name = source["teacher_name"];
	        this.description = source["description"];
	        this.created_at = source["created_at"];
	    }
	}
	export class TeacherDashboard {
	    classes: CourseClass[];
	    attendance: Attendance[];
	
	    static createFrom(source: any = {}) {
	        return new TeacherDashboard(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.classes = this.convertValues(source["classes"], CourseClass);
	        this.attendance = this.convertValues(source["attendance"], Attendance);
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
	    gender?: string;
	    role: string;
	    employee_id?: string;
	    student_id?: string;
	    year?: string;
	    section?: string;
	    email?: string;
	    contact_number?: string;
	    photo_url?: string;
	    department_code?: string;
	    created: string;
	    login_log_id: number;
	
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
	        this.gender = source["gender"];
	        this.role = source["role"];
	        this.employee_id = source["employee_id"];
	        this.student_id = source["student_id"];
	        this.year = source["year"];
	        this.section = source["section"];
	        this.email = source["email"];
	        this.contact_number = source["contact_number"];
	        this.photo_url = source["photo_url"];
	        this.department_code = source["department_code"];
	        this.created = source["created"];
	        this.login_log_id = source["login_log_id"];
	    }
	}
	export class WorkingStudentDashboard {
	    students_registered: number;
	    classlists_created: number;
	
	    static createFrom(source: any = {}) {
	        return new WorkingStudentDashboard(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.students_registered = source["students_registered"];
	        this.classlists_created = source["classlists_created"];
	    }
	}

}

