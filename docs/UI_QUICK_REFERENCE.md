# Quick Visual Reference - Modern UI Design System

## 🎨 Color Palette Cheat Sheet

### Primary (Muted Blue-Gray)
```
50  #f8f9fb  bg-primary-50    Lightest bg
100 #f1f3f7  bg-primary-100   Light bg
500 #7889a8  bg-primary-500   Base
600 #5b6d8f  bg-primary-600   ⭐ Buttons
700 #4a5873  bg-primary-700   Hover
```

### Neutral Gray (Warm)
```
50  #fafaf9  bg-gray-50       ⭐ Page bg
100 #f5f5f4  bg-gray-100      Secondary bg
200 #ebebea  bg-gray-200      ⭐ Borders
600 #5e5c60  text-gray-600    Secondary text
700 #4a484c  text-gray-700    ⭐ Primary text
900 #2d2b2f  text-gray-900    ⭐ Headings
```

### Status Colors
```
success-600  #2d7d5d  ✅ Success buttons
danger-600   #d33f3f  ❌ Error buttons
warning-600  #e58b1e  ⚠️  Warning buttons
```

## 📐 Spacing Quick Reference

```tsx
Gap/Margin/Padding Scale (4px grid)
1   = 4px    → gap-1
2   = 8px    → gap-2
3   = 12px   → gap-3
4   = 16px   → gap-4  ⭐ Forms
5   = 20px   → gap-5
6   = 24px   → gap-6  ⭐ Cards
8   = 32px   → gap-8
```

## 🔘 Button Quick Copy

```tsx
// Primary Action (Filled)
<Button variant="primary">Save</Button>

// Secondary/Cancel (Neutral)
<Button variant="outline">Cancel</Button>

// Destructive
<Button variant="danger">Delete</Button>

// With Icon
<Button variant="primary" icon={<Plus />}>Add New</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>  ⭐ Default
<Button size="lg">Large</Button>
```

## 📦 Card Quick Copy

```tsx
// Standard Card
<Card>
  <CardHeader title="Title" subtitle="Subtitle" />
  <CardBody>
    Content here
  </CardBody>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>

// Stat Card
<StatCard
  title="Total Users"
  value="1,234"
  icon={<Users className="w-6 h-6" />}
  color="blue"
/>
```

## 📊 Table Quick Copy

```tsx
<Table
  data={items}
  columns={[
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email' },
    { 
      key: 'actions', 
      label: 'Actions',
      render: (item) => <Button size="sm">Edit</Button>
    }
  ]}
  striped
  hoverable
  sortKey={sortKey}
  sortDirection={sortDirection}
  onSort={handleSort}
/>
```

## 🪟 Modal Quick Copy

```tsx
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
  <p>Modal content here</p>
</Modal>
```

## 📝 Form Quick Copy

```tsx
import { InputField, SelectField, FormGroup, FormRow } from '@/components/Form';

// Single Input
<FormGroup>
  <InputField
    label="Full Name"
    type="text"
    value={name}
    onChange={(e) => setName(e.target.value)}
    required
    error={errors.name}
    helperText="Enter your legal name"
  />
</FormGroup>

// Two Column Row
<FormRow columns={2}>
  <InputField label="First Name" />
  <InputField label="Last Name" />
</FormRow>

// Select
<SelectField
  label="Role"
  options={[
    { value: 'admin', label: 'Administrator' },
    { value: 'user', label: 'User' }
  ]}
  value={role}
  onChange={(e) => setRole(e.target.value)}
/>
```

## 🧭 Layout Quick Copy

```tsx
import { Layout } from '@/components/Layout';
import { LayoutDashboard, Users, Settings } from 'lucide-react';

function MyPage() {
  const navigationItems = [
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      icon: <LayoutDashboard className="w-5 h-5" />, 
      current: true 
    },
    { 
      name: 'Users', 
      href: '/users', 
      icon: <Users className="w-5 h-5" />, 
      current: false 
    },
    { 
      name: 'Settings', 
      href: '/settings', 
      icon: <Settings className="w-5 h-5" />, 
      current: false 
    },
  ];

  return (
    <Layout 
      navigationItems={navigationItems}
      title="Page Title"
      subtitle="Optional subtitle"
    >
      {/* Content - already has proper spacing */}
      <div className="space-y-6">
        {/* Your content */}
      </div>
    </Layout>
  );
}
```

## 📏 Common Patterns

### Dashboard Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <StatCard title="Metric 1" value="100" color="blue" />
  <StatCard title="Metric 2" value="200" color="green" />
  <StatCard title="Metric 3" value="300" color="yellow" />
  <StatCard title="Metric 4" value="400" color="red" />
</div>
```

### Search Bar
```tsx
<div className="flex items-center gap-4 mb-6">
  <InputField
    placeholder="Search..."
    icon={<Search className="w-4 h-4" />}
    className="w-64"
  />
  <Button variant="primary">Search</Button>
