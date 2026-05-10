# Solution 02 — One Custom Domain (abc.lk) for Multiple Institutes

## Problem
`abc.lk` can only belong to one institute. B and C cannot also use it.
There is no routing concept — the domain resolves to exactly one institute.

## Root Cause

### DB Constraint
```
institutes.custom_domain  →  UNIQUE
```
`@Index('idx_institutes_custom_domain', ['customDomain'], { unique: true })`
in `src/modules/institute/entities/institute.entity.ts` (line 18).

### setCustomDomain throws on collision
```typescript
// tenant.service.ts — setCustomDomain()
const existing = await this.instituteRepository.findOne({ where: { customDomain: domain } });
if (existing && existing.id !== instituteId) {
  throw new ConflictException(`Domain "${domain}" is already registered`);
}
```
The moment a second institute tries to claim `abc.lk`, the service throws.

### Single-institute resolver
```typescript
// tenant.service.ts — resolveByCustomDomain()
return this.instituteRepository.findOne({ where: { customDomain: domain } });
// Returns ONE institute — no routing table consulted
```

---

## Solution

### Step 1 — New table: `institute_domain_routing`

```sql
-- 002_domain_routing.sql
CREATE TABLE institute_domain_routing (
  id                          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  domain                      VARCHAR(255) NOT NULL
    COMMENT 'The shared custom domain (e.g. abc.lk)',
  owner_institute_id          BIGINT UNSIGNED NOT NULL
    COMMENT 'The institute that owns / pays for this domain',
  default_child_institute_id  BIGINT UNSIGNED NULL
    COMMENT 'Which institute handles requests with no path/subdomain match',
  routing_mode                ENUM('DEFAULT_CHILD','PATH_BASED','SUBDOMAIN_BASED')
                              NOT NULL DEFAULT 'DEFAULT_CHILD',
  ssl_status                  ENUM('PENDING','ACTIVE','EXPIRED','FAILED')
                              NOT NULL DEFAULT 'PENDING',
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE  KEY uk_idr_domain          (domain),
  INDEX       idx_idr_owner          (owner_institute_id),
  CONSTRAINT  fk_idr_owner
    FOREIGN KEY (owner_institute_id) REFERENCES institutes(id) ON DELETE CASCADE,
  CONSTRAINT  fk_idr_default_child
    FOREIGN KEY (default_child_institute_id) REFERENCES institutes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Path-based routing rules (child table)
CREATE TABLE institute_domain_routing_rules (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  routing_id        BIGINT UNSIGNED NOT NULL,
  match_value       VARCHAR(100) NOT NULL
    COMMENT 'Path prefix (/school) or subdomain prefix (school) to match',
  institute_id      BIGINT UNSIGNED NOT NULL
    COMMENT 'Route to this institute when match_value matches',
  priority          INT NOT NULL DEFAULT 0
    COMMENT 'Higher priority wins when multiple rules match',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_idrr_routing   (routing_id),
  INDEX idx_idrr_institute (institute_id),
  CONSTRAINT fk_idrr_routing
    FOREIGN KEY (routing_id) REFERENCES institute_domain_routing(id) ON DELETE CASCADE,
  CONSTRAINT fk_idrr_institute
    FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Remove UNIQUE from `institutes.custom_domain`:**
```sql
ALTER TABLE institutes DROP INDEX idx_institutes_custom_domain;
ALTER TABLE institutes ADD INDEX idx_institutes_custom_domain (custom_domain);
```

> **Rollback:**
> ```sql
> DROP TABLE institute_domain_routing_rules;
> DROP TABLE institute_domain_routing;
> ALTER TABLE institutes DROP INDEX idx_institutes_custom_domain;
> ALTER TABLE institutes ADD UNIQUE INDEX idx_institutes_custom_domain (custom_domain);
> ```

---

### Step 2 — New Entities

**File:** `src/modules/tenant/entities/institute-domain-routing.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, Index, OneToMany } from 'typeorm';

export enum DomainRoutingMode {
  DEFAULT_CHILD   = 'DEFAULT_CHILD',
  PATH_BASED      = 'PATH_BASED',
  SUBDOMAIN_BASED = 'SUBDOMAIN_BASED',
}

export enum DomainSslStatus {
  PENDING = 'PENDING',
  ACTIVE  = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  FAILED  = 'FAILED',
}

@Entity('institute_domain_routing')
export class InstituteDomainRoutingEntity {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  domain: string;

  @Column({ name: 'owner_institute_id', type: 'bigint' })
  ownerInstituteId: string;

  @Column({ name: 'default_child_institute_id', type: 'bigint', nullable: true })
  defaultChildInstituteId?: string;

  @Column({ name: 'routing_mode', type: 'enum', enum: DomainRoutingMode,
    default: DomainRoutingMode.DEFAULT_CHILD })
  routingMode: DomainRoutingMode;

