# Pseudobrookite

**Geode prompt-forensics pseudocompiler** — mineral: pseudobrookite (Fe₂TiO₅),
the pseudo-rutile. It pretends to be an embedding layer, then tells you what it
actually saw.

Turns any prompt (including the AD(H)D stream-of-thought "tailrec" style) into
a token IR, walks that IR with **isolated slice-subagents** (context < parent,
seed + window only), and compiles the walk into a **structured, provenance-tagged
report** through the only shared state: a squawk log.

```bash
bun install
bun run analyze --spec spec/prompt-specimen-2026-10-28.md --workers 8
cat out/report.md
```

## What it ships

| Surface | File | Purpose |
|---|---|---|
| Hyper-tiktoken scan | `src/tokens.ts` | cl100k/o200k tokenization, bigram entropy, pseudo-perplexity |
| Token walking | `src/walk.ts` | W contiguous windows, 1-token overlap, worker isolation |
| Squawk log | `src/squawk.ts` | structured JSONL shared state + deterministic reduce |
| Pseudocompiler | `src/compiler.ts` | prompt → section IR → observations → report |
| Unreliable narrator | `src/narrators.ts` | every input is a Claim with provenance; only observed state is `verified` |
| CLI | `src/index.ts` | `bun run analyze` |
| Requirements | `REQUIREMENTS.md` | §8 success criteria + §9 verification (subagent-or-pseudo-subagent enforced) |
| Save-all primitive | `scripts/save-all.ts` | branch → tmp commit → micro merge to main → push, forward-only |
| Live-audit primitive | `scripts/live-audit.ts` | audit live dir → organized folders → user-facing subtasks |
| Tau/kappa surfaces | `plugins/` + `extensions/` | save-all + audit hooks for tau and kappa |

## The epistemic rule (structural, not a reminder)

Every non-observed input — web sources, docs, cached context, system chatter —
is ingested as a **Claim** (`verified: "claim"` + provenance). Claims are never
silently merged into facts. Only tool-observed state is `verified`. See
`REQUIREMENTS.md` §5.

## Tau/kappa integration

- **extension**: `extensions/save-all.ts` (tau `ExtensionAPI` shape —
  `pi.on("input"|"context")`)
- **plugin**: `plugins/save-all/index.ts` (installs the save-all + audit
  primitives as tau/kappa-visible tools)
- Install: `bun scripts/install-tau-surface.ts <tau-or-kappa-root>` — wires the
  extension into `config/tau/extensions/` + plugin registry, then a tau restart
  loads it.

## License

Estate internal — all rights reserved. (Geode pen product; see `pens/geode/`.)