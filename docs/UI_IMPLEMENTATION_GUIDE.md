# UI/UX Implementation Guide

This guide provides step-by-step instructions for implementing the new design system across your Digital Logbook application.

---

## 🚀 Quick Start

### Step 1: Import New Components

Add these imports to your page components:

```tsx
// Core UI Components
import Button from '../components/Button';
import { Card, CardHeader, CardBody, CardFooter, StatCard, InfoCard } from '../components/Card';
import Table from '../components/Table';
import Modal, { ConfirmModal } from '../components/Modal';
import { Badge, StatusBadge, Alert, Notification } from '../components/Badge';
import { 
  FormGroup, 
  FormRow, 
  FormSection, 
  InputField, 
  SelectField, 
  TextAreaField,
  CheckboxField,
  RadioGroup 
} from '../components/Form';

// Icons (existing)
import { Plus, Edit, Trash2, Search, Filter } from 'lucide-react';
```

---

## 📋 Component Migration Examples

### 1. Dashboard Stats Cards

**BEFORE:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <div className="bg-white overflow-hidden shadow rounded-lg">
    <div className="p-5">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className="bg-blue-500 rounded-md p-3 text-white">
            <Users className="h-8 w-8" />
          </div>
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">
              Total Students
            </dt>
            <dd className="text-3xl font-bold text-gray-900">
              {stats.total_students}
            </dd>
          </dl>
        </div>
      </div>
    </div>
  </div>
</div>
```

**AFTER:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <StatCard
    title="Total Students"
    value={stats.total_students}
    icon={<Users className="h-8 w-8" />}
    color="blue"
  />
  <StatCard
    title="Teachers"
    value={stats.total_teachers}
    icon={<Users className="h-8 w-8" />}
    color="green"
  />
  <StatCard
    title="Working Students"
    value={stats.working_students}
    icon={<Users className="h-8 w-8" />}
    color="purple"
  />
  <StatCard
    title="Recent Logins"
    value={stats.recent_logins}
    icon={<ClipboardList className="h-8 w-8" />}
    color="orange"
  />
</div>
```

**Benefits:**
- 90% less code
- Consistent styling
- Built-in hover effects
- Responsive by default

---

### 2. User Management Table

**BEFORE:**
```tsx
<div className="bg-white shadow overflow-hidden rounded-lg">
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
          Name
        </th>
        {/* More headers */}
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-200">
      {users.map((user) => (
        <tr key={user.id}>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="text-sm font-medium text-gray-900">
              {user.name}
            </div>
          </td>
          {/* More cells */}
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

**AFTER:**
```tsx
<Table
  data={users}
  columns={[
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (user) => (
        <div className="flex items-center gap-3">
          <img 
            src={user.photo_url || '/default-avatar.png'} 
            className="h-8 w-8 rounded-full" 
          />
          <span className="font-medium">{user.name}</span>
        </div>
      )
    },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (user) => (
        <Badge variant={getRoleBadgeVariant(user.role)}>
          {user.role.replace('_', ' ')}
        </Badge>
      )
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true
    },
    {
      key: 'created',
      label: 'Created',
      sortable: true,
      render: (user) => new Date(user.created).toLocaleDateString()
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (user) => (
        <div className="flex items-center justify-end gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            icon={<Edit className="h-3 w-3" />}
            onClick={() => handleEdit(user)}
          >
            Edit
          </Button>
          <Button 
            variant="danger" 
            size="sm" 
            icon={<Trash2 className="h-3 w-3" />}
            onClick={() => handleDelete(user.id)}
          >
            Delete
          </Button>
        </div>
      )
    }
  ]}
  sortKey={sortKey}
  sortDirection={sortDirection}
  onSort={handleSort}
  stickyHeader
  hoverable
  striped
