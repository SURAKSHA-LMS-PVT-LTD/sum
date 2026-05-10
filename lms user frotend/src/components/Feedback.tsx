import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MessageSquareHeart, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSc8Iy0u4PbActxRVMj2maZR9LjaZ3AFNpGGI9XuXxbZpnDgQg/viewform?embedded=true';
const FORM_LINK = 'https://docs.google.com/forms/d/e/1FAIpQLSc8Iy0u4PbActxRVMj2maZR9LjaZ3AFNpGGI9XuXxbZpnDgQg/viewform';

const Feedback = () => {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <MessageSquareHeart className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Feedback</h1>
          <p className="text-sm text-muted-foreground">We'd love to hear your thoughts and suggestions</p>
        </div>
      </div>

      <Card className="overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Share Your Feedback</CardTitle>
          <CardDescription>
            Help us improve by sharing your experience, reporting issues, or suggesting new features.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full rounded-b-lg relative" style={{ minHeight: iframeLoaded ? undefined : '400px' }}>
            {!iframeLoaded && !iframeError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground bg-muted/30">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm">Loading feedback form…</p>
              </div>
            )}
            {iframeError && (
              <div className="flex flex-col items-center justify-center gap-4 p-8 bg-muted/30 min-h-[300px]">
                <p className="text-sm text-muted-foreground text-center">
                  The feedback form couldn't load in this view.
                </p>
                <Button asChild>
                  <a href={FORM_LINK} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Feedback Form
                  </a>
                </Button>
              </div>
            )}
            {!iframeError && (
              <iframe
                src={FORM_URL}
                width="100%"
                height="600"
                frameBorder="0"
                marginHeight={0}
                marginWidth={0}
                title="User Feedback Form"
                allow="forms"
                onLoad={() => setIframeLoaded(true)}
                onError={() => setIframeError(true)}
                style={{
                  display: 'block',
                  opacity: iframeLoaded ? 1 : 0,
                  width: '100%',
                  minHeight: '600px',
                  border: 'none',
                }}
              />
            )}
          </div>
          {/* Fallback link always visible */}
          <div className="px-4 py-3 border-t border-border/40 flex justify-center">
            <a
              href={FORM_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Open in new tab if form doesn't load
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Feedback;
