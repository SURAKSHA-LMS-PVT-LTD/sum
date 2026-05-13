# RBAC Backend Gaps Implementation

Backend changes required to support the full frontend RBAC migration defined in `RBAC_FULL_FRONTEND_MIGRATION.md`.

These are the five API gaps identified in Part 21 of that document. Each section maps exactly to a change in the current codebase with full code replacement.

---

## Gap 1 — Institute Users List: Replace Path-Param Enum with Query-Param userTypeId

### Problem

Current endpoint: `GET /institute-users/institute/:instituteId/users/:userType`

The `:userType` path param is hardcoded to `InstituteUserType` enum values (`STUDENT`, `TEACHER`, etc.). The frontend hardcodes these as path segments. After the RBAC migration the frontend must pass a `primaryUserTypeId` (bigint from `institute_user_types` table) instead.

### Solution

Add a new parallel endpoint `GET /institute-users/institute/:instituteId/users` that accepts `?userTypeId=` as a query param. The old path-param endpoint stays untouched for backward compatibility during the migration window.

### 1.1 — New Query DTO

**File:** `lms-api-suraksha-lk/src/modules/institute_mudules/institue_user/dto/secure-query.dto.ts`

Add at the end of the file:

```typescript
export class SecureUserByTypeIdQueryDto extends SecureUserQueryDto {
  @ApiProperty({
    description: 'User type ID from institute_user_types table',
    example: '1'
  })
  @IsBigIntId({ message: 'userTypeId must be a valid positive numeric ID' })
  userTypeId: string;
}
```

### 1.2 — New Service Method

**File:** `lms-api-suraksha-lk/src/modules/institute_mudules/institue_user/institue_user.service.ts`

Add after `getSecureUsersByInstituteAndType()`:

```typescript
async getSecureUsersByUserTypeId(
  instituteId: string,
  userTypeId: string,
  query: SecureUserQueryDto
): Promise<PaginatedSecureUserResponseDto> {
  const safeInstituteId = SecurityUtils.validateBigIntId(instituteId, 'instituteId');
  const safeUserTypeId = SecurityUtils.validateBigIntId(userTypeId, 'userTypeId');
  const { page, limit, skip } = SecurityUtils.validatePagination(query.page, query.limit);
  const { sortBy, sortOrder } = SecurityUtils.validateSortParams(query.sortBy, query.sortOrder);
  const safeSearch = query.search ? SecurityUtils.sanitizeSearchInput(query.search) : null;

  const baseFields = [
    'u.id as user_id',
    'u.first_name',
    'u.last_name',
    'u.name_with_initials as nameWithInitials',
    'u.email as email',
    'u.phone_number',
    'u.image_url as user_image_url',
    'u.gender',
    'u.date_of_birth',
    'u.address_line1',
    'u.address_line2',
    'u.is_active',
    'iu.user_id_institue as userIdByInstitute',
    'iu.house_id as house_id',
    'iu.extra_data as extra_data',
    'iu.status',
    'iu.verified_at',
    'iu.created_at',
    'iu.institute_user_image_url',
    'iu.image_verification_status',
    'CONCAT(v.first_name, " ", COALESCE(v.last_name, "")) as verifier_name',
    'iu.max_devices_per_user as max_devices_per_user',
    'iut.name as userTypeName',
    'iut.slug as userTypeSlug',
    'iut.color as userTypeColor',
  ];

  let queryBuilder = this.instituteUserRepository
    .createQueryBuilder('iu')
    .leftJoin('iu.user', 'u')
    .leftJoin('iu.verifier', 'v')
    // Join new RBAC table for type metadata
    .leftJoin('institute_user_types', 'iut', 'iut.id = iu.primary_user_type_id AND iut.institute_id = iu.institute_id')
    .select(baseFields)
    .where('iu.instituteId = :instituteId', { instituteId: safeInstituteId })
    .andWhere('iu.primary_user_type_id = :userTypeId', { userTypeId: safeUserTypeId })
    .andWhere('iu.status = :status', { status: InstituteUserStatus.ACTIVE })
    .andWhere('u.is_active = :userActive', { userActive: true });

  let countQueryBuilder = this.instituteUserRepository
    .createQueryBuilder('iu')
    .leftJoin('iu.user', 'u')
    .where('iu.instituteId = :instituteId', { instituteId: safeInstituteId })
    .andWhere('iu.primary_user_type_id = :userTypeId', { userTypeId: safeUserTypeId })
    .andWhere('iu.status = :status', { status: InstituteUserStatus.ACTIVE })
    .andWhere('u.is_active = :userActive', { userActive: true });

  if (safeSearch) {
    const searchCondition = '(CONCAT(u.first_name, " ", COALESCE(u.last_name, "")) LIKE :search OR u.email LIKE :search)';
    queryBuilder.andWhere(searchCondition, { search: `%${safeSearch}%` });
    countQueryBuilder.andWhere(searchCondition, { search: `%${safeSearch}%` });
  }

  if (query.gender) {
    queryBuilder.andWhere('u.gender = :gender', { gender: query.gender });
    countQueryBuilder.andWhere('u.gender = :gender', { gender: query.gender });
  }

  if (query.houseId) {
    const safeHouseId = SecurityUtils.validateBigIntId(query.houseId, 'houseId');
    queryBuilder.andWhere('iu.house_id = :houseId', { houseId: safeHouseId });
    countQueryBuilder.andWhere('iu.house_id = :houseId', { houseId: safeHouseId });
  }

  const sortColumn = sortBy === 'name' ? 'u.first_name' : sortBy === 'email' ? 'u.email' : 'iu.created_at';
  queryBuilder.orderBy(sortColumn, sortOrder as 'ASC' | 'DESC').skip(skip).take(limit);

  const [rawUsers, total] = await Promise.all([
    queryBuilder.getRawMany(),
    countQueryBuilder.select('COUNT(*)', 'count').getRawOne().then(r => parseInt(r?.count ?? '0')),
  ]);

  const users = rawUsers.map(row => this.mapRawToSecureUser(row));

  return {
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
```

