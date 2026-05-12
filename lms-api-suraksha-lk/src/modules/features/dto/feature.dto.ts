import { IsString, IsBoolean, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum FeatureScope {
  INSTITUTE = 'INSTITUTE',
  CLASS = 'CLASS',
  SUBJECT = 'SUBJECT',
}

export enum FeatureCategory {
  ATTENDANCE = 'ATTENDANCE',
  ACADEMICS = 'ACADEMICS',
  PAYMENTS = 'PAYMENTS',
  COMMUNICATION = 'COMMUNICATION',
  BRANDING = 'BRANDING',
  TRANSPORT = 'TRANSPORT',
  SERVICES = 'SERVICES',
}

export enum FeaturePricing {
  FREE = 'FREE',
  PAID = 'PAID',
}

export enum FeatureBillingCycle {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  BOTH = 'BOTH',
  TIER = 'TIER',
}

export class FeatureDto {
  @IsString()
  key: string;

  @IsString()
  label: string;

  @IsString()
  description: string;

  @IsEnum(FeatureScope)
  scope: FeatureScope;

  @IsEnum(FeatureCategory)
  category: FeatureCategory;

  @IsEnum(FeaturePricing)
  pricing: FeaturePricing;

  @IsEnum(FeatureBillingCycle)
  billingCycle: FeatureBillingCycle;

  @IsBoolean()
  isCore: boolean;

  @IsArray()
  @IsString({ each: true })
  dependencies: string[];

  @IsArray()
  @IsString({ each: true })
  uiTargets: string[];

  @IsBoolean()
  isActive: boolean;
}

export class UpdateFeatureTogglesDto {
  @ValidateNested({ each: true })
  @Type(() => FeatureToggleDto)
  features: Record<string, boolean>;
}

export class FeatureToggleDto {
    @IsBoolean()
    enabled: boolean;
}
