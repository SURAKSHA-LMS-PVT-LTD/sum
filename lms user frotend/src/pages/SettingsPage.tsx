import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sun, Moon, Monitor, LayoutGrid, Table2, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/use-toast';

type ViewMode = 'card' | 'table';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [defaultViewMode, setDefaultViewModeState] = useState<ViewMode>(() => {
    const stored = localStorage.getItem('viewMode:global') as ViewMode | null;
    return stored === 'table' ? 'table' : 'card';
  });

  const setDefaultViewMode = (mode: ViewMode) => {
    setDefaultViewModeState(mode);
    localStorage.setItem('viewMode:global', mode);
  };

  const resetAllPageViewModes = () => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('viewMode:') && key !== 'viewMode:global') {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    toast({
      title: 'View preferences reset',
      description: `Cleared ${keysToRemove.length} page-specific view${keysToRemove.length === 1 ? '' : 's'}. All pages will use your default now.`,
    });
  };

  const themeOptions: { value: 'light' | 'dark' | 'system'; label: string; icon: React.ElementType }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose how the app looks on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map(({ value, label, icon: Icon }) => {
              const active = theme === value;
              return (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    active
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/40 hover:bg-muted/50 text-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Default View Mode */}
      <Card>
        <CardHeader>
          <CardTitle>Default View</CardTitle>
          <CardDescription>
            Choose the default layout for lists across the app. You can still switch view per page using the toggle in each header.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'card', label: 'Card view', icon: LayoutGrid },
              { value: 'table', label: 'Table view', icon: Table2 },
            ] as const).map(({ value, label, icon: Icon }) => {
              const active = defaultViewMode === value;
              return (
                <button
                  key={value}
                  onClick={() => setDefaultViewMode(value)}
                  className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    active
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/40 hover:bg-muted/50 text-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              );
            })}
          </div>
          <Button variant="outline" size="sm" onClick={resetAllPageViewModes} className="w-full sm:w-auto">
            <RotateCcw className="h-3.5 w-3.5 mr-2" />
            Reset all page view preferences
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Printing Options</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Printing options are not yet available. Please check back later.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
