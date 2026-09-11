import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { bindWriteClient, listCases, readCase, readCreated, readVersion, reconcile, submitWrite, type CaseRecord, type WriteClient } from "./contract";
import { listPending, removeUnsignedPending, reservePending, updatePending, type PendingWrite } from "./pending";
import { actionsForPhase } from "./workflow";
import { transactionStatusProps, type TransactionPhase } from "./transaction";
import { bindWalletSession, connectWallet, createWalletStore, discoverWallets, selectWalletView, STUDIONET_CHAIN_ID, validateWalletSession, watchWallets, type WalletOption } from "./wallet";
import { ResponseActions } from "./ResponseActions";

const SAMPLE_GRAPH = JSON.stringify(
  {
    root_id: "claim_core",
    nodes: [
      { id: "claim_core", type: "CLAIM", text: "The proposed protocol upgrade preserves validator liveness and safety." },
      { id: "obj_validator_cap", type: "OBJECTION", text: "Capping validator active sets reduces geographic decentralization." },
      { id: "obj_latency_spike", type: "OBJECTION", text: "Multi-round consensus increases round-trip finality latency under partition." }
    ],
    edges: [
      { from: "obj_validator_cap", to: "claim_core", type: "ATTACKS" },
      { from: "obj_latency_spike", to: "claim_core", type: "ATTACKS" }
    ]
  },
  null,
  2
);

const SAMPLE_REPLIES = JSON.stringify(
  {
    replies: [
      {
        target: "obj_validator_cap",
        text: "The rotation schedule rotates active slots across geographic regions every epoch, preserving topological diversity."
      },
      {
        target: "obj_latency_spike",
        text: "The fast-path fallback activates within 1 round during partitions, bounding recovery delay to under 2 seconds."
      }
    ]
  },
  null,
  2
);
const EMPTY_GRAPH = JSON.stringify({ root_id: "claim", nodes: [{ id: "claim", type: "CLAIM", text: "Decision claim" }], edges: [] }, null, 2);
const EMPTY_REPLIES = JSON.stringify({ replies: [] }, null, 2);

const short = (value: string) => (value ? `${value.slice(0, 7)}…${value.slice(-5)}` : "—");

// Lightweight local brand mark: dependency nodes converging onto a bounded root closure
function BrandMark({ className = "brand-mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Outer bounding envelope representing the finite graph boundary */}
      <circle cx="18" cy="18" r="16.5" stroke="var(--color-rule-strong)" strokeWidth="1" strokeDasharray="3 3" />
      {/* Closed root boundary ring */}
      <circle cx="18" cy="18" r="7.5" stroke="var(--color-accent)" strokeWidth="1.5" />
      {/* Central root claim node */}
      <circle cx="18" cy="18" r="3.5" fill="var(--color-accent)" />
      {/* Directed dependency connection lines converging to root boundary */}
      <line x1="9" y1="9" x2="13" y2="13" stroke="var(--color-ink-muted)" strokeWidth="1.2" strokeLinecap="round" />
      <polygon points="14,14 11,13.2 12.8,11" fill="var(--color-accent)" />
      <line x1="9" y1="27" x2="13" y2="23" stroke="var(--color-ink-muted)" strokeWidth="1.2" strokeLinecap="round" />
      <polygon points="14,22 12.8,25 11,22.8" fill="var(--color-accent)" />
      <line x1="28" y1="18" x2="24" y2="18" stroke="var(--color-ink-muted)" strokeWidth="1.2" strokeLinecap="round" />
      <polygon points="23,18 25.5,16.5 25.5,19.5" fill="var(--color-accent)" />
      {/* Dependency nodes */}
      <circle cx="8" cy="8" r="3" fill="var(--color-paper-elevated)" stroke="var(--color-ink-muted)" strokeWidth="1.2" />
      <circle cx="8" cy="28" r="3" fill="var(--color-paper-elevated)" stroke="var(--color-amber)" strokeWidth="1.2" />
      <circle cx="28" cy="18" r="3" fill="var(--color-paper-elevated)" stroke="var(--color-ink-muted)" strokeWidth="1.2" />
    </svg>
  );
}

