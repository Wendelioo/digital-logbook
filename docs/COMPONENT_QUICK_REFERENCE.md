# UI Component Quick Reference

A quick cheat sheet for using the Digital Logbook design system components.

---

## 🔘 Buttons

```tsx
import Button from '../components/Button';

// Primary action
<Button variant="primary" onClick={handleSave}>Save</Button>

// Delete/Danger
<Button variant="danger" icon={<Trash2 />}>Delete</Button>

// With loading state
<Button variant="primary" loading={isSaving}>Submit</Button>

// With icon (left or right)
<Button variant="outline" icon={<Plus />} iconPosition="left">Add New</Button>

// Sizes
<Button size="xs">Extra Small</Button>
<Button size="sm">Small</Button>
<Button size="md">Medium (default)</Button>
<Button size="lg">Large</Button>
<Button size="xl">Extra Large</Button>

// Full width
<Button variant="primary" fullWidth>Full Width Button</Button>

// All variants
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="success">Success</Button>
<Button variant="warning">Warning</Button>
<Button variant="danger">Danger</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
```

---

## 📦 Cards

```tsx
import { Card, CardHeader, CardBody, CardFooter, StatCard, InfoCard } from '../components/Card';

// Basic card
<Card>
  <CardBody>Content here</CardBody>
</Card>

// Card with header and footer
<Card>
  <CardHeader 
    title="Users" 
    subtitle="Manage system users"
    action={<Button size="sm">Add</Button>}
  />
  <CardBody>
    Content here
  </CardBody>
  <CardFooter>
    <Button variant="outline">Cancel</Button>
    <Button variant="primary">Save</Button>
  </CardFooter>
</Card>

// Stat card (for dashboards)
<StatCard
  title="Total Users"
  value={1250}
  icon={<Users className="h-8 w-8" />}
  color="blue"
  trend={{ value: 12, isPositive: true }}
/>

// Info card
<InfoCard
  icon={<Clock className="h-6 w-6" />}
  iconColor="blue"
  label="Last Login"
  value="Jan 25, 2026 10:30 AM"
/>

// Hoverable card
<Card hoverable onClick={handleClick}>
  <CardBody>Click me</CardBody>
</Card>
```

---

## 📊 Tables

```tsx
import Table from '../components/Table';

const columns = [
  { 
    key: 'name', 
    label: 'Name', 
    sortable: true 
  },
  { 
    key: 'email', 
    label: 'Email', 
    sortable: true 
  },
  { 
    key: 'role', 
    label: 'Role',
    render: (user) => <Badge variant="primary">{user.role}</Badge>
  },
  { 
    key: 'actions', 
    label: 'Actions',
    align: 'right',
    render: (user) => (
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline">Edit</Button>
        <Button size="sm" variant="danger">Delete</Button>
      </div>
    )
  }
];

<Table
  data={users}
  columns={columns}
  sortKey={sortKey}
  sortDirection={sortDirection}
  onSort={handleSort}
  loading={loading}
  emptyMessage="No users found"
  hoverable
  striped
  stickyHeader
  compact={false}
/>
```

---

## 📝 Forms

```tsx
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

<form onSubmit={handleSubmit}>
  <FormSection 
    title="Personal Information"
    description="Enter your personal details"
  >
    {/* 2-column row */}
    <FormRow columns={2}>
      <InputField
        label="First Name"
        required
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        error={errors.firstName}
        helperText="As shown on your ID"
      />
      <InputField
        label="Last Name"
        required
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
      />
    </FormRow>

    {/* Input with icon */}
    <InputField
      label="Email"
      type="email"
      icon={<Mail className="h-4 w-4" />}
      value={email}
      onChange={(e) => setEmail(e.target.value)}
    />

    {/* Select field */}
    <SelectField
      label="Department"
      required
      options={[
        { value: '', label: 'Select Department', disabled: true },
        { value: 'CS', label: 'Computer Science' },
        { value: 'IT', label: 'Information Technology' }
      ]}
      value={department}
      onChange={(e) => setDepartment(e.target.value)}
    />

    {/* Textarea */}
    <TextAreaField
      label="Bio"
      value={bio}
      onChange={(e) => setBio(e.target.value)}
      helperText="Tell us about yourself"
    />

    {/* Checkbox */}
    <CheckboxField
      label="I agree to the terms and conditions"
      checked={agreed}
      onChange={(e) => setAgreed(e.target.checked)}
    />

    {/* Radio group */}
    <RadioGroup
      label="Gender"
      name="gender"
      options={[
        { value: 'male', label: 'Male' },
        { value: 'female', label: 'Female' },
        { value: 'other', label: 'Other', description: 'Prefer not to say' }
      ]}
      value={gender}
      onChange={setGender}
    />
  </FormSection>

  <div className="flex justify-end gap-3 mt-6">
    <Button variant="outline" type="button">Cancel</Button>
    <Button variant="primary" type="submit" loading={saving}>Submit</Button>
  </div>
</form>
```

