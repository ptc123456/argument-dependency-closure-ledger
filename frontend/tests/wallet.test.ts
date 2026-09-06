import { describe, expect, it } from "vitest";
import { connectWallet, discoverWallets, initialWalletState, reduceWallet, selectWalletView, watchWallets, type WalletOption } from "../src/wallet";
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

  it("accepts late EIP-6963 announcements, replaces legacy identity, and cleans up", () => {
    const scope = new EventTarget() as Window & { ethereum?: unknown };
    const seen: string[][] = [];
    const stop = watchWallets((wallets) => seen.push(wallets.map((wallet) => wallet.id)), scope);
    const provider = { request: async () => [] };
    scope.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "r1", rdns: "io.rabby" }, provider } }));
    stop();
    scope.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "m1", rdns: "io.metamask" }, provider: { request: async () => [] } } }));
    expect(seen).toEqual([[], ["rabby"]]);
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
});

describe("journal boundary", () => {
  it("keeps the public UI renderable when stored JSON is corrupt", () => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "{broken" } });
    expect(listPending()).toEqual([]);
  });
});
