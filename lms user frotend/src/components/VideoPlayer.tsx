import React, { useEffect, useRef, useState, useCallback } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

interface VideoPlayerProps {
  src: string;
  type: string;
  onSpeedChange?: (speed: number) => void;
  initialSpeed?: number;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, type, onSpeedChange, initialSpeed = 1 }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const [currentSpeed, setCurrentSpeed] = useState(initialSpeed);
  const [showSpeedHint, setShowSpeedHint] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a stable ref so the ratechange listener always calls the latest callback
  // without needing to re-register the listener on every render.
  const onSpeedChangeRef = useRef(onSpeedChange);
  useEffect(() => { onSpeedChangeRef.current = onSpeedChange; }, [onSpeedChange]);

  const flashHint = useCallback(() => {
    setShowSpeedHint(true);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setShowSpeedHint(false), 1800);
  }, []);

  const applySpeed = useCallback((speed: number) => {
    if (playerRef.current) {
      playerRef.current.playbackRate(speed);
    }
    setCurrentSpeed(speed);
    onSpeedChangeRef.current?.(speed);
    flashHint();
  }, [flashHint]);

  useEffect(() => {
    if (!videoRef.current) return;

    // Dispose any existing player before creating a new one (handles src/type changes).
    if (playerRef.current) {
      playerRef.current.dispose();
      playerRef.current = null;
    }

    const player = videojs(videoRef.current, {
      autoplay: true,
      controls: true,
      fluid: true,
      playbackRates: SPEED_OPTIONS,
      sources: [{ src, type }],
    });

    // ratechange listener reads from ref — always calls the latest onSpeedChange
    player.on('ratechange', () => {
      const rate = player.playbackRate();
      if (rate !== undefined) {
        setCurrentSpeed(rate);
        onSpeedChangeRef.current?.(rate);
        flashHint();
      }
    });

    if (initialSpeed !== 1) {
      player.ready(() => player.playbackRate(initialSpeed));
    }

    playerRef.current = player;

    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [src, type, initialSpeed, flashHint]);

  const speedColor =
    currentSpeed >= 2 ? 'bg-red-500/90' :
    currentSpeed >= 1.5 ? 'bg-orange-500/90' :
    currentSpeed > 1 ? 'bg-amber-500/90' :
    currentSpeed < 1 ? 'bg-blue-500/90' :
    'bg-black/60';

  return (
    <div data-vjs-player className="relative">
      <video ref={videoRef} className="video-js" />

      {/* Persistent speed badge — always visible in top-right */}
      {currentSpeed !== 1 && (
        <div className={`absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-white text-xs font-bold pointer-events-none select-none transition-opacity ${speedColor}`}>
          {currentSpeed}x
        </div>
      )}

      {/* Transient flash hint when speed changes */}
      {showSpeedHint && (
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 px-4 py-2 rounded-xl text-white text-lg font-bold pointer-events-none select-none animate-fade-out ${speedColor}`}>
          {currentSpeed}x
        </div>
      )}

      {/* Speed buttons — min touch target 44px height on mobile via py-2.5 sm:py-0.5 */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-black/80 rounded-b-md flex-wrap">
        <span className="text-white/60 text-[11px] mr-1 shrink-0">Speed:</span>
        {SPEED_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => applySpeed(s)}
            className={`min-h-[44px] sm:min-h-0 px-2.5 py-2.5 sm:py-1 rounded text-[11px] sm:text-[10px] font-semibold transition-colors flex items-center justify-center ${
              currentSpeed === s
                ? 'bg-white text-black'
                : 'bg-white/10 text-white hover:bg-white/25 active:bg-white/30'
            }`}
            aria-label={`Set playback speed to ${s}x`}
            aria-pressed={currentSpeed === s}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
};

export default VideoPlayer;
