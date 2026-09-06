import { useEffect, useMemo, useState } from "react";
import { listCases, readCase, readCreated, readVersion, reconcile, submitWrite, type CaseRecord } from "./contract";
import { listPending, reservePending, updatePending, type PendingWrite } from "./pending";
import { connectWallet, discoverWallets, type WalletOption } from "./wallet";

const EMPTY_GRAPH = JSON.stringify({ root_id: "claim", nodes: [{ id: "claim", type: "CLAIM", text: "Decision claim" }], edges: [] }, null, 2);
const EMPTY_REPLIES = JSON.stringify({ replies: [] }, null, 2);
const short = (value: string) => value ? `${value.slice(0, 7)}…${value.slice(-5)}` : "—";

export default function App() {
  const configured = (import.meta.env.VITE_CONTRACT_ADDRESS || "") as `0x${string}`;
  const [contract, setContract] = useState(configured);
  const [wallets] = useState(() => discoverWallets());
  const [session, setSession] = useState<{ option: WalletOption; account: `0x${string}`; chainId: string }>();
  const [ids, setIds] = useState<string[]>([]); const [caseId, setCaseId] = useState("");
  const [record, setRecord] = useState<CaseRecord | null>(); const [history, setHistory] = useState<CaseRecord | null>();
  const [graph, setGraph] = useState(EMPTY_GRAPH); const [replies, setReplies] = useState(EMPTY_REPLIES);
  const [responder, setResponder] = useState(""); const [nonce, setNonce] = useState(() => crypto.randomUUID().replaceAll("-", ""));
  const [notice, setNotice] = useState("Ready — public landing makes no RPC calls.");
  const [pending, setPending] = useState<PendingWrite[]>(() => listPending());
  const validContract = /^0x[0-9a-fA-F]{40}$/.test(contract);
  const refreshJournal = () => setPending(listPending());
  const revision = record?.revision || "0";

  const availableActions = useMemo(() => {
    if (!record) return ["create_graph"];
    if (record.phase === "BASE_DRAFT") return ["replace_graph", "lock_graph"];
    if (["BASE_LOCKED", "RESPONSE_DRAFT"].includes(record.phase)) return ["put_replies"];
    if (record.phase === "RESPONSE_DRAFT") return ["freeze_replies"];
    if (record.phase === "FROZEN") return ["evaluate_closure"];
    if (record.phase === "UNRESOLVED") return ["retry_closure"];
    return [];
  }, [record]);

  async function loadCases() {
    if (!validContract) return setNotice("Enter a valid deployed contract address.");
    try { const page = await listCases(contract); setIds(page?.ids || []); setNotice("Case index loaded."); } catch (e) { setNotice(String(e)); }
  }
  async function load(id = caseId) {
    if (!validContract || !id) return;
    try { const value = await readCase(contract, id); setRecord(value); setCaseId(id); setNotice(value ? `Case ${id} loaded.` : "Case not found."); } catch (e) { setNotice(String(e)); }
  }
  async function connect(option: WalletOption) {
    try { const next = await connectWallet(option); setSession(next); setNotice(`${option.label} connected. Writes will switch to Studionet before signing.`); } catch (e) { setNotice(String(e)); }
  }
  async function write(method: string) {
    if (!session || !validContract) return setNotice("Connect a supported wallet and enter a contract address.");
    const args: unknown[] = method === "create_graph" ? [nonce, responder, graph, 0n]
      : method === "replace_graph" ? [BigInt(caseId), graph, BigInt(revision)]
      : method === "put_replies" ? [BigInt(caseId), replies, BigInt(revision)]
      : [BigInt(caseId), BigInt(revision)];
    let journal: PendingWrite | undefined;
    try {
      journal = await reservePending({ fingerprint: JSON.stringify([method, args], (_, v) => typeof v === "bigint" ? v.toString() : v), chain: "studionet", contract: contract.toLowerCase(), caseId: method === "create_graph" ? `nonce:${nonce}` : caseId, account: session.account, method, args: JSON.parse(JSON.stringify(args, (_, v) => typeof v === "bigint" ? v.toString() : v)), preRevision: revision });
      refreshJournal(); setNotice("SIGNING — approve exactly one wallet request.");
      const hash = await submitWrite(session.option.provider, session.account, contract, method, args);
      updatePending(journal.key, { state: "SUBMITTED", hash }); refreshJournal();
      setNotice(`SUBMITTED ${short(hash)} — use Reconcile; this app never resubmits automatically.`);
    } catch (e) { if (journal && !journal.hash) updatePending(journal.key, { state: "FAILED" }); refreshJournal(); setNotice(String(e)); }
  }
  async function resume(item: PendingWrite) {
    if (!item.hash) return;
    if (document.hidden) return setNotice("Polling is paused while this tab is hidden.");
    try {
      const result = await reconcile(item.hash as `0x${string}`);
      if (!result.success) { updatePending(item.key, { state: "FAILED" }); setNotice("FINALIZED with failed execution; no success claimed."); }
      else {
        const latest = item.caseId.startsWith("nonce:")
          ? await readCreated(item.contract as `0x${string}`, item.account as `0x${string}`, item.caseId.slice(6))
          : await readCase(item.contract as `0x${string}`, item.caseId);
        const verified = item.caseId.startsWith("nonce:") ? latest?.revision === "1" : !!latest && BigInt(latest.revision) > BigInt(item.preRevision);
        if (!verified) { updatePending(item.key, { state: "RECONCILE" }); setNotice("Execution finalized, but authoritative readback does not yet prove the mutation."); }
        else { updatePending(item.key, { state: "SUCCEEDED" }); setNotice("Finalized execution and authoritative readback confirmed."); setRecord(latest); if (latest) setCaseId(latest.id); }
      }
    } catch (e) { updatePending(item.key, { state: "RECONCILE" }); setNotice(`RECONCILE — ${String(e)}`); }
    refreshJournal();
  }
  useEffect(() => { setHistory(null); }, [caseId]);

  return <main>
    <header><div><p className="eyebrow">Public decision infrastructure</p><h1>Argument Dependency<br />Closure Ledger</h1></div><p className="lede">Freeze a finite argument graph, record direct responses, and derive whether every relevant objection is addressed. It evaluates closure—not truth.</p></header>
    <section className="setup"><label>Studionet contract<input value={contract} onChange={(e) => setContract(e.target.value as `0x${string}`)} placeholder="0x…" /></label><div><span>Wallet</span><div className="wallets">{wallets.length ? wallets.map((w) => <button key={w.id} onClick={() => connect(w)}>{session?.option.id === w.id ? `Connected ${short(session.account)}` : w.label}</button>) : <small>No supported wallet detected</small>}</div></div><button className="primary" onClick={loadCases}>Load public ledger</button></section>
    <p className="notice" role="status">{notice}</p>
    <div className="grid">
      <section><h2>Cases</h2><div className="case-list">{ids.map((id) => <button key={id} onClick={() => load(id)}>Case {id}</button>)}{!ids.length && <p>No index loaded yet.</p>}</div><label>Open case<input value={caseId} onChange={(e) => setCaseId(e.target.value)} inputMode="numeric" /></label><button onClick={() => load()}>Read exact state</button></section>
      <section className="record"><h2>{record ? `Case ${record.id}` : "Closure status"}</h2>{record ? <><div className="status"><strong>{record.phase}</strong><span>{record.outcome || "Awaiting outcome"}</span><span>Revision {record.revision}</span></div><pre>{JSON.stringify(record, null, 2)}</pre><div className="actions">{availableActions.filter((a) => a !== "create_graph").map((a) => <button className="primary" key={a} onClick={() => write(a)}>{a.replaceAll("_", " ")}</button>)}</div><div className="history"><input placeholder="Revision" id="history-revision" /><button onClick={async () => { const input = document.querySelector<HTMLInputElement>("#history-revision")!; setHistory(await readVersion(contract, caseId, input.value)); }}>Read immutable revision</button>{history && <pre>{JSON.stringify(history, null, 2)}</pre>}</div></> : <p>Select a case to inspect its frozen record and evidence trail.</p>}</section>
    </div>
    <div className="grid editors"><section><h2>Graph owner</h2><label>Responder address<input value={responder} onChange={(e) => setResponder(e.target.value)} placeholder="0x…" /></label><label>Replay-safe nonce<input value={nonce} onChange={(e) => setNonce(e.target.value)} /></label><textarea value={graph} onChange={(e) => setGraph(e.target.value)} /><button className="primary" onClick={() => write(record ? "replace_graph" : "create_graph")}>{record ? "Replace draft graph" : "Create graph"}</button></section><section><h2>Responder</h2><p>Reply directly to objection IDs in the frozen graph.</p><textarea value={replies} onChange={(e) => setReplies(e.target.value)} /><button className="primary" onClick={() => write("put_replies")}>Save response draft</button></section></div>
    <section><h2>Recovery journal</h2><p>Every signing attempt is reserved before wallet interaction. Pending hashes are reconciled; never resubmitted.</p>{pending.map((item) => <div className="journal" key={item.key}><code>{item.state}</code><span>{item.method} · {item.caseId} · {short(item.hash || "")}</span>{item.hash && !["SUCCEEDED", "FAILED"].includes(item.state) && <button onClick={() => resume(item)}>Reconcile once</button>}</div>)}</section>
    <footer><h2>How it works</h2><ol><li>The owner freezes a bounded claim/objection graph.</li><li>A distinct responder freezes direct replies.</li><li>GenLayer validators classify each reply; deterministic graph logic derives closure.</li></ol><p>Edges define dependency, not evidence. Unknown or unaddressed relevant objections cannot produce closure.</p></footer>
  </main>;
}
