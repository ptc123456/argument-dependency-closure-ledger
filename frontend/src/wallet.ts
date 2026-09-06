export type Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
  isMetaMask?: boolean; isRabby?: boolean; isOkxWallet?: boolean;
};
export type WalletId = "metamask" | "okx" | "rabby";
export type WalletOption = { id: WalletId; label: string; provider: Provider; uuid?: string };
type AnnounceEvent = CustomEvent<{ info?: { uuid?: string; name?: string; rdns?: string }; provider?: Provider }>;
const LABELS: Record<WalletId, string> = { metamask: "MetaMask", okx: "OKX Wallet", rabby: "Rabby" };
const identify = (provider: Provider, info?: AnnounceEvent["detail"]["info"]): WalletId | null => {
  const hint = `${info?.rdns || ""} ${info?.name || ""}`.toLowerCase();
  if (provider.isRabby || hint.includes("rabby")) return "rabby";
  if (provider.isOkxWallet || hint.includes("okx")) return "okx";
  if ((provider.isMetaMask || hint.includes("metamask")) && !provider.isRabby && !provider.isOkxWallet) return "metamask";
  return null;
};
export function discoverWallets(scope: Window = window): WalletOption[] {
  const injected = (scope as Window & { ethereum?: Provider & { providers?: Provider[] } }).ethereum;
  const providers = injected?.providers ?? (injected ? [injected] : []);
  return providers.reduce<WalletOption[]>((result, provider) => {
    const id = identify(provider);
    if (id && !result.some((item) => item.id === id || item.provider === provider)) result.push({ id, label: LABELS[id], provider });
    return result;
  }, []);
}
export function watchWallets(onChange: (wallets: WalletOption[]) => void, scope: Window = window) {
  let wallets = discoverWallets(scope);
  const uuids = new Set<string>();
  const announce = (raw: Event) => {
    const { info, provider } = (raw as AnnounceEvent).detail || {};
    if (!provider || typeof provider.request !== "function" || (info?.uuid && uuids.has(info.uuid))) return;
    const id = identify(provider, info);
    if (!id) return;
    if (info?.uuid) uuids.add(info.uuid);
    wallets = [...wallets.filter((item) => item.id !== id && item.provider !== provider), { id, label: LABELS[id], provider, uuid: info?.uuid }];
    onChange(wallets);
  };
  scope.addEventListener("eip6963:announceProvider", announce);
  onChange(wallets); scope.dispatchEvent(new Event("eip6963:requestProvider"));
  return () => scope.removeEventListener("eip6963:announceProvider", announce);
}
export async function connectWallet(option: WalletOption) {
  const accounts = await option.provider.request({ method: "eth_requestAccounts" }) as string[];
  const chainId = await option.provider.request({ method: "eth_chainId" }) as string;
  if (!/^0x[0-9a-fA-F]{40}$/.test(accounts?.[0] || "")) throw new Error("Wallet returned no valid account");
  return { option, account: accounts[0].toLowerCase() as `0x${string}`, chainId: chainId.toLowerCase() };
}
export function bindWalletSession(provider: Provider, handlers: { accounts(value: unknown): void; chain(value: unknown): void; disconnect(): void }) {
  const accounts = (value: unknown) => handlers.accounts(value), chain = (value: unknown) => handlers.chain(value), disconnect = () => handlers.disconnect();
  provider.on?.("accountsChanged", accounts); provider.on?.("chainChanged", chain); provider.on?.("disconnect", disconnect);
  return () => { provider.removeListener?.("accountsChanged", accounts); provider.removeListener?.("chainChanged", chain); provider.removeListener?.("disconnect", disconnect); };
}
