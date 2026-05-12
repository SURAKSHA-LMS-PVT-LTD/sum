import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('institute')
export class InstituteEntity {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;
}
