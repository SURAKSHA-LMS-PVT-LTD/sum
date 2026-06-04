# Mobile Responsive Quick Start Guide

## TL;DR - Apply Responsive Design in 5 Minutes

### Copy-Paste Pattern for Any Component/Page

```tsx
// ✅ DO THIS for mobile responsive layouts
<div className="space-y-3 sm:space-y-4 p-3 sm:p-4 md:p-5">
  {/* Header Section */}
  <div>
    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
      Responsive Title
    </h1>
    <p className="text-sm sm:text-base text-muted-foreground mt-2">
      Responsive subtitle
    </p>
  </div>

  {/* Cards Grid */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
    {items.map(item => (
      <div key={item.id} className="p-3 sm:p-4 rounded-lg border border-border">
        <h3 className="text-sm sm:text-base font-semibold">{item.title}</h3>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          {item.description}
        </p>
      </div>
    ))}
  </div>

  {/* Action Buttons */}
  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
    <Button className="h-8 sm:h-9 text-xs sm:text-sm px-3 sm:px-4 flex-1 sm:flex-none">
      Primary Action
    </Button>
    <Button variant="outline" className="h-8 sm:h-9 text-xs sm:text-sm px-3 sm:px-4 flex-1 sm:flex-none">
      Secondary Action
    </Button>
  </div>
</div>
```

### Essential Responsive Classes

```tsx
// Spacing (always mobile-first)
className="p-3 sm:p-4 md:p-5"              // padding
className="px-3 sm:px-4 md:px-6"           // horizontal
className="py-2 sm:py-3 md:py-4"           // vertical
className="gap-2 sm:gap-3 md:gap-4"        // gaps
className="space-y-2 sm:space-y-3"         // vertical space

// Typography (scales with screen)
className="text-sm sm:text-base md:text-lg"
className="text-lg sm:text-xl md:text-2xl"
className="text-xl sm:text-2xl md:text-3xl"

// Grids (1-col → 2-col → 3-col)
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"

// Flex (stack on mobile, row on larger)
className="flex flex-col sm:flex-row gap-3"

// Buttons (touch-friendly)
className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
className="h-8 sm:h-9 text-sm px-3 sm:px-4"
className="h-9 sm:h-10 text-base px-4 sm:px-6"
```

## Before & After Examples

### ❌ NOT RESPONSIVE (Bad)
```tsx
<div className="p-6 flex gap-6">
  <h1 className="text-4xl">Title</h1>
  <div className="grid grid-cols-3 gap-6">
    {/* Too large on mobile! */}
  </div>
  <Button className="px-8 py-4">Large Button</Button>
</div>
```

### ✅ RESPONSIVE (Good)
```tsx
<div className="space-y-3 sm:space-y-4 p-3 sm:p-4 md:p-6">
  <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">
    Title
  </h1>
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
    {/* Scales nicely from mobile to desktop */}
  </div>
  <Button className="h-8 sm:h-9 px-3 sm:px-4 text-sm">
    Responsive Button
  </Button>
</div>
```

## Quick Checklist for Each Component

When you create a new component, ensure:

- [ ] **Spacing**: Uses `p-3 sm:p-4 md:p-5` pattern (mobile-first)
- [ ] **Typography**: Uses responsive text sizes (text-sm sm:text-base md:text-lg)
- [ ] **Buttons**: Have responsive height and padding (h-8 sm:h-9)
- [ ] **Grids**: Start with 1 column, scale up (grid-cols-1 sm:grid-cols-2)
- [ ] **Flex**: Stack vertically on mobile (flex-col sm:flex-row)
- [ ] **Images**: Use width-full or max-w-[X%], not fixed pixels
- [ ] **No overflow**: No hardcoded widths that exceed screen
- [ ] **Touch targets**: All buttons ≥ 44x44px on mobile

## Copy-Paste Snippets for Common Patterns

### Responsive Header with Actions
```tsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4">
  <div>
    <h2 className="text-lg sm:text-xl font-bold">{title}</h2>
    <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p>
  </div>
  <div className="flex gap-2">
    <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm">Action</Button>
  </div>
</div>
```

### Responsive Card List
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
  {items.map(item => (
    <div key={item.id} className="p-3 sm:p-4 rounded-lg border">
      <h3 className="text-sm sm:text-base font-semibold">{item.name}</h3>
      <p className="text-xs sm:text-sm text-muted-foreground mt-2">
        {item.description}
      </p>
    </div>
  ))}
</div>
```

### Responsive Form
```tsx
<form className="space-y-3 sm:space-y-4 p-3 sm:p-4 md:p-6">
  <div className="flex flex-col gap-1">
    <label className="text-xs sm:text-sm font-medium">Email</label>
    <input
      type="email"
      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border"
    />
  </div>
  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
    <Button className="h-8 sm:h-9 flex-1 sm:flex-none">Submit</Button>
    <Button variant="outline" className="h-8 sm:h-9 flex-1 sm:flex-none">
      Cancel
    </Button>
  </div>
</form>
```

### Responsive Table
```tsx
<div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
  <table className="w-full text-xs sm:text-sm">
    {/* Table content */}
  </table>
</div>
```

### Responsive Dialog
```tsx
<DialogContent className="w-[95vw] sm:w-full max-w-sm sm:max-w-lg md:max-w-2xl">
  <DialogHeader>
    <DialogTitle className="text-lg sm:text-xl">Dialog Title</DialogTitle>
  </DialogHeader>
  <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
    {/* Content */}
  </div>
</DialogContent>
```

## Import Responsive Utilities

```tsx
// Use these in your components:
import { responsiveClasses } from '@/utils/responsiveHelpers';
import { useResponsive, useVirtualKeyboard } from '@/hooks/useResponsive';

// Example usage:
const MyComponent = () => {
  const { isMobile, isTablet } = useResponsive();
  
  return (
    <div className={responsiveClasses.containerPadding}>
      {isMobile && <MobileView />}
      {!isMobile && <DesktopView />}
    </div>
  );
};
```

## One-Minute Mobile Check

For any page, test at these widths in Chrome DevTools:

1. **375px** - iPhone width - should look good
2. **640px** - Tablet portrait - should look good
3. **1024px** - Desktop - should look good

If it looks broken at any of these sizes, apply responsive classes!

## The Golden Rule

**Always start with mobile, then enhance for larger screens:**

```tsx
// ✅ Correct approach (mobile-first)
className="text-sm sm:text-base md:text-lg"  // 14px → 16px → 18px

// ❌ Wrong approach (desktop-first)
className="md:text-lg"  // No mobile styles!
```

## Need Help?

- **Spacing issues?** → Use `p-3 sm:p-4 md:p-5` pattern
- **Text too large?** → Use `text-sm sm:text-base md:text-lg`
- **Button hard to tap?** → Use `h-8 sm:h-9` (min 44px on mobile)
- **Grid not responsive?** → Use `grid grid-cols-1 sm:grid-cols-2`
- **Dialog overflows?** → Use `w-[95vw] sm:w-full max-w-2xl`

## See It In Action

Look at `src/pages/SubjectDashboard.tsx` for a real example of mobile-responsive implementation!

---

**Remember**: Mobile users are real users! Make their experience great with proper responsive design. 📱✨
