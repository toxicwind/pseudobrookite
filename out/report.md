# Pseudobrookite analysis — spec/prompt-specimen-2026-10-28.md

**Verdict (one sentence):** Extended length is kept and the 6–9 section bucket is dropped: the tailrec register holds because imperative density peaks in slice slice-7 (0.069) while the section count is an artifact of markdown, not of the prompt's force.

## Hyper-tiktoken scan
- encoder: o200k_base · total tokens: 1215

| # | section | chars | tokens | pseudo-perplexity |
|---|---------|-------|--------|-------------------|
| 0 | Prompt Specimen — 2026-10-28 (verbatim capture) | 255 | 61 | 60.00 |
| 1 | The tailrec prompt (turn 0, quoted block) | 1580 | 339 | 280.58 |
| 2 | Pup Trix speculation | 353 | 94 | 79.67 |
| 3 | Operative instructions (the runnable-tail) | 1417 | 258 | 214.19 |
| 4 | The re-ask spec (10 caveats) | 721 | 211 | 194.32 |
| 5 | The runnable-tail (build directives) | 808 | 187 | 163.40 |

## Token walk (slice-workers, unpoisoned: seed + window only)

| worker | window | tokens | jargon | imperative | questions | pseudo-pp |
|--------|--------|--------|--------|------------|-----------|-----------|
| slice-0 | [0,152) | 152 | 0.0722 | 0.0412 | 0 | 141.601 |
| slice-1 | [152,304) | 153 | 0.0841 | 0.0467 | 0 | 134.079 |
| slice-2 | [304,456) | 153 | 0.0654 | 0.0467 | 0 | 140.271 |
| slice-3 | [456,608) | 153 | 0.0583 | 0.0097 | 0.0097 | 134.079 |
| slice-4 | [608,760) | 153 | 0.0169 | 0 | 0 | 135.22 |
| slice-5 | [760,912) | 153 | 0.0388 | 0.0097 | 0 | 146.555 |
| slice-6 | [912,1064) | 153 | 0.0112 | 0.0562 | 0 | 143.411 |
| slice-7 | [1064,1215) | 152 | 0.0431 | 0.069 | 0 | 138.792 |

## Narrator claims (web tokens — cited as claims, never premises)
- [claim] "Multi-agent knowledge systems can grade each narrator's integrity and precision, with weakest-link quarantine: the loop …" — https://arxiv.org/html/2607.24117v1 (Raja et al. 2026, 'Grading the Narrators: An Isnād–Rijāl Framework for Claim-Level Provenance in Multi-Agent Knowledge Systems') (fetched 2026-10-28)
- [claim] "Context poisoning, distraction, confusion, and clash patterns; context quarantine, pruning, summarization, and offloadin…" — https://github.com/yzfly/awesome-context-engineering (fetched 2026-10-28)
- [claim] "Sub-agent context isolation ('context quarantine'): clean context windows that return condensed summaries; workers recei…" — https://chierhu.medium.com/the-engineering-of-multi-agent-collaboration-systems-a-first-principles-technical-report-ca6b3556dcd3 (fetched 2026-10-28)
- [claim] "Isolate work in dedicated threads, each with its own window (Breunig's 'context quarantine').…" — https://tool.lu/skill/s/p5C (citing Breunig, 'How to Fix Context') (fetched 2026-10-28)
- [claim] "A model graded 'Unreliable Narrator' scores strongest on fluency and weakest on coverage — narrator confidence and narra…" — https://assets-eu.researchsquare.com/files/rs-10187492/ (Verifier Exploitation in NLI-Guided Iterative Refinement) (fetched 2026-10-28)

## Verifications (tool-observed)
- ✅ spec bytes=5387 (observed via Bun.file read)
- ✅ token count=1215 (o200k_base, deterministic)
- ✅ workers ran=8 of 8 requested
- ✅ claims=5 (all verified:"claim", never promoted)

## Squawk log
Shared state: `out/squawk.jsonl` (structured rows only; workers never share prose).