/>
```

**Helper function for role badges:**
```tsx
function getRoleBadgeVariant(role: string) {
  const variants = {
    admin: 'danger',
    teacher: 'info',
    student: 'primary',
    working_student: 'warning'
  };
  return variants[role as keyof typeof variants] || 'gray';
}
```

**Benefits:**
- Sortable columns built-in
- Custom cell rendering
- Striped rows automatically
- Hover effects
- Sticky header option
- Loading and empty states

---

### 3. Add/Edit User Form Modal

**BEFORE:**
```tsx
{showForm && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
      <div className="p-4 border-b">
        <h3 className="text-lg font-bold">{editingUser ? 'Edit User' : 'Add User'}</h3>
      </div>
      <form onSubmit={handleSubmit} className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">First Name</label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({...formData, firstName: e.target.value})}
              className="w-full px-2.5 py-1.5 border rounded-md"
            />
          </div>
          {/* More fields */}
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button type="button" onClick={() => setShowForm(false)}>
            Cancel
          </button>
          <button type="submit">
            Save
          </button>
        </div>
      </form>
    </div>
  </div>
)}
```

**AFTER:**
```tsx
<Modal
  isOpen={showForm}
  onClose={() => {
    setShowForm(false);
    setEditingUser(null);
    resetForm();
  }}
  title={editingUser ? 'Edit User' : 'Add New User'}
  size="xl"
  footer={
    <>
      <Button variant="outline" onClick={() => setShowForm(false)}>
        Cancel
      </Button>
      <Button 
        variant="primary" 
        type="submit" 
        form="user-form"
        loading={saving}
      >
        {editingUser ? 'Update User' : 'Create User'}
      </Button>
    </>
  }
>
  <form id="user-form" onSubmit={handleSubmit} className="space-y-6">
    <FormSection 
      title="Personal Information"
      description="Enter the user's personal details"
    >
      <FormRow columns={3}>
        <InputField
          label="First Name"
          required
          value={formData.firstName}
          onChange={(e) => setFormData({...formData, firstName: e.target.value})}
          error={errors.firstName}
        />
        <InputField
          label="Middle Name"
          value={formData.middleName}
          onChange={(e) => setFormData({...formData, middleName: e.target.value})}
        />
        <InputField
          label="Last Name"
          required
          value={formData.lastName}
          onChange={(e) => setFormData({...formData, lastName: e.target.value})}
          error={errors.lastName}
        />
      </FormRow>

      <FormRow columns={2}>
        <InputField
          label="Email Address"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          helperText="We'll never share your email"
        />
        <InputField
          label="Contact Number"
          type="tel"
          value={formData.contactNumber}
          onChange={(e) => setFormData({...formData, contactNumber: e.target.value})}
          placeholder="09XX XXX XXXX"
        />
      </FormRow>
    </FormSection>

    <FormSection 
      title="Account Details"
      description="Set up login credentials and role"
    >
      <FormRow columns={2}>
        <SelectField
          label="User Role"
          required
          value={formData.role}
          onChange={(e) => setFormData({...formData, role: e.target.value})}
          options={[
            { value: '', label: 'Select Role', disabled: true },
            { value: 'student', label: 'Student' },
            { value: 'teacher', label: 'Teacher' },
            { value: 'working_student', label: 'Working Student' },
            { value: 'admin', label: 'Admin' }
          ]}
          error={errors.role}
        />

        {formData.role === 'teacher' && (
          <SelectField
            label="Department"
            required
            value={formData.departmentCode}
            onChange={(e) => setFormData({...formData, departmentCode: e.target.value})}
            options={[
              { value: '', label: 'Select Department', disabled: true },
              ...departments.map(dept => ({
                value: dept.department_code,
                label: `${dept.department_code} - ${dept.department_name}`
              }))
            ]}
          />
        )}

        {(formData.role === 'student' || formData.role === 'working_student') && (
          <InputField
            label="Student ID"
            required
            value={formData.studentId}
            onChange={(e) => setFormData({...formData, studentId: e.target.value})}
            placeholder="2024-XXXXX"
          />
        )}
      </FormRow>

      {!editingUser && (
        <FormRow columns={2}>
          <InputField
            label="Password"
            type="password"
            required
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            error={errors.password}
            helperText="Must be at least 8 characters"
          />
          <InputField
            label="Confirm Password"
            type="password"
            required
            value={formData.confirmPassword}
            onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
            error={errors.confirmPassword}
          />
        </FormRow>
      )}
    </FormSection>
  </form>
