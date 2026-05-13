// Thin wrapper — delegates to the app-level RbacProvider so all consumers
// share a single fetch rather than each issuing their own HTTP request.
export { useRbac as useMyRbacContext } from '@/contexts/RbacContext';
