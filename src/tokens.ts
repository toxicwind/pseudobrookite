/**
 * tokens.ts — hyper-tiktoken scan primitives.
 *
 * Deterministic tokenization (cl100k_base / o200k_base), per-section stats,
 * bigram entropy and a pseudo-perplexity estimate. The pseudo-perplexity is a
 * bigram-model proxy (2^H), NEVER labelled as model perplexity.
 */
import { get_encoding, type Tiktoken } from "@dqbd/tiktoken";

export type EncName = "o200k_base" | "cl100k_base";

const cache = new Map<EncName, Tiktoken>();

export function encoding(name: EncName): Tiktoken {
  let enc = cache.get(name);
  if (!enc) {
    enc = get_encoding(name);
    cache.set(name, enc);
  }
  return enc;
}

export function tokenize(text: string, name: EncName = "o200k_base"): number[] {
  return Array.from(encoding(name).encode(text));
}

export function decode(tokens: number[], name: EncName = "o200k_base"): string {
  return new TextDecoder().decode(encoding(name).decode(new Uint32Array(tokens)));
}

export interface Section {
  index: number;
  heading: string;
  body: string;
  chars: number;
  tokens: number;
}

/** Split a markdown text into heading-anchored sections (paragraphs of the intro attach to an implicit heading). */
export function sections(text: string): Section[] {
  const out: Section[] = [];
  const lines = text.split("\n");
  let heading = "(preamble)";
  let body: string[] = [];
  let index = 0;

  const push = () => {
    const bodyText = body.join("\n").trim();
    if (heading === "(preamble)" && !bodyText) return; // no phantom empty preamble
    if (heading || bodyText) {
      out.push({ index: index++, heading, body: bodyText, chars: bodyText.length, tokens: 0 });
    }
  };

  for (const line of lines) {
    const h = /^#{1,4}\s+(.*)$/.exec(line);
    if (h) {
      push();
      heading = h[1].trim();
      body = [];
    } else {
      body.push(line);
    }
  }
  push();
  return out;
}

export interface SectionStat extends Section {
  entropy: number;
  pseudoPerplexity: number;
  topTokens: Array<[string, number]>;
  topPairs: Array<[string, number]>;
}

export function bigramStats(tokens: number[], dec: (t: number[]) => string): {
  entropy: number;
  pseudoPerplexity: number;
  pairs: Map<string, number>;
  unigrams: Map<string, number>;
} {
  const pairs = new Map<string, number>();
  const unigrams = new Map<string, number>();
  for (let i = 0; i < tokens.length; i++) {
    const t = dec([tokens[i]]).toLowerCase().trim();
    if (t.length >= 2) unigrams.set(t, (unigrams.get(t) ?? 0) + 1);
    if (i < tokens.length - 1) {
      const bigram = `${dec([tokens[i]]).toLowerCase()}\u0000${dec([tokens[i + 1]]).toLowerCase()}`;
      pairs.set(bigram, (pairs.get(bigram) ?? 0) + 1);
    }
  }
  // bigram-model entropy: H = -Σ p(b|any) log2 p over pairs
  const total = [...pairs.values()].reduce((s, n) => s + n, 0);
  let entropy = 0;
  if (total > 0) {
    for (const n of pairs.values()) {
      const p = n / total;
      entropy -= p * Math.log2(p);
    }
  }
  return { entropy, pseudoPerplexity: Math.pow(2, entropy), pairs, unigrams };
}

export function sectionStats(spec: Section, name: EncName, dec: (t: number[]) => string): SectionStat {
  const toks = tokenize(spec.body, name);
  const { entropy, pseudoPerplexity, unigrams } = bigramStats(toks, dec);
  const topTokens: Array<[string, number]> = [...unigrams.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12);
  return { ...spec, tokens: toks.length, entropy, pseudoPerplexity, topTokens, topPairs: [] };
}