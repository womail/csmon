"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Mount map children only when near the viewport (avoids N Leaflet instances on load). */
export function LazyMapGate({
  children,
  placeholder = "Map loads when visible…",
}: {
  children: ReactNode;
  placeholder?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || mounted.current) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          mounted.current = true;
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: "120px", threshold: 0.02 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="h-full min-h-[inherit] w-full">
      {show ? children : <div className="geo-map-skeleton">{placeholder}</div>}
    </div>
  );
}
