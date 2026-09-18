import { Monitor } from "@/components/monitor/monitor";
import { getMonitorState } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function Page() {
  const initial = getMonitorState();
  return <Monitor initial={initial} />;
}
