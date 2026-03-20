import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CheckCircle, XCircle, User, Mail, Phone, Calendar, History, Search, Filter, X, ChevronDown } from 'lucide-react';
import { GetPendingRegistrations, ProcessRegistration, GetRegistrationHistory } from '../../wailsjs/go/backend/App';
import Button from '../components/Button';
import { Card } from '../components/Card';
import LoadingDots from '../components/LoadingDots';
import Modal from '../components/Modal';
import { backend } from '../../wailsjs/go/models';

type PendingRegistration = backend.PendingRegistration;
type RegistrationHistoryEntry = backend.RegistrationHistoryEntry;

interface PendingRegistrationsProps {
  workingStudentUserId: number;
}

const PendingRegistrations: React.FC<PendingRegistrationsProps> = ({ workingStudentUserId }) => {
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [history, setHistory] = useState<RegistrationHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [historyTimeFilter, setHistoryTimeFilter] = useState<'all' | 'today' | 'this_week' | 'date'>('all');
  const [historyDate, setHistoryDate] = useState(''); // YYYY-MM-DD when historyTimeFilter === 'date'
  const [showHistoryFilterPanel, setShowHistoryFilterPanel] = useState(false);
  const historyFilterPanelRef = useRef<HTMLDivElement>(null);
  // Pending filter values (only applied when user clicks Apply)
  const [pendingHistoryStatusFilter, setPendingHistoryStatusFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [pendingHistoryTimeFilter, setPendingHistoryTimeFilter] = useState<'all' | 'today' | 'this_week' | 'date'>('all');
  const [pendingHistoryDate, setPendingHistoryDate] = useState('');

  useEffect(() => {
    loadRegistrations();
    loadHistory();
  }, []);

  const loadRegistrations = async () => {
    try {
      setLoading(true);
      const data = await GetPendingRegistrations();
      setRegistrations(data || []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load pending registrations');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const data = await GetRegistrationHistory();
      setHistory(data || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredHistory = useMemo(() => {
    let list = history;

    // Status filter
    if (historyStatusFilter !== 'all') {
      list = list.filter((e) => e.status === historyStatusFilter);
    }

    // Time filter (use processed_at when available, else submitted_at)
    if (historyTimeFilter !== 'all') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      list = list.filter((e) => {
        const dateStr = e.processed_at || e.submitted_at;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (historyTimeFilter === 'today') {
          return d >= todayStart && d <= todayEnd;
        }
        if (historyTimeFilter === 'this_week') {
          return d >= weekAgo;
        }
        if (historyTimeFilter === 'date' && historyDate) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}` === historyDate;
        }
        return true;
      });
    }

    // Search by name
    if (historySearch.trim()) {
      const q = historySearch.trim().toLowerCase();
      list = list.filter(
        (e) =>
          (e.first_name && e.first_name.toLowerCase().includes(q)) ||
          (e.last_name && e.last_name.toLowerCase().includes(q)) ||
          (e.middle_name && e.middle_name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [history, historyStatusFilter, historyTimeFilter, historyDate, historySearch]);

  // Number badge: 1 or 2 when one or both filter types are applied (status and/or time)
  const historyActiveFilterCount = [
    historyStatusFilter !== 'all',
    historyTimeFilter !== 'all',
  ].filter(Boolean).length;

  useEffect(() => {
    if (!showHistoryFilterPanel) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (historyFilterPanelRef.current && !historyFilterPanelRef.current.contains(e.target as Node)) {
        setShowHistoryFilterPanel(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showHistoryFilterPanel]);

  const handleApprove = async (userId: number) => {
    try {
      setProcessing(userId);
      setError('');
      await ProcessRegistration({
        user_id: userId,
        approved_by: workingStudentUserId,
        action: 'approve',
        rejection_reason: '',
      });
      await loadRegistrations();
      await loadHistory();
    } catch (err: any) {
      setError(err.message || 'Failed to approve registration');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!selectedUserId || !rejectionReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }

    try {
      setProcessing(selectedUserId);
      setError('');
      await ProcessRegistration({
        user_id: selectedUserId,
        approved_by: workingStudentUserId,
        action: 'reject',
        rejection_reason: rejectionReason,
      });
      await loadRegistrations();
      await loadHistory();
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedUserId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to reject registration');
    } finally {
      setProcessing(null);
    }
  };

  const openRejectModal = (userId: number) => {
    setSelectedUserId(userId);
    setShowRejectModal(true);
    setRejectionReason('');
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setShowHistoryFilterPanel(false);
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <LoadingDots className="gap-3" dotClassName="h-3 w-3" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Registration Requests</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowHistoryModal(true)}
            variant="outline"
            size="sm"
            icon={<History className="h-4 w-4" />}
            title="View registration history"
          >
            History
          </Button>
          <button
            onClick={() => { loadRegistrations(); loadHistory(); }}
            className="px-4 py-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {registrations.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500">No Pending Registrations</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {registrations.map((reg) => (
            <Card key={reg.user_id} className="hover:shadow-lg transition-shadow">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">
                        {reg.last_name}, {reg.first_name} {reg.middle_name || ''}
                      </h3>
                      <p className="text-sm text-gray-500">Student ID: {reg.student_id}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span>{reg.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span>{reg.contact_number}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span>Submitted: {new Date(reg.submitted_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    onClick={() => handleApprove(reg.user_id)}
                    disabled={processing === reg.user_id}
                    variant="primary"
                    size="md"
                    className="w-full sm:w-32"
                    icon={<CheckCircle />}
                  >
                    {processing === reg.user_id ? 'Approving...' : 'Approve'}
                  </Button>
                  <Button
                    onClick={() => openRejectModal(reg.user_id)}
                    disabled={processing === reg.user_id}
                    variant="danger"
                    size="md"
                    className="w-full sm:w-32"
                    icon={<XCircle />}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={showHistoryModal}
        onClose={closeHistoryModal}
        title="Registration History"
        size="xl"
        showVariantIcon={false}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-600">
              Review all approved and rejected registration requests.
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-64 max-w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {historySearch && (
                  <Button
                    onClick={() => setHistorySearch('')}
                    variant="secondary"
                    size="sm"
                    icon={<X className="h-5 w-5" />}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 !p-0"
                  />
                )}
              </div>

              <div className="relative" ref={historyFilterPanelRef}>
                <button
                  type="button"
                  onClick={() => {
                    const nextOpen = !showHistoryFilterPanel;
                    if (nextOpen) {
                      setPendingHistoryStatusFilter(historyStatusFilter);
                      setPendingHistoryTimeFilter(historyTimeFilter);
                      setPendingHistoryDate(historyDate);
                    }
                    setShowHistoryFilterPanel(nextOpen);
                  }}
                  className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    showHistoryFilterPanel || historyActiveFilterCount > 0
                      ? 'bg-primary-50 border-primary-400 text-primary-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                  title="Filter registration history"
                >
                  <Filter className="h-4 w-4" />
                  <span>Filter</span>
                  {historyActiveFilterCount > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-primary-500 text-white rounded-full text-xs font-semibold">
                      {historyActiveFilterCount}
                    </span>
                  )}
                </button>
                {showHistoryFilterPanel && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden">
                    <div className="p-4 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                        <div className="relative">
                          <select
                            value={pendingHistoryStatusFilter}
                            onChange={(e) => setPendingHistoryStatusFilter(e.target.value as 'all' | 'approved' | 'rejected')}
                            className="w-full py-2 pl-3 pr-9 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-white text-gray-800"
                          >
                            <option value="all">All status</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                            <ChevronDown className="h-4 w-4" />
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
                        <div className="relative">
                          <select
                            value={pendingHistoryTimeFilter}
                            onChange={(e) => {
                              const v = e.target.value as 'all' | 'today' | 'this_week' | 'date';
                              setPendingHistoryTimeFilter(v);
                              if (v !== 'date') setPendingHistoryDate('');
                            }}
                            className="w-full py-2 pl-3 pr-9 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-white text-gray-800"
                          >
                            <option value="all">All time</option>
                            <option value="today">Today</option>
                            <option value="this_week">This week</option>
                            <option value="date">On date</option>
                          </select>
                          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                            <ChevronDown className="h-4 w-4" />
                          </span>
                        </div>
                      </div>
                      {pendingHistoryTimeFilter === 'date' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                          <div className="relative">
                            <input
                              type="date"
                              value={pendingHistoryDate}
                              onChange={(e) => setPendingHistoryDate(e.target.value)}
                              className="w-full py-2 pl-3 pr-9 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-white text-gray-800"
                            />
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                              <ChevronDown className="h-4 w-4" />
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPendingHistoryStatusFilter('all');
                            setPendingHistoryTimeFilter('all');
                            setPendingHistoryDate('');
                            setHistoryStatusFilter('all');
                            setHistoryTimeFilter('all');
                            setHistoryDate('');
                            setShowHistoryFilterPanel(false);
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setHistoryStatusFilter(pendingHistoryStatusFilter);
                            setHistoryTimeFilter(pendingHistoryTimeFilter);
                            setHistoryDate(pendingHistoryDate);
                            setShowHistoryFilterPanel(false);
                          }}
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
          </div>

          {historyLoading ? (
            <div className="flex justify-center py-12">
              <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500 text-sm border border-gray-100 rounded-lg">
              No registration history found.
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-100 rounded-lg">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Full Name
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submitted
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredHistory.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {entry.last_name}, {entry.first_name} {entry.middle_name || ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {entry.submitted_at ? new Date(entry.submitted_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            entry.status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {entry.status === 'approved' ? 'Approved' : 'Rejected'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Reject Registration</h3>
            <p className="text-gray-600 mb-4">Please provide a reason for rejecting this registration:</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Invalid student ID, missing verification documents..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              rows={4}
            />
            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setSelectedUserId(null);
                }}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReject}
                variant="danger"
                className="flex-1"
                disabled={!rejectionReason.trim() || processing !== null}
              >
                {processing ? 'Rejecting...' : 'Confirm Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingRegistrations;
