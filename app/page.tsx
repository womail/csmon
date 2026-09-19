import { Monitor } from "@/components/monitor/monitor";
import { parseBoardFilters } from "@/lib/board-state";
import { getMonitorState } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initial = getMonitorState();
  return <Monitor initial={initial} filters={parseBoardFilters(params)} />;
}