### 1.3 — New Controller Endpoint

**File:** `lms-api-suraksha-lk/src/modules/institute_mudules/institue_user/institue_user.controller.ts`

Add imports at the top alongside existing DTO imports:

```typescript
import { SecureUserByTypeIdQueryDto } from './dto/secure-query.dto';
```

Add new endpoint immediately before the existing `getSecureUsersByInstituteAndType` method (keeping existing method unchanged):

```typescript
@Get('institute/:instituteId/users')
@UseGuards(FlexibleAccessGuard)
@RequireAnyOfRoles({ global: [UserType.SUPERADMIN], instituteAdmin: true, teacher: {} })
@NoDataMasking()
@ApiOperation({
  summary: 'Get institute users by RBAC user type ID',
  description: `Returns paginated users filtered by \`userTypeId\` from the institute_user_types table.
  
  This is the RBAC-aware replacement for GET /institute-users/institute/:id/users/:userType.
  
  Required query params:
  - \`userTypeId\` — bigint ID from institute_user_types table
  
  All SecureUserQueryDto filters (search, gender, houseId, page, limit, sortBy, sortOrder) are supported.
  
  Response includes \`userTypeName\`, \`userTypeSlug\`, \`userTypeColor\` from institute_user_types.`
})
@ApiResponse({ status: 200, type: PaginatedSecureUserResponseDto })
@ApiResponse({ status: 400, description: 'Missing or invalid userTypeId' })
@ApiResponse({ status: 403, description: 'Insufficient access' })
async getUsersByUserTypeId(
  @Param('instituteId', ParseBigIntPipe) instituteId: string,
  @Query() query: SecureUserByTypeIdQueryDto
): Promise<PaginatedSecureUserResponseDto> {
  return this.institueUserService.getSecureUsersByUserTypeId(
    instituteId,
    query.userTypeId,
    query
  );
}
```

---

## Gap 2 — Institute Class Users: Route Aliases for Renamed Table

### Problem

The frontend migration renames `institute_class_students` → `institute_class_users` and `institute_class_subject_students` → `institute_class_subject_users`. The existing controller is mounted at `institutes/:instituteId/classes/:classId/students`. The frontend will call `…/users` paths. The table rename also means the SMS service's raw SQL still references `institute_class_subject_students`.

### Solution

**Phase A** — Add route alias controller at `…/users` path that delegates to the existing service. The existing `…/students` routes stay active.

**Phase B** — Rename raw table references in SMS service.

### 2.1 — Alias Controller

**File:** Create `lms-api-suraksha-lk/src/modules/institute_class_modules/institute_class_student/institute_class_user.controller.ts`

```typescript
import { ParseBigIntPipe } from '../../../common/pipes/parse-bigint.pipe';
import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InstituteClassStudentService } from './institute_class_student.service';
import {
  CreateInstituteClassStudentDto,
  BulkCreateInstituteClassStudentDto,
} from './dto/create-institute_class_student.dto';
import { SelfEnrollClassDto } from './dto/self-enroll-class.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { FlexibleAccessGuard } from '../../../auth/guards/flexible-access.guard';
import { RequireAnyOfRoles } from '../../../auth/decorators/flexible-access.decorator';
import { UserType } from '../../user/enums/user-type.enum';

