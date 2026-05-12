import { MigrationInterface, QueryRunner } from 'typeorm';
import { FeatureCatalog } from '../../modules/features/entities/feature-catalog.entity';
import { FeatureScope, FeatureCategory, FeaturePricing, FeatureBillingCycle } from '../../modules/features/dto/feature.dto';

export class SeedFeatures1678886400001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const features = [
            {
                key: 'FEATURE_CATALOG',
                label: 'Feature Catalog',
                scope: FeatureScope.INSTITUTE,
                category: FeatureCategory.SERVICES,
                pricing: FeaturePricing.FREE,
                billingCycle: FeatureBillingCycle.MONTHLY,
                isCore: true,
                dependencies: [],
                uiTargets: [],
            },
        ];

        await queryRunner.manager.getRepository(FeatureCatalog).save(features);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.manager.getRepository(FeatureCatalog).delete({});
    }
}
