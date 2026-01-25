# White & Gray Color Scheme Guide

## Overview
The Digital Logbook UI uses a professional white and gray color scheme that provides clean aesthetics, excellent readability, and proper visual hierarchy.

## Color Palette

### Gray Scale
```
gray-50:  #f9fafb  - Backgrounds
gray-100: #f3f4f6  - Hover states, secondary backgrounds
gray-200: #e5e7eb  - Borders, dividers
gray-300: #d1d5db  - Input borders
gray-400: #9ca3af  - Muted icons, placeholders
gray-500: #6b7280  - Secondary text
gray-600: #4b5563  - Primary neutral text, icons
gray-700: #374151  - Dark text
gray-800: #1f2937  - Headings
gray-900: #111827  - Primary text
```

### Accent Colors
- **Primary**: `#2563eb` (Blue) - Main actions, links
- **Success**: `#16a34a` (Green) - Success states
- **Danger**: `#dc2626` (Red) - Errors, deletions
- **Warning**: `#d97706` (Orange) - Warnings

## Button Variants

### Primary
- **Use**: Main call-to-action buttons
- **Style**: Primary color background, white text
- **Example**: Save, Submit, Login

### Secondary
- **Use**: Secondary actions, cancel operations
- **Style**: White background, gray-700 text, gray-300 border
- **Hover**: gray-50 background, gray-400 border
- **Example**: Cancel, Back, Clear

### Outline
- **Use**: Tertiary actions, neutral operations
- **Style**: White background, gray-600 text, gray-300 border
- **Hover**: gray-50 background, gray-800 text
- **Example**: View Details, Filter, Sort

### Ghost
- **Use**: Minimal visual impact actions
- **Style**: No background, gray-600 text
- **Hover**: gray-100 background, gray-800 text
- **Example**: Close, Dismiss, Icon-only buttons

### Danger
- **Use**: Destructive actions
- **Style**: Danger-600 background, white text
- **Example**: Delete, Remove, Revoke

## Icon Colors

### CSS Utility Classes
```css
.icon-neutral       - Gray-600 (standard icons)
.icon-neutral-hover - Gray-600 → Gray-800 on hover
.icon-muted         - Gray-400 (disabled/inactive)
.icon-primary       - Primary-600 (active/selected)
.icon-success       - Success-600 (success states)
.icon-danger        - Danger-600 (error/delete)
.icon-warning       - Warning-600 (warning states)
```

### Usage Examples
```tsx
// Navigation icons
<LayoutDashboard className="h-5 w-5 text-gray-600" />

// Active navigation
<LayoutDashboard className="h-5 w-5 text-primary-600" />

// Inactive/disabled
<Settings className="h-5 w-5 text-gray-400" />

// Action icons with hover
<Edit className="h-4 w-4 text-gray-600 hover:text-gray-800" />
```

## Component Examples

### Cards
```tsx
// Standard card
<div className="bg-white rounded-lg shadow-card border border-gray-100">

// Hoverable card
<div className="bg-white rounded-lg shadow-card border border-gray-100 
                hover:shadow-card-hover hover:border-gray-200 transition-all">
```

### Inputs
```tsx
// Standard input
<input className="w-full px-3 py-2 border border-gray-300 rounded-lg
                  focus:ring-2 focus:ring-primary-500" />

// Error state
<input className="border-danger-500 focus:ring-danger-500" />
```

### Badges
```tsx
// Neutral badge
<span className="badge bg-gray-100 text-gray-800">Draft</span>

// Status badges
<span className="badge bg-success-100 text-success-800">Active</span>
<span className="badge bg-danger-100 text-danger-800">Inactive</span>
```

## Accessibility Guidelines

### Contrast Ratios (WCAG AA)
- **Text on white**: Use gray-600 or darker (4.5:1 minimum)
- **Large text**: gray-500 acceptable for 18px+ (3:1 minimum)
- **Icons**: gray-600 for standard, gray-400 for decorative only
- **Borders**: gray-300 minimum for visible separation

### Interactive States
```
Default:  gray-600
Hover:    gray-800
Active:   gray-900
Focus:    Ring with primary-500
Disabled: gray-400 with reduced opacity
```

## Best Practices

### Do's ✓
- Use gray-600 for primary neutral icons
- Use white backgrounds with gray borders for secondary buttons
- Maintain 2:1 border thickness for secondary vs outline buttons
- Use hover states to show interactivity
- Keep primary color for main CTAs only

### Don'ts ✗
- Don't use gray-400 for clickable text/icons (too low contrast)
- Don't overuse primary color (reduces its effectiveness)
- Don't mix border weights inconsistently
- Don't use pure black (#000000) - use gray-900 instead
- Don't forget hover states on interactive elements

## Migration from Old Scheme

### Button Updates
```tsx
// OLD: Dark gray buttons
variant="secondary"  // Was bg-gray-600

// NEW: White with gray border
variant="secondary"  // Now bg-white with border-gray-300
```

### Icon Updates
```tsx
// OLD: Various inconsistent colors
<Icon className="text-blue-500" />

// NEW: Consistent gray scale
<Icon className="text-gray-600" />  // Standard
<Icon className="text-primary-600" /> // Active/selected
```

## Quick Reference

| Element | Background | Text/Icon | Border | Hover |
|---------|-----------|-----------|---------|-------|
| Primary Button | primary-600 | white | - | primary-700 |
| Secondary Button | white | gray-700 | gray-300 | gray-50 bg |
| Outline Button | white | gray-600 | gray-300 | gray-800 text |
| Ghost Button | transparent | gray-600 | - | gray-100 bg |
| Card | white | gray-900 | gray-100 | gray-200 |
| Input | white | gray-900 | gray-300 | primary-500 ring |
| Icon (neutral) | - | gray-600 | - | gray-800 |
| Icon (muted) | - | gray-400 | - | - |

## Examples in Context

### Dashboard Header
```tsx
<header className="bg-white border-b border-gray-200">
  <h1 className="text-gray-900 font-semibold">Dashboard</h1>
  <p className="text-gray-600">Welcome back</p>
</header>
```

### Action Bar
```tsx
<div className="flex gap-2">
  <Button variant="primary">Save Changes</Button>
  <Button variant="secondary">Cancel</Button>
  <Button variant="outline">Preview</Button>
</div>
```

### Navigation
```tsx
<nav>
  {items.map(item => (
    <a className={item.current 
      ? 'bg-primary-50 text-primary-600' 
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
    }>
      {item.icon}
      {item.name}
    </a>
  ))}
</nav>
```
