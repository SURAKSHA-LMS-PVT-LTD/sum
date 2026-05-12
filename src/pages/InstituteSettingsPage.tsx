import { UserTypesManager } from '@/components/institute-settings/UserTypesManager';
import { Shield } from 'lucide-react';

const VALID_TABS = ['basic', 'branding', 'tenant', 'location', 'about', 'online', 'sms', 'integrations', 'user-columns', 'session-limits', 'features', 'user-types'];
const activeTab = 'user-types';
const isInstituteAdmin = true;

const SECTION_ITEMS = [
    { id: 'user-types', label: 'User Types & Permissions', description: 'Manage roles and access control', icon: Shield, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
];

const InstituteSettingsPage = () => {
    return (
        <div>
            {activeTab === 'user-types' && isInstituteAdmin && (
                <UserTypesManager />
            )}
        </div>
    )
}

export default InstituteSettingsPage;
