# Pseudobrookite — Requirements (geode product contract)

**Role:** prompt-forensics pseudocompiler. Turns any prompt (or prompt family —
including the AD(H)D stream-of-thought "tailrec" style) into a token IR, walks
that IR with isolated slice-subagents, and compiles the observations into a
structured, provenance-tagged report. Mineral: pseudobrookite (Fe₂TiO₅, the
pseudo-rutile) — the compiler that pretends to be an embedding layer and then
tells you what it actually saw.

**Language:** Bun/TypeScript (geode §9 — every geode product runs on Bun).

## 1..7 — Functional contract (condensed)

1. **Specimen ingestion.** Any UTF-8 text file (`spec/*.md`). CLI:
   `bun run analyze --spec <file> --workers <W> --enc <o200k|cl100k> --out <dir>`.
2. **Hyper-tiktoken scan.** Deterministic tokenization (cl100k_base / o200k_base);
   per-section token counts, bigram entropy, and a pseudo-perplexity estimate
   (bigram-model proxy; never labelled as model perplexity).
3. **Token walking.** The token list is split into **W contiguous windows with
   boundary overlap of exactly 1 token**. Each window is a **pseudo-subagent**:
   its whole context is the seed string + its own window (context < parent, never
   more). Workers emit only structured observations.
4. **Squawk log.** The ONLY shared state is `out/squawk.jsonl` — one JSON line
   per observation (`worker`, `seq`, `kind`, `provenance`). No prose sharing.
   Synthesis is a deterministic reduce over the log.
5. **Unreliable narrator compiled in.** Every non-observed input (web sources,
   docs, cached context, system chatter) is ingested as a **Claim** with a
   `provenance` tag and `verified: "claim"`. Claims are never silently merged
   into facts. Only tool-observed state sets `verified: "verified"`.
6. **On-demand web tokens.** `--web narrators.jsonl` ingests external tokens
   (each line `{source, text, fetchedAt}`) as claims; the compiler surfaces
   them in the report labelled narrator claims, never premises.
7. **Report.** `out/report.md` + `out/analysis.json` — section walk, register
   signals, observations, claims, and the one-sentence §9 verdict.

## 8. Success criteria (binary)

1. `bun run analyze --spec spec/prompt-specimen-2026-10-28.md --workers 8`
   exits 0 and writes `out/analysis.json`, `out/squawk.jsonl`, `out/report.md`.
2. **The analysis runs as ≥ 4 slice-workers by default. If a real subagent
   tool is available, each worker MUST run as a real subagent whose context
   is strictly less than the parent's (seed + window only, never the parent's
   summary). When no subagent tool is available, the pseudo-embedding
   slice-workers below ARE the compliant implementation — same isolation
   contract, in-process.**
3. Every squawk-log row is valid JSON carrying `worker`, `seq`, `kind` and —
   for any claim — `provenance` + `verified: "claim"`. No row may carry prose
   authored by another worker's window.
4. The token walk covers the full token list exactly once, plus W−1 boundary
   overlaps of 1 token each (assert in test).
5. Determinism: the same specimen + same encoder + same W yields a
   byte-identical `analysis.json` (assert in test).
6. No narrator claim is ever promoted to `verified` by the compiler itself;
   only observed tool state may.
7. `bun run validate` passes (typecheck + `bun test`).
8. Every requirement above 1–7 traces to a test or a verification command in
   §9.

## 9. Verification (binary, executable)

```bash
cd /home/toxic/pens/geode/products/pseudobrookite
bun run validate                          # typecheck + tests → green
bun run analyze --spec spec/prompt-specimen-2026-10-28.md --workers 8
bun -e "const j=require('./out/analysis.json'); console.log(j.verdict)"   # one-sentence verdict
grep -c '"verified":"claim"' out/squawk.jsonl    # claims exist, all tagged
git status --short                        # clean
```

## 10. Boundaries

- Read-only: never edits the specimen. Analysis artifacts land in `out/`.
- No secrets, no network writes at analysis time (web tokens are ingested from
  a file the user/agent already fetched).
- The "unreliable narrator" epistemic rule is structural (§5), not a reminder.