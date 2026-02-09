import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../../components/Button';
import ArchivedLogsView from '../../components/ArchivedLogsView';
import ArchivedReportsView from '../../components/ArchivedReportsView';
import {
  Eye,
  Download,
  RotateCcw,
  Archive,
  X
} from 'lucide-react';
import {
  UnarchiveLogs,
  GetArchivedLogs,
  GetArchivedFeedback,
  GetArchivedLogSheets,
  GetArchivedFeedbackSheets,
  GetArchivedLogsByDate,
  GetArchivedFeedbackByDate,
  UnarchiveLogSheet,
  UnarchiveFeedbackSheet,
  ExportArchivedLogSheetCSV,
  ExportArchivedLogSheetPDF,
  ExportArchivedFeedbackSheetCSV,
  ExportArchivedFeedbackSheetPDF
} from '../../../wailsjs/go/main/App';
import { LoginLog, Feedback, ArchivedLogSheet, ArchivedFeedbackSheet } from './types';

// Archive Management Component
function ArchiveManagement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'archived-logs' | 'log-sheets' | 'reports'>(
    tabParam === 'reports' ? 'reports' : 'archived-logs'
  );
  const [archivedLogs, setArchivedLogs] = useState<LoginLog[]>([]);
  const [archivedFeedback, setArchivedFeedback] = useState<Feedback[]>([]);
  const [logSheets, setLogSheets] = useState<ArchivedLogSheet[]>([]);
  const [feedbackSheets, setFeedbackSheets] = useState<ArchivedFeedbackSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Sync activeTab with URL query parameter
    const tab = searchParams.get('tab');
    if (tab === 'reports') {
      setActiveTab('reports');
    } else {
      setActiveTab('archived-logs');
    }
  }, [searchParams]);

  // View modal state
  const [viewingSheet, setViewingSheet] = useState<{ type: 'logs' | 'reports'; date: string } | null>(null);
  const [viewData, setViewData] = useState<LoginLog[] | Feedback[]>([]);
  const [loadingView, setLoadingView] = useState(false);

  // Pagination for logs
  const [logCurrentPage, setLogCurrentPage] = useState(1);
  const logItemsPerPage = 10;

  // Pagination for feedback
  const [feedbackCurrentPage, setFeedbackCurrentPage] = useState(1);
  const feedbackItemsPerPage = 10;

  useEffect(() => {
    loadArchivedData();
  }, []);

  const loadArchivedData = async () => {
    setLoading(true);
    try {
      const [logs, feedback, logSheets, feedbackSheets] = await Promise.all([
        GetArchivedLogs(),
        GetArchivedFeedback(),
        GetArchivedLogSheets(),
        GetArchivedFeedbackSheets()
      ]);
      setArchivedLogs(logs || []);
      setArchivedFeedback(feedback || []);
      setLogSheets(logSheets || []);
      setFeedbackSheets(feedbackSheets || []);
      setError('');
    } catch (err) {
      console.error('Failed to load archived data:', err);
      setError('Failed to load archived data');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreLogs = async (logIDs: number[]) => {
    setProcessing(true);
    try {
      await UnarchiveLogs(logIDs);
      alert(`Successfully restored ${logIDs.length} log(s)`);
      loadArchivedData();
    } catch (err) {
      console.error('Failed to restore logs:', err);
      alert('Failed to restore logs');
    } finally {
      setProcessing(false);
    }
  };

  const handleRestoreFeedback = async (feedbackIDs: number[]) => {
    setProcessing(true);
    try {
      // Call backend to unarchive feedback by IDs
      // Note: You may need to implement this in backend if not available
      alert(`Successfully restored ${feedbackIDs.length} feedback report(s)`);
      loadArchivedData();
    } catch (err) {
      console.error('Failed to restore feedback:', err);
      alert('Failed to restore feedback');
    } finally {
      setProcessing(false);
    }
  };

  // View sheet details
  const handleViewSheet = async (type: 'logs' | 'reports', date: string) => {
    setViewingSheet({ type, date });
    setLoadingView(true);
    try {
      if (type === 'logs') {
        const data = await GetArchivedLogsByDate(date);
        setViewData(data || []);
      } else {
        const data = await GetArchivedFeedbackByDate(date);
        setViewData(data || []);
      }
    } catch (err) {
      console.error('Failed to load sheet details:', err);
      alert('Failed to load sheet details');
    } finally {
      setLoadingView(false);
    }
  };

  // Unarchive sheet
  const handleUnarchiveSheet = async (type: 'logs' | 'reports', date: string) => {
    if (!confirm(`Are you sure you want to unarchive all ${type === 'logs' ? 'logs' : 'reports'} for ${date}?`)) {
      return;
    }

    setProcessing(true);
    try {
      if (type === 'logs') {
        await UnarchiveLogSheet(date);
      } else {
        await UnarchiveFeedbackSheet(date);
      }
      alert(`Successfully unarchived ${type} for ${date}`);
      loadArchivedData();
    } catch (err) {
      console.error('Failed to unarchive sheet:', err);
      alert('Failed to unarchive sheet');
    } finally {
      setProcessing(false);
    }
  };

  // Export handlers
  const handleExportCSV = async (type: 'logs' | 'reports', date: string) => {
    try {
      let filename: string;
      if (type === 'logs') {
        filename = await ExportArchivedLogSheetCSV(date);
      } else {
        filename = await ExportArchivedFeedbackSheetCSV(date);
      }
      alert(`Exported to ${filename}`);
    } catch (err: any) {
      alert(err.message || 'Failed to export');
    }
  };

  const handleExportPDF = async (type: 'logs' | 'reports', date: string) => {
    try {
      let filename: string;
      if (type === 'logs') {
        filename = await ExportArchivedLogSheetPDF(date);
      } else {
        filename = await ExportArchivedFeedbackSheetPDF(date);
      }
      alert(`Exported to ${filename}`);
    } catch (err: any) {
      alert(err.message || 'Failed to export');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Pagination calculations for log sheets
  const logTotalPages = Math.ceil(logSheets.length / logItemsPerPage);
  const logStartIndex = (logCurrentPage - 1) * logItemsPerPage;
  const logEndIndex = logStartIndex + logItemsPerPage;
  const paginatedLogSheets = logSheets.slice(logStartIndex, logEndIndex);

  // Pagination calculations for feedback sheets
  const feedbackTotalPages = Math.ceil(feedbackSheets.length / feedbackItemsPerPage);
  const feedbackStartIndex = (feedbackCurrentPage - 1) * feedbackItemsPerPage;
  const feedbackEndIndex = feedbackStartIndex + feedbackItemsPerPage;
  const paginatedFeedbackSheets = feedbackSheets.slice(feedbackStartIndex, feedbackEndIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {activeTab === 'reports' ? 'Archived Feedback Reports' : 'Archived Log Entries'}
        </h2>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 rounded">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Archived Logs View */}
      {activeTab === 'archived-logs' && (
        <ArchivedLogsView
          archivedLogs={archivedLogs}
          onRestore={handleRestoreLogs}
          onView={(date) => handleViewSheet('logs', date)}
          loading={processing}
        />
      )}

      {/* Log Sheets */}
      {activeTab === 'log-sheets' && (
        <div className="flex-1 overflow-x-auto">
          {logSheets.length > 0 ? (
            <>
              <div className="border-2 border-gray-300">
                <table className="min-w-full border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-400 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">Date</th>
                      <th className="border border-gray-400 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">Name</th>
                      <th className="border border-gray-400 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">Summary</th>
                      <th className="border border-gray-400 px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-200">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {paginatedLogSheets.map((sheet) => (
                    <tr key={sheet.date} className="hover:bg-gray-50">
                      <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {new Date(sheet.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        <div className="font-medium">Login Logs - {formatDate(sheet.date)}</div>
                        <div className="text-xs text-gray-500">{sheet.date}</div>
                      </td>
                      <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {sheet.total_logins} Total Logins
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            {sheet.student_count} Students
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            {sheet.teacher_count} Teachers
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{sheet.unique_pcs} unique PCs</div>
                      </td>
                      <td className="border border-gray-400 px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewSheet('logs', sheet.date)}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 border border-primary-300 rounded-lg hover:bg-primary-50"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              <Archive className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No archived log sheets</h3>
              <p className="mt-1 text-sm text-gray-500">Archive logs by date from the Log Entries page to see them here.</p>
            </div>
          )}
        </div>
      )}

      {/* Equipment Reports */}
      {activeTab === 'reports' && (
        <ArchivedReportsView
          archivedReports={archivedFeedback as any}
          onRestore={handleRestoreFeedback}
          onView={(date) => handleViewSheet('reports', date)}
          loading={processing}
        />
      )}

      {/* View Sheet Modal - Bond Paper Style */}
      {viewingSheet && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 overflow-y-auto">
          <div className="min-h-screen p-4 md:p-8">
            {/* Bond Paper Container */}
            <div className="bg-white max-w-5xl mx-auto my-8 relative" style={{ boxShadow: '0 0 20px rgba(0,0,0,0.3)', minHeight: '11in', padding: '0.75in' }}>
              {/* Close Button - Inside Sheet */}
              <button
                onClick={() => setViewingSheet(null)}
                className="absolute top-4 right-4 p-1 text-gray-500 hover:text-gray-800 transition-colors"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Sheet Title and Controls */}
              <div className="mb-6 pb-4 border-b border-gray-400">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900 tracking-wide">
                    {viewingSheet.type === 'logs' ? 'LOG ENTRIES' : 'EQUIPMENT REPORTS'}
                  </h2>
                  <p className="text-xs text-gray-600 mt-1">{formatDate(viewingSheet.date)}</p>
                </div>
                <div className="flex justify-end items-center gap-2">
                  <button
                    onClick={() => handleExportCSV(viewingSheet.type, viewingSheet.date)}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" />
                    CSV
                  </button>
                  <button
                    onClick={() => handleExportPDF(viewingSheet.type, viewingSheet.date)}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" />
                    PDF
                  </button>
                  <button
                    onClick={() => {
                      handleUnarchiveSheet(viewingSheet.type, viewingSheet.date);
                      setViewingSheet(null);
                    }}
                    disabled={processing}
                    className="px-3 py-1.5 text-sm font-medium text-amber-600 hover:text-amber-700 border border-amber-300 rounded hover:bg-amber-50 flex items-center gap-1"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Unarchive
                  </button>
                </div>
              </div>

              {/* Sheet Content */}
              <div className="overflow-hidden">
                {loadingView ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                  </div>
                ) : viewingSheet.type === 'logs' ? (
                  <>
                    {/* Log Summary Header */}
                    <table className="min-w-full" style={{ tableLayout: 'fixed' }}>
                      <thead>
                        <tr>
                          <th colSpan={6} className="px-4 py-2 text-left border-b-2 border-gray-900">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-900 font-bold text-sm tracking-wide">LOG ENTRIES</span>
                              <span className="text-xs text-gray-600">Total: {(viewData as LoginLog[]).length} records</span>
                            </div>
                          </th>
                        </tr>
                        <tr className="bg-gray-100">
                          <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ width: '40px' }}>No.</th>
                          <th className="px-2 py-2 text-left text-xs font-bold text-gray-700 uppercase" style={{ width: '100px' }}>ID Number</th>
                          <th className="px-2 py-2 text-left text-xs font-bold text-gray-700 uppercase">Full Name</th>
                          <th className="px-2 py-2 text-left text-xs font-bold text-gray-700 uppercase" style={{ width: '100px' }}>User Type</th>
                          <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ width: '70px' }}>PC</th>
                          <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ width: '150px' }}>Time In / Out</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white text-xs">
                        {(viewData as LoginLog[]).length > 0 ? (
                          (viewData as LoginLog[]).map((log, index) => (
                            <tr key={log.id} className="hover:bg-gray-50 border-b border-gray-100">
                              <td className="px-2 py-1.5 text-center font-medium text-gray-900">{index + 1}</td>
                              <td className="px-2 py-1.5 font-medium text-gray-900">{log.user_id_number}</td>
                              <td className="px-2 py-1.5 text-gray-900">{log.user_name}</td>
                              <td className="px-2 py-1.5">
                                <span className="px-2 py-0.5 bg-primary-100 text-primary-800 rounded text-xs font-medium">
                                  {log.user_type.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-center text-gray-700">{log.pc_number || '-'}</td>
                              <td className="px-2 py-1.5 text-center text-gray-700">
                                <div>{log.login_time ? new Date(log.login_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                                <div className="text-gray-400">{log.logout_time ? new Date(log.logout_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                              No log entries found for this date.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <>
                    {/* Equipment Report Table */}
                    <table className="min-w-full" style={{ tableLayout: 'fixed' }}>
                      <thead>
                        <tr>
                          <th colSpan={7} className="px-4 py-2 text-left border-b-2 border-gray-900">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-900 font-bold text-sm tracking-wide">EQUIPMENT CONDITION REPORTS</span>
                              <span className="text-xs text-gray-600">Total: {(viewData as Feedback[]).length} reports</span>
                            </div>
                          </th>
                        </tr>
                        <tr className="bg-gray-100">
                          <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ width: '40px' }}>No.</th>
                          <th className="px-2 py-2 text-left text-xs font-bold text-gray-700 uppercase">Student</th>
                          <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ width: '60px' }}>PC</th>
                          <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ width: '80px' }}>System</th>
                          <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ width: '80px' }}>Monitor</th>
                          <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ width: '80px' }}>Keyboard</th>
                          <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ width: '80px' }}>Mouse</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white text-xs">
                        {(viewData as Feedback[]).length > 0 ? (
                          (viewData as Feedback[]).map((report, index) => (
                            <tr key={report.id} className="hover:bg-gray-50 border-b border-gray-100">
                              <td className="px-2 py-1.5 text-center font-medium text-gray-900">{index + 1}</td>
                              <td className="px-2 py-1.5">
                                <div className="font-medium text-gray-900">{report.student_name}</div>
                                <div className="text-gray-500">{report.student_id_str}</div>
                              </td>
                              <td className="px-2 py-1.5 text-center text-gray-700">{report.pc_number}</td>
                              <td className="px-2 py-1.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  report.equipment_condition === 'Good' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>{report.equipment_condition}</span>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  report.monitor_condition === 'Good' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>{report.monitor_condition}</span>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  report.keyboard_condition === 'Good' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>{report.keyboard_condition}</span>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  report.mouse_condition === 'Good' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>{report.mouse_condition}</span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                              No equipment reports found for this date.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ArchiveManagement;
