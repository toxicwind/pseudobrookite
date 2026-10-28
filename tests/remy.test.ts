import { describe, expect, test } from "bun:test";
import { remy } from "../src/remy.ts";
import { mkdirSync } from "node:fs";

test("remy: workers get seed+window only, rows land in per-task squawk logs", async () => {
  const dir = `/tmp/pb-remy-${Date.now()}`;
  mkdirSync(dir, { recursive: true });
  let sawWindow = false;
  const seenWindows = new Set<string>();
  const results = await remy(
    "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu".repeat(20),
    [
      {
        name: "probe",
        run: (seed, windowText) => {
          if (seed !== "remy") throw new Error("seed missing");
          sawWindow = sawWindow || windowText.length > 0;
          seenWindows.add(windowText.slice(0, 24));
          return [{ kind: "observation", payload: { len: windowText.length } }];
        },
      },
      {
        name: "claimant",
        run: (_seed, windowText) =>
          windowText.length > 0 ? [{ kind: "claim", payload: { text: "x", provenance: "test://p" } }] : [],
      },
    ],
    { workers: 3, enc: "cl100k_base", outDir: dir },
  );
  expect(results.length).toBe(2);
  expect(results[0].workers).toBe(3);
  expect(results[0].rows).toBe(3); // one observation per worker
  expect(results[1].rows).toBe(3); // one claim per worker
  expect(sawWindow).toBe(true);
  expect(seenWindows.size).toBeGreaterThan(0); // windows were non-empty and sliced
});
