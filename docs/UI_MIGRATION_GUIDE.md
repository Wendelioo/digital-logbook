# Quick Migration Guide - Modern UI Update

This guide helps you update existing dashboard pages to use the new modern UI design system.

## Before You Start

✅ Tailwind config updated with new color palette  
✅ Layout component redesigned with left sidebar  
✅ All component libraries updated (Button, Card, Table, Modal, Form)  
✅ Global CSS updated with new design tokens  

## Step-by-Step Migration

### 1. Update Color References

**Find and Replace** these color references across your components:

#### Primary Colors
```tsx
// OLD → NEW
bg-blue-500 → bg-primary-600
text-blue-600 → text-primary-600
border-blue-300 → border-primary-300
ring-blue-500 → ring-primary-500
hover:bg-blue-600 → hover:bg-primary-700
```

#### Gray Colors (Warmer tones)
```tsx
// OLD → NEW
bg-gray-100 → bg-gray-100 (same, but warmer tone)
text-gray-500 → text-gray-600 (slightly darker for better contrast)
text-gray-900 → text-gray-900 (warmer black)
```

#### Success/Danger/Warning
```tsx
// Colors are softer - no code changes needed
// Just visually lighter and more muted
```

### 2. Update Border Radius

```tsx
// OLD → NEW
rounded-lg → rounded-xl (for cards, modals)
rounded-md → rounded-lg (for buttons)
```

### 3. Update Shadows

```tsx
// OLD → NEW
shadow-sm → shadow-soft
shadow-md → shadow-card
shadow-lg → shadow-lg-soft
shadow-xl → shadow-2xl (for modals)
```

### 4. Update Button Variants

**Primary buttons are now filled, not outlined:**

```tsx
// OLD (all buttons were outlined/neutral)
<Button variant="primary">Save</Button>
// Rendered as: white bg, gray text, gray border

// NEW (primary is filled)
<Button variant="primary">Save</Button>
// Renders as: primary-600 bg, white text

// For outlined style, use:
<Button variant="outline">Cancel</Button>
```

**Updated variant mapping:**
```tsx
primary   → Filled primary color (NEW!)
secondary → Neutral filled (gray-100)
outline   → White with border (was "primary")
ghost     → No background, hover effect
link      → Text with underline on hover
```

### 5. Update Layout Usage

**Old way (top navigation):**
```tsx
<Layout title="Dashboard">
  {/* Content */}
</Layout>
```

**New way (left sidebar navigation):**
```tsx
const navigationItems = [
  { 
    name: 'Dashboard', 
    href: '/admin/dashboard', 
    icon: <LayoutDashboard className="w-5 h-5" />, 
    current: true 
  },
  { 
    name: 'Users', 
    href: '/admin/users', 
    icon: <Users className="w-5 h-5" />, 
    current: false 
  },
  // ... more items
];

<Layout 
  navigationItems={navigationItems}
  title="Dashboard"
  subtitle="Welcome back!" // Optional
>
  {/* Content - already wrapped, no need for extra container */}
</Layout>
```

### 6. Update Card Structure

**Old:**
```tsx
<div className="bg-white rounded-lg shadow p-6">
  <h2>Title</h2>
  {/* Content */}
</div>
```

**New:**
```tsx
import { Card, CardHeader, CardBody } from '@/components/Card';

<Card>
  <CardHeader title="Title" subtitle="Optional subtitle" />
  <CardBody>
    {/* Content */}
  </CardBody>
</Card>
```

### 7. Update Table Styling

**Old:**
```tsx
<table className="min-w-full">
  <thead className="bg-gray-100">
    {/* ... */}
  </thead>
  <tbody>
    {/* ... */}
  </tbody>
</table>
```

