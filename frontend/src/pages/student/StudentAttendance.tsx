import React, { useEffect, useState } from 'react';
import Button from '../../components/Button';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface AttendanceSession {
  session_id: number;
  class_id: number;
  attendance_date: string;
  session_name: string;
  status: 'open' | 'closed';
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

  const loadSessions = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const data = await (window as any).go.main.App.GetStudentOpenAttendanceSessions(user.id);
      setSessions(data || []);
    } catch (error) {
      console.error('Failed to load attendance sessions:', error);
      setNotice({ type: 'error', text: 'Unable to load attendance sessions.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleTimeIn = async (sessionId: number) => {
    if (!user?.id) return;

    setTimingInSession(sessionId);
    setNotice(null);

    try {
      await (window as any).go.main.App.StudentTimeIn(sessionId, user.id);
      setNotice({ type: 'success', text: 'Time In recorded successfully.' });
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
        <Button onClick={loadSessions} variant="outline" size="sm">Refresh</Button>
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
