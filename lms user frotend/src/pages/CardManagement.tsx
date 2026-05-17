/**
 * CardManagement - Main page for ID Card management
 * Supports parent-child context for viewing child's cards.
 * InstituteAdmin-only "Templates" tab (feature-gated via ID_CARD_TEMPLATES).
 */

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Package, Wallet, ChevronRight, Smartphone, GraduationCap, Layers, Download } from 'lucide-react';
import CardCatalog from '@/components/cards/CardCatalog';
import MyOrders from '@/components/cards/MyOrders';
import MyCards from '@/components/cards/MyCards';
import DigitalIdCard from '@/components/cards/DigitalIdCard';
import CardTemplateDesigner from '@/components/cards/CardTemplateDesigner';
import CardTemplateBulkGenerate from '@/components/cards/CardTemplateBulkGenerate';
import PageContainer from '@/components/layout/PageContainer';
import AppLayout from '@/components/layout/AppLayout';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useFeatures } from '@/contexts/FeaturesContext';
import { FEATURE_KEYS } from '@/config/feature-keys';

const CardManagement: React.FC = () => {
  const isMobile = useIsMobile();
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const { selectedChild, isViewingAsParent, selectedInstitute } = useAuth();
  const role = useInstituteRole();
  const { isFeatureEnabled } = useFeatures();

  const isChildView = !!(isViewingAsParent && selectedChild);
  const hasInstitute = !!selectedInstitute;

  // Template feature: only InstituteAdmin + feature enabled
  const isAdmin = role === 'InstituteAdmin';
  const templateFeatureEnabled = isFeatureEnabled(FEATURE_KEYS.ID_CARD_TEMPLATES);
  const showTemplates = isAdmin && templateFeatureEnabled;

  const sections = [
    { id: 'catalog', icon: CreditCard, label: 'ID Cards', description: 'Order new ID Cards from the catalog', color: 'text-blue-500', component: <CardCatalog /> },
    { id: 'orders', icon: Package, label: 'My Orders', description: 'Track and manage your recent card orders', color: 'text-emerald-500', component: <MyOrders /> },
    { id: 'my-cards', icon: Wallet, label: 'My Cards', description: 'View and manage your active ID cards', color: 'text-indigo-500', component: <MyCards /> },
    ...(!hasInstitute ? [{ id: 'digital-id', icon: Smartphone, label: 'Digital ID', description: 'Preview and download your digital ID card', color: 'text-violet-500', component: <DigitalIdCard /> }] : []),
    ...(showTemplates ? [
      { id: 'template-designer', icon: Layers, label: 'Card Designer', description: 'Design custom ID card templates', color: 'text-rose-500', component: <CardTemplateDesigner /> },
      { id: 'bulk-generate', icon: Download, label: 'Bulk Generate', description: 'Generate cards for all users and download as ZIP', color: 'text-amber-500', component: <CardTemplateBulkGenerate /> },
    ] : []),
  ];

  const activeMobileComponent = sections.find(s => s.id === mobileSection)?.component;

  return (
    <AppLayout currentPage="id-cards">
      <PageContainer>
        <div className={isMobile ? "space-y-4" : "space-y-10"}>
          {/* Page Header */}
          <div className="pt-4 pb-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">ID Card Management</h1>
            <p className="text-muted-foreground mt-2">
              {isChildView
                ? `Viewing ${selectedChild?.user?.nameWithInitials || 'child'}'s cards`
                : 'Order and manage your ID cards'}
            </p>
          </div>

          {isChildView && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2.5 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Viewing {selectedChild?.user?.nameWithInitials || 'child'}'s ID cards
              </span>
            </div>
          )}

          {isMobile && !mobileSection ? (
            <div className="divide-y divide-border/40 border border-border/50 rounded-xl overflow-hidden bg-card/50 mt-4">
              {sections.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setMobileSection(item.id)}
                    className="w-full flex items-center gap-4 px-4 py-4 text-left active:bg-muted/60 transition-colors"
                  >
                    <div className={`p-2.5 rounded-xl bg-muted/60 ${item.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-4">
              {isMobile && mobileSection && (
                <div className="flex items-center mb-4">
                  <button
                    onClick={() => setMobileSection(null)}
                    className="flex items-center gap-2 text-sm font-medium text-primary active:opacity-70 transition-opacity"
                  >
                    <ChevronRight className="h-4 w-4 rotate-180" />
                    Back to Menu
                  </button>
                </div>
              )}

              {isMobile && mobileSection && (
                <h2 className="text-lg font-bold text-foreground mb-4">
                  {sections.find(s => s.id === mobileSection)?.label}
                </h2>
              )}

              {!isMobile ? (
                <Tabs defaultValue="catalog" className="space-y-8">
                  <TabsList className={`grid w-full h-12`} style={{ gridTemplateColumns: `repeat(${sections.length}, 1fr)` }}>
                    {sections.map(s => {
                      const Icon = s.icon;
                      return (
                        <TabsTrigger key={s.id} value={s.id} className="flex items-center gap-2 py-2.5">
                          <Icon className="h-4 w-4" />
                          <span className="hidden sm:inline">{s.label}</span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  {sections.map(s => (
                    <TabsContent key={s.id} value={s.id} className="mt-8">
                      {s.component}
                    </TabsContent>
                  ))}
                </Tabs>
              ) : (
                <div className="mt-4">
                  {activeMobileComponent}
                </div>
              )}
            </div>
          )}
        </div>
      </PageContainer>
    </AppLayout>
  );
};

export default CardManagement;
