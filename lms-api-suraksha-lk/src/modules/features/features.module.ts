import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeaturesService } from './features.service';
import { FeaturesController } from './features.controller';
import { FeatureCatalog } from './entities/feature-catalog.entity';
import { InstituteFeatureToggles } from './entities/institute-feature-toggles.entity';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FeatureCatalog, InstituteFeatureToggles]),
    SecurityModule,
  ],
  controllers: [FeaturesController],
  providers: [FeaturesService],
})
export class FeaturesModule {}
