import React, { useEffect, useState } from 'react';
import { GetStudentLoginLogs } from '../../wailsjs/go/main/App';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';
import { Search, X } from 'lucide-react';

interface LoginLog {
  id: number;
  user_id: number;
  user_name: string;
  user_type: string;
  pc_number?: string;
  login_time: string;
  logout_time?: string;
}

export default function WorkingStudentLoginHistory() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [filtered, setFiltered] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const data = await GetStudentLoginLogs(user.id);
        setLogs(data || []);
        setFiltered(data || []);
        setError('');
      } catch (e) {
        console.error('Failed to load login logs:', e);
        setError(String(e));
        setLogs([]);
        setFiltered([]);
      } finally {
        setLoading(false);
      }
    };

    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [user]);

  useEffect(() => {
    let f = logs;
    if (selectedDate) {
      f = f.filter(l => new Date(l.login_time).toDateString() === selectedDate.toDateString());
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      f = f.filter(l => (l.pc_number || '').toLowerCase().includes(q) || (l.login_time || '').toLowerCase().includes(q));
    }
    setFiltered(f);
  }, [logs, selectedDate, searchQuery]);

  const clearFilters = () => {
    setSelectedDate(null);
    setSearchQuery('');
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"/></div>;

  return (
    <div>
      <div className="mb-6"><h2 className="text-2xl font-bold text-gray-900">Login History</h2></div>

      <div className="mb-6 bg-white shadow rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm" />
            {searchQuery && (
              <Button onClick={() => setSearchQuery('')} variant="secondary" size="sm" icon={<X className="h-5 w-5" />} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 !p-0" />
            )}
          </div>

          <div className="relative">
            <input type="date" value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''} onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : null)} className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>

          {(searchQuery || selectedDate) && (
            <Button onClick={clearFilters} variant="outline">Clear All</Button>
          )}
        </div>
      </div>

      {error && <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">{error}</div>}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        {filtered.length === 0 ? (
          <div className="text-center py-12"><p className="text-gray-500">No logs found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PC Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Login Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Logout Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{log.pc_number || 'Unknown'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{log.login_time ? new Date(log.login_time).toLocaleTimeString() : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{log.logout_time ? new Date(log.logout_time).toLocaleTimeString() : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{log.login_time ? new Date(log.login_time).toLocaleDateString() : '-'}</td>
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
