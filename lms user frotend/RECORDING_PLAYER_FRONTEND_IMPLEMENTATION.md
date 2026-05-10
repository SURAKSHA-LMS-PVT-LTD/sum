# Frontend Implementation Guide - Recording Player & Watch History

This guide details the frontend changes needed for the recording player enhancements.

## File Structure

```
lms user frontend/
├── src/
│   ├── components/
│   │   ├── Recording/
│   │   │   ├── RecordingPlayer.tsx        # Main video player component
│   │   │   ├── ActivityTimeline.tsx       # Timeline visualization
│   │   │   ├── WatchHistory.tsx           # Watch history view
│   │   │   ├── BackupStatus.tsx           # Backup status display
│   │   │   └── GuestAccessForm.tsx        # Guest login form
│   │   ├── Lecture/
│   │   │   └── LectureLiveEntry.tsx       # Custom domain detection
│   ├── hooks/
│   │   ├── useRecordingSession.ts         # Session management
│   │   ├── useActivityTracking.ts         # Activity tracking
│   │   └── useWatchHistory.ts             # Watch history fetch
│   ├── types/
│   │   └── recording.ts                   # TypeScript interfaces
│   └── pages/
│       └── Recording.tsx                  # Recording playback page
```

---

## 1. TypeScript Types

**File: `src/types/recording.ts`**

```typescript
export interface RecordingSession {
  sessionId: string;
  lectureId: string;
  userType: 'enrolled' | 'suraksha_user' | 'guest';
  startTime: Date;
  endTime?: Date;
  totalWatchedSeconds: number;
  lastPositionSeconds: number;
  backupStatus: 'pending' | 'completed' | 'failed';
  lastSyncTime?: Date;
}

export interface ActivityEvent {
  type: 'PLAY' | 'PAUSE' | 'SEEK' | 'SPEED_CHANGE' | 'QUALITY_CHANGE' | 'FULLSCREEN_TOGGLE' | 'SUBTITLE_TOGGLE';
  videoTimestamp: number;
  wallTime?: string | number;
  metadata?: {
    quality?: '360p' | '720p' | '1080p';
    speed?: number;
    [key: string]: any;
  };
}

export interface ActivityTimeline {
  id: string;
  type: string;
  videoTime: number;
  wallTime?: string;
  durationUntilNextMs?: number;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface RecordingTimeline {
  sessionId: string;
  userId?: string;
  userType: 'enrolled' | 'suraksha_user' | 'guest';
  guestName?: string;
  startTime: string;
  endTime?: string;
  backupStatus: 'pending' | 'completed' | 'failed';
  lastSyncTime?: string;
  totalWatchedSeconds: number;
  lastPositionSeconds: number;
  timeline: ActivityTimeline[];
  activityCount: number;
}

export interface WatchHistoryEntry {
  sessionId: string;
  userId?: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  startTime: string;
  endTime?: string;
  totalWatchedSeconds: number;
  lastPositionSeconds: number;
  durationMinutes?: number;
  activityCount: number;
  backupStatus: 'pending' | 'completed' | 'failed';
  lastSyncTime?: string;
  ipAddress?: string;
}

export interface WatchHistoryGroup {
  enrolled: WatchHistoryEntry[];
  suraksha_user: WatchHistoryEntry[];
  guest: WatchHistoryEntry[];
}
```

---

## 2. Custom Hooks

### 2.1 useRecordingSession Hook

**File: `src/hooks/useRecordingSession.ts`**

