
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { 
  Sun, 
  Moon,
  Monitor,
  LayoutGrid, 
  List,
  Palette,
  Eye
} from 'lucide-react';

interface ViewModeOption {
  value: 'card' | 'table';
  label: string;
  icon: React.ReactNode;
  description: string;
}

const themeOptions = [
  { id: 'light'  as const, label: 'Light',  icon: Sun,     description: 'Clean and bright interface' },
  { id: 'dark'   as const, label: 'Dark',   icon: Moon,    description: 'Easy on the eyes in low light' },
  { id: 'system' as const, label: 'System', icon: Monitor, description: 'Follows your device settings' },
];

const Appearance = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    return (localStorage.getItem('viewMode') as 'card' | 'table') || 'card';
  });

  const viewModeOptions: ViewModeOption[] = [
    {
      value: 'card',
      label: 'Card View',
      icon: <LayoutGrid className="h-5 w-5" />,
      description: 'Display content in organized cards'
    },
    {
      value: 'table',
      label: 'Table View',
      icon: <List className="h-5 w-5" />,
      description: 'Display content in structured tables'
    }
  ];

  const handleViewModeChange = (mode: 'card' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('viewMode', mode);
    window.dispatchEvent(new CustomEvent('viewModeChange', { detail: mode }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Palette className="h-6 w-6" />
          Appearance
        </h1>
        <p className="text-muted-foreground">
          Customize your visual experience and display preferences
        </p>
      </div>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Eye className="h-5 w-5" />
            <CardTitle>Theme Mode</CardTitle>
          </div>
          <CardDescription>
            Choose your preferred theme for the application interface
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const isActive = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setTheme(opt.id)}
                  className={cn(
                    'relative p-4 rounded-xl border-2 transition-all duration-200 text-left',
                    isActive
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-primary/40 hover:bg-muted/50',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-full transition-colors',
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.description}</div>
                    </div>
                  </div>
                  {isActive && <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Display Mode Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <LayoutGrid className="h-5 w-5" />
            <CardTitle>Display Mode</CardTitle>
          </div>
          <CardDescription>
            Choose how content sections are displayed throughout the entire application — Homework, Lectures, Exams, Results, Submissions, Attendance &amp; more
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {viewModeOptions.map((option) => (
              <Card 
                key={option.value}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  viewMode === option.value 
                    ? 'ring-2 ring-primary border-primary' 
                    : 'hover:border-primary/50'
                }`}
                onClick={() => handleViewModeChange(option.value)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${
                      viewMode === option.value 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}>
                      {option.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {option.description}
                      </div>
                    </div>
                    {viewMode === option.value && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Current Display Mode:</strong> {viewModeOptions.find(opt => opt.value === viewMode)?.label} - 
              Content will be displayed in {viewMode === 'card' ? 'organized card format' : 'structured table format'} across sections.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preview Section */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            See how your settings affect the display
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm font-medium">Sample Content Preview:</div>
            
            {viewMode === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="font-medium">Sample Card 1</div>
                  <div className="text-sm text-muted-foreground">This is how card content will appear</div>
                </Card>
                <Card className="p-4">
                  <div className="font-medium">Sample Card 2</div>
                  <div className="text-sm text-muted-foreground">Cards provide organized visual sections</div>
                </Card>
              </div>
            ) : (
              <div className="border rounded-lg">
                <div className="grid grid-cols-2 gap-4 p-3 border-b bg-muted/50">
                  <div className="font-medium text-sm">Title</div>
                  <div className="font-medium text-sm">Description</div>
                </div>
                <div className="grid grid-cols-2 gap-4 p-3 border-b">
                  <div className="text-sm">Sample Item 1</div>
                  <div className="text-sm text-muted-foreground">This is how table content will appear</div>
                </div>
                <div className="grid grid-cols-2 gap-4 p-3">
                  <div className="text-sm">Sample Item 2</div>
                  <div className="text-sm text-muted-foreground">Tables provide structured data layout</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Appearance;