  @Column({ name: 'ssl_status', type: 'enum', enum: DomainSslStatus,
    default: DomainSslStatus.PENDING })
  sslStatus: DomainSslStatus;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => InstituteDomainRoutingRuleEntity, r => r.routing, { cascade: true })
  rules: InstituteDomainRoutingRuleEntity[];
}
```

**File:** `src/modules/tenant/entities/institute-domain-routing-rule.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { InstituteDomainRoutingEntity } from './institute-domain-routing.entity';

@Entity('institute_domain_routing_rules')
export class InstituteDomainRoutingRuleEntity {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ name: 'routing_id', type: 'bigint' })
  routingId: string;

  @Column({ name: 'match_value', type: 'varchar', length: 100 })
  matchValue: string;          // e.g. '/school' or 'school'

  @Column({ name: 'institute_id', type: 'bigint' })
  instituteId: string;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => InstituteDomainRoutingEntity, r => r.rules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routing_id' })
  routing: InstituteDomainRoutingEntity;
}
```

---

### Step 3 — New Service: `DomainRoutingService`

**File:** `src/modules/tenant/services/domain-routing.service.ts`

```typescript
@Injectable()
export class DomainRoutingService {
  constructor(
    @InjectRepository(InstituteDomainRoutingEntity)
    private readonly routingRepo: Repository<InstituteDomainRoutingEntity>,
    @InjectRepository(InstituteDomainRoutingRuleEntity)
    private readonly ruleRepo: Repository<InstituteDomainRoutingRuleEntity>,
    @InjectRepository(InstituteEntity)
    private readonly instituteRepo: Repository<InstituteEntity>,
  ) {}

  /**
   * Register a domain under a routing group.
   * The ownerInstituteId must have ENTERPRISE or ISOLATED tier.
   */
  async createRoutingGroup(ownerInstituteId: string, domain: string): Promise<InstituteDomainRoutingEntity> {
    const owner = await this.instituteRepo.findOne({ where: { id: ownerInstituteId } });
    if (!owner) throw new NotFoundException('Owner institute not found');
    if (owner.tier !== InstituteTier.ENTERPRISE && owner.tier !== InstituteTier.ISOLATED) {
      throw new BadRequestException('Shared domain routing requires ENTERPRISE or ISOLATED tier');
    }

    const existing = await this.routingRepo.findOne({ where: { domain } });
    if (existing) throw new ConflictException(`Domain "${domain}" already has a routing group`);

    const entity = this.routingRepo.create({
      domain,
      ownerInstituteId,
      defaultChildInstituteId: ownerInstituteId,
      routingMode: DomainRoutingMode.DEFAULT_CHILD,
      sslStatus: DomainSslStatus.PENDING,
      isActive: true,
      createdAt: now(),
      updatedAt: now(),
    });
    return this.routingRepo.save(entity);
  }

  /**
   * Add an institute as a path-based or subdomain-based member.
   * Example: abc.lk/schoolb → Institute B
   */
  async addRoutingRule(
    routingId: string,
    matchValue: string,
    instituteId: string,
    priority = 0,
  ): Promise<InstituteDomainRoutingRuleEntity> {
    const rule = this.ruleRepo.create({
      routingId,
      matchValue,
      instituteId,
      priority,
      isActive: true,
      createdAt: now(),
    });
    return this.ruleRepo.save(rule);
  }

  /**
   * Resolve a domain + optional path prefix to an institute ID.
   * Used by the auth/branding resolver instead of the old direct lookup.
   */
  async resolveInstitute(domain: string, pathOrSubdomain?: string): Promise<string | null> {
    const routing = await this.routingRepo.findOne({
      where: { domain, isActive: true },
      relations: ['rules'],
    });
    if (!routing) return null;

    if (pathOrSubdomain && routing.rules?.length) {
      // Sort by priority desc, find first match
      const sorted = routing.rules
        .filter(r => r.isActive)
        .sort((a, b) => b.priority - a.priority);
      const matched = sorted.find(r => pathOrSubdomain.startsWith(r.matchValue));
      if (matched) return matched.instituteId;
    }

    return routing.defaultChildInstituteId ?? routing.ownerInstituteId;
  }

