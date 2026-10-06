import "server-only";

/** In-memory OAuth app creds from the last browser Options POST (not stored in SQLite). */

let session: { clientId: string; clientSecret: string } | null = null;

export function setRedditOAuthSession(clientId: string, clientSecret: string) {
  const id = clientId.trim();
  const secret = clientSecret.trim();
  session = id && secret ? { clientId: id, clientSecret: secret } : null;
}

export function redditOAuthCredentials() {
  const envId = process.env.REDDIT_CLIENT_ID?.trim();
  const envSecret = process.env.REDDIT_CLIENT_SECRET?.trim();
  if (envId && envSecret) return { clientId: envId, clientSecret: envSecret };
  return session;
}

export function redditOAuthConfigured() {
  return Boolean(redditOAuthCredentials());
}
