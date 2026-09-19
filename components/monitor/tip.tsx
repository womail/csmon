"use client";

import type { ReactNode } from "react";

export function Tip({
  text,
  children,
  className,
}: {
  text: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={className ? `tip ${className}` : "tip"} data-tip={text}>
      {children}
    </span>
  );
}
