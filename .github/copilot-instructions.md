# Suraksha LMS Workspace Guidelines

## Architecture Overview

This is a **multi-repo LMS platform** with three independent projects:

- **`lms user frotend/`** — Vue.js frontend (Vite + Capacitor for Android mobile). Uses React/Emotion for UI, Radix primitives.
- **`lms-api-suraksha-lk/`** — NestJS backend API with TypeORM (MySQL) + DynamoDB hybrid storage. Multi-tenant design scoped to `instituteId`.
- **`sysstemadminfrotend/`** — Admin/system dashboard frontend.

Data flows: Frontend → NestJS API → MySQL (relational) + DynamoDB (high-volume). Storage is hybrid: AWS S3 + Google Cloud Storage (configurable via `STORAGE_PROVIDER` env).

## Build & Test Commands

### Frontend (`lms user frotend/`)
```bash
npm install                    # Install deps (uses Bun or npm)
npm run dev                    # Vite dev server on :3000
npm run build                  # Production build (4GB Node heap limit)
npm run lint                   # ESLint check
npm run test:watch            # Vitest watch mode
npm run test:coverage         # Coverage report
npm run cap:build             # Capacitor Android build
```

### Backend (`lms-api-suraksha-lk/`)
```bash
npm install                    # Install deps
npm run start:dev             # NestJS watch mode (port 8080 default)
npm run build                 # Compile src/ → dist/
npm run test                  # Jest unit tests
npm run test:cov              # Coverage report
npm run migration:run         # TypeORM migrations
npm run validate:env          # Check required env vars
```

### Admin Frontend (`sysstemadminfrotend/`)
Similar to user frontend—start with `npm install && npm run dev`.

## Key Conventions

### File Structure & Naming
- **Backend modules**: Feature-scoped (`src/modules/<feature>/`), each with service, controller, DTO, entity, and repository
- **Database entities**: Suffix `.entity.ts` (e.g., `user.entity.ts`)
- **DTOs**: Suffix `.dto.ts` (e.g., `user.dto.ts`)
- **Repositories**: Suffix `.repository.ts`
- **Frontend components**: PascalCase (`UserCard.tsx`), co-located utils/hooks in same folder

### TypeScript & Path Aliases
- All projects use strict TypeScript with path aliases: `@/*` → `src/`, `@common/*` for shared code
- Backend also uses `src/config/` for defaults, `src/services/` for cross-module utilities
- Frontend: Emotion for styling (`@emotion/styled`), no CSS modules; Radix UI for primitives

### Environment Setup
- **Frontend**: `VITE_` prefix for public env vars (never secrets), `.env.local` for local overrides
- **Backend**: `.env` file with database/storage/JWT secrets. `validate-environment.ts` enforces required vars on startup
- **Database**: MySQL 8.0 (external host), TypeORM migrations in `src/migrations/`—run `npm run migration:run` after schema changes

## Critical Gotchas & Patterns

### ⚠️ **Timezone Issues (SRI LANKA UTC+5:30)**
- Server code converts all timestamps to ISO and stores in UTC; frontend displays in local user timezone
- **Bug**: Using `new Date().toISOString()` near midnight can shift dates by 1 day. Use explicit timezone conversion
- **Pattern**: Backend services accept ISO strings, convert internally; frontend computes relative times with offset awareness
- See: `TIMEZONE_FIX_CORRECT_IMPLEMENTATION.md`, `TIMEZONE_AUDIT_REPORT.md` in backend folder

### Silent Repository Failures
- TypeORM `SELECT` queries that reference deleted database columns **do NOT fail at compile time**—only at runtime
- **Pattern**: After schema migrations, always verify affected queries run correctly with new schema
- Run: `npm run migration:show` to see current schema

### Empty String Parameters
- Services sometimes receive empty string (`''`) instead of valid IDs. Check null/empty before repository queries
- **Pattern**: DTOs should validate with `@IsNotEmpty()` decorators; controllers should reject early

### Data Masking & Audit Interceptors
- NestJS interceptors apply data masking and audit logging based on entity properties
- After schema changes, verify interceptors don't reference deleted columns; test with actual requests

### Multi-Tenant Scoping
- **All queries must scope to `instituteId`** (passed via JWT or query params)
- Missing scope: Queries return unrelated institute data → security hole
- Pattern: Services accept `instituteId` parameter; repositories always include `WHERE instituteId = ?`

## Project Structure

```
cmd/
  .github/                                  # GitHub & CI/CD config
  lms user frotend/                        # User mobile frontend
    src/components/, src/pages/, src/*.tsx  # React components
    public/                                 # Static assets
    package.json, vite.config.ts
  lms-api-suraksha-lk/                     # Backend API
    src/auth/                               # JWT auth, guard, decorator
    src/modules/                            # Feature modules (attendance, institute, etc.)
    src/config/                             # App config & DB connection
    src/migrations/                         # TypeORM migrations
    Dockerfile, cloudbuild.yaml             # Deployment to Cloud Run
    [60+ doc files]                         # Feature guides & API docs
  sysstemadminfrotend/                     # Admin frontend
```

## When to Use Existing Docs

The backend folder contains **60+ detailed guides** by feature (see filenames matching `*API*`, `*GUIDE*`, `*ARCHITECTURE*`):

- **Core flows**: `AUTH_COMPLETE_IMPLEMENTATION_GUIDE.md`, `ATTENDANCE_SYSTEM_COMPLETE_GUIDE.md`, `PAYMENT_SYSTEM_COMPLETE_GUIDE.md`
- **Frontend integration**: `*_FRONTEND_GUIDE.md` files for each feature
- **Architecture decisions**: `MULTI_TENANT_SYSTEM_ANALYSIS.md`, `INSTITUTE_CALENDAR_ATTENDANCE_ARCHITECTURE.md`
- **Known issues**: `BUGS_FIXED_REPORT.md`, `SYSTEM_ISSUES_BUGS_LIMITATIONS.md`

**When implementing a feature**: Search for `*_COMPLETE_*` or `*_GUIDE*` files matching the feature name.

## Development Workflow

1. **Understand requirements** via feature guide or architecture doc
2. **Implement backend** (NestJS module + migrations + tests)
3. **Implement frontend** (components + API calls + tests)
4. **Test end-to-end** with real data (run dev servers locally)
5. **Timezone verification** if dates/times are involved
6. **Document** any new patterns or gotchas in a FEATURE_NAME.md file

## Common Commands

```bash
# Each project directory—run these from the respective folder

# Frontend: Type check
cd "lms user frotend" && npm run build  # Full build check

# Backend: Validate setup
npm run validate:env
npm run migration:show
npm run start:dev

# Run tests with coverage
npm run test:cov
```

## Deployment

- **Frontend**: Capacitor mobile → Android APK; web build via Vite
- **Backend**: Docker image (see `Dockerfile`) → Google Cloud Run (2 CPU, 4Gi memory, us-central1)
- **CI/CD**: Google Cloud Build (`cloudbuild.yaml`) → Cloud Registry → Cloud Run
- **Secrets**: Environment-injected (JWT, DB credentials, storage keys) at runtime

## Code Quality

- **Linting**: ESLint configured for all projects; run `npm run lint` before committing
- **Testing**: Jest (backend), Vitest (frontend). All critical paths should have tests
- **Types**: TypeScript strictly enforced; no `any` without `// @ts-ignore` comment explaining why

---

**Last updated**: 2026-04-07  
For codebase-specific questions, consult the feature guides in the backend folder or ask for a related document search.
