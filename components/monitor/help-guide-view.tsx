"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  adjacentSlugs,
  filterGroups,
  sectionsForNav,
  type HelpNavGroup,
} from "@/lib/help-navigation";
import { MANUAL_SECTIONS, sectionBySlug, type HelpFigure, type ManualSection } from "@/lib/manual-content";

function Markdownish({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/);
  return (
    <div className="help-prose space-y-3 text-[13px] leading-relaxed text-slate-700">
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

function HelpFigureBlock({ figure }: { figure: HelpFigure }) {
  return (
    <figure className="help-figure">
      <div className="help-figure-frame">
        <Image
          src={figure.src}
          alt={figure.alt}
          width={1280}
          height={720}
          className="h-auto w-full"
          sizes="(max-width: 768px) 100vw, 720px"
        />
      </div>
      {figure.caption ? (
        <figcaption className="mt-2 text-[11px] leading-snug text-slate-500">{figure.caption}</figcaption>
      ) : null}
    </figure>
  );
}

function SectionArticle({ section }: { section: ManualSection }) {
  return (
    <article id={section.slug} className="scroll-mt-24">
      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900">{section.title}</h2>
      <p className="mt-1 text-[13px] text-slate-500">{section.summary}</p>
      {section.figures?.length ? (
        <div className="mt-4 space-y-4">
          {section.figures.map((figure) => (
            <HelpFigureBlock key={figure.src} figure={figure} />
          ))}
        </div>
      ) : null}
      <div className="mt-4">
        <Markdownish text={section.body} />
      </div>
    </article>
  );
}

function NavLink({
  section,
  active,
}: {
  section: ManualSection;
  active: boolean;
}) {
  return (
    <Link
      href={`/help/${section.slug}`}
      className={`block rounded-md px-2 py-1.5 text-[12px] leading-snug ${
        active
          ? "bg-slate-900 font-medium text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {section.title}
    </Link>
  );
}

function SidebarNav({
  groups,
  activeSlug,
  query,
}: {
  groups: HelpNavGroup[];
  activeSlug?: string;
  query: string;
}) {
  const sections = useMemo(() => sectionsForNav(groups), [groups]);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? sections.filter(
        (row) =>
          row.title.toLowerCase().includes(q) ||
          row.summary.toLowerCase().includes(q) ||
          row.slug.includes(q),
      )
    : sections;

  return (
    <nav className="help-sidebar-nav space-y-4" aria-label="Help topics">
      {groups.map((group) => {
        const rows = filtered.filter((row) => group.slugs.includes(row.slug));
        if (rows.length === 0) return null;
        return (
          <div key={group.id}>
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {rows.map((row) => (
                <NavLink key={row.slug} section={row} active={row.slug === activeSlug} />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function HubCard({ section }: { section: ManualSection }) {
  const thumb = section.figures?.[0];
  return (
    <Link
      href={`/help/${section.slug}`}
      className="help-hub-card group block rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow"
    >
      {thumb ? (
        <div className="help-figure-frame mb-2 overflow-hidden rounded-md">
          <Image
            src={thumb.src}
            alt=""
            width={400}
            height={225}
            className="h-auto w-full transition group-hover:scale-[1.01]"
            sizes="280px"
          />
        </div>
      ) : (
        <div className="mb-2 flex h-24 items-center justify-center rounded-md bg-slate-100 text-slate-400">
          <BookOpen className="size-6" />
        </div>
      )}
      <h3 className="text-[14px] font-semibold text-slate-900">{section.title}</h3>
      <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{section.summary}</p>
    </Link>
  );
}

export function HelpGuideView({
  slug,
  audience = "user",
}: {
  slug?: string;
  audience?: "user" | "maintainer" | "all";
}) {
  const [query, setQuery] = useState("");
  const groups = filterGroups(audience === "all" ? "user" : audience);
  const maintainerGroups = audience === "all" ? filterGroups("maintainer") : [];
  const allGroups = audience === "all" ? [...groups, ...maintainerGroups] : groups;

  const section = slug ? sectionBySlug(slug) : null;
  const userTour = sectionsForNav(filterGroups("user"));
  const { prev, next } = slug ? adjacentSlugs(slug, filterGroups("user")) : { prev: null, next: null };

  return (
    <div className="help-guide-layout flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-8">
      <aside className="help-sidebar shrink-0 lg:w-56">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search help…"
            className="h-8 pl-8 text-[12px]"
          />
        </label>
        <div className="mt-3 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
          <SidebarNav groups={allGroups} activeSlug={slug} query={query} />
          {audience === "all" ? (
            <p className="mt-4 px-2 text-[10px] text-slate-400">
              Maintainer sections are listed under <strong>Maintainers</strong>.
            </p>
          ) : null}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {!slug ? (
          <div className="space-y-8">
            <header>
              <h2 className="text-[22px] font-semibold text-slate-900">User guide</h2>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-600">
                Walk through csmon with screenshots from the live board. Pick a topic on the left, or
                start with{" "}
                <Link href="/help/start" className="font-medium text-sky-800 underline underline-offset-2">
                  Getting started
                </Link>
                . Keyboard: <kbd className="rounded border px-1 text-[11px]">Ctrl/⌘ K</kbd> opens the
                command palette (includes User guide).
              </p>
            </header>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {userTour.map((row) => (
                <HubCard key={row.slug} section={row} />
              ))}
            </div>
            {audience === "all" ? (
              <section>
                <h2 className="text-[17px] font-semibold text-slate-900">All manual sections</h2>
                <div className="mt-4 space-y-8">
                  {MANUAL_SECTIONS.filter(
                    (row) => row.audience === "maintainer" || row.audience === "both",
                  ).map((row) => (
                    <SectionArticle key={row.slug} section={row} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : section ? (
          <div className="space-y-6">
            <SectionArticle section={section} />
            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
              {prev ? (
                <Link
                  href={`/help/${prev}`}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-sky-800 hover:underline"
                >
                  <ChevronLeft className="size-3.5" />
                  {sectionBySlug(prev)?.title ?? prev}
                </Link>
              ) : (
                <span />
              )}
              {next ? (
                <Link
                  href={`/help/${next}`}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-sky-800 hover:underline"
                >
                  {sectionBySlug(next)?.title ?? next}
                  <ChevronRight className="size-3.5" />
                </Link>
              ) : null}
            </footer>
          </div>
        ) : (
          <p className="text-slate-500">Section not found.</p>
        )}
      </div>
    </div>
  );
}

/** @deprecated Use HelpGuideView — kept for imports that expect ManualView. */
export function ManualView({
  filter,
  slug,
}: {
  filter?: "user" | "maintainer" | "all";
  slug?: string;
}) {
  return <HelpGuideView slug={slug} audience={filter ?? "all"} />;
}
