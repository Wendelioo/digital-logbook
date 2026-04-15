package backend

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"
)

// ==============================================================================
// DEPARTMENT MANAGEMENT METHODS
// ==============================================================================

// Department represents a department
type Department struct {
	DepartmentCode string `json:"department_code"`
	DepartmentName string `json:"department_name"`
	IsActive       bool   `json:"is_active"`
	IsArchived     bool   `json:"is_archived"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
}

// ensureDepartmentArchiveColumn ensures departments.is_archived exists.
func (a *App) ensureDepartmentArchiveColumn() error {
	if err := a.checkDB(); err != nil {
		return err
	}

	var exists int
	err := a.db.QueryRow(`
		SELECT COUNT(*)
		FROM INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE()
		  AND TABLE_NAME = 'departments'
		  AND COLUMN_NAME = 'is_archived'
	`).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check is_archived column in departments: %w", err)
	}

	if exists == 0 {
		if _, err := a.db.Exec(`ALTER TABLE departments ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0`); err != nil {
			return fmt.Errorf("failed to ensure is_archived column in departments: %w", err)
		}
	}

	return nil
}

// ensureDepartmentDeleteColumns ensures departments soft-delete columns exist.
func (a *App) ensureDepartmentDeleteColumns() error {
	if err := a.checkDB(); err != nil {
		return err
	}

	ensureColumn := func(columnName, columnDef string) error {
		var exists int
		err := a.db.QueryRow(`
			SELECT COUNT(*)
			FROM INFORMATION_SCHEMA.COLUMNS
			WHERE TABLE_SCHEMA = DATABASE()
			  AND TABLE_NAME = 'departments'
			  AND COLUMN_NAME = ?
		`, columnName).Scan(&exists)
		if err != nil {
			return err
		}
		if exists == 0 {
			if _, err := a.db.Exec(fmt.Sprintf("ALTER TABLE departments ADD COLUMN %s %s", columnName, columnDef)); err != nil {
				return err
			}
		}
		return nil
	}

	if err := ensureColumn("is_deleted", "TINYINT(1) NOT NULL DEFAULT 0"); err != nil {
		return fmt.Errorf("failed to ensure is_deleted column in departments: %w", err)
	}
	if err := ensureColumn("deleted_at", "DATETIME NULL"); err != nil {
		return fmt.Errorf("failed to ensure deleted_at column in departments: %w", err)
	}

	return nil
}

// GetDepartments returns all departments
func (a *App) GetDepartments() ([]Department, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}
	if err := a.ensureDepartmentArchiveColumn(); err != nil {
		return nil, err
	}
	if err := a.ensureDepartmentDeleteColumns(); err != nil {
		return nil, err
	}

	rows, err := a.db.Query(`
		SELECT department_code, department_name, is_active, COALESCE(is_archived, 0), created_at, updated_at
		FROM departments
		WHERE COALESCE(is_deleted, 0) = 0
		ORDER BY department_code
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var departments []Department
	for rows.Next() {
		var dept Department
		var createdAt, updatedAt time.Time

		if err := rows.Scan(&dept.DepartmentCode, &dept.DepartmentName, &dept.IsActive, &dept.IsArchived, &createdAt, &updatedAt); err != nil {
			continue
		}

		dept.CreatedAt = formatTime(createdAt)
		dept.UpdatedAt = formatTime(updatedAt)
		departments = append(departments, dept)
	}

	return departments, nil
}

// CreateDepartment creates a new department
func (a *App) CreateDepartment(departmentCode, departmentName, description string) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	_ = description

	departmentCode = strings.ToUpper(strings.TrimSpace(departmentCode))
	departmentName = strings.TrimSpace(departmentName)
	if departmentCode == "" || departmentName == "" {
		return fmt.Errorf("program code and program name are required")
	}

	var duplicateNameCode string
	err := a.db.QueryRow(
		`SELECT department_code FROM departments WHERE UPPER(TRIM(department_name)) = UPPER(?) LIMIT 1`,
		departmentName,
	).Scan(&duplicateNameCode)
	if err == nil {
		return fmt.Errorf("program name already exists")
	}
	if err != sql.ErrNoRows {
		return fmt.Errorf("failed to validate program name: %w", err)
	}

	if _, err := a.db.Exec(
		`INSERT INTO departments (department_code, department_name) VALUES (?, ?)`,
		departmentCode, departmentName,
	); err != nil {
		log.Printf("Failed to create department: %v", err)
		return fmt.Errorf("failed to create department: %w", err)
	}

	log.Printf("Department created successfully: %s", departmentCode)
	return nil
}

