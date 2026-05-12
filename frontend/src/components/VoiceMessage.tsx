"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  durationSec: number;
  isMine: boolean;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceMessage({ src, durationSec, isMine }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
      a.currentTime = 0;
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      try {
        await a.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    }
  }

  const progress = durationSec > 0 ? Math.min(1, current / durationSec) : 0;
  const remaining = Math.max(0, durationSec - current);

  return (
    <div className="flex items-center gap-3 min-w-[180px]">
      <button
        type="button"
        onClick={toggle}
        className={`shrink-0 h-9 w-9 rounded-full grid place-items-center transition-colors ${
          isMine ? "bg-white/20 hover:bg-white/30" : "bg-accent/20 hover:bg-accent/30"
        }`}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M7 5v14l12-7z" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="h-7 flex items-center gap-[3px]">
          {Array.from({ length: 18 }).map((_, i) => {
            const filled = i / 18 < progress;
            const h = 8 + ((i * 13) % 14); // псевдо-waveform
            return (
              <span
                key={i}
                style={{ height: `${h}px` }}
                className={`w-[2px] rounded-full transition-colors ${
                  filled
                    ? isMine
                      ? "bg-white"
                      : "bg-accent"
                    : isMine
                    ? "bg-white/40"
                    : "bg-muted"
                }`}
              />
            );
          })}
        </div>
        <div className={`mt-0.5 text-[11px] ${isMine ? "text-white/80" : "text-muted"}`}>
          {formatDuration(playing ? current : remaining)}
        </div>
      </div>

      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}
