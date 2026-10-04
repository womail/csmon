import "server-only";

import { getDb, withTransaction } from "./db";
import {
  type Report,
  type ReportStory,
} from "./reports";

const MAX_REPORTS = 48;
const MAX_STORIES = 40;

function storyItemId(story: ReportStory) {
  const fromItems = story.items.find((row) => typeof row.itemId === "number")?.itemId;
  if (fromItems && fromItems > 0) return fromItems;
  const match = /^item-(\d+)$/.exec(story.id);
  if (match) return Number(match[1]);
  return null;
}

export function listStoredReports(): Report[] {
  const db = getDb();
  const heads = db
    .prepare("SELECT * FROM reports ORDER BY updated_at DESC")
    .all() as {
    id: string;
    title: string;
    status: "open" | "archived";
    created_at: number;
    updated_at: number;
  }[];
  if (!heads.length) return [];
  const stories = db
    .prepare("SELECT report_id, snapshot FROM report_stories ORDER BY position ASC")
    .all() as { report_id: string; snapshot: string }[];
  const byReport = new Map<string, ReportStory[]>();
  for (const row of stories) {
    try {
      const snap = JSON.parse(row.snapshot) as ReportStory;
      const list = byReport.get(row.report_id) ?? [];
      list.push(snap);
      byReport.set(row.report_id, list);
    } catch {
      /* skip bad snapshot */
    }
  }
  return heads.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stories: (byReport.get(row.id) ?? []).slice(0, MAX_STORIES),
  }));
}

export function replaceStoredReports(rows: Report[]) {
  const db = getDb();
  const keep = rows.slice(0, MAX_REPORTS);
  withTransaction(() => {
    db.exec("DELETE FROM report_stories");
    db.exec("DELETE FROM reports");
    const insReport = db.prepare(
      `INSERT INTO reports (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    );
    const insStory = db.prepare(
      `INSERT INTO report_stories (id, report_id, item_id, position, snapshot, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const report of keep) {
      insReport.run(report.id, report.title, report.status, report.createdAt, report.updatedAt);
      report.stories.slice(0, MAX_STORIES).forEach((story, position) => {
        insStory.run(
          `${report.id}:${story.id}`,
          report.id,
          storyItemId(story),
          position,
          JSON.stringify(story),
          report.updatedAt,
        );
      });
    }
  });
  return listStoredReports();
}

export function storedReportCount() {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM reports").get() as { n: number };
  return Number(row.n);
}
