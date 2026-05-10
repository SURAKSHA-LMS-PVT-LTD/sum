# Admin Frontend Guidelines

## Tech Stack
**React + Vite + Administration Panels**

Admin dashboard for system configuration, user management, institute administration, and reporting.

## Quick Start

```bash
npm install
npm run dev                    # Vite dev server on :3000
npm run build                  # Production build
npm run lint                   # ESLint check
npm run test:watch            # Vitest interactive mode
npm run test:coverage         # Coverage report
```

This follows the same Vite + React stack as the user frontend. Refer to the [user frontend AGENTS.md](../lms%20user%20frotend/AGENTS.md) for:
- Component organization
- Styling (Emotion + Radix UI)
- Environment variables & API communication
- Testing patterns
- Form handling with React Hook Form

## Admin-Specific Patterns

### Role-Based Access Control

Admin panels are scoped by user role (System Admin, Institute Admin, Super Admin). Verify role before rendering:

```typescript
// In component
import { useAuth } from '@/hooks/useAuth';

export function AdminDashboard() {
  const { user } = useAuth();
  
  if (user?.role !== 'SYSTEM_ADMIN' && user?.role !== 'SUPER_ADMIN') {
    return <AccessDenied />;
  }
  
  return <div>{/* admin content */}</div>;
}

// In route guard (if using React Router)
const protectedRoutes = [
  {
    path: '/admin/users',
    component: UserManagementPage,
    requiredRoles: ['SYSTEM_ADMIN', 'SUPER_ADMIN'],
  },
];
```

### Institute Scoping

Admin operations are often scoped to `instituteId` (for Institute Admins) or global (for System Admins):

```typescript
// API call with institute context
async function getInstanceUsers(instituteId: string) {
  const response = await fetch(
    `${BASE_URL}/admin/institutes/${instituteId}/users`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.json();
}
```

**Pattern**: Pass `instituteId` from route params, query params, or user context; never hardcode.

### Data Tables & Pagination

Admin dashboards typically have large data tables. Use pagination and filtering:

```typescript
// Example: User management table
export function UserManagementPage({ instituteId }: { instituteId: string }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchUsers(instituteId, page, pageSize, searchTerm)
      .then(setUsers)
      .finally(() => setLoading(false));
  }, [page, pageSize, searchTerm, instituteId]);

  return (
    <div>
      <input 
        placeholder="Search users..." 
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <DataTable 
        data={users}
        columns={[
          { header: 'Name', accessor: 'name' },
          { header: 'Email', accessor: 'email' },
          { header: 'Role', accessor: 'role' },
        ]}
        loading={loading}
      />
      <Pagination 
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}
```

### Bulk Operations & Confirmation Dialogs

Admin actions (delete, enable, disable) should require confirmation:

```typescript
import * as AlertDialog from '@radix-ui/react-alert-dialog';

export function BulkDeleteUsers({ userIds }: { userIds: string[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await deleteUsers(userIds);
      setIsOpen(false);
      // Refresh list
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialog.Trigger asChild>
        <button>Delete {userIds.length} users</button>
      </AlertDialog.Trigger>
      <AlertDialog.Content>
        <AlertDialog.Title>Confirm Deletion</AlertDialog.Title>
        <AlertDialog.Description>
          Are you sure? This cannot be undone.
        </AlertDialog.Description>
        <AlertDialog.Cancel asChild><button>Cancel</button></AlertDialog.Cancel>
        <AlertDialog.Action asChild>
          <button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Deleting...' : 'Delete'}
          </button>
        </AlertDialog.Action>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
```

### Status & Badge Components

Display status with visual badges (active, inactive, pending, error):

```typescript
const statusColors = {
  active: '#22c55e',
  inactive: '#ef4444',
  pending: '#f59e0b',
};

function StatusBadge({ status }: { status: 'active' | 'inactive' | 'pending' }) {
  return (
    <span style={{ 
      backgroundColor: statusColors[status],
      color: 'white',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
    }}>
      {status.toUpperCase()}
    </span>
  );
}
```