/**
 * Route alias: /institutes/:id/classes/:id/users
 * Delegates 100% to InstituteClassStudentService — no logic duplication.
 * Exists so the RBAC-migrated frontend can use /users paths while the
 * legacy /students paths remain live during the transition window.
 */
@ApiTags('Institute Class Users (RBAC alias)')
@Controller('institutes/:instituteId/classes/:classId/users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InstituteClassUserController {
  constructor(private readonly service: InstituteClassStudentService) {}

  @Post()
  @UseGuards(FlexibleAccessGuard)
  @RequireAnyOfRoles({ global: [UserType.SUPERADMIN], instituteAdmin: true })
  async assignUser(
    @Param('instituteId', ParseBigIntPipe) instituteId: string,
    @Param('classId', ParseBigIntPipe) classId: string,
    @Body() dto: CreateInstituteClassStudentDto
  ) {
    dto.instituteId = instituteId;
    dto.classId = classId;
    return this.service.assignStudentToClass(dto);
  }

  @Post('bulk')
  @UseGuards(FlexibleAccessGuard)
  @RequireAnyOfRoles({ global: [UserType.SUPERADMIN], instituteAdmin: true })
  async bulkAssignUsers(
    @Param('instituteId', ParseBigIntPipe) instituteId: string,
    @Param('classId', ParseBigIntPipe) classId: string,
    @Body() dto: BulkCreateInstituteClassStudentDto
  ) {
    dto.instituteId = instituteId;
    dto.classId = classId;
    return this.service.bulkAssignStudents(dto);
  }

  @Get()
  @UseGuards(FlexibleAccessGuard)
  @RequireAnyOfRoles({ anyInstituteRole: true })
  async getClassUsers(
    @Param('instituteId', ParseBigIntPipe) instituteId: string,
    @Param('classId', ParseBigIntPipe) classId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('activeOnly') activeOnly = 'true'
  ) {
    return this.service.getClassStudentsOptimized(classId, {
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      activeOnly: activeOnly === 'true',
    });
  }

  @Delete(':userId')
  @UseGuards(FlexibleAccessGuard)
  @RequireAnyOfRoles({ global: [UserType.SUPERADMIN], instituteAdmin: true })
  async removeUser(
    @Param('instituteId', ParseBigIntPipe) instituteId: string,
    @Param('classId', ParseBigIntPipe) classId: string,
    @Param('userId', ParseBigIntPipe) userId: string
  ) {
    return this.service.remove({ instituteId, classId, studentUserId: userId });
  }

  @Post('self-enroll')
  @UseGuards(FlexibleAccessGuard)
  @RequireAnyOfRoles({ anyInstituteRole: true })
  async selfEnroll(
    @Param('instituteId', ParseBigIntPipe) instituteId: string,
    @Param('classId', ParseBigIntPipe) classId: string,
    @Body() dto: SelfEnrollClassDto,
    @Request() req: any
  ) {
    dto.instituteId = instituteId;
    dto.classId = classId;
    return this.service.selfEnrollInClass(dto, req.user);
  }
}
```

### 2.2 — Register in Module

**File:** `lms-api-suraksha-lk/src/modules/institute_class_modules/institute_class_student/institute_class_student.module.ts`

Add:

```typescript
import { InstituteClassUserController } from './institute_class_user.controller';