```typescript
import { useState, useRef, useCallback } from 'react';
import type { RecordingSession, ActivityEvent } from '../types/recording';

export const useRecordingSession = () => {
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const activityBuffer = useRef<ActivityEvent[]>([]);
  const syncTimer = useRef<NodeJS.Timeout>();
  const lastSyncTime = useRef<Date>(new Date());

  const startSession = useCallback(
    async (lectureId: string, instituteId: string, classId?: string, subjectId?: string, guestName?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/lecture-tracking/recording/session/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lectureId,
            instituteId,
            classId,
            subjectId,
            guestName
          })
        });

        if (!response.ok) {
          throw new Error('Failed to start recording session');
        }

        const data = await response.json();
        setSession(data);
        
        // Start auto-sync timer (every 30 seconds)
        syncTimer.current = setInterval(() => {
          syncActivities();
        }, 30000);

        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const recordActivity = useCallback(
    (type: ActivityEvent['type'], videoTime: number, metadata?: ActivityEvent['metadata']) => {
      if (!session) return;

      activityBuffer.current.push({
        type,
        videoTimestamp: videoTime,
        wallTime: new Date().toISOString(),
        metadata
      });

      // Auto-sync when buffer reaches 50 items
      if (activityBuffer.current.length >= 50) {
        syncActivities();
      }
    },
    [session]
  );

  const syncActivities = useCallback(async () => {
    if (!session?.sessionId || activityBuffer.current.length === 0) return;

    try {
      const response = await fetch('/lecture-tracking/recording/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          activities: activityBuffer.current
        })
      });

      if (response.ok) {
        activityBuffer.current = [];
        lastSyncTime.current = new Date();
      }
    } catch (err) {
      console.error('Failed to sync activities:', err);
    }
  }, [session?.sessionId]);

  const endSession = useCallback(async (lastPositionSeconds: number) => {
    if (!session?.sessionId) return;

    try {
      // Final sync
      await syncActivities();

      // End session
      const response = await fetch('/lecture-tracking/recording/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          lastPositionSeconds
        })
      });

      if (!response.ok) {
        throw new Error('Failed to end recording session');
      }

      // Clear sync timer
      if (syncTimer.current) {
        clearInterval(syncTimer.current);
      }

      setSession(null);
    } catch (err) {
      console.error('Failed to end session:', err);
    }
  }, [session?.sessionId, syncActivities]);

  const manualSync = useCallback(async () => {
    if (!session?.sessionId) return;

    try {
      const response = await fetch(`/lecture-tracking/recording/session/${session.sessionId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Manual sync failed');
      }

      const data = await response.json();
      setSession(prev => prev ? {
        ...prev,
        backupStatus: data.backupStatus,
        lastSyncTime: new Date(data.syncedAt)
      } : null);

      return data;
    } catch (err) {
      console.error('Manual sync error:', err);
      throw err;
    }
  }, [session?.sessionId]);

  return {
    session,
    isLoading,
    error,
    startSession,
    recordActivity,
    syncActivities,
    endSession,
    manualSync,
    bufferSize: activityBuffer.current.length,
    lastSyncTime: lastSyncTime.current
  };
};
```

### 2.2 useActivityTracking Hook

**File: `src/hooks/useActivityTracking.ts`**

```typescript
import { useState, useCallback, useEffect } from 'react';
import type { RecordingTimeline } from '../types/recording';

