import { HelpGuideView } from "@/components/monitor/help-guide-view";

export default async function HelpSectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const audience =
    slug.startsWith("maintainer") || slug === "lexicon" ? "all" : "user";
  return <HelpGuideView slug={slug} audience={audience} />;
}
