/**
 * GlobalIdCardsPage — view all ID cards and orders across all institutes
 * Accessible at /id-cards without requiring an institute to be selected
 * Supports parent-child context: when parent views child, shows child's cards/orders
 */
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IdCard, ShoppingBag, Smartphone, GraduationCap } from 'lucide-react';
import MyCards from '@/components/cards/MyCards';
import MyOrders from '@/components/cards/MyOrders';
import DigitalIdCard from '@/components/cards/DigitalIdCard';
import { useAuth } from '@/contexts/AuthContext';

const GlobalIdCardsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('cards');
  const { selectedChild, isViewingAsParent, selectedInstitute } = useAuth();
  const isChildView = !!(isViewingAsParent && selectedChild);
  const hasInstitute = !!selectedInstitute;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <IdCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">ID Cards</h1>
            <p className="text-sm text-muted-foreground">
              {isChildView
                ? `Viewing ${selectedChild?.user?.nameWithInitials || 'child'}'s ID cards`
                : 'Manage your ID cards and orders'}
            </p>
          </div>
        </div>
      </div>

      {isChildView && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2.5 flex items-center gap-2 mb-4">
          <GraduationCap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            Viewing {selectedChild?.user?.nameWithInitials || 'child'}'s ID cards
          </span>
        </div>
      )}

      <div className="mt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="cards" className="flex-1 flex items-center gap-2">
              <IdCard className="h-4 w-4" />
              My Cards
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex-1 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Orders
            </TabsTrigger>
            {!hasInstitute && (
              <TabsTrigger value="digital-id" className="flex-1 flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Digital ID
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="cards" className="pt-6">
            <MyCards />
          </TabsContent>

          <TabsContent value="orders">
            <MyOrders />
          </TabsContent>

          {!hasInstitute && (
            <TabsContent value="digital-id" className="pt-6">
              <DigitalIdCard />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default GlobalIdCardsPage;
