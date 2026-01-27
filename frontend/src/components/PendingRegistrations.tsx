import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, User, Mail, Phone, Calendar } from 'lucide-react';
import { GetPendingRegistrations, ProcessRegistration } from '../../wailsjs/go/main/App';
import Button from '../components/Button';
import { Card } from '../components/Card';
import { main } from '../../wailsjs/go/models';

type PendingRegistration = main.PendingRegistration;

interface PendingRegistrationsProps {
  workingStudentUserId: number;
}

const PendingRegistrations: React.FC<PendingRegistrationsProps> = ({ workingStudentUserId }) => {
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadRegistrations();
  }, []);

  const loadRegistrations = async () => {
    try {
      setLoading(true);
      const data = await GetPendingRegistrations();
      setRegistrations(data || []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load pending registrations');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: number) => {
    try {
      setProcessing(userId);
      setError('');
      await ProcessRegistration({
        user_id: userId,
        approved_by: workingStudentUserId,
        action: 'approve',
        rejection_reason: '',
      });
      // Reload registrations
      await loadRegistrations();
    } catch (err: any) {
      setError(err.message || 'Failed to approve registration');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!selectedUserId || !rejectionReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }

    try {
      setProcessing(selectedUserId);
      setError('');
      await ProcessRegistration({
        user_id: selectedUserId,
        approved_by: workingStudentUserId,
        action: 'reject',
        rejection_reason: rejectionReason,
      });
      // Reload registrations
      await loadRegistrations();
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedUserId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to reject registration');
    } finally {
      setProcessing(null);
    }
  };

  const openRejectModal = (userId: number) => {
    setSelectedUserId(userId);
    setShowRejectModal(true);
    setRejectionReason('');
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Pending Student Registrations</h2>
          <p className="text-gray-600 mt-1">Review and approve student registration requests</p>
        </div>
        <button
          onClick={loadRegistrations}
          className="px-4 py-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {registrations.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Pending Registrations</h3>
            <p className="text-gray-500">All registration requests have been processed.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {registrations.map((reg) => (
            <Card key={reg.user_id} className="hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">
                        {reg.last_name}, {reg.first_name} {reg.middle_name || ''}
                      </h3>
                      <p className="text-sm text-gray-500">Student ID: {reg.student_id}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-4 h-4" />
                      <span>{reg.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-4 h-4" />
                      <span>{reg.contact_number}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>Submitted: {new Date(reg.submitted_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <Button
                    onClick={() => handleApprove(reg.user_id)}
                    disabled={processing === reg.user_id}
                    variant="primary"
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {processing === reg.user_id ? 'Approving...' : 'Approve'}
                  </Button>
                  <Button
                    onClick={() => openRejectModal(reg.user_id)}
                    disabled={processing === reg.user_id}
                    variant="danger"
                    className="flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Reject Registration</h3>
            <p className="text-gray-600 mb-4">Please provide a reason for rejecting this registration:</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Invalid student ID, missing verification documents..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              rows={4}
            />
            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setSelectedUserId(null);
                }}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReject}
                variant="danger"
                className="flex-1"
                disabled={!rejectionReason.trim() || processing !== null}
              >
                {processing ? 'Rejecting...' : 'Confirm Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingRegistrations;
