import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { FeatureCatalog } from './feature-catalog.entity';

@Entity('institute_feature_toggles')
export class InstituteFeatureToggles {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  instituteId: number;

  @Column()
  featureKey: string;

  @ManyToOne(() => FeatureCatalog)
  @JoinColumn({ name: 'featureKey' })
  feature: FeatureCatalog;

  @Column()
  enabled: boolean;

  @Column({ type: 'enum', enum: ['ADMIN', 'PLAN', 'SYSTEM'], nullable: true })
  enabledSource: string;

  @Column({ nullable: true })
  enabledByUserId: number;

  @CreateDateColumn()
  enabledAt: Date;

  @Column({ nullable: true })
  expiresAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
