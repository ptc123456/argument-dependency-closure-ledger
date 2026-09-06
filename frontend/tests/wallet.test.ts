import { describe, expect, it } from "vitest";
import { discoverWallets } from "../src/wallet";
import { listPending } from "../src/pending";

describe("wallet discovery", () => {
  it("lists only supported detected providers without mislabeling Rabby as MetaMask", () => {
    const metamask = { isMetaMask: true, request: async () => [] };
    const rabby = { isMetaMask: true, isRabby: true, request: async () => [] };
    const unknown = { request: async () => [] };
    const scope = { ethereum: { providers: [metamask, rabby, unknown] } } as unknown as Window;
    expect(discoverWallets(scope).map((wallet) => wallet.id)).toEqual(["metamask", "rabby"]);
  });
});

describe("journal boundary", () => {
  it("keeps the public UI renderable when stored JSON is corrupt", () => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "{broken" } });
    expect(listPending()).toEqual([]);
  });
});
