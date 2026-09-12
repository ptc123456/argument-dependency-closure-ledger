# Implementation Changelog

## 2026-09-07 — Contract increment

- Added the exact C5 single-contract implementation and schema artifact.
- Added Direct Mode regressions for create replay/nonce conflict, actor/history readback, authority, CAS, duplicate/unknown JSON, all four evaluator labels, missing direct replies, disconnected objections, all-graph cycles, empty vectors, validator disagreement, malformed result no-write, cooldown, and three-attempt exhaustion.
- Mechanical current-runtime correction: canonical address conversion accepts both runtime `Address.as_bytes` and Direct Mode bytes; errors use current `gl.vm.UserError`.
- Hardened all public `u256` inputs against Python `bool` coercion and expanded boundary coverage for disconnected cycles, graph shapes, response targeting and size caps, parent/child rules, pagination, and aggregate no-write behavior.
- Mechanical Windows tooling correction: linter commands set process-local `PYTHONUTF8=1` and use JSON output because the default `cp1252` console cannot encode the tool's checkmark.
- No product behavior, trust boundary, actor authority, phase transition, public signature, result schema, acceptance criterion, or evidence requirement changed from approved Stage 1/2.

Verification:

- `gltest -q tests/test_contract.py` → `25 passed`
- `genvm-lint check contracts/main.py --json` → lint and semantic validation PASS; 14 methods (7 view, 7 write), constructor 0 parameters
- `genvm-lint schema contracts/main.py --output contract-schema.json` → PASS

## 2026-09-07 — Functional frontend increment

- Added a React/TypeScript frontend pinned to `genlayer-js 1.1.8` and the current Studionet chain definition.
- Added supported-provider discovery for MetaMask, OKX Wallet, and Rabby, with one selected provider/account session used for writes.
- Added public case index/detail/history reads, role-specific write controls, pre-sign Web-Locks/localStorage reservations, immutable transaction journaling, bounded finality checks, and authoritative mutation/create readback.
- Added explicit public scope copy: the ledger evaluates closure, not truth; landing makes zero RPC calls and no failed/ambiguous transaction is automatically resubmitted.

Verification:

- `npm test` → `2 passed`
- `npm run build` → PASS with Vite production bundle; non-blocking single-chunk size warning remains for the GenLayer SDK bundle

## 2026-09-07 — Presentation redesign integration

- Integrated the user-transferred Claude iteration-1 presentation diff within its allowed `App.tsx`, `styles.css`, and `tokens.css` boundary.
- Codex correction pass restored neutral default form data, aligned the visible transaction lifecycle with the required public phase vocabulary, removed a context-free closure assertion, and added wallet-dialog initial focus, focus trapping, inert background, Escape close, and focus restoration.
- Browser QA confirmed the detected-wallet empty chooser, no-wallet path, neutral initial graph/replies, semantic page structure, and zero console errors. No contract adapter, journal, wallet provider adapter, dependency, RPC call, or write behavior changed in this increment.

Verification:

- `npm test` → `2 passed`
- `npm run build` → PASS; existing non-blocking GenLayer SDK bundle-size warning remains

## 2026-09-07 — Wallet and RPC hardening

- Added page-lifetime EIP-6963 discovery with supported-wallet identity filtering, UUID/provider deduplication, late-announcement updates, and listener cleanup while preserving bounded legacy injection discovery.
- Added selected-provider session listeners for account, chain, and disconnect changes; writes now fail closed unless the selected session is on Studionet chain `0xf22f`.
- Replaced independent wallet/session UI state with one canonical reducer owning phase, providers, session, chain state, SDK write-client binding, errors, chooser visibility, and write eligibility.
- Added regression coverage for all eight supported-wallet cardinalities plus atomic connect, wrong-chain recovery, account rebinding, disconnect, and selector consistency.
- Added pre-sign revalidation of the selected account, Studionet chain, deployed contract code, and non-zero spendable GEN; failed checks occur before journal reservation or wallet submission.
- Added semantic transaction status attributes and reduced-motion handling, and aligned the RPC matrix with the actual explicit one-shot reconciliation flow.
- Added one shared read guard with in-flight deduplication, safe immutable/history and five-second list caching, one bounded transient retry, subscriber-local cancellation, and generation-based cache invalidation after writes.
- Preserved an already-returned transaction hash as `RECONCILIATION_REQUIRED` if journal persistence fails after submission; automatic resubmission remains forbidden.
- Installed `genlayer-js 1.1.8` exposes compatibility `waitForTransactionReceipt` but not current documented `waitForFinalization`/`isSuccessful`; dependency/API resolution remains an explicit `PRE_DEPLOY` blocker rather than an unverified upgrade.

Verification:

- `npm test` → `29 passed`
- `npm run build` → PASS; existing non-blocking GenLayer SDK bundle-size warning remains
- Implementation-stage governed project audit → PASS

## 2026-09-11 — Anonymous PRE_DEPLOY corrections

- Fixed `RESPONSE_DRAFT` action routing and rendered the real response controls under integration coverage so saving and freezing replies are both reachable.
- Replaced the shared-array pending journal with per-reservation records, exclusive locked mutations, immutable transaction hashes, orphan/index rebuild, verified writes, unsigned-rejection cleanup, and a hard 32-record capacity.
- Corrected contract revision reserve boundaries to leave six revisions after the final base replacement and four after the final response replacement; added exact boundary regressions.
- Refreshed read-only Studio account evidence against the currently selected Studio account and recorded a local browser render check without making a transaction.
- No dependency, public contract signature, actor authority, result schema, product scope, or automatic retry behavior changed.

Verification:

- `gltest -q tests/test_contract.py` → `26 passed` on the pre-correction revision `5d7c521626c3f90595ef6d8087c1814675c413f2`
- `npm test` → `34 passed` across five files

## 2026-09-12 — Studio address decoding correction

- Corrected the shared `address()` boundary helper to accept the integer representation emitted by Studio for ABI `Address` arguments, while retaining the existing `Address.as_bytes` path and rejecting values outside 160 bits.
- The first bounded live `create_graph` probe finalized with semantic `ERROR` (`0x6b6814f5a332d23a4722adaccbf26c7c770d0ab1672098a631b7932c696ef24b`) and authoritative `get_count() = 0`; this negative evidence is retained.
- No public method signature, lifecycle rule, authority check, result schema, or retry behavior changed.

Verification:

- `gltest -q tests/test_contract.py` → `27 passed`, including the integer ABI address regression
- `genvm-lint check contracts/main.py --json` → lint and semantic validation PASS; 14 methods (7 view, 7 write), constructor 0 parameters
- `genvm-lint schema contracts/main.py --output contract-schema.json` → PASS
- `npm test` → `34 passed` across five files
- `npm run build` → PASS with the existing non-blocking bundle-size warning
