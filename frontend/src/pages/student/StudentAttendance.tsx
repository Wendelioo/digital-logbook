import { useEffect, useState, useRef, useCallback } from 'react';
import Button from '../../components/Button';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { GetStudentOpenAttendanceSessions, StudentTimeIn } from '../../../wailsjs/go/backend/App';

interface AttendanceSession {
  session_id: number;
  class_id: number;
  attendance_date: string;
  session_name: string;
  status: string;
  class_duration_minutes?: number;
  grace_period_minutes?: number;
  opened_at?: string;
  subject_code: string;
  subject_name: string;
  edp_code: string;
}

function StudentAttendance() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [timingInSession, setTimingInSession] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());
  const previousSessionCountRef = useRef<number | null>(null);

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

  const getExpectedTimeInStatus = (session?: AttendanceSession): 'present' | 'late' => {
    const openedAt = parseSessionDateTime(session?.opened_at);
    if (!openedAt) return 'present';

    const graceMinutes = Math.max(0, session?.grace_period_minutes || 0);
    const lateCutoff = openedAt.getTime() + graceMinutes * 60 * 1000;
    return Date.now() >= lateCutoff ? 'late' : 'present';
  };

  const loadSessions = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    if (!user?.id) {
      if (showLoading) {
        setLoading(false);
      }
      return;
    }

    if (showLoading) {
      setLoading(true);
    }
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
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    loadSessions({ showLoading: true });
    const refreshInterval = setInterval(() => {
      loadSessions({ showLoading: false });
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [loadSessions]);

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
      await loadSessions();
    } catch (error: any) {
      console.error('Failed to time in:', error);
      setNotice({ type: 'error', text: error?.message || 'Failed to submit attendance.' });
    } finally {
      setTimingInSession(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Attendance</h2>
        <Button onClick={() => loadSessions({ showLoading: true })} variant="outline" size="sm">Refresh</Button>
      </div>

      {notice && (
        <div className={`px-3 py-2 rounded-md text-sm border ${notice.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {notice.text}
        </div>
      )}

      {sessions.length > 0 ? (
        <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
          {sessions.map((session) => (
            <div key={session.session_id} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{session.subject_code} - {session.subject_name}</p>
                <p className="text-xs text-gray-500">{session.session_name || 'Attendance Session'} • EDP: {session.edp_code || '-'}</p>
                {(() => {
                  const openedAt = parseSessionDateTime(session.opened_at);
                  if (!openedAt) {
                    return null;
                  }

                  const classMinutes = Math.max(0, session.class_duration_minutes || 0);
                  const graceMinutes = Math.max(0, session.grace_period_minutes || 0);
                  const classDeadline = new Date(openedAt.getTime() + classMinutes * 60 * 1000);
                  const graceDeadline = new Date(openedAt.getTime() + graceMinutes * 60 * 1000);
                  const classRemaining = Math.max(0, Math.floor((classDeadline.getTime() - nowTimestamp) / 1000));
                  const graceRemaining = Math.max(0, Math.floor((graceDeadline.getTime() - nowTimestamp) / 1000));
                  const expectedStatus = getExpectedTimeInStatus(session);

                  const statusMessage =
                    classRemaining <= 0
                      ? 'Class session window has ended. If you did not time in, you will be marked Absent.'
                      : graceRemaining > 0
                        ? 'Time in while the grace timer is running to be marked Present.'
                        : 'Grace period is over. Time in now will be recorded as Late.';

                  return (
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-gray-500">
                        Class remaining: {formatRemaining(classRemaining)} • Grace remaining: {formatRemaining(graceRemaining)}
                      </p>
                      <p
                        className={`text-[11px] ${
                          expectedStatus === 'late' && graceRemaining <= 0 && classRemaining > 0
                            ? 'text-yellow-700'
                            : classRemaining <= 0
                              ? 'text-red-700'
                              : 'text-green-700'
                        }`}
                      >
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
                disabled={timingInSession === session.session_id}
                icon={<CheckCircle2 className="h-4 w-4" />}
              >
                {timingInSession === session.session_id ? 'Submitting...' : 'Time In'}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <p className="text-sm text-gray-500">No open attendance sessions right now.</p>
        </div>
      )}
    </div>
  );
}

export default StudentAttendance;