// UpdateDepartment updates an existing department
func (a *App) UpdateDepartment(oldDepartmentCode, departmentCode, departmentName, description string, isActive bool, isArchived bool) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureDepartmentArchiveColumn(); err != nil {
		return err
	}
	if err := a.ensureDepartmentDeleteColumns(); err != nil {
		return err
	}
	_ = description

	departmentCode = strings.ToUpper(strings.TrimSpace(departmentCode))
	departmentName = strings.TrimSpace(departmentName)
	if departmentCode == "" || departmentName == "" {
		return fmt.Errorf("program code and program name are required")
	}

	var duplicateNameCode string
	err := a.db.QueryRow(
		`SELECT department_code FROM departments WHERE UPPER(TRIM(department_name)) = UPPER(?) AND department_code <> ? LIMIT 1`,
		departmentName,
		oldDepartmentCode,
	).Scan(&duplicateNameCode)
	if err == nil {
		return fmt.Errorf("program name already exists")
	}
	if err != sql.ErrNoRows {
		return fmt.Errorf("failed to validate program name: %w", err)
	}

	if isArchived && isActive {
		return fmt.Errorf("archived departments cannot be active. unarchive first")
	}

	result, err := a.db.Exec(
		`UPDATE departments SET department_code = ?, department_name = ?, is_active = ?, is_archived = ? WHERE department_code = ? AND COALESCE(is_deleted, 0) = 0`,
		departmentCode, departmentName, isActive, isArchived, oldDepartmentCode,
	)
	if err != nil {
		log.Printf("Failed to update department: %v", err)
		return fmt.Errorf("failed to update department: %w", err)
	}

	if rowsAffected, _ := result.RowsAffected(); rowsAffected == 0 {
		return fmt.Errorf("department not found or already deleted")
	}

	log.Printf("Department updated successfully: %s -> %s", oldDepartmentCode, departmentCode)
	return nil
}

// ArchiveDepartment marks a department as archived.

func (a *App) ArchiveDepartment(departmentCode string) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureDepartmentArchiveColumn(); err != nil {
		return err
	}
	if err := a.ensureDepartmentDeleteColumns(); err != nil {
		return err
	}

	var isActive bool
	var isArchived bool
	var isDeleted bool
	err := a.db.QueryRow(`SELECT is_active, COALESCE(is_archived, 0), COALESCE(is_deleted, 0) FROM departments WHERE department_code = ?`, departmentCode).Scan(&isActive, &isArchived, &isDeleted)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("department not found")
		}
		return fmt.Errorf("failed to read department status: %w", err)
	}
	if isDeleted {
		return fmt.Errorf("deleted departments cannot be archived")
	}

	if isArchived {
		return fmt.Errorf("department is already archived")
	}
	if isActive {
		return fmt.Errorf("active departments cannot be archived. set status to inactive first")
	}

	_, err = a.db.Exec(`UPDATE departments SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE department_code = ? AND COALESCE(is_deleted, 0) = 0`, departmentCode)
	if err != nil {
		log.Printf("Failed to archive department: %v", err)
		return fmt.Errorf("failed to archive department: %w", err)
	}

	log.Printf("Department archived successfully: %s", departmentCode)
	return nil
}