---

## 🪟 Modals

```tsx
import Modal, { ConfirmModal } from '../components/Modal';

// Basic modal
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Add User"
  size="lg"
  footer={
    <>
      <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
      <Button variant="primary" onClick={handleSave}>Save</Button>
    </>
  }
>
  <p>Modal content here</p>
</Modal>

// Confirmation modal
<ConfirmModal
  isOpen={showConfirm}
  onClose={() => setShowConfirm(false)}
  onConfirm={handleDelete}
  title="Delete User"
  message="Are you sure? This cannot be undone."
  variant="danger"
  confirmText="Delete"
  cancelText="Cancel"
  loading={deleting}
/>

// Modal variants
<Modal variant="default">...</Modal>
<Modal variant="danger">...</Modal>
<Modal variant="success">...</Modal>
<Modal variant="warning">...</Modal>
<Modal variant="info">...</Modal>

// Modal sizes
<Modal size="sm">...</Modal>   {/* 384px */}
<Modal size="md">...</Modal>   {/* 512px */}
<Modal size="lg">...</Modal>   {/* 672px - default */}
<Modal size="xl">...</Modal>   {/* 896px */}
<Modal size="2xl">...</Modal>  {/* 1152px */}
<Modal size="full">...</Modal> {/* 95vw */}
```

---

## 🏷️ Badges & Alerts

```tsx
import { Badge, StatusBadge, Alert, Notification } from '../components/Badge';

// Basic badge
<Badge variant="primary">New</Badge>
<Badge variant="success">Active</Badge>
<Badge variant="danger">Inactive</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="info">Info</Badge>
<Badge variant="gray">Default</Badge>

// Rounded badge
<Badge variant="success" rounded>10</Badge>

// Status badge (with dot)
<StatusBadge status="active" />
<StatusBadge status="inactive" />
<StatusBadge status="pending" label="In Review" />
<StatusBadge status="success" />
<StatusBadge status="error" />

// Alert (inline)
<Alert
  variant="success"
  title="Success!"
  message="User created successfully"
  dismissible
  onDismiss={() => setAlert(null)}
/>

<Alert
  variant="danger"
  message="An error occurred"
/>

// Notification (toast)
<Notification
  variant="success"
  title="Saved"
  message="Changes saved successfully"
  position="top-right"
  onClose={() => setNotification(null)}
/>

// Positions: top-right, top-left, bottom-right, bottom-left
```

---

## 🎨 Color Classes

### Background Colors
```tsx
bg-primary-50    // Very light blue
bg-primary-100
bg-primary-500   // Medium blue
bg-primary-600   // Main primary color
bg-primary-700   // Darker for hover
bg-primary-900   // Very dark

bg-success-50 to bg-success-900   // Green
bg-danger-50 to bg-danger-900     // Red
bg-warning-50 to bg-warning-900   // Yellow
bg-info-50 to bg-info-900         // Blue
bg-gray-50 to bg-gray-950         // Gray scale
```

### Text Colors
```tsx
text-primary-600   // Primary text color
text-success-600   // Success text
text-danger-600    // Error/danger text
text-warning-600   // Warning text
text-gray-900      // Dark text (default body)
text-gray-600      // Medium gray
text-gray-500      // Light gray (helper text)
```

### Border Colors
```tsx
border-primary-500
border-success-500
border-danger-500
border-warning-500
border-gray-200    // Default border
border-gray-300    // Input border
```

---

## 📐 Spacing Classes

### Padding
```tsx
p-2    // 8px all sides
p-4    // 16px
p-6    // 24px (card default)

px-3   // 12px horizontal
py-2   // 8px vertical

px-4 py-2.5  // Button medium
px-6 py-4    // Card body
```

### Gap (Grid/Flex)
```tsx
gap-2   // 8px (tight - button groups)
gap-3   // 12px
gap-4   // 16px (normal - form fields)
gap-6   // 24px (loose - cards)
gap-8   // 32px (sections)
```

### Space (Vertical Stack)
```tsx
space-y-2   // 8px between children
space-y-4   // 16px (form fields)
space-y-6   // 24px (sections)
space-y-8   // 32px (major blocks)
```

