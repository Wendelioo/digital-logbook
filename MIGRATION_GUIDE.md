# Quick Migration Guide

## How to Start Using the Refactored Components

### Step 1: Import the New Components

Add these imports to your dashboard files:

```typescript
import Button from '../components/Button';
import Modal from '../components/Modal';
import { useUsers } from '../hooks/useUsers';
```

### Step 2: Replace Inline Buttons (Easy Win!)

**Find patterns like this in your code:**

```tsx
// ❌ OLD WAY - Custom inline styling
<button
  onClick={() => setShowAddUser(true)}
  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2"
>
  <UserPlus className="h-4 w-4 mr-2" />
  Add User
</button>
```

**Replace with:**

```tsx
// ✅ NEW WAY - Reusable Button component
<Button 
  variant="primary" 
  icon={<UserPlus className="h-4 w-4" />}
  onClick={() => setShowAddUser(true)}
>
  Add User
</Button>
```

**Search & Replace Guide:**
1. Find: `<button.*className=".*bg-blue-.*".*>`
2. Review each instance
3. Replace with appropriate Button variant

### Step 3: Replace Custom Modals

**Find patterns like this:**

```tsx
// ❌ OLD WAY - 30+ lines of modal boilerplate
{showModal && (
  <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center">
    <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl">
      <div className="flex items-center justify-between p-6 border-b">
        <h2 className="text-xl font-semibold">{modalTitle}</h2>
        <button onClick={() => setShowModal(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="p-6">
        {modalContent}
      </div>
    </div>
  </div>
)}
```

**Replace with:**

```tsx
// ✅ NEW WAY - 3 lines with Modal component
<Modal isOpen={showModal} onClose={() => setShowModal(false)} title={modalTitle}>
  {modalContent}
</Modal>
```

### Step 4: Simplify Data Fetching with useUsers

**Find patterns like this:**

```tsx
// ❌ OLD WAY - Duplicate state management code
const [users, setUsers] = useState<User[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const loadUsers = async () => {
  setLoading(true);
  setError(null);
  try {
    const data = await GetUsers();
    setUsers(data || []);
  } catch (err) {
    setError('Failed to load users');
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  loadUsers();
}, []);
```

**Replace with:**

```tsx
// ✅ NEW WAY - One hook does everything
const { users, loading, error, fetchUsers } = useUsers();

useEffect(() => {
  fetchUsers();
}, [fetchUsers]);
```

## Real Example: Refactoring a Dashboard Section

### Before (From AdminDashboard.tsx)

```tsx
function UserManagementSection() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await GetUsers();
      setUsers(data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <div>
      <button
        onClick={() => setShowAddModal(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Add User
      </button>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6">
            <h2>Add User</h2>
            {/* Modal content */}
          </div>
        </div>
      )}

      {/* User list */}
    </div>
  );
}
```

### After (Using Refactored Components)

```tsx
import Button from '../components/Button';
import Modal from '../components/Modal';
import { useUsers } from '../hooks/useUsers';
import { UserPlus } from 'lucide-react';

function UserManagementSection() {
  const { users, loading, fetchUsers } = useUsers();
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div>
      <Button 
        variant="primary" 
        icon={<UserPlus className="h-4 w-4" />}
        onClick={() => setShowAddModal(true)}
      >
        Add User
      </Button>

      <Modal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        title="Add User"
      >
        {/* Modal content */}
      </Modal>

      {/* User list */}
    </div>
  );
}
```

**Result:**
- ✓ Reduced from ~40 lines to ~25 lines
- ✓ Eliminated duplicate state management code
- ✓ Consistent UI/UX with shared components
- ✓ Easier to maintain and test

## Common Patterns to Replace

### Pattern 1: Loading Buttons

```tsx
// ❌ Before
<button 
  disabled={isSubmitting}
  className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
>
  {isSubmitting ? 'Saving...' : 'Save'}
</button>

// ✅ After
<Button variant="primary" loading={isSubmitting}>
  Save
</Button>
```

### Pattern 2: Delete Buttons

```tsx
// ❌ Before
<button 
  onClick={() => handleDelete(user.id)}
  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
>
  <Trash2 className="h-3 w-3" />
  Delete
</button>

// ✅ After
<Button 
  variant="danger" 
  size="sm"
  icon={<Trash2 className="h-3 w-3" />}
  onClick={() => handleDelete(user.id)}
>
  Delete
</Button>
```

### Pattern 3: Search with User Filtering

```tsx
// ❌ Before - Manual filtering logic in component
const [users, setUsers] = useState([]);
const [searchTerm, setSearchTerm] = useState('');
const filteredUsers = users.filter(u => 
  u.name.toLowerCase().includes(searchTerm.toLowerCase())
);

// ✅ After - Use hook's built-in search
const { users, searchUsers } = useUsers();

const handleSearch = (term: string) => {
  if (term === '') {
    fetchUsers();
  } else {
    searchUsers(term);
  }
};
```

## Migration Checklist

Use this checklist to track your progress:

### AdminDashboard.tsx
- [ ] Replace all `<button>` with `<Button>` component
- [ ] Replace custom modal implementations with `<Modal>`
- [ ] Use `useUsers` hook for user data
- [ ] Extract UserManagement into separate component

### TeacherDashboard.tsx
- [ ] Replace buttons with `<Button>` component
- [ ] Replace modals with `<Modal>`
- [ ] Create `useClasses` hook
- [ ] Create `useAttendance` hook
- [ ] Extract ClassManagement component

### StudentDashboard.tsx
- [ ] Replace buttons with `<Button>` component
- [ ] Replace modals with `<Modal>`
- [ ] Use `useAttendance` for personal attendance
- [ ] Extract AttendanceHistory component

### WorkingStudentDashboard.tsx
- [ ] Replace buttons with `<Button>` component
- [ ] Replace modals with `<Modal>`
- [ ] Create `useFeedback` hook
- [ ] Extract StudentRegistration component

## Testing After Migration

For each file you update:

1. **Visual Check**
   ```bash
   npm run dev  # or wails dev
   ```
   - Verify buttons look correct
   - Test all button variants (hover, click, disabled)
   - Check modal open/close behavior
   - Test keyboard navigation (Tab, Escape)

2. **Functional Check**
   - Test create, update, delete operations
   - Verify error messages display correctly
   - Ensure loading states work
   - Check that data refreshes after mutations

3. **Accessibility Check**
   - Tab through all interactive elements
   - Use screen reader to verify labels
   - Test with keyboard only (no mouse)

## Pro Tips

1. **Start Small**: Begin with one dashboard, get comfortable, then move to others
2. **Keep Old Code**: Don't delete original code until new code is tested
3. **Use Git Branches**: Create branch for each dashboard refactoring
4. **Test Incrementally**: Test after each component replacement
5. **Ask for Help**: If stuck, refer to UserManagement.tsx example

## Estimated Time Investment

| Task | Time | Difficulty |
|------|------|-----------|
| Replace buttons | 1-2 hours | Easy |
| Replace modals | 2-3 hours | Easy |
| Integrate useUsers hook | 1 hour | Medium |
| Extract sub-components | 4-6 hours | Medium |
| Full dashboard refactor | 8-12 hours | Hard |

**Total for all dashboards**: 20-30 hours spread over 1-2 weeks

## Need Help?

1. Check `UserManagement.tsx` for complete example
2. Read `REFACTORING_GUIDE.md` for detailed patterns
3. See `IMPLEMENTATION_SUMMARY.md` for what's been done
4. Test locally before committing changes

---

**Remember**: Refactoring is iterative. Don't try to do everything at once!
