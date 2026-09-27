import Link from "next/link";

/** User manual shell (also opened as Options pop-out). */
export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
          <div>
            <h1 className="text-[16px] font-semibold">csmon manual</h1>
            <p className="text-[12px] text-slate-500">User guide and maintainer notes</p>
          </div>
          <Link href="/" className="text-[12px] text-sky-800 hover:underline">
            ← Board
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
