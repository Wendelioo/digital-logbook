import { useEffect, useState, useRef, useCallback } from 'react';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import { CheckCircle2, History, Filter, X, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { GetStudentOpenAttendanceSessions, StudentTimeIn, GetStudentAttendanceHistory } from '../../../wailsjs/go/backend/App';
import LoadingDots from '../../components/LoadingDots';

interface AttendanceSession {
  session_id: number;
  class_id: number;
  attendance_date: string;
  session_name: string;
  status: string;
  class_duration_minutes?: number;
  grace_period_minutes?: number;
  opened_at?: string;
  paused_at?: string;
  subject_code: string;
  subject_name: string;
  edp_code: string;
}

interface AttendanceHistoryRecord {
  class_id: number;
  subject_code: string;
  subject_name: string;
  section: string;
  date: string;
  session_name?: string;
  status: string;
  time_in?: string;
}

function StudentAttendance() {
  const { user } = useAuth();
  const SESSION_POLL_INTERVAL_MS = 8000;
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [timingInSession, setTimingInSession] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());
  const previousSessionCountRef = useRef<number | null>(null);

  const [history, setHistory] = useState<AttendanceHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [classFilter, setClassFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showHistoryFilters, setShowHistoryFilters] = useState(false);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [pendingClassFilter, setPendingClassFilter] = useState<string>('all');
  const [pendingStatusFilter, setPendingStatusFilter] = useState<string>('all');
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const parseSessionDateTime = (value?: string): Date | null => {
    if (!value) return null;
    const parsed = new Date(value.replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatRemaining = (seconds: number): string => {
    if (seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getExpectedTimeInStatus = (session?: AttendanceSession, referenceTimeMs?: number): 'present' | 'late' => {
    const openedAt = parseSessionDateTime(session?.opened_at);
    if (!openedAt) return 'present';

    const graceMinutes = Math.max(0, session?.grace_period_minutes || 0);
    const lateCutoff = openedAt.getTime() + graceMinutes * 60 * 1000;
    const nowMs = referenceTimeMs ?? Date.now();
    return nowMs >= lateCutoff ? 'late' : 'present';
  };

  const loadSessions = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    if (!user?.id) {
      if (showLoading) setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    try {
      const data = await GetStudentOpenAttendanceSessions(user.id);
      const nextSessions = data || [];
      setSessions(nextSessions);

      const nextCount = nextSessions.length;
      const previousCount = previousSessionCountRef.current;
      if (previousCount !== null && nextCount !== previousCount) {
        if (nextCount > previousCount) {
          setNotice({ type: 'success', text: `${nextCount} attendance session(s) are open for your classes.` });
        } else {
          setNotice({ type: 'success', text: 'One or more attendance sessions have closed.' });
        }
      }
      previousSessionCountRef.current = nextCount;
    } catch (error) {
      console.error('Failed to load attendance sessions:', error);
      setNotice({ type: 'error', text: 'Unable to load attendance sessions.' });
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [user?.id]);

  const loadHistory = useCallback(async () => {
    if (!user?.id) { setHistoryLoading(false); return; }
    setHistoryLoading(true);
    try {
      const data = await GetStudentAttendanceHistory(user.id);
      setHistory(data || []);
    } catch (error) {
      console.error('Failed to load attendance history:', error);
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadSessions({ showLoading: true });
    loadHistory();
    const refreshInterval = setInterval(() => {
      loadSessions({ showLoading: false });
    }, SESSION_POLL_INTERVAL_MS);
    return () => clearInterval(refreshInterval);
  }, [loadSessions, loadHistory]);

  useEffect(() => {
    const ticker = window.setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => window.clearInterval(ticker);
  }, []);

  const handleTimeIn = async (sessionId: number) => {
    if (!user?.id) return;

    const targetSession = sessions.find((session) => session.session_id === sessionId);
    const expectedStatus = getExpectedTimeInStatus(targetSession);

    setTimingInSession(sessionId);
    setNotice(null);

    try {
      await StudentTimeIn(sessionId, user.id);
      setNotice({
        type: 'success',
        text: expectedStatus === 'late' ? 'Time In recorded successfully as Late.' : 'Time In recorded successfully as Present.',
      });
      await Promise.all([loadSessions(), loadHistory()]);
    } catch (error: any) {
      console.error('Failed to time in:', error);
      setNotice({ type: 'error', text: error?.message || 'Failed to submit attendance.' });
    } finally {
      setTimingInSession(null);
    }
  };

  // Unique classes for filter dropdown
  const uniqueClasses = Array.from(
    new Map(history.map(r => [`${r.class_id}`, { class_id: r.class_id, label: `${r.subject_code} - ${r.subject_name}${r.section ? ` (${r.section})` : ''}` }])).values()
  );

  const filteredHistory = history.filter(r => {
    const matchClass = classFilter === 'all' || String(r.class_id) === classFilter;
    const matchStatus = statusFilter === 'all' || r.status.toLowerCase() === statusFilter;
    const q = historySearch.toLowerCase();
    const matchSearch = !q ||
      r.subject_code.toLowerCase().includes(q) ||
      r.subject_name.toLowerCase().includes(q) ||
      (r.section && r.section.toLowerCase().includes(q)) ||
      r.date.includes(q) ||
      r.status.toLowerCase().includes(q);
    return matchClass && matchStatus && matchSearch;
  });

  const presentCount = history.filter(r => r.status.toLowerCase() === 'present').length;
  const lateCount = history.filter(r => r.status.toLowerCase() === 'late').length;
  const absentCount = history.filter(r => r.status.toLowerCase() === 'absent').length;

  const statusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'present') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Present</span>;
    if (s === 'late') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">Late</span>;
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Absent</span>;
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setShowHistoryFilters(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Attendance</h2>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowHistoryModal(true)}
            variant="outline"
            size="sm"
            icon={<History className="h-4 w-4" />}
          >
            History
          </Button>
          <Button onClick={() => { loadSessions({ showLoading: true }); loadHistory(); }} variant="outline" size="sm">Refresh</Button>
        </div>
      </div>

      {notice && (
        <div className={`px-3 py-2 rounded-md text-sm border ${notice.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {notice.text}
        </div>
      )}

      {/* Open Sessions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Open Sessions</h3>
        {sessions.length > 0 ? (
          <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
            {sessions.map((session) => (
              <div key={session.session_id} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{session.subject_code} - {session.subject_name}</p>
                  <p className="text-xs text-gray-500">{session.session_name || 'Attendance Session'} - EDP: {session.edp_code || '-'}</p>
                  {session.paused_at && (
                    <p className="text-[11px] text-amber-700 mt-1">Session is paused by your teacher. Time In is temporarily disabled.</p>
                  )}
                  {(() => {
                    const openedAt = parseSessionDateTime(session.opened_at);
                    const pausedAt = parseSessionDateTime(session.paused_at);
                    if (!openedAt) return null;

                    const effectiveNow = pausedAt ? pausedAt.getTime() : nowTimestamp;
                    const classMinutes = Math.max(0, session.class_duration_minutes || 0);
                    const graceMinutes = Math.max(0, session.grace_period_minutes || 0);
                    const classDeadline = new Date(openedAt.getTime() + classMinutes * 60 * 1000);
                    const graceDeadline = new Date(openedAt.getTime() + graceMinutes * 60 * 1000);
                    const classRemaining = Math.max(0, Math.floor((classDeadline.getTime() - effectiveNow) / 1000));
                    const graceRemaining = Math.max(0, Math.floor((graceDeadline.getTime() - effectiveNow) / 1000));
                    const expectedStatus = getExpectedTimeInStatus(session, effectiveNow);

                    const statusMessage =
                      classRemaining <= 0
                        ? 'Class session window has ended. If you did not time in, you will be marked Absent.'
                        : graceRemaining > 0
                          ? 'Time in while the grace timer is running to be marked Present.'
                          : 'Grace period is over. Time in now will be recorded as Late.';

                    return (
                      <div className="space-y-0.5 mt-1">
                        <p className="text-[11px] text-gray-500">
                          Class remaining: {formatRemaining(classRemaining)} - Grace remaining: {formatRemaining(graceRemaining)}
                        </p>
                        <p className={`text-[11px] ${
                          expectedStatus === 'late' && graceRemaining <= 0 && classRemaining > 0
                            ? 'text-yellow-700'
                            : classRemaining <= 0
                              ? 'text-red-700'
                              : 'text-green-700'
                        }`}>
                          {statusMessage}
                        </p>
                      </div>
                    );
                  })()}
                </div>
                <Button
                  onClick={() => handleTimeIn(session.session_id)}
                  variant="primary"
                  size="sm"
                  disabled={timingInSession === session.session_id || !!session.paused_at}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                >
                  {timingInSession === session.session_id
                    ? 'Submitting...'
                    : session.paused_at
                      ? 'Paused'
                      : 'Time In'}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg p-6 text-center">
            <p className="text-sm text-gray-500">No open attendance sessions right now.</p>
          </div>
        )}
      </div>

      <Modal
        isOpen={showHistoryModal}
        onClose={closeHistoryModal}
        title="Attendance History"
        size="xl"
        showVariantIcon={false}
      >
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-600">Review your attendance records with filters and search.</div>

            {history.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="relative w-56 max-w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search subject, date..."
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {historySearch && (
                    <button
                      onClick={() => setHistorySearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() => {
                      const nextOpen = !showHistoryFilters;
                      if (nextOpen) {
                        setPendingClassFilter(classFilter);
                        setPendingStatusFilter(statusFilter);
                      }
                      setShowHistoryFilters(nextOpen);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                      showHistoryFilters || classFilter !== 'all' || statusFilter !== 'all'
                        ? 'bg-primary-50 border-primary-500 text-primary-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Filter className="h-4 w-4" />
                    <span>Filter</span>
                    {(classFilter !== 'all' || statusFilter !== 'all') && (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-500 text-white text-xs font-bold">
                        {[classFilter !== 'all', statusFilter !== 'all'].filter(Boolean).length}
                      </span>
                    )}
                  </button>

                  {showHistoryFilters && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-800">Filters</span>
                        {(classFilter !== 'all' || statusFilter !== 'all') && (
                          <button
                            onClick={() => { setClassFilter('all'); setStatusFilter('all'); }}
                            className="text-xs text-primary-600 hover:underline"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
                        <div className="flex items-center gap-2">
                          <select
                            value={pendingClassFilter}
                            onChange={e => setPendingClassFilter(e.target.value)}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="all">All Classes</option>
                            {uniqueClasses.map(c => (
                              <option key={c.class_id} value={String(c.class_id)}>{c.label}</option>
                            ))}
                          </select>
                          {pendingClassFilter !== 'all' && (
                            <button onClick={() => setPendingClassFilter('all')} className="text-gray-400 hover:text-gray-600">
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                        <div className="flex items-center gap-2">
                          <select
                            value={pendingStatusFilter}
                            onChange={e => setPendingStatusFilter(e.target.value)}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="all">All Statuses</option>
                            <option value="present">Present</option>
                            <option value="late">Late</option>
                            <option value="absent">Absent</option>
                          </select>
                          {pendingStatusFilter !== 'all' && (
                            <button onClick={() => setPendingStatusFilter('all')} className="text-gray-400 hover:text-gray-600">
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPendingClassFilter('all');
                            setPendingStatusFilter('all');
                            setClassFilter('all');
                            setStatusFilter('all');
                            setShowHistoryFilters(false);
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setClassFilter(pendingClassFilter);
                            setStatusFilter(pendingStatusFilter);
                            setShowHistoryFilters(false);
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
          )}
          </div>

          {history.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-3 mb-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-green-700">{presentCount}</p>
                <p className="text-xs text-green-600 font-medium">Present</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-yellow-700">{lateCount}</p>
                <p className="text-xs text-yellow-600 font-medium">Late</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-red-700">{absentCount}</p>
                <p className="text-xs text-red-600 font-medium">Absent</p>
              </div>
            </div>
          )}

          {historyLoading ? (
            <div className="flex items-center justify-center h-24">
              <LoadingDots className="justify-center" dotClassName="h-2.5 w-2.5" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-lg p-6 text-center">
              <p className="text-sm text-gray-500">{history.length === 0 ? 'No attendance records yet.' : 'No records match the selected filters.'}</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-lg divide-y divide-gray-100 overflow-hidden">
              {filteredHistory.map((record, idx) => (
                <div key={idx} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{record.subject_code} - {record.subject_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500">{record.date}</span>
                      {record.section && <span className="text-xs text-gray-400">- {record.section}</span>}
                      {record.session_name && <span className="text-xs text-gray-400">- {record.session_name}</span>}
                      {record.time_in && <span className="text-xs text-gray-500">- In: {record.time_in}</span>}
                    </div>
                  </div>
                  <div className="flex-shrink-0">{statusBadge(record.status)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default StudentAttendance;
