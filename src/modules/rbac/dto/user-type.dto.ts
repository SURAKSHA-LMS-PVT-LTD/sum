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
  permissions: Record<string, {
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canReport: boolean;
  }>;
}
