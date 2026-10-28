/**
 * plugins/pseudobrookite-permanence — the permanence primitives plugin.
 *
 * Named surface (geode): exposes save-all (branch → tmp commit → micro merge
 * to main → push, forward-only) and live-audit (audit → organize → subtasks)
 * as importable primitives for tau / kappa and any A2A caller. The register()
 * hook is protocol-agnostic: ExtensionAPI-like hosts get hooks; MCP/tool hosts
 * get named tools.
 *
 * Save-all is META-PERMANENCE: save as we go, staged micro commits, and a
 * live green-blue deploy companion (scripts/deploy-green-blue.ts) — green
 * stays runnable while blue is healthchecked, then swap, instant rollback.
 */
import { compile } from "../../src/compiler.ts";

export interface SaveAllResult { repo: string; status: "saved" | "clean" | "committed-local"; log?: string; }

/** Run the save-all primitive as a child process (isolated, testable). */
export async function saveAll(repo: string, message: string): Promise<SaveAllResult> {
  const p = Bun.spawn(["bun", new URL(".", import.meta.url).pathname + "../../scripts/save-all.ts", repo, message], {
    stdout: "pipe", stderr: "pipe", env: { ...process.env },
  });
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  const code = await p.exited;
  const text = (out + err).trim();
  if (code !== 0) throw new Error(`save-all failed: ${text.slice(0, 400)}`);
  if (text.startsWith("CLEAN")) return { repo, status: "clean", log: text };
  if (text.startsWith("COMMITTED")) return { repo, status: "committed-local", log: text };
  return { repo, status: "saved", log: text };
}

export interface AuditResult { reportPath: string; files: number; }

/** Run the live-audit primitive (audit live dir → organized folders → subtasks). */
export async function liveAudit(dir: string, organize = false): Promise<AuditResult> {
  const args = ["bun", new URL(".", import.meta.url).pathname + "../../scripts/live-audit.ts", dir];
  if (organize) args.push("--organize");
  const p = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  const code = await p.exited;
  if (code !== 0) throw new Error(`live-audit failed: ${(out + err).slice(0, 400)}`);
  const m = /report: (.+)/.exec(out);
  const files = /files?: (\d+)/.exec(out);
  return { reportPath: m?.[1]?.trim() ?? "(see stdout)", files: Number(files?.[1] ?? 0) };
}

/** Prompt analysis via the pseudocompiler (spec → token IR → walk → report). */
export async function analyze(opts: { specPath: string; workers?: number; enc?: "o200k_base" | "cl100k_base"; outDir?: string }) {
  return compile({
    specPath: opts.specPath,
    enc: opts.enc ?? "o200k_base",
    workers: opts.workers ?? 4,
    outDir: opts.outDir ?? "out",
  });
}

/**
 * Protocol-agnostic registration.
 * - tau/kappa ExtensionAPI-like host (has .on): wire input-hook permanence.
 * - tool host (has .tool): register named tools save_all / live_audit / analyze.
 */
export function register(api: { on?: (ev: string, fn: (x: unknown) => unknown) => void; tool?: (name: string, fn: (input: unknown) => Promise<unknown>) => void }, opts: { autopush?: string[] } = {}): void {
  if (typeof api.tool === "function") {
    api.tool("save_all", async (input) => saveAll((input as { repo: string }).repo, (input as { message: string }).message));
    api.tool("live_audit", async (input) => liveAudit((input as { dir: string }).dir, (input as { organize?: boolean }).organize));
    api.tool("analyze_prompt", async (input) => analyze(input as { specPath: string }));
  }
  if (typeof api.on === "function" && opts.autopush?.length) {
    // Permanence hook: every inbound turn offers to save dirty tracked repos first (save as we go).
    api.on("input", async (event: unknown) => {
      for (const repo of opts.autopush ?? []) {
        try { await saveAll(repo, `wip: permanence autopush (save-as-we-go) ${new Date().toISOString()}`); } catch { /* never block the turn on a dirty repo — logged by save-all */ }
      }
      return event;
    });
  }
}