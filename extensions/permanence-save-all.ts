/**
 * extensions/permanence-save-all.ts — tau extension (ExtensionAPI shape).
 *
 * Named surface (geode): "permanence-save-all".
 * Meta-permanence for tau/kappa sessions: on every inbound user turn, offer a
 * staged micro-commit save of the session's working repos (save as we go), so
 * an aborted session (the 24 we just collected!) never eats the work.
 *
 * Enable by env: PERMANENCE_REPOS="/repo/a:/repo/b" (colon-separated).
 * Green-blue deploy lives in scripts/deploy-green-blue.ts (green = current,
 * blue = new; healthcheck blue, swap, keep green for instant rollback).
 */
import type { ExtensionAPI } from "tau";
import { saveAll } from "../plugins/pseudobrookite-permanence/index.ts";

export default function permanenceSaveAll(pi: ExtensionAPI): void {
  const repos = (process.env.PERMANENCE_REPOS ?? "")
    .split(":")
    .map((r) => r.trim())
    .filter(Boolean);
  if (repos.length === 0) return;

  pi.on("input", async (event: unknown) => {
    for (const repo of repos) {
      try {
        await saveAll(repo, `wip: permanence save-as-we-go ${new Date().toISOString()}`);
      } catch {
        // A dirty or unpushable repo must never block the turn; save-all logs loudly.
      }
    }
    return event;
  });
}