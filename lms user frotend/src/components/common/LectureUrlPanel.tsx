import React, { useState } from 'react';
import { Copy, Check, Link2, Radio, Video, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LectureUrlPanelProps {
  liveAttendanceEnabled?: boolean;
  liveUrlId?: string;
  recAttendanceEnabled?: boolean;
  recUrlId?: string;
  compact?: boolean;
}

function buildUrl(path: string): string {
  return `${window.location.origin}/${path}`;
}

const CopyRow: React.FC<{ label: string; url: string; icon: React.ReactNode }> = ({ label, url, icon }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
        <p className="text-xs text-foreground font-mono truncate select-all">{url}</p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="shrink-0 h-7 w-7 p-0 rounded-md"
        onClick={handleCopy}
        title="Copy URL"
        type="button"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
};

const LectureUrlPanel: React.FC<LectureUrlPanelProps> = ({
  liveAttendanceEnabled,
  liveUrlId,
  recAttendanceEnabled,
  recUrlId,
  compact = false,
}) => {
  const hasLive = liveAttendanceEnabled && liveUrlId;
  const hasRec = recAttendanceEnabled && recUrlId;
  const livePending = liveAttendanceEnabled && !liveUrlId;
  const recPending = recAttendanceEnabled && !recUrlId;

  if (!liveAttendanceEnabled && !recAttendanceEnabled) return null;

  const liveUrl = hasLive ? buildUrl(`live-lecture/${liveUrlId}`) : null;
  const recUrl  = hasRec  ? buildUrl(`view-recording/${recUrlId}`) : null;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {liveUrl && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(liveUrl); }}
            className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded px-1.5 py-0.5 transition-colors"
            title={liveUrl}
          >
            <Radio className="h-3 w-3" />Live URL
          </button>
        )}
        {livePending && (
          <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-50 rounded px-1.5 py-0.5">
            <Radio className="h-3 w-3" />Live (save to activate)
          </span>
        )}
        {recUrl && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(recUrl); }}
            className="flex items-center gap-1 text-[10px] text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 rounded px-1.5 py-0.5 transition-colors"
            title={recUrl}
          >
            <Video className="h-3 w-3" />Recording URL
          </button>
        )}
        {recPending && (
          <span className="flex items-center gap-1 text-[10px] text-violet-400 bg-violet-50 rounded px-1.5 py-0.5">
            <Video className="h-3 w-3" />Recording (save to activate)
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1">
        <Link2 className="h-3.5 w-3.5" />
        Shareable URLs
      </div>

      {liveUrl && (
        <CopyRow
          label="Live Lecture URL"
          url={liveUrl}
          icon={<Radio className="h-3.5 w-3.5 text-blue-500" />}
        />
      )}
      {livePending && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0 text-blue-400" />
          <span>Live URL will be generated when you save this lecture.</span>
        </div>
      )}

      {recUrl && (
        <CopyRow
          label="Recording URL"
          url={recUrl}
          icon={<Video className="h-3.5 w-3.5 text-violet-500" />}
        />
      )}
      {recPending && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0 text-violet-400" />
          <span>Recording URL will be generated when you save this lecture.</span>
        </div>
      )}
    </div>
  );
};

export default LectureUrlPanel;
