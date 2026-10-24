"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { SITUATION_LANES, type SituationLane } from "@/lib/lanes";

const LANE_LABEL: Record<SituationLane, string> = {
  weather: "Weather",
  quake: "Quakes",
  war: "War",
  unrest: "Unrest",
};

export function MapLaneBar({
  topic,
  onCategory,
}: {
  topic: string | null;
  onCategory: (next: string | null) => void;
}) {
  const extra = topic && !SITUATION_LANES.some((lane) => lane.id === topic) ? topic : null;
  return (
    <div className="map-lane-bar" role="toolbar" aria-label="Map lanes">
      <button
        type="button"
        className={`map-overlay-tab ${topic ? "" : "is-active"}`}
        onClick={() => onCategory(null)}
      >
        All
      </button>
      {SITUATION_LANES.map((lane) => (
        <button
          key={lane.id}
          type="button"
          className={`map-overlay-tab ${topic === lane.id ? "is-active" : ""}`}
          onClick={() => onCategory(topic === lane.id ? null : lane.id)}
        >
          {LANE_LABEL[lane.id]}
        </button>
      ))}
      {extra ? (
        <button type="button" className="map-overlay-tab is-active" onClick={() => onCategory(null)}>
          {extra}
        </button>
      ) : null}
    </div>
  );
}

function clockLabel(ts: number, span: number) {
  return new Date(ts).toLocaleString(
    undefined,
    span > 36 * 60 * 60 * 1000
      ? { month: "short", day: "numeric", hour: "numeric" }
      : { hour: "numeric", minute: "2-digit" },
  );
}

export function MapScrubber({
  start,
  end,
  resetKey = "",
  onPlayhead,
}: {
  start: number;
  end: number;
  /** Lane or time-range changes jump back to the end of the window. */
  resetKey?: string;
  onPlayhead: (time: number) => void;
}) {
  const [playhead, setPlayhead] = useState(end);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 4>(1);
  const head = useRef(end);
  const atEnd = useRef(true);
  const endRef = useRef(end);
  const onPlayheadRef = useRef(onPlayhead);
  endRef.current = end;
  onPlayheadRef.current = onPlayhead;

  useEffect(() => {
    const next = endRef.current;
    head.current = next;
    atEnd.current = true;
    setPlaying(false);
    setPlayhead(next);
    onPlayheadRef.current(next);
  }, [resetKey]);

  useEffect(() => {
    if (!atEnd.current) return;
    head.current = end;
    setPlayhead(end);
    onPlayheadRef.current(end);
  }, [end, start]);

  useEffect(() => {
    if (!playing) return;
    if (head.current >= end - 500) head.current = start;
    const duration = speed === 4 ? 5000 : 20000;
    const step = (end - start) / (duration / 80);
    const id = window.setInterval(() => {
      head.current = Math.min(end, head.current + step);
      atEnd.current = head.current >= end - 500;
      setPlayhead(head.current);
      onPlayheadRef.current(head.current);
      if (head.current >= end) setPlaying(false);
    }, 80);
    return () => window.clearInterval(id);
  }, [playing, speed, start, end]);

  const span = end - start;

  return (
    <div className="map-scrubber">
      <button
        type="button"
        className="map-tool map-tool-text"
        aria-label={playing ? "Pause timeline" : "Play timeline"}
        onClick={() => setPlaying((current) => !current)}
      >
        {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
      </button>
      <button
        type="button"
        className="map-tool map-tool-text"
        aria-label={`Playback speed ${speed}x`}
        onClick={() => setSpeed((current) => (current === 1 ? 4 : 1))}
      >
        {speed}x
      </button>
      <input
        type="range"
        className="map-scrubber-range"
        min={start}
        max={end}
        step={Math.max(1, Math.round(span / 400))}
        value={Math.min(end, Math.max(start, playhead))}
        aria-label="Map time"
        aria-valuetext={clockLabel(playhead, span)}
        onChange={(event) => {
          const next = Number(event.target.value);
          head.current = next;
          atEnd.current = next >= end - 1000;
          setPlaying(false);
          setPlayhead(next);
          onPlayhead(next);
        }}
      />
      <span className="map-scrubber-time">{clockLabel(playhead, span)}</span>
    </div>
  );
}
