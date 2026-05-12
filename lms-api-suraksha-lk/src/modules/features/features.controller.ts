import { Controller, Get, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { FeaturesService } from './features.service';
import { UpdateFeatureTogglesDto } from './dto/feature.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  @Get('catalog')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SystemAdmin')
  getFeatureCatalog() {
    return this.featuresService.getFeatureCatalog();
  }

  @Get('/institutes/:id/features')
  @UseGuards(JwtAuthGuard)
  getFeaturesForInstitute(@Param('id') instituteId: number) {
    return this.featuresService.getFeaturesForInstitute(instituteId);
  }

  @Patch('/institutes/:id/features')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('InstituteAdmin')
  updateFeaturesForInstitute(
    @Param('id') instituteId: number,
    @Body() updateDto: UpdateFeatureTogglesDto,
  ) {
    return this.featuresService.updateFeaturesForInstitute(instituteId, updateDto);
  }
}
