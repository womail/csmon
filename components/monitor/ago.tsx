"use client";

import { useEffect, useState } from "react";
import { relTime } from "@/lib/time";

export function Ago({
  ts,
  className,
}: {
  ts: number | null | undefined;
  className?: string;
}) {
  const [text, setText] = useState("");
  useEffect(() => {
    const tick = () => setText(relTime(ts));
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, [ts]);
  return <span className={className}>{text}</span>;
}
