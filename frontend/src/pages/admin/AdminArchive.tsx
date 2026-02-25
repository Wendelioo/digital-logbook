import { useState, useEffect, useRef } from 'react';
import Button from '../../components/Button';
import Table from '../../components/Table';
import { Badge } from '../../components/Badge';
import {
  Download,
  Filter,
  Archive,
} from 'lucide-react';
import {
  GetArchivedLogs,
  GetArchivedFeedback,
  ExportArchivedLogSheetCSV,
  ExportArchivedLogSheetPDF,
  ExportArchivedFeedbackSheetCSV,
  ExportArchivedFeedbackSheetPDF
} from '../../../wailsjs/go/main/App';
import { LoginLog, Feedback } from './types';

export type ArchiveTab = 'archived-logs' | 'reports';

interface ArchiveManagementProps {
  initialTab?: ArchiveTab;
  hideHeader?: boolean;
}

// Archive Management Component
function ArchiveManagement({ initialTab = 'archived-logs', hideHeader = false }: ArchiveManagementProps) {
  const [activeTab, setActiveTab] = useState<ArchiveTab>(initialTab);
  const [archivedLogs, setArchivedLogs] = useState<LoginLog[]>([]);
  const [archivedFeedback, setArchivedFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [rangeStartDate, setRangeStartDate] = useState('');
  const [rangeEndDate, setRangeEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [rangeExporting, setRangeExporting] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement | null>(null);
  const downloadDropdownRef = useRef<HTMLDivElement | null>(null);

  const isScopedModal = hideHeader;
  const allowReportsSection = !isScopedModal || initialTab === 'reports';
  const allowLogsSection = !isScopedModal || initialTab !== 'reports';

  useEffect(() => {
    if (isScopedModal) {
      setActiveTab(allowReportsSection ? 'reports' : 'archived-logs');
      return;
    }

    setActiveTab(initialTab);
  }, [initialTab, isScopedModal, allowReportsSection]);

  // Pagination for logs
  const [logCurrentPage, setLogCurrentPage] = useState(1);
  const logItemsPerPage = 10;

  // Pagination for feedback
  const [feedbackCurrentPage, setFeedbackCurrentPage] = useState(1);
  const feedbackItemsPerPage = 10;

  useEffect(() => {
    loadArchivedData();
  }, []);

  useEffect(() => {
    if (!showFilterPanel && !showDownloadMenu) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(event.target as Node)
      ) {
        setShowFilterPanel(false);
      }

      if (
        downloadDropdownRef.current &&
        !downloadDropdownRef.current.contains(event.target as Node)
      ) {
        setShowDownloadMenu(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showFilterPanel, showDownloadMenu]);

  const loadArchivedData = async () => {
    setLoading(true);
    try {
      const [logs, feedback] = await Promise.all([
        GetArchivedLogs(),
        GetArchivedFeedback()
      ]);
      setArchivedLogs(logs || []);
      setArchivedFeedback(feedback || []);
      setError('');
    } catch (err) {
      console.error('Failed to load archived data:', err);
      setError('Failed to load archived data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const normalizeDateOnly = (value?: string | null) => {
    if (!value) return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const splitDate = trimmed.split(/[T\s]/)[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(splitDate)) {
      return splitDate;
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }
    return parsed.toISOString().slice(0, 10);
  };

  const toInputDate = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const applyRangePreset = (preset: 'today' | 'last7' | 'thisMonth') => {
    const now = new Date();
    const end = toInputDate(now);

    if (preset === 'today') {
      setRangeStartDate(end);
      setRangeEndDate(end);
      return;
    }

    if (preset === 'last7') {
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
      setRangeStartDate(toInputDate(startDate));
      setRangeEndDate(end);
      return;
    }

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    setRangeStartDate(toInputDate(startOfMonth));
    setRangeEndDate(end);
  };

  const handleExportRange = async (format: 'csv' | 'pdf') => {
    const isLogsTab = activeTab === 'archived-logs';
    const isReportsTab = activeTab === 'reports';

    if (!isLogsTab && !isReportsTab) {
      alert('Range export is available in Logs and Reports tabs only.');
      return;
    }

    const exportStart = appliedStartDate || rangeStartDate;
    const exportEnd = appliedEndDate || rangeEndDate;

    if (!exportStart || !exportEnd) {
      alert('Please apply a valid filter range before exporting.');
      return;
    }

    if (exportStart > exportEnd) {
      alert('Start date cannot be later than end date.');
      return;
    }

    if (appliedStartDate !== exportStart || appliedEndDate !== exportEnd) {
      setAppliedStartDate(exportStart);
      setAppliedEndDate(exportEnd);
      setLogCurrentPage(1);
      setFeedbackCurrentPage(1);
    }

    const filteredSourceDates = isLogsTab
      ? filteredLogRecords.map((record) => normalizeDateOnly(record.login_time))
      : filteredReportRecords.map((record) => normalizeDateOnly(record.date_submitted));

    const availableDates = Array.from(new Set(filteredSourceDates.filter(Boolean)))
      .filter((date) => date >= exportStart && date <= exportEnd)
      .sort((a, b) => a.localeCompare(b));

    if (availableDates.length === 0) {
      alert('No archived records found for the selected date range.');
      return;
    }

    setRangeExporting(true);
    try {
      for (const date of availableDates) {
        if (isLogsTab) {
          if (format === 'csv') {
            await ExportArchivedLogSheetCSV(date);
          } else {
            await ExportArchivedLogSheetPDF(date);
          }
        } else {
          if (format === 'csv') {
            await ExportArchivedFeedbackSheetCSV(date);
          } else {
            await ExportArchivedFeedbackSheetPDF(date);
          }
        }
      }

      alert(`Exported ${availableDates.length} date file(s) as ${format.toUpperCase()} for ${exportStart} to ${exportEnd}.`);
    } catch (err: any) {
      alert(err.message || 'Failed to export selected date range.');
    } finally {
      setRangeExporting(false);
    }
  };

  const handleApplyFilter = () => {
    if (!rangeStartDate || !rangeEndDate) {
      alert('Please select both start and end dates.');
      return;
    }

    if (rangeStartDate > rangeEndDate) {
      alert('Start date cannot be later than end date.');
      return;
    }

    setAppliedStartDate(rangeStartDate);
    setAppliedEndDate(rangeEndDate);
    setLogCurrentPage(1);
    setFeedbackCurrentPage(1);
  };

  const handleClearFilter = () => {
    setRangeStartDate('');
    setRangeEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setLogCurrentPage(1);
    setFeedbackCurrentPage(1);
  };

  const hasValidRangeFilter =
    Boolean(rangeStartDate) &&
    Boolean(rangeEndDate) &&
    rangeStartDate <= rangeEndDate;

  const hasActiveRangeFilter = Boolean(appliedStartDate) && Boolean(appliedEndDate);

  const hasAnyRangeInput = Boolean(rangeStartDate) || Boolean(rangeEndDate);

  const filteredLogRecords = hasActiveRangeFilter
    ? archivedLogs.filter((record) => {
        const recordDate = normalizeDateOnly(record.login_time);
        return recordDate >= appliedStartDate && recordDate <= appliedEndDate;
      })
    : archivedLogs;

  const filteredReportRecords = hasActiveRangeFilter
    ? archivedFeedback.filter((record) => {
        const recordDate = normalizeDateOnly(record.date_submitted);
        return recordDate >= appliedStartDate && recordDate <= appliedEndDate;
      })
    : archivedFeedback;

  // Pagination calculations for filtered log records
  const logTotalPages = Math.ceil(filteredLogRecords.length / logItemsPerPage);
  const logStartIndex = (logCurrentPage - 1) * logItemsPerPage;
  const logEndIndex = logStartIndex + logItemsPerPage;
  const paginatedLogRecords = filteredLogRecords.slice(logStartIndex, logEndIndex);

  // Pagination calculations for filtered report records
  const feedbackTotalPages = Math.ceil(filteredReportRecords.length / feedbackItemsPerPage);
  const feedbackStartIndex = (feedbackCurrentPage - 1) * feedbackItemsPerPage;
  const feedbackEndIndex = feedbackStartIndex + feedbackItemsPerPage;
  const paginatedReportRecords = filteredReportRecords.slice(feedbackStartIndex, feedbackEndIndex);

  const isLogsTab = activeTab === 'archived-logs' && allowLogsSection;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${isScopedModal ? 'min-h-[620px]' : ''}`}>
      {!hideHeader && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {activeTab === 'reports' ? 'Archived Feedback Reports' : 'Archived Log Entries'}
          </h2>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 rounded">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {!isScopedModal && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-2">
          <div className={`grid grid-cols-1 ${allowLogsSection && allowReportsSection ? 'sm:grid-cols-2' : 'sm:grid-cols-1'} gap-2`}>
            {allowLogsSection && (
              <button
                onClick={() => setActiveTab('archived-logs')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isLogsTab
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Logs
              </button>
            )}
            {allowReportsSection && (
              <button
                onClick={() => setActiveTab('reports')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'reports'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Reports
              </button>
            )}
          </div>
        </div>
      )}

      {(isLogsTab || (activeTab === 'reports' && allowReportsSection)) && (
        <div className="flex justify-end gap-2 flex-wrap">
          <div className="relative" ref={filterDropdownRef}>
            <Button
              variant="outline"
              size="sm"
              icon={<Filter className="h-4 w-4" />}
              onClick={() => {
                setShowFilterPanel((prev) => !prev);
                setShowDownloadMenu(false);
              }}
            >
              Filter
            </Button>

            {showFilterPanel && (
              <div className="absolute right-0 mt-2 w-max min-w-[360px] max-w-[90vw] rounded-xl border border-gray-200 bg-white p-4 shadow-xl z-30">
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-gray-500">Apply a date range to filter visible records and exports.</p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => applyRangePreset('today')}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => applyRangePreset('last7')}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                    >
                      Last 7 Days
                    </button>
                    <button
                      onClick={() => applyRangePreset('thisMonth')}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                    >
                      This Month
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-nowrap">
                    <input
                      type="date"
                      value={rangeStartDate}
                      onChange={(e) => setRangeStartDate(e.target.value)}
                      className="h-10 w-[150px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="text-xs text-gray-500 font-semibold uppercase">to</span>
                    <input
                      type="date"
                      value={rangeEndDate}
                      onChange={(e) => setRangeEndDate(e.target.value)}
                      className="h-10 w-[150px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    {hasAnyRangeInput && !hasValidRangeFilter ? (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                        Enter a valid start and end date to apply range filtering.
                      </p>
                    ) : hasActiveRangeFilter ? (
                      <p className="text-xs text-primary-700 bg-primary-50 border border-primary-200 rounded-md px-3 py-2">
                        Active filter: {appliedStartDate} to {appliedEndDate}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 min-w-[110px]"
                      onClick={handleApplyFilter}
                    >
                      Apply
                    </Button>
                    <Button
                      size="sm"
                      className="h-10 min-w-[110px]"
                      onClick={handleClearFilter}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="relative" ref={downloadDropdownRef}>
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              onClick={() => {
                setShowDownloadMenu((prev) => !prev);
                setShowFilterPanel(false);
              }}
              disabled={rangeExporting}
            >
              Download
            </Button>

            {showDownloadMenu && (
              <div className="absolute right-0 mt-2 w-36 rounded-xl border border-gray-200 bg-white shadow-xl z-30 overflow-hidden">
                <button
                  onClick={async () => {
                    setShowDownloadMenu(false);
                    await handleExportRange('csv');
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Download CSV
                </button>
                <button
                  onClick={async () => {
                    setShowDownloadMenu(false);
                    await handleExportRange('pdf');
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Download PDF
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logs */}
      {isLogsTab && (
        <div className={`flex-1 overflow-x-auto ${isScopedModal ? 'min-h-[460px]' : 'min-h-[380px]'}`}>
          {filteredLogRecords.length > 0 ? (
            <>
              <div className="border-2 border-gray-300">
              <Table
                columns={[
                  {
                    key: 'date',
                    label: 'Date',
                    render: (record: LoginLog) => (
                      <span className="text-sm text-gray-700">{formatDate(record.login_time)}</span>
                    )
                  },
                  {
                    key: 'user_name',
                    label: 'Name',
                    render: (record: LoginLog) => (
                      <span className="font-medium text-gray-900">{record.user_name}</span>
                    )
                  },
                  {
                    key: 'user_id_number',
                    label: 'ID Number',
                    render: (record: LoginLog) => (
                      <span className="text-gray-700">{record.user_id_number}</span>
                    )
                  },
                  {
                    key: 'user_type',
                    label: 'User Type',
                    render: (record: LoginLog) => (
                      <Badge variant={
                        record.user_type === 'admin' ? 'danger' :
                        record.user_type === 'teacher' ? 'warning' :
                        record.user_type === 'working_student' ? 'info' :
                        'success'
                      }>
                        {record.user_type.replace('_', ' ')}
                      </Badge>
                    )
                  },
                  {
                    key: 'pc_number',
                    label: 'PC',
                    render: (record: LoginLog) => (
                      <span className="text-gray-700">{record.pc_number || 'N/A'}</span>
                    )
                  },
                  {
                    key: 'login_time',
                    label: 'Login',
                    render: (record: LoginLog) => (
                      <span className="text-gray-700">{new Date(record.login_time.replace(' ', 'T')).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                    )
                  },
                  {
                    key: 'logout_time',
                    label: 'Logout',
                    render: (record: LoginLog) => (
                      <span className="text-gray-700">{record.logout_time ? new Date(record.logout_time.replace(' ', 'T')).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : 'Active'}</span>
                    )
                  }
                ]}
                data={paginatedLogRecords}
                loading={processing}
                emptyMessage="No archived log entries found"
              />
            </div>

            {/* Pagination Controls for Log Sheets */}
            {logTotalPages > 1 && (
              <div className="mt-4 flex justify-center items-center gap-2">
                <button
                  onClick={() => setLogCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={logCurrentPage === 1}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: logTotalPages }, (_, i) => i + 1).map((page) => {
                    if (
                      page === 1 ||
                      page === logTotalPages ||
                      (page >= logCurrentPage - 1 && page <= logCurrentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          onClick={() => setLogCurrentPage(page)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg ${
                            logCurrentPage === page
                              ? 'bg-primary-600 text-white'
                              : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    } else if (page === logCurrentPage - 2 || page === logCurrentPage + 2) {
                      return <span key={page} className="px-2 text-gray-500">...</span>;
                    }
                    return null;
                  })}
                </div>

                <button
                  onClick={() => setLogCurrentPage(prev => Math.min(logTotalPages, prev + 1))}
                  disabled={logCurrentPage === logTotalPages}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-sm font-medium text-gray-900">No archived logs found</h3>
              <p className="mt-1 text-sm text-gray-500">Try adjusting the date range filter or clear it to show all records.</p>
            </div>
          )}
        </div>
      )}

      {/* Reports */}
      {activeTab === 'reports' && allowReportsSection && (
        <div className={`flex-1 overflow-x-auto ${isScopedModal ? 'min-h-[460px]' : 'min-h-[380px]'}`}>
          {filteredReportRecords.length > 0 ? (
            <>
              <Table
                columns={[
                  {
                    key: 'date_submitted',
                    label: 'Date',
                    render: (record: Feedback) => (
                      <span className="text-sm text-gray-700">{formatDate(record.date_submitted)}</span>
                    )
                  },
                  {
                    key: 'student_id_str',
                    label: 'Student ID',
                    render: (record: Feedback) => (
                      <span className="text-gray-700">{record.student_id_str}</span>
                    )
                  },
                  {
                    key: 'student_name',
                    label: 'Full Name',
                    render: (record: Feedback) => (
                      <span className="font-medium text-gray-900">{record.student_name}</span>
                    )
                  },
                  {
                    key: 'pc_number',
                    label: 'PC',
                    render: (record: Feedback) => (
                      <span className="text-gray-700">{record.pc_number}</span>
                    )
                  },
                  {
                    key: 'equipment_condition',
                    label: 'System',
                    render: (record: Feedback) => (
                      <span className="text-gray-700">{record.equipment_condition}</span>
                    )
                  },
                  {
                    key: 'monitor_condition',
                    label: 'Monitor',
                    render: (record: Feedback) => (
                      <span className="text-gray-700">{record.monitor_condition}</span>
                    )
                  },
                  {
                    key: 'keyboard_condition',
                    label: 'Keyboard',
                    render: (record: Feedback) => (
                      <span className="text-gray-700">{record.keyboard_condition}</span>
                    )
                  },
                  {
                    key: 'mouse_condition',
                    label: 'Mouse',
                    render: (record: Feedback) => (
                      <span className="text-gray-700">{record.mouse_condition}</span>
                    )
                  }
                ]}
                data={paginatedReportRecords}
                loading={processing}
                emptyMessage="No archived reports found"
              />

              {feedbackTotalPages > 1 && (
                <div className="mt-4 flex justify-center items-center gap-2">
                  <button
                    onClick={() => setFeedbackCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={feedbackCurrentPage === 1}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: feedbackTotalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        page === 1 ||
                        page === feedbackTotalPages ||
                        (page >= feedbackCurrentPage - 1 && page <= feedbackCurrentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => setFeedbackCurrentPage(page)}
                            className={`px-3 py-2 text-sm font-medium rounded-lg ${
                              feedbackCurrentPage === page
                                ? 'bg-primary-600 text-white'
                                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      } else if (page === feedbackCurrentPage - 2 || page === feedbackCurrentPage + 2) {
                        return <span key={page} className="px-2 text-gray-500">...</span>;
                      }
                      return null;
                    })}
                  </div>

                  <button
                    onClick={() => setFeedbackCurrentPage(prev => Math.min(feedbackTotalPages, prev + 1))}
                    disabled={feedbackCurrentPage === feedbackTotalPages}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-sm font-medium text-gray-900">No archived reports found</h3>
              <p className="mt-1 text-sm text-gray-500">Try adjusting the date range filter or clear it to show all records.</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default ArchiveManagement;
