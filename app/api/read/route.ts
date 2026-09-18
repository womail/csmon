import { NextResponse } from "next/server";
import { readArticle } from "@/lib/read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  try {
    return NextResponse.json(await readArticle(url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read article";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
