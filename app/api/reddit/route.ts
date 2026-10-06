import { fail, gate, jsonOk, readJson } from "@/lib/guard";
import { registerRedditFeed } from "@/lib/queries";
import { monitorStateFromRequest } from "@/lib/monitor-state";
import {
  gdeltSuggestionsFromSubreddits,
  isRedditRssSunset,
  REDDIT_RSS_SUNSET_BANNER,
  uniqueSubreddits,
} from "@/lib/reddit";
import { redditOAuthConfigured, setRedditOAuthSession } from "@/lib/reddit-oauth-session";
import { refreshSources } from "@/lib/scrape/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = gate(request, "reddit", 10);
  if (blocked) return blocked;
  try {
    const body = await readJson<{
      subs?: unknown;
      enable?: boolean;
      oauthClientId?: unknown;
      oauthClientSecret?: unknown;
    }>(request);
    const subs = uniqueSubreddits(Array.isArray(body.subs) ? body.subs.map((value) => String(value)) : []);
    const enable = body.enable !== false;
    const clientId = typeof body.oauthClientId === "string" ? body.oauthClientId.trim() : "";
    const clientSecret = typeof body.oauthClientSecret === "string" ? body.oauthClientSecret.trim() : "";
    if (clientId && clientSecret) setRedditOAuthSession(clientId, clientSecret);
    const useOAuth = redditOAuthConfigured();
    if (enable && isRedditRssSunset() && !useOAuth) {
      return jsonOk(
        {
          error: `${REDDIT_RSS_SUNSET_BANNER} Add Reddit OAuth app id/secret in Options → Data, or import to GDELT.`,
          gdeltSuggestions: gdeltSuggestionsFromSubreddits(subs),
        },
        400,
      );
    }
    if (enable && !subs.length) return jsonOk({ error: "Add at least one subreddit." }, 400);
    const ids = registerRedditFeed(subs, enable, { oauth: isRedditRssSunset() && useOAuth });
    if (enable) await refreshSources(ids);
    return jsonOk(monitorStateFromRequest(request));
  } catch (error) {
    return fail(error, "Reddit feed failed");
  }
}
