import { DESKS } from "./board-state";
import type { Desk } from "./types";
import type { UserDesk } from "./user-desks";

export type DeskGroupId = "situation" | "cyber" | "tools";

export const DESK_GROUP_ORDER: DeskGroupId[] = ["situation", "cyber", "tools"];

export const DESK_GROUP_LABEL: Record<DeskGroupId, string> = {
  situation: "Situation",
  cyber: "Cyber",
  tools: "Tools",
};

/** Built-in desks by rail section (chunking / serial position). */
export const DESK_GROUP_MEMBERS: Record<DeskGroupId, Desk[]> = {
  situation: ["home", "brief", "pulse", "weather"],
  cyber: ["advisories", "patch"],
  tools: ["scan", "people", "documents", "reports", "flights", "sources"],
};

export type DeskNavRow = { id: Desk; label: string; hint: string };

export function groupedBuiltinDesks(): { group: DeskGroupId; desks: DeskNavRow[] }[] {
  const byId = new Map(DESKS.map((row) => [row.id, row]));
  return DESK_GROUP_ORDER.map((group) => ({
    group,
    desks: DESK_GROUP_MEMBERS[group]
      .map((id) => byId.get(id))
      .filter((row): row is (typeof DESKS)[number] => row != null),
  }));
}

export function allDeskNavRows(customDesks: UserDesk[]): DeskNavRow[] {
  return [
    ...DESKS,
    ...customDesks.map((item) => ({
      id: item.id as Desk,
      label: item.label,
      hint: item.hint,
    })),
  ];
}
