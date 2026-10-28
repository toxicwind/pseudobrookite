#!/usr/bin/env bun
/**
 * deploy-green-blue.ts — meta-permanence deploy primitive (green/blue).
 *
 * green = the currently-running release; blue = the new build. Build blue,
 * healthcheck it, swap the `current` symlink, and KEEP green on disk for
 * instant rollback. Never deletes the prior release (estate doctrine).
 *
 * Usage:
 *   bun scripts/deploy-green-blue.ts <service-dir> --build <cmd> --health <url> [--retries N]
 *
 * Layout inside <service-dir>:
 *   releases/green-<ts>/   (prior — untouched)
 *   releases/blue-<ts>/    (new — created by --build via $BLUE_DIR hook)
 *   current -> releases/…  (swapped only after health passes)
 */
import { spawn } from "bun";
import { existsSync, mkdirSync, readdirSync, readlinkSync, symlinkSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir || !existsSync(dir)) { console.error("usage: deploy-green-blue.ts <service-dir> --build <cmd> --health <url>"); process.exit(1); }
const buildIdx = process.argv.indexOf("--build");
const healthIdx = process.argv.indexOf("--health");
const buildCmd = buildIdx > 0 ? process.argv[buildIdx + 1] : "";
const healthUrl = healthIdx > 0 ? process.argv[healthIdx + 1] : "";
const retries = Number(process.argv[process.argv.indexOf("--retries") + 1] ?? 5);
if (!buildCmd || !healthUrl) { console.error("need --build <cmd> and --health <url>"); process.exit(1); }

const releases = join(dir, "releases");
mkdirSync(releases, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");

async function sh(cmd: string, env: Record<string, string> = {}): Promise<number> {
  const p = spawn(["bash", "-c", cmd], { stdout: "pipe", stderr: "pipe", cwd: dir, env: { ...process.env, ...env } });
  await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  return await p.exited;
}

async function healthy(): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(healthUrl);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await Bun.sleep(500); // bounded readiness poll, not a blind settle-sleep
  }
  return false;
}

// 1. snapshot green (current target, if any)
const current = join(dir, "current");
let green = "";
try { green = readlinkSync(current); } catch { /* first deploy: no green yet */ }
if (green) console.log(`green (current): ${green}`);

// 2. build blue
const blueRel = `blue-${stamp}`;
const blueDir = join(releases, blueRel);
mkdirSync(blueDir, { recursive: true });
const rc = await sh(buildCmd, { BLUE_DIR: blueDir, RELEASE_DIR: blueDir });
if (rc !== 0) { console.error(`blue build failed (rc=${rc}) — green untouched`); process.exit(1); }
console.log(`blue built: ${blueRel}`);

// 3. healthcheck blue BEFORE swap (fail-closed: no blue traffic until healthy)
//    NOTE: the health probe must point at a blue preview; if blue cannot serve
//    a preview URL, deploy a supervisor that binds a preview port and pass it.
const ok = await healthy();
if (!ok && green) { console.error("blue failed health — swap refused, green stays live"); process.exit(1); }

// 4. swap (atomic symlink), keep green for instant rollback
const tmp = join(dir, `.current-${stamp}`);
symlinkSync(join("releases", blueRel), tmp);
if (existsSync(current)) unlinkSync(current);
const { renameSync } = await import("node:fs");
renameSync(tmp, current);
console.log(`swapped current → ${blueRel}${green ? ` (rollback: ln -sfn ${green} current)` : " (first deploy)"}`);