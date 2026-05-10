# Frontend UI Guidelines

## Tech Stack
**React + Vite + Capacitor (for Android mobile)**

User-facing frontend built with React/Vite for web, with Capacitor framework enabling Android APK builds from the same codebase.

## Quick Start

```bash
npm install
npm run dev                    # Vite dev server on :3000
npm run build                  # Production build (4GB Node heap limit)
npm run lint                   # ESLint check, fix with --fix
npm run test:watch            # Vitest interactive mode
npm run test:coverage         # Coverage report
npm run cap:build             # Compile app + sync Android assets
npm run cap:open              # Open Android Studio for compilation
```

## Component Organization

- **Components**: `src/components/` with PascalCase names (`UserCard.tsx`, `AttendanceCalendar.tsx`)
- **Pages**: `src/pages/` for route-level components
- **Hooks**: Co-located in same folder as component, suffix `.hook.ts`
- **Utils**: Feature-scoped utils in `src/utils/`, import via `@/utils`
- **API calls**: Co-located in `src/api/` by feature, use Axios or fetch
- **Types**: Reusable types in `src/types/`, not inside components

**Pattern**: Each feature folder contains components, hooks, API client, and types for that feature.

## Styling

- **Emotion**: `@emotion/styled` for component styles (preferred)
- **Radix UI**: Accessible primitives for buttons, dialogs, forms
- **Tailwind**: Utility classes for quick layouts (co-exists with Emotion)
- **No CSS modules** — use Emotion or Tailwind inline

Example:
```typescript
import styled from '@emotion/styled';
import * as Dialog from '@radix-ui/react-dialog';

const StyledButton = styled.button`
  background: #007bff;
  padding: 10px 20px;
  border-radius: 4px;
  &:hover { background: #0056b3; }
`;

export function MyComponent() {
  return <StyledButton>Click me</StyledButton>;
}
```

## Environment Variables

- **Frontend only**: Use `VITE_` prefix so they get bundled into build
- **Never secrets**: No API keys, passwords, or tokens in `.env`
- **Local overrides**: Create `.env.local` for your machine
- **Public values**: Define in `.env` and `.env.example` (e.g., `VITE_API_BASE_URL=http://localhost:8080`)

```bash
# .env
VITE_API_BASE_URL=http://localhost:8080
VITE_APP_VERSION=1.0.0

# .env.local (gitignored)
VITE_DEV_TOKEN=your-local-test-token
```

## API Communication

- **Base URL**: Import from config: `const BASE_URL = import.meta.env.VITE_API_BASE_URL`
- **Pattern**: Create API client per feature in `src/api/<feature>.api.ts`
- **Error handling**: Catch API errors, transform to user messages
- **Types**: Define request/response types in `src/types/<feature>.types.ts`

Example (`src/api/attendance.api.ts`):
```typescript
import { BASE_URL } from '@/config';

export async function getAttendanceHistory(instituteId: string, userId: string) {
  const response = await fetch(`${BASE_URL}/attendance/${userId}`, {
    headers: { 'X-Institute-ID': instituteId },
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}
```

## Testing

All user-facing features should have Vitest tests living in `**/*.spec.tsx` files.

```bash
npm run test:watch       # Interactive mode during development
npm run test:coverage    # Coverage report—target >70% for UI
npm run test:ui          # Visual UI for test runner
```

**Test pattern** (example):
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { UserCard } from './UserCard';

describe('UserCard', () => {
  it('should display user name', () => {
    render(<UserCard user={{ name: 'John', id: '1' }} />);
    expect(screen.getByText('John')).toBeInTheDocument();
  });

  it('should call onDelete when delete button clicked', () => {
    const onDelete = jest.fn();
    render(<UserCard user={{ name: 'John', id: '1' }} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalled();
  });
});
```

## Build & Capacitor

### Web Build
```bash
npm run build        # Creates dist/ folder (4GB Node memory)
npm run preview      # Test build locally on :4173
```

Output: Minified, tree-shaken React app ready for web hosting (Vercel, Cloud Run, etc.).

### Android Build
```bash
npm run cap:build    # Cleans, builds web, syncs Android assets
npm run cap:open     # Opens Android Studio for APK compilation
npm run cap:run      # Builds + runs on connected device
```

The Capacitor bridge enables:
- Native Android plugins (camera, geolocation, barcode scanner, push notifications)
- Capacitor APIs in React (e.g., `Geolocation.getCurrentPosition()`)
- Single codebase for web + mobile

**See**: `capacitor.config.json` for app name, version, plugins enabled.

## Timezone Display

**Server sends times as ISO UTC. Frontend must display in local user timezone.**

**Pattern**: 
```typescript
// Receive ISO from API
const isoTime = "2025-04-07T10:30:00Z";

// Display in user's local timezone
const displayTime = new Date(isoTime).toLocaleString('en-US', {
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
});

// For Sri Lanka users, displays in their local time automatically
// But if you need explicit Sri Lanka display:
const sriLankaTime = new Date(isoTime).toLocaleString('en-US', {
  timeZone: 'Asia/Colombo'
});
```

**Critical**: Never use `toDateString()` or `toTimeString()` — they ignore timezone and may show wrong date.

**See**: `TIMEZONE_FIX_CORRECT_IMPLEMENTATION.md` in backend folder for detailed examples.

## Navigation & Routing

- Framework: React Router is implied (check `src/App.tsx` for router setup)
- Pattern: Pages in `src/pages/`, linked via route definitions
- Protected routes: Check JWT token from localStorage, redirect to login if missing
- Deep links: Capacitor supports deep linking for push notifications and app links

## Form Handling

- **React Hook Form**: For form state management (if used)
- **Zod or Yup**: For validation schemas (check `package.json`)
- **Error displays**: Show form errors next to inputs, or toast messages for API errors

Example:
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6),
});

export function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} placeholder="Email" />
      {errors.email && <span>{errors.email.message}</span>}
    </form>
  );
}
```

## Common Commands

```bash
# Development
npm run dev:network          # Expose on all IPs (for device testing)
npm run build:verbose       # Production build with logging
npm run lint --fix          # Auto-fix linting errors

# Testing
npm run test -- --ui        # Open Vitest UI (browser-based test explorer)
npm run test -- attendance  # Test specific file/folder

# Capacitor
npm run cap:sync            # Sync code without rebuild
npm run cap:run ios         # For iOS (if configured)
```

## Code Review Checklist for PRs

- [ ] **Components**: Reusable, no hardcoded data, props typed
- [ ] **Tests**: New components have Vitest tests
- [ ] **API calls**: Use typed endpoints, error handling
- [ ] **Environment**: No hardcoded API URLs, use `VITE_` env vars
- [ ] **Styling**: Uses Emotion or Tailwind, not CSS modules
- [ ] **Timezone**: Dates displayed with `toLocaleString()`, not `toDateString()`
- [ ] **Types**: Interfaces defined in `src/types/`, exported from index
- [ ] **Linting**: `npm run lint` passes (no `any` types)
- [ ] **Build**: `npm run build` completes with no errors (4GB memory)
- [ ] **Mobile**: Tested on device or emulator if Capacitor plugins used

---

**Frontend integration guides**: Search backend folder for `*_FRONTEND_GUIDE.md` files (e.g., `ATTENDANCE_FRONTEND_MIGRATION_GUIDE.md`) for feature-specific API contracts.  
**Architecture**: See `FRONTEND_DOCUMENTATION_INDEX.md` in backend for all frontend-related guides.
