export type PendingState = "SIGNING" | "SUBMITTED" | "RECONCILE" | "SUCCEEDED" | "FAILED";
export type PendingWrite = {
  key: string; fingerprint: string; chain: string; contract: string; caseId: string;
  account: string; method: string; args: unknown[]; preRevision: string;
  state: PendingState; hash?: string; createdAt: string;
};

const STORE = "adcl.pending.v1";
const load = (): PendingWrite[] => JSON.parse(localStorage.getItem(STORE) || "[]") as PendingWrite[];
const save = (records: PendingWrite[]) => {
  localStorage.setItem(STORE, JSON.stringify(records));
  if (localStorage.getItem(STORE) !== JSON.stringify(records)) throw new Error("Reliable storage unavailable");
};

export function listPending() { try { return load(); } catch { return []; } }
export function conflictFor(chain: string, contract: string, caseId: string) {
  return load().find((r) => r.chain === chain && r.contract === contract && r.caseId === caseId && !["SUCCEEDED", "FAILED"].includes(r.state));
}
export function updatePending(key: string, patch: Partial<PendingWrite>) {
  const records = load(); const index = records.findIndex((r) => r.key === key);
  if (index < 0) throw new Error("Pending write not found");
  records[index] = { ...records[index], ...patch }; save(records); return records[index];
}
export async function reservePending(input: Omit<PendingWrite, "key" | "createdAt" | "state">) {
  if (!navigator.locks || typeof localStorage === "undefined") throw new Error("Safe signing requires Web Locks and local storage");
  return navigator.locks.request("adcl-write-journal", { mode: "exclusive" }, async () => {
    const conflict = conflictFor(input.chain, input.contract, input.caseId);
    if (conflict) throw new Error(`Resolve pending ${conflict.method} before another write`);
    const record: PendingWrite = { ...input, key: crypto.randomUUID(), createdAt: new Date().toISOString(), state: "SIGNING" };
    const records = load(); records.push(record); save(records); return record;
  });
}