</Modal>
```

**Benefits:**
- Clean visual grouping
- Proper form validation display
- Responsive grid layout
- Helper text support
- Required field indicators
- Loading states for submission

---

### 4. Search and Filter Bar

**BEFORE:**
```tsx
<div className="flex gap-4 mb-6">
  <div className="flex-1">
    <input
      type="text"
      placeholder="Search users..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="w-full px-4 py-2 border rounded-lg"
    />
  </div>
  <select
    value={userTypeFilter}
    onChange={(e) => setUserTypeFilter(e.target.value)}
    className="px-4 py-2 border rounded-lg"
  >
    <option value="">All Types</option>
    <option value="student">Students</option>
    <option value="teacher">Teachers</option>
  </select>
</div>
```

**AFTER:**
```tsx
<Card>
  <CardBody>
    <div className="flex flex-col md:flex-row gap-4">
      <div className="flex-1">
        <InputField
          placeholder="Search by name, email, or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          icon={<Search className="h-4 w-4" />}
        />
      </div>
      <SelectField
        options={[
          { value: '', label: 'All User Types' },
          { value: 'student', label: 'Students' },
          { value: 'teacher', label: 'Teachers' },
          { value: 'working_student', label: 'Working Students' },
          { value: 'admin', label: 'Admins' }
        ]}
        value={userTypeFilter}
        onChange={(e) => setUserTypeFilter(e.target.value)}
      />
      <SelectField
        options={[
          { value: '', label: 'All Departments' },
          ...departments.map(d => ({ 
            value: d.department_code, 
            label: d.department_name 
          }))
        ]}
        value={departmentFilter}
        onChange={(e) => setDepartmentFilter(e.target.value)}
      />
      <Button 
        variant="outline" 
        icon={<Filter className="h-4 w-4" />}
        onClick={clearFilters}
      >
        Clear
      </Button>
    </div>
  </CardBody>
</Card>
```

---

### 5. Delete Confirmation

**BEFORE:**
```tsx
if (confirm('Are you sure you want to delete this user?')) {
  await DeleteUser(id);
  loadUsers();
}
```

**AFTER:**
```tsx
// State
const [deleteConfirm, setDeleteConfirm] = useState<{id: number, name: string} | null>(null);

// Button
<Button 
  variant="danger" 
  size="sm" 
  icon={<Trash2 />}
  onClick={() => setDeleteConfirm({ id: user.id, name: user.name })}
>
  Delete
</Button>

// Modal
<ConfirmModal
  isOpen={deleteConfirm !== null}
  onClose={() => setDeleteConfirm(null)}
  onConfirm={async () => {
    if (deleteConfirm) {
      await DeleteUser(deleteConfirm.id);
      setDeleteConfirm(null);
      loadUsers();
    }
  }}
  title="Delete User"
  message={`Are you sure you want to delete ${deleteConfirm?.name}? This action cannot be undone.`}
  variant="danger"
  confirmText="Delete User"
  loading={deleting}
