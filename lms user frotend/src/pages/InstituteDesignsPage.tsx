import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Palette, Zap, Clock, CheckCircle2, XCircle, PauseCircle, AlertCircle } from 'lucide-react';
import { ErrorState } from '@/components/ui/PageState';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { instituteDesignsApi, DesignTemplate, DesignTemplateStatus } from '@/api/instituteDesigns.api';
import { CardTemplate } from '@/components/cards/CardTemplateDesigner';
import CardTemplateDesigner from '@/components/cards/CardTemplateDesigner';
import CardTemplateBulkGenerate from '@/components/cards/CardTemplateBulkGenerate';

// ─── Adapters between API DesignTemplate and UI CardTemplate ──────────────────

function apiToUi(dt: DesignTemplate): CardTemplate & { status: DesignTemplateStatus; rejectionReason?: string; allowPng: boolean; allowPdf: boolean; costPng: number; costPdf: number } {
  const def = (dt.definition ?? {}) as Partial<CardTemplate>;
  return {
    backgroundImageUrl: '',
    overlayImageUrl: '',
    cardWidth: 640,
    cardHeight: 400,
    elements: [],
    ...def,
    id: dt.id,
    name: dt.name,
    createdAt: dt.createdAt,
    updatedAt: dt.updatedAt,
    status: dt.status,
    rejectionReason: dt.rejectionReason,
    allowPng: dt.allowPng,
    allowPdf: dt.allowPdf,
    costPng: dt.costPng,
    costPdf: dt.costPdf,
  };
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DesignTemplateStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:   { label: 'Pending Review', color: 'text-yellow-600 bg-yellow-50 border-yellow-200', icon: <Clock className="h-3 w-3" /> },
  APPROVED:  { label: 'Approved',       color: 'text-green-600 bg-green-50 border-green-200',   icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED:  { label: 'Rejected',       color: 'text-red-600 bg-red-50 border-red-200',         icon: <XCircle className="h-3 w-3" /> },
  SUSPENDED: { label: 'Suspended',      color: 'text-orange-600 bg-orange-50 border-orange-200',icon: <PauseCircle className="h-3 w-3" /> },
};

function StatusBadge({ status }: { status: DesignTemplateStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

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

  const [apiTemplates, setApiTemplates] = useState<DesignTemplate[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [saving,   setSaving]   = useState(false);

  const { tab, view, tid } = getParams(location.search);

  // Derive UI-ready templates from API data
  const uiTemplates = apiTemplates.map(apiToUi);

  // ── Load templates once ───────────────────────────────────────────────────
  useEffect(() => {
    if (!currentInstituteId) return;
    setLoading(true);
    setLoadError(null);
    instituteDesignsApi.listTemplates(currentInstituteId)
      .then(setApiTemplates)
      .catch(e => setLoadError(e))
      .finally(() => setLoading(false));
  }, [currentInstituteId]);

  // ── Save / upsert a single template ──────────────────────────────────────
  // CardTemplateDesigner calls this with the full updated templates array (legacy contract).
  // We diff against the current API state and upsert changed/new items, delete removed ones.
  const saveTemplates = useCallback(async (updatedUi: CardTemplate[]) => {
    if (!currentInstituteId) return;
    setSaving(true);
    try {
      const existingIds = new Set(apiTemplates.map(t => t.id));
      const updatedIds  = new Set(updatedUi.map(t => t.id));

      // Delete removed templates
      const toDelete = apiTemplates.filter(t => !updatedIds.has(t.id));
      await Promise.all(toDelete.map(t => instituteDesignsApi.deleteTemplate(currentInstituteId, t.id)));

      // Track old-id → new-id for newly created templates (local makeId → server UUID)
      const idRemap = new Map<string, string>();

      const newApiTemplates: DesignTemplate[] = [];
      for (const tpl of updatedUi) {
        const { id, name } = tpl as any;
        const definition = { ...tpl };

        if (existingIds.has(id)) {
          const updated = await instituteDesignsApi.updateTemplate(currentInstituteId, id, { name, definition });
          newApiTemplates.push(updated);
        } else {
          const created = await instituteDesignsApi.createTemplate(currentInstituteId, { name, definition });
          newApiTemplates.push(created);
          idRemap.set(id, created.id);
        }
      }

      setApiTemplates(newApiTemplates);

      // If the currently-edited template was just created, update the URL to the server ID
      if (tid && idRemap.has(tid)) {
        navigate(buildSearch('designer', 'edit', idRemap.get(tid)!), { replace: true });
      }

      toast({ title: 'Saved', description: 'Templates saved. New/edited templates are pending review.' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [currentInstituteId, apiTemplates, tid, navigate, toast]);

  // ── Create template directly → save → open editor ────────────────────────
  const [creating, setCreating] = useState(false);

  const createAndEdit = useCallback(async (name: string) => {
    if (!currentInstituteId) return;
    setCreating(true);
    try {
      const blankDefinition = {
        backgroundImageUrl: '', overlayImageUrl: '',
        cardWidth: 640, cardHeight: 400, elements: [],
      };
      const created = await instituteDesignsApi.createTemplate(currentInstituteId, {
        name, definition: blankDefinition,
      });
      setApiTemplates(prev => [...prev, created]);
      navigate(buildSearch('designer', 'edit', created.id));
    } catch {
      toast({ title: 'Could not create template', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }, [currentInstituteId, navigate, toast]);

  // ── URL navigation helpers ────────────────────────────────────────────────
  const goTab  = (t: Tab)             => navigate(buildSearch(t, 'list'), { replace: true });
  const goList = ()                   => navigate(buildSearch(tab, 'list'), { replace: false });
  const goEdit = (templateId: string) => navigate(buildSearch('designer', 'edit', templateId));
  const goGen  = (templateId: string) => navigate(buildSearch('generate', 'generate', templateId));

  // ── Rejection reason banner ───────────────────────────────────────────────
  const activeApiTemplate = tid ? apiTemplates.find(t => t.id === tid) : null;
  const showRejectionBanner =
    view === 'edit' && activeApiTemplate?.status === 'REJECTED' && activeApiTemplate.rejectionReason;

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
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-primary to-primary rounded-full hidden sm:block" />
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
              <p className="text-xs sm:text-sm text-muted-foreground">Create & generate ID cards, certificates, and more</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-3 sm:px-6 md:px-8 sticky top-16 sm:top-20 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-1 sm:gap-0 -mx-3 sm:mx-0 px-3 sm:px-0 overflow-x-auto">
            {tabBtn('designer', 'Template Designer', <Palette className="h-4 w-4" />)}
            {tabBtn('generate', 'Generate & Export',  <Zap className="h-4 w-4" />)}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 sm:px-6 md:px-8">
        <div className="max-w-7xl mx-auto">

          {/* Rejection banner */}
          {showRejectionBanner && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">This template was rejected</p>
                <p className="text-xs mt-0.5">{activeApiTemplate.rejectionReason}</p>
                <p className="text-xs mt-1 text-red-500">Editing it will re-submit it for review.</p>
              </div>
            </div>
          )}

          {/* Status overview pills (list view) */}
          {!loading && (view === 'list') && apiTemplates.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as DesignTemplateStatus[]).map(s => {
                const count = apiTemplates.filter(t => t.status === s).length;
                if (!count) return null;
                return <StatusBadge key={s} status={s} />;
              })}
              <span className="text-xs text-muted-foreground self-center ml-1">
                Only <span className="font-semibold text-green-600">Approved</span> templates can generate.
              </span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-24 gap-3 sm:gap-4 text-muted-foreground">
              <div className="p-3 sm:p-4 rounded-full bg-primary/10 border border-primary/20">
                <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm sm:text-base font-medium">Loading templates</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Please wait…</p>
              </div>
            </div>
          ) : loadError ? (
            <ErrorState error={loadError} onRetry={() => {
              if (!currentInstituteId) return;
              setLoading(true);
              setLoadError(null);
              instituteDesignsApi.listTemplates(currentInstituteId)
                .then(setApiTemplates)
                .catch(e => setLoadError(e))
                .finally(() => setLoading(false));
            }} />
          ) : tab === 'designer' ? (
            <CardTemplateDesigner
              templates={uiTemplates as CardTemplate[]}
              saving={saving}
              onSave={saveTemplates}
              activeTemplateId={view === 'edit' ? tid : null}
              onTemplateSelect={goEdit}
              onBack={goList}
              apiTemplates={apiTemplates}
              onCreate={createAndEdit}
              creating={creating}
            />
          ) : (
            <CardTemplateBulkGenerate
              templates={uiTemplates as CardTemplate[]}
              apiTemplates={apiTemplates}
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