// In @Module decorator:
controllers: [InstituteClassStudentController, InstituteClassUserController],
```

### 2.3 — Fix SMS Service Raw Table Reference

**File:** `lms-api-suraksha-lk/src/modules/sms/services/sms.service.ts`

The SMS service queries the raw table name `institute_class_subject_students` in two places (lines 2138–2144 and 2150–2157). After the DB migration renames the table these must be updated.

Find and replace both occurrences:

```typescript
// BEFORE (line 2138):
.from('institute_class_subject_students', 'icss')

// AFTER:
.from('institute_class_subject_users', 'icss')
```

```typescript
// BEFORE (line 2150):
.from('institute_class_subject_students', 'icss')

// AFTER:
.from('institute_class_subject_users', 'icss')
```

Also the `getStudentRecipients` method stores results in `studentUserIds` from `cs.studentUserId` (line 2132). After the column rename `studentUserId` → `userId`, update line 2132:

```typescript
// BEFORE:
studentUserIds = classStudents.map(cs => cs.studentUserId);

// AFTER:
studentUserIds = classStudents.map(cs => cs.userId);
```

---

## Gap 3 — SMS Recipients: Accept userTypeId Instead of Hardcoded STUDENT/TEACHER

### Problem

`SmsRecipientFilterDto.recipientTypes` is a `RecipientFilterType` enum with fixed values `STUDENTS`, `TEACHERS`, `PARENTS`, `ADMIN`, `ALL`, `CUSTOM`. The `getStudentRecipients()` and `getTeacherRecipients()` methods hardcode `instituteUserType = 'STUDENT'` / `'TEACHER'` in their queries.

After RBAC migration the frontend must send arbitrary user type IDs, e.g. `recipientUserTypeIds: ['3', '7']` to send SMS to specific custom user types.

### Solution

Add an optional `recipientUserTypeIds` array to `SmsRecipientFilterDto` and handle it as a new case in the service alongside the existing `RecipientFilterType.ALL` / `STUDENTS` / `TEACHERS` paths.

### 3.1 — Extend DTO

**File:** `lms-api-suraksha-lk/src/modules/sms/dto/sms.dto.ts`

In `SmsRecipientFilterDto`, add:

```typescript
@ApiPropertyOptional({
  description: 'Target specific RBAC user type IDs (from institute_user_types). When set, overrides recipientTypes for user-type-based filtering.',
  example: ['1', '3'],
  type: [String]
})
@IsOptional()
@IsArray()
@ArrayMaxSize(50)
recipientUserTypeIds?: string[];
```

Apply the same addition to `SendBulkSmsDto` and `GetRecipientCountDto` — both have the same shape as `SmsRecipientFilterDto`.

### 3.2 — New Service Method

**File:** `lms-api-suraksha-lk/src/modules/sms/services/sms.service.ts`

Add a new private method after `getTeacherRecipients()`:

```typescript
private async getRecipientsByUserTypeIds(
  instituteId: string,
  userTypeIds: string[],
  dto: SmsRecipientFilterDto
): Promise<any[]> {
  if (!userTypeIds?.length) return [];

  // Validate all IDs are numeric strings to prevent injection
  const safeIds = userTypeIds.filter(id => /^\d+$/.test(id));
  if (!safeIds.length) return [];

  const queryBuilder = this.instituteUserRepository
    .createQueryBuilder('iu')
    .leftJoinAndSelect('iu.user', 'u')
    .where('iu.instituteId = :instituteId', { instituteId })
    .andWhere('iu.primary_user_type_id IN (:...userTypeIds)', { userTypeIds: safeIds })
    .andWhere('iu.status = :status', { status: 'ACTIVE' })
    .andWhere('u.isActive = :isActive', { isActive: true });

  if (dto.classIds?.length) {
    // Restrict to users enrolled in these classes
    queryBuilder
      .innerJoin(
        'institute_class_users',
        'icu',
        'icu.student_user_id = iu.user_id AND icu.institute_id = iu.institute_id AND icu.is_active = 1'
      )
      .andWhere('icu.class_id IN (:...classIds)', { classIds: dto.classIds });
  }

  const instituteUsers = await queryBuilder.getMany();

  return instituteUsers
    .map(iu => {
      const user = iu.user;
      if (!user) return null;
      const phoneNumber = this.normalizePhoneNumber(user.phoneNumber);
      return {
        userId: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phoneNumber,
        userType: 'CUSTOM_TYPE',
        recipientType: 'CUSTOM_TYPE',
      };
    })
    .filter(r => r && r.phoneNumber && r.phoneNumber.length > 5);
}
```

### 3.3 — Wire Into Recipient Resolution

**File:** `lms-api-suraksha-lk/src/modules/sms/services/sms.service.ts`

Find the method that dispatches by `RecipientFilterType` (typically called `resolveRecipients` or inside `sendBulkSms`). Add the new path before the existing `switch`/`if` block:

```typescript
// RBAC path — check before legacy enum path
if (dto.recipientUserTypeIds?.length) {
  return this.getRecipientsByUserTypeIds(instituteId, dto.recipientUserTypeIds, dto);
}

