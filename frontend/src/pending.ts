export type PendingState = "SIGNING" | "SUBMITTED" | "RECONCILE" | "SUCCEEDED" | "FAILED";
export type PendingWrite = {
  key: string; fingerprint: string; chain: string; contract: string; caseId: string;
  account: string; method: string; args: unknown[]; preRevision: string;
  state: PendingState; hash?: string; createdAt: string;
};

const PREFIX = "adcl.pending.v1:";
const INDEX = `${PREFIX}index`;
const LOCK = "adcl-write-journal";
const MAX_RECORDS = 32;
const terminal = (state: PendingState) => state === "SUCCEEDED" || state === "FAILED";
const recordKey = (key: string) => `${PREFIX}${key}`;

const parse = (text: string | null): PendingWrite | null => {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as PendingWrite;
    return value && typeof value.key === "string" && typeof value.state === "string" ? value : null;
  } catch { return null; }
};

function scan(): PendingWrite[] {
  const records: PendingWrite[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX) && key !== INDEX) {
      const value = parse(localStorage.getItem(key));
      if (value && recordKey(value.key) === key) records.push(value);
    }
  }
  return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function rebuildIndex(records: PendingWrite[]) {
  const encoded = JSON.stringify(records.map((record) => record.key));
  localStorage.setItem(INDEX, encoded);
  if (localStorage.getItem(INDEX) !== encoded) throw new Error("Reliable storage unavailable");
}

function saveRecord(record: PendingWrite) {
  const encoded = JSON.stringify(record);
  localStorage.setItem(recordKey(record.key), encoded);
  if (localStorage.getItem(recordKey(record.key)) !== encoded) throw new Error("Reliable storage unavailable");
}

async function exclusively<T>(work: () => T | Promise<T>): Promise<T> {
  if (typeof localStorage === "undefined" || !navigator.locks) throw new Error("Safe signing requires Web Locks and local storage");
  return navigator.locks.request(LOCK, { mode: "exclusive" }, work);
}

export function listPending() { try { return scan(); } catch { return []; } }
export function conflictFor(chain: string, contract: string, caseId: string) {
  return listPending().find((record) => record.chain === chain && record.contract === contract && record.caseId === caseId && !terminal(record.state));
}

export async function updatePending(key: string, patch: Pick<Partial<PendingWrite>, "state" | "hash">) {
  return exclusively(() => {
    const records = scan();
    const current = records.find((record) => record.key === key);
    if (!current) throw new Error("Pending write not found");
    if (patch.hash !== undefined && current.hash && patch.hash !== current.hash) throw new Error("Transaction hash is immutable");
    const next = { ...current, ...patch };
    saveRecord(next);
    rebuildIndex(records.map((record) => record.key === key ? next : record));
    return next;
  });
}

export async function removeUnsignedPending(key: string) {
  return exclusively(() => {
    const records = scan();
    const current = records.find((record) => record.key === key);
    if (!current) return;
    if (current.hash) throw new Error("Submitted transaction records cannot be removed");
    localStorage.removeItem(recordKey(key));
    rebuildIndex(records.filter((record) => record.key !== key));
  });
}

export async function reservePending(input: Omit<PendingWrite, "key" | "createdAt" | "state">) {
  return exclusively(() => {
    const records = scan();
    rebuildIndex(records);
    const conflict = records.find((record) => record.chain === input.chain && record.contract === input.contract && record.caseId === input.caseId && !terminal(record.state));
    if (conflict) throw new Error(`Resolve pending ${conflict.method} before another write`);
    if (records.length >= MAX_RECORDS) throw new Error("Transaction journal capacity reached (32 records)");
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const record: PendingWrite = { ...input, key, createdAt: new Date().toISOString(), state: "SIGNING" };
    saveRecord(record);
    rebuildIndex([...records, record]);
    return record;
  });
}
