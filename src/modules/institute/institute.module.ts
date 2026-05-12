import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstituteEntity } from './entities/institute.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InstituteEntity])],
  exports: [TypeOrmModule],
})
export class InstituteModule {}