// Legacy enum path (unchanged)
switch (recipientType) {
  case RecipientFilterType.STUDENTS:
    return this.getStudentRecipients(instituteId, dto);
  case RecipientFilterType.TEACHERS:
    return this.getTeacherRecipients(instituteId, dto);
  // … other cases
}
```

---

## Gap 4 — Payment Forms: Accept primaryUserTypeId

### Problem

The payment/fee system currently accesses `instituteMembership.instituteUserType` (the old enum) to determine access and fee assignment. After RBAC migration users will no longer have a reliable `instituteUserType` enum value; instead they carry `primaryUserTypeId`.

### Solution

Add `primaryUserTypeId` as an accepted filter on the payment query DTO and update the membership access check to fall back gracefully.

### 4.1 — Extend Payment Query DTO

**File:** Find and read `lms-api-suraksha-lk/src/modules/payment/dto/institute-payment.dto.ts` (or the relevant query DTO).

Add to `GetInstitutePaymentsQueryDto`:

```typescript
@ApiPropertyOptional({
  description: 'Filter payments by RBAC user type ID (from institute_user_types table)',
  example: '2'
})
@IsOptional()
@IsOptionalBigIntId()
primaryUserTypeId?: string;
```

Add to `CreateInstitutePaymentDto`:

```typescript
@ApiPropertyOptional({
  description: 'Target user type for this payment (RBAC). Replaces or supplements instituteUserType.',
  example: '2'
})
@IsOptional()
@IsOptionalBigIntId()
primaryUserTypeId?: string;
```

### 4.2 — Update Payment Service Access Check

**File:** `lms-api-suraksha-lk/src/modules/payment/services/institute-payment.service.ts`

Find the access check that reads `instituteMembership.instituteUserType` and replace the strict enum comparison with a dual check:

```typescript
// BEFORE — hard enum check:
if (instituteMembership.instituteUserType !== InstituteUserType.INSTITUTE_ADMIN) {
  throw new ForbiddenException('Only institute admins can manage payments');
}

// AFTER — RBAC-aware check (checks new type OR falls back to old enum):
const hasAdminAccess =
  instituteMembership.instituteUserType === InstituteUserType.INSTITUTE_ADMIN ||
  // RBAC path: check slug of the user's primary_user_type
  (instituteMembership.primaryUserType?.isAdmin === true);

