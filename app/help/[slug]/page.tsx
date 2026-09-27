import { ManualView } from "@/components/monitor/manual-view";

export default async function HelpSectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ManualView slug={slug} />;
}
