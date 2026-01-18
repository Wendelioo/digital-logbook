import { useState, useCallback } from 'react';
import {
  GetAllClasses,
  GetTeacherClasses,
  GetTeacherClassesByUserID,
  GetStudentClasses,
  GetClassStudents,
  GetAvailableStudents,
  CreateClass,
  UpdateClass,
  DeleteClass,
  EnrollStudentInClass,
  EnrollMultipleStudents,
  UnenrollStudentFromClass,
  JoinClassBySubjectCode,
} from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';

type CourseClass = main.CourseClass;
type ClassStudent = main.ClassStudent;
type ClasslistEntry = main.ClasslistEntry;

interface LegacyCourseClass {
  class_id: number;
  subject_code: string;
  subject_name?: string;
  offering_code: string;
  teacher_user_id: number;
  teacher_name?: string;
  schedule?: string;
  room?: string;
  year_level?: string;
  section?: string;
  semester?: string;
  school_year?: string;
  is_active: boolean;
  created_at?: string;
}

/**
 * Custom hook for managing class operations.
 * Centralizes class-related API calls and state management.
 * 
 * @example
 * ```tsx
 * const { classes, loading, fetchClasses, createClass } = useClasses();
 * 
 * useEffect(() => {
 *   fetchClasses();
 * }, []);
 * ```
 */
export const useClasses = () => {
  const [classes, setClasses] = useState<main.CourseClass[]>([]);
  const [classStudents, setClassStudents] = useState<main.ClasslistEntry[]>([]);
  const [availableStudents, setAvailableStudents] = useState<main.ClassStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllClasses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await GetAllClasses();
      setClasses(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch classes');
      console.error('Error fetching classes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTeacherClasses = useCallback(async (teacherID: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await GetTeacherClasses(teacherID);
      setClasses(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch teacher classes');
      console.error('Error fetching teacher classes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTeacherClassesByUserID = useCallback(async (userID: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await GetTeacherClassesByUserID(userID);
      setClasses(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch teacher classes');
      console.error('Error fetching teacher classes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStudentClasses = useCallback(async (studentUserID: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await GetStudentClasses(studentUserID);
      setClasses(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch student classes');
      console.error('Error fetching student classes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClassStudents = useCallback(async (classID: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await GetClassStudents(classID);
      setClassStudents(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch class students');
      console.error('Error fetching class students:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAvailableStudents = useCallback(async (classID: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await GetAvailableStudents(classID);
      setAvailableStudents(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch available students');
      console.error('Error fetching available students:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createClass = useCallback(async (
    subjectCode: string,
    teacherUserID: number,
    offeringCode: string,
    schedule: string,
    room: string,
    yearLevel: string,
    section: string,
    semester: string,
    schoolYear: string,
    createdBy: number
  ) => {
    setLoading(true);
    setError(null);
    try {
      const classID = await CreateClass(
        subjectCode,
        teacherUserID,
        offeringCode,
        schedule,
        room,
        yearLevel,
        section,
        semester,
        schoolYear,
        createdBy
      );
      await fetchAllClasses(); // Refresh the list
      return classID;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create class');
      console.error('Error creating class:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchAllClasses]);

  const updateClass = useCallback(async (
    classID: number,
    schedule: string,
    room: string,
    yearLevel: string,
    section: string,
    semester: string,
    schoolYear: string,
    isActive: boolean
  ) => {
    setLoading(true);
    setError(null);
    try {
      await UpdateClass(classID, schedule, room, yearLevel, section, semester, schoolYear, isActive);
      await fetchAllClasses(); // Refresh the list
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update class');
      console.error('Error updating class:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchAllClasses]);

  const deleteClass = useCallback(async (classID: number) => {
    setLoading(true);
    setError(null);
    try {
      await DeleteClass(classID);
      await fetchAllClasses(); // Refresh the list
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete class');
      console.error('Error deleting class:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchAllClasses]);

  const enrollStudent = useCallback(async (
    studentID: number,
    classID: number,
    enrolledBy: number
  ) => {
    setLoading(true);
    setError(null);
    try {
      await EnrollStudentInClass(studentID, classID, enrolledBy);
      await fetchClassStudents(classID); // Refresh the student list
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll student');
      console.error('Error enrolling student:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchClassStudents]);

  const enrollMultipleStudents = useCallback(async (
    studentIDs: number[],
    classID: number,
    enrolledBy: number
  ) => {
    setLoading(true);
    setError(null);
    try {
      await EnrollMultipleStudents(studentIDs, classID, enrolledBy);
      await fetchClassStudents(classID); // Refresh the student list
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll students');
      console.error('Error enrolling students:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchClassStudents]);

  const unenrollStudent = useCallback(async (classlistID: number, classID: number) => {
    setLoading(true);
    setError(null);
    try {
      await UnenrollStudentFromClass(classlistID);
      await fetchClassStudents(classID); // Refresh the student list
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unenroll student');
      console.error('Error unenrolling student:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchClassStudents]);

  const joinClassByCode = useCallback(async (
    studentUserID: number,
    subjectCode: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      const classID = await JoinClassBySubjectCode(studentUserID, subjectCode);
      await fetchStudentClasses(studentUserID); // Refresh the student's classes
      return classID;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join class');
      console.error('Error joining class:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchStudentClasses]);

  return {
    classes,
    classStudents,
    availableStudents,
    loading,
    error,
    fetchAllClasses,
    fetchTeacherClasses,
    fetchTeacherClassesByUserID,
    fetchStudentClasses,
    fetchClassStudents,
    fetchAvailableStudents,
    createClass,
    updateClass,
    deleteClass,
    enrollStudent,
    enrollMultipleStudents,
    unenrollStudent,
    joinClassByCode,
  };
};
