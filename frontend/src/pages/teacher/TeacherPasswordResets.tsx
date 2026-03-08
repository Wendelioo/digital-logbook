import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  GetPendingPasswordResets,
  ApprovePasswordReset,
  RejectPasswordReset,
  GetPasswordResetHistory,
} from '../../../wailsjs/go/backend/App';
import { backend } from '../../../wailsjs/go/models';
import { useAuth } from '../../contexts/AuthContext';

type PasswordResetRequest = backend.PasswordResetRequest;

function TeacherPasswordResets() {
  const { user } = useAuth();

  const [pending, setPending] = useState<PasswordResetRequest[]>([]);
  const [history, setHistory] = useState<PasswordResetRequest[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const loadPending = async () => {
    if (!user?.id) return;
    setLoadingPending(true);
    try {
      const data = await GetPendingPasswordResets(user.id);
      setPending(data || []);
    } catch {
      setPending([]);
    } finally {
      setLoadingPending(false);
    }
  };

  const loadHistory = async () => {
    if (!user?.id) return;
    setLoadingHistory(true);
    try {
      const data = await GetPasswordResetHistory(user.id);
      setHistory(data || []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const refresh = () => {
    loadPending();
    loadHistory();
  };

  useEffect(() => {
    loadPending();
    loadHistory();
    const interval = setInterval(loadPending, 10000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const handleApprove = async (requestId: number) => {
    if (!user?.id) return;
    setResolvingId(requestId);
    try {
      await ApprovePasswordReset(user.id, requestId);
      setPending(prev => prev.filter(r => r.id !== requestId));
      showToast('success', 'Password reset approved. Student can now log in with the new password.');
      loadHistory();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to approve. Please try again.');
    } finally {
      setResolvingId(null);
    }
  };

  const handleReject = async (requestId: number) => {
    if (!user?.id) return;
    setResolvingId(requestId);
    try {
      await RejectPasswordReset(user.id, requestId);
      setPending(prev => prev.filter(r => r.id !== requestId));
      showToast('success', 'Password reset request rejected.');
      loadHistory();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to reject. Please try again.');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Password Reset Requests</h1>
        <button
          onClick={refresh}
          disabled={loadingPending || loadingHistory}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loadingPending ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Pending Requests */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">Pending Requests</h2>
            {pending.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-orange-500 text-white text-xs font-bold">
                {pending.length}
              </span>
            )}
          </div>
          {loadingPending && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" /> Updating…
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm text-gray-500">No pending requests.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {pending.map(req => (
              <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 hover:bg-orange-50/40 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{req.student_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    ID: <span className="font-medium text-gray-700">{req.student_code}</span>
                    {' · '}
                    {req.subject_code}
                    {req.subject_name ? ` — ${req.subject_name}` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Requested {req.requested_at}</p>
                </div>
                <div className="flex gap-2 sm:flex-shrink-0">
                  <button
                    onClick={() => handleApprove(req.id)}
                    disabled={resolvingId === req.id}
                    className="px-4 py-2 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {resolvingId === req.id ? '...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={resolvingId === req.id}
                    className="px-4 py-2 text-xs font-semibold bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">Request History</h2>
            <span className="text-xs text-gray-400">(last 50)</span>
          </div>
          {loadingHistory && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" /> Loading…
            </span>
          )}
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm text-gray-500">No resolved requests yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Requested</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Resolved</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map(req => (
                  <tr key={req.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-3">
                      <p className="font-medium text-gray-900">{req.student_name}</p>
                      <p className="text-xs text-gray-400">{req.student_code}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <p>{req.subject_code}</p>
                      {req.subject_name && (
                        <p className="text-xs text-gray-400 truncate max-w-[180px]">{req.subject_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{req.requested_at}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{req.resolved_at || '—'}</td>
                    <td className="px-4 py-3">
                      {req.status === 'approved' ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Approved</span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Rejected</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default TeacherPasswordResets;
