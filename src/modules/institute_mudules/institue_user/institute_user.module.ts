import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstituteUserEntity } from './entities/institue_user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InstituteUserEntity])],
  exports: [TypeOrmModule],
})
export class InstituteUserModule {}
