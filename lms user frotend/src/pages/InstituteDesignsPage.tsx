import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Palette, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/api/client';
import { useToast } from '@/hooks/use-toast';
import { CardTemplate } from '@/components/cards/CardTemplateDesigner';
import CardTemplateDesigner from '@/components/cards/CardTemplateDesigner';
import CardTemplateBulkGenerate from '@/components/cards/CardTemplateBulkGenerate';

// ─── URL param helpers ────────────────────────────────────────────────────────

type Tab = 'designer' | 'generate';
type View = 'list' | 'edit' | 'generate';

function getParams(search: string): { tab: Tab; view: View; tid: string } {
  const p = new URLSearchParams(search);
  const tab  = (p.get('tab')  === 'generate' ? 'generate' : 'designer') as Tab;
  const view = (p.get('view') as View) || 'list';
  const tid  = p.get('tid') || '';
  return { tab, view, tid };
}

function buildSearch(tab: Tab, view: View, tid?: string): string {
  const p = new URLSearchParams({ tab, view });
  if (tid) p.set('tid', tid);
  return '?' + p.toString();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const InstituteDesignsPage: React.FC = () => {
  const { currentInstituteId } = useAuth();
  const { toast } = useToast();
  const location  = useLocation();
  const navigate  = useNavigate();

  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  const { tab, view, tid } = getParams(location.search);

  // ── Load templates once ───────────────────────────────────────────────────
  useEffect(() => {
    if (!currentInstituteId) return;
    setLoading(true);
    apiClient.get(`/institutes/${currentInstituteId}/design-templates`)
      .then((res: any) => {
        const data: CardTemplate[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setTemplates(data);
      })
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [currentInstituteId]);

  // ── Save templates ────────────────────────────────────────────────────────
  const saveTemplates = useCallback(async (updated: CardTemplate[]) => {
    if (!currentInstituteId) return;
    setSaving(true);
    try {
      await apiClient.post(`/institutes/${currentInstituteId}/design-templates`, { templates: updated });
      setTemplates(updated);
      toast({ title: 'Saved', description: 'Templates saved successfully.' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [currentInstituteId, toast]);

  // ── URL navigation helpers ────────────────────────────────────────────────
  const goTab    = (t: Tab)                   => navigate(buildSearch(t, 'list'), { replace: true });
  const goList   = ()                         => navigate(buildSearch(tab, 'list'), { replace: false });
  const goEdit   = (templateId: string)       => navigate(buildSearch('designer', 'edit', templateId));
  const goGen    = (templateId: string)       => navigate(buildSearch('generate', 'generate', templateId));

  // ─── Render ───────────────────────────────────────────────────────────────

  const tabBtn = (t: Tab, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => goTab(t)}
      className={`flex items-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-300 relative active:scale-95 rounded-lg sm:rounded-none ${
        tab === t
          ? 'text-primary bg-primary/10 sm:bg-transparent'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 sm:hover:bg-transparent'
      }`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{label.split(' ')[0]}</span>
      {tab === t && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-primary to-primary rounded-full hidden sm:block"></div>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 space-y-0 pb-24 sm:pb-12">
      {/* Page header */}
      <div className="px-3 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-3 sm:pb-4 sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30">
              <Palette className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Design Studio</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Create beautiful certificates & templates</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar - More responsive */}
      <div className="px-3 sm:px-6 md:px-8 sticky top-16 sm:top-20 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-1 sm:gap-0 -mx-3 sm:mx-0 px-3 sm:px-0 overflow-x-auto">
            {tabBtn('designer', 'Template Designer', <Palette className="h-4 w-4" />)}
            {tabBtn('generate', 'Generate & Export', <Zap className="h-4 w-4" />)}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="px-3 sm:px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-24 md:py-32 gap-3 sm:gap-4 text-muted-foreground">
              <div className="p-3 sm:p-4 rounded-full bg-primary/10 border border-primary/20">
                <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm sm:text-base font-medium">Loading templates</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Please wait a moment...</p>
              </div>
            </div>
          ) : tab === 'designer' ? (
            <CardTemplateDesigner
              templates={templates}
              saving={saving}
              onSave={saveTemplates}
              activeTemplateId={view === 'edit' ? tid : null}
              onTemplateSelect={goEdit}
              onBack={goList}
            />
          ) : (
            <CardTemplateBulkGenerate
              templates={templates}
              activeTemplateId={view === 'generate' ? tid : null}
              onTemplateSelect={goGen}
              onBack={goList}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default InstituteDesignsPage;
