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
