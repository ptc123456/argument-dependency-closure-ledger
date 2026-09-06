type Entry<T> = { value: T; expires: number };
type Request<T> = { key: string; cacheMs?: number; signal?: AbortSignal; call(): Promise<T> };
const transient = (error: unknown) => {
  const value = error as { status?: number; code?: number; message?: string };
  return value?.status === 429 || (value?.status != null && value.status >= 500) || /network|timeout|busy|rate/i.test(value?.message || "");
};
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class RpcGuard {
  private cache = new Map<string, Entry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();
  private generation = 0;

  request<T>({ key, cacheMs = 0, signal, call }: Request<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return this.forSubscriber(Promise.resolve(cached.value as T), signal);
    let shared = this.inflight.get(key) as Promise<T> | undefined;
    if (!shared) {
      const generation = this.generation;
      shared = (async () => {
        try { return await call(); }
        catch (error) { if (!transient(error)) throw error; await wait(Math.min(500, Number((error as { retryAfterMs?: number }).retryAfterMs) || 500)); return call(); }
      })();
      this.inflight.set(key, shared);
      shared.then(
        (value) => { if (cacheMs && generation === this.generation) this.cache.set(key, { value, expires: Date.now() + cacheMs }); this.inflight.delete(key); },
        () => this.inflight.delete(key)
      );
    }
    return this.forSubscriber(shared, signal);
  }

  invalidate(predicate: (key: string) => boolean = () => true) {
    this.generation += 1;
    for (const key of this.cache.keys()) if (predicate(key)) this.cache.delete(key);
  }

  private forSubscriber<T>(shared: Promise<T>, signal?: AbortSignal) {
    if (!signal) return shared;
    if (signal.aborted) return Promise.reject(signal.reason || new Error("aborted"));
    return new Promise<T>((resolve, reject) => {
      const abort = () => reject(signal.reason || new Error("aborted"));
      signal.addEventListener("abort", abort, { once: true });
      shared.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    });
  }
}

export const rpc = new RpcGuard();