if (!hasAdminAccess) {
  throw new ForbiddenException('Insufficient access for payment management');
}
```

Where `instituteMembership.primaryUserType` is loaded via the `institute_user_types` relation. If the entity does not yet have this relation, add an eager load in the query that fetches the membership:

```typescript
// In the service query that loads membership:
.leftJoinAndSelect('iu.primaryUserType', 'put')
```

And add the relation to the entity (see RBAC Backend Implementation MD, entity section):

```typescript
@ManyToOne(() => InstituteUserTypeEntity, { nullable: true, eager: false })
@JoinColumn({ name: 'primary_user_type_id' })
primaryUserType?: InstituteUserTypeEntity;
```

### 4.3 — Filter Payments by primaryUserTypeId

When `primaryUserTypeId` is supplied in the query, add a join filter:

```typescript
if (query.primaryUserTypeId) {
  queryBuilder
    .innerJoin('institute_user', 'iu2', 'iu2.user_id = payment.user_id AND iu2.institute_id = payment.institute_id')
    .andWhere('iu2.primary_user_type_id = :primaryUserTypeId', { primaryUserTypeId: query.primaryUserTypeId });
}
```

---

## Gap 5 — GET /institutes/:id/user-types/:typeId/members

### Problem

The frontend `UserTypesManager` and role-reporting components need to see which users belong to a given user type. There is currently no endpoint for this. The closest is `GET /institute-users/institute/:id/users/:userType` (enum-based) and the new Gap-1 endpoint (typeId-based), but both return the full paginated user list without the user-type context bundled.

### 5.1 — Controller Endpoint

**File:** `lms-api-suraksha-lk/src/modules/rbac/rbac.controller.ts` (from RBAC Backend Implementation MD)

Add inside `RbacController`:

```typescript
@Get('institutes/:instituteId/user-types/:typeId/members')
@UseGuards(FlexibleAccessGuard)
@RequireAnyOfRoles({ global: [UserType.SUPERADMIN], instituteAdmin: true })
@ApiOperation({
  summary: 'List members of a user type',
  description: 'Returns paginated institute users whose primary_user_type_id matches typeId. Includes basic user info and enrollment counts.'
})
@ApiResponse({ status: 200, type: UserTypeMembersResponseDto })
async getUserTypeMembers(
  @Param('instituteId', ParseBigIntPipe) instituteId: string,
  @Param('typeId', ParseBigIntPipe) typeId: string,
  @Query('page') page = '1',
  @Query('limit') limit = '20',
  @Query('search') search?: string
): Promise<UserTypeMembersResponseDto> {
  return this.rbacContextService.getUserTypeMembers(instituteId, typeId, {
    page: parseInt(page),
    limit: Math.min(parseInt(limit), 50),
    search,
  });
}
```

### 5.2 — Response DTO

**File:** `lms-api-suraksha-lk/src/modules/rbac/dto/rbac.dto.ts` (create or add to existing)

```typescript
export class UserTypeMemberDto {
  @ApiProperty() userId: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty() email: string;
  @ApiProperty() phoneNumber: string;
  @ApiProperty() imageUrl: string;
  @ApiProperty() status: string;
  @ApiProperty() enrolledClassCount: number;
  @ApiProperty() joinedAt: string;
}

export class UserTypeMembersResponseDto {
  @ApiProperty({ type: () => UserTypeMemberDto, isArray: true })
  data: UserTypeMemberDto[];

  @ApiProperty()
  userTypeName: string;

  @ApiProperty()
  userTypeSlug: string;

