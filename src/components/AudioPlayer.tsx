import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

export interface AudioPlayerProps {
  src: string;
  title?: string;
  className?: string;
  autoPlay?: boolean;
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 2] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ src, title, className, autoPlay = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  const speed = SPEED_OPTIONS[speedIndex] ?? 1;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsLoading(true);
    setHasError(false);
    setCurrentTime(0);
    setIsPlaying(false);

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
    };

    const onTimeUpdate = () => {
      if (!isSeeking) {
        setCurrentTime(audio.currentTime);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = () => {
      setIsLoading(false);
      setHasError(true);
      setIsPlaying(false);
    };

    const onCanPlay = () => {
      setIsLoading(false);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("canplay", onCanPlay);

    if (autoPlay) {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("canplay", onCanPlay);
      audio.pause();
    };
  }, [src, autoPlay, isSeeking]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || hasError) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => {
          console.warn("Audio playback failed:", e);
          setIsPlaying(false);
        });
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number.parseFloat(e.target.value);
    setCurrentTime(newTime);
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeekEnd = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = currentTime;
    }
    setIsSeeking(false);
  };

  const skipTime = (delta: number) => {
    const audio = audioRef.current;
    if (!audio || hasError) return;
    const target = Math.max(0, Math.min(duration, (audio.currentTime || 0) + delta));
    audio.currentTime = target;
    setCurrentTime(target);
  };

  const cycleSpeed = () => {
    const nextIdx = (speedIndex + 1) % SPEED_OPTIONS.length;
    setSpeedIndex(nextIdx);
    const nextSpeed = SPEED_OPTIONS[nextIdx] ?? 1;
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (hasError) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-500", className)}>
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-amber-500 shrink-0">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>Recording unavailable or expired for this call session.</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-sm transition-all",
        className,
      )}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {title && (
        <div className="flex items-center justify-between text-xs font-semibold text-neutral-700">
          <span className="truncate">{title}</span>
          <span className="font-mono text-neutral-500 font-normal">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      )}

      {/* Scrub Bar */}
      <div className="group relative flex w-full items-center">
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full bg-neutral-900 transition-all duration-75"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={handleSeekChange}
          onMouseDown={handleSeekStart}
          onTouchStart={handleSeekStart}
          onMouseUp={handleSeekEnd}
          onTouchEnd={handleSeekEnd}
          aria-label="Seek audio"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          disabled={isLoading || duration === 0}
        />
      </div>

      {/* Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5">
          {/* Play/Pause Button */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={isLoading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white shadow-sm transition-all hover:bg-neutral-800 active:scale-95 disabled:opacity-50"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75.75v12a.75.75 0 01-1.5 0v-12a.75.75 0 01.75-.75zm10.5 0a.75.75 0 01.75.75v12a.75.75 0 01-1.5 0v-12a.75.75 0 01.75-.75z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4">
                <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* -5s Skip Button */}
          <button
            type="button"
            onClick={() => skipTime(-5)}
            disabled={isLoading || duration === 0}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 active:scale-95 disabled:opacity-40"
            title="Rewind 5 seconds"
            aria-label="Rewind 5 seconds"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
          </button>

          {/* +5s Skip Button */}
          <button
            type="button"
            onClick={() => skipTime(5)}
            disabled={isLoading || duration === 0}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 active:scale-95 disabled:opacity-40"
            title="Forward 5 seconds"
            aria-label="Forward 5 seconds"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
            </svg>
          </button>
        </div>

        {/* Time Stamp (if not in header) & Speed Toggle */}
        <div className="flex items-center gap-2">
          {!title && (
            <span className="font-mono text-xs text-neutral-500 font-medium">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          )}

          <button
            type="button"
            onClick={cycleSpeed}
            className="flex h-8 items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-950 active:scale-95"
            title="Playback speed"
            aria-label={`Playback speed ${speed}x`}
          >
            {speed}x
          </button>
        </div>
      </div>
    </div>
  );
}