</div>
```

### Action Bar
```tsx
<div className="flex items-center justify-between mb-6">
  <h2 className="text-xl font-semibold text-gray-900">Users</h2>
  <div className="flex items-center gap-3">
    <Button variant="outline" icon={<Download />}>Export</Button>
    <Button variant="primary" icon={<Plus />}>Add New</Button>
  </div>
</div>
```

### Loading State
```tsx
{loading ? (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
  </div>
) : (
  <Table data={data} columns={columns} />
)}
```

### Empty State
```tsx
<div className="flex flex-col items-center justify-center h-64 text-center">
  <svg className="w-16 h-16 text-gray-300 mb-4" />
  <h3 className="text-lg font-semibold text-gray-900 mb-2">No data found</h3>
  <p className="text-sm text-gray-600 mb-4">Get started by adding your first item</p>
  <Button variant="primary" icon={<Plus />}>Add Item</Button>
</div>
```

## 🎭 State Variants

### Button States
```tsx
// Normal
<Button variant="primary">Save</Button>

// Loading
<Button variant="primary" loading>Saving...</Button>

// Disabled
<Button variant="primary" disabled>Save</Button>

// Full Width
<Button variant="primary" fullWidth>Continue</Button>
```

### Input States
```tsx
// Normal
<InputField label="Name" value={name} />

// Error
<InputField label="Name" value={name} error="Name is required" />

// Disabled
<InputField label="Name" value={name} disabled />

// With Icon
<InputField label="Search" icon={<Search />} />
```

### Alert Messages
```tsx
// Success
<div className="bg-success-50 border-l-4 border-success-500 p-4 rounded-lg">
  <p className="text-sm text-success-700">Operation completed successfully!</p>
</div>

// Error
<div className="bg-danger-50 border-l-4 border-danger-500 p-4 rounded-lg">
  <p className="text-sm text-danger-700">An error occurred. Please try again.</p>
</div>

// Warning
<div className="bg-warning-50 border-l-4 border-warning-500 p-4 rounded-lg">
  <p className="text-sm text-warning-700">Warning: This action cannot be undone.</p>
</div>

// Info
<div className="bg-primary-50 border-l-4 border-primary-500 p-4 rounded-lg">
  <p className="text-sm text-primary-700">Here's some helpful information.</p>
</div>
```

## 🎨 Utility Classes Cheat Sheet

### Text Colors
```tsx
text-gray-900   // Headings
text-gray-700   // Primary text (⭐ most common)
text-gray-600   // Secondary text
text-gray-500   // Muted text
```

### Background Colors
```tsx
bg-white        // Cards, modals
bg-gray-50      // Page background (⭐ default)
bg-gray-100     // Secondary backgrounds
bg-primary-50   // Hover states (light)
```

### Borders
```tsx
border-gray-200    // ⭐ Default borders
border-gray-300    // Darker borders
border-t           // Top border
border-b           // Bottom border
```

### Shadows
```tsx
shadow-soft        // ⭐ Buttons, small cards
shadow-card        // ⭐ Cards
shadow-card-hover  // Hover state
shadow-2xl         // Modals
```

### Border Radius
```tsx
rounded-lg         // Inputs, small items
rounded-xl         // ⭐ Cards, modals
rounded-full       // Avatars, badges
rounded-button     // Buttons (8px)
```

### Spacing
```tsx
p-6     // ⭐ Card padding (24px)
py-2.5  // Button vertical (10px)
px-4    // Button horizontal (16px)
gap-6   // Grid/flex gap (24px)
gap-4   // Form gap (16px)
space-y-6  // Stack spacing (24px)
```

## 📱 Responsive Classes

```tsx
// Mobile first approach
<div className="
  grid 
  grid-cols-1           /* Mobile: 1 column */
  md:grid-cols-2        /* Tablet: 2 columns */
  lg:grid-cols-4        /* Desktop: 4 columns */
  gap-4 md:gap-6        /* Smaller gap on mobile */
">
```

## 🔍 Icon Sizes

```tsx
// Standard icon sizes
<Users className="w-4 h-4" />   // Small (buttons, inputs)
<Users className="w-5 h-5" />   // Medium (navigation) ⭐
<Users className="w-6 h-6" />   // Large (stat cards)
<Users className="w-8 h-8" />   // Extra large (empty states)
```

## ⚡ Performance Tips

```tsx
// Use memo for expensive components
const MemoizedTable = React.memo(Table);

// Lazy load heavy components
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

// Debounce search inputs
const debouncedSearch = useMemo(
  () => debounce((value) => setSearch(value), 300),
  []
);
```

---

**Tip**: Bookmark this page for quick reference while coding!  
**File**: [docs/UI_QUICK_REFERENCE.md](./UI_QUICK_REFERENCE.md)
