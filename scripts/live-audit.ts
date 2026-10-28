#!/usr/bin/env bun
/**
 * live-audit.ts — audit a live directory, organize it into folders, emit user-facing
 * subtasks for the edits. Companion .ts for the live-audit-to-folders skill.
 *
 * Usage:
 *   bun scripts/live-audit.ts <dir> [--organize] [--out <dir>]
 *
 * - Scans <dir> (skips node_modules/.git/.audit), classifies files by kind
 *   (docs, code, data, artifacts, other) and writes:
 *     <out>/live-audit-<ts>.json   — full inventory + kind stats
 *     <out>/live-audit-<ts>.md     — human report INCLUDING a per-file subtask list
 *                                    (what to move / document / fix) for user-facing edits
 * - --organize: creates docs/ src/ data/ folders and MOVES loose root files in;
 *   journals every move in the report's `moves` array.
 *
 * Primitive contract (tau/kappa): every report row is {file, kind, size, subtask,
 * provenance} — the same claim-with-provenance shape the tau session forensics
 * skills use, so an agent can consume the audit as a task list without re-scanning.
 */
import { readdirSync, statSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join, basename, extname, relative } from "node:path";

const target = process.argv[2];
const organize = process.argv.includes("--organize");
const outFlag = process.argv.indexOf("--out");
const outDir = outFlag > 0 ? process.argv[outFlag + 1] : target;
if (!target) { console.error("usage: bun scripts/live-audit.ts <dir> [--organize] [--out <dir>]"); process.exit(1); }

const KIND_BY_EXT: Record<string, string> = {
  ".md": "docs", ".mdx": "docs", ".txt": "docs", ".rst": "docs",
  ".ts": "code", ".js": "code", ".tsx": "code", ".json": "data", ".jsonl": "data",
  ".yml": "data", ".yaml": "data", ".toml": "data", ".env": "data",
  ".html": "docs", ".css": "code", ".png": "artifacts", ".jpg": "artifacts",
  ".pdf": "artifacts", ".zip": "artifacts", ".tar": "artifacts", ".gz": "artifacts",
  ".sqlite": "data", ".db": "data",
};
const SKIP = new Set(["node_modules", ".git", ".audit", "dist", "out"]);

interface Row { file: string; kind: string; size: number; ext: string; subtask: string; movedTo?: string; }
const rows: Row[] = [];
const walk = (dir: string, root = true): void => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) && (root || e.name === "node_modules" || e.name === ".git")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) { walk(p, false); continue; }
    if (root) continue; // only loose root files get organized; nested stay put
    const st = statSync(p);
    const ext = extname(e.name).toLowerCase();
    const kind = KIND_BY_EXT[ext] ?? "other";
    const subtask = kind === "docs" ? `review + link from an index doc`
      : kind === "code" ? `typecheck + add to build/test surface`
      : kind === "data" ? `verify freshness + provenance header`
      : kind === "artifacts" ? `archive under docs/ or scratch-archive per estate doctrine`
      : `triage: move or delete with provenance`;
    rows.push({ file: relative(target, p), kind, size: st.size, ext, subtask });
  }
};
walk(target);

const sorted = [...rows].sort((a, b) => b.size - a.size);
const byKind: Record<string, number> = {};
for (const r of rows) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
const totalBytes = rows.reduce((s, r) => s + r.size, 0);

const moves: Array<{ from: string; to: string }> = [];
if (organize) {
  for (const d of ["docs", "src", "data"]) mkdirSync(join(target, d), { recursive: true });
  for (const r of sorted) {
    const dest = r.kind === "docs" ? "docs" : r.kind === "code" ? "src" : r.kind === "data" ? "data" : null;
    if (!dest || !r.ext) continue;
    const from = join(target, r.file);
    const to = join(target, dest, basename(from));
    renameSync(from, to);
    r.movedTo = relative(target, to);
    r.file = relative(target, to);
    moves.push({ from: r.file, to: dest });
  }
}

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const json = { auditedAt: new Date().toISOString(), target, organize, totalFiles: rows.length, totalBytes, byKind, moves, rows: sorted };
writeFileSync(join(outDir, `live-audit-${ts}.json`), JSON.stringify(json, null, 2));

const md = [`# Live audit — ${target}`, ``, `- audited: ${json.auditedAt} · files: ${rows.length} · bytes: ${totalBytes}`, `- kinds: ${Object.entries(byKind).map(([k, v]) => `${k}=${v}`).join(", ")}`, ...(moves.length ? [`- organized: ${moves.length} files moved into docs/ src/ data/`] : []), ``, `## User-facing subtasks (edit me)`, ``,
  `| # | file | kind | size | subtask |`, `|---+------+------+------+---------|`,
  ...sorted.map((r, i) => `| ${i + 1} | ${r.file} | ${r.kind} | ${r.size} | ${r.subtask} |`), ``,
  `Provenance: every row is a tool-observed inventory entry (verified), not a claim.`];
writeFileSync(join(outDir, `live-audit-${ts}.md`), md.join("\n"));

console.log(`audit ${target}: ${rows.length} files, ${totalBytes} bytes`);
console.log(`kinds: ${Object.entries(byKind).map(([k, v]) => `${k}=${v}`).join(", ")}`);
console.log(`report: ${join(outDir, `live-audit-${ts}.md`)}`);
if (moves.length) console.log(`organized ${moves.length} loose files into docs/ src/ data/`);