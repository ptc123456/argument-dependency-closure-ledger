export type Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
  isMetaMask?: boolean; isRabby?: boolean; isOkxWallet?: boolean;
};
export type WalletId = "metamask" | "okx" | "rabby";
export type WalletOption = { id: WalletId; label: string; provider: Provider; uuid?: string };
export const WALLET_SESSION_STATE_MACHINE = true;
export type WalletPhase = "DISCONNECTED" | "DISCOVERING" | "CHOOSER_OPEN" | "CONNECTING" | "CONNECTED" | "WRONG_CHAIN" | "ERROR";
export type WalletSession = { option: WalletOption; account: `0x${string}`; chainId: string };
export type WalletState<TWriteClient> = {
  phase: WalletPhase;
  providers: WalletOption[];
  session?: WalletSession;
  writeClient?: TWriteClient;
  error?: string;
};
export type WalletAction<TWriteClient> =
  | { type: "DISCOVER" }
  | { type: "SET_PROVIDERS"; providers: WalletOption[] }
  | { type: "OPEN_CHOOSER" }
  | { type: "CLOSE_CHOOSER" }
  | { type: "CONNECTING"; option: WalletOption }
  | { type: "CONNECTED"; session: WalletSession; writeClient: TWriteClient }
  | { type: "WRONG_CHAIN"; session: WalletSession; error: string }
  | { type: "ACCOUNT_CHANGED"; account: `0x${string}`; writeClient: TWriteClient }
  | { type: "CHAIN_VALID"; chainId: string; writeClient: TWriteClient }
  | { type: "ERROR"; error: string }
  | { type: "DISCONNECT" };
type AnnounceEvent = CustomEvent<{ info?: { uuid?: string; name?: string; rdns?: string }; provider?: Provider }>;
const LABELS: Record<WalletId, string> = { metamask: "MetaMask", okx: "OKX Wallet", rabby: "Rabby" };
export const STUDIO_DEVNET_CHAIN_ID = "0xf22f";
export function formatWalletError(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; code?: unknown; reason?: unknown };
    const message = typeof value.message === "string" && value.message.trim() ? value.message.trim() : undefined;
    const code = typeof value.code === "string" || typeof value.code === "number" ? String(value.code) : undefined;
    if (message && code) return `${message} (code ${code})`;
    if (message) return message;
    if (typeof value.reason === "string" && value.reason.trim()) return value.reason.trim();
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") return serialized;
    } catch { /* fall through to a safe generic message */ }
  }
  return "Wallet request failed.";
}
export const initialWalletState = <TWriteClient>(providers: WalletOption[] = []): WalletState<TWriteClient> => ({ phase: "DISCONNECTED", providers });
export function reduceWallet<TWriteClient>(state: WalletState<TWriteClient>, action: WalletAction<TWriteClient>): WalletState<TWriteClient> {
  switch (action.type) {
    case "DISCOVER": return { ...state, phase: "DISCOVERING", error: undefined };
    case "SET_PROVIDERS": return { ...state, providers: action.providers };
    case "OPEN_CHOOSER": return { ...state, phase: "CHOOSER_OPEN", error: undefined };
    case "CLOSE_CHOOSER": return state.session
      ? { ...state, phase: state.session.chainId === STUDIO_DEVNET_CHAIN_ID ? "CONNECTED" : "WRONG_CHAIN" }
      : { phase: "DISCONNECTED", providers: state.providers };
    case "CONNECTING": return { phase: "CONNECTING", providers: state.providers, session: undefined, writeClient: undefined };
    case "CONNECTED": return { phase: "CONNECTED", providers: state.providers, session: action.session, writeClient: action.writeClient };
    case "WRONG_CHAIN": return { phase: "WRONG_CHAIN", providers: state.providers, session: action.session, error: action.error };
    case "ACCOUNT_CHANGED": return state.session
      ? { ...state, phase: state.session.chainId === STUDIO_DEVNET_CHAIN_ID ? "CONNECTED" : "WRONG_CHAIN", session: { ...state.session, account: action.account }, writeClient: state.session.chainId === STUDIO_DEVNET_CHAIN_ID ? action.writeClient : undefined }
      : state;
    case "CHAIN_VALID": return state.session ? { phase: "CONNECTED", providers: state.providers, session: { ...state.session, chainId: action.chainId }, writeClient: action.writeClient } : state;
    case "ERROR": return { phase: "ERROR", providers: state.providers, error: action.error };
    case "DISCONNECT": return { phase: "DISCONNECTED", providers: state.providers };
  }
}
export const selectWalletView = <TWriteClient>(state: WalletState<TWriteClient>) => ({
  chooserOpen: state.phase === "CHOOSER_OPEN" || state.phase === "CONNECTING",
  connected: state.phase === "CONNECTED",
  canWrite: state.phase === "CONNECTED" && Boolean(state.writeClient),
  session: state.session,
  providers: state.providers,
  error: state.error
});
export function createWalletStore<TWriteClient>(providers: WalletOption[] = []) {
  let state = initialWalletState<TWriteClient>(providers);
  const listeners = new Set<() => void>();
  const getWalletState = () => state;
  const subscribeWalletState = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
  const dispatchWalletAction = (action: WalletAction<TWriteClient>) => {
    state = reduceWallet(state, action);
    listeners.forEach((listener) => listener());
  };
  return { getWalletState, subscribeWalletState, dispatchWalletAction };
}
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
export async function validateWalletSession(session: WalletSession, contract: `0x${string}`) {
  const [accounts, chainId, code, balance] = await Promise.all([
    session.option.provider.request({ method: "eth_accounts" }) as Promise<string[]>,
    session.option.provider.request({ method: "eth_chainId" }) as Promise<string>,
    session.option.provider.request({ method: "eth_getCode", params: [contract, "latest"] }) as Promise<string>,
    session.option.provider.request({ method: "eth_getBalance", params: [session.account, "latest"] }) as Promise<string>
  ]);
  if (accounts?.[0]?.toLowerCase() !== session.account) throw new Error("The selected wallet account changed. Reconnect before writing.");
  if (chainId.toLowerCase() !== STUDIO_DEVNET_CHAIN_ID) throw new Error("Wrong chain: switch the selected wallet to Studio Devnet before signing.");
  if (!code || code === "0x" || code === "0x0") throw new Error("No contract is deployed at this address on Studio Devnet.");
  if (BigInt(balance || "0x0") === 0n) throw new Error("The selected account has no spendable GEN for this action.");
}
export function bindWalletSession(provider: Provider, handlers: { accounts(value: unknown): void; chain(value: unknown): void; disconnect(): void }) {
  const accounts = (value: unknown) => handlers.accounts(value), chain = (value: unknown) => handlers.chain(value), disconnect = () => handlers.disconnect();
  provider.on?.("accountsChanged", accounts); provider.on?.("chainChanged", chain); provider.on?.("disconnect", disconnect);
  return () => { provider.removeListener?.("accountsChanged", accounts); provider.removeListener?.("chainChanged", chain); provider.removeListener?.("disconnect", disconnect); };
}
