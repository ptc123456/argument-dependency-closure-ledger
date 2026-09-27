import { beforeEach, describe, expect, it } from "vitest";
import { listPending, reservePending, updatePending } from "../src/pending";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

let tail = Promise.resolve();
const locks = {
  request: <T>(_name: string, _options: object, callback: () => T | Promise<T>) => {
    const next = tail.then(callback);
    tail = next.then(() => undefined, () => undefined);
    return next;
  }
};

const input = (caseId: string) => ({
  fingerprint: `put:${caseId}`, chain: "studio-dev", contract: "0xabc", caseId,
  account: "0xdef", method: "put_replies", args: [caseId], preRevision: "2"
});

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", { value: new MemoryStorage(), configurable: true });
  Object.defineProperty(globalThis, "navigator", { value: { locks }, configurable: true });
  tail = Promise.resolve();
});

describe("durable pending journal", () => {
  it("serializes competing reservations for the same case", async () => {
    const results = await Promise.allSettled([reservePending(input("1")), reservePending(input("1"))]);
    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(listPending()).toHaveLength(1);
  });

  it("recovers orphan records and rebuilds the index under the lock", async () => {
    const orphan = { ...input("orphan"), key: "00112233445566778899aabbccddeeff", createdAt: "2026-01-01T00:00:00.000Z", state: "FAILED" };
    localStorage.setItem(`adcl.pending.v1:${orphan.key}`, JSON.stringify(orphan));
    await reservePending(input("2"));
    expect(listPending()).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem("adcl.pending.v1:index") || "[]")).toContain(orphan.key);
  });

  it("enforces immutable hashes and the 32-record capacity", async () => {
    for (let i = 0; i < 32; i += 1) {
      const record = await reservePending(input(String(i)));
      await updatePending(record.key, { state: "FAILED", hash: `0x${i.toString(16).padStart(64, "0")}` });
    }
    const first = listPending()[0];
    await expect(updatePending(first.key, { hash: `0x${"f".repeat(64)}` })).rejects.toThrow("immutable");
    await expect(reservePending(input("33"))).rejects.toThrow("capacity");
  });
});
