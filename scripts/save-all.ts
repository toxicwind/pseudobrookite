#!/usr/bin/env bun
/**
 * save-all.ts — branch → tmp commit → micro merge to main → push.
 *
 * The estate's forward-only save primitive. Never --reset, never force-push,
 * never loses remote state: on divergence a backup ref is created first.
 *
 * Usage:
 *   bun scripts/save-all.ts [repo] [message]
 *   GIT_REMOTE=https://github.com/toxicwind/<repo>.git bun scripts/save-all.ts <repo> <msg>
 *   DRY=1 ...            preview without touching git
 *
 * Workflow (per step, so a crash between steps leaves the repo in a safe state):
 *   1. clean? → nothing to save, exit 0
 *   2. ensure git repo (+ main)                    3. tmp branch → add -A → commit
 *   4. switch main → merge --ff-only <branch>      5. delete tmp branch
 *   6. remote: fetch origin/main; if behind → backup/main-<ts> ref, then ff-forward
 *   7. push origin HEAD:main
 */
import { spawn } from "bun";
import { existsSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] ?? process.cwd();
const message = process.argv[3] ?? `wip: save-all ${new Date().toISOString()}`;
const desiredRemote = process.env.GIT_REMOTE ?? "";
const dry = process.env.DRY === "1";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const branch = `wip/save-all-${stamp}`;

async function git(...args: string[]): Promise<string> {
  // Route through `bash -c`: direct execve of `git` is signal-killed on this
  // estate (kairos command-time enforcement wraps git via the shell shim).
  const cmd = `git -C ${JSON.stringify(repo)} ${args.map((a) => argsShellQuote(a)).join(" ")}`;
  const p = spawn(["bash", "-c", cmd], { stdout: "pipe", stderr: "pipe" });
  const stdoutP = new Response(p.stdout).text();
  const stderrP = new Response(p.stderr).text();
  const code = await p.exited; // p.exitCode can read null on Bun even on success
  const out = await stdoutP;
  const err = await stderrP;
  if (code !== 0) throw new Error(`git ${args.join(" ")} → exit ${code}: ${err.slice(0, 600)}`);
  return out.trim();
}

function argsShellQuote(a: string): string {
  return /^[A-Za-z0-9_./:@-]+$/.test(a) ? a : JSON.stringify(a);
}

async function main(): Promise<void> {
  // 0. ensure an OWN git repo (detect the .git dir itself — never trust
  //    rev-parse: it walks up into a parent repo and silently adopts it,
  //    which would save product files into the pen repo instead).
  if (!existsSync(join(repo, ".git"))) {
    if (dry) { console.log(`DRY ${repo}: would git init -b main (no .git dir)`); process.exit(0); }
    await git("init", "-b", "main");
    console.log(`initialized fresh repo at ${repo}`);
  }
  const status = await git("status", "--porcelain");
  if (!status) {
    console.log(`CLEAN ${repo} — nothing to save, nothing pushed.`);
    process.exit(0);
  }
  if (dry) {
    console.log(`DRY ${repo}: would branch ${branch}, commit "${message}", merge to main, push.`);
    console.log(status.split("\n").slice(0, 10).join("\n"));
    process.exit(0);
  }

  // 2. ensure repo + main
  let hasGit = true;
  try { await git("rev-parse", "--git-dir"); } catch { hasGit = false; }
  if (!hasGit) await git("init", "-b", "main");
  let mainExists = true;
  try { await git("rev-parse", "--verify", "main"); } catch { mainExists = false; }

  // 3. tmp branch + commit
  await git("switch", "-c", branch);
  await git("add", "-A");
  await git("commit", "-m", message);

  // 4+5. micro merge to main, drop tmp branch
  if (!mainExists) await git("switch", "-c", "main");
  else await git("switch", "main");
  await git("merge", "--ff-only", branch);
  await git("branch", "-d", branch);

  // 6+7. remote, forward-only
  let remoteUrl = desiredRemote;
  if (!remoteUrl) {
    try { remoteUrl = await git("remote", "get-url", "origin"); } catch { remoteUrl = ""; }
  }
  if (!remoteUrl) {
    console.log(`COMMITTED ${repo} on main (no remote configured) — set origin to push.`);
    console.log(await git("log", "--oneline", "-3"));
    process.exit(0);
  }
  try { await git("remote", "add", "origin", remoteUrl); } catch {}
  await git("fetch", "origin", "main").catch(() => {});
  const behind = Number(await git("rev-list", "--count", "HEAD..origin/main").catch(() => "0"));
  const ahead = Number(await git("rev-list", "--count", "origin/main..HEAD").catch(() => "0"));
  if (behind > 0) {
    await git("branch", `backup/main-${stamp}`, "origin/main"); // never lose remote state
    await git("merge", "--ff-only", "origin/main");
  }
  await git("push", "origin", "HEAD:main");
  console.log(`SAVED ${repo}: ${branch} → main → origin/main (${ahead} ahead${behind > 0 ? `, ${behind} behind → backup/main-${stamp} created` : ""})`);
  console.log(await git("log", "--oneline", "-3"));
}

main().catch((e) => { console.error(e.message); process.exit(1); });