// UnarchiveDepartment clears a department archive flag.
// Keeps the current active/inactive state; activation is a separate step.
func (a *App) UnarchiveDepartment(departmentCode string) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureDepartmentArchiveColumn(); err != nil {
		return err
	}
	if err := a.ensureDepartmentDeleteColumns(); err != nil {
		return err
	}

	var isArchived bool
	var isDeleted bool
	err := a.db.QueryRow(`SELECT COALESCE(is_archived, 0), COALESCE(is_deleted, 0) FROM departments WHERE department_code = ?`, departmentCode).Scan(&isArchived, &isDeleted)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("department not found")
		}
		return fmt.Errorf("failed to read department status: %w", err)
	}
	if isDeleted {
		return fmt.Errorf("deleted departments cannot be restored")
	}

	if !isArchived {
		return fmt.Errorf("department is not archived")
	}

	_, err = a.db.Exec(`UPDATE departments SET is_archived = 0, updated_at = CURRENT_TIMESTAMP WHERE department_code = ? AND COALESCE(is_deleted, 0) = 0`, departmentCode)
	if err != nil {
		log.Printf("Failed to unarchive department: %v", err)
		return fmt.Errorf("failed to unarchive department: %w", err)
	}

	log.Printf("Department unarchived successfully: %s", departmentCode)
	return nil
}

// DeleteDepartment deletes a department
func (a *App) DeleteDepartment(departmentCode string) error {
	if err := a.checkDB(); err != nil {
		return err
	}
	if err := a.ensureDepartmentDeleteColumns(); err != nil {
		return err
	}
	if err := a.ensureDepartmentArchiveColumn(); err != nil {
		return err
	}

	departmentCode = strings.ToUpper(strings.TrimSpace(departmentCode))
	if departmentCode == "" {
		return fmt.Errorf("department code is required")
	}

	var isDeleted bool
	err := a.db.QueryRow(`
		SELECT COALESCE(is_deleted, 0)
		FROM departments
		WHERE department_code = ?
	`, departmentCode).Scan(&isDeleted)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("department not found")
		}
		return fmt.Errorf("failed to read department status: %w", err)
	}
	if isDeleted {
		return fmt.Errorf("department is already deleted")
	}

	var teacherCount int
	if err := a.db.QueryRow(`SELECT COUNT(*) FROM teachers WHERE department_code = ?`, departmentCode).Scan(&teacherCount); err != nil {
		return fmt.Errorf("failed to check assigned teachers: %w", err)
	}

	var studentCount int
	if err := a.db.QueryRow(`SELECT COUNT(*) FROM students WHERE department_code = ? AND COALESCE(is_working_student, 0) = 0`, departmentCode).Scan(&studentCount); err != nil {
		return fmt.Errorf("failed to check assigned students: %w", err)
	}

	var workingStudentCount int
	if err := a.db.QueryRow(`SELECT COUNT(*) FROM students WHERE department_code = ? AND COALESCE(is_working_student, 0) = 1`, departmentCode).Scan(&workingStudentCount); err != nil {
		return fmt.Errorf("failed to check assigned working students: %w", err)
	}

	if teacherCount > 0 || studentCount > 0 || workingStudentCount > 0 {
		reasons := make([]string, 0, 3)
		if teacherCount > 0 {
			reasons = append(reasons, fmt.Sprintf("%d teacher(s)", teacherCount))
		}
		if studentCount > 0 {
			reasons = append(reasons, fmt.Sprintf("%d student(s)", studentCount))
		}
		if workingStudentCount > 0 {
			reasons = append(reasons, fmt.Sprintf("%d working student(s)", workingStudentCount))
		}

		return fmt.Errorf("cannot delete department: %s are currently assigned. reassign them first", strings.Join(reasons, ", "))
	}

	result, err := a.db.Exec(`
		UPDATE departments
		SET is_deleted = 1,
			deleted_at = CURRENT_TIMESTAMP,
			is_active = 0,
			is_archived = 1,
			updated_at = CURRENT_TIMESTAMP
		WHERE department_code = ?
		  AND COALESCE(is_deleted, 0) = 0
	`, departmentCode)
	if err != nil {
		log.Printf("Failed to delete department: %v", err)
		return fmt.Errorf("failed to delete department: %w", err)
	}

	if rowsAffected, _ := result.RowsAffected(); rowsAffected == 0 {
		return fmt.Errorf("department not found or already deleted")
	}

	log.Printf("Department soft-deleted successfully: %s", departmentCode)
	return nil
}
