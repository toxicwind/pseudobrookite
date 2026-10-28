#!/usr/bin/env bun
/**
 * install-tau-surface.ts — wire the permanence surfaces into a tau/kappa root.
 *
 * Copies the extension + plugin into the config tree and registers them, so
 * the NEXT restart loads them (never hot-wires a running session — live
 * desktop experience stays intact).
 *
 * Usage:
 *   bun scripts/install-tau-surface.ts <tau-or-kappa-root> [--repos /a:/b]
 *   --repos sets PERMANENCE_REPOS (colon-separated save-as-we-go targets)
 *
 * What it does (verified paths against pens/olympus/products/tau layout):
 *   1. cp extensions/permanence-save-all.ts -> <root>/config/tau/extensions/
 *   2. cp -r plugins/pseudobrookite-permanence -> <root>/config/tau/plugins/
 *   3. Append PERMANENCE_REPOS export line to <root>/.envrc (if --repos and not present)
 *   4. Print the restart note (the extension loads on next tau/kappa start).
 */
import { copyFileSync, mkdirSync, readFileSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
if (!root || !existsSync(root)) { console.error("usage: install-tau-surface.ts <tau-or-kappa-root> [--repos /a:/b]"); process.exit(1); }
const reposIdx = process.argv.indexOf("--repos");
const repos = reposIdx > 0 ? process.argv[reposIdx + 1] : "";
const here = new URL(".", import.meta.url).pathname;

const extDir = join(root, "config", "tau", "extensions");
const plugDir = join(root, "config", "tau", "plugins", "pseudobrookite-permanence");
mkdirSync(extDir, { recursive: true });
mkdirSync(plugDir, { recursive: true });

copyFileSync(join(here, "../extensions/permanence-save-all.ts"), join(extDir, "permanence-save-all.ts"));
copyFileSync(join(here, "../plugins/pseudobrookite-permanence/index.ts"), join(plugDir, "index.ts"));
console.log(`installed: ${join(extDir, "permanence-save-all.ts")}`);
console.log(`installed: ${join(plugDir, "index.ts")}`);

if (repos) {
  const envrc = join(root, ".envrc");
  const line = `export PERMANENCE_REPOS="${repos}"`;
  if (existsSync(envrc) && readFileSync(envrc, "utf8").includes("PERMANENCE_REPOS")) {
    console.log(`.envrc already carries PERMANENCE_REPOS — left untouched`);
  } else {
    appendFileSync(envrc, `\n# pseudobrookite permanence (save-as-we-go targets)\n${line}\n`);
    console.log(`env: ${line}`);
  }
}
console.log(`NOTE: loads on next tau/kappa restart (never hot-wire a live session).`);