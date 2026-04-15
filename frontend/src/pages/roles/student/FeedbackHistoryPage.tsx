import { useState, useEffect } from 'react';
import Button from '../../../components/Button';
import LoadingDots from '../../../components/LoadingDots';
import {
  Filter,
  X,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  CornerUpLeft,
} from 'lucide-react';
import {
  GetStudentFeedback,
} from '../../../../wailsjs/go/backend/App';
import { useAuth } from '../../../contexts/AuthContext';
import { getOptionalUserComment, parseReportContext } from '../../../utils/feedbackComments';
import { Feedback } from './types';

function hasIssues(feedback: Feedback): boolean {
  return (
    feedback.equipment_condition !== 'Good' ||
    feedback.monitor_condition !== 'Good' ||
    feedback.keyboard_condition !== 'Good' ||
    feedback.mouse_condition !== 'Good'
  );
}

function parseEquipmentIssues(comments: string | null | undefined): Record<string, string> {
  if (!comments) return {};
  const result: Record<string, string> = {};
  const parts = comments.split(/;\s*|\r?\n/);
  for (const part of parts) {
    const match = part.match(/^(Computer|Monitor|Keyboard|Mouse):\s*(.+)$/i);
    if (match) result[match[1].toLowerCase()] = match[2].trim();
  }
  return result;
}

