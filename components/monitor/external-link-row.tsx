"use client";

import { ExternalLink } from "lucide-react";

export function ExternalLinkRow({
  href,
  label,
  hint,
  urlCaption,
  onPrimaryClick,
  primaryActionLabel,
  variant = "default",
}: {
  href: string;
  label: string;
  hint?: string;
  /** Shown prominently under the label (e.g. full URL). */
  urlCaption?: string;
  onPrimaryClick?: () => void;
  primaryActionLabel?: string;
  variant?: "default" | "advisory";
}) {
  const caption = urlCaption ?? (variant === "advisory" ? href.replace(/^https?:\/\//, "") : undefined);
  return (
    <div
      className={
        variant === "advisory"
          ? "rounded-md border border-emerald-300/80 bg-emerald-50/95 px-2.5 py-1.5 dark:border-emerald-700 dark:bg-emerald-950/40"
          : "rounded-md border border-sky-300 bg-sky-50 px-2.5 py-1.5 dark:border-sky-700 dark:bg-sky-950/50"
      }
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex max-w-full items-start gap-1.5 text-[13px] font-semibold leading-snug text-sky-950 hover:underline dark:text-sky-100"
      >
        <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-sky-800 dark:text-sky-300" />
        <span className="min-w-0 break-all">{label}</span>
      </a>
      {caption ? (
        <p className="external-link-caption mt-1 break-all pl-[1.375rem] text-[12px] font-medium leading-snug text-slate-800 dark:text-slate-100">
          {caption}
        </p>
      ) : null}
      {hint ? (
        <p className="external-link-caption mt-0.5 pl-[1.375rem] text-[11px] leading-snug text-slate-700 dark:text-slate-200">
          {hint}
        </p>
      ) : null}
      {onPrimaryClick && primaryActionLabel ? (
        <button
          type="button"
          onClick={onPrimaryClick}
          className="mt-1 ml-[1.375rem] text-[11px] font-semibold text-sky-900 underline underline-offset-2 dark:text-sky-200"
        >
          {primaryActionLabel}
        </button>
      ) : null}
    </div>
  );
}
