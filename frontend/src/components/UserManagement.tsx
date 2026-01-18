import React, { useEffect, useState } from 'react';
import { UserPlus, Edit, Trash2, Search } from 'lucide-react';
import Button from './Button';
import Modal from './Modal';
import { useUsers } from '../hooks/useUsers';

/**
 * Example of refactored User Management component.
 * 
 * IMPROVEMENTS DEMONSTRATED:
 * 1. Uses custom useUsers hook for data management
 * 2. Uses shared Button component for consistent styling
 * 3. Uses shared Modal component for dialogs
 * 4. Separated concerns - this component focuses only on UI/UX
 * 5. Cleaner, more maintainable code structure
 * 
 * BEFORE: 300+ lines of mixed state, API calls, and UI
 * AFTER: ~150 lines focused on presentation logic
 */
const UserManagement: React.FC = () => {
  const { users, loading, error, fetchUsers, deleteUser } = useUsers();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserType, setSelectedUserType] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' || 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.first_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (user.last_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const matchesType = selectedUserType === '' || user.role === selectedUserType;
    
    return matchesSearch && matchesType;
  });

  const handleDeleteUser = async (userId: number) => {
    try {
      await deleteUser(userId);
      setUserToDelete(null);
    } catch (err) {
      // Error is already handled by the hook
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        <Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setShowAddModal(true)}>
          Add User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedUserType}
          onChange={(e) => setSelectedUserType(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">All Types</option>
          <option value="student">Students</option>
          <option value="teacher">Teachers</option>
          <option value="admin">Admins</option>
          <option value="working_student">Working Students</option>
        </select>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {user.first_name} {user.last_name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.student_id || user.employee_id || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.email || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <Button variant="outline" size="sm" icon={<Edit className="h-3 w-3" />}>
                    Edit
                  </Button>
                  <Button 
                    variant="danger" 
                    size="sm" 
                    icon={<Trash2 className="h-3 w-3" />}
                    onClick={() => setUserToDelete(user.id)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No users found
          </div>
        )}
      </div>

      {/* Add User Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New User"
        size="lg"
      >
        <p className="text-gray-600">User creation form would go here...</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
          <Button variant="primary">Create User</Button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={userToDelete !== null}
        onClose={() => setUserToDelete(null)}
        title="Confirm Deletion"
        size="sm"
      >
        <p className="text-gray-600">Are you sure you want to delete this user? This action cannot be undone.</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setUserToDelete(null)}>Cancel</Button>
          <Button 
            variant="danger" 
            onClick={() => userToDelete && handleDeleteUser(userToDelete)}
            loading={loading}
          >
            Delete User
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default UserManagement;
