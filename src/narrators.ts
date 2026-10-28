/**
 * narrators.ts — the unreliable-narrator compiled in.
 *
 * Every non-observed input (web sources, docs, cached context, system
 * chatter) is ingested as a Claim: `verified: "claim"` + provenance. Claims
 * are never silently merged into facts; only tool-observed state is verified.
 * A web token without provenance is rejected at ingestion time.
 */
export interface Claim {
  source: string;
  fetchedAt: string;
  text: string;
  provenance: string;
  verified: "claim";
}

import { readFileSync } from "node:fs";

export function loadNarrators(path: string): Claim[] {
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const claims: Claim[] = [];
  for (const line of lines) {
    let c: Partial<Claim>;
    try {
      c = JSON.parse(line);
    } catch (e) {
      throw new Error(`narrators.jsonl: unparseable line: ${String(e)}`);
    }
    if (!c.source || !c.text || !c.provenance || !c.fetchedAt) {
      throw new Error(`narrators.jsonl: every line needs source/text/provenance/fetchedAt — got ${JSON.stringify(c).slice(0, 160)}`);
    }
    claims.push({ source: c.source, fetchedAt: c.fetchedAt, text: c.text, provenance: c.provenance, verified: "claim" });
  }
  return claims;
}

export function isVerifiedOnly(x: unknown): x is { verified: "verified" } {
  return typeof x === "object" && x !== null && (x as { verified?: string }).verified === "verified";
}