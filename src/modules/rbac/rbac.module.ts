import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '../../common/modules/cache.module';
import { AuthModule } from '../../auth/auth.module';

import { InstituteUserType } from './entities/institute-user-type.entity';
import { InstituteFeaturePermission } from './entities/institute-feature-permission.entity';
import { InstituteUserEntity } from '../institute_mudules/institue_user/entities/institue_user.entity';

import { UserTypesService } from './services/user-types.service';
import { FeaturePermissionsService } from './services/feature-permissions.service';
import { RbacContextService } from './services/rbac-context.service';
import { RbacController } from './rbac.controller';
import { RbacGuard } from './guards/rbac.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InstituteUserType,
      InstituteFeaturePermission,
      InstituteUserEntity,
    ]),
    CacheModule,
    AuthModule,
  ],
  providers: [
    UserTypesService,
    FeaturePermissionsService,
    RbacContextService,
    RbacGuard,
  ],
  controllers: [RbacController],
  exports: [
    UserTypesService,
    FeaturePermissionsService,
    RbacContextService,
    RbacGuard,
  ],
})
export class RbacModule {}
