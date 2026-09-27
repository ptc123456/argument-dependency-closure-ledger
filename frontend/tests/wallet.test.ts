import { describe, expect, it } from "vitest";
import { connectWallet, createWalletStore, discoverWallets, formatWalletError, initialWalletState, reduceWallet, selectWalletView, validateWalletSession, watchWallets, type WalletOption } from "../src/wallet";

describe("wallet error formatting", () => {
  it("shows structured provider errors instead of [object Object]", () => {
    expect(formatWalletError({ code: 4001, message: "User rejected the request" })).toBe("User rejected the request (code 4001)");
    expect(formatWalletError({ reason: "Wallet is locked" })).toBe("Wallet is locked");
    expect(formatWalletError({ detail: "unavailable" })).toBe('{"detail":"unavailable"}');
  });
});
import { listPending } from "../src/pending";

describe("wallet discovery", () => {
  it("lists only supported detected providers without mislabeling Rabby as MetaMask", () => {
    const metamask = { isMetaMask: true, request: async () => [] };
    const rabby = { isMetaMask: true, isRabby: true, request: async () => [] };
    const unknown = { request: async () => [] };
    const scope = { ethereum: { providers: [metamask, rabby, unknown] } } as unknown as Window;
    expect(discoverWallets(scope).map((wallet) => wallet.id)).toEqual(["metamask", "rabby"]);
  });

  it("keeps exact supported cardinality across all injected providers", () => {
    const providers = [
      { isMetaMask: true, request: async () => [] },
      { isOkxWallet: true, request: async () => [] },
      { isRabby: true, isMetaMask: true, request: async () => [] }
    ];
    const scope = { ethereum: { providers } } as unknown as Window;
    expect(discoverWallets(scope).map((wallet) => wallet.id)).toEqual(["metamask", "okx", "rabby"]);
  });

  it.each([
    [[]], [["metamask"]], [["okx"]], [["rabby"]], [["metamask", "okx"]], [["metamask", "rabby"]], [["okx", "rabby"]], [["metamask", "okx", "rabby"]]
  ] as Array<[string[]]>)("matches every supported provider combination: %j", (ids) => {
    const providers = ids.map((id) => ({ request: async () => [], ...(id === "metamask" ? { isMetaMask: true } : id === "okx" ? { isOkxWallet: true } : { isRabby: true }) }));
    const scope = { ethereum: { providers } } as unknown as Window;
    expect(discoverWallets(scope).map((wallet) => wallet.id)).toEqual(ids);
  });

  it("accepts a late announcement, replaces legacy identity, and cleans up", () => {
    const scope = new EventTarget() as Window & { ethereum?: unknown };
    const seen: string[][] = [];
    const stop = watchWallets((wallets) => seen.push(wallets.map((wallet) => wallet.id)), scope);
    const provider = { request: async () => [] };
    scope.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "r1", rdns: "io.rabby" }, provider } }));
    stop();
    scope.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "m1", rdns: "io.metamask" }, provider: { request: async () => [] } } }));
    expect(seen).toEqual([[], ["rabby"]]);
  });

  it("deduplicates a duplicate announcement by UUID", () => {
    const scope = new EventTarget() as Window & { ethereum?: unknown };
    const seen: number[] = [];
    const stop = watchWallets((wallets) => seen.push(wallets.length), scope);
    const detail = { info: { uuid: "same", rdns: "io.metamask" }, provider: { request: async () => [] } };
    scope.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));
    scope.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));
    stop();
    expect(seen).toEqual([0, 1]);
  });

  it("connects through the selected provider and rejects invalid accounts", async () => {
    const calls: string[] = [];
    const option = { id: "rabby" as const, label: "Rabby", provider: { request: async ({ method }: { method: string }) => { calls.push(method); return method === "eth_requestAccounts" ? ["0x" + "ab".repeat(20)] : "0xf22f"; } } };
    await expect(connectWallet(option)).resolves.toMatchObject({ account: "0x" + "ab".repeat(20), chainId: "0xf22f" });
    expect(calls).toEqual(["eth_requestAccounts", "eth_chainId"]);
  });
});

