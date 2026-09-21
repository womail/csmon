"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthGate({
  locked,
  children,
}: {
  locked: boolean;
  children: ReactNode;
}) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        setError("That token was rejected.");
        return;
      }
      window.sessionStorage.setItem("csmon.token", token.trim());
      window.location.reload();
    } catch {
      setError("Could not reach the unlock endpoint.");
    } finally {
      setBusy(false);
    }
  }

  if (!locked) return children;
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-3 p-6">
      <h1 className="text-[18px] font-semibold">csmon is locked</h1>
      <p className="text-[13px] text-slate-600">
        This instance set <code>CSMON_TOKEN</code>. Paste the same token to open the board.
      </p>
      <Input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
        placeholder="Shared token"
        autoFocus
      />
      {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
      <Button disabled={busy || !token.trim()} onClick={() => void submit()}>
        {busy ? "Unlocking…" : "Unlock"}
      </Button>
    </div>
  );
}
