import { jsonOk } from "@/lib/guard";
import { APP_BUILD_COMMIT, APP_BUILD_DATE } from "@/lib/build-info";
import { envBoardItemLimit } from "@/lib/board-limit";
import { APP_NAME, APP_VERSION } from "@/lib/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Running build identity for Options and support. */
export async function GET() {
  return jsonOk({
    name: APP_NAME,
    version: APP_VERSION,
    commit: APP_BUILD_COMMIT,
    buildDate: APP_BUILD_DATE,
    defaultItemLimit: envBoardItemLimit(),
  });
}
