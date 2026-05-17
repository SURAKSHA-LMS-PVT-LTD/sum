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

  const applySpeed = useCallback((speed: number) => {
    if (playerRef.current) {
      playerRef.current.playbackRate(speed);
    }
    setCurrentSpeed(speed);
    onSpeedChange?.(speed);

    // Flash the hint badge briefly
    setShowSpeedHint(true);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setShowSpeedHint(false), 1800);
  }, [onSpeedChange]);

  useEffect(() => {
    if (videoRef.current && !playerRef.current) {
      const player = videojs(videoRef.current, {
        autoplay: true,
        controls: true,
        fluid: true,
        playbackRates: SPEED_OPTIONS,
        sources: [{ src, type }],
      });

      player.on('ratechange', () => {
        const rate = player.playbackRate();
        if (rate !== undefined) {
          setCurrentSpeed(rate);
          onSpeedChange?.(rate);
          setShowSpeedHint(true);
          if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
          hintTimerRef.current = setTimeout(() => setShowSpeedHint(false), 1800);
        }
      });

      if (initialSpeed !== 1) {
        player.ready(() => player.playbackRate(initialSpeed));
      }

      playerRef.current = player;
    }

    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [src, type]); // eslint-disable-line react-hooks/exhaustive-deps

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

      {/* Manual speed buttons row (for non-videojs-controls scenarios, always accessible) */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-black/80 rounded-b-md flex-wrap">
        <span className="text-white/60 text-[10px] mr-1">Speed:</span>
        {SPEED_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => applySpeed(s)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
              currentSpeed === s
                ? 'bg-white text-black'
                : 'bg-white/10 text-white hover:bg-white/25'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
};

export default VideoPlayer;
