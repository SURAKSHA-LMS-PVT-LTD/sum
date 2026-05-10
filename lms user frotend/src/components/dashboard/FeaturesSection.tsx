import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { buildSidebarUrl } from '@/utils/pageNavigation';
import { useDashboardFeatures, FEATURE_CATALOG, type DashboardLevel } from '@/hooks/useDashboardFeatures';
import {
  Settings2, X, Plus, RotateCcw,
  School, BookOpen, Video, QrCode, ClipboardList, BarChart3,
  Calendar, CalendarDays, MessageSquare, CreditCard, Clock,
  Users, Settings, Wifi, Bell, UserCheck, ImageIcon,
  GraduationCap, Notebook, Award,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  School, BookOpen, Video, QrCode, ClipboardList, BarChart3,
  Calendar, CalendarDays, MessageSquare, CreditCard, Clock,
  Users, Settings, Wifi, Bell, UserCheck, ImageIcon,
  GraduationCap, Notebook, Award,
};

interface FeaturesSectionProps {
  level: DashboardLevel;
}

const FeaturesSection = ({ level }: FeaturesSectionProps) => {
  const { selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const navigate = useNavigate();
  const userRole = useInstituteRole();
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [showAddPicker, setShowAddPicker] = useState(false);

  const { pinnedFeatures, togglePin, resetToDefaults, availableToAdd } =
    useDashboardFeatures(level, userRole);

  const handleNavigate = (id: string) => {
    if (isCustomizing) return;
    const url = buildSidebarUrl(id, {
      instituteId: selectedInstitute?.id,
      classId: selectedClass?.id,
      subjectId: selectedSubject?.id,
    });
    navigate(url);
  };

  const handleDoneCustomize = () => {
    setIsCustomizing(false);
    setShowAddPicker(false);
  };

  // Empty state when no features pinned and not customizing
  if (pinnedFeatures.length === 0 && !isCustomizing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Quick Access</h3>
          <button
            onClick={() => setIsCustomizing(true)}
            className="text-xs text-primary flex items-center gap-1 hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Add features
          </button>
        </div>
        <div className="border border-dashed border-border rounded-xl p-4 text-center">
          <p className="text-sm text-muted-foreground">No quick access features pinned.</p>
          <button
            onClick={() => setIsCustomizing(true)}
            className="mt-1.5 text-xs text-primary hover:underline"
          >
            Customize
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Quick Access</h3>
        <div className="flex items-center gap-2">
          {isCustomizing ? (
            <>
              <button
                onClick={resetToDefaults}
                className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
              <button
                onClick={handleDoneCustomize}
                className="text-xs text-primary font-semibold px-2 py-0.5 bg-primary/10 rounded-md"
              >
                Done
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsCustomizing(true)}
              className="p-1 rounded-md hover:bg-muted transition-colors"
              title="Customize quick access"
            >
              <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Pinned features grid */}
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {pinnedFeatures.map(feature => {
          const IconComponent = ICON_MAP[feature.icon];
          return (
            <div key={feature.id} className="relative">
              {isCustomizing && (
                <button
                  onClick={() => togglePin(feature.id)}
                  className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center shadow-sm"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={() => handleNavigate(feature.id)}
                disabled={isCustomizing}
                className={`w-full flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl transition-all ${
                  isCustomizing
                    ? 'opacity-70 cursor-default'
                    : 'hover:bg-muted/60 active:scale-95'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${feature.color} text-white`}>
                  {IconComponent && <IconComponent className="h-5 w-5" />}
                </div>
                <span className="text-[10px] font-medium text-foreground text-center leading-tight line-clamp-2 w-full">
                  {feature.label}
                </span>
              </button>
            </div>
          );
        })}

        {/* Add button in customize mode */}
        {isCustomizing && (
          <button
            onClick={() => setShowAddPicker(p => !p)}
            className="w-full flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-all"
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-muted">
              <Plus className="h-5 w-5 text-muted-foreground" />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">Add</span>
          </button>
        )}
      </div>

      {/* Add feature picker */}
      {isCustomizing && showAddPicker && (
        <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {availableToAdd.length > 0 ? 'Tap to add:' : 'All available features are already pinned.'}
          </p>
          {availableToAdd.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {availableToAdd.map(feature => {
                const IconComponent = ICON_MAP[feature.icon];
                return (
                  <button
                    key={feature.id}
                    onClick={() => togglePin(feature.id)}
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-card border border-border hover:border-primary/30 hover:bg-accent/40 text-left transition-all"
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${feature.color} text-white shrink-0`}>
                      {IconComponent && <IconComponent className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{feature.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{feature.description}</p>
                    </div>
                    <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FeaturesSection;
