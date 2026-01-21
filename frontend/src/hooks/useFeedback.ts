import { useState, useCallback } from 'react';
import {
  GetFeedback,
  GetStudentFeedback,
  GetPendingFeedback,
  SaveEquipmentFeedback,
  ForwardFeedbackToAdmin,
  ForwardMultipleFeedbackToAdmin,
  ExportFeedbackCSV,
  ExportFeedbackPDF,
} from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';

type Feedback = main.Feedback;

/**
 * Custom hook for managing equipment feedback operations.
 * Centralizes feedback-related API calls and state management.
 * 
 * @example
 * ```tsx
 * const { feedback, loading, fetchFeedback, submitFeedback } = useFeedback();
 * 
 * useEffect(() => {
 *   fetchFeedback();
 * }, []);
 * ```
 */
export const useFeedback = () => {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [pendingFeedback, setPendingFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await GetFeedback();
      setFeedback(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch feedback');
      console.error('Error fetching feedback:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStudentFeedback = useCallback(async (studentID: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await GetStudentFeedback(studentID);
      setFeedback(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch student feedback');
      console.error('Error fetching student feedback:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPendingFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await GetPendingFeedback();
      setPendingFeedback(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pending feedback');
      console.error('Error fetching pending feedback:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const submitFeedback = useCallback(async (
    userID: number,
    userName: string,
    computerStatus: string,
    computerIssue: string,
    mouseStatus: string,
    mouseIssue: string,
    keyboardStatus: string,
    keyboardIssue: string,
    monitorStatus: string,
    monitorIssue: string,
    additionalComments: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      await SaveEquipmentFeedback(
        userID,
        userName,
        computerStatus,
        computerIssue,
        mouseStatus,
        mouseIssue,
        keyboardStatus,
        keyboardIssue,
        monitorStatus,
        monitorIssue,
        additionalComments
      );
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
      console.error('Error submitting feedback:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const forwardToAdmin = useCallback(async (
    feedbackID: number,
    workingStudentID: number,
    notes: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      await ForwardFeedbackToAdmin(feedbackID, workingStudentID, notes);
      await fetchPendingFeedback(); // Refresh the list
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to forward feedback');
      console.error('Error forwarding feedback:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchPendingFeedback]);

  const forwardMultipleToAdmin = useCallback(async (
    feedbackIDs: number[],
    workingStudentID: number,
    notes: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      const count = await ForwardMultipleFeedbackToAdmin(feedbackIDs, workingStudentID, notes);
      await fetchPendingFeedback(); // Refresh the list
      return count;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to forward multiple feedback');
      console.error('Error forwarding multiple feedback:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchPendingFeedback]);

  const exportFeedbackCSV = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filePath = await ExportFeedbackCSV();
      return filePath;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export feedback CSV');
      console.error('Error exporting feedback CSV:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const exportFeedbackPDF = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filePath = await ExportFeedbackPDF();
      return filePath;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export feedback PDF');
      console.error('Error exporting feedback PDF:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    feedback,
    pendingFeedback,
    loading,
    error,
    fetchFeedback,
    fetchStudentFeedback,
    fetchPendingFeedback,
    submitFeedback,
    forwardToAdmin,
    forwardMultipleToAdmin,
    exportFeedbackCSV,
    exportFeedbackPDF,
  };
};
