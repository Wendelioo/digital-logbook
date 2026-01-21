import { useState, useCallback } from 'react';
import {
  GetClassAttendance,
  GetStudentLoginLogs,
  RecordAttendance,
  UpdateAttendanceTime,
  UpdateAttendanceRecord,
  InitializeAttendanceForClass,
  ExportAttendanceCSV,
} from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';

type Attendance = main.Attendance;
type LoginLog = main.LoginLog;

interface LegacyLoginLog {
  id: number;
  user_id: number;
  user_name: string;
  user_id_number: string;
  user_type: string;
  pc_number?: string;
  login_time: string;
  logout_time?: string;
}

/**
 * Custom hook for managing attendance operations.
 * Centralizes attendance-related API calls and state management.
 * 
 * @example
 * ```tsx
 * const { attendance, loading, fetchAttendance, recordAttendance } = useAttendance();
 * 
 * useEffect(() => {
 *   fetchAttendance(classId, date);
 * }, [classId, date]);
 * ```
 */
export const useAttendance = () => {
  const [attendance, setAttendance] = useState<main.Attendance[]>([]);
  const [loginLogs, setLoginLogs] = useState<main.LoginLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendance = useCallback(async (classId: number, date: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await GetClassAttendance(classId, date);
      setAttendance(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch attendance');
      console.error('Error fetching attendance:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStudentLogs = useCallback(async (userID: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await GetStudentLoginLogs(userID);
      setLoginLogs(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch student logs');
      console.error('Error fetching student logs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const recordAttendance = useCallback(async (
    classID: number,
    studentID: number,
    timeIn: string,
    timeOut: string,
    status: string,
    remarks: string,
    recordedBy: number
  ) => {
    setLoading(true);
    setError(null);
    try {
      await RecordAttendance(classID, studentID, timeIn, timeOut, status, remarks, recordedBy);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record attendance');
      console.error('Error recording attendance:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateAttendanceTime = useCallback(async (
    classID: number,
    studentUserID: number,
    date: string,
    timeIn: string,
    timeOut: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      await UpdateAttendanceTime(classID, studentUserID, date, timeIn, timeOut);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update attendance time');
      console.error('Error updating attendance time:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateAttendanceRecord = useCallback(async (
    classID: number,
    studentUserID: number,
    date: string,
    timeIn: string,
    timeOut: string,
    pcNumber: string,
    status: string,
    remarks: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      await UpdateAttendanceRecord(classID, studentUserID, date, timeIn, timeOut, pcNumber, status, remarks);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update attendance record');
      console.error('Error updating attendance record:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const initializeAttendance = useCallback(async (
    classID: number,
    date: string,
    recordedBy: number
  ) => {
    setLoading(true);
    setError(null);
    try {
      await InitializeAttendanceForClass(classID, date, recordedBy);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize attendance');
      console.error('Error initializing attendance:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const exportAttendanceCSV = useCallback(async (classID: number) => {
    setLoading(true);
    setError(null);
    try {
      const filePath = await ExportAttendanceCSV(classID);
      return filePath;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export attendance');
      console.error('Error exporting attendance:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    attendance,
    loginLogs,
    loading,
    error,
    fetchAttendance,
    fetchStudentLogs,
    recordAttendance,
    updateAttendanceTime,
    updateAttendanceRecord,
    initializeAttendance,
    exportAttendanceCSV,
  };
};
