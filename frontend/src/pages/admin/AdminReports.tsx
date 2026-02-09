import React, { useState, useEffect } from 'react';
import Button from '../../components/Button';
import Table from '../../components/Table';
import {
  Search,
  X,
  SlidersHorizontal,
  Eye,
  FileText,
  MoreVertical,
  Archive,
  CheckSquare,
  AlertCircle
} from 'lucide-react';
import {
  GetFeedback,
  ArchiveFeedbackByDate
} from '../../../wailsjs/go/main/App';
import ArchiveConfirmationModal from '../../components/ArchiveConfirmationModal';
import { useAuth } from '../../contexts/AuthContext';
import { Feedback } from './types';

function Reports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Pagination
  const [reportsPage, setReportsPage] = useState(1);
  const reportsPerPage = 10;

  // General search
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Date filter only
  const [dateFilter, setDateFilter] = useState('');

  // Modal state
  const [selectedReport, setSelectedReport] = useState<Feedback | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // Archive functionality
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [reportToArchive, setReportToArchive] = useState<Feedback | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Toast
  const [toast, setToast] = useState<{type: 'success' | 'error', message: string} | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  useEffect(() => {
    loadReports();

    // Auto-refresh every 30 seconds to show new feedback reports
    const refreshInterval = setInterval(() => {
      loadReports();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, []);

  const loadReports = async () => {
    try {
      const data = await GetFeedback();
      if (data && Array.isArray(data)) {
        setReports(data);
      } else {
        setReports([]);
      }
      setError('');
    } catch (error) {
      console.error('Failed to load reports:', error);
      setError('Failed to load reports. Please check your database connection.');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDateFilter('');
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const handleArchiveClick = (report: Feedback) => {
    setReportToArchive(report);
    setShowArchiveConfirm(true);
    setOpenMenuId(null);
  };

  const confirmArchive = async () => {
    if (!reportToArchive || !user) return;
    
    setArchiving(true);
    try {
      await ArchiveFeedbackByDate(reportToArchive.date_submitted.split('T')[0], user.id);
      showToast('success', `Equipment report for ${reportToArchive.student_name} archived successfully!`);
      setShowArchiveConfirm(false);
      setReportToArchive(null);
      loadReports();
    } catch (error) {
      console.error('Failed to archive report:', error);
      showToast('error', 'Failed to archive equipment report');
    } finally {
      setArchiving(false);
    }
  };

  // Filter reports
  const filteredReports = reports.filter(report => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || (
      report.student_name?.toLowerCase().includes(searchLower) ||
      report.student_id_str?.toLowerCase().includes(searchLower) ||
      report.pc_number?.toString().toLowerCase().includes(searchLower) ||
      report.forwarded_by_name?.toLowerCase().includes(searchLower)
    );

    const matchesDate = !dateFilter || (
      report.date_submitted && report.date_submitted.split(/[T\s]/)[0] === dateFilter
    );

    return matchesSearch && matchesDate;
  });

  // Pagination
  const totalReportPages = Math.ceil(filteredReports.length / reportsPerPage);
  const reportsStartIndex = (reportsPage - 1) * reportsPerPage;
  const reportsEndIndex = reportsStartIndex + reportsPerPage;
  const paginatedReports = filteredReports.slice(reportsStartIndex, reportsEndIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Equipment Reports</h2>
          </div>
        </div>

        {/* Search Bar and Filter Button */}
        <div className="flex gap-3">
          <div className="w-64 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors ${showFilters
                ? 'bg-primary-50 border-primary-500 text-primary-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
            >
              <SlidersHorizontal className="h-5 w-5" />
              Filters
              {dateFilter && (
                <span className="ml-1 px-2 py-0.5 bg-primary-500 text-white rounded-full text-xs">
                  1
                </span>
              )}
            </button>

            {/* Dropdown Filters Panel */}
            {showFilters && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">Filter by Date:</label>
                    {dateFilter && (
                      <button
                        onClick={() => setDateFilter('')}
                        className="text-xs text-gray-600 hover:text-gray-900 underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            )}
          </div>
          {(searchQuery || dateFilter) && (
            <button
              onClick={clearFilters}
              className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-4 shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Single Unified Table */}
      <div>
        <Table
          columns={[
            {
              key: 'student_id_str',
              label: 'Student ID',
              render: (report: Feedback) => (
                <span className="text-gray-700">{report.student_id_str}</span>
              )
            },
            {
              key: 'student_name',
              label: 'Full Name',
              render: (report: Feedback) => (
                <span className="font-medium text-gray-900">{report.student_name}</span>
              )
            },
            {
              key: 'pc_number',
              label: 'PC Number',
              render: (report: Feedback) => (
                <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                  {report.pc_number}
                </span>
              )
            },
            {
              key: 'date_submitted',
              label: 'Date',
              render: (report: Feedback) => (
                <span className="text-gray-600">
                  {report.date_submitted ? new Date(report.date_submitted).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  }) : 'N/A'}
                </span>
              )
            },
            {
              key: 'forwarded_by_name',
              label: 'Forwarded By',
              render: (report: Feedback) => (
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">{report.forwarded_by_name || 'Unknown'}</span>
                  {report.forwarded_at && (
                    <span className="text-xs text-gray-500">
                      {new Date(report.forwarded_at).toLocaleString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  )}
                </div>
              )
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (report: Feedback) => (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      setSelectedReport(report);
                      setShowReportModal(true);
                    }}
                    variant="outline"
                    size="sm"
                    icon={<Eye className="h-4 w-4" />}
                  />
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === report.id ? null : report.id);
                      }}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title="More options"
                    >
                      <MoreVertical className="h-5 w-5 text-gray-600" />
                    </button>
                    
                    {/* Dropdown Menu */}
                    {openMenuId === report.id && (
                      <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                        <button
                          onClick={() => handleArchiveClick(report)}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2 text-gray-700 hover:text-gray-900 border-b border-gray-100 last:border-b-0"
                        >
                          <Archive className="h-4 w-4" />
                          Archive Report
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            }
          ]}
          data={paginatedReports}
          loading={loading}
          emptyMessage="No equipment reports submitted"
        />
        {filteredReports.length > 0 && totalReportPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
            <div className="text-sm text-gray-600">
              Showing {reportsStartIndex + 1} to {Math.min(reportsEndIndex, filteredReports.length)} of {filteredReports.length} entries
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setReportsPage(prev => Math.max(1, prev - 1))}
                disabled={reportsPage === 1}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              {Array.from({ length: totalReportPages }, (_, i) => i + 1).map((pageNum) => (
                <Button
                  key={pageNum}
                  onClick={() => setReportsPage(pageNum)}
                  variant={reportsPage === pageNum ? "primary" : "outline"}
                  size="sm"
                >
                  {pageNum}
                </Button>
              ))}
              <Button
                onClick={() => setReportsPage(prev => Math.min(totalReportPages, prev + 1))}
                disabled={reportsPage >= totalReportPages}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Archive Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg border ${
          toast.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        } animate-slideIn`}>
          <div className="flex items-center gap-3">
            {toast.type === 'success' ? (
              <CheckSquare className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && reportToArchive && (
        <ArchiveConfirmationModal
          isOpen={showArchiveConfirm}
          onClose={() => {
            setShowArchiveConfirm(false);
            setReportToArchive(null);
          }}
          onConfirm={confirmArchive}
          loading={archiving}
          itemType="equipment report"
          itemDescription={`${reportToArchive.student_name} (${reportToArchive.student_id_str}) - ${reportToArchive.pc_number}`}
        />
      )}

      {/* Report Details Modal */}
      {showReportModal && selectedReport && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowReportModal(false);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowReportModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold transition-colors z-10"
            >
              ×
            </button>

            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    Equipment Report Details
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">Full report submitted by student</p>
                </div>
              </div>

              {/* Report Information */}
              <div className="space-y-6">
                {/* Student Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Student Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <p className="font-medium text-gray-900">{selectedReport.student_name}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Student ID:</span>
                      <p className="font-medium text-gray-900">{selectedReport.student_id_str}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">PC Number:</span>
                      <p className="font-medium text-gray-900">{selectedReport.pc_number}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Date Submitted:</span>
                      <p className="font-medium text-gray-900">
                        {selectedReport.date_submitted ? new Date(selectedReport.date_submitted).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Equipment Conditions */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Equipment Conditions</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span className="text-xs text-gray-600 block mb-2">Equipment</span>
                      <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${selectedReport.equipment_condition === 'Good'
                        ? 'bg-green-100 text-green-800'
                        : selectedReport.equipment_condition === 'Minor Issue'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {selectedReport.equipment_condition}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600 block mb-2">Monitor</span>
                      <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${selectedReport.monitor_condition === 'Good'
                        ? 'bg-green-100 text-green-800'
                        : selectedReport.monitor_condition === 'Minor Issue'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {selectedReport.monitor_condition}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600 block mb-2">Keyboard</span>
                      <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${selectedReport.keyboard_condition === 'Good'
                        ? 'bg-green-100 text-green-800'
                        : selectedReport.keyboard_condition === 'Minor Issue'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {selectedReport.keyboard_condition}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600 block mb-2">Mouse</span>
                      <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${selectedReport.mouse_condition === 'Good'
                        ? 'bg-green-100 text-green-800'
                        : selectedReport.mouse_condition === 'Minor Issue'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {selectedReport.mouse_condition}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Student Comments */}
                {selectedReport.comments && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Student Comments</h4>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedReport.comments}</p>
                  </div>
                )}

                {/* Working Student Notes */}
                {selectedReport.working_student_notes && (
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Working Student Notes</h4>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap italic">{selectedReport.working_student_notes}</p>
                  </div>
                )}

                {/* Forwarding Information */}
                {selectedReport.forwarded_by_name && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Forwarding Information</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Forwarded By:</span>
                        <p className="font-medium text-gray-900">{selectedReport.forwarded_by_name}</p>
                      </div>
                      {selectedReport.forwarded_at && (
                        <div>
                          <span className="text-gray-600">Forwarded At:</span>
                          <p className="font-medium text-gray-900">
                            {new Date(selectedReport.forwarded_at).toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="mt-6 flex justify-end">
                <Button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  variant="outline"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reports;
