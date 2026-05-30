## Goal
Every create / update / view popup gets a real URL like `/institute/:instituteId/parents/view-details-form?id=123`. Opening the popup pushes a route; closing pops it. Refreshing the URL re-opens the same popup on top of the underlying page.

## Approach
There are 100+ dialogs across the codebase (Parents, Students, Teachers, Classes, Subjects, Lectures, Homework, Payments, Attendance, Transport, Exams, Cards, Settings, etc.). Rewriting all of them in one shot will break the app. I will do it in safe phases, each phase shippable on its own.

### Phase 1 – Infrastructure (this iteration)
1. Create a generic `useRoutedDialog(name)` hook built on top of the existing `useModalRouting` util.
   - `open(params)` → pushes `?modal=<name>&...params` onto current path.
   - `close()` → removes those params.
   - `isOpen`, `params` → derived from URL.
2. Create a `<RoutedDialogHost>` component mounted once per page section that maps modal names → dialog components.
3. Register a small naming convention:
   - `create-<entity>-form`, `update-<entity>-form`, `view-<entity>-form` (matches the URL style you showed).
4. Convert the **Parents** module end-to-end (create / update / view) as the reference implementation, using your example URL shape.

### Phase 2 – Students + Institute Users
Convert all student and institute-user popups using the same pattern.

### Phase 3 – Classes, Subjects, Lectures, Homework
### Phase 4 – Payments, Attendance, Transport
### Phase 5 – Exams, Cards, Settings, remaining misc dialogs

Each phase = one iteration. After each phase the app stays fully working; un-migrated dialogs keep behaving exactly like today.

### Backwards compatibility
- Existing `open/setOpen` props on dialogs stay supported. The routed hook just drives those props from the URL, so nothing else has to change at the call site beyond swapping `useState` for `useRoutedDialog`.
- Deep-linking works: pasting a popup URL opens the page + popup.
- Back button closes the popup, not the page.

## Deliverable for this turn
- `src/hooks/useRoutedDialog.ts`
- `src/components/RoutedDialogHost.tsx`
- Parents module wired up (create / update / view) with the URL shape `/.../parents/{create|update|view}-details-form`.
- Short note in chat listing what's still pending so we can knock out phases 2–5 in follow-up turns.

## Why phased
Doing all 100+ dialogs in a single response would produce thousands of lines of unreviewed edits and almost certainly break unrelated screens. Phasing keeps every commit green and lets you verify the UX on Parents before we propagate the pattern everywhere.