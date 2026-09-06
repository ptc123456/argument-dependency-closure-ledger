# Argument Dependency Closure Ledger — Implementation Plan

Status: SPEC_LOCKED for implementation, subject to action-specific preflight and checkpoint approval.

## Exact Research baseline

- Project/Task: `argument-dependency-closure-ledger`
- Canonical Research package: `E:/Genlayer-Projects/_research-candidates-2026-09-01/CANONICAL-13-RESEARCH-R12.md`
- Canonical package SHA-256: `3464E830908CB1D87504057567242D36BDCD0C4FD59934B7D22F6482C6799ED2`
- Stage 1 SHA-256: `E36329DE2E01B977B49CCD3FD19E27D134B2A1819796ABEEDC4F379E952F7A3A`
- Stage 2 SHA-256: `59C94BDF5907C4B1BE59F6928A23D435D87D50B0701E6FC2953A6C77AF490274`
- Research reviewer Task: `01a04c9d-a5d2-70c3-8393-ee3461d40789`
- Research reviewer turn: `01a06392-7059-7bb3-9786-3ca205c462b6`
- Research verdict: C5 `APPROVED`; overall portfolio `APPROVED`, bound exclusively to the canonical R12 hash and limited to Stage 1/2 handoff.

The Build preserves the approved trust problem, actors, scope, phase machine, public methods, result schema, deterministic closure algorithm, nondeterministic decision fields, UI journey, transaction recovery requirements, test matrix, and evidence requirements. No material Stage 1/2 adaptation is currently required.

## Product and trust boundary

A graph owner freezes one finite claim/objection graph. A distinct responder supplies at most one direct reply per objection and freezes the response. Anyone may evaluate. Directed edges select which objections can reach the root claim; edges never count as replies. Validators classify each submitted reply as `ADDRESSES`, `PARTIAL`, `NONRESPONSIVE`, or `UNKNOWN`. The contract deterministically derives `GRAPH_INVALID`, `OPEN_OBJECTIONS`, `CLOSED_FOR_DECISION`, `UNRESOLVED`, or `EXHAUSTED`. The product does not verify argument truth or objections outside the frozen graph.

## Smallest complete implementation

- `contracts/main.py`: one `ArgumentDependencyClosureLedger` contract; all storage, parsing, validation, graph algorithms, consensus call, reducers, history, and public methods remain in this file to avoid deployment import resolution.
- `tests/test_contract.py`: direct deterministic/state tests, mocked LLM tests, captured-validator disagreement tests, serialization/schema boundaries, and complete no-write snapshots.
- `frontend/src/contract.ts`: one GenLayer read/write adapter and one transaction outcome classifier.
- `frontend/src/pending.ts`: one Web-Locks/localStorage journal implementation using immutable random reservation keys and fingerprint-only conflict checks.
- `frontend/src/wallet.ts`: one canonical wallet-session store for MetaMask, OKX Wallet, and Rabby discovery/selection/account/chain state.
- `frontend/src/App.tsx`: functional graph-owner, responder, closure/readback, history, journal, Docs/How it works, and public status flows.
- `frontend/tests/flow.spec.ts` plus focused unit tests: critical browser journey, wallet selector, journal mutex/recovery, receipt/readback, and public-copy assertions.
- `docs/RPC-BUDGET.md`: separate frontend RPC matrix before frontend code; Studio budget remains a later `PRE_DEPLOY` artifact.

No backend, database, token, payment, timer, external source, plugin architecture, upgrade mechanism, arbitrary evaluator, or additional contract will be added.

## Contract invariants

1. Storage and ABI follow the exact Stage 2 common fields and C5 method table. Case IDs/revisions/timestamps cross JSON as decimal strings; public ABI retains `u256`, `Address`, and `str`.
2. JSON decoding rejects duplicate keys, unknown keys, bool-as-int, floats, NaN, null, controls outside LF/TAB, malformed IDs/addresses/nonces, and every aggregate/field/record limit before mutation.
3. Create replay checks creator+nonce and immutable original argument hash before capacity; identical replay returns the existing ID without writes, otherwise `NONCE_CONFLICT`.
4. Every mutating method enforces caller, phase, CAS revision, capacity, and prospective full-record size before committing current record, indexes, version, and history atomically.
5. DFS cycle detection covers the entire graph. Reverse reachability from `root_id` determines relevant objections. Only a unique direct reply classified `ADDRESSES` closes a relevant objection.
6. Graph cycles short-circuit deterministically to `GRAPH_INVALID` with labels `[]` and zero LLM calls. Empty reply vectors also use the deterministic reducer. Other frozen acyclic cases use one custom `run_nondet_unsafe` leader/validator path.
7. Leader and validators independently run the same bounded prompt classification and compare the complete stable labels vector. Malformed output, disagreement, VM error, or undetermined consensus leaves every map/counter/history entry unchanged.
8. Accepted `UNKNOWN` on a relevant reply commits `UNRESOLVED`; retry uses the same frozen inputs, transaction-pinned time, 60-second cooldown, and at most three accepted attempts.

## Frontend and transaction invariants

