"use client";

import Link from "next/link";
import { MANUAL_SECTIONS, type ManualSection } from "@/lib/manual-content";

function Markdownish({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/);
  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-slate-700">
      {blocks.map((block) => {
        if (block.startsWith("|")) {
          const rows = block.trim().split("\n").filter((r) => !r.match(/^\|[-\s|]+\|$/));
          return (
            <div key={block.slice(0, 24)} className="overflow-x-auto">
              <table className="w-full border-collapse text-[12px]">
                <tbody>
                  {rows.map((row) => {
                    const cells = row.split("|").filter((c) => c.trim() !== "");
                    const isHead = row === rows[0];
                    return (
                      <tr key={row} className="border-b border-slate-200">
                        {cells.map((cell) => (
                          <td
                            key={cell}
                            className={`px-2 py-1 align-top ${isHead ? "font-semibold text-slate-800" : ""}`}
                          >
                            {cell.trim().replace(/\*\*/g, "")}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.startsWith("### ")) {
          return (
            <h3 key={block} className="text-[14px] font-semibold text-slate-900">
              {block.replace(/^###\s+/, "")}
            </h3>
          );
        }
        return (
          <p key={block.slice(0, 32)} className="whitespace-pre-wrap">
            {block.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1")}
          </p>
        );
      })}
    </div>
  );
}

export function ManualView({
  filter,
  slug,
}: {
  filter?: "user" | "maintainer" | "all";
  slug?: string;
}) {
  let sections: ManualSection[] = MANUAL_SECTIONS;
  if (slug) {
    const one = MANUAL_SECTIONS.find((s) => s.slug === slug);
    sections = one ? [one] : [];
  } else if (filter === "user") {
    sections = MANUAL_SECTIONS.filter((s) => s.audience === "user" || s.audience === "both");
  } else if (filter === "maintainer") {
    sections = MANUAL_SECTIONS.filter((s) => s.audience === "maintainer" || s.audience === "both");
  }

  return (
    <div className="flex min-h-0 flex-1 gap-6">
      {!slug ? (
        <nav className="hidden w-44 shrink-0 flex-col gap-1 text-[12px] sm:flex">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Contents</p>
          {MANUAL_SECTIONS.map((s) => (
            <Link
              key={s.slug}
              href={`/help/${s.slug}`}
              className="rounded px-1 py-0.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {s.title}
            </Link>
          ))}
          <Link
            href="/help/maintainer-code"
            className="mt-2 rounded px-1 py-0.5 font-medium text-sky-800 hover:bg-sky-50"
          >
            Source & filter code map →
          </Link>
          <Link
            href="/help/lexicon"
            className="rounded px-1 py-0.5 text-slate-600 hover:bg-slate-100"
          >
            Lexicon
          </Link>
        </nav>
      ) : null}
      <div className="min-w-0 flex-1 space-y-8">
        {sections.length === 0 ? (
          <p className="text-slate-500">Section not found.</p>
        ) : (
          sections.map((section) => (
            <article key={section.slug} id={section.slug}>
              <h2 className="text-[17px] font-semibold text-slate-900">{section.title}</h2>
              <p className="mt-1 text-[12px] text-slate-500">{section.summary}</p>
              <div className="mt-3">
                <Markdownish text={section.body} />
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
