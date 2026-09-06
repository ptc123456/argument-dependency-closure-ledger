# Frontend RPC Budget

Scope: Argument Dependency Closure Ledger public GenLayer frontend. Counts below are application adapter calls. Physical-network evidence is collected separately on the exact release during Vercel E2E.

RPC_BUDGET_REVISION: 2026-09-07-wallet-rpc-v2
OFFICIAL_DOCS_CHECKED: 2026-09-07 — https://docs.genlayer.com/api-references/genlayer-js and https://docs.genlayer.com/developers/decentralized-applications/writing-data
FRONTEND_SCOPE: APPLICABLE
STUDIO_SCOPE: APPLICABLE
MULTI_CLIENT_JUSTIFICATION: One account-free read client is shared globally; one selected-provider write client is bound atomically to the active wallet account and replaced on session changes.

## FRONTEND RPC BUDGET MATRIX

FRONTEND_MATRIX_STATUS: COMPLETE

| Screen/workflow | Request source | RPC method/read | Trigger | Poll interval | Max polls | Retry policy | Cache/deduplication | Teardown | Max requests | Max transactions | Authoritative completion |
|---|---|---|---|---|---|---|---|---|---:|---:|---|
| Landing | Application | None | Initial render | none | 0 | none | no client call | unmount | 0 | 0 | Static public explanation rendered |
| Case list | Shared read client | list_cases | Explicit open/page | none | 1 | one transient retry at 500 ms | in-flight dedupe; 5 s cache | abort on unmount/navigation | 2 | 0 | Canonical ID page decoded |
| Case detail | Shared read client | get_case | Explicit case selection | none | 1 | one transient retry at 500 ms | in-flight dedupe; no consequential stale cache | abort on selection/unmount | 2 | 0 | Exact full record decoded |
| Case history | Shared read client | get_version | Explicit history click | none | 1 | one transient retry at 500 ms | immutable revision cache; in-flight dedupe | abort on unmount | 2 | 0 | Exact requested revision decoded |
| Wallet connect | Selected EIP-1193 provider | eth_requestAccounts + eth_chainId | After explicit wallet selection | none | 1 | no blind retry | exact selected provider | teardown session listeners on disconnect | 2 | 0 | Canonical store reaches CONNECTED on target chain |
| Create graph | Bound write client | eth_accounts + eth_chainId + eth_getCode + eth_getBalance + create_graph | Explicit signed submit | none | 1 | no retry and no resubmit | one pre-sign validation batch; immutable reservation | stop after returned hash/error | 5 | 1 | Hash journaled as SUBMITTED; success is not yet claimed |
| Case mutation | Bound write client | eth_accounts + eth_chainId + eth_getCode + eth_getBalance + selected contract method | Explicit signed submit | none | 1 | no retry and no resubmit | one pre-sign validation batch; case-wide pending conflict | stop after returned hash/error | 5 | 1 | Hash journaled as SUBMITTED; success is not yet claimed |
| Manual resume — create | Journal reconciliation | Existing transaction status + get_id_by_nonce + get_version | Explicit Reconcile once | none | 1 | no automatic retry | existing immutable hash only | stop after one receipt and authoritative readback | 3 | 0 | Terminal success plus nonce mapping and version 1 readback |
| Manual resume — mutation | Journal reconciliation | Existing transaction status + get_case | Explicit Reconcile once | none | 1 | no automatic retry | existing immutable hash only | stop after one receipt and authoritative readback | 2 | 0 | Terminal success plus strictly advanced canonical revision |
| Journal panel | Shared read client | Existing hashes/readbacks | Explicit reconcile, max two concurrent | none | 1 each | no automatic retry | four local entries per page; in-flight dedupe | abort on close/unmount | 4 | 0 | Each selected reservation remains independently classified |

Global controls:

- One shared client/guard; components never create independent RPC clients.
- Landing performs zero RPC. Hidden tabs perform zero polls. Account/chain changes perform zero automatic writes or resubmits.
- Reads are request-key deduplicated. Immutable historical revisions may be cached; current authorization, wallet, receipt, and consequential state are not authorized from stale cache.
- `429`, server-busy, and transient transport retries are bounded by the row; `Retry-After` is honored up to 30 seconds, then automatic work stops.
- Every write is exactly one submission. Finality/readback occurs only after an explicit same-hash Reconcile action; uncertainty preserves `RECONCILE` and the immutable journal record.
- Success requires GenLayer finality, semantic execution success, and exact method-specific authoritative readback. `FINALIZED` alone is never success.

## FRONTEND RPC BUDGET EVIDENCE

FRONTEND_EVIDENCE_STATUS: INCOMPLETE

Unit tests prove application-level deduplication, cache invalidation, abort isolation, bounded backoff, exact wallet revalidation, and immutable-hash reconciliation behavior. Physical request counts remain intentionally incomplete until exact-revision Vercel E2E.
