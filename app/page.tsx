import { AuthGate } from "@/components/monitor/auth-gate";
import { Monitor } from "@/components/monitor/monitor";
import { parseBoardFilters } from "@/lib/board-state";
import { cookies } from "next/headers";
import { isValidToken, tokenRequired } from "@/lib/guard";
import { emptyMonitorState, getMonitorState } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const jar = await cookies();
  const allowed = !tokenRequired() || isValidToken(jar.get("csmon_token")?.value);
  const initial = allowed ? getMonitorState() : emptyMonitorState();
  return (
    <AuthGate locked={!allowed}>
      <Monitor initial={initial} filters={parseBoardFilters(params)} />
    </AuthGate>
  );
}