/>
```

---

### 6. Notifications/Alerts

**BEFORE:**
```tsx
{notification && (
  <div className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-lg p-4">
    <div className={`flex items-center ${notification.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
      <span>{notification.message}</span>
      <button onClick={() => setNotification(null)}>×</button>
    </div>
  </div>
)}
```

**AFTER:**
```tsx
{notification && (
  <Notification
    variant={notification.type}
    title={notification.title}
    message={notification.message}
    position="top-right"
    onClose={() => setNotification(null)}
  />
)}

// Or for inline alerts:
{error && (
  <Alert
    variant="danger"
    title="Error"
    message={error}
    dismissible
    onDismiss={() => setError('')}
  />
)}

{success && (
  <Alert
    variant="success"
    message={success}
    dismissible
    onDismiss={() => setSuccess('')}
  />
)}
```

---

## 🎨 Common Patterns

### Page Header with Action

```tsx
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
    <p className="mt-1 text-sm text-gray-500">
      Manage all users in the system
    </p>
  </div>
  <div className="flex items-center gap-3">
    <Button variant="outline" icon={<Download />}>
      Export
    </Button>
    <Button variant="primary" icon={<Plus />} onClick={() => setShowAddModal(true)}>
      Add User
    </Button>
  </div>
</div>
```

### Info Cards (like Last Login)

```tsx
<Card>
  <CardHeader title="Account Information" />
  <CardBody>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <InfoCard
        icon={<Clock className="h-6 w-6" />}
        iconColor="blue"
        label="Last Login"
        value={formatDateTime(lastLogin.login_time)}
      />
      <InfoCard
        icon={<MapPin className="h-6 w-6" />}
        iconColor="purple"
        label="Last PC Used"
        value={lastLogin.pc_number || 'Unknown'}
      />
    </div>
  </CardBody>
</Card>
```

### Attendance Summary Cards

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
    <CardBody>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center shadow-md">
          <CheckCircle className="h-7 w-7 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium text-green-700 uppercase">Present</p>
          <p className="text-4xl font-bold text-green-900">{presentCount}</p>
        </div>
      </div>
    </CardBody>
  </Card>

  <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
    <CardBody>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center shadow-md">
          <XCircle className="h-7 w-7 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium text-red-700 uppercase">Absent</p>
          <p className="text-4xl font-bold text-red-900">{absentCount}</p>
        </div>
      </div>
    </CardBody>
  </Card>

  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
    <CardBody>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center shadow-md">
          <Users className="h-7 w-7 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium text-blue-700 uppercase">Seat-in</p>
          <p className="text-4xl font-bold text-blue-900">{seatInCount}</p>
        </div>
      </div>
    </CardBody>
  </Card>
</div>
```

---

## 📝 Checklist for Each Page

When updating a page, ensure you:

- [ ] Replace custom cards with `Card` component
- [ ] Use `StatCard` for dashboard statistics
- [ ] Replace tables with `Table` component
- [ ] Update all buttons to use `Button` component
- [ ] Replace forms with Form components (`InputField`, `SelectField`, etc.)
- [ ] Use `Modal` for dialogs
- [ ] Replace alerts with `Alert` or `Notification`
- [ ] Use `Badge` for status indicators
- [ ] Apply consistent spacing (`gap-6`, `space-y-6`)
- [ ] Ensure responsive layout (`grid`, `flex` with breakpoints)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test keyboard navigation
- [ ] Verify color contrast

---

## 🐛 Common Issues & Solutions

### Issue: Modal closes when clicking inside
**Solution:** Modal already handles this. Ensure you're using the new `Modal` component, not custom divs.

### Issue: Table not sorting
**Solution:** Make sure you pass `onSort` handler and manage `sortKey` and `sortDirection` state.

### Issue: Form validation not showing
**Solution:** Pass `error` prop to form fields with error message string.

### Issue: Icons not showing
**Solution:** Import from `lucide-react` and pass as JSX: `icon={<Plus className="h-4 w-4" />}`

### Issue: Styles not applying
**Solution:** Run `npm run dev` to rebuild Tailwind. Check that class names match the design system.

---

## 🚀 Performance Tips

1. **Memoize table columns** to prevent re-renders:
```tsx
const columns = useMemo(() => [
  { key: 'name', label: 'Name', sortable: true },
  // ...
], []);
```

2. **Debounce search input** to reduce API calls:
```tsx
const debouncedSearch = useMemo(
  () => debounce((value: string) => setSearchTerm(value), 300),
  []
);
```

3. **Virtualize long tables** if you have 1000+ rows (consider react-window).

4. **Lazy load modals** if they contain heavy components.

---

This implementation guide should help you systematically update your entire application with the new design system!
