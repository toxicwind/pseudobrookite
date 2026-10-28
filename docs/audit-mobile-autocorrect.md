# Audit — tau mobile-autocorrect extension ("omp-mobile-autocorrect")

**Date:** 2026-10-28 · **Auditor:** tau (selfhosted estate) · **Status:** findings only (goal focus was SAVE ALL; this is the requested "maybe audit" — fix candidates listed, not yet applied)

Source audited: `pens/olympus/products/tau/config/tau/extensions/mobile-autocorrect.ts`
(plugin copy: `pens/olympus/products/tau/tau-marketplace/plugins/omp-mobile-autocorrect/index.ts`)

## Why it "sucks" on the phone (verified against the code, 2026-10-28)

The architect's phone-typed messages (this session included — `plewse`, `theh`,
`sre`, `kehboard`, `brwnches`, `fscing`, `autonompjs`, `ypu`, `intersct`) were
NOT corrected. Root causes, in order of impact:

1. **Lexicon does not know the estate.** `VOCABULARY`/`PROTECTED_DEV_TERMS` is a
   build-tool lexicon (`md, ts, git, commit, merge…`). Estate words the user
   types daily are absent — `pens`, `geode`, `yote`, `kairos`, `thresher`,
   `mimetite`, `rhodochrosite`, `pseudobrookite`, `tailrec`, `squawk`,
   `pitchfork`, `mise`, `kappa`, `sigma`, `flotilla`, `nftables`, `aws`… With no
   dictionary hit and no valid-word entry, the spatial matcher tries to
   "correct" them into dictionary words — e.g. `yote → note` (Qwerty distance
   0.25) — mangling real identifiers in prose.
2. **OOV words in the user's actual register get rewritten, not kept.** The
   user's own vocabulary (estate terms, `lol`, `uhh`, `im`) is not in
   `VALID_WORDS`, so harmless slips in *their* register still mutate.
3. **Single pass, no learning.** Dictionary is static (cracklib + embedded);
   corrections are invisible (`{text: correctedText}` replacement) with no
   undo, so a bad correction corrupts the prompt silently — the unreliable
   narrator in the input path.
4. **Hardcoded "Termux" status label** and no per-token confidence display.
5. **`rawInput.length < 5` bypass** defeats short phone messages ("fix yote" is
   < 5 chars) — exactly the short-form phone register the extension exists for.

## Fix candidates (unapplied — documented for a follow-up todo)

- A. Merge an estate lexicon source of truth (`pens/geode/products/pseudobrookite/spec/` registers; `mimetite` provider/model names; `pitchfork.toml` daemon ids; `~/.tau` tool names) into `VALID_WORDS` at load time.
- B. Protect-by-pattern: any token that exists in a live estate surface (path, daemon id, model tag, env key) must be PROTECTED_CODE, never corrected.
- C. Replace silent `{text}` replacement with annotated corrections (list in the status line; keep original in metadata) so a bad correction is reversible.
- D. Drop/raise the 5-char bypass for prose-only messages; keep it for CLI-looking input.
- E. Test corpus: replay this session's phone typos through `autocorrectText` and assert `yote`/`kairos`/`pens` survive.

## Contract

- Probe: `bun -e "import {autocorrectText} from '...'; console.log(autocorrectText('fix yote and theh brwnches'))"` — today yields `yote→note`-class corruption; after fix it must keep `yote`, fix `theh`/`brwnches`.
- The fix belongs in the extension file + the marketplace plugin copy + a test.

*Provenance: findings are direct code reads + this session's live typing evidence (tool-observed).*