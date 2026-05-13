import { UserTypesManager } from '@/components/institute-settings/UserTypesManager';
import { Shield, Search } from 'lucide-react';
import { SeoSettings } from '@/components/institute-settings/SeoSettings';
import { usePermission } from '@/hooks/usePermission';
import { AccessDenied } from '@/components/AccessDenied';

const VALID_TABS = ['basic', 'branding', 'tenant', 'location', 'about', 'online', 'sms', 'integrations', 'user-columns', 'session-limits', 'features', 'user-types', 'seo'];
const activeTab = 'user-types';
const instituteId = '1';
const settings = {};

const SECTION_ITEMS = [
    { id: 'user-types', label: 'User Types & Permissions', description: 'Manage roles and access control', icon: Shield, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    { id: 'seo', label: 'SEO & Discoverability', description: 'Search engine title, description, sitemap', icon: Search, color: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300' },
];

const InstituteSettingsPage = () => {
    const { canView: canViewSettings, canUpdate: canUpdateSettings } = usePermission('services.features');

    if (!canViewSettings) {
        return <AccessDenied featureName="Institute Settings" />;
    }

    return (
        <div>
            {activeTab === 'user-types' && canUpdateSettings && (
                <UserTypesManager />
            )}
            {activeTab === 'seo' && canUpdateSettings && instituteId && (
                <SeoSettings instituteId={instituteId} settings={settings} />
            )}
        </div>
    )
}

export default InstituteSettingsPage;
