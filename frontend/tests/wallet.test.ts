import { describe, expect, it } from "vitest";
import { connectWallet, discoverWallets, watchWallets } from "../src/wallet";
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

describe("journal boundary", () => {
  it("keeps the public UI renderable when stored JSON is corrupt", () => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "{broken" } });
    expect(listPending()).toEqual([]);
  });
});
