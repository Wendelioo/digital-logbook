# Modern UI Design System Documentation

## Overview

The Digital Logbook application now features a modern, professional desktop interface with a clean, intuitive, and user-friendly design following current UI/UX best practices.

## Design Principles

### Visual Identity
- **Light & Neutral**: Soft whites, warm grays, light beige tones
- **Calming Palette**: Subtle pastel accent colors
- **Professional**: Clean and minimal design
- **Desktop-Optimized**: Designed for extended daily use

### Layout Philosophy
- **Left Sidebar Navigation**: Primary navigation fixed on the left
- **No Logo in Sidebar**: Branding appears in top header if needed
- **Content-Focused**: Maximum space for main content
- **Responsive**: Adapts to different desktop screen sizes

---

## Color Palette

### Primary (Muted Blue-Gray)
```
primary-50:  #f8f9fb  (Lightest backgrounds)
primary-100: #f1f3f7
primary-200: #e3e7ef
primary-300: #d0d6e3
primary-400: #a3aec5
primary-500: #7889a8  (Base brand color)
primary-600: #5b6d8f  (Buttons, links)
primary-700: #4a5873
primary-800: #3d4a5e
primary-900: #343e4f
primary-950: #232933
```

### Neutral Grays (Warm Undertones)
```
gray-25:  #fefefe
gray-50:  #fafaf9  (Page backgrounds)
gray-100: #f5f5f4  (Secondary backgrounds)
gray-200: #ebebea  (Borders, dividers)
gray-300: #d7d6d5
gray-400: #a8a7a6
gray-500: #78767a  (Secondary text)
gray-600: #5e5c60
gray-700: #4a484c  (Primary text)
gray-800: #3a383c
gray-900: #2d2b2f  (Headings)
gray-950: #1a181b
```

### Success (Soft Green)
```
success-50:  #f3faf7
success-100: #e6f5ef
success-500: #3d9a73
success-600: #2d7d5d  (Buttons)
```

### Danger (Muted Red)
```
danger-50:  #fef6f6
danger-100: #fdeaea
danger-500: #e75c5c
danger-600: #d33f3f  (Buttons, errors)
```

### Warning (Soft Amber)
```
warning-50:  #fffbf5
warning-100: #fef4e6
warning-500: #f4a838
warning-600: #e58b1e
```

### Beige Accents
```
beige-50:  #fdfcfb
beige-100: #faf8f5
beige-200: #f5f1eb  (Subtle backgrounds)
```

---

## Layout Structure

### Left Sidebar
```tsx
// Fixed sidebar with collapsible state
- Width: 256px (expanded) / 64px (collapsed)
- Background: White (#ffffff)
- Border: 1px solid gray-200
- Position: Fixed left
- Z-index: 30

// Navigation Items
- Padding: 12px horizontally, 10px vertically
- Border radius: 8px
- Active state: primary-50 background, primary-600 text
- Hover state: gray-100 background
- Icon size: 20x20px
- Gap between icon and text: 12px

// User Profile Section (Bottom)
- Border top: 1px solid gray-200
- Avatar: 36x36px rounded-full
- Status indicator: 10px circle, success-500
```

### Top Header
```tsx
// Fixed header bar
- Height: 64px
- Background: White
- Border bottom: 1px solid gray-200
- Padding: 0 24px

// Page Title
- Font size: 20px (1.25rem)
- Font weight: 600 (Semibold)
- Color: gray-900
```

### Main Content Area
```tsx
// Positioned right of sidebar
- Margin left: 256px (or 64px when collapsed)
- Background: gray-50
- Padding: 24px
- Min height: 100vh - 64px (header)
```

---

## Component Styling Guide

### Buttons

#### Primary Button
```tsx
<Button variant="primary">
// Background: primary-600
// Text: White
// Hover: primary-700
// Border radius: 8px
// Padding: 10px 16px (md)
// Font weight: 500
// Shadow: Subtle (0 1px 3px rgba(0,0,0,0.05))
```

#### Secondary Button
```tsx
<Button variant="secondary">
// Background: gray-100
// Text: gray-700
// Border: 1px solid gray-300
// Hover: gray-200
```

#### Outline Button
```tsx
<Button variant="outline">
// Background: White
// Border: 1px solid gray-300
// Text: gray-700
// Hover: gray-50, border-gray-400
```

#### Sizes
- `xs`: px-2.5 py-1.5 text-xs
- `sm`: px-3.5 py-2 text-sm
- `md`: px-4 py-2.5 text-sm (default)
- `lg`: px-5 py-3 text-base
- `xl`: px-6 py-3.5 text-base

### Cards

