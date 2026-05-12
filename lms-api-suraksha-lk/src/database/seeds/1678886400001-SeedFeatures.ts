import { MigrationInterface, QueryRunner } from "typeorm";
import { FeatureCatalog } from "../../modules/features/entities/feature-catalog.entity";

export class SeedFeatures1678886400001 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const features = [
            // Institute scope
            { key: 'classes', label: 'All Classes', scope: 'INSTITUTE', category: 'ACADEMICS', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'institute-subjects', label: 'Institute Subjects', scope: 'INSTITUTE', category: 'ACADEMICS', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'institute-lectures', label: 'Institute Lectures', scope: 'INSTITUTE', category: 'ACADEMICS', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'structured-lectures', label: 'Structured Lectures', scope: 'INSTITUTE', category: 'ACADEMICS', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: ['institute-lectures'], uiTargets: [] },
            { key: 'houses', label: 'Houses', scope: 'INSTITUTE', category: 'ACADEMICS', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'institute-organizations', label: 'Organization', scope: 'INSTITUTE', category: 'ACADEMICS', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'institute-users', label: 'All Users', scope: 'INSTITUTE', category: 'ACADEMICS', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'parents', label: 'Parents', scope: 'INSTITUTE', category: 'ACADEMICS', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'verify-image', label: 'Verify Photos', scope: 'INSTITUTE', category: 'ACADEMICS', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'select-attendance-mark-type', label: 'Mark Attendance', scope: 'INSTITUTE', category: 'ATTENDANCE', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'qr-attendance', label: 'QR Attendance', scope: 'INSTITUTE', category: 'ATTENDANCE', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: ['select-attendance-mark-type'], uiTargets: [] },
            { key: 'rfid-attendance', label: 'RFID Attendance', scope: 'INSTITUTE', category: 'ATTENDANCE', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: ['select-attendance-mark-type'], uiTargets: [] },
            { key: 'daily-attendance', label: 'Daily Attendance', scope: 'INSTITUTE', category: 'ATTENDANCE', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'admin-attendance', label: 'Advanced Attendance', scope: 'INSTITUTE', category: 'ATTENDANCE', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'lecture-live-attendance', label: 'Live Attendance', scope: 'INSTITUTE', category: 'ATTENDANCE', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: ['lectures'], uiTargets: [] },
            { key: 'lecture-recording-attendance', label: 'Recording Attendance', scope: 'INSTITUTE', category: 'ATTENDANCE', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: ['lectures'], uiTargets: [] },
            { key: 'calendar-view', label: 'Calendar View', scope: 'INSTITUTE', category: 'ATTENDANCE', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'calendar-management', label: 'Manage Calendar', scope: 'INSTITUTE', category: 'ATTENDANCE', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'sms', label: 'Send SMS', scope: 'INSTITUTE', category: 'COMMUNICATION', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'sms-history', label: 'SMS History', scope: 'INSTITUTE', category: 'COMMUNICATION', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'institute-notifications', label: 'Notifications', scope: 'INSTITUTE', category: 'COMMUNICATION', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'institute-payments', label: 'Institute Fees', scope: 'INSTITUTE', category: 'PAYMENTS', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'pending-submissions', label: 'Review Payments', scope: 'INSTITUTE', category: 'PAYMENTS', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'collect-physical-payment', label: 'Collect Payment', scope: 'INSTITUTE', category: 'PAYMENTS', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'institute-billing', label: 'Billing and Plan', scope: 'INSTITUTE', category: 'PAYMENTS', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'institute-credits', label: 'Institute Wallet', scope: 'INSTITUTE', category: 'PAYMENTS', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'device-management', label: 'Device Management', scope: 'INSTITUTE', category: 'SERVICES', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'transport', label: 'Transport', scope: 'INSTITUTE', category: 'SERVICES', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'id-cards', label: 'ID Cards', scope: 'INSTITUTE', category: 'SERVICES', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'organizations', label: 'Organizations', scope: 'INSTITUTE', category: 'SERVICES', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'system-payment', label: 'System Payment', scope: 'INSTITUTE', category: 'SERVICES', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'login-branding', label: 'Domain and Login Page', scope: 'INSTITUTE', category: 'BRANDING', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'custom-domain', label: 'Custom Domain', scope: 'INSTITUTE', category: 'BRANDING', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: ['login-branding'], uiTargets: [] },
            { key: 'subdomain', label: 'Subdomain', scope: 'INSTITUTE', category: 'BRANDING', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: ['login-branding'], uiTargets: [] },
            { key: 'video-background', label: 'Video Background', scope: 'INSTITUTE', category: 'BRANDING', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: ['login-branding'], uiTargets: [] },
            { key: 'report-branding', label: 'Report Branding', scope: 'INSTITUTE', category: 'BRANDING', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },

            // Class scope
            { key: 'class-subjects', label: 'Class Subjects', scope: 'CLASS', category: 'ACADEMICS', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'class-lectures', label: 'Class Lectures', scope: 'CLASS', category: 'ACADEMICS', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'students', label: 'Students', scope: 'CLASS', category: 'ACADEMICS', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'unverified-students', label: 'Pending Students', scope: 'CLASS', category: 'ACADEMICS', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'my-attendance', label: 'My Attendance', scope: 'CLASS', category: 'ATTENDANCE', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'class-payments', label: 'Class Fees', scope: 'CLASS', category: 'PAYMENTS', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },

            // Subject scope
            { key: 'lectures', label: 'Lectures', scope: 'SUBJECT', category: 'ACADEMICS', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'free-lectures', label: 'Free Lectures', scope: 'SUBJECT', category: 'ACADEMICS', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'homework', label: 'Homework', scope: 'SUBJECT', category: 'ACADEMICS', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'exams', label: 'Exams', scope: 'SUBJECT', category: 'ACADEMICS', pricing: 'FREE', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'grading', label: 'Grading', scope: 'SUBJECT', category: 'ACADEMICS', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'study-materials', label: 'Study Materials', scope: 'SUBJECT', category: 'ACADEMICS', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'lecture-welcome-message', label: 'Lecture Welcome Message', scope: 'SUBJECT', category: 'ACADEMICS', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
            { key: 'subject-payments', label: 'Subject Fees', scope: 'SUBJECT', category: 'PAYMENTS', pricing: 'PAID', billingCycle: 'TIER', isCore: false, dependencies: [], uiTargets: [] },
        ];

        await queryRunner.manager.getRepository(FeatureCatalog).save(features);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM feature_catalog`);
    }

}
