import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useFeatures } from '@/contexts/FeaturesContext';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Lock, Building2, BookOpen, FileText,
  GraduationCap, Users, CalendarCheck, CreditCard,
  MessageSquare, Globe, Wrench, Truck, ChevronRight,
  Save, AlertCircle, Info, ShieldCheck,
} from 'lucide-react';

interface CatalogFeature {
  key: string;
  label: string;
  description: string;
  scope: 'INSTITUTE' | 'CLASS' | 'SUBJECT';
  category: string;
  pricing: 'FREE' | 'PAID';
  isCore: boolean;
  dependencies: string[];
  isActive: boolean;
}

// ── Navigation tree definition ────────────────────────────────────────────────
// Each nav node represents a scope+category combination shown in the left sidebar.

interface NavNode {
  id: string;          // unique key used for selection
  scope: string;
  category: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

const NAV_TREE: Array<{
  scope: string;
  scopeLabel: string;
  icon: React.ElementType;
  scopeDescription: string;
  groups: NavNode[];
}> = [
  {
    scope: 'INSTITUTE',
    scopeLabel: 'Institute Level',
    icon: Building2,
    scopeDescription: 'Features available across the whole institute',
    groups: [
      { id: 'INSTITUTE__ACADEMICS',     scope: 'INSTITUTE', category: 'ACADEMICS',     label: 'Academics',          icon: GraduationCap, description: 'Classes, subjects, lectures and structured learning' },
      { id: 'INSTITUTE__SERVICES',      scope: 'INSTITUTE', category: 'SERVICES',      label: 'User Management',    icon: Users,         description: 'Manage all users, parents and photo verification' },
      { id: 'INSTITUTE__ATTENDANCE',    scope: 'INSTITUTE', category: 'ATTENDANCE',    label: 'Attendance',         icon: CalendarCheck, description: 'QR, RFID, daily and lecture attendance tracking' },
      { id: 'INSTITUTE__COMMUNICATION', scope: 'INSTITUTE', category: 'COMMUNICATION', label: 'Communication',      icon: MessageSquare, description: 'SMS, notifications and messaging features' },
      { id: 'INSTITUTE__PAYMENTS',      scope: 'INSTITUTE', category: 'PAYMENTS',      label: 'Payments & Billing', icon: CreditCard,    description: 'Fees collection, billing and institute wallet' },
      { id: 'INSTITUTE__TRANSPORT',     scope: 'INSTITUTE', category: 'TRANSPORT',     label: 'Transport',          icon: Truck,         description: 'Student transport and routing' },
      { id: 'INSTITUTE__BRANDING',      scope: 'INSTITUTE', category: 'BRANDING',      label: 'Domain & Branding',  icon: Globe,         description: 'Subdomain, custom domain and login page branding' },
      { id: 'INSTITUTE__TOOLS',         scope: 'INSTITUTE', category: 'TOOLS',         label: 'Admin Tools',        icon: Wrench,        description: 'Device management, ID cards and system tools' },
    ],
  },
  {
    scope: 'CLASS',
    scopeLabel: 'Class Level',
    icon: BookOpen,
    scopeDescription: 'Features available within each class',
    groups: [
      { id: 'CLASS__ACADEMICS',      scope: 'CLASS', category: 'ACADEMICS',     label: 'Academics',        icon: GraduationCap, description: 'Subjects and lectures per class' },
      { id: 'CLASS__SERVICES',       scope: 'CLASS', category: 'SERVICES',      label: 'Students',         icon: Users,         description: 'Enrolled students and pending approvals' },
      { id: 'CLASS__ATTENDANCE',     scope: 'CLASS', category: 'ATTENDANCE',    label: 'Attendance',       icon: CalendarCheck, description: 'Class-level attendance marking and tracking' },
      { id: 'CLASS__PAYMENTS',       scope: 'CLASS', category: 'PAYMENTS',      label: 'Payments',         icon: CreditCard,    description: 'Class fee collection and payment collection' },
      { id: 'CLASS__COMMUNICATION',  scope: 'CLASS', category: 'COMMUNICATION', label: 'Communication',    icon: MessageSquare, description: 'Notifications and messaging inside a class' },
    ],
  },
  {
    scope: 'SUBJECT',
    scopeLabel: 'Subject Level',
    icon: FileText,
    scopeDescription: 'Features available within each subject',
    groups: [
      { id: 'SUBJECT__ACADEMICS',      scope: 'SUBJECT', category: 'ACADEMICS',     label: 'Academics',        icon: GraduationCap, description: 'Lectures, homework, exams, study materials' },
      { id: 'SUBJECT__ATTENDANCE',     scope: 'SUBJECT', category: 'ATTENDANCE',    label: 'Attendance',       icon: CalendarCheck, description: 'Subject-level attendance tracking' },
      { id: 'SUBJECT__PAYMENTS',       scope: 'SUBJECT', category: 'PAYMENTS',      label: 'Payments',         icon: CreditCard,    description: 'Payment collection inside a subject' },
      { id: 'SUBJECT__COMMUNICATION',  scope: 'SUBJECT', category: 'COMMUNICATION', label: 'Communication',    icon: MessageSquare, description: 'Notifications and messaging inside a subject' },
    ],
  },
];

// Map catalog categories to nav node IDs (handles aliases like SERVICES being split)
function getCategoryNodeId(scope: string, category: string): string {
  // Admin Tools + some Services both go under TOOLS at institute level
  if (scope === 'INSTITUTE' && (category === 'TOOLS')) {
    return 'INSTITUTE__TOOLS';
  }
  return `${scope}__${category}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const FeatureSettings: React.FC = () => {
  const { selectedInstitute } = useAuth();
  const instituteId = selectedInstitute?.id;
  const { features, refetchFeatures } = useFeatures();
  const { toast } = useToast();

  const [catalog, setCatalog] = useState<CatalogFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string>('INSTITUTE__ACADEMICS');
  const [expandedScopes, setExpandedScopes] = useState<Record<string, boolean>>({
    INSTITUTE: true, CLASS: false, SUBJECT: false,
  });

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await enhancedCachedClient.get<CatalogFeature[] | { data: CatalogFeature[] }>('/features/catalog', {}, { forceRefresh: true });
        const list = Array.isArray(res) ? res : (res as any).data ?? [];
        setCatalog(list.filter((f: CatalogFeature) => f.isActive));
      } catch {
        toast({ title: 'Error', description: 'Could not load feature catalog.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [toast]);

  // Group catalog features by nav node id
  const byNodeId = useMemo(() => {
    const map: Record<string, CatalogFeature[]> = {};
    for (const f of catalog) {
      const nodeId = getCategoryNodeId(f.scope.toUpperCase(), f.category.toUpperCase());
      if (!map[nodeId]) map[nodeId] = [];
      map[nodeId].push(f);
    }
    return map;
  }, [catalog]);

  const isEnabled = (key: string) => changes[key] ?? (features[key]?.enabled ?? true);
  const featureScope = (key: string): string => (features[key]?.scope ?? 'institute').toLowerCase();
  const isDependencyMet = (f: CatalogFeature) => (f.dependencies ?? []).every(dep => isEnabled(dep));

  const handleToggle = (key: string, enabled: boolean) => {
    setChanges(prev => ({ ...prev, [key]: enabled }));
  };

  const handleSave = async () => {
    if (!instituteId || Object.keys(changes).length === 0) return;
    setSaving(true);
    try {
      await enhancedCachedClient.patch(
        `/institutes/${instituteId}/features`,
        { features: changes },
        { instituteId },
      );
      toast({ title: 'Saved', description: 'Feature settings updated.' });
      await refetchFeatures();
      setChanges({});
    } catch {
      toast({ title: 'Error', description: 'Failed to save feature settings.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedNode = NAV_TREE.flatMap(s => s.groups).find(n => n.id === selectedNodeId);
  const visibleFeatures = byNodeId[selectedNodeId] ?? [];
  const changesCount = Object.keys(changes).length;

  return (
    <div className="space-y-4">
      {/* Explanation banner */}
      <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 p-4">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-blue-900 dark:text-blue-100">How feature scopes work</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-800 dark:text-blue-200">Institute features</p>
                  <p className="text-blue-700/80 dark:text-blue-300/80 text-xs leading-relaxed">
                    Disabled = hidden at institute level only. Class &amp; subject nav still shown.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-800 dark:text-blue-200">Class features</p>
                  <p className="text-blue-700/80 dark:text-blue-300/80 text-xs leading-relaxed">
                    Disabled = hidden only when inside a class. Institute &amp; subject nav unaffected.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-500 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-800 dark:text-blue-200">Subject features</p>
                  <p className="text-blue-700/80 dark:text-blue-300/80 text-xs leading-relaxed">
                    Disabled = hidden only when inside a subject. Institute &amp; class nav unaffected.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-1 border-t border-blue-200 dark:border-blue-700">
              <ShieldCheck className="h-3.5 w-3.5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-blue-700/80 dark:text-blue-300/80 text-xs">
                After enabling a feature, use <strong>User Types &amp; Permissions</strong> to control which roles can view, create, edit, or delete within it.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Feature Management</h2>
          <p className="text-sm text-muted-foreground">
            Enable or disable features at each level — institute, class or subject.
          </p>
        </div>
        {changesCount > 0 && (
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            Save {changesCount} change{changesCount !== 1 ? 's' : ''}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">

        {/* ── Left sidebar nav ── */}
        <div className="space-y-1">
          {NAV_TREE.map(section => {
            const ScopeIcon = section.icon;
            const expanded = expandedScopes[section.scope];
            const totalInScope = section.groups.reduce((s, g) => s + (byNodeId[g.id]?.length ?? 0), 0);

            return (
              <div key={section.scope}>
                {/* Scope header — clickable to expand/collapse */}
                <button
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left group hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedScopes(prev => ({ ...prev, [section.scope]: !prev[section.scope] }))}
                >
                  <div className="flex items-center gap-2.5">
                    <ScopeIcon className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-semibold">{section.scopeLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">{totalInScope}</span>
                    <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {/* Group nav items */}
                {expanded && (
                  <div className="ml-2 mt-0.5 space-y-0.5">
                    {section.groups
                      .filter(g => (byNodeId[g.id]?.length ?? 0) > 0)
                      .map(node => {
                        const NodeIcon = node.icon;
                        const isSelected = selectedNodeId === node.id;
                        const count = byNodeId[node.id]?.length ?? 0;
                        const hasChanges = (byNodeId[node.id] ?? []).some(f => changes[f.key] !== undefined);

                        return (
                          <button
                            key={node.id}
                            onClick={() => setSelectedNodeId(node.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all text-sm ${
                              isSelected
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-foreground hover:bg-muted/60'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <NodeIcon className={`h-3.5 w-3.5 flex-shrink-0 ${isSelected ? 'opacity-90' : 'text-muted-foreground'}`} />
                              <span className="truncate">{node.label}</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                              {hasChanges && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              )}
                              <span className={`text-[10px] ${isSelected ? 'opacity-70' : 'text-muted-foreground'}`}>{count}</span>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Right panel: feature list ── */}
        <Card className="overflow-hidden">
          {selectedNode ? (
            <>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                    <selectedNode.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base">{selectedNode.label}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">{selectedNode.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {visibleFeatures.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    No features in this category.
                  </div>
                ) : (
                  <div className="divide-y">
                    {visibleFeatures.map(feature => {
                      const enabled = isEnabled(feature.key);
                      const depMet = isDependencyMet(feature);
                      const blocked = feature.isCore || !depMet;
                      const changed = changes[feature.key] !== undefined;
                      // Use catalog scope (always accurate) normalized to lowercase for comparisons
                      const scope = feature.scope.toLowerCase();
                      const scopeLabel = scope === 'subject' ? 'Subject' : scope === 'class' ? 'Class' : 'Institute';
                      const scopeColor = scope === 'subject'
                        ? 'text-violet-600 border-violet-300 dark:border-violet-700'
                        : scope === 'class'
                        ? 'text-blue-600 border-blue-300 dark:border-blue-700'
                        : 'text-slate-500 border-slate-300 dark:border-slate-600';

                      return (
                        <div
                          key={feature.key}
                          className={`flex items-center justify-between px-4 py-3 transition-colors ${
                            changed ? 'bg-amber-50 dark:bg-amber-950/20' : ''
                          }`}
                        >
                          <div className="min-w-0 pr-4 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{feature.label}</span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${scopeColor}`}>
                                {scopeLabel}
                              </Badge>
                              {feature.pricing === 'PAID' && (
                                <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] px-1.5 py-0 gap-1">
                                  <Lock className="h-2.5 w-2.5" /> PAID
                                </Badge>
                              )}
                              {feature.isCore && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">CORE</Badge>
                              )}
                              {changed && (
                                <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] px-1.5 py-0">
                                  unsaved
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{feature.description}</p>
                            {!depMet && (
                              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Requires: {feature.dependencies.join(', ')}
                              </p>
                            )}
                            {!enabled && !feature.isCore && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Hidden from sidebar {scope === 'class' ? 'when navigating inside a class' : scope === 'subject' ? 'when navigating inside a subject' : 'when at institute level'}
                              </p>
                            )}
                          </div>
                          <Switch
                            checked={enabled}
                            onCheckedChange={checked => handleToggle(feature.key, checked)}
                            disabled={blocked}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="py-16 text-center text-muted-foreground text-sm">
              Select a category from the left to manage features.
            </CardContent>
          )}
        </Card>
      </div>

      {/* Floating save bar — appears when there are unsaved changes */}
      {changesCount > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="flex items-center gap-3 bg-background border shadow-lg rounded-xl px-4 py-3">
            <span className="text-sm text-muted-foreground">{changesCount} unsaved change{changesCount !== 1 ? 's' : ''}</span>
            <Button size="sm" variant="outline" onClick={() => setChanges({})}>Discard</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
