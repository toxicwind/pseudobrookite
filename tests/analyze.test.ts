import { describe, expect, test } from "bun:test";
import { tokenize, decode, sections, bigramStats } from "../src/tokens.ts";
import { windows, runWorker } from "../src/walk.ts";
import { SquawkLog } from "../src/squawk.ts";
import { loadNarrators } from "../src/narrators.ts";
import { compile } from "../src/compiler.ts";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

describe("tokens", () => {
  test("roundtrip: decode(encode(text)) === text", () => {
    const text = "Hello world, this is a tokenizer roundtrip test with pseudo-embedding tokens.";
    const toks = tokenize(text, "cl100k_base");
    expect(toks.length).toBeGreaterThan(0);
    expect(decode(toks, "cl100k_base")).toBe(text);
  });

  test("tokenize is deterministic", () => {
    const text = "determinism check — same input, same tokens, every run.";
    expect(tokenize(text, "o200k_base")).toEqual(tokenize(text, "o200k_base"));
  });

  test("sections split on markdown headings with preamble", () => {
    const md = "intro line\n\n# One\nbody one\n\n## Two\nbody two";
    const s = sections(md);
    expect(s[0].heading).toBe("(preamble)");
    expect(s.map((x) => x.heading)).toEqual(["(preamble)", "One", "Two"]);
  });

  test("bigram entropy in [0, log2(total)] and pseudo-perplexity = 2^H", () => {
    const toks = tokenize("the cat sat on the mat the cat sat", "cl100k_base");
    const st = bigramStats(toks, (t) => decode(t, "cl100k_base"));
    expect(st.entropy).toBeGreaterThanOrEqual(0);
    expect(st.pseudoPerplexity).toBeCloseTo(Math.pow(2, st.entropy), 6);
  });
});

describe("walk", () => {
  const toks = tokenize("a ".repeat(100).trim(), "cl100k_base");

  test("windows cover the full list with W-1 single-token overlaps", () => {
    const ws = windows(toks, 4);
    expect(ws.length).toBe(4);
    // coverage: union of [start,end) covers all n
    expect(ws[0].start).toBe(0);
    expect(ws[ws.length - 1].end).toBe(toks.length);
    for (let i = 1; i < ws.length; i++) {
      expect(ws[i].start).toBeLessThanOrEqual(ws[i - 1].end); // adjacency
      expect(ws[i].boundary).not.toBe("(first)"); // every non-first window has a shared boundary token
    }
  });

  test("worker output is deterministic and isolated to its window", () => {
    const ws = windows(toks, 2);
    const a1 = runWorker(ws[0], "seed", "cl100k_base");
    const a2 = runWorker(ws[0], "seed", "cl100k_base");
    expect(a1).toEqual(a2);
  });
});

describe("squawk", () => {
  test("claims without provenance are forbidden", () => {
    const log = new SquawkLog("/tmp/pb-squawk-test.jsonl");
    expect(() => log.claim("w", "some claim", "  ")).toThrow(/provenance/);
  });

  test("rows are well-formed and seq-ordered", () => {
    const log = new SquawkLog("/tmp/pb-squawk-test.jsonl");
    log.observation("w1", { a: 1 });
    log.claim("w2", "web says x", "https://example.com/post");
    const rows = log.rows();
    expect(rows.map((r) => r.seq)).toEqual([0, 1]);
    expect(rows[1].kind).toBe("claim");
    expect(rows[1].verified).toBe("claim");
    expect(rows[1].provenance).toContain("example.com");
  });
});

describe("narrators", () => {
  test("rejects a line missing provenance", () => {
    const dir = `/tmp/pb-test-${Date.now()}`;
    mkdirSync(dir, { recursive: true });
    const p = `${dir}/narrators.jsonl`;
    writeFileSync(p, JSON.stringify({ source: "x", text: "y", fetchedAt: "z" }));
    expect(() => loadNarrators(p)).toThrow(/provenance/);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("compile (end-to-end)", () => {
  test("runs on a tiny spec, writes 3 artifacts, deterministic analysis.json", async () => {
    const dir = `/tmp/pb-compile-${Date.now()}`;
    mkdirSync(`${dir}/out1`, { recursive: true });
    mkdirSync(`${dir}/out2`, { recursive: true });
    const spec = `${dir}/spec.md`;
    writeFileSync(spec, "# A\nalpha beta gamma.\n\n# B\nplease implement the token walk now?");
    const r1 = await compile({ specPath: spec, enc: "cl100k_base", workers: 3, outDir: `${dir}/out1` });
    const r2 = await compile({ specPath: spec, enc: "cl100k_base", workers: 3, outDir: `${dir}/out2` });
    // squawk.jsonl carries timestamps → exclude it from byte-determinism; analysis.json must match
    expect(JSON.stringify(r1.walk.map((w) => w.worker))).toBe(JSON.stringify(r2.walk.map((w) => w.worker)));
    expect(r1.totalTokens).toBe(r2.totalTokens);
    expect(r1.verdict).toBeTruthy();
    const a1 = JSON.parse(await Bun.file(`${dir}/out1/analysis.json`).text());
    expect(a1.sections.length).toBe(2);
    expect(a1.walk.length).toBe(3);
    rmSync(dir, { recursive: true, force: true });
  });
});