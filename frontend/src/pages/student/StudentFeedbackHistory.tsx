import { useState, useEffect } from 'react';
import Button from '../../components/Button';
import {
  SlidersHorizontal,
  X,
  Search,
} from 'lucide-react';
import {
  GetStudentFeedback,
} from '../../../wailsjs/go/main/App';
import { useAuth } from '../../contexts/AuthContext';
import { Feedback } from './types';

function FeedbackHistory() {
  const { user } = useAuth();
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [filteredFeedback, setFilteredFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);

  useEffect(() => {
    const loadFeedback = async () => {
      if (!user) return;

      try {
        const data = await GetStudentFeedback(user.id);
        setFeedbackList(data || []);
        setFilteredFeedback(data || []);
        setError('');
      } catch (error) {
        console.error('Failed to load feedback:', error);
        setError('Unable to load feedback history. Make sure you are connected to the database.');
      } finally {
        setLoading(false);
      }
    };

    loadFeedback();

    // Auto-refresh every 30 seconds to show updated feedback history
    const refreshInterval = setInterval(() => {
      if (user) loadFeedback();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [user]);

  // Filter feedback based on date and search
  useEffect(() => {
    let filtered = feedbackList;

    // Apply date filter
    if (selectedDate) {
      filtered = filtered.filter(feedback => {
        if (!feedback.date_submitted) return false;

        const feedbackDate = new Date(feedback.date_submitted);
        const selected = new Date(selectedDate);

        // Compare only the date part (ignore time)
        return feedbackDate.toDateString() === selected.toDateString();
      });
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(feedback =>
        (feedback.pc_number && feedback.pc_number.toLowerCase().includes(query)) ||
        (feedback.comments && feedback.comments.toLowerCase().includes(query)) ||
        (feedback.date_submitted && new Date(feedback.date_submitted).toLocaleString().toLowerCase().includes(query))
      );
    }

    setFilteredFeedback(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [feedbackList, selectedDate, searchQuery]);

  const clearFilters = () => {
    setSelectedDate(null);
    setSearchQuery('');
  };

  const activeFilterCount = selectedDate ? 1 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Feedback History</h2>
      </div>

      {/* Search and Filter Controls */}
      <div className="mb-6 bg-white shadow rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
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
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder=""
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
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 !p-0"
              />
            )}
          </div>
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

            {/* Dropdown with Date Picker */}
            {showFilters && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">Filter by Date:</label>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Select Date</label>
                      <div className="relative">
                        <input
                          type="date"
                          value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
                          onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : null)}
                          max={new Date().toISOString().split('T')[0]}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
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
          {(searchQuery || selectedDate) && (
            <Button
              onClick={clearFilters}
              variant="outline"
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {(() => {
        // Pagination calculations
        const totalPages = Math.ceil(filteredFeedback.length / entriesPerPage);
        const startIndex = (currentPage - 1) * entriesPerPage;
        const endIndex = startIndex + entriesPerPage;
        const currentRecords = filteredFeedback.slice(startIndex, endIndex);
        const startEntry = filteredFeedback.length > 0 ? startIndex + 1 : 0;
        const endEntry = Math.min(endIndex, filteredFeedback.length);

        return filteredFeedback.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <p className="text-gray-500">No reports available</p>
          </div>
        ) : (
          <>
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        PC Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Computer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mouse
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Keyboard
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Monitor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                        Comments
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentRecords.map((feedback, index) => (
                      <tr key={feedback.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {startIndex + index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {new Date(feedback.date_submitted).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                          })}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(feedback.date_submitted).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                        {feedback.pc_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${feedback.equipment_condition === 'Good'
                        ? 'bg-green-100 text-green-800'
                        : feedback.equipment_condition === 'Minor Issue'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {feedback.equipment_condition}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${feedback.mouse_condition === 'Good'
                        ? 'bg-green-100 text-green-800'
                        : feedback.mouse_condition === 'Minor Issue'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {feedback.mouse_condition}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${feedback.keyboard_condition === 'Good'
                        ? 'bg-green-100 text-green-800'
                        : feedback.keyboard_condition === 'Minor Issue'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {feedback.keyboard_condition}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${feedback.monitor_condition === 'Good'
                        ? 'bg-green-100 text-green-800'
                        : feedback.monitor_condition === 'Minor Issue'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {feedback.monitor_condition}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="max-w-xs overflow-hidden">
                        {feedback.comments ? (
                          <span className="text-gray-600">{feedback.comments}</span>
                        ) : (
                          <span className="text-gray-400 italic">No comments</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {startEntry} to {endEntry} of {filteredFeedback.length} entries
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
              disabled={currentPage === totalPages || totalPages === 0}
              variant="outline"
              size="sm"
            >
              Next
            </Button>
          </div>
        </div>
        </>
      );
      })()}
    </div>
  );
}

export { FeedbackHistory };
export default FeedbackHistory;
