import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layers, Download, Loader2 } from 'lucide-react';
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

  const tabBtn = (t: Tab, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => goTab(t)}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        tab === t
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
      }`}
    >
      {icon}{label}
    </button>
  );

  return (
    <div className="space-y-0 p-4 sm:p-6">
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Designs</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Design templates and generate certificates, birthday wishes, and more for your institute users.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border mb-6 gap-1">
        {tabBtn('designer', <Layers className="h-4 w-4" />, 'Template Designer')}
        {tabBtn('generate', <Download className="h-4 w-4" />, 'Generate & Export')}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading templates…</span>
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
  );
};

export default InstituteDesignsPage;
