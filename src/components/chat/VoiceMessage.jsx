"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cx } from "../../lib/cx.js";

function fmt(s) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// Compact voice-message player rendered directly on the message bubble (no
// native <audio> chrome), so it blends into the bubble colour like the
// WhatsApp/Telegram style. `mine` flips the palette for the red own-bubble vs
// the white other-bubble.
export function VoiceMessage({ src, mine }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return undefined;
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(a.duration);
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  function seek(event) {
    const a = audioRef.current;
    if (!a || !Number.isFinite(a.duration)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    a.currentTime = ratio * a.duration;
    setCurrent(a.currentTime);
  }

  const pct = duration ? (current / duration) * 100 : 0;
  const accent = mine ? "text-white" : "text-wash-600";
  const track = mine ? "bg-white/30" : "bg-neutral-200";
  const fill = mine ? "bg-white" : "bg-wash-500";
  const timeColor = mine ? "text-white/80" : "text-neutral-500";

  return (
    <div className="flex w-60 max-w-full items-center gap-2.5">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button type="button" onClick={toggle} aria-label="Play voice message" className={cx("shrink-0", accent)}>
        {playing ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
      </button>
      <button
        type="button"
        onClick={seek}
        aria-label="Seek"
        className={cx("h-1.5 min-w-0 flex-1 overflow-hidden rounded-full", track)}
      >
        <div className={cx("h-full rounded-full", fill)} style={{ width: `${pct}%` }} />
      </button>
      <span className={cx("shrink-0 text-[0.65rem] tabular-nums", timeColor)}>
        {fmt(playing || current ? current : duration)}
      </span>
    </div>
  );
}
