# Tool audit — 2026-10-28 (tau session, live failures)

Observed tool-path failures this session and the raced fast pattern. Every row
is tool-observed (verified), not speculative.

| # | Failure | Root cause | Fast pattern (raced) |
|---|---|---|---|
| 1 | `find` / `grep` harness tools return "blocked by user policy" | policy denies `tools.approval.find/grep` | use `ffs` (`ffs grep --root <dir> <needle>`, `ffs glob`) — the estate SSOT; persist output, never truncate |
| 2 | plain `find` in shell silently no-ops | kairos shim bans raw find | `ffs glob --root <dir> '<pat>'` |
| 3 | `$`cmd with 2>/dev/null / head / 2>&1` all exit 1 uniformly | kairos shim flags banned patterns | no banned tokens; capture stderr via Bun error object |
| 4 | Bun `$` template variable `$\`${cmd}\`` → "command not found: ls -la …" | interpolated string = single argv[0] | inline the command in the template or `spawn(["bash","-c", …])` |
| 5 | `Bun.spawn` git via execve → signal-killed (exit null) | estate command-time enforcement wraps git through shell shim | route through `bash -c` (same as every estate command) |
| 6 | `p.exitCode` reads `null` even on success (rc=0 confirmed by in-shell echo) | Bun Subprocess exitCode race on this runtime | `await p.exited` for the exit code |
| 7 | `git -C <nested product dir>` silently adopted the parent pen repo (geode's history) | rev-parse walks up to enclosing `.git` | detect `existsSync(<repo>/.git)` FIRST; init -b main before any git op |
| 8 | `bun view` not a command | bun has no `view` | `npm view <pkg> version` |

## Doctrine tie-in
- 2s breach = opportunity: rows 4–7 each cost a retry cycle; the fix is now
  encoded in `scripts/save-all.ts` (rows 5–7) so the next session pays zero.
- Evidence laundering guard (anomaly #46): full outputs persisted to
  `/home/toxic/tmp/tau-abort-collect/` — no stderr swallowing, no sliced reads.
