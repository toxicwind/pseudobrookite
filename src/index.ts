#!/usr/bin/env bun
/**
 * index.ts — pseudobrookite CLI.
 *
 *   bun run analyze --spec <file> [--workers N] [--enc o200k_base|cl100k_base]
 *                   [--out dir] [--web narrators.jsonl]
 */
import { compile, type CompileResult } from "./compiler.ts";
import type { EncName } from "./tokens.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const specPath = arg("--spec");
if (!specPath) {
  console.error("usage: bun run analyze --spec <file> [--workers N] [--enc e] [--out dir] [--web narrators.jsonl]");
  process.exit(1);
}
const enc = (arg("--enc") ?? "o200k_base") as EncName;
const workers = Number(arg("--workers") ?? 4);
const outDir = arg("--out") ?? "out";
const narratorsPath = arg("--web");

const result: CompileResult = await compile({ specPath, enc, workers, outDir, narratorsPath });
console.log(`tokens=${result.totalTokens} sections=${result.sections.length} workers=${result.walk.length} claims=${result.claims.length}`);
console.log(`verdict: ${result.verdict}`);
console.log(`artifacts: ${outDir}/analysis.json ${outDir}/squawk.jsonl ${outDir}/report.md`);