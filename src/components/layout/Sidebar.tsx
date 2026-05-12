import { Shield } from 'lucide-react';

const Sidebar = () => {
    const selectedInstitute = { id: 1 };
    const selectedClass = { id: 1 };
    const navigate = (url:string) => { console.log('navigate to', url)};
    const onClose = () => {};
    const handleItemClick = (itemId: string) => {
        if (itemId === 'user-types') {
            navigate(`/institute/${selectedInstitute?.id}/class/${selectedClass?.id ?? 0}/institute-settings?tab=user-types`);
            onClose();
            return;
        }
    };
    const instituteAdminNavGroup = [
        { id: 'institute-settings', label: 'Institute Settings', icon: 'Settings', alwaysShow: true },
        ...(selectedInstitute ? [{
            id: 'user-types',
            label: 'User Types',
            icon: Shield,
            permission: 'edit-institute-details',
        }] : []),
    ]

    return <div></div>
}

export default Sidebar;