### Audit Logging Display

If showing audit logs or action history:

```typescript
// Example: Display user action history
export function AuditLog({ actions }: { actions: any[] }) {
  return (
    <div>
      {actions.map((action) => (
        <div key={action.id} style={{ borderBottom: '1px solid #ddd', padding: '8px' }}>
          <strong>{action.user}</strong> {action.action}
          <div style={{ fontSize: '12px', color: '#666' }}>
            {new Date(action.timestamp).toLocaleString('en-US', {
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

## Admin API Integration

Most admin features have dedicated backend endpoints. Check for:

- **User management**: `/admin/institutes/:id/users`, `/admin/users/:id`, `/admin/users/:id/roles`
- **Institute settings**: `/admin/institutes/:id/settings`, `/admin/institutes/:id/config`
- **Reports**: `/admin/reports/attendance`, `/admin/reports/payments`, `/admin/reports/enrollment`
- **System config**: `/admin/system/config`, `/admin/system/maintenance`

**Backend guides**: See backend folder for `ADMIN_*.md` files (e.g., `ADMIN_FEATURES_COMPLETE_GUIDE.md`, `SYSTEM_ADMIN_API_COMPLETE_GUIDE.md`).

## Authentication & Sessions

Admin users may have stricter security requirements:

```typescript
// Check server-side token expiry
async function verifyAdminToken(token: string) {
  const response = await fetch(`${BASE_URL}/admin/verify-token`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    // Force re-login
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
}

// Periodically verify (e.g., on route change)
useEffect(() => {
  const token = localStorage.getItem('token');
  if (token) verifyAdminToken(token);
}, [location]);
```

## Testing Admin Features

Admin-specific components may require:
- **Authorization mocks**: Mock roles and permissions
- **API mocks**: Mock bulk operations, confirmations
- **State mocks**: Mock user lists, status changes

Example:
```typescript
describe('BulkDeleteUsers', () => {
  it('should show confirmation dialog', () => {
    const { getByRole } = render(<BulkDeleteUsers userIds={['1', '2']} />);
    fireEvent.click(getByRole('button', { name: /delete/i }));
    expect(getByRole('alertdialog')).toBeInTheDocument();
  });

  it('should call API when confirmed', async () => {
    const deleteSpy = jest.spyOn(api, 'deleteUsers').mockResolvedValue({});
    const { getByRole } = render(<BulkDeleteUsers userIds={['1', '2']} />);
    fireEvent.click(getByRole('button', { name: /delete/i }));
    fireEvent.click(getByRole('button', { name: /confirm/i }));
    expect(deleteSpy).toHaveBeenCalledWith(['1', '2']);
  });
});
```

## Code Review Checklist for PRs

- [ ] **Role checks**: All admin routes verify user role before rendering
- [ ] **Institute scoping**: All operations scope to `instituteId` (no cross-institute data leaks)
- [ ] **Confirmations**: Destructive actions require user confirmation
- [ ] **Error handling**: API errors display user-friendly messages (not raw error codes)
- [ ] **Loading states**: Tables/forms show loading spinners during API calls
- [ ] **Pagination**: Large datasets implement pagination (not loading all rows at once)
- [ ] **Tests**: Admin-specific logic has tests (authorization, data scoping, bulk ops)
- [ ] **Timezone**: Timestamps display with `toLocaleString()`, accounting for Sri Lanka offset if needed
- [ ] **Audit logging**: If displaying audit logs, timestamps are properly formatted

---

**Admin guides**: Search backend folder for `ADMIN_*.md` files for feature-specific admin endpoints and workflows.  
**System admin docs**: See `SYSTEM_ADMIN_API_COMPLETE_GUIDE.md`, `SYSTEM_ADMIN_USER_MANAGEMENT_COMPLETE_GUIDE.md`.