```tsx
<Card>
  // Background: White
  // Border radius: 12px (rounded-xl)
  // Border: 1px solid gray-200
  // Shadow: 0 1px 3px rgba(0,0,0,0.08)
  
  <CardHeader title="Title" subtitle="Optional subtitle">
    // Padding: 24px horizontal, 16px vertical
    // Border bottom: 1px solid gray-200
    // Title font: 16px, 600 weight, gray-900
    // Subtitle font: 14px, gray-600
  </CardHeader>
  
  <CardBody>
    // Padding: 24px
  </CardBody>
  
  <CardFooter>
    // Background: gray-50
    // Border top: 1px solid gray-200
    // Padding: 16px 24px
  </CardFooter>
</Card>
```

### Tables

```tsx
<Table>
  // Container: White background, rounded-xl
  // Border: 1px solid gray-200
  
  // Header Row
  // Background: gray-50
  // Text: 12px, 600 weight, gray-700, uppercase
  // Padding: 14px 24px
  
  // Data Rows
  // Border bottom: 1px solid gray-100
  // Text: 14px, gray-900
  // Padding: 16px 24px
  // Striped: Alternating gray-50/50% opacity
  // Hover: primary-50/50% opacity
</Table>
```

### Forms

#### Input Fields
```tsx
<InputField label="Name" required>
  // Border: 1px solid gray-300
  // Border radius: 8px
  // Padding: 10px 14px
  // Background: White
  // Text: 14px, gray-900
  // Placeholder: gray-400
  
  // Focus State
  // Ring: 2px primary-500
  // Border: transparent
  
  // Error State
  // Border: danger-400
  // Ring: danger-500
  // Helper text: danger-600
  
  // Disabled State
  // Background: gray-50
  // Text: gray-500
  // Cursor: not-allowed
```

#### Labels
```tsx
// Display: block
// Font: 14px, 500 weight
// Color: gray-700
// Margin bottom: 6px

// Required indicator (*)
// Color: danger-500
```

### Modals

```tsx
<Modal isOpen={true} title="Modal Title">
  // Overlay
  // Background: gray-900/60% with backdrop blur
  // Z-index: 50
  
  // Modal Container
  // Background: White
  // Border radius: 12px (rounded-xl)
  // Shadow: 2xl (large shadow)
  // Max width: varies by size (sm, md, lg, xl)
  // Max height: 90vh
  
  // Header
  // Background: White (or variant color for danger/success/warning)
  // Border bottom: 1px solid gray-200
  // Padding: 16px 24px
  // Title: 18px, 600 weight, gray-900
  
  // Content
  // Padding: 20px 24px
  // Overflow-y: auto
  
  // Footer
  // Background: gray-50
  // Border top: 1px solid gray-200
  // Padding: 16px 24px
  // Border radius bottom: 12px
</Modal>
```

### Badges

```tsx
// Base styles
// Display: inline-flex
// Padding: 2px 10px
// Border radius: 9999px (full)
// Font: 12px, 500 weight

// Variants
.badge-primary   // bg-primary-100, text-primary-800
.badge-success   // bg-success-100, text-success-800
.badge-danger    // bg-danger-100, text-danger-800
.badge-warning   // bg-warning-100, text-warning-800
.badge-gray      // bg-gray-100, text-gray-800
```

---

## Typography

### Font Family
```css
font-family: 'Inter', 'Segoe UI', 'Roboto', system-ui, -apple-system, sans-serif;
```

### Text Hierarchy

#### Headings
```css
H1: 20px (1.25rem), 600 weight, gray-900
H2: 18px (1.125rem), 600 weight, gray-900
H3: 16px (1rem), 600 weight, gray-900
H4: 14px (0.875rem), 600 weight, gray-900
```

#### Body Text
```css
Base: 14px (0.875rem), 400 weight, gray-700
Large: 16px (1rem), 400 weight, gray-700
Small: 12px (0.75rem), 400 weight, gray-600
```

#### Labels & Captions
```css
Label: 14px, 500 weight, gray-700
Caption: 12px, 400 weight, gray-600
Uppercase label: 12px, 600 weight, gray-700, uppercase, tracking-wide
```

---

## Spacing System

### Padding/Margin Scale
```
0.5 = 2px
1   = 4px
1.5 = 6px
2   = 8px
2.5 = 10px
3   = 12px
4   = 16px
5   = 20px
6   = 24px
8   = 32px
10  = 40px
12  = 48px
```

### Common Spacing Patterns
- Card padding: 24px (p-6)
- Form field gap: 16px (gap-4)
- Button padding: 10px 16px (py-2.5 px-4)
- Section spacing: 24px (space-y-6)
- Modal padding: 20px 24px

---

## Shadows