  @ApiProperty()
  userTypeColor: string;

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
```

### 5.3 — Service Method

**File:** `lms-api-suraksha-lk/src/modules/rbac/services/rbac-context.service.ts`

```typescript
async getUserTypeMembers(
  instituteId: string,
  typeId: string,
  opts: { page: number; limit: number; search?: string }
): Promise<UserTypeMembersResponseDto> {
  const userType = await this.userTypesRepo.findOne({
    where: { id: BigInt(typeId), instituteId: BigInt(instituteId), isActive: true }
  });
  if (!userType) throw new NotFoundException('User type not found');

  const skip = (opts.page - 1) * opts.limit;

  let qb = this.dataSource
    .createQueryBuilder()
    .select([
      'iu.user_id as userId',
      'u.first_name as firstName',
      'u.last_name as lastName',
      'u.email as email',
      'u.phone_number as phoneNumber',
      'u.image_url as imageUrl',
      'iu.status',
      'iu.created_at as joinedAt',
      `(SELECT COUNT(*) FROM institute_class_users icu 
          WHERE icu.student_user_id = iu.user_id 
            AND icu.institute_id = iu.institute_id 
            AND icu.is_active = 1) as enrolledClassCount`,
    ])
    .from('institute_user', 'iu')
    .innerJoin('user', 'u', 'u.id = iu.user_id')
    .where('iu.institute_id = :instituteId', { instituteId })
    .andWhere('iu.primary_user_type_id = :typeId', { typeId })
    .andWhere('iu.status = :status', { status: 'ACTIVE' });

  if (opts.search) {
    const safe = opts.search.replace(/['"`;\\]/g, '').trim().substring(0, 100);
    qb.andWhere(
      '(CONCAT(u.first_name, " ", COALESCE(u.last_name, "")) LIKE :s OR u.email LIKE :s)',
      { s: `%${safe}%` }
    );
  }

  const total: number = await qb.clone()
    .select('COUNT(*)', 'cnt')
    .getRawOne()
    .then(r => parseInt(r?.cnt ?? '0'));

  const rows = await qb.orderBy('iu.created_at', 'DESC').skip(skip).take(opts.limit).getRawMany();

  return {
    data: rows.map(r => ({
      userId: r.userId?.toString(),
      firstName: r.firstName ?? '',
      lastName: r.lastName ?? '',
      email: r.email ?? '',
      phoneNumber: r.phoneNumber ?? '',
      imageUrl: r.imageUrl ?? '',
      status: r.status ?? '',
      enrolledClassCount: parseInt(r.enrolledClassCount ?? '0'),
      joinedAt: r.joinedAt ? new Date(r.joinedAt).toISOString() : '',
    })),
    userTypeName: userType.name,
    userTypeSlug: userType.slug,
    userTypeColor: userType.color ?? '#6366f1',
    total,
    page: opts.page,
    limit: opts.limit,
    totalPages: Math.ceil(total / opts.limit),
  };
}
```

---

## Gap 6 — JWT: Emit primaryUserTypeId in Token Payload

### Problem

`RbacGuard` and `useMyRbacContext()` need `iuTypeId` (the new bigint user type ID) in the JWT to avoid an extra DB query on every request. The existing JWT only carries `iuType` (the old enum string).

This gap was partially described in `RBAC_BACKEND_IMPLEMENTATION.md` Part 9 but the service method that issues the token was not shown.

### 6.1 — Find the Token Issue Point

**File:** `lms-api-suraksha-lk/src/modules/auth/` — search for `sign(` or `jwtService.sign`.

The payload object passed to `jwtService.sign()` must be extended to include `iuTypeId`:

```typescript
// BEFORE:
const payload = {
  sub: user.id,
  iuType: instituteUser.instituteUserType,   // old enum
  instituteId: instituteUser.instituteId,
  // ... other fields
};

// AFTER:
const payload = {
  sub: user.id,
  iuType: instituteUser.instituteUserType,         // keep for backward compat
  iuTypeId: instituteUser.primaryUserTypeId        // new RBAC ID (may be null during migration)
    ? instituteUser.primaryUserTypeId.toString()
    : null,
  instituteId: instituteUser.instituteId,
  // ... other fields
};
```

### 6.2 — Update JWT Interface

**File:** `lms-api-suraksha-lk/src/common/interfaces/jwt-request.interface.ts` (or wherever `JwtPayload` is defined):

```typescript
export interface JwtPayload {
  sub: string;
  iuType?: string;        // legacy enum — keep until all clients migrated
  iuTypeId?: string;      // new RBAC bigint ID
  instituteId?: string;
  // ... other existing fields
}
```

---

## Migration Timeline Integration

These six gaps map to the 5-week frontend migration timeline from `RBAC_FULL_FRONTEND_MIGRATION.md`:

| Week | Frontend milestone | Backend gaps required |
|------|--------------------|----------------------|
| 1 | Foundation hooks (`useMyRbacContext`, `usePermission`, `useUserTypes`) | Gap 6 (JWT iuTypeId) |
| 2 | UserTypesManager + PermissionMatrixEditor | Gap 5 (`/user-types/:id/members`) |
| 3 | InstituteUsers, CreateInstituteUserForm, AssignUserMethodsDialog | Gap 1 (`/users?userTypeId=`) |
| 4 | SMS, Notifications | Gap 3 (`recipientUserTypeIds`) |
| 5 | Payments, Class enrollment | Gap 2 (class-users aliases), Gap 4 (payment primaryUserTypeId) |

All gaps are additive — no existing endpoints are removed. The old enum-based paths remain active until Week 5 cleanup.

---

## Shared DB Migration Required First

All gaps above depend on `primary_user_type_id` column existing on `institute_user`. This migration is in `RBAC_BACKEND_IMPLEMENTATION.md` Part 4 (timestamp `1790000000001`). Run it before deploying any of the above code.

Additionally Gap 2 requires the table renames from Part 4 (`1790000000002`):

```sql
RENAME TABLE institute_class_students TO institute_class_users;
RENAME TABLE institute_class_subject_students TO institute_class_subject_users;
```

Run these last (after verifying all active queries have been updated) or run them in the Week 5 deployment window when both sides of the aliases are live.
