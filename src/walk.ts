/**
 * walk.ts — token walking with isolated slice-workers (pseudo-subagents).
 *
 * "Token walking" (estate-proprietary): an agent traverses the prompt's token
 * list by walking ADJACENT tokens, treating the list as its working memory.
 * The implementation here splits the list into W contiguous windows with a
 * 1-token boundary overlap and hands each window to a worker whose ENTIRE
 * context is (seed + window) — context < parent, never more. Workers emit
 * structured observations only; the squawk log is their only shared state.
 *
 * When a real subagent tool is available, the same isolation contract applies
 * (per REQUIREMENTS §8.2); these in-process workers are the compliant
 * pseudo-embedding fallback.
 */
import type { EncName } from "./tokens.ts";
import { bigramStats, decode } from "./tokens.ts";

export interface WalkWindow {
  worker: string;
  start: number; // inclusive token index
  end: number; // exclusive
  tokens: number[];
  boundary: string; // the shared overlap token, for adjacency continuity
}

export function windows(tokens: number[], w: number): WalkWindow[] {
  if (w < 1) throw new Error("workers must be >= 1");
  const n = tokens.length;
  if (n === 0) return [];
  const size = Math.ceil(n / w);
  const out: WalkWindow[] = [];
  for (let i = 0; i < w; i++) {
    const start = Math.min(i * size, n);
    const end = Math.min(start + size, n);
    // 1-token overlap: adopt the previous window's last token as boundary
    const overlap = start > 0 ? tokens[start - 1] : null;
    const slice = overlap !== null ? [overlap, ...tokens.slice(start, end)] : tokens.slice(start, end);
    out.push({
      worker: `slice-${i}`,
      start,
      end,
      tokens: slice,
      boundary: overlap !== null ? String(overlap) : "(first)",
    });
    if (end >= n) break;
  }
  return out;
}

export interface WorkerObservation {
  worker: string;
  windowStart: number;
  windowEnd: number;
  tokenCount: number;
  topTokens: Array<[string, number]>;
  jargonDensity: number;
  imperativeDensity: number;
  questionDensity: number;
  pseudoPerplexity: number;
}

const JARGON = new Set([
  "subagent", "embedding", "token", "compiler", "prompt", "pseudocompiler", "squawk",
  "walking", "narrator", "unpoisoned", "perplexity", "chain", "context", "meta",
  "inference", "recursive", "spawn", "merge", "branch", "commit", "skill", "plugin",
  "extension", "geode", "tau", "kappa", "pseudo", "ir", "walk", "claims", "provenance",
]);
const IMPERATIVES = new Set([
  "please", "implement", "make", "use", "treat", "facilitate", "confirm", "find",
  "convert", "add", "act", "ensure", "take", "ask", "run", "do", "write", "build",
  "create", "save", "keep", "spawn", "merge", "audit", "fix", "test", "verify",
]);

/**
 * Run one slice-worker. PURITY CONTRACT: receives ONLY its window + the seed;
 * never the parent's summary or another worker's output. Deterministic output
 * for the same (tokens, seed) — stable sorts everywhere.
 */
export function runWorker(
  window: WalkWindow,
  seed: string,
  enc: EncName,
): WorkerObservation {
  const dec = (t: number[]) => decode(t, enc);
  const words = window.tokens
    .map((t) => dec([t]).toLowerCase().trim())
    .filter((w) => /^[a-z]{2,}$/.test(w));
  const total = Math.max(1, words.length);
  const jargon = words.filter((w) => JARGON.has(w)).length / total;
  const imperative = words.filter((w) => IMPERATIVES.has(w)).length / total;
  const raw = dec(window.tokens);
  const questionDensity = (raw.match(/\?/g) ?? []).length / total;
  const { pseudoPerplexity, unigrams } = bigramStats(window.tokens, dec);
  const topTokens: Array<[string, number]> = [...unigrams.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8);
  void seed;
  return {
    worker: window.worker,
    windowStart: window.start,
    windowEnd: window.end,
    tokenCount: window.tokens.length,
    topTokens,
    jargonDensity: Number(jargon.toFixed(4)),
    imperativeDensity: Number(imperative.toFixed(4)),
    questionDensity: Number(questionDensity.toFixed(4)),
    pseudoPerplexity: Number(pseudoPerplexity.toFixed(3)),
  };
}

/** Walk the whole list: runEverySliceWorker in parallel (asynchronous on demand). */
export async function walkAll(
  tokens: number[],
  w: number,
  seed: string,
  enc: EncName,
): Promise<WorkerObservation[]> {
  const ws = windows(tokens, w);
  return Promise.all(ws.map((window) => Promise.resolve().then(() => runWorker(window, seed, enc))));
}