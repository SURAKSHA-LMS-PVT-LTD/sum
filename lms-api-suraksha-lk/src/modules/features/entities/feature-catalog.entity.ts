import { Entity, PrimaryColumn, Column } from 'typeorm';
import { FeatureScope, FeatureCategory, FeaturePricing, FeatureBillingCycle } from '../dto/feature.dto';

@Entity('feature_catalog')
export class FeatureCatalog {
  @PrimaryColumn()
  key: string;

  @Column()
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: FeatureScope })
  scope: FeatureScope;

  @Column({ type: 'enum', enum: FeatureCategory })
  category: FeatureCategory;

  @Column({ type: 'enum', enum: FeaturePricing })
  pricing: FeaturePricing;

  @Column({ type: 'enum', enum: FeatureBillingCycle })
  billingCycle: FeatureBillingCycle;

  @Column({ default: false })
  isCore: boolean;

  @Column({ type: 'jsonb', nullable: true })
  dependencies: string[];

  @Column({ type: 'jsonb', nullable: true })
  uiTargets: string[];

  @Column({ default: true })
  isActive: boolean;
}