export const useActivityTracking = (sessionId?: string) => {
  const [timeline, setTimeline] = useState<RecordingTimeline | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    if (!sessionId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/lecture-tracking/recording/session/${sessionId}/timeline`);
      if (!response.ok) {
        throw new Error('Failed to fetch timeline');
      }
      const data = await response.json();
      setTimeline(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      fetchTimeline();
      // Refresh every 30 seconds
      const interval = setInterval(fetchTimeline, 30000);
      return () => clearInterval(interval);
    }
  }, [sessionId, fetchTimeline]);

  return {
    timeline,
    isLoading,
    error,
    refetch: fetchTimeline
  };
};
```

### 2.3 useWatchHistory Hook

**File: `src/hooks/useWatchHistory.ts`**

```typescript
import { useState, useCallback, useEffect } from 'react';
import type { WatchHistoryGroup } from '../types/recording';

export const useWatchHistory = (lectureId?: string, userType: 'enrolled' | 'suraksha_user' | 'guest' | 'all' = 'all') => {
  const [data, setData] = useState<WatchHistoryGroup | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWatchHistory = useCallback(async () => {
    if (!lectureId) return;

    setIsLoading(true);
    setError(null);
    try {
      const url = new URL(`/lecture-tracking/recording/${lectureId}/watch-history`, window.location.origin);
      url.searchParams.set('userType', userType);
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch watch history');
      }
      const data = await response.json();
      setData(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [lectureId, userType]);

  useEffect(() => {
    if (lectureId) {
      fetchWatchHistory();
    }
  }, [lectureId, userType, fetchWatchHistory]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchWatchHistory
  };
};
```

---

## 3. Components

### 3.1 RecordingPlayer Component

**File: `src/components/Recording/RecordingPlayer.tsx`**

```typescript
import React, { useRef, useEffect, useState } from 'react';
import { useRecordingSession } from '../../hooks/useRecordingSession';
import { ActivityTimeline } from './ActivityTimeline';
import { BackupStatus } from './BackupStatus';
import type { ActivityEvent } from '../../types/recording';

interface RecordingPlayerProps {
  lectureId: string;
  recordingUrl: string;
  instituteId?: string;
  classId?: string;
  subjectId?: string;
  guestName?: string;
}

export const RecordingPlayer: React.FC<RecordingPlayerProps> = ({
  lectureId,
  recordingUrl,
  instituteId,
  classId,
  subjectId,
  guestName
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { session, startSession, recordActivity, manualSync, bufferSize } = useRecordingSession();
  const [quality, setQuality] = useState('720p');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showTimeline, setShowTimeline] = useState(false);

  // Initialize session on mount
  useEffect(() => {
    startSession(lectureId, instituteId, classId, subjectId, guestName).catch(console.error);

    return () => {
      // Cleanup on unmount
      if (videoRef.current) {
        const currentTime = videoRef.current.currentTime;
        // Session will be ended by useEffect below
      }
    };
  }, [lectureId, instituteId, classId, subjectId, guestName]);

  // Handle video events
  const handlePlay = () => {
    if (session) {
      recordActivity('PLAY', videoRef.current?.currentTime || 0);
    }
  };

  const handlePause = () => {
    if (session) {
      recordActivity('PAUSE', videoRef.current?.currentTime || 0);
    }
  };

  const handleSeeked = () => {
    if (session) {
      recordActivity('SEEK', videoRef.current?.currentTime || 0);
    }
  };

  const handleQualityChange = (newQuality: string) => {
    setQuality(newQuality);
    if (session) {
      recordActivity('QUALITY_CHANGE', videoRef.current?.currentTime || 0, {
        quality: newQuality
      });
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    if (session) {
      recordActivity('SPEED_CHANGE', videoRef.current?.currentTime || 0, {
        speed
      });
    }
  };

  return (
    <div className="recording-player-container">
      <div className="video-wrapper">
        <video
          ref={videoRef}
          src={recordingUrl}
          controls
          onPlay={handlePlay}
          onPause={handlePause}
          onSeeked={handleSeeked}
          style={{ width: '100%', height: 'auto' }}
        />
      </div>

      {/* Controls */}
      <div className="recording-controls">
        <div className="quality-selector">
          <label>Quality:</label>
          <select value={quality} onChange={(e) => handleQualityChange(e.target.value)}>
            <option value="360p">360p</option>
            <option value="720p">720p (Default)</option>
            <option value="1080p">1080p</option>
          </select>
        </div>

        <div className="speed-selector">
          <label>Speed:</label>
          <select value={playbackSpeed} onChange={(e) => handleSpeedChange(Number(e.target.value))}>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x (Normal)</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>
        </div>

        <button onClick={() => setShowTimeline(!showTimeline)}>
          {showTimeline ? 'Hide' : 'Show'} Timeline
        </button>
      </div>

      {/* Backup Status */}
      {session && (
        <BackupStatus
          session={session}
          bufferSize={bufferSize}
          onManualSync={manualSync}
        />
      )}

      {/* Activity Timeline */}
      {showTimeline && session && (
        <ActivityTimeline sessionId={session.sessionId} />
      )}
    </div>
  );
};
```

### 3.2 ActivityTimeline Component

**File: `src/components/Recording/ActivityTimeline.tsx`**

```typescript
import React from 'react';
import { useActivityTracking } from '../../hooks/useActivityTracking';
import type { ActivityTimeline } from '../../types/recording';

interface ActivityTimelineProps {
  sessionId: string;
  recordingDuration?: number;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ sessionId, recordingDuration = 3600 }) => {
  const { timeline, isLoading } = useActivityTracking(sessionId);

  if (isLoading) return <div>Loading timeline...</div>;
  if (!timeline) return <div>No timeline data available</div>;

  const getColorByType = (type: string): string => {
    switch (type) {
      case 'PLAY': return '#4CAF50'; // Green
      case 'PAUSE': return '#f44336'; // Red
      case 'SEEK': return '#2196F3'; // Blue
      case 'SPEED_CHANGE': return '#FF9800'; // Orange
      case 'QUALITY_CHANGE': return '#9C27B0'; // Purple
      default: return '#999999'; // Gray
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const formatMs = (ms: number | null): string => {
    if (!ms) return '–';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  return (
    <div className="activity-timeline">
      <h3>Activity Timeline</h3>

      {/* Timeline visualization */}
      <div className="timeline-bar-container">
        <svg width="100%" height="60" className="timeline-bar">
          {/* Time markers */}
          {Array.from({ length: Math.ceil(recordingDuration / 300) }, (_, i) => {
            const time = i * 300;
            const x = (time / recordingDuration) * 100;
            return (
              <g key={`marker-${i}`}>
                <line x1={`${x}%`} y1="40" x2={`${x}%`} y2="50" stroke="#ccc" />
                <text x={`${x}%`} y="58" textAnchor="middle" fontSize="12">
                  {formatTime(time)}
                </text>
              </g>
            );
          })}

          {/* Activity dots */}
          {timeline.timeline.map((activity, idx) => {
            const x = (activity.videoTime / recordingDuration) * 100;
            return (
              <circle
                key={`activity-${idx}`}
                cx={`${x}%`}
                cy="20"
                r="4"
                fill={getColorByType(activity.type)}
                title={`${activity.type} at ${formatTime(activity.videoTime)}`}
                style={{ cursor: 'pointer' }}
              />
            );
          })}
        </svg>
      </div>

      {/* Activity list */}
      <div className="activity-list">
        {timeline.timeline.map((activity, idx) => (
          <div key={activity.id} className="activity-row">
            <span className="index">{idx + 1}</span>
            <span
              className="activity-type"
              style={{
                backgroundColor: getColorByType(activity.type),
                color: 'white',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            >
              {activity.type}
            </span>
            <span className="video-time">{formatTime(activity.videoTime)}</span>
            <span className="wall-time">
              {activity.wallTime ? new Date(activity.wallTime).toLocaleTimeString() : '–'}
            </span>
            <span className="duration">{formatMs(activity.durationUntilNextMs)}</span>
            {activity.metadata?.quality && (
              <span className="metadata">{activity.metadata.quality}</span>
            )}
            {activity.metadata?.speed && (
              <span className="metadata">{activity.metadata.speed}x</span>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="timeline-summary">
        <p>Total activities recorded: {timeline.activityCount}</p>
        <p>Total watched: {timeline.totalWatchedSeconds} seconds ({(timeline.totalWatchedSeconds / 60).toFixed(1)} minutes)</p>
        <p>Last position: {formatTime(timeline.lastPositionSeconds)}</p>
        <p>Backup status: <strong>{timeline.backupStatus}</strong></p>
        {timeline.lastSyncTime && (
          <p>Last synced: {new Date(timeline.lastSyncTime).toLocaleTimeString()}</p>
        )}
      </div>
    </div>
  );
};
```

### 3.3 BackupStatus Component

**File: `src/components/Recording/BackupStatus.tsx`**

```typescript
import React from 'react';
import type { RecordingSession } from '../../types/recording';

interface BackupStatusProps {
  session: RecordingSession;
  bufferSize: number;
  onManualSync: () => Promise<any>;
}

export const BackupStatus: React.FC<BackupStatusProps> = ({ session, bufferSize, onManualSync }) => {
  const [isSyncing, setIsSyncing] = React.useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await onManualSync();
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusIcon = () => {
    switch (session.backupStatus) {
      case 'completed':
        return '✅';
      case 'pending':
        return '⏳';
      case 'failed':
        return '❌';
      default:
        return '–';
    }
  };

  return (
    <div className="backup-status">
      <div className="status-header">
        <h4>Recording Activity Status</h4>
      </div>

      <div className="status-content">
        <div className="status-row">
          <span className="label">Activities recorded:</span>
          <span className="value">{bufferSize} pending, synced earlier</span>
        </div>

        <div className="status-row">
          <span className="label">Backup status:</span>
          <span className="value">
            {getStatusIcon()} {session.backupStatus}
            {session.lastSyncTime && (
              <span className="sync-time">
                (Last sync: {new Date(session.lastSyncTime).toLocaleTimeString()})
              </span>
            )}
          </span>
        </div>

        {session.backupStatus === 'pending' && (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="sync-button"
          >
            {isSyncing ? '🔄 Syncing...' : '🔄 Sync Now'}
          </button>
        )}
      </div>
    </div>
  );
};
```

### 3.4 WatchHistory Component

**File: `src/components/Recording/WatchHistory.tsx`**

```typescript
import React, { useState } from 'react';
import { useWatchHistory } from '../../hooks/useWatchHistory';
import type { WatchHistoryEntry } from '../../types/recording';

interface WatchHistoryProps {
  lectureId: string;
}

export const WatchHistory: React.FC<WatchHistoryProps> = ({ lectureId }) => {
  const [selectedUserType, setSelectedUserType] = useState<'all' | 'enrolled' | 'suraksha_user' | 'guest'>('all');
  const { data, isLoading } = useWatchHistory(lectureId, selectedUserType);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'pending': return '⏳';
      case 'failed': return '❌';
      default: return '–';
    }
  };

  const ViewerCard: React.FC<{ entry: WatchHistoryEntry }> = ({ entry }) => (
    <div className="viewer-card">
      <div className="viewer-info">
        <h5>{entry.userName}</h5>
        {entry.userEmail && <p className="email">{entry.userEmail}</p>}
        {entry.userPhone && <p className="phone">{entry.userPhone}</p>}
      </div>
      <div className="viewer-stats">
        <span className="stat">
          <strong>Watched:</strong> {formatTime(entry.totalWatchedSeconds)}
        </span>
        <span className="stat">
          <strong>Activities:</strong> {entry.activityCount}
        </span>
        {entry.durationMinutes && (
          <span className="stat">
            <strong>Duration:</strong> {entry.durationMinutes}m
          </span>
        )}
        <span className="stat">
          {getStatusIcon(entry.backupStatus)} {entry.backupStatus}
        </span>
      </div>
    </div>
  );

  if (isLoading) return <div className="loading">Loading watch history...</div>;

  const allCount = (data?.enrolled.length || 0) + (data?.suraksha_user.length || 0) + (data?.guest.length || 0);

  return (
    <div className="watch-history-container">
      <h3>Recording View History</h3>

      {/* Filter buttons */}
      <div className="filter-buttons">
        <button
          className={selectedUserType === 'all' ? 'active' : ''}
          onClick={() => setSelectedUserType('all')}
        >
          All ({allCount})
        </button>
        <button
          className={selectedUserType === 'enrolled' ? 'active' : ''}
          onClick={() => setSelectedUserType('enrolled')}
        >
          Class Students ({data?.enrolled.length || 0})
        </button>
        <button
          className={selectedUserType === 'suraksha_user' ? 'active' : ''}
          onClick={() => setSelectedUserType('suraksha_user')}
        >
          Suraksha Users ({data?.suraksha_user.length || 0})
        </button>
        <button
          className={selectedUserType === 'guest' ? 'active' : ''}
          onClick={() => setSelectedUserType('guest')}
        >
          Guests ({data?.guest.length || 0})
        </button>
      </div>

      {/* Sections */}
      {selectedUserType === 'all' || selectedUserType === 'enrolled' ? (
        <section className="viewer-section">
          <h4>Class Students ({data?.enrolled.length || 0})</h4>
          {data?.enrolled && data.enrolled.length > 0 ? (
            <div className="viewers-grid">
              {data.enrolled.map(entry => (
                <ViewerCard key={entry.sessionId} entry={entry} />
              ))}
            </div>
          ) : (
            <p className="empty-state">No class students viewed this recording</p>
          )}
        </section>
      ) : null}

      {selectedUserType === 'all' || selectedUserType === 'suraksha_user' ? (
        <section className="viewer-section">
          <h4>Suraksha LMS Users ({data?.suraksha_user.length || 0})</h4>
          {data?.suraksha_user && data.suraksha_user.length > 0 ? (
            <div className="viewers-grid">
              {data.suraksha_user.map(entry => (
                <ViewerCard key={entry.sessionId} entry={entry} />
              ))}
            </div>
          ) : (
            <p className="empty-state">No Suraksha users viewed this recording</p>
          )}
        </section>
      ) : null}

      {selectedUserType === 'all' || selectedUserType === 'guest' ? (
        <section className="viewer-section">
          <h4>Guest Viewers ({data?.guest.length || 0})</h4>
          {data?.guest && data.guest.length > 0 ? (
            <div className="viewers-grid">
              {data.guest.map(entry => (
                <ViewerCard key={entry.sessionId} entry={entry} />
              ))}
            </div>
          ) : (
            <p className="empty-state">No guests viewed this recording</p>
          )}
        </section>
      ) : null}
    </div>
  );
};
```

### 3.5 GuestAccessForm Component

**File: `src/components/Recording/GuestAccessForm.tsx`**

```typescript
import React, { useState } from 'react';

interface GuestAccessFormProps {
  onSubmit: (data: GuestAccessData) => void;
  isLoading?: boolean;
}

export interface GuestAccessData {
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
}

export const GuestAccessForm: React.FC<GuestAccessFormProps> = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState<GuestAccessData>({
    guestName: '',
    guestEmail: '',
    guestPhone: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.guestName.trim()) {
      newErrors.guestName = 'Name is required';
    }
    if (formData.guestEmail && !isValidEmail(formData.guestEmail)) {
      newErrors.guestEmail = 'Invalid email format';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  return (
    <div className="guest-access-form-container">
      <h3>Access as Guest</h3>
      <p>Name is required. Email and phone are optional.</p>

      <form onSubmit={handleSubmit} className="guest-form">
        <div className="form-group">
          <label htmlFor="guestName">
            Name <span className="required">*</span>
          </label>
          <input
            type="text"
            id="guestName"
            name="guestName"
            value={formData.guestName}
            onChange={handleChange}
            placeholder="Enter your name"
            disabled={isLoading}
          />
          {errors.guestName && <span className="error">{errors.guestName}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="guestEmail">Email (Optional)</label>
          <input
            type="email"
            id="guestEmail"
            name="guestEmail"
            value={formData.guestEmail}
            onChange={handleChange}
            placeholder="your.email@example.com"
            disabled={isLoading}
          />
          {errors.guestEmail && <span className="error">{errors.guestEmail}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="guestPhone">Phone (Optional)</label>
          <input
            type="tel"
            id="guestPhone"
            name="guestPhone"
            value={formData.guestPhone}
            onChange={handleChange}
            placeholder="+1 (555) 123-4567"
            disabled={isLoading}
          />
          {errors.guestPhone && <span className="error">{errors.guestPhone}</span>}
        </div>

        <button type="submit" disabled={isLoading} className="submit-button">
          {isLoading ? 'Processing...' : 'Watch Recording'}
        </button>
      </form>
    </div>
  );
};
```

---

## 4. CSS Styling

**File: `src/components/Recording/RecordingPlayer.module.css`**

```css
.recording-player-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.video-wrapper {
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.recording-controls {
  display: flex;
  gap: 20px;
  margin: 20px 0;
  flex-wrap: wrap;
}

.quality-selector,
.speed-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

.quality-selector label,
.speed-selector label {
  font-weight: 600;
  color: #333;
}

.quality-selector select,
.speed-selector select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

/* Timeline styles */
.activity-timeline {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

.timeline-bar-container {
  margin: 20px 0;
  overflow-x: auto;
}

.timeline-bar {
  display: block;
  width: 100%;
  min-height: 80px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.activity-list {
  margin-top: 20px;
}

.activity-row {
  display: grid;
  grid-template-columns: 40px 100px 100px 150px 120px 1fr;
  gap: 15px;
  padding: 12px;
  border-bottom: 1px solid #eee;
  align-items: center;
  font-size: 14px;
}

.activity-row:hover {
  background: #f5f5f5;
}

.activity-type {
  font-weight: 600;
  text-align: center;
}

/* Backup status */
.backup-status {
  background: #e8f5e9;
  border-left: 4px solid #4CAF50;
  padding: 15px;
  border-radius: 4px;
  margin: 15px 0;
}

.sync-button {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.sync-button:hover:not(:disabled) {
  background: #45a049;
}

.sync-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Watch history */
.watch-history-container {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

.filter-buttons {
  display: flex;
  gap: 10px;
  margin: 20px 0;
  flex-wrap: wrap;
}

.filter-buttons button {
  padding: 10px 16px;
  border: 2px solid #ddd;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-buttons button.active {
  border-color: #2196F3;
  background: #2196F3;
  color: white;
}

.viewers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 15px;
  margin: 15px 0;
}

.viewer-card {
  background: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 15px;
}

.viewer-card h5 {
  margin: 0 0 5px 0;
  font-size: 16px;
}

.viewer-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  font-size: 13px;
  color: #666;
}

.stat {
  display: flex;
  justify-content: space-between;
}

/* Guest form */
.guest-access-form-container {
  background: white;
  border-radius: 8px;
  padding: 30px;
  max-width: 400px;
  margin: 20px auto;
}

.guest-form {
  margin-top: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 14px;
}

.required {
  color: #f44336;
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input:focus {
  outline: none;
  border-color: #2196F3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
}

.error {
  display: block;
  color: #f44336;
  font-size: 12px;
  margin-top: 5px;
}

.submit-button {
  width: 100%;
  padding: 12px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  font-size: 16px;
}

.submit-button:hover:not(:disabled) {
  background: #1976D2;
}
```

---

## 5. Integration into Pages

**File: `src/pages/Recording.tsx`**

```typescript
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { RecordingPlayer } from '../components/Recording/RecordingPlayer';
import { WatchHistory } from '../components/Recording/WatchHistory';
import { GuestAccessForm, GuestAccessData } from '../components/Recording/GuestAccessForm';

export const RecordingPage: React.FC = () => {
  const { lectureId, urlId } = useParams<{ lectureId: string; urlId: string }>();
  const [recordingData, setRecordingData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guestData, setGuestData] = useState<GuestAccessData | null>(null);

  useEffect(() => {
    const validateAccess = async () => {
      try {
        const response = await fetch(`/lecture-tracking/recording/access/${urlId}`);
        if (!response.ok) {
          throw new Error('Access denied or recording not found');
        }
        const data = await response.json();
        setRecordingData(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    validateAccess();
  }, [urlId]);

  if (isLoading) return <div className="loading">Loading recording...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!recordingData?.hasAccess) return <div className="error">You don't have access to this recording</div>;

  const handleGuestSubmit = (data: GuestAccessData) => {
    setGuestData(data);
  };

  return (
    <div className="recording-page">
      {!guestData && recordingData.accessLevel === 'guest' ? (
        <GuestAccessForm onSubmit={handleGuestSubmit} />
      ) : (
        <>
          <h1>{recordingData.title}</h1>
          {recordingData.description && <p>{recordingData.description}</p>}

          <RecordingPlayer
            lectureId={recordingData.lectureId}
            recordingUrl={recordingData.recordingUrl}
            instituteId={recordingData.instituteId}
            classId={recordingData.classId}
            guestName={guestData?.guestName}
          />

          <WatchHistory lectureId={recordingData.lectureId} />
        </>
      )}
    </div>
  );
};
```

---

## Implementation Checklist

- [ ] Create types file (`src/types/recording.ts`)
- [ ] Create custom hooks (`useRecordingSession`, `useActivityTracking`, `useWatchHistory`)
- [ ] Create components (RecordingPlayer, ActivityTimeline, WatchHistory, BackupStatus, GuestAccessForm)
- [ ] Add CSS styling
- [ ] Integrate into recording page
- [ ] Test wall-clock time recording
- [ ] Test activity timeline display
- [ ] Test watch history grouping
- [ ] Test guest access form
- [ ] Test manual sync button
- [ ] Test auto-sync (30 seconds)

---

**Last Updated:** May 9, 2025  
**Status:** Ready for frontend development
