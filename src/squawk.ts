/**
 * squawk.ts — the ONLY shared state between slice-workers (pseudo-subagents).
 *
 * Structured, append-only JSONL. Rows carry `worker`, `seq`, `kind`,
 * and claims must carry `provenance` + `verified: "claim"`. Synthesis is a
 * deterministic reduce over this log — workers never share prose, so they
 * never share style or inherit each other's poisoning.
 */
export type RowKind = "observation" | "claim" | "error" | "system";

export interface SquawkRow {
  worker: string;
  seq: number;
  ts: string;
  kind: RowKind;
  payload: unknown;
  provenance?: string;
  verified?: "claim" | "verified";
}

export class SquawkLog {
  #rows: SquawkRow[] = [];
  #seq = 0;

  constructor(private readonly path: string) {}

  add(partial: Omit<SquawkRow, "seq" | "ts">): number {
    const row: SquawkRow = { ...partial, seq: this.#seq++, ts: new Date().toISOString() };
    this.#rows.push(row);
    return row.seq;
  }

  claim(worker: string, text: string, provenance: string): number {
    if (!provenance || !provenance.trim()) {
      throw new Error(`claim without provenance is forbidden (worker ${worker})`);
    }
    return this.add({ worker, kind: "claim", payload: { text }, provenance, verified: "claim" });
  }

  observation(worker: string, payload: unknown): number {
    return this.add({ worker, kind: "observation", payload });
  }

  error(worker: string, message: string): number {
    return this.add({ worker, kind: "error", payload: { message } });
  }

  system(worker: string, message: string): number {
    return this.add({ worker, kind: "system", payload: { message } });
  }

  rows(): SquawkRow[] {
    return [...this.#rows]; // deterministic: insertion order IS seq order
  }

  claims(): SquawkRow[] {
    return this.#rows.filter((r) => r.kind === "claim");
  }

  async flush(): Promise<void> {
    await Bun.write(this.path, this.#rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  }
}