**New:**
```tsx
import Table from '@/components/Table';

<Table
  data={items}
  columns={[
    { 
      key: 'name', 
      label: 'Name', 
      sortable: true 
    },
    { 
      key: 'email', 
      label: 'Email' 
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item) => (
        <Button size="sm" variant="outline">Edit</Button>
      )
    }
  ]}
  striped
  hoverable
  sortKey={sortKey}
  sortDirection={sortDirection}
  onSort={handleSort}
/>
```

### 8. Update Modal Styling

**Old:**
```tsx
{showModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50">
    <div className="bg-white rounded-lg p-6">
      {/* Content */}
    </div>
  </div>
)}
```

**New:**
```tsx
import Modal from '@/components/Modal';

<Modal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  title="Modal Title"
  size="lg"
  footer={
    <>
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button variant="primary" onClick={onSave}>Save</Button>
    </>
  }
>
  {/* Content */}
</Modal>
```

### 9. Update Form Fields

**Old:**
```tsx
<div className="mb-4">
  <label className="block text-sm font-medium mb-2">
    Name
  </label>
  <input 
    type="text" 
    className="w-full border rounded px-3 py-2"
  />
</div>
```

**New:**
```tsx
import { InputField, FormGroup } from '@/components/Form';

<FormGroup>
  <InputField
    label="Name"
    type="text"
    value={name}
    onChange={(e) => setName(e.target.value)}
    required
    error={errors.name}
    helperText="Enter your full name"
  />
</FormGroup>
```

### 10. Update StatCard/Metrics

**Old:**
```tsx
<div className="bg-white p-6 rounded-lg shadow">
  <div className="text-3xl font-bold">{count}</div>
  <div className="text-gray-600">Total Users</div>
</div>
```

**New:**
```tsx
import { StatCard } from '@/components/Card';

<StatCard
  title="Total Users"
  value={count}
  icon={<Users className="w-6 h-6" />}
  color="blue"
  trend={{
    value: 12,
    isPositive: true
  }}
/>
```

## Common Patterns

### Dashboard Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
  <StatCard title="Metric 1" value="1,234" color="blue" />
  <StatCard title="Metric 2" value="567" color="green" />
  <StatCard title="Metric 3" value="89" color="yellow" />
  <StatCard title="Metric 4" value="42" color="red" />
</div>
```

### Action Buttons
```tsx
<div className="flex items-center gap-3">
  <Button 
    variant="primary" 
    icon={<Plus className="w-4 h-4" />}
    onClick={handleAdd}
  >
    Add New
  </Button>
  <Button 
    variant="outline"
    icon={<Download className="w-4 h-4" />}
    onClick={handleExport}
  >
    Export
  </Button>
</div>
```

### Search & Filter Bar
```tsx
<div className="flex items-center gap-4 mb-6">
  <InputField
    placeholder="Search..."
    icon={<Search className="w-4 h-4" />}
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    fullWidth={false}
    className="w-64"
  />
  <SelectField
    options={[
      { value: 'all', label: 'All' },
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' }
    ]}
    value={filter}
    onChange={(e) => setFilter(e.target.value)}
    fullWidth={false}
    className="w-48"
  />
</div>
```

## Page-Specific Updates

### Admin Dashboard
```tsx
import { LayoutDashboard, Users, FileText, Settings } from 'lucide-react';

const navigationItems = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: <LayoutDashboard />, current: true },
  { name: 'User Management', href: '/admin/users', icon: <Users />, current: false },
  { name: 'Reports', href: '/admin/reports', icon: <FileText />, current: false },
  { name: 'Settings', href: '/admin/settings', icon: <Settings />, current: false },
];
```

### Teacher Dashboard
```tsx
import { LayoutDashboard, Users, ClipboardList, Clock } from 'lucide-react';

const navigationItems = [
  { name: 'Dashboard', href: '/teacher/dashboard', icon: <LayoutDashboard />, current: true },
  { name: 'My Classes', href: '/teacher/classes', icon: <Users />, current: false },
  { name: 'Attendance', href: '/teacher/attendance', icon: <ClipboardList />, current: false },
  { name: 'History', href: '/teacher/history', icon: <Clock />, current: false },
];
```

### Student Dashboard
```tsx
import { LayoutDashboard, Calendar, FileText } from 'lucide-react';

