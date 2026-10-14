"use client";

import { ContextMenu } from "@/components/monitor/context-menu";

export type SourceMenuAction =
  | { kind: "preview" }
  | { kind: "subscribe" }
  | { kind: "unsubscribe" };

export function SourceContextMenu({
  x,
  y,
  sourceName,
  subscribed,
  onAction,
  onClose,
}: {
  x: number;
  y: number;
  sourceName: string;
  subscribed: boolean;
  onAction: (action: SourceMenuAction) => void;
  onClose: () => void;
}) {
  return (
    <ContextMenu
      x={x}
      y={y}
      title={sourceName}
      onClose={onClose}
      sections={[
        {
          items: [
            { id: "preview", label: "Preview content…", onSelect: () => onAction({ kind: "preview" }) },
            subscribed
              ? { id: "unsubscribe", label: "Unsubscribe (hide layer)", onSelect: () => onAction({ kind: "unsubscribe" }) }
              : { id: "subscribe", label: "Subscribe (enable layer)", onSelect: () => onAction({ kind: "subscribe" }) },
          ],
        },
      ]}
    />
  );
}
