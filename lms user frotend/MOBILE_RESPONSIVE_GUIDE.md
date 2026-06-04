# Mobile Responsiveness Guide

## Overview
This site is now optimized for mobile-first responsive design using Tailwind CSS breakpoints. All pages, components, and buttons should follow these guidelines to ensure excellent user experience across devices.

## Breakpoints
- **Mobile**: < 640px (base styles apply to mobile first)
- **Tablet**: 640px - 1024px (sm: and md: prefixes)
- **Desktop**: ≥ 1024px (lg: prefix)

## Core Responsive Patterns

### Spacing & Padding
```tsx
// Mobile first: always start with smallest values
<div className="p-3 sm:p-4 md:p-5 lg:p-6">  // 12px → 16px → 20px → 24px
<div className="px-3 sm:px-4 md:px-6">       // horizontal padding
<div className="py-2 sm:py-3 md:py-4">       // vertical padding
```

### Typography
```tsx
// Always scale text for mobile
<h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">
<p className="text-sm sm:text-base md:text-lg">
<span className="text-xs sm:text-sm">
```

### Layouts & Grids
```tsx
// Responsive grids
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">

// Responsive flex
<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">

// Hide/Show responsive
<div className="hidden sm:block lg:hidden">  // visible on sm, md; hidden on mobile, lg+
```

### Buttons
```tsx
// All buttons must be mobile-friendly (minimum 44px height on mobile)
<Button className="h-8 sm:h-9 md:h-10 px-2 sm:px-3 md:px-4 text-xs sm:text-sm">

// Common button sizes for mobile
<Button size="sm" className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3">  // compact mobile
<Button size="sm" className="h-8 sm:h-9 text-sm px-3 sm:px-4">           // standard mobile
<Button className="h-9 sm:h-10 text-sm sm:text-base px-4 sm:px-6">      // large mobile
```

### Common Component Patterns

#### Cards & Containers
```tsx
<div className="rounded-lg sm:rounded-xl bg-card border border-border p-3 sm:p-4 md:p-5">
  {/* Mobile-friendly card content */}
</div>
```

#### Header/Title Sections
```tsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 sm:p-4">
  <h3 className="text-sm font-semibold">{title}</h3>
  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
    {/* buttons */}
  </div>
</div>
```

#### Dialog/Modal
```tsx
<DialogContent className="w-[95vw] sm:w-full max-w-sm sm:max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto">
  {/* Uses viewport width on mobile, full width on larger screens */}
</DialogContent>
```

#### Tables on Mobile
```tsx
// Wrap tables in scrollable container for mobile
<div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
  <MUITable {...props} />
</div>
```

## Responsive Utility Classes

Use the responsive helper from `@/utils/responsiveHelpers.ts`:

```tsx
import { responsiveClasses } from '@/utils/responsiveHelpers';

// Examples:
<div className={responsiveClasses.containerPadding}>          // p-4 sm:p-6 md:p-8
<div className={responsiveClasses.gridAuto2Col}>             // auto 2-col responsive grid
<div className={responsiveClasses.flexBetweenResponsive}>    // flex layout responsive
```

Available utilities:
- `container` - responsive horizontal padding
- `containerPadding` - responsive padding all sides
- `containerPaddingY` - responsive vertical padding
- `headingLg`, `headingMd`, `headingSm` - responsive typography
- `gridAuto2Col`, `gridAuto3Col`, `gridAuto4Col`, `gridAuto6Col` - responsive grids
- `buttonSmall`, `buttonBase`, `buttonLarge` - responsive button sizes
- `card`, `cardHover` - responsive card styling
- `paddingMobile`, `paddingMobileX`, `paddingMobileY` - responsive padding utilities
- `gapSmall`, `gapBase`, `gapLarge` - responsive gap utilities

## Mobile-First Checklist

### ✅ Spacing
- [ ] All containers use responsive padding (p-3 sm:p-4 md:p-5)
- [ ] Gaps between elements are responsive
- [ ] No hardcoded pixel widths (use flex/grid instead)
- [ ] Bottom padding includes pb-24 sm:pb-12 for mobile nav clearance

### ✅ Typography
- [ ] All headings scale: text-xl sm:text-2xl md:text-3xl
- [ ] Body text scales: text-sm sm:text-base
- [ ] No typography below 10px on mobile

### ✅ Buttons
- [ ] All buttons are at least 44x44px on mobile (mobile-friendly touch targets)
- [ ] Buttons stack vertically on mobile: flex-col sm:flex-row
- [ ] Button text and icons scale responsively

### ✅ Forms
- [ ] Input fields use full width on mobile: w-full
- [ ] Label and input stack vertically on mobile: flex-col sm:flex-row
- [ ] Error messages are visible on mobile

### ✅ Dialogs & Modals
- [ ] Dialogs use w-[95vw] on mobile to prevent overflow
- [ ] Max-width constraints: max-w-sm sm:max-w-lg md:max-w-2xl
- [ ] Padding inside dialogs is responsive

