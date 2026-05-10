import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2, Users, BookOpen, Camera, Presentation, Link, Upload, Image as ImageIcon, Settings, UserX, LogOut, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Organization, organizationSpecificApi } from '@/api/organization.api';
import { useIsMobile } from '@/hooks/use-mobile';
import OrganizationGallery from './OrganizationGallery';
import OrganizationCourses from './OrganizationCourses';
import OrganizationCourseLectures from './OrganizationCourseLectures';
import OrganizationStudents from './OrganizationStudents';
import OrganizationUnverifiedMembers from './OrganizationUnverifiedMembers';
import AssignInstituteDialog from './AssignInstituteDialog';
import UpdateOrganizationDialog from './forms/UpdateOrganizationDialog';

interface OrganizationDetailsProps {
  organization: Organization;
  userRole: string;
  onBack: () => void;
}

type NavigationTab = 'gallery' | 'courses' | 'lectures' | 'members' | 'unverified';

const OrganizationDetails = ({
  organization,
  userRole,
  onBack
}: OrganizationDetailsProps) => {
  const effectiveUserRole = organization.userRole || userRole;
  const [activeTab, setActiveTab] = useState<NavigationTab>('gallery');
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const { toast } = useToast();

  const getNavigationTabs = () => {
    const commonTabs = [
      { id: 'gallery' as NavigationTab, label: 'Gallery', icon: Camera, description: 'Photos & media', color: 'text-violet-500' },
      { id: 'courses' as NavigationTab, label: 'Courses', icon: BookOpen, description: 'Browse available courses', color: 'text-blue-500' },
    ];
    if (userRole === 'OrganizationManager') {
      return [...commonTabs,
        { id: 'lectures' as NavigationTab, label: 'Lectures', icon: Presentation, description: 'Course lectures', color: 'text-emerald-500' },
        { id: 'members' as NavigationTab, label: 'Members', icon: Users, description: 'Organization members', color: 'text-amber-500' },
        { id: 'unverified' as NavigationTab, label: 'Unverified Members', icon: UserX, description: 'Pending verifications', color: 'text-red-500' },
      ];
    }
    if (effectiveUserRole === 'ADMIN' || effectiveUserRole === 'PRESIDENT') {
      return [...commonTabs,
        { id: 'lectures' as NavigationTab, label: 'Lectures', icon: Presentation, description: 'Course lectures', color: 'text-emerald-500' },
        { id: 'members' as NavigationTab, label: 'Members', icon: Users, description: 'Organization members', color: 'text-amber-500' },
        { id: 'unverified' as NavigationTab, label: 'Unverified Members', icon: UserX, description: 'Pending verifications', color: 'text-red-500' },
      ];
    }
    return commonTabs;
  };

  const handleCourseSelect = (course: any) => {
    setSelectedCourse(course);
    setActiveTab('lectures');
    if (isMobile) setMobileSection('lectures');
  };

  const handleBackToCourses = () => {
    setSelectedCourse(null);
    setActiveTab('courses');
    if (isMobile) setMobileSection('courses');
  };

  const handleLeaveOrganization = async () => {
    try {
      await organizationSpecificApi.delete(`/organizations/${organization.organizationId}/leave`);
      toast({ title: "Success", description: "You have successfully left the organization" });
      onBack();
    } catch (error: any) {
      console.error('Error leaving organization:', error);
      toast({ title: "Error", description: "Failed to leave organization", variant: "destructive" });
    }
  };

  const renderContent = (tab: NavigationTab) => {
    if (tab === 'lectures' && selectedCourse) {
      return <OrganizationCourseLectures course={selectedCourse} onBack={handleBackToCourses} organization={organization} />;
    }
    switch (tab) {
      case 'gallery':
        return <OrganizationGallery organizationId={organization.organizationId} />;
      case 'courses':
        return <OrganizationCourses organizationId={organization.organizationId} onSelectCourse={handleCourseSelect} organization={organization} />;
      case 'lectures':
        return <OrganizationCourseLectures course={null} onBack={() => {}} organization={organization} />;
      case 'members':
        return <OrganizationStudents organizationId={organization.organizationId} userRole={effectiveUserRole} />;
      case 'unverified':
        return <OrganizationUnverifiedMembers organizationId={organization.organizationId} userRole={effectiveUserRole} />;
      default:
        return <OrganizationGallery organizationId={organization.organizationId} />;
    }
  };

  const navigationTabs = getNavigationTabs();

  const headerSection = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back
        </Button>
      </div>
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-primary" />
          {organization.name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {userRole === 'OrganizationManager' || effectiveUserRole === 'ADMIN' || effectiveUserRole === 'PRESIDENT' ? 'Manage organization details and content' : 'View organization content'}
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {effectiveUserRole === 'MEMBER' && (
          <Button onClick={handleLeaveOrganization} variant="destructive" size="sm" className="flex items-center gap-1.5">
            <LogOut className="h-4 w-4" /> Leave Organization
          </Button>
        )}
        {userRole === 'OrganizationManager' && (
          <Button onClick={() => setShowAssignDialog(true)} size="sm" className="flex items-center gap-1.5">
            <Link className="h-4 w-4" /> Assign to Institute
          </Button>
        )}
        {effectiveUserRole === 'PRESIDENT' && (
          <Button onClick={() => setShowUpdateDialog(true)} size="sm" className="flex items-center gap-1.5">
            <Settings className="h-4 w-4" /> Update Organization
          </Button>
        )}
      </div>
    </div>
  );

  // ===== MOBILE LAYOUT =====
  if (isMobile) {
    if (mobileSection) {
      const item = navigationTabs.find(m => m.id === mobileSection);
      return (
        <div className="px-3 py-4 pb-20 space-y-4">
          <button
            onClick={() => { setMobileSection(null); setSelectedCourse(null); }}
            className="flex items-center gap-2 text-sm font-medium text-primary active:opacity-70 transition-opacity"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            Back
          </button>
          <h2 className="text-lg font-bold text-foreground">{item?.label}</h2>
          {renderContent(mobileSection as NavigationTab)}

          <AssignInstituteDialog open={showAssignDialog} onOpenChange={setShowAssignDialog} organizationId={organization.organizationId} />
          <UpdateOrganizationDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog} organization={organization} onUpdate={() => {
            toast({ title: "Success", description: "Organization updated successfully" });
          }} />
        </div>
      );
    }

    return (
      <div className="px-3 py-4 pb-20 space-y-4">
        {headerSection}

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {navigationTabs.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => { setMobileSection(item.id); setActiveTab(item.id); }}
                  className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left active:bg-muted/60 transition-colors ${
                    index < navigationTabs.length - 1 ? 'border-b border-border/40' : ''
                  }`}
                >
                  <div className={`p-2 rounded-xl bg-muted/50 ${item.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </CardContent>
        </Card>

        <AssignInstituteDialog open={showAssignDialog} onOpenChange={setShowAssignDialog} organizationId={organization.organizationId} />
        <UpdateOrganizationDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog} organization={organization} onUpdate={() => {
          toast({ title: "Success", description: "Organization updated successfully" });
        }} />
      </div>
    );
  }

  // ===== DESKTOP LAYOUT =====
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {headerSection}
      </div>

      <div className="flex flex-wrap gap-2 border-b overflow-x-auto">
        {navigationTabs.map(tab => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 sm:px-4 sm:py-2 whitespace-nowrap border-b-2 transition-colors text-base sm:text-base ${
                activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <IconComponent className="h-5 w-5 sm:h-4 sm:w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div>{renderContent(activeTab)}</div>

      <AssignInstituteDialog open={showAssignDialog} onOpenChange={setShowAssignDialog} organizationId={organization.organizationId} />
      <UpdateOrganizationDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog} organization={organization} onUpdate={() => {
        toast({ title: "Success", description: "Organization updated successfully" });
      }} />
    </div>
  );
};

export default OrganizationDetails;