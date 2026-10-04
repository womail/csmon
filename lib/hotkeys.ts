export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export const COMMAND_DESKS = [
  "home",
  "brief",
  "scan",
  "pulse",
  "weather",
  "people",
  "documents",
  "reports",
  "flights",
] as const;