1. Provider discovery lists only detected MetaMask, OKX Wallet, and Rabby providers. One canonical session store owns every wallet-facing selector and write client.
2. Every write persists a `SIGNING` journal record under an origin-wide Web Lock before wallet interaction. Missing lock/reliable storage disables signing; no fallback authorizes a write.
3. Any unresolved journal entry for the same chain+contract+case blocks all new writes to that case. Records remain bound to their stored chain, contract, account, method, arguments, prestate, and immutable hash.
4. Automatic polling is bounded by the Stage 2 budget. Hidden tabs do not poll. Timeouts preserve `RECONCILE`; no automatic resubmission exists.
5. UI success requires GenLayer `FINALIZED`, semantic successful execution, and exact method-specific historical readback. A missing/mismatched readback remains `RECONCILE`.

## Current-runtime feasibility result

Checked 2026-09-07 against current official documentation and installed tools:

- Official storage/API docs support class-body persistent fields, `TreeMap`, sized integers, `Address`, `@gl.public.view`, and `@gl.public.write`.
- Official nondeterminism docs support `gl.nondet.exec_prompt(..., response_format='json')` inside custom `gl.vm.run_nondet_unsafe` and independent validator re-derivation.
- Official transaction-context docs support `int(datetime.now(timezone.utc).timestamp())` as deterministic transaction-pinned Unix time.
- `genvm-lint 0.11.0` check/semantic/schema probe passed on the exact representative ABI/storage/nondeterminism bytes. Extracted schema exposed the expected address, integer, string, null-return, view, and write shapes.
- `genlayer-test 0.29.2` Direct Mode probe passed storage initialization, representative ABI use, mocked JSON LLM execution, and captured-validator agreement (`1 passed`).
- The installed linter reports a newer runner is available. The Build will inspect and pin the exact compatible runner/dependency before product source lock; this is expected version selection, not a product or interface change.
- Initial human-readable linter output failed only because Windows `cp1252` could not print the tool's checkmark. Running the same bytes with process-local UTF-8 JSON output passed; implementation checks will use that reproducible form.

## Experience application map

| Experience entry | Application | Regression/evidence |
|---|---|---|
| Fail closed before and after a transaction hash when recovery storage is unreliable | Pre-submit storage round trip; in-memory single flight after hash; preserve hash on persistence/cleanup failure | storage operation failures, post-hash persistence failure, cleanup failure, zero duplicate writes |
| Make custom consensus rederive the consequential judgment | Validator independently reruns classification and compares the complete labels vector | schema-valid but materially changed label rejects; disagreement causes no write |
| Reconcile a successful write before retrying a failed return decode | Preserve create hash and resolve ID by nonce/version 1 | live-envelope fixture; decode failure cannot enable resubmission |
| Treat contract JSON and transaction receipts as untrusted protocol boundaries | Lossless decimal-string parsing; one receipt classifier; method-specific readback | malformed/large integers, missing fields, finalized error, ambiguous terminal states, delayed readback |
| Budget shared RPC capacity across the whole application and proof tooling | Shared FIFO/single-flight client and one application budget | concurrency, FIFO, bounded transient retry, hidden-tab zero polling |
| Keep specification result schemas identical to the accepted contract protocol | Key-for-key schema checklist across contract, frontend, tests, docs | protocol schema diff before every review package |
| Pin the compatible GenVM runner bundle, not only the linter version | Record linter, runner, dependency, artifact digest, and exact commands | fresh/audited-cache semantic validation before PRE_DEPLOY |
| Put the GenVM text-runner version line before the dependency manifest | Not applied yet: version-sensitive Studio-envelope condition must be verified against the current Studio template before source approval; current official docs show the dependency declaration as the first line | read-only Studio schema probe before PRE_DEPLOY; any source-prologue change forces rehash/review |
| Poll GenLayer finality from the GenLayer transaction object, not an EVM receipt | Use GenLayer transaction consensus/execution object and authoritative readback | captured current-network envelopes, finalized success/error, reload reconciliation |

## Ordered build and gates

1. Implement exact contract and contract tests; run lint, schema, semantic validation, Direct Mode, and protocol inventory checks.
2. Create and validate `docs/RPC-BUDGET.md`, then implement the functional frontend, canonical wallet state, journal, and browser tests.
3. Complete Claude presentation-layer redesign through the mandatory user-mediated handoff, then integrate and repair remaining findings.
4. Build the exact `PRE_DEPLOY` package and obtain anonymous `APPROVED` for that revision before Studio deployment.
5. Probe Studio RPC measurement mode, deploy, and execute the approved Studio matrix through semantic execution and authoritative readback.
6. Obtain `POST_DEPLOY_TEST APPROVED`, lock explicit GitHub/Vercel targets with the user, publish the public exact revision, and request explicit permission immediately before Vercel E2E.
7. Complete judge-perspective Vercel E2E and exact source/bundle/readback evidence; obtain `POST_GITHUB_VERCEL_FINAL APPROVED`.
8. Prepare judge-facing Explorer material, pass `EXPLORER_PRE_SUBMISSION` and readability review, then return the copy-ready form for the user to submit.

## Acceptance boundary

The Build is not complete on local PASS, `FINALIZED` alone, deployment, GitHub push, or Vercel readiness. Completion requires all four Build checkpoints on their exact applicable revisions, successful semantic execution plus authoritative readback for live writes, public exact-source/release parity, and the final Explorer copy-ready package. The primary AI never submits the Explorer form.
