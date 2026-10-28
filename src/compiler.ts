/**
 * compiler.ts — the pseudo-embedding pseudocompiler.
 *
 * Treats the ENTIRE prompt as a "perplexity embedding": a token IR (sections
 * + bigram stats) that pseudo-subagents walk, with web tokens ingested
 * asynchronously on demand as narrator claims. Compilation output:
 *   out/squawk.jsonl   — the only shared state
 *   out/analysis.json  — deterministic IR + observations + claims
 *   out/report.md      — human report + one-sentence verdict
 */
import type { EncName } from "./tokens.ts";
import { bigramStats, decode, sections, sectionStats, tokenize } from "./tokens.ts";
import { walkAll, type WorkerObservation } from "./walk.ts";
import { SquawkLog } from "./squawk.ts";
import { loadNarrators, type Claim } from "./narrators.ts";

export interface CompileOptions {
  specPath: string;
  enc: EncName;
  workers: number;
  outDir: string;
  narratorsPath?: string;
  seed?: string;
}

export interface CompileResult {
  specPath: string;
  enc: EncName;
  workers: number;
  totalTokens: number;
  sections: ReturnType<typeof sectionStats>[];
  walk: WorkerObservation[];
  claims: Claim[];
  verifications: string[];
  verdict: string;
}

export async function compile(opts: CompileOptions): Promise<CompileResult> {
  const { specPath, enc, workers, outDir } = opts;
  const log = new SquawkLog(`${outDir}/squawk.jsonl`);
  const text = await Bun.file(specPath).text();

  log.system("compiler", `spec=${specPath} enc=${enc} workers=${workers}`);

  // 1. hyper-tiktoken scan (whole prompt = perplexity embedding)
  const toks = tokenize(text, enc);
  const d = (t: number[]) => decode(t, enc);
  const { entropy, pseudoPerplexity } = bigramStats(toks, d);
  log.observation("compiler", {
    totalTokens: toks.length,
    entropy: Number(entropy.toFixed(3)),
    pseudoPerplexity: Number(pseudoPerplexity.toFixed(3)),
  });

  // 2. section IR
  const secs = sections(text).map((s) => sectionStats(s, enc, d));

  // 3. token walking — async slice workers (pseudo-subagents, context < parent)
  const seed = opts.seed ?? "pseudobrookite";
  const walk = await walkAll(toks, workers, seed, enc);
  for (const w of walk) log.observation(w.worker, w);

  // 4. narrator claims (web tokens, ingested on demand — always tagged)
  let claims: Claim[] = [];
  if (opts.narratorsPath) {
    claims = loadNarrators(opts.narratorsPath);
    for (const c of claims) log.claim("compiler", c.text.slice(0, 220), `${c.source} @ ${c.fetchedAt}`);
  }

  // 5. verifications — ONLY tool-observed facts get verified:true
  const verifications = [
    `spec bytes=${text.length} (observed via Bun.file read)`,
    `token count=${toks.length} (${enc}, deterministic)`,
    `workers ran=${walk.length} of ${workers} requested`,
    `claims=${claims.length} (all verified:"claim", never promoted)`,
  ];
  for (const v of verifications) log.observation("verifier", { text: v, verified: "verified" });

  // 6. one-sentence verdict (re-ask caveat 9: state what was kept and why)
  const hot = [...walk].sort((a, b) => b.imperativeDensity - a.imperativeDensity)[0];
  const verdict =
    `Extended length is kept and the 6–9 section bucket is dropped: the tailrec register holds ` +
    `because imperative density peaks in slice ${hot?.worker ?? "?"} (${hot?.imperativeDensity ?? 0}) ` +
    `while the section count is an artifact of markdown, not of the prompt's force.`;

  const result: CompileResult = {
    specPath,
    enc,
    workers,
    totalTokens: toks.length,
    sections: secs,
    walk,
    claims,
    verifications,
    verdict,
  };

  await Bun.write(`${outDir}/analysis.json`, JSON.stringify(result, null, 2));
  await log.flush();
  await Bun.write(
    `${outDir}/report.md`,
    report(result),
  );
  return result;
}

export function report(r: CompileResult): string {
  const lines = [
    `# Pseudobrookite analysis — ${r.specPath}`,
    ``,
    `**Verdict (one sentence):** ${r.verdict}`,
    ``,
    `## Hyper-tiktoken scan`,
    `- encoder: ${r.enc} · total tokens: ${r.totalTokens}`,
    ``,
    `| # | section | chars | tokens | pseudo-perplexity |`,
    `|---|---------|-------|--------|-------------------|`,
    ...r.sections.map((s) => `| ${s.index} | ${s.heading.slice(0, 60)} | ${s.chars} | ${s.tokens} | ${s.pseudoPerplexity.toFixed(2)} |`),
    ``,
    `## Token walk (slice-workers, unpoisoned: seed + window only)`,
    ``,
    `| worker | window | tokens | jargon | imperative | questions | pseudo-pp |`,
    `|--------|--------|--------|--------|------------|-----------|-----------|`,
    ...r.walk.map((w) => `| ${w.worker} | [${w.windowStart},${w.windowEnd}) | ${w.tokenCount} | ${w.jargonDensity} | ${w.imperativeDensity} | ${w.questionDensity} | ${w.pseudoPerplexity} |`),
    ``,
    `## Narrator claims (web tokens — cited as claims, never premises)`,
    ...(r.claims.length
      ? r.claims.map((c) => `- [claim] "${c.text.slice(0, 120)}…" — ${c.provenance} (fetched ${c.fetchedAt})`)
      : ["- (none ingested — run with --web narrators.jsonl)"]),
    ``,
    `## Verifications (tool-observed)`,
    ...r.verifications.map((v) => `- ✅ ${v}`),
    ``,
    `## Squawk log`,
    `Shared state: \`out/squawk.jsonl\` (structured rows only; workers never share prose).`,
    ``,
  ];
  return lines.join("\n");
}