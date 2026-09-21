import {
  clearCookieHeader,
  cookieHeader,
  denyIfLimited,
  fail,
  isValidToken,
  jsonOk,
  readJson,
  tokenRequired,
} from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = denyIfLimited(request, "session", 10);
  if (limited) return limited;
  try {
    if (!tokenRequired()) return jsonOk({ ok: true, auth: false });
    const body = await readJson<{ token?: string }>(request, 4096);
    const token = String(body.token ?? "").trim();
    if (!isValidToken(token)) return fail(new Error("Token required."), "Token required.", 401);
    const res = jsonOk({ ok: true, auth: true });
    res.headers.set("Set-Cookie", cookieHeader(token));
    return res;
  } catch (error) {
    return fail(error, "Could not store token.", 400);
  }
}

export async function DELETE(request: Request) {
  const limited = denyIfLimited(request, "session", 10);
  if (limited) return limited;
  const res = jsonOk({ ok: true });
  res.headers.set("Set-Cookie", clearCookieHeader());
  return res;
}