  async getRoutingGroup(domain: string): Promise<InstituteDomainRoutingEntity | null> {
    return this.routingRepo.findOne({ where: { domain }, relations: ['rules'] });
  }
}
```

---

### Step 4 — Update `setCustomDomain` in `TenantService`

```typescript
// tenant.service.ts — setCustomDomain()
async setCustomDomain(instituteId: string, dto: SetCustomDomainDto): Promise<InstituteEntity> {
  const domain = dto.domain.toLowerCase();

  // Check routing group first (shared domain)
  const routingGroup = await this.domainRoutingService.getRoutingGroup(domain);
  if (routingGroup && routingGroup.ownerInstituteId !== instituteId) {
    // Domain exists as a routing group — join it instead of claiming exclusively
    throw new BadRequestException(
      `Domain "${domain}" is managed as a shared routing group. ` +
      `Use POST /v2/tenant/domain-routing/${routingGroup.id}/rules to add your institute as a member.`,
    );
  }

  // Legacy single-institute path: ensure no OTHER institute has it exclusively
  const existing = await this.instituteRepository.findOne({ where: { customDomain: domain } });
  if (existing && existing.id !== instituteId) {
    throw new ConflictException(
      `Domain "${domain}" is already registered by another institute. ` +
      `Contact support to convert it to a shared routing group.`,
    );
  }

  const institute = await this.instituteRepository.findOne({ where: { id: instituteId } });
  if (!institute) throw new NotFoundException('Institute not found');
  if (institute.tier !== InstituteTier.ENTERPRISE && institute.tier !== InstituteTier.ISOLATED) {
    throw new BadRequestException('Custom domains require ENTERPRISE or ISOLATED tier');
  }

  institute.customDomain = domain;
  institute.customDomainVerified = false;
  institute.customDomainSslStatus = null;
  institute.customLoginEnabled = true;
  institute.updatedAt = now();
  return this.instituteRepository.save(institute);
}
```

---

### Step 5 — Update Domain Resolver (used at login/branding)

```typescript
// tenant.service.ts — resolveByCustomDomain()
async resolveByCustomDomain(domain: string, pathOrSubdomain?: string): Promise<InstituteEntity | null> {
  // 1. Check routing group table first
  const resolvedId = await this.domainRoutingService.resolveInstitute(domain, pathOrSubdomain);
  if (resolvedId) {
    return this.instituteRepository.findOne({ where: { id: resolvedId, isActive: true } });
  }

  // 2. Fallback: single-institute direct claim (legacy)
  return this.instituteRepository.findOne({
    where: { customDomain: domain, isActive: true },
  });
}
```

---

### Step 6 — New API Endpoints

```typescript
// tenant.controller.ts

// Create a shared domain routing group
@Post('domain-routing')
@UseGuards(InstituteAdminGuard)
createRoutingGroup(@Body() dto: CreateRoutingGroupDto) {
  return this.domainRoutingService.createRoutingGroup(dto.ownerInstituteId, dto.domain);
}

// Add a member institute to the routing group
@Post('domain-routing/:routingId/rules')
@UseGuards(InstituteAdminGuard)
addRoutingRule(
  @Param('routingId') routingId: string,
  @Body() dto: AddRoutingRuleDto,
) {
  return this.domainRoutingService.addRoutingRule(
    routingId, dto.matchValue, dto.instituteId, dto.priority,
  );
}

// Get routing group details
@Get('domain-routing/:domain')
getRoutingGroup(@Param('domain') domain: string) {
  return this.domainRoutingService.getRoutingGroup(domain);
}

// Resolve domain → institute (used by frontend/proxy)
@Get('domain-routing/resolve')
resolveInstitute(
  @Query('domain') domain: string,
  @Query('path') path?: string,
) {
  return this.domainRoutingService.resolveInstitute(domain, path);
}
```

---

### Step 7 — Frontend Updates

**`src/api/tenant.api.ts`** — add:

```typescript
createDomainRoutingGroup: (ownerInstituteId: string, domain: string) =>
  apiClient.post('/v2/tenant/domain-routing', { ownerInstituteId, domain }),

addDomainRoutingRule: (routingId: string, matchValue: string, instituteId: string, priority?: number) =>
  apiClient.post(`/v2/tenant/domain-routing/${routingId}/rules`, { matchValue, instituteId, priority }),

getDomainRoutingGroup: (domain: string) =>
  apiClient.get(`/v2/tenant/domain-routing/${domain}`),
```

**`InstituteBillingPage.tsx`** — in the custom domain section, detect if the domain is part of a routing group and show a "Shared Domain" badge with member list.

---

## Summary of Changes

| Component | Change |
|---|---|
| `institutes.custom_domain` | Remove UNIQUE index |
| New table `institute_domain_routing` | Owner, default child, routing mode, SSL status |
| New table `institute_domain_routing_rules` | Path/subdomain → institute mappings |
| `InstituteEntity` | `customDomain` loses `{ unique: true }` from entity decorator |
| New `DomainRoutingService` | Create group, add rule, resolve domain |
| `TenantService.setCustomDomain` | Check routing group before exclusive claim |
| `TenantService.resolveByCustomDomain` | Consult routing table first |
| `TenantController` | 4 new endpoints |
| `tenant.api.ts` | 3 new API methods |
| `InstituteBillingPage.tsx` | Shared domain badge + member list |
