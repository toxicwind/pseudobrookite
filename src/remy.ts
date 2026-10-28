/**
 * remy.ts — the pre-subagent runner, built for real (2026-10-28 architect approval).
 *
 * Remy spawns pseudo-subagents under the unpoisoned contract: each worker's
 * ENTIRE context is (seed + window) — strictly less than the parent's. Workers
 * are pure functions over their slice; the squawk log is the only shared state.
 *
 * Distinction from walk.ts: walk.ts walks ONE prompt's token list with fixed
 * analyzers. remy runs N general tasks (any fn: (seed, windowText) => rows)
 * over token windows of ANY text — the pre-subagent layer for agents whose
 * harness has no Task/subagent tool.
 */
import type { EncName } from "./tokens.ts";
import { encoding, tokenize } from "./tokens.ts";
import { windows } from "./walk.ts";
import { SquawkLog } from "./squawk.ts";

export interface RemyTask {
  name: string;
  /** Runs with ONLY (seed, windowText). Must return structured rows. */
  run: (seed: string, windowText: string) => Array<{ kind: string; payload: unknown }>;
}

export interface RemyResult {
  task: string;
  workers: number;
  rows: number;
  squawkPath: string;
}

export async function remy(
  text: string,
  tasks: RemyTask[],
  opts: { workers?: number; enc?: EncName; outDir?: string; seed?: string } = {},
): Promise<RemyResult[]> {
  const workers = opts.workers ?? 4;
  const enc = opts.enc ?? "o200k_base";
  const outDir = opts.outDir ?? "out";
  const seed = opts.seed ?? "remy";
  const toks = tokenize(text, enc);
  const dec = (t: number[]) => new TextDecoder().decode(encoding(enc).decode(new Uint32Array(t)));
  const ws = windows(toks, workers);
  const results: RemyResult[] = [];

  for (const task of tasks) {
    const log = new SquawkLog(`${outDir}/squawk-${task.name}.jsonl`);
    await Promise.all(
      ws.map(async (w) => {
        const windowText = dec(w.tokens);
        // Isolation: the worker receives seed + windowText and NOTHING else.
        const rows = await Promise.resolve().then(() => task.run(seed, windowText));
        for (const r of rows) {
          if (r.kind === "claim") {
            const p = (r.payload as { provenance?: string })?.provenance ?? "unattributed";
            log.claim(w.worker, JSON.stringify(r.payload).slice(0, 220), p);
          } else {
            log.observation(w.worker, r.payload);
          }
        }
      }),
    );
    await log.flush();
    results.push({ task: task.name, workers: ws.length, rows: log.rows().length, squawkPath: `${outDir}/squawk-${task.name}.jsonl` });
  }
  return results;
}