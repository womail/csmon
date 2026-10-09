import Link from "next/link";
import { BookOpen } from "lucide-react";

/** User manual shell (also opened from Options and the command palette). */
export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-start gap-2">
            <BookOpen className="mt-0.5 size-5 text-slate-700" aria-hidden />
            <div>
              <h1 className="text-[16px] font-semibold">csmon help</h1>
              <p className="text-[12px] text-slate-500">Illustrated user guide · maintainer notes</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-[12px]">
            <Link href="/help" className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100">
              Overview
            </Link>
            <Link
              href="/help/start"
              className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100"
            >
              Getting started
            </Link>
            <Link
              href="/help/maintainer-code"
              className="rounded-md px-2 py-1 text-sky-800 hover:bg-sky-50"
            >
              Maintainer
            </Link>
            <Link href="/" className="rounded-md bg-slate-900 px-2.5 py-1 font-medium text-white">
              ← Board
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