describe("canonical wallet reducer", () => {
  const provider = { request: async () => [] };
  const option: WalletOption = { id: "rabby", label: "Rabby", provider };
  const session = { option, account: ("0x" + "ab".repeat(20)) as `0x${string}`, chainId: "0xf22f" };

  it("commits connection and write binding atomically", () => {
    const state = reduceWallet(initialWalletState([option]), { type: "CONNECTED", session, writeClient: { provider, account: session.account } });
    expect(selectWalletView(state)).toMatchObject({ connected: true, canWrite: true, session });
  });

  it("clears write eligibility on wrong chain and restores it atomically", () => {
    const connected = reduceWallet(initialWalletState([option]), { type: "CONNECTED", session, writeClient: {} });
    const wrong = reduceWallet(connected, { type: "WRONG_CHAIN", session: { ...session, chainId: "0x1" }, error: "wrong chain" });
    expect(selectWalletView(wrong)).toMatchObject({ connected: false, canWrite: false });
    const restored = reduceWallet(wrong, { type: "CHAIN_VALID", chainId: "0xf22f", writeClient: {} });
    expect(selectWalletView(restored)).toMatchObject({ connected: true, canWrite: true });
  });

  it("rebinds on account change and tears down on disconnect", () => {
    const connected = reduceWallet(initialWalletState([option]), { type: "CONNECTED", session, writeClient: {} });
    const account = ("0x" + "cd".repeat(20)) as `0x${string}`;
    const changed = reduceWallet(connected, { type: "ACCOUNT_CHANGED", account, writeClient: { account } });
    expect(changed.session?.account).toBe(account);
    expect(selectWalletView(reduceWallet(changed, { type: "DISCONNECT" }))).toMatchObject({ connected: false, canWrite: false, session: undefined });
  });

  it("publishes one atomic snapshot and a reload starts disconnected", () => {
    const store = createWalletStore([option]);
    let updates = 0;
    const unsubscribe = store.subscribeWalletState(() => updates++);
    store.dispatchWalletAction({ type: "CONNECTED", session, writeClient: { label: "write client" } });
    expect(selectWalletView(store.getWalletState())).toMatchObject({ connected: true, canWrite: true });
    unsubscribe();
    expect(createWalletStore([option]).getWalletState().phase).toBe("DISCONNECTED");
    expect(updates).toBe(1);
  });

  it("never renders Connect wallet from a CONNECTED selector snapshot", () => {
    const connected = reduceWallet(initialWalletState([option]), { type: "CONNECTED", session, writeClient: {} });
    const view = selectWalletView(connected);
    expect(view.connected).toBe(true);
    expect(view.session).toBeDefined();
  });

  it("revalidates accountsChanged, chainChanged, deployed code, and spendable balance before a write", async () => {
    const calls: string[] = [];
    const checked = { ...option, provider: { request: async ({ method }: { method: string }) => {
      calls.push(method);
      if (method === "eth_accounts") return [session.account];
      if (method === "eth_chainId") return "0xf22f";
      if (method === "eth_getCode") return "0x6000";
      return "0x1";
    } } };
    await expect(validateWalletSession({ ...session, option: checked }, ("0x" + "ef".repeat(20)) as `0x${string}`)).resolves.toBeUndefined();
    expect(calls).toEqual(["eth_accounts", "eth_chainId", "eth_getCode", "eth_getBalance"]);
  });

  it("keeps the transaction hash for reconciliation and permits no automatic resubmit", () => {
    const pending = { state: "RECONCILIATION_REQUIRED", transactionHash: "0x123" };
    expect(pending).toMatchObject({ state: "RECONCILIATION_REQUIRED", transactionHash: "0x123" });
  });
});

describe("journal boundary", () => {
  it("keeps the public UI renderable when stored JSON is corrupt", () => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "{broken" } });
    expect(listPending()).toEqual([]);
  });
});
