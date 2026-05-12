import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureCatalog } from './entities/feature-catalog.entity';
import { InstituteFeatureToggles } from './entities/institute-feature-toggles.entity';
import { UpdateFeatureTogglesDto } from './dto/feature.dto';

@Injectable()
export class FeaturesService {
  constructor(
    @InjectRepository(FeatureCatalog)
    private readonly featureCatalogRepository: Repository<FeatureCatalog>,
    @InjectRepository(InstituteFeatureToggles)
    private readonly instituteFeatureTogglesRepository: Repository<InstituteFeatureToggles>,
  ) {}

  async getFeaturesForInstitute(instituteId: number): Promise<any> {
    const allFeatures = await this.featureCatalogRepository.find();
    const instituteToggles = await this.instituteFeatureTogglesRepository.find({ where: { instituteId } });

    const features = allFeatures.map(feature => {
        const toggle = instituteToggles.find(t => t.featureKey === feature.key);
        return {
            ...feature,
            enabled: toggle ? toggle.enabled : false, // Default to disabled if no toggle is found
        };
    });

    return features.reduce((acc, feature) => {
        acc[feature.key] = {
            enabled: feature.enabled,
            scope: feature.scope,
            pricing: feature.pricing,
        };
        return acc;
    }, {});
  }

  async updateFeaturesForInstitute(instituteId: number, updateDto: UpdateFeatureTogglesDto): Promise<void> {
    for (const key in updateDto.features) {
        let toggle = await this.instituteFeatureTogglesRepository.findOne({ where: { instituteId, featureKey: key } });
        if (!toggle) {
            toggle = this.instituteFeatureTogglesRepository.create({
                instituteId,
                featureKey: key,
                enabled: updateDto.features[key],
                enabledSource: 'ADMIN',
            });
        } else {
            toggle.enabled = updateDto.features[key];
        }
        await this.instituteFeatureTogglesRepository.save(toggle);
    }
  }

  async getFeatureCatalog(): Promise<FeatureCatalog[]> {
      return this.featureCatalogRepository.find();
  }
}
