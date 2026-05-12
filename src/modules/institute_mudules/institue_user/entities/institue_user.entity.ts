import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { InstituteEntity } from '../../../institute/entities/institute.entity';
import { UserEntity } from '../../../user/entities/user.entity';

@Entity('institute_user')
export class InstituteUserEntity {
    @PrimaryColumn({ name: 'institute_id', type: 'bigint' })
    instituteId: string;

    @PrimaryColumn({ name: 'user_id', type: 'bigint' })
    userId: string;

    @Column({ name: 'status', type: 'varchar', length: 20, default: 'active' })
    status: string;

    @Column({
        name: 'institute_user_type',
        type: 'enum',
        enum: ['INSTITUTE_ADMIN', 'TEACHER', 'STUDENT', 'ATTENDANCE_MARKER', 'PARENT'],
    })
    instituteUserType: 'INSTITUTE_ADMIN' | 'TEACHER' | 'STUDENT' | 'ATTENDANCE_MARKER' | 'PARENT';

    @Column({ name: 'primary_user_type_id', type: 'bigint', unsigned: true, nullable: true })
    primaryUserTypeId?: string;

    @Column({ name: 'created_at', type: 'timestamp' })
    createdAt: Date;

    @Column({ name: 'updated_at', type: 'timestamp' })
    updatedAt: Date;

    @ManyToOne(() => InstituteEntity, { onDelete: 'CASCADE' })
    @JoinColumn([{ name: 'institute_id' }])
    institute?: InstituteEntity;

    @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn([{ name: 'user_id' }])
    user?: UserEntity;
}