```css
/* Soft shadow (cards, buttons) */
shadow-soft: 0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)

/* Card shadow */
shadow-card: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)

/* Card hover */
shadow-card-hover: 0 4px 8px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)

/* Large soft shadow (modals) */
shadow-lg-soft: 0 10px 20px rgba(0,0,0,0.06), 0 6px 10px rgba(0,0,0,0.03)
```

---

## Border Radius

```css
/* Buttons */
rounded-button: 8px (0.5rem)

/* Cards, inputs, modals */
rounded-xl: 12px (0.75rem)

/* Small elements */
rounded-lg: 8px (0.5rem)
rounded-md: 6px (0.375rem)

/* Badges, pills */
rounded-full: 9999px
```

---

## Animations & Transitions

### Standard Transition
```css
transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1)
```

### Common Animations
```css
/* Fade in */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide in */
@keyframes slideIn {
  from { 
    opacity: 0;
    transform: translateY(-10px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}

/* Slide in from left (sidebar expand) */
@keyframes slideInFromLeft {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

---

## Accessibility Guidelines

### Color Contrast
- All text meets WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- Primary text (gray-900) on white: 15.8:1 ✓
- Secondary text (gray-600) on white: 7.2:1 ✓
- Primary button text (white on primary-600): 4.8:1 ✓

### Interactive Elements
- Minimum touch target: 44x44px
- Focus visible states: 2px ring with primary color
- Keyboard navigation: All interactive elements accessible via Tab
- Disabled state: 50% opacity, not-allowed cursor

### Screen Readers
- Proper ARIA labels on buttons and icons
- Semantic HTML (header, nav, main, aside)
- Alt text for images
- Form labels properly associated with inputs

---

## Responsive Behavior

### Sidebar Collapse
```
Screens < 1280px: Consider auto-collapse
User can manually toggle via button
Collapsed width: 64px
Expanded width: 256px
Transition: 300ms ease-in-out
```

### Content Adaptation
```
Cards: Stack on smaller screens
Tables: Horizontal scroll with sticky columns
Modals: Full width on mobile (max-w-full p-4)
Forms: Single column on mobile, 2-3 columns on desktop
```

---

## Best Practices

### Do's ✓
- Use consistent spacing (multiples of 4px)
- Maintain visual hierarchy with font weights and sizes
- Provide clear hover and active states
- Use semantic color names (primary, success, danger)
- Group related items in cards
- Keep buttons and CTAs prominent
- Use loading states for async actions
- Display validation messages clearly

### Don'ts ✗
- Don't use dark themes or saturated colors
- Don't place logo/branding in sidebar
- Don't mix different shadow styles
- Don't use colors for decoration only
- Don't hide critical actions
- Don't rely solely on color to convey information
- Don't use tiny clickable areas
- Don't skip loading/error states

---

## Implementation Example

```tsx
import { Layout, Card, CardHeader, CardBody, Button, Table } from '@/components';

function DashboardPage() {
  const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard />, current: true },
    { name: 'Users', href: '/users', icon: <Users />, current: false },
    { name: 'Reports', href: '/reports', icon: <FileText />, current: false },
  ];

  return (
    <Layout 
      navigationItems={navigationItems} 
      title="Dashboard"
      subtitle="Welcome back, here's your overview"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatCard
          title="Total Users"
          value="1,234"
          icon={<Users className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="Active Today"
          value="567"
          icon={<Activity className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Pending"
          value="89"
          icon={<Clock className="w-6 h-6" />}
          color="yellow"
        />
      </div>

      <Card>
        <CardHeader title="Recent Activity" />
        <CardBody noPadding>
          <Table
            data={data}
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

## Migration Notes

### From Old Design
1. **Color updates**: Replace bright blues with muted primary colors
2. **Sidebar**: Move from top navigation to left sidebar
3. **Spacing**: Increase padding for better readability
4. **Shadows**: Soften all shadows
5. **Borders**: Use gray-200 instead of gray-300
6. **Typography**: Switch to Inter font family

### Breaking Changes
- Layout component now requires `navigationItems` array
- Sidebar automatically collapses/expands on hover
- Top header no longer contains navigation
- Primary color changed from bright blue to muted blue-gray

---

## Support

For questions or design system updates, refer to:
- [UI_DESIGN_SYSTEM.md](./UI_DESIGN_SYSTEM.md)
- [COMPONENT_QUICK_REFERENCE.md](./COMPONENT_QUICK_REFERENCE.md)
- [UI_IMPLEMENTATION_GUIDE.md](./UI_IMPLEMENTATION_GUIDE.md)

---

**Last Updated**: February 3, 2026  
**Version**: 2.0 - Modern Light Theme
