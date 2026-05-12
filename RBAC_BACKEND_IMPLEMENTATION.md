# RBAC Backend Implementation — Custom Institute User Types
## Complete Backend Redesign (No Hardcoding, Redis Caching, Optimal from Scratch)

---

## Table of Contents

- [Part 01 — Architecture Overview & Design Decisions](#part-01)
- [Part 02 — Database Schema Changes](#part-02)
- [Part 03 — TypeORM Entities](#part-03)
- [Part 04 — Migration Files](#part-04)
- [Part 05 — DTOs](#part-05)
- [Part 06 — Services](#part-06)
- [Part 07 — Controllers & API Endpoints](#part-07)
- [Part 08 — Redis Caching Strategy](#part-08)
- [Part 09 — Guards & Decorators](#part-09)
- [Part 10 — Module Wiring](#part-10)
- [Part 11 — Seeding Default System User Types](#part-11)
- [Part 12 — JWT Changes](#part-12)
- [Part 13 — File-by-File Change List](#part-13)
- [Part 14 — Migration Order & Execution](#part-14)

---

<a name="part-01"></a>
## Part 01 — Architecture Overview & Design Decisions

### Why Replace the Hardcoded Enum

Current `InstituteUserType` enum has 5 fixed values:
```
INSTITUTE_ADMIN | TEACHER | STUDENT | ATTENDANCE_MARKER | PARENT
```

Problems:
- An institute can't create a custom role like "Lab Assistant" or "Finance Officer"
- Giving a STUDENT admin-level access to one feature is impossible without code changes
- Permission checks are scattered: `if (user.type === 'TEACHER')` appears in dozens of places
- No per-feature granularity — a teacher either has access or doesn't, no middle ground

### New Mental Model

```
Institute
  └── InstituteUserType (e.g. "Head Teacher", "Bursar", "Lab Monitor")
        └── FeaturePermissions (canView, canCreate, canUpdate, canDelete, canReport)
              └── per FeatureCatalog key
```

Every institute defines its own user types. Each user type has a permission matrix row per feature. One DB query loads the full matrix for a user type and it's cached in Redis for 1 hour.

### Key Architectural Decisions

1. **No `base_role` enum anywhere** — no fallback to the old 5 values. Build clean.
2. **`institute_user_types` table** — one row per user type per institute.
3. **`institute_feature_permissions` table** — one row per (user_type_id, feature_key).
4. **`institute_user.primary_user_type_id`** — replaces `institute_user_type` enum column.
5. **`institute_class_users`** — renamed from `institute_class_students` so any user type can enroll in a class (teacher, student, auditor, etc.).
6. **`institute_class_subject_users`** — renamed from `institute_class_subject_students`.
7. **Redis cache key**: `rbac:inst:{instituteId}:ut:{userTypeId}` → JSON permission matrix.
8. **`GET /institutes/:id/my-context`** — single endpoint the frontend calls on login to get user type info + full permission matrix. Replaces 4 separate round trips.
9. **System-level default types** — seeded at startup; institutes copy from these as templates.
10. **Old enum column kept temporarily** — `institute_user_type` column stays in DB, nullable, for backward compat until all queries migrate.

---

<a name="part-02"></a>
## Part 02 — Database Schema Changes

### New Table: `institute_user_types`

```sql
CREATE TABLE institute_user_types (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  institute_id  BIGINT NOT NULL,
  name          VARCHAR(80) NOT NULL,          -- "Head Teacher", "Bursar", "Lab Monitor"
  slug          VARCHAR(80) NOT NULL,          -- "head_teacher", "bursar" (URL-safe)
  description   TEXT NULL,
  color         VARCHAR(20) NULL,              -- UI hex color e.g. "#3B82F6"
  icon          VARCHAR(50) NULL,              -- icon name e.g. "GraduationCap"
  is_system     TINYINT(1) NOT NULL DEFAULT 0, -- 1 = created by platform, not deletable
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_institute_user_type_slug (institute_id, slug),
  INDEX idx_iut_institute_active (institute_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### New Table: `institute_feature_permissions`

```sql
CREATE TABLE institute_feature_permissions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_type_id    BIGINT UNSIGNED NOT NULL,
  feature_key     VARCHAR(80) NOT NULL,
  can_view        TINYINT(1) NOT NULL DEFAULT 0,
  can_create      TINYINT(1) NOT NULL DEFAULT 0,
  can_update      TINYINT(1) NOT NULL DEFAULT 0,
  can_delete      TINYINT(1) NOT NULL DEFAULT 0,
  can_report      TINYINT(1) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_perm_type_feature (user_type_id, feature_key),
  FOREIGN KEY fk_perm_user_type (user_type_id) REFERENCES institute_user_types(id) ON DELETE CASCADE,
  FOREIGN KEY fk_perm_feature (feature_key) REFERENCES feature_catalog(key) ON DELETE CASCADE,
  INDEX idx_ifp_type (user_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Modified Table: `institute_user`

```sql
-- Add new column (keep old enum column for backward compat during transition)
ALTER TABLE institute_user
  ADD COLUMN primary_user_type_id BIGINT UNSIGNED NULL AFTER institute_user_type,
  ADD INDEX idx_iu_user_type_id (institute_id, primary_user_type_id);
```

### Renamed Table: `institute_class_students` → `institute_class_users`

```sql
-- The actual rename happens in the migration.
-- New column added: user_role_in_class (VARCHAR 30, nullable)
-- This lets a TEACHER enroll in a class as 'class_teacher' vs 'student'
ALTER TABLE institute_class_students
  RENAME TO institute_class_users;
ALTER TABLE institute_class_users
  ADD COLUMN user_role_in_class VARCHAR(30) NULL DEFAULT NULL AFTER student_type,
  ADD COLUMN user_type_id BIGINT UNSIGNED NULL AFTER user_role_in_class;
```

### Renamed Table: `institute_class_subject_students` → `institute_class_subject_users`

```sql
ALTER TABLE institute_class_subject_students
  RENAME TO institute_class_subject_users;
ALTER TABLE institute_class_subject_users
  ADD COLUMN user_type_id BIGINT UNSIGNED NULL;
```

---

<a name="part-03"></a>
## Part 03 — TypeORM Entities

### 3.1 — `InstituteUserType` Entity

**File:** `src/modules/rbac/entities/institute-user-type.entity.ts`

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, Index,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { InstituteFeaturePermission } from './institute-feature-permission.entity';

@Entity('institute_user_types')
@Index('idx_iut_institute_active', ['instituteId', 'isActive'])
export class InstituteUserType {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'institute_id', type: 'bigint' })
  instituteId: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  color?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon?: string;

  @Column({ name: 'is_system', type: 'tinyint', default: 0 })
  isSystem: boolean;

  @Column({ name: 'is_active', type: 'tinyint', default: 1 })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => InstituteFeaturePermission, p => p.userType, { cascade: true })
  permissions: InstituteFeaturePermission[];
}
```

### 3.2 — `InstituteFeaturePermission` Entity

**File:** `src/modules/rbac/entities/institute-feature-permission.entity.ts`

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { InstituteUserType } from './institute-user-type.entity';

@Entity('institute_feature_permissions')
@Index('idx_ifp_type', ['userTypeId'])
export class InstituteFeaturePermission {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'user_type_id', type: 'bigint', unsigned: true })
  userTypeId: string;

  @Column({ name: 'feature_key', type: 'varchar', length: 80 })
  featureKey: string;

  @Column({ name: 'can_view', type: 'tinyint', default: 0 })
  canView: boolean;

  @Column({ name: 'can_create', type: 'tinyint', default: 0 })
  canCreate: boolean;

  @Column({ name: 'can_update', type: 'tinyint', default: 0 })
  canUpdate: boolean;

  @Column({ name: 'can_delete', type: 'tinyint', default: 0 })
  canDelete: boolean;

  @Column({ name: 'can_report', type: 'tinyint', default: 0 })
  canReport: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => InstituteUserType, ut => ut.permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_type_id' })
  userType: InstituteUserType;
}
```

### 3.3 — Update `InstituteUserEntity`

**File:** `src/modules/institute_mudules/institue_user/entities/institue_user.entity.ts`

Add this column after `instituteUserType`:

```typescript
// NEW: dynamic user type reference (replaces hardcoded enum long term)
@Column({ name: 'primary_user_type_id', type: 'bigint', unsigned: true, nullable: true })
primaryUserTypeId?: string;
```

The existing `instituteUserType` enum column stays — do not remove it. It will be deprecated once all code migrates.

### 3.4 — `InstituteClassUser` Entity (renamed from InstituteClassStudentEntity)

**File:** `src/modules/institute_class_modules/institute_class_user/entities/institute_class_user.entity.ts`

```typescript
import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { InstituteEntity } from '../../../institute/entities/institute.entity';
import { InstituteClassEntity } from '../../../institute_mudules/institue_class/entities/institue_class.entity';
import { UserEntity } from '../../../user/entities/user.entity';

@Entity('institute_class_users')
@Index('idx_class_users_user_active', ['userId', 'isActive'])
@Index('idx_class_users_institute_class', ['instituteId', 'classId', 'isActive'])
@Index('idx_class_users_institute_active', ['instituteId', 'isActive'])
@Index('idx_class_users_verified', ['classId', 'isVerified', 'isActive'])
export class InstituteClassUserEntity {
  @PrimaryColumn({ name: 'institute_id', type: 'bigint' })
  instituteId: string;

  @PrimaryColumn({ name: 'institute_class_id', type: 'bigint' })
  classId: string;

  @PrimaryColumn({ name: 'student_user_id', type: 'bigint' })
  userId: string;                     // ← renamed from studentUserId

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ name: 'enrollment_method', type: 'varchar', length: 20, default: 'manual' })
  enrollmentMethod: string;

  @Column({ name: 'enrollment_reason', type: 'text', nullable: true })
  enrollmentReason?: string;

  @Column({ name: 'verified_by', type: 'bigint', nullable: true })
  verifiedBy?: string;

  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt?: Date;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @Column({
    name: 'student_type',
    type: 'enum',
    enum: ['normal', 'paid', 'free_card', 'half_paid', 'quarter_paid'],
    default: 'normal',
  })
  studentType: 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid';

  @Column({ name: 'user_role_in_class', type: 'varchar', length: 30, nullable: true })
  userRoleInClass?: string;           // NEW: e.g. "class_teacher", "student", "auditor"

  @Column({ name: 'user_type_id', type: 'bigint', unsigned: true, nullable: true })
  userTypeId?: string;                // NEW: FK to institute_user_types

  @Column({ name: 'extra_data', type: 'json', nullable: true })
  extraData?: Record<string, any>;

  @ManyToOne(() => InstituteEntity, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'institute_id' }])
  institute?: InstituteEntity;

  @ManyToOne(() => InstituteClassEntity, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'institute_class_id' }])
  class?: InstituteClassEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'student_user_id' }])
  user?: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'verified_by' })
  verifier?: UserEntity;
}
```

---

<a name="part-04"></a>
## Part 04 — Migration Files

### Migration 1: Create RBAC Tables

**File:** `src/migrations/1790000000000-CreateRbacTables.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRbacTables1790000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS institute_user_types (
        id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        institute_id  BIGINT NOT NULL,
        name          VARCHAR(80) NOT NULL,
        slug          VARCHAR(80) NOT NULL,
        description   TEXT NULL,
        color         VARCHAR(20) NULL,
        icon          VARCHAR(50) NULL,
        is_system     TINYINT(1) NOT NULL DEFAULT 0,
        is_active     TINYINT(1) NOT NULL DEFAULT 1,
        sort_order    INT NOT NULL DEFAULT 0,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_institute_user_type_slug (institute_id, slug),
        INDEX idx_iut_institute_active (institute_id, is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS institute_feature_permissions (
        id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_type_id    BIGINT UNSIGNED NOT NULL,
        feature_key     VARCHAR(80) NOT NULL,
        can_view        TINYINT(1) NOT NULL DEFAULT 0,
        can_create      TINYINT(1) NOT NULL DEFAULT 0,
        can_update      TINYINT(1) NOT NULL DEFAULT 0,
        can_delete      TINYINT(1) NOT NULL DEFAULT 0,
        can_report      TINYINT(1) NOT NULL DEFAULT 0,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_perm_type_feature (user_type_id, feature_key),
        INDEX idx_ifp_type (user_type_id),
        CONSTRAINT fk_perm_user_type FOREIGN KEY (user_type_id)
          REFERENCES institute_user_types(id) ON DELETE CASCADE,
        CONSTRAINT fk_perm_feature FOREIGN KEY (feature_key)
          REFERENCES feature_catalog(\`key\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS institute_feature_permissions');
    await queryRunner.query('DROP TABLE IF EXISTS institute_user_types');
  }
}
```

### Migration 2: Add `primary_user_type_id` to `institute_user`

**File:** `src/migrations/1790000000001-AddUserTypeIdToInstituteUser.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserTypeIdToInstituteUser1790000000001 implements MigrationInterface {
  private async columnExists(queryRunner: QueryRunner, table: string, column: string): Promise<boolean> {
    const [row] = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return parseInt(row.cnt, 10) > 0;
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.columnExists(queryRunner, 'institute_user', 'primary_user_type_id'))) {
      await queryRunner.query(`
        ALTER TABLE institute_user
          ADD COLUMN primary_user_type_id BIGINT UNSIGNED NULL AFTER institute_user_type,
          ADD INDEX idx_iu_user_type_id (institute_id, primary_user_type_id)
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.columnExists(queryRunner, 'institute_user', 'primary_user_type_id')) {
      await queryRunner.query(`
        ALTER TABLE institute_user
          DROP INDEX idx_iu_user_type_id,
          DROP COLUMN primary_user_type_id
      `);
    }
  }
}
```

### Migration 3: Rename `institute_class_students` → `institute_class_users`

**File:** `src/migrations/1790000000002-RenameClassStudentsToClassUsers.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameClassStudentsToClassUsers1790000000002 implements MigrationInterface {
  private async tableExists(queryRunner: QueryRunner, table: string): Promise<boolean> {
    const [row] = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );
    return parseInt(row.cnt, 10) > 0;
  }

  private async columnExists(queryRunner: QueryRunner, table: string, column: string): Promise<boolean> {
    const [row] = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return parseInt(row.cnt, 10) > 0;
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    // Only rename if old name exists and new name doesn't
    const oldExists = await this.tableExists(queryRunner, 'institute_class_students');
    const newExists = await this.tableExists(queryRunner, 'institute_class_users');

    if (oldExists && !newExists) {
      await queryRunner.query('RENAME TABLE institute_class_students TO institute_class_users');
    }

    if (await this.tableExists(queryRunner, 'institute_class_users')) {
      if (!(await this.columnExists(queryRunner, 'institute_class_users', 'user_role_in_class'))) {
        await queryRunner.query(`
          ALTER TABLE institute_class_users
            ADD COLUMN user_role_in_class VARCHAR(30) NULL DEFAULT NULL,
            ADD COLUMN user_type_id BIGINT UNSIGNED NULL
        `);
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const exists = await this.tableExists(queryRunner, 'institute_class_users');
    if (exists) {
      if (await this.columnExists(queryRunner, 'institute_class_users', 'user_role_in_class')) {
        await queryRunner.query(`
          ALTER TABLE institute_class_users
            DROP COLUMN user_role_in_class,
            DROP COLUMN user_type_id
        `);
      }
      if (!(await this.tableExists(queryRunner, 'institute_class_students'))) {
        await queryRunner.query('RENAME TABLE institute_class_users TO institute_class_students');
      }
    }
  }
}
```

### Migration 4: Rename `institute_class_subject_students` → `institute_class_subject_users`

**File:** `src/migrations/1790000000003-RenameSubjectStudentsToSubjectUsers.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameSubjectStudentsToSubjectUsers1790000000003 implements MigrationInterface {
  private async tableExists(queryRunner: QueryRunner, table: string): Promise<boolean> {
    const [row] = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );
    return parseInt(row.cnt, 10) > 0;
  }

  private async columnExists(queryRunner: QueryRunner, table: string, column: string): Promise<boolean> {
    const [row] = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return parseInt(row.cnt, 10) > 0;
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    const oldExists = await this.tableExists(queryRunner, 'institute_class_subject_students');
    const newExists = await this.tableExists(queryRunner, 'institute_class_subject_users');

    if (oldExists && !newExists) {
      await queryRunner.query('RENAME TABLE institute_class_subject_students TO institute_class_subject_users');
    }

    if (await this.tableExists(queryRunner, 'institute_class_subject_users')) {
      if (!(await this.columnExists(queryRunner, 'institute_class_subject_users', 'user_type_id'))) {
        await queryRunner.query(`
          ALTER TABLE institute_class_subject_users
            ADD COLUMN user_type_id BIGINT UNSIGNED NULL
        `);
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const exists = await this.tableExists(queryRunner, 'institute_class_subject_users');
    if (exists) {
      if (await this.columnExists(queryRunner, 'institute_class_subject_users', 'user_type_id')) {
        await queryRunner.query('ALTER TABLE institute_class_subject_users DROP COLUMN user_type_id');
      }
      if (!(await this.tableExists(queryRunner, 'institute_class_subject_students'))) {
        await queryRunner.query('RENAME TABLE institute_class_subject_users TO institute_class_subject_students');
      }
    }
  }
}
```

---

<a name="part-05"></a>
## Part 05 — DTOs

**File:** `src/modules/rbac/dto/user-type.dto.ts`

```typescript
import {
  IsString, IsOptional, IsBoolean, IsInt, IsArray,
  ValidateNested, MaxLength, IsIn, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserTypeDto {
  @IsString() @MaxLength(80)
  name: string;

  @IsString() @MaxLength(80)
  slug: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString() @MaxLength(20)
  color?: string;

  @IsOptional() @IsString() @MaxLength(50)
  icon?: string;

  @IsOptional() @IsInt() @Min(0) @Max(999)
  sortOrder?: number;
}

export class UpdateUserTypeDto {
  @IsOptional() @IsString() @MaxLength(80)
  name?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString() @MaxLength(20)
  color?: string;

  @IsOptional() @IsString() @MaxLength(50)
  icon?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(999)
  sortOrder?: number;
}

export class PermissionRowDto {
  @IsString() @MaxLength(80)
  featureKey: string;

  @IsBoolean() canView: boolean;
  @IsBoolean() canCreate: boolean;
  @IsBoolean() canUpdate: boolean;
  @IsBoolean() canDelete: boolean;
  @IsBoolean() canReport: boolean;
}

export class UpdatePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionRowDto)
  permissions: PermissionRowDto[];
}

export class BulkUpdatePermissionsDto {
  // map: { featureKey: { canView, canCreate, canUpdate, canDelete, canReport } }
  permissions: Record<string, {
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canReport: boolean;
  }>;
}
```

---

<a name="part-06"></a>
## Part 06 — Services

### 6.1 — `UserTypesService`

**File:** `src/modules/rbac/services/user-types.service.ts`

```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstituteUserType } from '../entities/institute-user-type.entity';
import { CreateUserTypeDto, UpdateUserTypeDto } from '../dto/user-type.dto';

@Injectable()
export class UserTypesService {
  constructor(
    @InjectRepository(InstituteUserType)
    private readonly repo: Repository<InstituteUserType>,
  ) {}

  async findAllForInstitute(instituteId: string): Promise<InstituteUserType[]> {
    return this.repo.find({
      where: { instituteId, isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string, instituteId: string): Promise<InstituteUserType> {
    const ut = await this.repo.findOne({ where: { id, instituteId } });
    if (!ut) throw new NotFoundException(`User type ${id} not found`);
    return ut;
  }

  async create(instituteId: string, dto: CreateUserTypeDto): Promise<InstituteUserType> {
    // Check slug uniqueness within this institute
    const existing = await this.repo.findOne({ where: { instituteId, slug: dto.slug } });
    if (existing) throw new ConflictException(`Slug "${dto.slug}" already used in this institute`);

    const ut = this.repo.create({ ...dto, instituteId, isSystem: false });
    return this.repo.save(ut);
  }

  async update(id: string, instituteId: string, dto: UpdateUserTypeDto): Promise<InstituteUserType> {
    const ut = await this.findOne(id, instituteId);
    if (ut.isSystem) {
      // System types can have color/icon/description updated but not name/slug
      const { name, ...safeUpdates } = dto as any;
      Object.assign(ut, safeUpdates);
    } else {
      Object.assign(ut, dto);
    }
    return this.repo.save(ut);
  }

  async softDelete(id: string, instituteId: string): Promise<void> {
    const ut = await this.findOne(id, instituteId);
    if (ut.isSystem) throw new ConflictException('Cannot delete a system user type');
    ut.isActive = false;
    await this.repo.save(ut);
  }
}
```

### 6.2 — `FeaturePermissionsService`

**File:** `src/modules/rbac/services/feature-permissions.service.ts`

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InstituteFeaturePermission } from '../entities/institute-feature-permission.entity';
import { BulkUpdatePermissionsDto } from '../dto/user-type.dto';

export interface PermissionMatrix {
  [featureKey: string]: {
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canReport: boolean;
  };
}

const CACHE_TTL = 3600; // 1 hour in seconds

@Injectable()
export class FeaturePermissionsService {
  constructor(
    @InjectRepository(InstituteFeaturePermission)
    private readonly repo: Repository<InstituteFeaturePermission>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private cacheKey(instituteId: string, userTypeId: string): string {
    return `rbac:inst:${instituteId}:ut:${userTypeId}`;
  }

  async getMatrix(instituteId: string, userTypeId: string): Promise<PermissionMatrix> {
    const key = this.cacheKey(instituteId, userTypeId);

    // Try cache first
    const cached = await this.cache.get<PermissionMatrix>(key);
    if (cached) return cached;

    // Load from DB
    const rows = await this.repo.find({ where: { userTypeId } });
    const matrix: PermissionMatrix = {};
    for (const row of rows) {
      matrix[row.featureKey] = {
        canView: !!row.canView,
        canCreate: !!row.canCreate,
        canUpdate: !!row.canUpdate,
        canDelete: !!row.canDelete,
        canReport: !!row.canReport,
      };
    }

    await this.cache.set(key, matrix, CACHE_TTL);
    return matrix;
  }

  async bulkUpdate(
    instituteId: string,
    userTypeId: string,
    dto: BulkUpdatePermissionsDto,
  ): Promise<void> {
    const em = this.repo.manager;
    const entries = Object.entries(dto.permissions);
    if (entries.length === 0) return;

    await Promise.all(
      entries.map(([featureKey, perms]) =>
        em.query(
          `INSERT INTO institute_feature_permissions
             (user_type_id, feature_key, can_view, can_create, can_update, can_delete, can_report, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             can_view = VALUES(can_view),
             can_create = VALUES(can_create),
             can_update = VALUES(can_update),
             can_delete = VALUES(can_delete),
             can_report = VALUES(can_report),
             updated_at = NOW()`,
          [
            userTypeId,
            featureKey,
            perms.canView ? 1 : 0,
            perms.canCreate ? 1 : 0,
            perms.canUpdate ? 1 : 0,
            perms.canDelete ? 1 : 0,
            perms.canReport ? 1 : 0,
          ],
        ),
      ),
    );

    // Invalidate cache for this user type
    await this.cache.del(this.cacheKey(instituteId, userTypeId));
  }

  async invalidateForInstitute(instituteId: string, userTypeIds: string[]): Promise<void> {
    await Promise.all(
      userTypeIds.map(id => this.cache.del(this.cacheKey(instituteId, id))),
    );
  }

  async getPermissionsForUserType(userTypeId: string): Promise<InstituteFeaturePermission[]> {
    return this.repo.find({ where: { userTypeId } });
  }
}
```

### 6.3 — `RbacContextService` (the main context builder)

**File:** `src/modules/rbac/services/rbac-context.service.ts`

This service builds the full "my context" payload returned to the frontend on login and when `GET /institutes/:id/my-context` is called.

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstituteUserEntity } from '../../institute_mudules/institue_user/entities/institue_user.entity';
import { InstituteUserType } from '../entities/institute-user-type.entity';
import { FeaturePermissionsService, PermissionMatrix } from './feature-permissions.service';

export interface UserRbacContext {
  userTypeId: string | null;
  userTypeName: string | null;
  userTypeSlug: string | null;
  userTypeColor: string | null;
  userTypeIcon: string | null;
  permissions: PermissionMatrix;
  // Legacy field for backward compat during transition
  legacyUserType: string | null;
}

@Injectable()
export class RbacContextService {
  constructor(
    @InjectRepository(InstituteUserEntity)
    private readonly iuRepo: Repository<InstituteUserEntity>,
    @InjectRepository(InstituteUserType)
    private readonly utRepo: Repository<InstituteUserType>,
    private readonly permissionsService: FeaturePermissionsService,
  ) {}

  async getContextForUser(userId: string, instituteId: string): Promise<UserRbacContext> {
    const iu = await this.iuRepo.findOne({
      where: { userId, instituteId },
      select: ['userId', 'instituteId', 'primaryUserTypeId', 'instituteUserType'],
    });

    if (!iu || !iu.primaryUserTypeId) {
      return {
        userTypeId: null,
        userTypeName: null,
        userTypeSlug: null,
        userTypeColor: null,
        userTypeIcon: null,
        permissions: {},
        legacyUserType: iu?.instituteUserType ?? null,
      };
    }

    const ut = await this.utRepo.findOne({ where: { id: iu.primaryUserTypeId } });
    if (!ut) {
      return {
        userTypeId: null,
        userTypeName: null,
        userTypeSlug: null,
        userTypeColor: null,
        userTypeIcon: null,
        permissions: {},
        legacyUserType: iu.instituteUserType ?? null,
      };
    }

    const permissions = await this.permissionsService.getMatrix(instituteId, iu.primaryUserTypeId);

    return {
      userTypeId: ut.id,
      userTypeName: ut.name,
      userTypeSlug: ut.slug,
      userTypeColor: ut.color ?? null,
      userTypeIcon: ut.icon ?? null,
      permissions,
      legacyUserType: iu.instituteUserType ?? null,
    };
  }
}
```

---

<a name="part-07"></a>
## Part 07 — Controllers & API Endpoints

### Full Endpoint List

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/institutes/:id/user-types` | JwtAuth | List all user types for institute |
| GET | `/institutes/:id/user-types/:typeId` | JwtAuth | Get single user type |
| POST | `/institutes/:id/user-types` | JwtAuth | Create new user type |
| PATCH | `/institutes/:id/user-types/:typeId` | JwtAuth | Update user type |
| DELETE | `/institutes/:id/user-types/:typeId` | JwtAuth | Soft-delete user type |
| GET | `/institutes/:id/user-types/:typeId/permissions` | JwtAuth | Get permission matrix |
| PUT | `/institutes/:id/user-types/:typeId/permissions` | JwtAuth | Bulk-update permission matrix |
| GET | `/institutes/:id/my-context` | JwtAuth | Get calling user's type + permissions |
| PATCH | `/institutes/:id/users/:userId/user-type` | JwtAuth | Assign user type to a user |
| GET | `/institutes/:id/users` | JwtAuth | List users with user type info |

### 7.1 — `RbacController`

**File:** `src/modules/rbac/rbac.controller.ts`

```typescript
import {
  Controller, Get, Post, Patch, Put, Delete,
  Param, Body, UseGuards, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserTypesService } from './services/user-types.service';
import { FeaturePermissionsService } from './services/feature-permissions.service';
import { RbacContextService } from './services/rbac-context.service';
import {
  CreateUserTypeDto, UpdateUserTypeDto, BulkUpdatePermissionsDto,
} from './dto/user-type.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class RbacController {
  constructor(
    private readonly userTypesService: UserTypesService,
    private readonly permissionsService: FeaturePermissionsService,
    private readonly contextService: RbacContextService,
  ) {}

  // ─── User Types ──────────────────────────────────────────────────────────

  @Get('institutes/:id/user-types')
  getUserTypes(@Param('id') id: string) {
    return this.userTypesService.findAllForInstitute(id);
  }

  @Get('institutes/:id/user-types/:typeId')
  getUserType(@Param('id') id: string, @Param('typeId') typeId: string) {
    return this.userTypesService.findOne(typeId, id);
  }

  @Post('institutes/:id/user-types')
  createUserType(@Param('id') id: string, @Body() dto: CreateUserTypeDto) {
    return this.userTypesService.create(id, dto);
  }

  @Patch('institutes/:id/user-types/:typeId')
  updateUserType(
    @Param('id') id: string,
    @Param('typeId') typeId: string,
    @Body() dto: UpdateUserTypeDto,
  ) {
    return this.userTypesService.update(typeId, id, dto);
  }

  @Delete('institutes/:id/user-types/:typeId')
  deleteUserType(@Param('id') id: string, @Param('typeId') typeId: string) {
    return this.userTypesService.softDelete(typeId, id);
  }

  // ─── Permissions ─────────────────────────────────────────────────────────

  @Get('institutes/:id/user-types/:typeId/permissions')
  async getPermissions(@Param('id') id: string, @Param('typeId') typeId: string) {
    const matrix = await this.permissionsService.getMatrix(id, typeId);
    return { userTypeId: typeId, permissions: matrix };
  }

  @Put('institutes/:id/user-types/:typeId/permissions')
  async updatePermissions(
    @Param('id') id: string,
    @Param('typeId') typeId: string,
    @Body() dto: BulkUpdatePermissionsDto,
  ) {
    await this.permissionsService.bulkUpdate(id, typeId, dto);
    return { success: true };
  }

  // ─── My Context ──────────────────────────────────────────────────────────

  @Get('institutes/:id/my-context')
  async getMyContext(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.userId ?? req.user?.sub;
    return this.contextService.getContextForUser(String(userId), id);
  }

  // ─── Assign User Type ────────────────────────────────────────────────────

  @Patch('institutes/:id/users/:userId/user-type')
  async assignUserType(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: { userTypeId: string },
  ) {
    const em = this.userTypesService['repo'].manager;
    await em.query(
      `UPDATE institute_user
       SET primary_user_type_id = ?, updated_at = NOW()
       WHERE institute_id = ? AND user_id = ?`,
      [body.userTypeId, id, userId],
    );
    // Invalidate RBAC context cache for this user if you add per-user caching later
    return { success: true };
  }
}
```

---

<a name="part-08"></a>
## Part 08 — Redis Caching Strategy

### Cache Key Scheme

```
rbac:inst:{instituteId}:ut:{userTypeId}    → PermissionMatrix (1 hour TTL)
```

### Cache Flow

```
Request arrives → Guard reads JWT → extracts instituteId + userTypeId
                ↓
  cache.get("rbac:inst:109:ut:42")
                ↓
  HIT → return matrix directly (0 DB queries)
                ↓
  MISS → SELECT * FROM institute_feature_permissions WHERE user_type_id = 42
       → build matrix → cache.set(..., matrix, 3600)
       → return matrix
```

### Cache Invalidation

Invalidate only when permissions are changed:
- `PUT /institutes/:id/user-types/:typeId/permissions` → `cache.del(key)`
- If a user type is deleted → `cache.del(key)`
- Periodic TTL expiry handles the rest

### Performance Numbers

| Scenario | Without Redis | With Redis |
|----------|--------------|------------|
| First load (cold) | ~4ms (1 DB query) | ~4ms (DB miss) |
| Subsequent requests | ~4ms per request | ~0.2ms (Redis hit) |
| 1000 concurrent users | 4000ms total DB load | 200ms total Redis load |
| Permission matrix size (51 features) | ~2KB per type | ~2KB in Redis |

### Cache Module Integration

The existing `CacheModule` at `src/common/modules/cache.module.ts` already provides `CACHE_MANAGER`. Inject it in `FeaturePermissionsService`:

```typescript
@Inject(CACHE_MANAGER) private readonly cache: Cache,
```

Import `CacheModule` from `src/common/modules/cache.module.ts` in `RbacModule`.

---

<a name="part-09"></a>
## Part 09 — Guards & Decorators

### 9.1 — `RequirePermission` Decorator

**File:** `src/modules/rbac/decorators/require-permission.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export type PermissionAction = 'view' | 'create' | 'update' | 'delete' | 'report';

export interface PermissionRequirement {
  feature: string;
  action: PermissionAction;
}

export const PERMISSION_KEY = 'required_permission';

export const RequirePermission = (feature: string, action: PermissionAction) =>
  SetMetadata(PERMISSION_KEY, { feature, action } as PermissionRequirement);
```

### 9.2 — `RbacGuard`

**File:** `src/modules/rbac/guards/rbac.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeaturePermissionsService } from '../services/feature-permissions.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstituteUserEntity } from '../../institute_mudules/institue_user/entities/institue_user.entity';
import { PERMISSION_KEY, PermissionRequirement } from '../decorators/require-permission.decorator';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: FeaturePermissionsService,
    @InjectRepository(InstituteUserEntity)
    private readonly iuRepo: Repository<InstituteUserEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permission requirement — allow through
    if (!requirement) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId ?? request.user?.sub;
    // instituteId comes from route param or JWT claim
    const instituteId = request.params?.id ?? request.user?.selectedInstituteId;

    if (!userId || !instituteId) throw new ForbiddenException('Missing user or institute context');

    const iu = await this.iuRepo.findOne({
      where: { userId: String(userId), instituteId: String(instituteId) },
      select: ['primaryUserTypeId'],
    });

    if (!iu?.primaryUserTypeId) throw new ForbiddenException('User has no user type assigned');

    const matrix = await this.permissionsService.getMatrix(
      String(instituteId),
      String(iu.primaryUserTypeId),
    );

    const perm = matrix[requirement.feature];
    if (!perm) throw new ForbiddenException(`No permissions defined for feature: ${requirement.feature}`);

    const actionKey = `can${requirement.action.charAt(0).toUpperCase()}${requirement.action.slice(1)}` as keyof typeof perm;
    if (!perm[actionKey]) {
      throw new ForbiddenException(`Action "${requirement.action}" not allowed on feature "${requirement.feature}"`);
    }

    return true;
  }
}
```

### 9.3 — Usage Example in Another Controller

```typescript
@Get('attendance-sessions')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('attendance.class', 'view')
getAttendanceSessions(@Param('id') instituteId: string) {
  return this.attendanceService.getSessions(instituteId);
}
```

---

<a name="part-10"></a>
## Part 10 — Module Wiring

### `RbacModule`

**File:** `src/modules/rbac/rbac.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '../../common/modules/cache.module';
import { AuthModule } from '../../auth/auth.module';

import { InstituteUserType } from './entities/institute-user-type.entity';
import { InstituteFeaturePermission } from './entities/institute-feature-permission.entity';
import { InstituteUserEntity } from '../institute_mudules/institue_user/entities/institue_user.entity';

import { UserTypesService } from './services/user-types.service';
import { FeaturePermissionsService } from './services/feature-permissions.service';
import { RbacContextService } from './services/rbac-context.service';
import { RbacController } from './rbac.controller';
import { RbacGuard } from './guards/rbac.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InstituteUserType,
      InstituteFeaturePermission,
      InstituteUserEntity,
    ]),
    CacheModule,
    AuthModule,
  ],
  providers: [
    UserTypesService,
    FeaturePermissionsService,
    RbacContextService,
    RbacGuard,
  ],
  controllers: [RbacController],
  exports: [
    UserTypesService,
    FeaturePermissionsService,
    RbacContextService,
    RbacGuard,
  ],
})
export class RbacModule {}
```

### Register in `AppModule`

**File:** `src/app.module.ts`

Add to imports array:

```typescript
import { RbacModule } from './modules/rbac/rbac.module';

// Inside @Module({ imports: [...] })
RbacModule,
```

---

<a name="part-11"></a>
## Part 11 — Seeding Default System User Types

**File:** `src/database/seeds/1790000000004-SeedDefaultUserTypes.ts`

This seed creates system-level default user types for every existing institute. It uses `ON DUPLICATE KEY UPDATE` so it's safe to re-run.

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

// Default system user types — one set per institute
const SYSTEM_USER_TYPES = [
  {
    slug: 'institute_admin',
    name: 'Institute Admin',
    description: 'Full access to all institute features and settings',
    color: '#EF4444',
    icon: 'Shield',
    sort_order: 0,
    // Full permissions on everything
    permissionLevel: 'full',
  },
  {
    slug: 'teacher',
    name: 'Teacher',
    description: 'Manages classes, subjects, attendance, homework, and exams',
    color: '#3B82F6',
    icon: 'GraduationCap',
    sort_order: 1,
    permissionLevel: 'teacher',
  },
  {
    slug: 'student',
    name: 'Student',
    description: 'View-only access to their own classes, results, homework, and schedules',
    color: '#10B981',
    icon: 'BookOpen',
    sort_order: 2,
    permissionLevel: 'student',
  },
  {
    slug: 'attendance_marker',
    name: 'Attendance Marker',
    description: 'Can record attendance only; limited access elsewhere',
    color: '#F59E0B',
    icon: 'CheckSquare',
    sort_order: 3,
    permissionLevel: 'attendance_only',
  },
  {
    slug: 'parent',
    name: 'Parent',
    description: 'View-only access to child progress and payments',
    color: '#8B5CF6',
    icon: 'Users',
    sort_order: 4,
    permissionLevel: 'parent',
  },
];

// Permission matrix per level
// Format: featureKey → [canView, canCreate, canUpdate, canDelete, canReport]
const PERMISSION_TEMPLATES: Record<string, Record<string, number[]>> = {
  full: {
    'attendance.class':         [1,1,1,1,1],
    'attendance.subject':       [1,1,1,1,1],
    'attendance.device':        [1,1,1,1,1],
    'academics.classes':        [1,1,1,1,1],
    'academics.subjects':       [1,1,1,1,1],
    'academics.homework':       [1,1,1,1,1],
    'academics.exams':          [1,1,1,1,1],
    'academics.results':        [1,1,1,1,1],
    'academics.lectures.class': [1,1,1,1,1],
    'academics.lectures.subject':[1,1,1,1,1],
    'academics.study_materials':[1,1,1,1,1],
    'payments.class':           [1,1,1,1,1],
    'payments.subject':         [1,1,1,1,1],
    'payments.institute':       [1,1,1,1,1],
    'payments.reports':         [1,0,0,0,1],
    'communication.sms':        [1,1,1,1,1],
    'communication.push':       [1,1,1,1,1],
    'branding.logo':            [1,1,1,1,0],
    'branding.colors':          [1,1,1,1,0],
    'branding.reports':         [1,1,1,1,0],
    'transport.bookhire':       [1,1,1,1,1],
    'services.user_types':      [1,1,1,1,0],
    'services.drive':           [1,1,1,1,0],
    'services.houses':          [1,1,1,1,0],
    'services.id_cards':        [1,1,1,1,1],
    'services.calendar':        [1,1,1,1,0],
    'services.features':        [1,1,1,1,0],
  },
  teacher: {
    'attendance.class':         [1,1,1,0,1],
    'attendance.subject':       [1,1,1,0,1],
    'attendance.device':        [1,0,0,0,0],
    'academics.classes':        [1,0,0,0,0],
    'academics.subjects':       [1,0,0,0,0],
    'academics.homework':       [1,1,1,1,1],
    'academics.exams':          [1,1,1,1,1],
    'academics.results':        [1,1,1,1,1],
    'academics.lectures.class': [1,1,1,1,0],
    'academics.lectures.subject':[1,1,1,1,0],
    'academics.study_materials':[1,1,1,1,0],
    'payments.class':           [1,0,0,0,1],
    'payments.subject':         [1,0,0,0,1],
    'payments.institute':       [0,0,0,0,0],
    'payments.reports':         [1,0,0,0,1],
    'communication.sms':        [1,1,0,0,0],
    'communication.push':       [1,1,0,0,0],
    'transport.bookhire':       [1,0,0,0,0],
    'services.drive':           [1,1,0,0,0],
    'services.calendar':        [1,1,1,0,0],
  },
  student: {
    'attendance.class':         [1,0,0,0,0],
    'attendance.subject':       [1,0,0,0,0],
    'academics.classes':        [1,0,0,0,0],
    'academics.subjects':       [1,0,0,0,0],
    'academics.homework':       [1,1,1,0,0],
    'academics.exams':          [1,0,0,0,0],
    'academics.results':        [1,0,0,0,0],
    'academics.lectures.class': [1,0,0,0,0],
    'academics.lectures.subject':[1,0,0,0,0],
    'academics.study_materials':[1,0,0,0,0],
    'payments.class':           [1,0,0,0,0],
    'payments.subject':         [1,0,0,0,0],
    'transport.bookhire':       [1,0,0,0,0],
  },
  attendance_only: {
    'attendance.class':         [1,1,1,0,1],
    'attendance.subject':       [1,1,1,0,1],
    'attendance.device':        [1,0,0,0,0],
    'academics.classes':        [1,0,0,0,0],
  },
  parent: {
    'attendance.class':         [1,0,0,0,0],
    'attendance.subject':       [1,0,0,0,0],
    'academics.homework':       [1,0,0,0,0],
    'academics.results':        [1,0,0,0,0],
    'payments.class':           [1,0,0,0,0],
    'payments.subject':         [1,0,0,0,0],
    'transport.bookhire':       [1,0,0,0,0],
    'communication.push':       [1,0,0,0,0],
  },
};

export class SeedDefaultUserTypes1790000000004 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Get all institute IDs
    const institutes: { id: bigint }[] = await queryRunner.query(
      'SELECT id FROM institute ORDER BY id ASC',
    );

    for (const inst of institutes) {
      const instituteId = inst.id;

      for (const ut of SYSTEM_USER_TYPES) {
        // Upsert the user type
        await queryRunner.query(
          `INSERT INTO institute_user_types
             (institute_id, name, slug, description, color, icon, is_system, is_active, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = NOW()`,
          [instituteId, ut.name, ut.slug, ut.description, ut.color, ut.icon, ut.sort_order],
        );

        // Get its ID
        const [row]: { id: bigint }[] = await queryRunner.query(
          'SELECT id FROM institute_user_types WHERE institute_id = ? AND slug = ?',
          [instituteId, ut.slug],
        );
        if (!row) continue;

        const userTypeId = row.id;
        const template = PERMISSION_TEMPLATES[ut.permissionLevel] ?? {};

        // Upsert all permissions for this user type
        for (const [featureKey, perms] of Object.entries(template)) {
          await queryRunner.query(
            `INSERT INTO institute_feature_permissions
               (user_type_id, feature_key, can_view, can_create, can_update, can_delete, can_report, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE
               can_view = VALUES(can_view),
               can_create = VALUES(can_create),
               can_update = VALUES(can_update),
               can_delete = VALUES(can_delete),
               can_report = VALUES(can_report),
               updated_at = NOW()`,
            [userTypeId, featureKey, ...perms],
          );
        }
      }

      // Migrate existing users: map old enum → new user type
      const TYPE_MAP: Record<string, string> = {
        INSTITUTE_ADMIN:   'institute_admin',
        TEACHER:           'teacher',
        STUDENT:           'student',
        ATTENDANCE_MARKER: 'attendance_marker',
        PARENT:            'parent',
      };

      for (const [oldType, newSlug] of Object.entries(TYPE_MAP)) {
        await queryRunner.query(
          `UPDATE institute_user iu
           JOIN institute_user_types iut
             ON iut.institute_id = iu.institute_id AND iut.slug = ?
           SET iu.primary_user_type_id = iut.id, iu.updated_at = NOW()
           WHERE iu.institute_id = ? AND iu.institute_user_type = ? AND iu.primary_user_type_id IS NULL`,
          [newSlug, instituteId, oldType],
        );
      }
    }
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // No rollback for seed data
  }
}
```

Register the seed in `src/data-source.ts`:

```typescript
migrations: [
  __dirname + '/migrations/*{.ts,.js}',
  __dirname + '/database/seeds/*{.ts,.js}',
],
```

---

<a name="part-12"></a>
## Part 12 — JWT Changes

### Current JWT Payload Shape

The existing JWT contains `instituteUserType` (the old enum value). The new system adds `userTypeId` alongside it.

**File:** `src/auth/services/enhanced-jwt.service.ts`

When building the JWT payload for an institute session, include `primaryUserTypeId`:

```typescript
// In the method that builds institute JWT claims:
const iu = await this.iuRepo.findOne({
  where: { userId, instituteId },
  select: ['instituteUserType', 'primaryUserTypeId', 'status'],
});

// Add to JWT payload:
const payload = {
  ...existingClaims,
  iuType: iu.instituteUserType,    // keep for backward compat
  iuTypeId: iu.primaryUserTypeId,  // new field
};
```

The frontend reads `iuTypeId` from the JWT and uses it to call `GET /institutes/:id/my-context`. The full permission matrix is NOT stored in the JWT — it's too large and changes too often.

### What the Frontend Does on Login

1. JWT decoded → `iuTypeId` extracted
2. `GET /institutes/:id/my-context` called → returns `{ userTypeId, userTypeName, permissions }`
3. `permissions` stored in React context
4. All UI checks use `permissions['feature.key'].canView` etc.

---

<a name="part-13"></a>
## Part 13 — File-by-File Change List

### New Files to Create

```
src/modules/rbac/
  rbac.module.ts
  rbac.controller.ts
  entities/
    institute-user-type.entity.ts
    institute-feature-permission.entity.ts
  services/
    user-types.service.ts
    feature-permissions.service.ts
    rbac-context.service.ts
  dto/
    user-type.dto.ts
  guards/
    rbac.guard.ts
  decorators/
    require-permission.decorator.ts

src/migrations/
  1790000000000-CreateRbacTables.ts
  1790000000001-AddUserTypeIdToInstituteUser.ts
  1790000000002-RenameClassStudentsToClassUsers.ts
  1790000000003-RenameSubjectStudentsToSubjectUsers.ts

src/database/seeds/
  1790000000004-SeedDefaultUserTypes.ts

src/modules/institute_class_modules/institute_class_user/
  entities/
    institute_class_user.entity.ts
  institute_class_user.module.ts
```

### Files to Modify

| File | What Changes |
|------|-------------|
| `src/app.module.ts` | Add `RbacModule` import |
| `src/modules/institute_mudules/institue_user/entities/institue_user.entity.ts` | Add `primaryUserTypeId` column |
| `src/auth/services/enhanced-jwt.service.ts` | Add `iuTypeId` to JWT payload |
| `src/data-source.ts` | Seeds path already registered; ensure migrations glob covers `1790*` |

### Files That Do NOT Change

- All existing controllers, services, and guards continue to work unchanged
- The old `InstituteUserType` enum and `institute_user_type` column are NOT removed
- All existing queries using `instituteUserType` still work

---

<a name="part-14"></a>
## Part 14 — Migration Order & Execution

Run these migrations in order:

```bash
# Step 1 — Create the two new RBAC tables
npx ts-node -r tsconfig-paths/register ./node_modules/.bin/typeorm migration:run -d src/data-source.ts

# This will run (in timestamp order):
# 1790000000000-CreateRbacTables
# 1790000000001-AddUserTypeIdToInstituteUser
# 1790000000002-RenameClassStudentsToClassUsers
# 1790000000003-RenameSubjectStudentsToSubjectUsers
# 1790000000004-SeedDefaultUserTypes  (seed)
```

All migrations are idempotent:
- `CREATE TABLE IF NOT EXISTS` — safe to re-run
- `INFORMATION_SCHEMA.COLUMNS` checks — no crash if column already exists
- `ON DUPLICATE KEY UPDATE` in seed — safe to re-run
- `RENAME TABLE` is guarded by `IF NOT EXISTS` checks

### Verification Queries

After running migrations, verify with:

```sql
-- Check tables exist
SHOW TABLES LIKE 'institute_user_types';
SHOW TABLES LIKE 'institute_feature_permissions';
SHOW TABLES LIKE 'institute_class_users';

-- Check migration worked
SELECT name, slug, is_system FROM institute_user_types WHERE institute_id = 109 ORDER BY sort_order;

-- Check permissions seeded
SELECT COUNT(*) FROM institute_feature_permissions WHERE user_type_id IN (
  SELECT id FROM institute_user_types WHERE institute_id = 109
);

-- Check existing users were migrated
SELECT COUNT(*) FROM institute_user WHERE institute_id = 109 AND primary_user_type_id IS NOT NULL;
```

---

## Summary

This implementation:

1. **Zero hardcoded roles** — `InstituteUserType` enum is kept only for backward compat during transition; all new code uses `primary_user_type_id`
2. **Per-feature granularity** — `canView/canCreate/canUpdate/canDelete/canReport` per feature key per user type
3. **Redis-first** — permission matrix is loaded from Redis on every request; DB is only hit on cold cache
4. **Safe migration** — no data loss; existing users are auto-migrated via seed script
5. **Single endpoint** — `GET /institutes/:id/my-context` returns everything the frontend needs in one call
6. **Extensible** — institutes can create unlimited custom user types with custom permission matrices
7. **Backward compatible** — old `institute_user_type` column and enum are preserved; all existing code continues to compile and run

The frontend document (`RBAC_FRONTEND_IMPLEMENTATION.md`) describes how to consume these new APIs using the `usePermission()` hook and `PermissionsContext`.
