import React, { useEffect, useState } from 'react';
import { GetStudentLoginLogs } from '../../wailsjs/go/main/App';
import { useAuth } from '../contexts/AuthContext';
import Button from './Button';
import { Search, X, SlidersHorizontal } from 'lucide-react';

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
  /** Whether to use dropdown filter UI vs inline (default: false for inline) */
  useDropdownFilter?: boolean;
}

export default function LoginHistory({ 
  showStatus = true, 
  showPagination = true,
  useDropdownFilter = false 
}: LoginHistoryProps) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [filtered, setFiltered] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [autoDeleteDays, setAutoDeleteDays] = useState<number>(30);
  const [showFilters, setShowFilters] = useState(false);

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
      f = f.filter(l => 
        (l.pc_number || '').toLowerCase().includes(q) || 
        (l.login_time || '').toLowerCase().includes(q)
      );
    }
    setFiltered(f);
    setCurrentPage(1);
  }, [logs, selectedDate, searchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / entriesPerPage);
  const startEntry = (currentPage - 1) * entriesPerPage + 1;
  const endEntry = Math.min(currentPage * entriesPerPage, filtered.length);
  const currentRecords = showPagination 
    ? filtered.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage)
    : filtered;

  const clearFilters = () => {
    setSelectedDate(null);
    setSearchQuery('');
  };

  const activeFilterCount = selectedDate ? 1 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Login History</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">Auto-delete logs after:</span>
          <select
            value={autoDeleteDays}
            onChange={(e) => setAutoDeleteDays(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
          </select>
        </div>
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
                placeholder="Search..."
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

            {useDropdownFilter ? (
              <div className="relative">
                <Button
                  onClick={() => setShowFilters(!showFilters)}
                  variant={showFilters ? 'primary' : 'outline'}
                  icon={<SlidersHorizontal className="h-5 w-5" />}
                  className={showFilters ? 'bg-primary-50 border-primary-500 text-primary-700' : ''}
                >
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-primary-500 text-white rounded-full text-xs">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>

                {showFilters && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-700">Filter by Date:</label>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Select Date</label>
                          <input
                            type="date"
                            value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
                            onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : null)}
                            max={new Date().toISOString().split('T')[0]}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        {selectedDate && (
                          <Button
                            onClick={() => setSelectedDate(null)}
                            variant="secondary"
                            size="sm"
                            className="w-full text-xs text-gray-600 hover:text-gray-900 underline text-left !p-1"
                          >
                            Clear Date Filter
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : null)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            )}

            {(searchQuery || selectedDate) && (
              <Button onClick={clearFilters} variant="outline">
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
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {log.pc_number || <span className="text-gray-400 italic">Unknown</span>}
                          </div>
                        </div>
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
