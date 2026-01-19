# Digital Logbook Refactoring Guide

## Current State Assessment

### Backend Issues
- **app.go**: 3,798 lines with 69 methods - violates Single Responsibility Principle
- Long parameter lists (14+ parameters in CreateUser)
- Mixed concerns: auth, users, attendance, feedback, classes, exports all in one file

### Frontend Issues  
- **AdminDashboard.tsx**: 2,255 lines
- **TeacherDashboard.tsx**: 2,721 lines
- **WorkingStudentDashboard.tsx**: 1,681 lines
- **StudentDashboard.tsx**: 1,038 lines
- Monolithic components with UI, state, and business logic mixed
- Duplicated form handling and API call patterns

## Phase 1: Backend Refactoring (Priority: HIGH)

### Step 1.1: Extract Domain Files ✅ (IN PROGRESS)
Split app.go into logical domain files:

```
✅ auth.go - Login, Logout, ChangePassword (COMPLETED)
□ users.go - GetUsers, CreateUser, UpdateUser, DeleteUser, SearchUsers
□ departments.go - Department CRUD operations
□ feedback.go - Equipment feedback management
□ attendance.go - Attendance tracking and auto-recording
□ classes.go - Class management, enrollment, subjects
□ logs.go - Login logs and reports
□ exports.go - CSV/PDF export functions
□ dashboards.go - Dashboard statistics
```

**Files Created:**
- `auth.go` - Authentication methods with helper functions

### Step 1.2: Create Request/Response Structs
Replace long parameter lists with structured requests:

```go
// Before (14 parameters!)
CreateUser(password, name, firstName, middleName, lastName, gender, role, 
          employeeID, studentID, year, section, email, contactNumber, departmentCode string)

// After
type CreateUserRequest struct {
    Password       string
    Name           string
    FirstName      string
    MiddleName     string
    LastName       string
    Gender         string
    Role           string
    EmployeeID     string
    StudentID      string
    Year           string
    Section        string
    Email          string
    ContactNumber  string
    DepartmentCode string
}

CreateUser(req CreateUserRequest) error
```

### Step 1.3: Extract Common Helpers
Create `helpers.go` for shared utilities:
- `nullString()` - SQL null handling
- Database scanning helpers
- Common validation functions

## Phase 2: Frontend Component Refactoring (Priority: HIGH)

### Step 2.1: Create Shared Components
Extract reusable UI components to `frontend/src/components/`:

```
□ DataTable.tsx - Reusable table with sorting, filtering
□ Modal.tsx - Generic modal wrapper
□ FormField.tsx - Standardized form input
□ Button.tsx - Consistent button styles
□ Card.tsx - Dashboard card component
□ LoadingSpinner.tsx - Loading states
□ SearchBar.tsx - Search functionality
□ Pagination.tsx - Table pagination
```

### Step 2.2: Create Custom Hooks
Extract data fetching to `frontend/src/hooks/`:

```
□ useUsers.ts - User CRUD operations
□ useFeedback.ts - Feedback management
□ useAttendance.ts - Attendance operations
□ useClasses.ts - Class management
□ useDepartments.ts - Department operations
□ useAuth.ts - Authentication state (can extend current AuthContext)
```

### Step 2.3: Split Dashboard Components
Break down monolithic dashboards:

**AdminDashboard** → Split into:
- `AdminOverview.tsx` - Stats cards
- `UserManagement.tsx` - User table and CRUD
- `DepartmentManagement.tsx` - Department management
- `LogsView.tsx` - Login logs table
- `FeedbackManagement.tsx` - Equipment feedback

**TeacherDashboard** → Split into:
- `TeacherOverview.tsx` - Stats
- `ClassManagement.tsx` - Classes list and create
- `AttendanceTracking.tsx` - Attendance marking
- `StudentEnrollment.tsx` - Class roster management

**WorkingStudentDashboard** → Split into:
- `WorkingStudentOverview.tsx` - Stats
- `StudentRegistration.tsx` - Single/bulk registration
- `ClassCreation.tsx` - Create classes for teachers
- `FeedbackQueue.tsx` - Pending feedback list

**StudentDashboard** → Split into:
- `StudentOverview.tsx` - Stats
- `AttendanceHistory.tsx` - Personal attendance
- `ClassSchedule.tsx` - Enrolled classes
- `EquipmentFeedbackForm.tsx` - Submit feedback

### Step 2.4: Create API Service Layer
Create `frontend/src/services/api.ts`:

```typescript
// Centralize all Wails API calls
export const userService = {
  getAll: () => GetUsers(),
  getByType: (type: string) => GetUsersByType(type),
  create: (user: CreateUserRequest) => CreateUser(user),
  update: (id: number, user: UpdateUserRequest) => UpdateUser(id, user),
  delete: (id: number) => DeleteUser(id)
};

export const attendanceService = { ... };
export const feedbackService = { ... };
export const classService = { ... };
```

## Phase 3: Code Quality Improvements (Priority: MEDIUM)

### Step 3.1: Add TypeScript Interfaces
- Centralize all interfaces in `frontend/src/types/`
- Remove duplicate type definitions across files

### Step 3.2: Standardize Error Handling
- Create consistent error handling patterns
- Add user-friendly error messages
- Implement error boundary components

### Step 3.3: Add Form Validation
- Create validation helper functions
- Standardize form validation patterns
- Provide clear validation feedback

## Phase 4: Performance & Best Practices (Priority: LOW)

### Step 4.1: Optimize Database Queries
- Add database indices for commonly queried fields
- Review and optimize JOIN operations
- Consider query caching for dashboard stats

### Step 4.2: Add Logging & Monitoring
- Structured logging with log levels
- Performance monitoring for slow queries
- User action audit trail

### Step 4.3: Security Improvements
- Implement proper password hashing (currently using plain text!)
- Add input sanitization
- Implement rate limiting for login attempts

## Implementation Strategy

### Quick Wins (Do First)
1. ✅ Create `auth.go` - Already done
2. Extract `users.go`, `departments.go`, `feedback.go` - High impact, low risk
3. Create shared Button and Modal components - Immediate UI consistency
4. Extract useUsers hook - Reduces code duplication significantly

### Medium Effort (Do Second)
1. Split AdminDashboard into sub-components
2. Create request/response structs for backend
3. Create API service layer in frontend
4. Standardize form components

### Long-term (Do When Time Permits)
1. Complete refactoring of all dashboard components
2. Add comprehensive error boundaries
3. Implement performance optimizations
4. Security hardening

## Testing Strategy

For each refactored component:
1. Ensure existing functionality still works
2. Test error cases
3. Verify database transactions
4. Check UI responsiveness

## Migration Notes

- **Backwards Compatibility**: Keep old methods until frontend is updated
- **Incremental Deploy**: Refactor one domain at a time
- **Testing**: Test each extracted file independently
- **Git Strategy**: Create feature branch for each domain extraction

## Metrics to Track

- Lines of code per file (target: < 500 lines)
- Functions per file (target: < 20)
- Parameters per function (target: < 5)
- Code duplication percentage
- Component reusability score

## Resources

- Go best practices: https://go.dev/doc/effective_go
- React component patterns: https://reactpatterns.com/
- Clean Code principles: Robert C. Martin's Clean Code
- Wails documentation: https://wails.io/docs/

---

**Last Updated**: 2026-01-18
**Status**: Phase 1 In Progress (auth.go completed)
