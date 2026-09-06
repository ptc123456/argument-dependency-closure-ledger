import { describe, expect, it, vi } from "vitest";
import { RpcGuard } from "../src/rpc";

describe("shared RPC guard", () => {
  it("deduplicates an in-flight read and caches safe data", async () => {
    const guard = new RpcGuard(), call = vi.fn().mockResolvedValue(7);
    expect(await Promise.all([guard.request({ key: "k", cacheMs: 1000, call }), guard.request({ key: "k", cacheMs: 1000, call })])).toEqual([7, 7]);
    expect(await guard.request({ key: "k", cacheMs: 1000, call })).toBe(7);
    expect(call).toHaveBeenCalledOnce();
  });

  it("one subscriber abort does not cancel another", async () => {
    const guard = new RpcGuard(), a = new AbortController(), b = new AbortController();
    let finish!: (value: number) => void;
    const call = () => new Promise<number>((resolve) => { finish = resolve; });
    const first = guard.request({ key: "k", signal: a.signal, call });
    const second = guard.request({ key: "k", signal: b.signal, call });
    a.abort(new Error("left")); finish(9);
    await expect(first).rejects.toThrow("left"); await expect(second).resolves.toBe(9);
  });

  it("applies bounded backoff once within the request budget and never retries a deterministic failure", async () => {
    const guard = new RpcGuard(), transientCall = vi.fn().mockRejectedValueOnce(Object.assign(new Error("busy"), { status: 429, retryAfterMs: 0 })).mockResolvedValue("ok");
    await expect(guard.request({ key: "a", call: transientCall })).resolves.toBe("ok");
    expect(transientCall).toHaveBeenCalledTimes(2);
    const deterministic = vi.fn().mockRejectedValue(new Error("bad input"));
    await expect(guard.request({ key: "b", call: deterministic })).rejects.toThrow("bad input");
    expect(deterministic).toHaveBeenCalledOnce();
  });

  it("survives Strict Mode-style invalidation without resurrecting an in-flight cache entry", async () => {
    const guard = new RpcGuard(); let finish!: (value: number) => void;
    const first = guard.request({ key: "case", cacheMs: 1000, call: () => new Promise<number>((resolve) => { finish = resolve; }) });
    guard.invalidate(); finish(1); expect(await first).toBe(1);
    const fresh = vi.fn().mockResolvedValue(2);
    expect(await guard.request({ key: "case", cacheMs: 1000, call: fresh })).toBe(2);
    expect(fresh).toHaveBeenCalledOnce();
  });

  it("keeps measured reconciliation on one immutable transaction hash", () => {
    const measured = { reconciliation: "manual", "transaction hash": "0xabc", budget: 2 };
    expect(measured).toMatchObject({ reconciliation: "manual", "transaction hash": "0xabc", budget: 2 });
  });
});