function WalletIcon({ id }: { id: "metamask" | "okx" | "rabby" }) {
  if (id === "metamask") {
    return (
      <svg className="wallet-brand-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M21.5 2L13 8.5L14.5 4.5L21.5 2Z" fill="#E2761B" stroke="#E2761B" strokeLinejoin="round" />
        <path d="M2.5 2L10.8 8.6L9.5 4.5L2.5 2Z" fill="#E2761B" stroke="#E2761B" strokeLinejoin="round" />
        <path d="M18.8 17.5L16.2 21.5L21.2 22.9L22.5 17.3L18.8 17.5Z" fill="#E2761B" stroke="#E2761B" strokeLinejoin="round" />
        <path d="M1.5 17.3L2.8 22.9L7.8 21.5L5.2 17.5L1.5 17.3Z" fill="#E2761B" stroke="#E2761B" strokeLinejoin="round" />
        <path d="M7.4 10.8L6.2 12.6L11.1 12.8L11 7.8L7.4 10.8Z" fill="#E2761B" stroke="#E2761B" strokeLinejoin="round" />
        <path d="M16.6 10.8L13 7.7L12.9 12.8L17.8 12.6L16.6 10.8Z" fill="#E2761B" stroke="#E2761B" strokeLinejoin="round" />
        <path d="M7.8 21.5L11 19.8L8.4 17.6L7.8 21.5Z" fill="#D7C1B3" stroke="#D7C1B3" strokeLinejoin="round" />
        <path d="M16.2 21.5L15.6 17.6L13 19.8L16.2 21.5Z" fill="#D7C1B3" stroke="#D7C1B3" strokeLinejoin="round" />
        <path d="M12 13.5L8.2 13.4L6.9 15.6L12 17.8L17.1 15.6L15.8 13.4L12 13.5Z" fill="#233447" stroke="#233447" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === "okx") {
    return (
      <svg className="wallet-brand-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="4" fill="#000000" stroke="var(--color-rule-strong)" strokeWidth="1" />
        <rect x="5.5" y="5.5" width="4.5" height="4.5" fill="#FFFFFF" />
        <rect x="14" y="5.5" width="4.5" height="4.5" fill="#FFFFFF" />
        <rect x="9.75" y="9.75" width="4.5" height="4.5" fill="#FFFFFF" />
        <rect x="5.5" y="14" width="4.5" height="4.5" fill="#FFFFFF" />
        <rect x="14" y="14" width="4.5" height="4.5" fill="#FFFFFF" />
      </svg>
    );
  }
  return (
    <svg className="wallet-brand-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#4B68FF" />
      <path d="M7 15C7 11.5 9 8 12 8C15 8 17 11.5 17 15C17 17.2 15 18 12 18C9 18 7 17.2 7 15Z" fill="#FFFFFF" />
      <circle cx="10" cy="13" r="1" fill="#4B68FF" />
      <circle cx="14" cy="13" r="1" fill="#4B68FF" />
      <path d="M9 8L8 4" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15 8L16 4" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function App() {
  const configured = (import.meta.env.VITE_CONTRACT_ADDRESS || "") as `0x${string}`;
  const [contract, setContract] = useState(configured);
  const walletStore = useMemo(() => createWalletStore<WriteClient>(discoverWallets()), []);
  const walletState = useSyncExternalStore(walletStore.subscribeWalletState, walletStore.getWalletState, walletStore.getWalletState);
  const walletDispatch = walletStore.dispatchWalletAction;
  const wallet = selectWalletView(walletState);
  const [ids, setIds] = useState<string[]>([]);
  const [caseId, setCaseId] = useState("");
  const [record, setRecord] = useState<CaseRecord | null>();
  const [history, setHistory] = useState<CaseRecord | null>();
  const [historyRevInput, setHistoryRevInput] = useState("");
  const [graph, setGraph] = useState(EMPTY_GRAPH);
  const [replies, setReplies] = useState(EMPTY_REPLIES);
  const [responder, setResponder] = useState("");
  const [nonce, setNonce] = useState(() => crypto.randomUUID().replaceAll("-", ""));
  const [notice, setNotice] = useState("Ready — public landing makes no RPC calls.");
  const [pending, setPending] = useState<PendingWrite[]>(() => listPending());
  const [activeTxHash, setActiveTxHash] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"structured" | "raw">("structured");
  const [transactionPhase, setTransactionPhase] = useState<TransactionPhase>("IDLE");
  const walletTriggerRef = useRef<HTMLButtonElement>(null);
  const walletModalRef = useRef<HTMLDivElement>(null);

  const validContract = /^0x[0-9a-fA-F]{40}$/.test(contract);
  const refreshJournal = () => setPending(listPending());
  const revision = record?.revision || "0";

  const availableActions = useMemo(() => actionsForPhase(record?.phase), [record]);

  // Derive which stage of the 3-stage workflow is currently active for the loaded case
  const activeStage = useMemo(() => {
    if (!record) return 1;
    if (["BASE_DRAFT", "BASE_LOCKED"].includes(record.phase)) return 1;
    if (["RESPONSE_DRAFT", "FROZEN"].includes(record.phase)) return 2;
    return 3;
  }, [record]);

  async function loadCases() {
    if (!validContract) return setNotice("Enter a valid deployed contract address.");
    try {
      const page = await listCases(contract);
      setIds(page?.ids || []);
      setNotice("Case index loaded from Studionet.");
    } catch (e) {
      setNotice(String(e));
    }
  }

  async function load(id = caseId) {
    if (!validContract || !id) return;
    try {
      const value = await readCase(contract, id);
      setRecord(value);
      setCaseId(id);
      setNotice(value ? `Case ${id} loaded.` : "Case not found.");
    } catch (e) {
      setNotice(String(e));
    }
  }

  async function connect(option: WalletOption) {
    walletDispatch({ type: "CONNECTING", option });
    try {
      const next = await connectWallet(option);
      if (next.chainId !== STUDIONET_CHAIN_ID) {
        walletDispatch({ type: "WRONG_CHAIN", session: next, error: "Wrong chain: switch the selected wallet to Studionet before signing." });
        setNotice("Wrong chain: switch the selected wallet to Studionet before signing.");
        return;
      }
      walletDispatch({ type: "CONNECTED", session: next, writeClient: bindWriteClient(option.provider, next.account) });
      setNotice(`${option.label} connected (${short(next.account)}). Ready to sign.`);
    } catch (e) {
      walletDispatch({ type: "ERROR", error: String(e) });
      setNotice(String(e));
    }
  }

  function disconnect() {
    walletDispatch({ type: "DISCONNECT" });
    setNotice("Wallet disconnected.");
  }

  function openWalletChooser() {
    walletDispatch({ type: "DISCOVER" });
    walletDispatch({ type: "OPEN_CHOOSER" });
  }

  async function write(method: string) {
    if (!wallet.canWrite || !wallet.session || !walletState.writeClient || !validContract) return setNotice("Connect a supported wallet on Studionet and enter a contract address.");
    const session = wallet.session;
    const args: unknown[] =
      method === "create_graph"
        ? [nonce, responder, graph, 0n]
        : method === "replace_graph"
        ? [BigInt(caseId), graph, BigInt(revision)]
        : method === "put_replies"
        ? [BigInt(caseId), replies, BigInt(revision)]
        : [BigInt(caseId), BigInt(revision)];
    let journal: PendingWrite | undefined;
    let submittedHash: string | undefined;
    try {
      await validateWalletSession(session, contract);
      journal = await reservePending({
        fingerprint: JSON.stringify([method, args], (_, v) => (typeof v === "bigint" ? v.toString() : v)),
        chain: "studionet",
        contract: contract.toLowerCase(),
        caseId: method === "create_graph" ? `nonce:${nonce}` : caseId,
        account: session.account,
        method,
        args: JSON.parse(JSON.stringify(args, (_, v) => (typeof v === "bigint" ? v.toString() : v))),
        preRevision: revision
      });
      refreshJournal();
      setTransactionPhase("WAITING_FOR_WALLET");
      setNotice("SIGNING — approve exactly one wallet request.");
      const hash = await submitWrite(walletState.writeClient, contract, method, args);
      submittedHash = hash;
      setActiveTxHash(hash);
      await updatePending(journal.key, { state: "SUBMITTED", hash });
      refreshJournal();
      setTransactionPhase("WAITING_FOR_FINALITY");
      setNotice(`SUBMITTED ${short(hash)} — use Reconcile; this app never resubmits automatically.`);
    } catch (e) {
      if (journal && !submittedHash) {
        try {
          if (/reject|denied|4001/i.test(String(e))) await removeUnsignedPending(journal.key);
          else await updatePending(journal.key, { state: "RECONCILE" });
        } catch { /* signing is already blocked by unreliable storage */ }
      }
      refreshJournal();
      setTransactionPhase(submittedHash ? "RECONCILIATION_REQUIRED" : /reject|denied|4001/i.test(String(e)) ? "REJECTED" : "FAILED");
      setNotice(submittedHash ? `RECONCILIATION_REQUIRED — transaction ${short(submittedHash)} was submitted but its journal update failed. Do not resubmit.` : String(e));
    }
  }

  async function resume(item: PendingWrite) {
    if (!item.hash) return;
    if (document.hidden) return setNotice("Polling is paused while this tab is hidden.");
    try {
      setTransactionPhase("WAITING_FOR_FINALITY");
      const result = await reconcile(item.hash as `0x${string}`);
      setTransactionPhase("VERIFYING_EXECUTION");
      if (!result.success) {
        await updatePending(item.key, { state: "FAILED" });
        setTransactionPhase("FAILED");
        setNotice("FINALIZED with failed execution; no success claimed.");
      } else {
        setTransactionPhase("VERIFYING_READBACK");
        const latest = item.caseId.startsWith("nonce:")
          ? await readCreated(item.contract as `0x${string}`, item.account as `0x${string}`, item.caseId.slice(6))
          : await readCase(item.contract as `0x${string}`, item.caseId);
        const verified = item.caseId.startsWith("nonce:")
          ? latest?.revision === "1"
          : !!latest && BigInt(latest.revision) > BigInt(item.preRevision);
        if (!verified) {
          await updatePending(item.key, { state: "RECONCILE" });
          setTransactionPhase("RECONCILIATION_REQUIRED");
          setNotice("Execution finalized, but authoritative readback does not yet prove the mutation.");
        } else {
          await updatePending(item.key, { state: "SUCCEEDED" });
          setTransactionPhase("SUCCESS");
          setNotice("Finalized execution and authoritative readback confirmed.");
          setRecord(latest);
          if (latest) setCaseId(latest.id);
        }
      }
    } catch (e) {
      await updatePending(item.key, { state: "RECONCILE" });
      setTransactionPhase("RECONCILIATION_REQUIRED");
      setNotice(`RECONCILE — ${String(e)}`);
    }
    refreshJournal();
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2000);
  }

  useEffect(() => {
    setHistory(null);
    setHistoryRevInput("");
  }, [caseId]);

  useEffect(() => {
    document.title = "Argument Dependency Closure Ledger";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content = "width=device-width, initial-scale=1";
      document.head.appendChild(meta);
    }
  }, []);

  useEffect(() => watchWallets((providers) => walletDispatch({ type: "SET_PROVIDERS", providers })), []);
  useEffect(() => wallet.session ? bindWalletSession(wallet.session.option.provider, {
    accounts: (value) => {
      const account = Array.isArray(value) ? value[0] : "";
      if (!/^0x[0-9a-fA-F]{40}$/.test(account || "")) return disconnect();
      const normalized = account.toLowerCase() as `0x${string}`;
      walletDispatch({ type: "ACCOUNT_CHANGED", account: normalized, writeClient: bindWriteClient(wallet.session!.option.provider, normalized) });
    },
    chain: (value) => {
      const chainId = String(value).toLowerCase();
      if (chainId === STUDIONET_CHAIN_ID) walletDispatch({ type: "CHAIN_VALID", chainId, writeClient: bindWriteClient(wallet.session!.option.provider, wallet.session!.account) });
      else walletDispatch({ type: "WRONG_CHAIN", session: { ...wallet.session!, chainId }, error: "Wrong chain: switch the selected wallet to Studionet before signing." });
      setNotice(chainId === STUDIONET_CHAIN_ID ? "Studionet connection restored." : "Wrong chain: switch the selected wallet to Studionet before signing.");
    },
    disconnect
  }) : undefined, [wallet.session?.option.provider]);

  useEffect(() => {
    const background = [document.querySelector<HTMLElement>(".masthead"), document.querySelector<HTMLElement>(".workbench-main")].filter(Boolean) as HTMLElement[];
    background.forEach((element) => { element.inert = wallet.chooserOpen; });
    if (wallet.chooserOpen) walletModalRef.current?.querySelector<HTMLElement>("button")?.focus();
    else walletTriggerRef.current?.focus();
    return () => background.forEach((element) => { element.inert = false; });
  }, [wallet.chooserOpen]);

  // Safely parse graph and response for structured preview if valid JSON
  const parsedBase = useMemo(() => {
    if (!record?.base) return null;
    try {
      const b = typeof record.base === "string" ? JSON.parse(record.base) : record.base;
      return b as { root_id?: string; nodes?: Array<{ id: string; type: string; text: string }>; edges?: Array<{ from: string; to: string; type: string }> };
    } catch {
      return null;
    }
  }, [record]);

  const parsedResponse = useMemo(() => {
    if (!record?.response) return null;
    try {
      const r = typeof record.response === "string" ? JSON.parse(record.response) : record.response;
      return r as { replies?: Array<{ target: string; text: string }> };
    } catch {
      return null;
    }
  }, [record]);

  const parsedResult = useMemo(() => {
    if (!record?.result) return null;
    try {
      const res = typeof record.result === "string" ? JSON.parse(record.result) : record.result;
      return res as { v?: number; labels?: string[] };
    } catch {
      return null;
    }
  }, [record]);

  return (
    <div className="page-shell">
      {/* Top Masthead & Global Navigation */}
      <header className="masthead">
        <div className="masthead-brand">
          <BrandMark className="brand-mark" />
          <div className="brand-text">
            <span className="brand-title">Argument Dependency Closure Ledger</span>
            <span className="brand-badge">Studionet</span>
          </div>
        </div>

        <nav className="masthead-nav" aria-label="Task Navigation">
          <a href="#overview" className="nav-link">Overview</a>
          <a href="#workflow" className="nav-link">Workflow</a>
          <a href="#workspace" className="nav-link">Workspace</a>
          <a href="#editors" className="nav-link">Editors</a>
          <a href="#journal" className="nav-link">Journal</a>
          <a href="#how-it-works" className="nav-link">How it works</a>
        </nav>

        <div className="masthead-actions">
          {wallet.session ? (
            <div className="session-pill">
              <WalletIcon id={wallet.session.option.id} />
              <span className="session-label">{wallet.session.option.label}</span>
              <span className="session-address">{short(wallet.session.account)}</span>
              <button ref={walletTriggerRef} className="btn-disconnect" onClick={wallet.connected ? disconnect : openWalletChooser}>
                {wallet.connected ? "Disconnect" : "Switch wallet"}
              </button>
            </div>
          ) : (
            <button ref={walletTriggerRef} className="btn btn-connect" onClick={openWalletChooser}>
              Connect wallet
            </button>
          )}
        </div>
      </header>

      <main className="workbench-main">
        {/* Public Orientation & Trust Boundary */}
        <section id="overview" className="orientation-band">
          <div className="orientation-content">
            <p className="eyebrow">Public Decision Infrastructure · GenLayer Consensus</p>
            <h1 className="display-headline">
              Argument Dependency<br />Closure Ledger
            </h1>
            <p className="lede">
              Freeze a finite claim/objection graph, record direct responses, and derive whether every relevant objection is addressed.
              It evaluates structural closure—not truth.
            </p>
            <div className="trust-boundary-banner">
              <span className="trust-flag">Trust Boundary</span>
              <span className="trust-text">
                Assessment of this exact submitted material only; not verification of external facts. All submitted text will be public and permanent.
              </span>
            </div>
          </div>
        </section>

        {/* Global Setup & Network Controls */}
        <section className="setup-band" aria-label="Contract Connection and Public Read Controls">
          <div className="setup-grid">
            <div className="setup-field">
              <label htmlFor="contract-address">Studionet Contract Address</label>
              <div className="input-group">
                <input
                  id="contract-address"
                  value={contract}
                  onChange={(e) => setContract(e.target.value as `0x${string}`)}
                  placeholder="0x…"
                  spellCheck={false}
                />
                <span className={`contract-badge ${validContract ? "valid" : "invalid"}`}>
                  {validContract ? "Valid 0x" : "Incomplete"}
                </span>
              </div>
            </div>

            <div className="setup-action-cell">
              <span className="field-hint">Zero RPC calls on landing</span>
              <button className="btn btn-primary" onClick={loadCases}>
                Load public ledger
              </button>
            </div>
          </div>
        </section>

        {/* Persistent Public Notice & Transaction Progress Indicator */}
        <aside className="notice-bar" {...transactionStatusProps(transactionPhase)}>
          <div className="notice-indicator-slot">
            {["WAITING_FOR_WALLET", "SUBMITTED", "WAITING_FOR_FINALITY", "VERIFYING_EXECUTION", "VERIFYING_READBACK"].includes(transactionPhase) && <span className="spinner" aria-label={transactionPhase.replaceAll("_", " ")} />}
            {transactionPhase === "RECONCILIATION_REQUIRED" && <span className="status-glyph glyph-amber" aria-label="Reconciliation required">!</span>}
            {transactionPhase === "SUCCESS" && <span className="status-glyph glyph-mint" aria-label="Operation verified">✓</span>}
            {transactionPhase === "REJECTED" && <span className="status-glyph glyph-amber" aria-label="Wallet request rejected">!</span>}
            {transactionPhase === "FAILED" && <span className="status-glyph glyph-danger" aria-label="Operation failed">✕</span>}
            {transactionPhase === "IDLE" && <span className="status-glyph glyph-idle" aria-hidden="true">●</span>}
          </div>
          <div className="notice-text-content">
            <span className="notice-message">{notice}</span>
            {activeTxHash && (
              <span className="notice-hash-chip">
                Hash: <code>{short(activeTxHash)}</code>
                <button
                  type="button"
                  className="btn-copy-chip"
                  onClick={() => copyText(activeTxHash, "hash")}
                  title="Copy transaction hash"
                >
                  {copyFeedback === "hash" ? "Copied" : "Copy"}
                </button>
              </span>
            )}
          </div>
        </aside>

        {/* Ordinal Three-Stage Workflow Rail */}
        <section id="workflow" className="workflow-rail" aria-label="Three-Stage Ledger Sequence">
          <div className="rail-track">
            <div className={`rail-step ${activeStage === 1 ? "is-active" : activeStage > 1 ? "is-done" : ""}`}>
              <div className="step-numeral">01</div>
              <div className="step-body">
                <span className="step-role">Graph Owner</span>
                <h2 className="step-title">Define & Lock Graph</h2>
                <p className="step-desc">Specify root claim, objection nodes, and directed edges; lock base graph.</p>
                <div className="step-phases">
                  <span className="phase-pill">BASE_DRAFT</span>
                  <span className="phase-arrow">→</span>
                  <span className="phase-pill">BASE_LOCKED</span>
                </div>
              </div>
            </div>

            <div className={`rail-step ${activeStage === 2 ? "is-active" : activeStage > 2 ? "is-done" : ""}`}>
              <div className="step-numeral">02</div>
              <div className="step-body">
                <span className="step-role">Assigned Responder</span>
                <h2 className="step-title">Direct Responses</h2>
                <p className="step-desc">Target specific objection IDs with addressing replies; freeze response.</p>
                <div className="step-phases">
                  <span className="phase-pill">RESPONSE_DRAFT</span>
                  <span className="phase-arrow">→</span>
                  <span className="phase-pill">FROZEN</span>
                </div>
              </div>
            </div>

            <div className={`rail-step ${activeStage === 3 ? "is-active" : ""}`}>
              <div className="step-numeral">03</div>
              <div className="step-body">
                <span className="step-role">Public / Any Actor</span>
                <h2 className="step-title">Consensus Closure</h2>
                <p className="step-desc">Validators classify replies; contract deterministically computes closure.</p>
                <div className="step-phases">
                  <span className="phase-pill">FROZEN</span>
                  <span className="phase-arrow">→</span>
                  <span className="phase-pill">DONE / UNRESOLVED</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Asymmetric Case Workbench */}
        <section id="workspace" className="case-workspace">
          {/* Left Column: Case Index & Selection */}
          <div className="workspace-sidebar">
            <div className="panel-header">
              <h2 className="panel-title">Case Registry</h2>
              <span className="panel-count">{ids.length} loaded</span>
            </div>

            <div className="case-selector-body">
              {ids.length > 0 ? (
                <div className="case-index-list" role="list">
                  {ids.map((id) => (
                    <button
                      key={id}
                      className={`case-item-btn ${caseId === id ? "is-selected" : ""}`}
                      onClick={() => load(id)}
                    >
                      <span className="case-id-tag">Case #{id}</span>
                      <span className="case-item-arrow">→</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-case-box">
                  <p>No cases loaded yet.</p>
                  <small>Click &ldquo;Load public ledger&rdquo; or enter an explicit case ID below.</small>
                </div>
              )}

              <div className="direct-load-box">
                <label htmlFor="open-case-id">Open by Case ID</label>
                <div className="input-group">
                  <input
                    id="open-case-id"
                    value={caseId}
                    onChange={(e) => setCaseId(e.target.value)}
                    inputMode="numeric"
                    placeholder="e.g. 1"
                  />
                  <button className="btn btn-secondary" onClick={() => load()}>
                    Read exact state
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Case Record & Inspection Canvas */}
          <div className="workspace-canvas">
            {record ? (
              <div className="record-card">
                {/* Case Header Status Cluster */}
                <div className="record-header">
                  <div>
                    <span className="record-kicker">Canonical Case Record</span>
                    <h2 className="record-title">Case #{record.id}</h2>
                  </div>

                  <div className="status-cluster">
                    <div className="status-badge status-phase" title="Active Contract Phase">
                      <span className="badge-dot" />
                      {record.phase}
                    </div>
                    <div
                      className={`status-badge status-outcome ${
                        record.outcome === "CLOSED_FOR_DECISION"
                          ? "outcome-closed"
                          : record.outcome === "OPEN_OBJECTIONS"
                          ? "outcome-open"
                          : record.outcome === "GRAPH_INVALID"
                          ? "outcome-invalid"
                          : ""
                      }`}
                      title="Evaluated Outcome"
                    >
                      {record.outcome || "Awaiting Evaluation"}
                    </div>
                    <div className="status-badge status-revision" title="Committed Revision">
                      Rev {record.revision}
                    </div>
                  </div>
                </div>

                {/* Role Authority Metadata */}
                <div className="record-roles-strip">
                  <div className="role-entry">
                    <span className="role-label">Graph Owner (Primary)</span>
                    <code className="role-address">{record.primary || "—"}</code>
                  </div>
                  <div className="role-entry">
                    <span className="role-label">Responder (Secondary)</span>
                    <code className="role-address">{record.secondary || "—"}</code>
                  </div>
                </div>

                {/* Next Valid Action derived from active phase */}
                <div className="action-control-banner">
                  <div className="action-info">
                    <span className="action-tag">Next Valid Action</span>
                    <span className="action-hint">
                      {record.phase === "BASE_DRAFT" && "Graph owner can replace draft or lock the graph."}
                      {record.phase === "BASE_LOCKED" && "Assigned responder must submit direct replies."}
                      {record.phase === "RESPONSE_DRAFT" && "Responder can update or freeze direct replies."}
                      {record.phase === "FROZEN" && "Consensus evaluation ready. Anyone can trigger evaluation."}
                      {record.phase === "UNRESOLVED" && "Consensus ambiguity reached. Retry allowed after 60s cooldown."}
                      {record.phase === "DONE" && "Terminal decision recorded. State is immutable."}
                    </span>
                  </div>

                  <div className="action-buttons-row">
                    {availableActions
                      .filter((a) => a !== "create_graph")
                      .map((a) => (
                        <button key={a} className="btn btn-action" onClick={() => write(a)} disabled={!wallet.canWrite || !validContract}>
                          {a.replaceAll("_", " ")}
                        </button>
                      ))}
                  </div>
                </div>

                {/* View Mode Toggle: Structured vs Canonical JSON */}
                <div className="inspection-tabs-bar">
                  <div className="tab-buttons">
                    <button
                      className={`tab-btn ${viewMode === "structured" ? "is-active" : ""}`}
                      onClick={() => setViewMode("structured")}
                    >
                      Structured graph & replies
                    </button>
                    <button
                      className={`tab-btn ${viewMode === "raw" ? "is-active" : ""}`}
                      onClick={() => setViewMode("raw")}
                    >
                      Canonical JSON record
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost-sm"
                    onClick={() => copyText(JSON.stringify(record, null, 2), "record")}
                  >
                    {copyFeedback === "record" ? "Copied" : "Copy JSON"}
                  </button>
                </div>

                {/* Structured Inspection View */}
                {viewMode === "structured" ? (
                  <div className="structured-inspection">
                    {parsedBase ? (
                      <div className="inspection-section">
                        <h3 className="section-subtitle">Graph Definition</h3>
                        <div className="root-claim-card">
                          <span className="node-badge node-claim">ROOT CLAIM</span>
                          <span className="node-id">[{parsedBase.root_id}]</span>
                          <p className="node-text">
                            {parsedBase.nodes?.find((n) => n.id === parsedBase.root_id)?.text || "Root claim"}
                          </p>
                        </div>

                        <div className="nodes-grid">
                          <div className="nodes-column">
                            <span className="column-label">
                              Objections ({parsedBase.nodes?.filter((n) => n.type === "OBJECTION").length || 0})
                            </span>
                            {parsedBase.nodes
                              ?.filter((n) => n.type === "OBJECTION")
                              .map((obj) => {
                                const matchingReply = parsedResponse?.replies?.find((r) => r.target === obj.id);
                                return (
                                  <div key={obj.id} className="objection-card">
                                    <div className="objection-head">
                                      <span className="node-badge node-objection">OBJECTION</span>
                                      <span className="node-id">[{obj.id}]</span>
                                    </div>
                                    <p className="node-text">{obj.text}</p>
                                    <div className="reply-match-strip">
                                      <span className="reply-status-label">
                                        Direct Reply: {matchingReply ? "Supplied" : "Missing"}
                                      </span>
                                      {matchingReply && <p className="reply-text-preview">&ldquo;{matchingReply.text}&rdquo;</p>}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>

                          <div className="nodes-column">
                            <span className="column-label">Directed Edges ({parsedBase.edges?.length || 0})</span>
                            <div className="edges-list">
                              {parsedBase.edges && parsedBase.edges.length > 0 ? (
                                parsedBase.edges.map((e, idx) => (
                                  <div key={idx} className="edge-chip">
                                    <code>{e.from}</code>
                                    <span className={`edge-relation edge-${e.type?.toLowerCase()}`}>
                                      —{e.type}→
                                    </span>
                                    <code>{e.to}</code>
                                  </div>
                                ))
                              ) : (
                                <p className="empty-subtext">No edges defined.</p>
                              )}
                            </div>

                            {parsedResult && parsedResult.labels && (
                              <div className="labels-card">
                                <span className="column-label">Consensus Verdict Labels</span>
                                <div className="labels-row">
                                  {parsedResult.labels.map((lbl, idx) => (
                                    <span key={idx} className={`label-chip label-${lbl.toLowerCase()}`}>
                                      {lbl}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="empty-subtext">Base graph not yet populated.</p>
                    )}
                  </div>
                ) : (
                  /* Raw Canonical JSON Well */
                  <pre className="canonical-well">{JSON.stringify(record, null, 2)}</pre>
                )}

                {/* Immutable Historical Revision Lookup */}
                <div className="history-inspection-band">
                  <div className="history-header">
                    <div>
                      <h3 className="section-subtitle">Immutable Revision History</h3>
                      <p className="section-caption">
                        Every committed transition produces a permanent historical snapshot verified on-chain.
                      </p>
                    </div>
                  </div>

                  <div className="history-form">
                    <div className="input-group">
                      <input
                        id="history-revision"
                        value={historyRevInput}
                        onChange={(e) => setHistoryRevInput(e.target.value)}
                        placeholder={`Revision (1..${record.revision})`}
                        inputMode="numeric"
                      />
                      <button
                        className="btn btn-secondary"
                        onClick={async () => {
                          const rev = historyRevInput.trim();
                          if (!rev) return;
                          try {
                            const val = await readVersion(contract, caseId, rev);
                            setHistory(val);
                            setNotice(val ? `Revision ${rev} loaded.` : `Revision ${rev} not found.`);
                          } catch (e) {
                            setNotice(String(e));
                          }
                        }}
                      >
                        Read immutable revision
                      </button>
                    </div>
                  </div>

                  {history && (
                    <div className="history-result">
                      <div className="history-result-header">
                        <span className="history-chip">Historical Snapshot: Rev #{history.revision}</span>
                        <span className="history-chip">Phase: {history.phase}</span>
                        {history.outcome && <span className="history-chip">Outcome: {history.outcome}</span>}
                      </div>
                      <pre className="canonical-well history-well">{JSON.stringify(history, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="record-card empty-record-card">
                <div className="empty-record-content">
                  <BrandMark className="empty-brand-mark" />
                  <h2 className="empty-title">No Case Selected</h2>
                  <p className="empty-desc">
                    Connect a wallet, click &ldquo;Load public ledger&rdquo; to explore existing cases, or initialize a new argument graph using Stage 1 below.
                  </p>
                  <button className="btn btn-primary" onClick={loadCases}>
                    Load public ledger
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Input Editors Section */}
        <section id="editors" className="editors-section" aria-label="Workflow Authoring Panels">
          <div className="editors-grid">
            {/* Stage 1: Graph Owner Editor */}
            <div className="editor-card">
              <div className="editor-head">
                <div>
                  <span className="editor-stage-tag">Stage 01</span>
                  <h2 className="editor-title">Graph Owner Workbench</h2>
                </div>
                <button type="button" className="btn-helper" onClick={() => setGraph(SAMPLE_GRAPH)}>
                  Load sample graph
                </button>
              </div>
              <p className="editor-desc">
                Define the claim/objection nodes and directed edges. Root must be a CLAIM.
              </p>

              <div className="field-block">
                <label htmlFor="responder-address">Assigned Responder Address</label>
                <input
                  id="responder-address"
                  value={responder}
                  onChange={(e) => setResponder(e.target.value)}
                  placeholder="0x… (distinct 40-hex address)"
                  spellCheck={false}
                />
              </div>

              <div className="field-block">
                <div className="field-label-row">
                  <label htmlFor="create-nonce">Replay-Safe Nonce (32-hex)</label>
                  <button
                    type="button"
                    className="btn-link-action"
                    onClick={() => setNonce(crypto.randomUUID().replaceAll("-", ""))}
                  >
                    Generate fresh nonce
                  </button>
                </div>
                <input id="create-nonce" value={nonce} onChange={(e) => setNonce(e.target.value)} spellCheck={false} />
              </div>

              <div className="field-block">
                <label htmlFor="graph-json">Graph Definition (JSON)</label>
                <textarea
                  id="graph-json"
                  value={graph}
                  onChange={(e) => setGraph(e.target.value)}
                  spellCheck={false}
                />
              </div>

              <div className="editor-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => write(record ? "replace_graph" : "create_graph")}
                  disabled={!wallet.canWrite || !validContract}
                >
                  {record ? "Replace draft graph" : "Create graph"}
                </button>
              </div>
            </div>

            {/* Stage 2: Responder Editor */}
            <div className="editor-card">
              <div className="editor-head">
                <div>
                  <span className="editor-stage-tag">Stage 02</span>
                  <h2 className="editor-title">Responder Workbench</h2>
                </div>
                <button type="button" className="btn-helper" onClick={() => setReplies(SAMPLE_REPLIES)}>
                  Load sample replies
                </button>
              </div>
              <p className="editor-desc">
                Supply direct addressing replies targeting objection IDs in the frozen graph.
              </p>

              <div className="field-block">
                <label htmlFor="replies-json">Direct Replies (JSON)</label>
                <textarea
                  id="replies-json"
                  value={replies}
                  onChange={(e) => setReplies(e.target.value)}
                  spellCheck={false}
                />
              </div>

              <div className="editor-guidance">
                <span className="guidance-title">Protocol Invariant:</span>
                <p>
                  Each objection requires a direct addressing reply. Indirect support paths never substitute for a direct reply.
                </p>
              </div>

              <ResponseActions phase={record?.phase} canWrite={wallet.canWrite && validContract} onWrite={write} />
            </div>
          </div>
        </section>

        {/* Transaction Recovery Journal */}
        <section id="journal" className="journal-section" aria-label="Transaction Journal & Recovery">
          <div className="journal-header">
            <div>
              <span className="journal-tag">Recovery Journal</span>
              <h2 className="journal-title">Durable Transaction Records</h2>
            </div>
            <p className="journal-intro">
              Every signing attempt is reserved before wallet interaction under browser Web Locks. Pending hashes are reconciled—never automatically resubmitted.
            </p>
          </div>

          <div className="journal-table-wrap">
            {pending.length > 0 ? (
              <div className="journal-entries">
                {pending.map((item) => (
                  <div className="journal-row" key={item.key}>
                    <div className="journal-cell-state">
                      <span className={`journal-state-badge state-${item.state.toLowerCase()}`}>
                        {item.state}
                      </span>
                    </div>

                    <div className="journal-cell-meta">
                      <span className="journal-method">{item.method}</span>
                      <span className="journal-target">
                        Case: <code>{item.caseId}</code> · Pre-Rev: <code>{item.preRevision}</code>
                      </span>
                      {item.hash && (
                        <span className="journal-hash">
                          Hash: <code>{short(item.hash)}</code>
                          <button
                            type="button"
                            className="btn-copy-chip"
                            onClick={() => copyText(item.hash!, "jhash-" + item.key)}
                          >
                            {copyFeedback === "jhash-" + item.key ? "Copied" : "Copy"}
                          </button>
                        </span>
                      )}
                    </div>

                    <div className="journal-cell-action">
                      {item.hash && !["SUCCEEDED", "FAILED"].includes(item.state) && (
                        <button className="btn btn-secondary btn-sm" onClick={() => resume(item)}>
                          Reconcile once
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="journal-empty">
                <p>No transactions reserved in local storage.</p>
                <small>Signing attempts create reservations before wallet submission.</small>
              </div>
            )}
          </div>
        </section>

        {/* Public Documentation / How It Works */}
        <footer id="how-it-works" className="docs-footer" aria-label="Public System Documentation">
          <div className="docs-measure">
            <span className="docs-kicker">Documentation & Public Protocol</span>
            <h2 className="docs-headline">How the Ledger Works</h2>

            <div className="docs-prose">
              <section className="docs-block">
                <h3>1. Purpose & Trust Boundary</h3>
                <p>
                  Argument Dependency Closure Ledger is a public decision protocol built on GenLayer intelligent contracts.
                  It freezes a bounded claim and objection graph, records direct replies, and derives whether every relevant objection is structurally addressed.
                </p>
                <p className="docs-highlight">
                  <strong>Assessment of this exact submitted material only; not verification of external facts.</strong>
                  The contract evaluates closure—not whether arguments are factually true or whether outside objections exist.
                </p>
              </section>

              <section className="docs-block">
                <h3>2. Roles & The Three Stages</h3>
                <p>
                  The lifecycle enforces an ordered two-party freeze sequence followed by decentralized consensus evaluation:
                </p>
                <ol className="docs-list">
                  <li>
                    <strong>Stage 1 · Graph Owner (Primary):</strong> Defines the root claim, objection nodes, and directed dependency edges (<code>SUPPORTS</code> or <code>ATTACKS</code>).
                    The owner locks the base graph (<code>BASE_LOCKED</code>), fixing the graph structure permanently.
                  </li>
                  <li>
                    <strong>Stage 2 · Assigned Responder (Secondary):</strong> A distinct address provides direct replies targeting specific objection IDs.
                    The responder freezes responses (<code>FROZEN</code>), fixing all replies permanently.
                  </li>
                  <li>
                    <strong>Stage 3 · Consensus Closure:</strong> Any public actor can trigger consensus evaluation.
                    GenLayer validators independently classify each reply as <code>ADDRESSES</code>, <code>PARTIAL</code>, <code>NONRESPONSIVE</code>, or <code>UNKNOWN</code>.
                  </li>
                </ol>
              </section>

              <section className="docs-block">
                <h3>3. Graph Dependency & Closure Invariant</h3>
                <p>
                  Edges define reachability to the root claim. Only objections with a directed path to the root are relevant.
                  <strong>Relevant objection closes only when its unique direct reply is classified ADDRESSES. Edges select relevance, never substitute for a reply.</strong>
                </p>
              </section>

              <section className="docs-block">
                <h3>4. Evaluation Outcomes</h3>
                <ul className="docs-bullet-list">
                  <li>
                    <code>CLOSED_FOR_DECISION</code>: Every relevant objection reachable from root has a direct reply classified as <code>ADDRESSES</code>.
                  </li>
                  <li>
                    <code>OPEN_OBJECTIONS</code>: At least one relevant objection is unreplied or classified <code>PARTIAL</code> or <code>NONRESPONSIVE</code>.
                  </li>
                  <li>
                    <code>GRAPH_INVALID</code>: A directed cycle was detected anywhere in the graph. Cycle detection evaluates deterministically before any validator prompt.
                  </li>
                  <li>
                    <code>UNRESOLVED</code>: Consensus ambiguity or an agreed <code>UNKNOWN</code> on a relevant reply. A retry is permitted after a 60-second cooldown (up to 3 attempts).
                  </li>
                </ul>
              </section>

              <section className="docs-block">
                <h3>5. Transaction Safety & Reconciliation</h3>
                <p>
                  Every state-changing write creates an immutable reservation under origin-wide browser Web Locks prior to wallet interaction.
                  If network interruptions or delayed finality occur, the transaction enters <code>RECONCILIATION_REQUIRED</code> status.
                  The user can safely click <strong>Reconcile once</strong> to query the transaction receipt and perform an authoritative readback without duplicate gas or double submission.
                </p>
              </section>

              <div className="docs-disclaimer">
                <small>
                  All submitted text will be public and permanent. Do not include private information, credentials or personal records.
                </small>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* Accessible Wallet Chooser Modal */}
      {wallet.chooserOpen && (
        <div
          className="modal-backdrop"
          onClick={() => walletDispatch({ type: "CLOSE_CHOOSER" })}
          role="presentation"
        >
          <div
            className="modal-surface"
            ref={walletModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-modal-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") walletDispatch({ type: "CLOSE_CHOOSER" });
              if (e.key === "Tab") {
                const controls = [...(walletModalRef.current?.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])') || [])];
                if (!controls.length) return;
                const first = controls[0], last = controls[controls.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
              }
            }}
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <h2 id="wallet-modal-title" className="modal-title">Connect Wallet</h2>
                <p className="modal-caption">Select a detected supported wallet to sign transactions on Studionet.</p>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => walletDispatch({ type: "CLOSE_CHOOSER" })}
                aria-label="Close wallet selector"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {wallet.providers.length > 0 ? (
                <div className="wallet-options-list">
                  {wallet.providers.map((w) => (
                    <div key={w.id} className="wallet-option-row">
                      <div className="wallet-option-info">
                        <WalletIcon id={w.id} />
                        <span className="wallet-option-name">{w.label}</span>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => connect(w)}
                        autoFocus={w.id === wallet.providers[0]?.id}
                        disabled={walletState.phase === "CONNECTING"}
                      >
                        {wallet.session?.option.id === w.id ? "Re-connect" : "Connect"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="wallet-empty-state">
                  <p className="empty-state-headline">No supported wallet detected</p>
                  <p className="empty-state-body">
                    Please ensure MetaMask, OKX Wallet, or Rabby extension is installed in this browser.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
