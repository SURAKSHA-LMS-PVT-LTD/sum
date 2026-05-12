import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { FeaturesService } from './features.service';
import { UpdateFeatureDto } from './dto/feature.dto';
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard';
import { RolesGuard } from '../security/guards/roles.guard';
import { Roles } from '../security/decorators/roles.decorator';

@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  @Get('catalog')
  getCatalog() {
    return this.featuresService.getCatalog();
  }

  @Get('institute/:id')
  getInstituteFeatureToggles(@Param('id') id: string) {
    return this.featuresService.getInstituteFeatureToggles(id);
  }

  @Patch('institute/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('InstituteAdmin', 'SuperAdmin')
  updateInstituteFeatureToggles(
    @Param('id') id: string,
    @Body() updateFeatureDto: UpdateFeatureDto,
  ) {
    return this.featuresService.updateInstituteFeatureToggles(id, updateFeatureDto);
  }
}
