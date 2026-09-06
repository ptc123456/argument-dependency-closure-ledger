# Frontend RPC Budget

Scope: Argument Dependency Closure Ledger public GenLayer frontend. Counts below are application adapter calls. Physical-network evidence is collected separately on the exact release during Vercel E2E.

## FRONTEND RPC BUDGET MATRIX

FRONTEND_MATRIX_STATUS: COMPLETE

| Screen/workflow | Request source | RPC method/read | Trigger | Poll interval | Max polls | Retry policy | Cache/deduplication | Teardown | Max requests | Max transactions | Authoritative completion |
|---|---|---|---|---|---|---|---|---|---:|---:|---|
| Landing | Application | None | Initial render | none | 0 | none | no client call | unmount | 0 | 0 | Static public explanation rendered |
| Case list | Shared read client | list_cases | Explicit open/page | none | 1 | one transient retry at 500 ms | in-flight dedupe; 5 s cache | abort on unmount/navigation | 2 | 0 | Canonical ID page decoded |
| Case detail | Shared read client | get_case | Explicit case selection | none | 1 | one transient retry at 500 ms | in-flight dedupe; no consequential stale cache | abort on selection/unmount | 2 | 0 | Exact full record decoded |
| Case history | Shared read client | get_version | Explicit history click | none | 1 | one transient retry at 500 ms | immutable revision cache; in-flight dedupe | abort on unmount | 2 | 0 | Exact requested revision decoded |
| Wallet connect | Selected EIP-1193 provider | eth_chainId | After explicit wallet selection | none | 1 | no blind retry | selected-provider single flight | teardown session listeners on disconnect | 1 | 0 | Canonical store reaches CONNECTED on target chain |
| Create graph | Write coordinator | create_graph plus transaction status and get_id_by_nonce/get_version | Explicit signed submit | 2 then 4 then 8 s | 3 | no resubmit; two readbacks at 0 and 4 s | immutable reservation; same-hash reconciliation | stop on terminal/budget/hidden/unmount | 6 | 1 | FINALIZED plus semantic success plus nonce and version 1 readback |
| Case mutation | Write coordinator | replace_graph/lock_graph/put_replies/freeze_replies/evaluate_closure/retry_closure plus status/get_version | Explicit signed submit | 2 then 4 then 8 s | 3 | no resubmit; two readbacks at 0 and 4 s | case-wide pending conflict; same-hash reconciliation | stop on terminal/budget/hidden/unmount | 6 | 1 | FINALIZED plus semantic success plus exact next historical revision/postcondition |
| Manual resume | Journal reconciliation | Existing transaction status plus one view | Explicit Resume action | none | 1 | no automatic retry | existing immutable hash only | stop after one receipt and one read | 2 | 0 | Terminal classification and method-specific authoritative readback |
| Journal panel | Shared read client | Existing hashes/readbacks | Explicit reconcile, max two concurrent | none | 1 each | no automatic retry | four local entries per page; in-flight dedupe | abort on close/unmount | 4 | 0 | Each selected reservation remains independently classified |

Global controls:

- One shared client/guard; components never create independent RPC clients.
- Landing performs zero RPC. Hidden tabs perform zero polls. Account/chain changes perform zero automatic writes or resubmits.
- Reads are request-key deduplicated. Immutable historical revisions may be cached; current authorization, wallet, receipt, and consequential state are not authorized from stale cache.
- `429`, server-busy, and transient transport retries are bounded by the row; `Retry-After` is honored up to 30 seconds, then automatic work stops.
- Every write is exactly one submission plus at most three same-hash status queries and two authoritative readbacks. Budget exhaustion preserves `RECONCILE` and the immutable journal record.
- Success requires GenLayer finality, semantic execution success, and exact method-specific authoritative readback. `FINALIZED` alone is never success.
