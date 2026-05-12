# Institute Feature Plugin System - Backend Plan

Status: Draft
Date: 2026-05-12
Scope: lms-api-suraksha-lk

## Goals
- Provide institute-scoped feature toggles with no defaults.
- Return a single lightweight payload for frontend gating.
- Support paid vs free metadata with monthly and yearly billing cycles.
- Prepare for future backend enforcement.

## Non-goals
- No per-class or per-subject overrides.
- No institute type gating in this phase.
- No billing execution or invoices in this phase.

## Data model (proposed)

Table: feature_catalog
- key (primary key)
- label
- description
- scope (INSTITUTE, CLASS, SUBJECT)
- category (ATTENDANCE, ACADEMICS, PAYMENTS, COMMUNICATION, BRANDING, TRANSPORT, SERVICES)
- pricing (FREE, PAID)
- billing_cycle (MONTHLY, YEARLY, BOTH, TIER)
- is_core (boolean, default false)
- dependencies (json array of keys)
- ui_targets (json array of nav ids or sections)
- is_active (boolean, default true)

Table: institute_feature_toggles
- id
- institute_id (FK)
- feature_key (FK to feature_catalog)
- enabled (boolean)
- enabled_source (ADMIN, PLAN, SYSTEM)
- enabled_by_user_id (nullable)
- enabled_at
- expires_at (nullable)
- notes (nullable)
- updated_at

Optional table: institute_plan_features
- plan_id
- feature_key
- included (boolean)
- billing_cycle

## Feature resolution rules
- Start from catalog list.
- Default enabled = false for all features (no defaults).
- Apply plan grants (if any) as enabled_source=PLAN.
- Apply institute overrides (ADMIN) last.
- Enforce dependencies by auto-enabling dependencies or blocking enable until dependencies are enabled.

## API contract (proposed)
- GET /institutes/:id/features
  - Returns resolved features with enabled, pricing, scope, and lock reason.
- PATCH /institutes/:id/features
  - Institute admin updates enable or disable values.
  - Validate keys and dependencies.
- GET /features/catalog
  - System admin and backend use for UI lists and audits.
- POST /features/catalog
  - System admin adds new features.
- Optional: include features in an existing institute profile or /me response to avoid extra calls.

## Authorization and auditing
- Only institute admin can update feature toggles for their institute.
- Every change should be logged with user id and timestamp.
- When disabled, related feature usage should be blocked in a future enforcement phase.

## Performance and caching
- Use a single query to join catalog and institute toggles.
- Cache resolved feature payload by instituteId with short TTL.
- Keep payload small (key, enabled, scope, pricing, lockReason, updatedAt).

## Detailed backend todo list
1. Define feature enums (scope, category, pricing, billing cycle) and add validation DTOs.
2. Add migration for feature_catalog and institute_feature_toggles tables with indexes on institute_id and feature_key.
3. Seed feature_catalog with the initial list and no defaults.
4. Create a FeaturesService to resolve features (catalog + plan + institute overrides).
5. Create a FeaturesController with GET and PATCH endpoints.
6. Add authorization guards for institute admin on PATCH.
7. Add dependency validation logic (prevent enabling a feature without required dependencies).
8. Add plan integration to mark features as locked or enabled by plan.
9. Add audit logging for changes and keep enabled_source for traceability.
10. Add DTOs for response and update requests (including lockReason and pricing metadata).
11. Add tests for feature resolution, dependency handling, and permission checks.
12. Add optional middleware or guard for future backend enforcement on sensitive endpoints.
13. Add cache layer for GET /features with instituteId key and short TTL.
14. Add admin endpoint to list catalog and search by category or scope.
15. Document the API and add examples to the API guide.