function ConditionBadge({ value }: { value: string }) {
  const colorClass =
    value === 'Good'
      ? 'bg-green-100 text-green-800'
      : value === 'Minor Issue'
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-red-100 text-red-800';
  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClass}`}>
      {value}
    </span>
  );
}

function DetailsModal({ feedback, onClose }: { feedback: Feedback; onClose: () => void }) {
  const { reportedForAnotherPC, submittedFrom } = parseReportContext(feedback.additional_comments);
  const issueTexts = parseEquipmentIssues(feedback.additional_comments);
  const optionalUserComment = getOptionalUserComment(feedback.additional_comments);

  const equipmentItems = [
    { label: 'Computer',  condition: feedback.equipment_condition, key: 'computer' },
    { label: 'Mouse',     condition: feedback.mouse_condition,     key: 'mouse' },
    { label: 'Keyboard',  condition: feedback.keyboard_condition,  key: 'keyboard' },
    { label: 'Monitor',   condition: feedback.monitor_condition,   key: 'monitor' },
  ];

  return (
    <div className="modal-backdrop">
      <div className="modal-surface w-full max-w-lg mx-2 sm:mx-4 overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">Report Details</h3>
          <button
            type="button"
            onClick={onClose}
            className="modal-back-icon-btn"
            title="Back"
            aria-label="Back"
          >
            <CornerUpLeft className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4 overflow-y-auto">
          {/* Date & Time */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Date & Time</p>
            <p className="text-sm text-gray-900">
              {new Date(feedback.date_submitted).toLocaleDateString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              })}{' '}
              &middot;{' '}
              {new Date(feedback.date_submitted).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          {/* Reported for / Submitted from */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Reported for / Submitted from</p>
            <div className="flex flex-col gap-1">
              <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium w-fit">
                Reported for: {feedback.pc_number}
              </span>
              {(reportedForAnotherPC || submittedFrom) && (
                <span className="text-xs text-gray-500">
                  {reportedForAnotherPC && 'Reported for another PC'}
                  {reportedForAnotherPC && submittedFrom && ' · '}
                  {submittedFrom && `Submitted from: ${submittedFrom}`}
                </span>
              )}
            </div>
          </div>

          {/* Equipment Conditions — card style matching submission form */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Equipment Conditions</p>
            <div className="grid grid-cols-2 gap-3">
              {equipmentItems.map(({ label, condition, key }) => {
                const isGood = condition === 'Good';
                const issueText = issueTexts[key] || '';
                return (
                  <div
                    key={key}
                    className={`border rounded-xl p-3 transition-all ${
                      isGood
                        ? 'border-green-200 bg-green-50/50'
                        : 'border-red-200 bg-red-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{label}</span>
                      {isGood
                        ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        : <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                    </div>
                    {isGood ? (
                      <span className="text-xs font-semibold text-green-700">No Issues</span>
                    ) : (
                      <div className="space-y-1.5">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          condition === 'Minor Issue'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {condition}
                        </span>
                        {issueText && (
                          <div className="px-2.5 py-1.5 bg-white border border-red-200 rounded-lg text-xs text-gray-700">
                            {issueText}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Additional comments */}
          {optionalUserComment && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Additional Comments</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{optionalUserComment}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end flex-shrink-0">
          <Button onClick={onClose} variant="outline" size="sm">Close</Button>
        </div>
      </div>
    </div>
  );
}

function FeedbackHistory() {
  const { user } = useAuth();
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [filteredFeedback, setFilteredFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [issueFilter, setIssueFilter] = useState<'all' | 'with_issues' | 'no_issues'>('all');
  const [pendingDateRangeStart, setPendingDateRangeStart] = useState('');
  const [pendingDateRangeEnd, setPendingDateRangeEnd] = useState('');
  const [pendingIssueFilter, setPendingIssueFilter] = useState<'all' | 'with_issues' | 'no_issues'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);

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

    const refreshInterval = setInterval(() => {
      if (user) loadFeedback();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [user]);

  useEffect(() => {
    let filtered = feedbackList;

    if (dateRangeStart || dateRangeEnd) {
      filtered = filtered.filter(feedback => {
        if (!feedback.date_submitted) return false;
        const reportDate = feedback.date_submitted.split(/[T\s]/)[0];
        if (dateRangeStart && reportDate < dateRangeStart) return false;
        if (dateRangeEnd && reportDate > dateRangeEnd) return false;
        return true;
      });
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(feedback =>
        (feedback.pc_number && feedback.pc_number.toLowerCase().includes(query)) ||
        (getOptionalUserComment(feedback.additional_comments)?.toLowerCase().includes(query) ?? false) ||
        (feedback.date_submitted && new Date(feedback.date_submitted).toLocaleString().toLowerCase().includes(query))
      );
    }

    if (issueFilter !== 'all') {
      filtered = filtered.filter(feedback =>
        issueFilter === 'with_issues' ? hasIssues(feedback) : !hasIssues(feedback)
      );
    }

    setFilteredFeedback(filtered);
    setCurrentPage(1);
  }, [feedbackList, dateRangeStart, dateRangeEnd, searchQuery, issueFilter]);

  const clearFilters = () => {
    setDateRangeStart('');
    setDateRangeEnd('');
    setIssueFilter('all');
    setSearchQuery('');
    setPendingDateRangeStart('');
    setPendingDateRangeEnd('');
    setPendingIssueFilter('all');
  };

  const activeFilterCount = (dateRangeStart || dateRangeEnd ? 1 : 0) + (issueFilter !== 'all' ? 1 : 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingDots className="justify-center gap-2" dotClassName="h-3 w-3" />
      </div>
    );
  }

  return (
    <div>
      {selectedFeedback && (
        <DetailsModal feedback={selectedFeedback} onClose={() => setSelectedFeedback(null)} />
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Feedback History</h2>
      </div>

      {/* Search and Filter Controls */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Show</span>
            <select
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-700">entries</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-64 max-w-full relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search PC, comments, date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter button */}
            <div className="relative">
              <button
                onClick={() => {
                  const nextOpen = !showFilters;
                  if (nextOpen) {
                    setPendingDateRangeStart(dateRangeStart);
                    setPendingDateRangeEnd(dateRangeEnd);
                    setPendingIssueFilter(issueFilter);
                  }
                  setShowFilters(nextOpen);
                }}
                className={`flex items-center gap-1.5 px-3 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="h-4 w-4" />
                <span>Filter</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-500 text-white text-xs font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {showFilters && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="p-4 space-y-3">
                    {/* Filter by Date Range: [from] to [to] with calendar icons */}
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

                    {/* Status / With issues dropdown */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                      <div className="relative">
                        <select
                          value={pendingIssueFilter}
                          onChange={(e) => setPendingIssueFilter(e.target.value as 'all' | 'with_issues' | 'no_issues')}
                          className="w-full border border-gray-300 rounded-lg pl-3 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-white text-gray-800"
                        >
                          <option value="all">All status</option>
                          <option value="with_issues">With issues</option>
                          <option value="no_issues">No issues</option>
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
                          clearFilters();
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
                          setIssueFilter(pendingIssueFilter);
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
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {(() => {
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
                <table className="min-w-full divide-y divide-gray-200 table-fixed">
                  <colgroup>
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '40%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '15%' }} />
                  </colgroup>
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reported for / Submitted from
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentRecords.map((feedback, index) => {
                      const withIssues = hasIssues(feedback);
                      const { reportedForAnotherPC, submittedFrom } = parseReportContext(feedback.additional_comments);
                      return (
                        <tr key={feedback.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {startIndex + index + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {new Date(feedback.date_submitted).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                })}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(feedback.date_submitted).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="flex flex-col gap-0.5">
                              <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full font-medium w-fit">
                                Reported for: {feedback.pc_number}
                              </span>
                              {(reportedForAnotherPC || submittedFrom) && (
                                <span className="text-xs text-gray-500">
                                  {reportedForAnotherPC && 'Reported for another PC'}
                                  {reportedForAnotherPC && submittedFrom && ' · '}
                                  {submittedFrom && `Submitted from: ${submittedFrom}`}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {withIssues ? (
                              <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-700">
                                With Issues
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-700">
                                No Issues
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => setSelectedFeedback(feedback)}
                              className="inline-flex h-8 w-8 items-center justify-center text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors"
                              title="View details"
                              aria-label="View details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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
