import { useState, useEffect } from 'react';
import { RefreshCw, Search, Filter, X, History } from 'lucide-react';
import {
  GetPendingPasswordResets,
  ApprovePasswordReset,
  RejectPasswordReset,
  GetPasswordResetHistory,
} from '../../../wailsjs/go/backend/App';
import { backend } from '../../../wailsjs/go/models';
import { useAuth } from '../../contexts/AuthContext';
import Modal, { MODAL_BODY_MIN_HEIGHT_CLASS } from '../../components/Modal';
import LoadingDots from '../../components/LoadingDots';

type PasswordResetRequest = backend.PasswordResetRequest;

function TeacherPasswordResets() {
  const { user } = useAuth();

  const [pending, setPending] = useState<PasswordResetRequest[]>([]);
  const [history, setHistory] = useState<PasswordResetRequest[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [showHistoryFilters, setShowHistoryFilters] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

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

  const filteredHistory = history.filter((req) => {
    // Status filter
    if (historyStatusFilter !== 'all' && req.status !== historyStatusFilter) {
      return false;
    }

    // Date filter (by requested_at date portion)
    if (historyDateFrom || historyDateTo) {
      const raw = req.requested_at || '';
      const dateOnly = raw.split(/[T\s]/)[0];
      if (historyDateFrom && dateOnly < historyDateFrom) return false;
      if (historyDateTo && dateOnly > historyDateTo) return false;
    }

    // Text search
    if (historySearch) {
      const q = historySearch.toLowerCase();
      const inStudent =
        (req.student_name || '').toLowerCase().includes(q) ||
        (req.student_code || '').toLowerCase().includes(q);
      const inSubject =
        (req.subject_code || '').toLowerCase().includes(q) ||
        (req.subject_name || '').toLowerCase().includes(q);
      if (!inStudent && !inSubject) return false;
    }

    return true;
  });

  const activeHistoryFilterCount =
    (historyDateFrom || historyDateTo ? 1 : 0) +
    (historyStatusFilter !== 'all' ? 1 : 0);

  const openHistoryModal = () => {
    setShowHistoryModal(true);
    loadHistory();
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setShowHistoryFilters(false);
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openHistoryModal}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Request history"
            aria-label="Open request history"
          >
            <History className="h-4 w-4" />
            History
          </button>
          <button
            onClick={refresh}
            disabled={loadingPending || loadingHistory}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {loadingPending ? <LoadingDots dotClassName="h-2.5 w-2.5" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
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
              <LoadingDots dotClassName="h-2 w-2" /> Updating...
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

      <Modal
        isOpen={showHistoryModal}
        onClose={closeHistoryModal}
        title="Password Reset Request History"
        size="xl"
        showVariantIcon={false}
        contentMinHeightClassName={MODAL_BODY_MIN_HEIGHT_CLASS}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Resolved Requests</span>
              <span className="text-xs text-gray-400">(last 50)</span>
            </div>
            {loadingHistory && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <LoadingDots dotClassName="h-2 w-2" /> Loading...
              </span>
            )}
          </div>

          {history.length > 0 && (
            <div className="flex items-center justify-end gap-3 flex-wrap">
              <div className="relative w-72 max-w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search student or subject..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => setHistorySearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowHistoryFilters(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                    showHistoryFilters || activeHistoryFilterCount > 0
                      ? 'bg-primary-50 border-primary-500 text-primary-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="h-4 w-4" />
                  <span>Filter</span>
                  {activeHistoryFilterCount > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-500 text-white text-xs font-bold">
                      {activeHistoryFilterCount}
                    </span>
                  )}
                </button>

                {showHistoryFilters && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-800">Filters</span>
                        {activeHistoryFilterCount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setHistoryDateFrom('');
                              setHistoryDateTo('');
                              setHistoryStatusFilter('all');
                            }}
                            className="text-xs text-primary-600 hover:underline"
                          >
                            Clear all
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Requested Date</label>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1 min-w-0">
                            <input
                              type="date"
                              value={historyDateFrom}
                              onChange={(e) => setHistoryDateFrom(e.target.value)}
                              className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-500 shrink-0">to</span>
                          <div className="relative flex-1 min-w-0">
                            <input
                              type="date"
                              value={historyDateTo}
                              onChange={(e) => setHistoryDateTo(e.target.value)}
                              className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                        <div className="relative">
                          <select
                            value={historyStatusFilter}
                            onChange={(e) => setHistoryStatusFilter(e.target.value as 'all' | 'approved' | 'rejected')}
                            className="w-full border border-gray-300 rounded-lg pl-3 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-white"
                          >
                            <option value="all">All</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowHistoryFilters(false)}
                          className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 border border-primary-600 rounded-lg hover:bg-primary-700"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-gray-500">No resolved requests yet.</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-gray-500">No history results match your current filters.</p>
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
                  {filteredHistory.map(req => (
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
      </Modal>
    </div>
  );
}

export default TeacherPasswordResets;
