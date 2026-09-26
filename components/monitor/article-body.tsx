"use client";

import { ExternalLink } from "lucide-react";
import type { ArticleBlock } from "@/lib/article-body";
import { splitCveSegments } from "@/lib/article-body";

function CveText({ text, onCve }: { text: string; onCve?: (cve: string) => void }) {
  const parts = splitCveSegments(text);
  return (
    <>
      {parts.map((part, i) =>
        part.cve && onCve ? (
          <button
            key={`${part.cve}-${i}`}
            type="button"
            onClick={() => onCve(part.cve!)}
            className="font-mono text-[11px] font-semibold text-sky-900 underline-offset-2 hover:underline"
          >
            {part.cve}
          </button>
        ) : (
          <span key={`t-${i}`}>{part.text}</span>
        ),
      )}
    </>
  );
}

export function ArticleBody({
  blocks,
  onCve,
}: {
  blocks: ArticleBlock[];
  onCve?: (cve: string) => void;
}) {
  if (!blocks.length) return null;
  return (
    <div className="mt-2 space-y-3">
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;
        switch (block.kind) {
          case "heading":
            return (
              <h3 key={key} className="text-[13px] font-semibold leading-snug text-slate-900">
                {block.text}
              </h3>
            );
          case "callout":
            return (
              <p
                key={key}
                className="rounded-md border border-sky-200 bg-sky-50/90 px-2.5 py-2 text-[12px] leading-relaxed text-sky-950"
              >
                <CveText text={block.text} onCve={onCve} />
              </p>
            );
          case "cve":
            return (
              <div
                key={key}
                className="rounded-md border border-violet-200 bg-violet-50/80 px-2.5 py-2"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  {onCve ? (
                    <button
                      type="button"
                      onClick={() => onCve(block.cveId)}
                      className="font-mono text-[11px] font-bold text-violet-950 underline-offset-2 hover:underline"
                    >
                      {block.cveId}
                    </button>
                  ) : (
                    <span className="font-mono text-[11px] font-bold text-violet-950">{block.cveId}</span>
                  )}
                  {block.cvss ? (
                    <span className="text-[10px] font-medium text-violet-800">CVSS {block.cvss}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-800">{block.detail}</p>
              </div>
            );
          case "list":
            return (
              <div key={key}>
                {block.title ? (
                  <p className="mb-1 text-[11px] font-medium leading-snug text-slate-700">{block.title}</p>
                ) : null}
                <ul className="list-disc space-y-1 pl-4 text-[12px] leading-relaxed text-slate-700">
                  {block.items.map((item) => (
                    <li key={item.slice(0, 48)}>
                      <CveText text={item} onCve={onCve} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          case "reference":
            return (
              <p key={key} className="text-[11px] text-slate-600">
                <span className="font-medium text-slate-500">[{block.index}] </span>
                <a
                  href={block.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 break-all text-sky-800 hover:underline"
                >
                  {block.label}
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              </p>
            );
          case "meta":
            return (
              <p key={key} className="text-[10px] tracking-wide text-slate-400 uppercase">
                {block.text}
              </p>
            );
          case "paragraph":
            return (
              <p key={key} className="text-[12.5px] leading-relaxed text-slate-700">
                <CveText text={block.text} onCve={onCve} />
              </p>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
