import { useEffect, useRef, useState } from 'react';
import { GetStudentLoginLogs } from '../../wailsjs/go/backend/App';
import { useAuth } from '../contexts/AuthContext';
import Button from './Button';
import { Search, X, Filter } from 'lucide-react';

type StatusFilter = 'all' | 'active' | 'completed';

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
  /** Whether to show the Status column (default: true) */
  showStatus?: boolean;
  /** Whether to show pagination controls (default: true) */
  showPagination?: boolean;
}

export default function LoginHistory({ 
  showStatus = true, 
  showPagination = true,
}: LoginHistoryProps) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [filtered, setFiltered] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    let f = logs;
    if (selectedDate) {
      f = f.filter(l => new Date(l.login_time).toDateString() === selectedDate.toDateString());
    }
    if (selectedStatus === 'active') {
      f = f.filter(l => !l.logout_time);
    } else if (selectedStatus === 'completed') {
      f = f.filter(l => !!l.logout_time);
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
  }, [logs, selectedDate, selectedStatus, searchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / entriesPerPage);
  const startEntry = (currentPage - 1) * entriesPerPage + 1;
  const endEntry = Math.min(currentPage * entriesPerPage, filtered.length);
  const currentRecords = showPagination 
    ? filtered.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage)
    : filtered;

  const clearFilters = () => {
    setSelectedDate(null);
    setSelectedStatus('all');
    setSearchQuery('');
  };

  const activeFilterCount = (selectedDate ? 1 : 0) + (selectedStatus !== 'all' ? 1 : 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
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
            <div className="relative w-64">
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
                onClick={() => setShowFilters(!showFilters)}
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
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-20">
                  {/* Panel header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-primary-600" />
                      <span className="text-sm font-semibold text-gray-800">Filter Logs</span>
                    </div>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={() => { setSelectedDate(null); setSelectedStatus('all'); }}
                        className="text-xs text-primary-600 hover:text-primary-800 font-medium underline"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="p-4 space-y-5">
                    {/* By Date */}
                    <div>
                      <div className="mb-1">
                        <span className="text-sm font-medium text-gray-800">By Date</span>
                        <p className="text-xs text-gray-500 mt-0.5">Filter logs by the date you logged in to the lab.</p>
                      </div>
                      <input
                        type="date"
                        value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : null)}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    {/* By Status */}
                    <div>
                      <div className="mb-2">
                        <span className="text-sm font-medium text-gray-800">By Session Status</span>
                        <p className="text-xs text-gray-500 mt-0.5">Show only active sessions (still logged in) or completed sessions (logged out).</p>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['all', 'active', 'completed'] as StatusFilter[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => setSelectedStatus(s)}
                            className={`py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors ${
                              selectedStatus === s
                                ? s === 'active'
                                  ? 'bg-green-50 border-green-400 text-green-700'
                                  : s === 'completed'
                                  ? 'bg-gray-100 border-gray-400 text-gray-700'
                                  : 'bg-primary-50 border-primary-400 text-primary-700'
                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {s === 'all' ? 'All' : s === 'active' ? '🟢 Active' : '✓ Completed'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Active filter chips */}
                    {activeFilterCount > 0 && (
                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">Active filters:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedDate && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 border border-primary-200 text-primary-700 rounded-full text-xs">
                              Date: {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              <button onClick={() => setSelectedDate(null)} className="hover:text-primary-900">
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          )}
                          {selectedStatus !== 'all' && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${
                              selectedStatus === 'active'
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : 'bg-gray-100 border-gray-200 text-gray-700'
                            }`}>
                              {selectedStatus === 'active' ? 'Active only' : 'Completed only'}
                              <button onClick={() => setSelectedStatus('all')} className="hover:opacity-75">
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          )}
                        </div>
                      </div>
                    )}
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
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PC Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Login Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Logout Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  {showStatus && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentRecords.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {log.pc_number || <span className="text-gray-400 italic">Unknown</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {log.login_time ? new Date(log.login_time).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      }) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {log.logout_time ? (
                        new Date(log.logout_time).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true
                        })
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {log.login_time ? new Date(log.login_time).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      }) : '-'}
                    </td>
                    {showStatus && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.logout_time ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <span className="w-2 h-2 mr-1.5 bg-green-600 rounded-full animate-pulse"></span>
                            Active Session
                          </span>
                        )}
                      </td>
                    )}
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