---

## 🔤 Typography Classes

### Font Sizes
```tsx
text-xs     // 12px (helper text, badges)
text-sm     // 14px (default body, form labels)
text-base   // 16px (larger body text)
text-lg     // 18px (section headings, card titles)
text-xl     // 20px
text-2xl    // 24px (page titles)
text-3xl    // 30px (hero text)
```

### Font Weights
```tsx
font-normal     // 400 (body text)
font-medium     // 500 (labels, emphasis)
font-semibold   // 600 (headings, buttons)
font-bold       // 700 (major headings)
```

### Text Colors
```tsx
text-gray-900   // Dark (headings, body)
text-gray-700   // Medium (labels)
text-gray-500   // Light (helper text)
text-gray-400   // Very light (placeholders)
```

---

## 📱 Responsive Classes

### Grid Columns
```tsx
// 1 column mobile, 2 tablet, 4 desktop
grid-cols-1 md:grid-cols-2 lg:grid-cols-4

// 1 column mobile, 2 desktop
grid-cols-1 md:grid-cols-2

// 1 column mobile, 3 desktop
grid-cols-1 lg:grid-cols-3
```

### Flex Direction
```tsx
// Stack on mobile, row on desktop
flex-col md:flex-row
```

### Display
```tsx
hidden md:block      // Hidden on mobile, visible on desktop
block md:hidden      // Visible on mobile, hidden on desktop
```

### Width
```tsx
w-full md:w-auto     // Full width mobile, auto desktop
w-full md:w-1/2      // Full width mobile, half on desktop
```

---

## 🎯 Common Patterns

### Page Header
```tsx
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-2xl font-bold text-gray-900">Page Title</h1>
    <p className="mt-1 text-sm text-gray-500">Subtitle or description</p>
  </div>
  <Button variant="primary" icon={<Plus />}>Add New</Button>
</div>
```

### Dashboard Stats Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <StatCard title="Metric 1" value={100} icon={<Icon />} color="blue" />
  <StatCard title="Metric 2" value={200} icon={<Icon />} color="green" />
  <StatCard title="Metric 3" value={300} icon={<Icon />} color="purple" />
  <StatCard title="Metric 4" value={400} icon={<Icon />} color="orange" />
</div>
```

### Search & Filter Bar
```tsx
<Card>
  <CardBody>
    <div className="flex flex-col md:flex-row gap-4">
      <div className="flex-1">
        <InputField 
          placeholder="Search..." 
          icon={<Search />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <SelectField 
        options={filterOptions}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <Button variant="outline" onClick={clearFilters}>Clear</Button>
    </div>
  </CardBody>
</Card>
```

### Action Buttons Group
```tsx
<div className="flex items-center gap-3">
  <Button variant="outline" icon={<Edit />}>Edit</Button>
  <Button variant="danger" icon={<Trash2 />}>Delete</Button>
</div>

// Right-aligned
<div className="flex items-center justify-end gap-3">
  <Button variant="outline">Cancel</Button>
  <Button variant="primary">Save</Button>
</div>
```

### Loading State
```tsx
{loading ? (
  <div className="flex items-center justify-center h-64">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p className="text-sm text-gray-500">Loading...</p>
    </div>
  </div>
) : (
  <Table data={data} columns={columns} />
)}
```

### Empty State
```tsx
<div className="flex flex-col items-center justify-center h-64 text-center">
  <Icon className="h-12 w-12 text-gray-300 mb-4" />
  <h3 className="text-lg font-medium text-gray-900">No data found</h3>
  <p className="mt-1 text-sm text-gray-500">Get started by adding a new item</p>
  <Button variant="primary" icon={<Plus />} className="mt-4">
    Add New
  </Button>
</div>
```

---

## ⚡ Quick Tips

1. **Always import from design system** - Don't create custom components
2. **Use semantic variants** - `danger` for delete, `success` for confirm
3. **Follow spacing system** - Use gap-4, gap-6, not arbitrary values
4. **Test all states** - default, hover, focus, disabled, loading
5. **Think mobile-first** - Use responsive classes
6. **Use loading states** - Show feedback during async operations
7. **Handle errors** - Display clear error messages
8. **Be consistent** - Use same patterns across the app

---

## 📚 More Resources

- Full documentation: `docs/UI_DESIGN_SYSTEM.md`
- Implementation guide: `docs/UI_IMPLEMENTATION_GUIDE.md`
- Recommendations: `docs/UI_UX_RECOMMENDATIONS.md`

---

Save this as a reference while developing! 🚀
