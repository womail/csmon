import { fail, gate, jsonOk, readJson } from "@/lib/guard";
import { deleteSource } from "@/lib/queries";
import { monitorStateFromRequest } from "@/lib/monitor-state";
import { parsePublicHttpUrl } from "@/lib/public-url";
import {
  buildSourceCatalog,
  createManualSource,
  importManualSources,
  patchSources,
  purgeByRetentionPolicy,
  purgeItemsOlderThan,
  type SourcePatch,
} from "@/lib/source-catalog";
import {
  feedOverridesPath,
  saveFeedOverrides,
  snapshotIntelOverridesFromDb,
} from "@/lib/feed-overrides";
import { refreshSources } from "@/lib/scrape/refresh";
import type { CreateSourceInput } from "@/lib/source-catalog-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validatePatch(row: SourcePatch): row is SourcePatch {
  return (
    row &&
    typeof row === "object" &&
    Number.isInteger(row.id) &&
    row.id > 0 &&
    (row.name === undefined ||
      (typeof row.name === "string" && row.name.trim().length > 0)) &&
    (row.url === undefined || typeof row.url === "string") &&
    (row.feedUrl === undefined || row.feedUrl === null || typeof row.feedUrl === "string") &&
    (row.description === undefined ||
      row.description === null ||
      typeof row.description === "string") &&
    (row.enabled === undefined || typeof row.enabled === "boolean") &&
    (row.retentionDays === undefined ||
      row.retentionDays === null ||
      (typeof row.retentionDays === "number" && row.retentionDays >= 0))
  );
}

export async function GET(request: Request) {
  const blocked = gate(request, "source-catalog", 60);
  if (blocked) return blocked;
  const url = new URL(request.url);
  const previewDays = Number(url.searchParams.get("purgePreviewDays"));
  const previewSourceIds = url.searchParams
    .get("sourceIds")
    ?.split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return jsonOk(
    buildSourceCatalog({
      purgePreviewDays: Number.isFinite(previewDays) && previewDays > 0 ? previewDays : undefined,
      previewSourceIds: previewSourceIds?.length ? previewSourceIds : undefined,
    }),
  );
}

export async function POST(request: Request) {
  const blocked = gate(request, "source-catalog", 15);
  if (blocked) return blocked;
  try {
    const body = await readJson<{
      create?: CreateSourceInput;
      import?: CreateSourceInput[];
      refresh?: boolean;
    }>(request);

    if (Array.isArray(body.import) && body.import.length) {
      const layers: CreateSourceInput[] = [];
      for (const row of body.import) {
        if (!row?.name?.trim() || !row.url?.trim() || !row.feedUrl?.trim()) continue;
        await parsePublicHttpUrl(row.url.trim());
        await parsePublicHttpUrl(row.feedUrl.trim());
        layers.push({
          name: row.name.trim(),
          url: row.url.trim(),
          feedUrl: row.feedUrl.trim(),
          description: row.description?.trim() || null,
          enabled: row.enabled !== false,
          retentionDays: row.retentionDays ?? null,
        });
      }
      if (!layers.length) {
        return fail(new Error("Empty import"), "No valid layers in import.", 400);
      }
      const result = importManualSources(layers);
      if (body.refresh !== false && result.ids.length) {
        await refreshSources(result.ids);
      }
      return jsonOk({
        catalog: buildSourceCatalog(),
        state: monitorStateFromRequest(request),
        import: result,
      });
    }

    const create = body.create;
    if (!create?.name?.trim() || !create.url?.trim() || !create.feedUrl?.trim()) {
      return fail(new Error("Missing fields"), "Name, site URL, and feed URL are required.", 400);
    }
    await parsePublicHttpUrl(create.url.trim());
    await parsePublicHttpUrl(create.feedUrl.trim());
    const id = createManualSource({
      name: create.name,
      url: create.url,
      feedUrl: create.feedUrl,
      description: create.description,
      enabled: create.enabled,
      retentionDays: create.retentionDays,
    });
    if (body.refresh !== false) {
      await refreshSources([id]);
    }
    return jsonOk({ catalog: buildSourceCatalog(), state: monitorStateFromRequest(request), id });
  } catch (error) {
    return fail(error, "Could not add source");
  }
}

export async function DELETE(request: Request) {
  const blocked = gate(request, "source-catalog", 15);
  if (blocked) return blocked;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return fail(new Error("Missing id"), "Missing source id.", 400);
  }
  deleteSource(id);
  return jsonOk({ catalog: buildSourceCatalog(), state: monitorStateFromRequest(request) });
}

export async function PATCH(request: Request) {
  const blocked = gate(request, "source-catalog", 15);
  if (blocked) return blocked;
  try {
    const body = await readJson<{
      updates?: unknown;
      refresh?: boolean;
      purge?: { maxAgeDays?: number; sourceIds?: number[] };
      retentionPolicy?: { globalDefaultDays?: number | null; sourceIds?: number[] };
      saveFeedOverrides?: boolean;
    }>(request);

    if (body.saveFeedOverrides) {
      const feeds = snapshotIntelOverridesFromDb();
      const file = saveFeedOverrides(feeds);
      return jsonOk({
        catalog: buildSourceCatalog(),
        state: monitorStateFromRequest(request),
        feedOverrides: { saved: feeds.length, path: feedOverridesPath(), updatedAt: file.updatedAt },
      });
    }

    let purged = 0;
    const purgeRequested =
      (body.purge?.maxAgeDays != null && body.purge.maxAgeDays > 0) ||
      (body.retentionPolicy?.globalDefaultDays != null &&
        body.retentionPolicy.globalDefaultDays > 0);

    if (body.purge?.maxAgeDays != null && body.purge.maxAgeDays > 0) {
      purged = purgeItemsOlderThan(body.purge.maxAgeDays, body.purge.sourceIds);
    } else if (
      body.retentionPolicy &&
      body.retentionPolicy.globalDefaultDays != null &&
      body.retentionPolicy.globalDefaultDays > 0
    ) {
      purged = purgeByRetentionPolicy(
        body.retentionPolicy.globalDefaultDays,
        body.retentionPolicy.sourceIds,
      );
    }

    const updates = Array.isArray(body.updates) ? (body.updates as SourcePatch[]) : [];
    const valid = updates.filter(validatePatch);
    if (valid.length) {
      patchSources(
        valid.map((row) => ({
          id: row.id,
          name: row.name?.trim(),
          url: row.url?.trim(),
          feedUrl: row.feedUrl,
          description: row.description,
          enabled: row.enabled,
          retentionDays: row.retentionDays,
        })),
      );
      if (body.refresh !== false) {
        await refreshSources(valid.map((row) => row.id));
      }
    } else if (!purgeRequested) {
      return fail(new Error("No updates"), "Nothing to save.", 400);
    }

    return jsonOk({
      catalog: buildSourceCatalog(),
      state: monitorStateFromRequest(request),
      purged,
    });
  } catch (error) {
    return fail(error, "Could not save sources");
  }
}
