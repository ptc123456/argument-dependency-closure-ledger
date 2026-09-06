export type Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
  isMetaMask?: boolean; isRabby?: boolean; isOkxWallet?: boolean;
};

export type WalletOption = { id: "metamask" | "okx" | "rabby"; label: string; provider: Provider };

export function discoverWallets(scope: Window = window): WalletOption[] {
  const injected = (scope as Window & { ethereum?: Provider & { providers?: Provider[] } }).ethereum;
  const providers = injected?.providers ?? (injected ? [injected] : []);
  const choices: WalletOption[] = [];
  const add = (id: WalletOption["id"], label: string, match: (p: Provider) => boolean) => {
    const provider = providers.find(match);
    if (provider && !choices.some((choice) => choice.provider === provider)) choices.push({ id, label, provider });
  };
  add("metamask", "MetaMask", (p) => !!p.isMetaMask && !p.isRabby && !p.isOkxWallet);
  add("okx", "OKX Wallet", (p) => !!p.isOkxWallet);
  add("rabby", "Rabby", (p) => !!p.isRabby);
  return choices;
}

export async function connectWallet(option: WalletOption) {
  const accounts = await option.provider.request({ method: "eth_requestAccounts" }) as string[];
  const chainId = await option.provider.request({ method: "eth_chainId" }) as string;
  if (!accounts[0]) throw new Error("Wallet returned no account");
  return { option, account: accounts[0].toLowerCase() as `0x${string}`, chainId };
}
