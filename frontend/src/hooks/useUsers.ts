import { useState, useEffect, useCallback } from 'react';
import {
  GetUsers,
  GetUsersByType,
  SearchUsers,
  CreateUser,
  UpdateUser,
  DeleteUser,
} from '../../wailsjs/go/main/App';

interface User {
  id: number;
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
  photo_url?: string;
  email?: string;
  contact_number?: string;
  department_code?: string;
  created: string;
}

/**
 * Custom hook for managing user data and operations.
 * Centralizes user-related API calls and state management.
 * 
 * @example
 * ```tsx
 * const { users, loading, error, fetchUsers, createUser } = useUsers();
 * 
 * useEffect(() => {
 *   fetchUsers();
 * }, []);
 * ```
 */
export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await GetUsers();
      setUsers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsersByType = useCallback(async (userType: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await GetUsersByType(userType);
      setUsers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users by type');
      console.error('Error fetching users by type:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchUsers = useCallback(async (searchTerm: string, userType: string = '') => {
    setLoading(true);
    setError(null);
    try {
      const data = await SearchUsers(searchTerm, userType);
      setUsers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search users');
      console.error('Error searching users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createUser = useCallback(async (
    password: string,
    name: string,
    firstName: string,
    middleName: string,
    lastName: string,
    gender: string,
    role: string,
    employeeID: string,
    studentID: string,
    year: string,
    section: string,
    email: string,
    contactNumber: string,
    departmentCode: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      await CreateUser(
        password, name, firstName, middleName, lastName, gender, role,
        employeeID, studentID, year, section, email, contactNumber, departmentCode
      );
      await fetchUsers(); // Refresh the list
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
      console.error('Error creating user:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  const updateUser = useCallback(async (
    id: number,
    name: string,
    firstName: string,
    middleName: string,
    lastName: string,
    gender: string,
    role: string,
    employeeID: string,
    studentID: string,
    year: string,
    section: string,
    email: string,
    contactNumber: string,
    departmentCode: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      await UpdateUser(
        id, name, firstName, middleName, lastName, gender, role,
        employeeID, studentID, year, section, email, contactNumber, departmentCode
      );
      await fetchUsers(); // Refresh the list
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
      console.error('Error updating user:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  const deleteUser = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await DeleteUser(id);
      await fetchUsers(); // Refresh the list
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
      console.error('Error deleting user:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    fetchUsers,
    fetchUsersByType,
    searchUsers,
    createUser,
    updateUser,
    deleteUser,
  };
};
