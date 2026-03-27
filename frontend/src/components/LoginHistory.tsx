import { useEffect, useRef, useState } from 'react';
import { GetStudentLoginLogs } from '../../wailsjs/go/backend/App';
import { useAuth } from '../contexts/AuthContext';
import Button from './Button';
import { Search, X, Filter } from 'lucide-react';
import LoadingDots from './LoadingDots';

type TimePeriod = 'all' | '7days' | 'last_week' | 'last_month' | '3months';

interface LoginLog {
  id: number;
  user_id: number;
  user_name: string;
  user_type: string;
  pc_number?: string;
  login_time: string;
  logout_time?: string;
}

interface LoginHistoryProps {
  /** Whether to show pagination controls (default: true) */
  showPagination?: boolean;
  /** Backward-compatible no-op prop used by older route usage */
  showStatus?: boolean;
}

export default function LoginHistory({ 
  showPagination = true,
}: LoginHistoryProps) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [filtered, setFiltered] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const [pendingDateRangeStart, setPendingDateRangeStart] = useState('');
  const [pendingDateRangeEnd, setPendingDateRangeEnd] = useState('');
  const [pendingTimePeriod, setPendingTimePeriod] = useState<TimePeriod>('all');

  // Close filter panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setShowFilters(false);
      }
    };
    if (showFilters) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilters]);

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

  const getTimePeriodDates = (period: TimePeriod): { start: Date | null; end: Date | null } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    switch (period) {
      case '7days':
        return { start: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000), end: null };
      case 'last_week': {
        const startOfThisWeek = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000);
        const startOfLastWeek = new Date(startOfThisWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
        const endOfLastWeek = new Date(startOfThisWeek.getTime() - 24 * 60 * 60 * 1000);
        return { start: startOfLastWeek, end: endOfLastWeek };
      }
      case 'last_month': {
        const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastOfLastMonth = new Date(firstOfThisMonth.getTime() - 24 * 60 * 60 * 1000);
        return { start: firstOfLastMonth, end: lastOfLastMonth };
      }
      case '3months':
        return { start: new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()), end: null };
      default:
        return { start: null, end: null };
    }
  };

  useEffect(() => {
    let f = logs;
    if (dateRangeStart || dateRangeEnd) {
      f = f.filter(l => {
        const logDate = l.login_time ? l.login_time.split(/[T\s]/)[0] : '';
        if (!logDate) return false;
        if (dateRangeStart && logDate < dateRangeStart) return false;
        if (dateRangeEnd && logDate > dateRangeEnd) return false;
        return true;
      });
    }
    if (timePeriod !== 'all') {
      const { start, end } = getTimePeriodDates(timePeriod);
      f = f.filter(l => {
        const logDate = l.login_time ? new Date(l.login_time.replace(' ', 'T')) : null;
        if (!logDate) return false;
        if (start && logDate < start) return false;
        if (end) {
          const endOfDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
          if (logDate > endOfDay) return false;
        }
        return true;
      });
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      f = f.filter(l =>
        (l.pc_number || '').toLowerCase().includes(q) ||
        (l.login_time || '').toLowerCase().includes(q)
      );
    }
    setFiltered(f);
    setCurrentPage(1);
  }, [logs, dateRangeStart, dateRangeEnd, timePeriod, searchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / entriesPerPage);
  const startEntry = (currentPage - 1) * entriesPerPage + 1;
  const endEntry = Math.min(currentPage * entriesPerPage, filtered.length);
  const currentRecords = showPagination 
    ? filtered.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage)
    : filtered;

  const clearFilters = () => {
    setDateRangeStart('');
    setDateRangeEnd('');
    setTimePeriod('all');
    setSearchQuery('');
    setPendingDateRangeStart('');
    setPendingDateRangeEnd('');
    setPendingTimePeriod('all');
  };

  const activeFilterCount = (dateRangeStart || dateRangeEnd ? 1 : 0) + (timePeriod !== 'all' ? 1 : 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Login History</h2>
      </div>

      <div className="mb-6 bg-white shadow rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          {showPagination && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Show</span>
              <select
                value={entriesPerPage}
                onChange={(e) => {
                  setEntriesPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-700">entries</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="relative w-64 max-w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by PC or date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {searchQuery && (
                <Button
                  onClick={() => setSearchQuery('')}
                  variant="secondary"
                  size="sm"
                  icon={<X className="h-5 w-5" />}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 !p-0"
                />
              )}
            </div>

            {/* Funnel filter button + dropdown panel */}
            <div className="relative" ref={filterPanelRef}>
              <button
                onClick={() => {
                  const nextOpen = !showFilters;
                  if (nextOpen) {
                    setPendingDateRangeStart(dateRangeStart);
                    setPendingDateRangeEnd(dateRangeEnd);
                    setPendingTimePeriod(timePeriod);
                  }
                  setShowFilters(nextOpen);
                }}
                className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-primary-50 border-primary-400 text-primary-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                title="Filter logs"
              >
                <Filter className="h-4 w-4" />
                <span>Filter</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-primary-500 text-white rounded-full text-xs font-semibold">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {showFilters && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                  <div className="p-4 space-y-3">
                    {/* Filter by Date Range */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Filter by Date Range</label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1 min-w-0">
                          <input
                            type="date"
                            value={pendingDateRangeStart}
                            onChange={(e) => setPendingDateRangeStart(e.target.value)}
                            max={pendingDateRangeEnd || new Date().toISOString().split('T')[0]}
                            className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-500 shrink-0">to</span>
                        <div className="relative flex-1 min-w-0">
                          <input
                            type="date"
                            value={pendingDateRangeEnd}
                            onChange={(e) => setPendingDateRangeEnd(e.target.value)}
                            min={pendingDateRangeStart}
                            max={new Date().toISOString().split('T')[0]}
                            className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Time Period dropdown */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Time Period</label>
                      <div className="relative">
                        <select
                          value={pendingTimePeriod}
                          onChange={(e) => setPendingTimePeriod(e.target.value as TimePeriod)}
                          className="w-full py-2 pl-3 pr-9 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-white text-gray-800"
                        >
                          <option value="all">All time</option>
                          <option value="7days">Last 7 days</option>
                          <option value="last_week">Last week</option>
                          <option value="last_month">Last month</option>
                          <option value="3months">Last 3 months</option>
                        </select>
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </div>

                    {/* Apply & Clear */}
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPendingDateRangeStart('');
                          setPendingDateRangeEnd('');
                          setPendingTimePeriod('all');
                          setDateRangeStart('');
                          setDateRangeEnd('');
                          setTimePeriod('all');
                          setShowFilters(false);
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDateRangeStart(pendingDateRangeStart);
                          setDateRangeEnd(pendingDateRangeEnd);
                          setTimePeriod(pendingTimePeriod);
                          setShowFilters(false);
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

            {(searchQuery || activeFilterCount > 0) && (
              <Button onClick={clearFilters} variant="outline" size="sm">
                Clear All
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-gray-200">
              <colgroup>
                <col className="w-1/4" />
                <col className="w-1/4" />
                <col className="w-1/4" />
                <col className="w-1/4" />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left align-middle text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PC Number
                  </th>
                  <th className="px-6 py-3 text-left align-middle text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Login Time
                  </th>
                  <th className="px-6 py-3 text-left align-middle text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Logout Time
                  </th>
                  <th className="px-6 py-3 text-left align-middle text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentRecords.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap align-middle">
                      <div className="text-sm font-medium text-gray-900">
                        {log.pc_number || <span className="text-gray-400 italic">Unknown</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-middle text-sm text-gray-700 tabular-nums">
                      {log.login_time ? new Date(log.login_time).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      }) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-middle text-sm text-gray-700 tabular-nums">
                      {log.logout_time ? (
                        new Date(log.logout_time).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true
                        })
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-middle text-sm text-gray-700 tabular-nums">
                      {log.login_time ? new Date(log.login_time).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      }) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPagination && filtered.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {startEntry} to {endEntry} of {filtered.length} entries
          </div>
          <div className="flex items-center gap-1">
            <Button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              variant="outline"
              size="sm"
            >
              Previous
            </Button>
            <Button variant="primary" size="sm">
              {currentPage}
            </Button>
            <Button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              variant="outline"
              size="sm"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
