import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import type { Provider } from "./wallet";
import { rpc } from "./rpc";

export type CaseRecord = { id: string; revision: string; phase: string; outcome: string; primary: string; secondary: string; base: unknown; response: unknown; result: unknown };
const readClient = createClient({ chain: studionet });
const parse = <T>(value: unknown): T | null => value === "null" ? null : JSON.parse(String(value)) as T;

export async function readCase(contract: `0x${string}`, id: string) {
  return rpc.request({ key: `studionet:${contract}:get_case:${id}`, call: async () => parse<CaseRecord>(await readClient.readContract({ address: contract, functionName: "get_case", args: [BigInt(id)] })) });
}
export async function readVersion(contract: `0x${string}`, id: string, revision: string) {
  return rpc.request({ key: `studionet:${contract}:get_version:${id}:${revision}`, cacheMs: 86_400_000, call: async () => parse<CaseRecord>(await readClient.readContract({ address: contract, functionName: "get_version", args: [BigInt(id), BigInt(revision)] })) });
}
export async function listCases(contract: `0x${string}`, start = 1n) {
  return rpc.request({ key: `studionet:${contract}:list_cases:${start}:4`, cacheMs: 5_000, call: async () => parse<{ ids: string[]; next: string }>(await readClient.readContract({ address: contract, functionName: "list_cases", args: [start, 4n] })) });
}
export async function readCreated(contract: `0x${string}`, creator: `0x${string}`, nonce: string) {
  const id = await readClient.readContract({ address: contract, functionName: "get_id_by_nonce", args: [creator, nonce] });
  if (BigInt(String(id)) === 0n) return null;
  return readVersion(contract, String(id), "1");
}
export async function submitWrite(provider: Provider, account: `0x${string}`, contract: `0x${string}`, method: string, args: unknown[]) {
  const client = createClient({ chain: studionet, account, provider: provider as never });
  await client.connect("studionet");
  const hash = await client.writeContract({ address: contract, functionName: method, args: args as never, value: 0n });
  rpc.invalidate((key) => key.includes(`:${contract}:`));
  return hash;
}
export async function reconcile(hash: `0x${string}`) {
  const receipt = await readClient.waitForTransactionReceipt({ hash: hash as never, status: TransactionStatus.FINALIZED, interval: 2_000, retries: 0 });
  return { receipt, success: receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_RETURN };
}