const navigationItems = [
  { name: 'Dashboard', href: '/student/dashboard', icon: <LayoutDashboard />, current: true },
  { name: 'My Classes', href: '/student/classes', icon: <Calendar />, current: false },
  { name: 'Attendance', href: '/student/attendance', icon: <FileText />, current: false },
];
```

## Testing Checklist

After migration, verify:

- [ ] Sidebar navigation works and collapses correctly
- [ ] All buttons use updated variants (primary is filled)
- [ ] Colors match new palette (warmer, softer tones)
- [ ] Tables have proper spacing and hover effects
- [ ] Modals have backdrop blur effect
- [ ] Forms have proper validation states
- [ ] Cards have consistent border radius (12px)
- [ ] Shadows are softer and more subtle
- [ ] Typography hierarchy is maintained
- [ ] Responsive behavior works on different screen sizes
- [ ] User profile dropdown works correctly
- [ ] Account settings modal opens and functions
- [ ] Logout flow works (especially for students)

## Troubleshooting

### Issue: Sidebar not showing
**Solution:** Make sure you're passing `navigationItems` prop to Layout

### Issue: Buttons look wrong (still outlined)
**Solution:** Update variant from "primary" to "outline" for neutral buttons, or keep "primary" for filled accent buttons

### Issue: Colors look too bright
**Solution:** You may be using old color values. Check tailwind.config.js was updated

### Issue: Layout content too wide
**Solution:** Remove any manual container div inside Layout - it's now built-in

### Issue: Modal backdrop not blurring
**Solution:** Update modal overlay class to `bg-gray-900/60 backdrop-blur-sm`

## Need Help?

Refer to:
- [MODERN_UI_DESIGN_SYSTEM.md](./MODERN_UI_DESIGN_SYSTEM.md) - Complete design system docs
- [COMPONENT_QUICK_REFERENCE.md](./COMPONENT_QUICK_REFERENCE.md) - Component API reference
- Component source files in `frontend/src/components/`

## Example: Complete Page Update

**Before:**
```tsx
function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded shadow">
            <div className="text-2xl font-bold">150</div>
            <div className="text-gray-600">Total Users</div>
          </div>
          {/* More stats */}
        </div>
        
        <div className="bg-white rounded shadow">
          <div className="p-4 border-b">
            <h2>Recent Activity</h2>
          </div>
          <table>
            {/* Table content */}
          </table>
        </div>
      </div>
    </div>
  );
}
```

**After:**
```tsx
import { Layout, Card, CardHeader, CardBody, StatCard, Table } from '@/components';
import { LayoutDashboard, Users, Settings } from 'lucide-react';

function AdminDashboard() {
  const navigationItems = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: <LayoutDashboard />, current: true },
    { name: 'Users', href: '/admin/users', icon: <Users />, current: false },
    { name: 'Settings', href: '/admin/settings', icon: <Settings />, current: false },
  ];

  return (
    <Layout 
      navigationItems={navigationItems}
      title="Dashboard"
      subtitle="Welcome back! Here's what's happening today."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatCard
          title="Total Users"
          value="150"
          icon={<Users className="w-6 h-6" />}
          color="blue"
        />
        {/* More stats */}
      </div>
      
      <Card>
        <CardHeader title="Recent Activity" />
        <CardBody noPadding>
          <Table
            data={activities}
            columns={columns}
            striped
            hoverable
          />
        </CardBody>
      </Card>
    </Layout>
  );
}
```

---

**Success!** Your page now uses the modern UI design system with:
✓ Left sidebar navigation
✓ Soft, warm color palette
✓ Consistent component styling
✓ Professional, clean appearance