### ✅ Tables
- [ ] Large tables wrapped in overflow-x-auto container
- [ ] Or switch to card view on mobile using view mode toggle
- [ ] Vertical scroll bar visible on mobile

### ✅ Navigation
- [ ] Bottom navigation hidden on lg: screens
- [ ] Menu button visible on mobile
- [ ] Sidebar hidden on mobile, shown on lg: screens

### ✅ Images & Media
- [ ] Images use responsive widths: w-full or w-[X%]
- [ ] Aspect ratios maintained: aspect-video, aspect-square
- [ ] Images lazy-load: loading="lazy"

## Common Mistakes to Avoid

❌ **DON'T:**
```tsx
// Fixed widths
<div className="w-[500px]">  // ❌ won't work on mobile

// Hardcoded padding on all screen sizes
<div className="p-6">        // ❌ too much padding on mobile

// Non-responsive text
<h1 className="text-4xl">   // ❌ too large on mobile

// No gap scaling
<div className="flex gap-6"> // ❌ too large on mobile

// Modal with no mobile width
<DialogContent className="max-w-2xl">  // ❌ exceeds screen width on mobile

// Buttons without responsive sizing
<Button className="px-8 py-4">  // ❌ too large on mobile
```

✅ **DO:**
```tsx
// Responsive widths
<div className="w-full sm:w-3/4 md:w-1/2">  // ✅ scales with viewport

// Responsive padding (mobile-first)
<div className="p-3 sm:p-4 md:p-6">         // ✅ starts small, grows

// Responsive text
<h1 className="text-2xl sm:text-3xl md:text-4xl">  // ✅ scales nicely

// Responsive gaps
<div className="flex gap-2 sm:gap-4 md:gap-6">  // ✅ starts small

// Mobile-friendly dialog
<DialogContent className="w-[95vw] sm:w-full max-w-2xl">  // ✅ works on mobile

// Responsive buttons
<Button className="h-8 sm:h-9 px-2 sm:px-4 text-xs sm:text-sm">  // ✅ touch-friendly
```

## Implementation Strategy

### When Creating New Pages:
1. Start with mobile design first
2. Add sm: breakpoint styles for tablet
3. Add md: and lg: for larger screens
4. Test on actual mobile devices or Chrome DevTools

### When Updating Existing Components:
1. Check if responsive classes are applied
2. Add missing responsive variants
3. Ensure padding/spacing scales
4. Test navigation on mobile

### For Forms & Dialogs:
1. Use full width on mobile
2. Stack labels and inputs vertically on mobile
3. Use responsive button sizing
4. Ensure error messages are visible

### For Tables & Lists:
1. Use card view on mobile when possible
2. Or wrap in horizontal scroll container
3. Reduce columns shown on mobile
4. Use truncate and line-clamp for long text

## Testing Mobile Responsiveness

### Chrome DevTools:
1. Open DevTools (F12)
2. Click mobile device toggle (Ctrl+Shift+M)
3. Test at: 375px (iPhone), 768px (iPad), 1024px (Desktop)
4. Check touch targets are at least 44x44px

### Real Devices:
1. Test on actual iOS and Android devices
2. Test orientation changes (portrait/landscape)
3. Test with virtual keyboard open
4. Test with different font sizes (accessibility)

### Checklist Before Commit:
```
- [ ] Page looks good at 375px (mobile)
- [ ] Page looks good at 640px (tablet)
- [ ] Page looks good at 1024px (desktop)
- [ ] All buttons are touch-friendly (44x44px minimum)
- [ ] All text is readable on mobile
- [ ] Images scale properly
- [ ] Navigation works on mobile
- [ ] Forms are usable on mobile
- [ ] No horizontal scrolling except for intentional scrollables
- [ ] No content hidden on mobile that should be visible
```

## Quick Reference

### Grid Responsive Classes
```
grid-cols-1           → mobile (1 column)
sm:grid-cols-2        → tablet (2 columns)
lg:grid-cols-3        → desktop (3 columns)
lg:grid-cols-4        → large desktop (4 columns)
```

### Padding Responsive Classes
```
p-3 sm:p-4 md:p-5     → 12px → 16px → 20px
px-3 sm:px-4 md:px-6  → horizontal padding
py-2 sm:py-3 md:py-4  → vertical padding
```

### Typography Responsive Classes
```
text-sm sm:text-base md:text-lg lg:text-xl
text-lg sm:text-xl md:text-2xl lg:text-3xl
text-xl sm:text-2xl md:text-3xl lg:text-4xl
```

### Button Responsive Classes
```
h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3  → compact
h-8 sm:h-9 text-sm px-3 sm:px-4             → standard
h-9 sm:h-10 text-base px-4 sm:px-6          → large
```

## References
- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Mobile-First Design Principles](https://www.nngroup.com/articles/mobile-first-design/)
- [Touch Target Size Guidelines](https://www.nngroup.com/articles/touch-target-size/)
