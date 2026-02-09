package main

import (
	"database/sql"
	"fmt"
	"log"
	"time"
)

// ==============================================================================
// DEPARTMENT MANAGEMENT METHODS
// ==============================================================================

// Department represents a department
type Department struct {
	DepartmentCode string  `json:"department_code"`
	DepartmentName string  `json:"department_name"`
	Description    *string `json:"description,omitempty"`
	IsActive       bool    `json:"is_active"`
	CreatedAt      string  `json:"created_at"`
	UpdatedAt      string  `json:"updated_at"`
}

// GetDepartments returns all departments
func (a *App) GetDepartments() ([]Department, error) {
	if err := a.checkDB(); err != nil {
		return nil, err
	}

	rows, err := a.db.Query(`
		SELECT department_code, department_name, description, is_active, created_at, updated_at
		FROM departments
		ORDER BY department_code
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var departments []Department
	for rows.Next() {
		var dept Department
		var description sql.NullString
		var createdAt, updatedAt time.Time

		if err := rows.Scan(&dept.DepartmentCode, &dept.DepartmentName, &description, &dept.IsActive, &createdAt, &updatedAt); err != nil {
			continue
		}

		dept.Description = scanNullString(description)
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

	if _, err := a.db.Exec(
		`INSERT INTO departments (department_code, department_name, description) VALUES (?, ?, ?)`,
		departmentCode, departmentName, nullString(description),
	); err != nil {
		log.Printf("Failed to create department: %v", err)
		return fmt.Errorf("failed to create department: %w", err)
	}

	log.Printf("Department created successfully: %s", departmentCode)
	return nil
}

// UpdateDepartment updates an existing department
func (a *App) UpdateDepartment(oldDepartmentCode, departmentCode, departmentName, description string, isActive bool) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	if _, err := a.db.Exec(
		`UPDATE departments SET department_code = ?, department_name = ?, description = ?, is_active = ? WHERE department_code = ?`,
		departmentCode, departmentName, nullString(description), isActive, oldDepartmentCode,
	); err != nil {
		log.Printf("Failed to update department: %v", err)
		return fmt.Errorf("failed to update department: %w", err)
	}

	log.Printf("Department updated successfully: %s -> %s", oldDepartmentCode, departmentCode)
	return nil
}

// DeleteDepartment deletes a department
func (a *App) DeleteDepartment(departmentCode string) error {
	if err := a.checkDB(); err != nil {
		return err
	}

	// Check if department is in use
	var count int
	if err := a.db.QueryRow(`SELECT COUNT(*) FROM teachers WHERE department_code = ?`, departmentCode).Scan(&count); err != nil {
		return fmt.Errorf("failed to check department usage: %w", err)
	}

	if count > 0 {
		return fmt.Errorf("cannot delete department: %d teacher(s) are assigned to this department", count)
	}

	result, err := a.db.Exec(`DELETE FROM departments WHERE department_code = ?`, departmentCode)
	if err != nil {
		log.Printf("Failed to delete department: %v", err)
		return fmt.Errorf("failed to delete department: %w", err)
	}

	if rowsAffected, _ := result.RowsAffected(); rowsAffected == 0 {
		return fmt.Errorf("department not found: %s", departmentCode)
	}

	log.Printf("Department deleted successfully: %s", departmentCode)
	return nil
}
