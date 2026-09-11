# PRE_DEPLOY Review Package

PACKAGE_ID: ADCL-PREDEPLOY-5D7C521-20260911
CHECKPOINT: PRE_DEPLOY
WORKFLOW: Build
TASK_ID: argument-dependency-closure-ledger
PROJECT_PATH: E:\Genlayer-Projects\argument-dependency-closure-ledger
SOURCE_REVISION: 5d7c521626c3f90595ef6d8087c1814675c413f2
SOURCE_TREE_STATUS: CLEAN
STUDIO_NETWORK: Studionet, chain ID 61999 (`0xf22f`)
STUDIO_DEPLOYER: 0x15872d1887b8ff7322F2aa7c3c535f1F00dbb452 (selected; 1,000,000 GEN observed 2026-09-11)
CONTRACT_LIFECYCLE: INTENTIONALLY FROZEN — this Task deploys one non-upgradeable contract; no proxy, upgrader, migration method, or administrator role exists.

## Objective and acceptance boundary

Freeze a finite claim/objection graph, accept one direct reply per objection from a distinct responder, and use GenLayer consensus to classify replies. Deterministic graph logic then derives structural closure without claiming factual truth. PRE_DEPLOY approval covers source readiness and the bounded Studio plan only. It does not authorize or prove deployment, live E2E, publication, release, or Explorer submission.

## Exact artifact allowlist

| Artifact | SHA-256 |
|---|---|
| `contracts/main.py` | `8C530959079A9CF8C4E32E7F0DDFED91869C4390677B85DC6D6D068371B9790A` |
| `tests/test_contract.py` | `555E4FFEA2B6C3055CD49A49BF0D906C3C85561E7FCF7FFB130B399051FED234` |
| `contract-schema.json` | `34F88A39FDCD8A3AA2C83A64117501C363AA4A7E70D466C5A3243DFC7BAC0DDD` |
| `frontend/package.json` | `A83D7A93EB5672AA5589BBE70ECE454D140DEC2F408458EDD2E9CA751CC8E56C` |
| `frontend/package-lock.json` | `B2FAD8AEE6091647866F2E42474D5B40F85EE521E11B74FF277695962FA6F531` |
| `frontend/src/App.tsx` | `55CF164DC810E9B194ABB82C378E6C1B945B4945E163D81B3B9C924A1616D9A1` |
| `frontend/src/contract.ts` | `CC8EB3539F0C921D2C794D5A52312CE6C742144D71FDA1434B1B5A84527170FB` |
| `frontend/src/pending.ts` | `D479A6D5720AEAEE9D46151CC7CAF69401212380DBE66F96DE44E393E8CD83E0` |
| `frontend/src/rpc.ts` | `F49A77122B37715315C894DDCF03A139AB6373F6B601CE9454EFC90A1D9416DF` |
| `frontend/src/transaction.ts` | `87A993D7CFB3FDA46BFCC54E8B24E1E17A53B8F358A99F918159A037CE4BE531` |
| `frontend/src/wallet.ts` | `1DE62378613676FC2E309A2CAB7CD125FB38C603F490A59A9BAF61B29B5CE1CE` |
| `frontend/src/ResponseActions.tsx` | `B37E8F5245CE20705BE335F72A21E5175C63FF91906563594791A77418FBF82B` |
| `frontend/src/workflow.ts` | `659BE67AB1F835D7D3D6B223762BE78E4FB463087722AD8FEE3EA9A932644CC3` |
| `frontend/src/styles.css` | `4D8666D532FF399B92C49FFD98B04C7D769BDD005451CB4AEFE2A6AD699171A3` |
| `frontend/src/tokens.css` | `4B529374D59FF21AB4E53DB5823FD3B753C162EDD60924785ED479F72AC93893` |
| `frontend/tests/flow.spec.ts` | `31E9EBD6C73FE5535E48623FE47617A0D2FBDC906183C8EA5D542C36465DF5A6` |
| `frontend/tests/pending.test.ts` | `D66C150C3EFE6210FDAAF92BF38AD906DCCB2AA0BB6E344D583152C9FEF128BC` |
| `frontend/tests/rpc.test.ts` | `38DA22A014138726D952E9175FC827B0948BD09E5F35C9CAF5333ACC7A00754E` |
| `frontend/tests/transaction.test.ts` | `DFA2794F4AC495BDD5F3A15E3C85ED2B08CFDD9C91B4E1075FEB3D9050205372` |
| `frontend/tests/wallet.test.ts` | `B0B770452FAEBFA95C3E1649D31BA6D9A85647687DB6AA1C4103A43DA5029997` |
| `docs/IMPLEMENTATION-PLAN.md` | `610DA67DE3A49A3496DD91DD3DB53E09D7B5DCF21D9222E4B93A00F9DA8D62D3` |
| `docs/FRONTEND-DESIGN-RATIONALE.md` | `34ABD66E051D5BABE6883B21450E5A0A23AD593E0C1F6D7E0504CA52064FBA5B` |
| `docs/RPC-BUDGET.md` | `415E1FC5535369B3CA013A4393D35DE7A9CC4AF4C8FAE3AA2F908AA33F67C191` |
| `docs/PREDEPLOY-UI-EVIDENCE.md` | `06B532CF576E8FE68E79963FB43A1190BDFC3CD1FAB4CA21971000FCD370E64C` |

The review package and prompt are evidence wrappers, not deployable source. Any change to an allowlisted artifact invalidates this package.

## Verified local evidence

- `gltest -q tests/test_contract.py`: 26 passed.
- `genvm-lint check contracts/main.py --json`: PASS; lint 3/3, semantic validation PASS, 14 methods, 7 views, 7 writes, constructor has zero parameters.
- `genvm-lint schema contracts/main.py --output contract-schema.json`: PASS and reproduced the allowlisted schema.
- `npm test` in `frontend`: 34 passed across five test files.
- `npm run build` in `frontend`: PASS; only the disclosed non-blocking bundle-size warning remains.
- Governed project audit at `Implementation`: PASS.
- Governed project audit at `PreDeploy`: PASS after the read-only Studio measurement capability probe.
- Working tree was clean at source revision `5d7c521626c3f90595ef6d8087c1814675c413f2` before this package-only wrapper update.

## Anonymous-review correction delta

- F-001: `RESPONSE_DRAFT` now exposes both response replacement and freeze actions through one tested phase router and the real rendered response-action component.
- F-002: the journal now uses per-reservation records; every reservation/update/removal/index rebuild is serialized by the origin-wide Web Lock. Hashes are immutable, records are discovered independently of the index, orphan records rebuild into the index, storage writes are read-back verified, and the 33rd record is rejected. Concurrency, orphan recovery, immutability, and capacity regressions pass.
- F-003: `replace_graph` now rejects when current revision is above 25 and `put_replies` above 27. The boundary test proves the final allowed edits produce revisions 26 and 28 while retaining the locked downstream reserve.
- F-004: `docs/PREDEPLOY-UI-EVIDENCE.md` records the currently selected Studio account, balance, alternatives, timestamp, URL, observation method, and explicit no-write boundary.
- F-005: `frontend/tests/flow.spec.ts` covers the complete phase/action journey and server-renders the production response-action component; an in-app browser render check of the local application is recorded in the UI evidence.

## Contract and frontend mechanisms to inspect

- Strict JSON boundary rejects duplicate/unknown keys, invalid numeric forms and aggregate overflows before mutation.
- Creator+nonce replay is idempotent only for the immutable original argument hash; conflicting replay fails.
- Whole-graph cycle detection precedes nondeterminism. Reverse reachability selects relevant objections; graph edges never substitute for a direct reply.
- Validators independently re-run bounded classification and compare the complete labels vector. Disagreement/malformed output/VM error commits no state.
- One wallet store owns phase, discovered providers, selected provider, account, chain validity, write-client binding, chooser and error. EIP-6963 and bounded legacy discovery expose only detected MetaMask, OKX and Rabby providers.
- Pre-sign validation checks the exact selected account, chain, deployed contract code and non-zero GEN balance before reservation/submission.
- An origin-wide Web Lock and durable reservation precede wallet interaction. A returned hash is retained even if later persistence fails; no automatic resubmission exists.
- Success requires finalization, `FINISHED_WITH_RETURN`, and method-specific authoritative readback. `FINALIZED` alone is not success.

## SDK and runtime pin decision

`frontend/package-lock.json` pins the npm stable release `genlayer-js 1.1.8`. Its Studionet-compatible API exposes `waitForTransactionReceipt` with `TransactionStatus.FINALIZED`; the adapter additionally requires `txExecutionResultName === FINISHED_WITH_RETURN`. Current official documentation reserves `genlayer-js 2.0.0-rc.1` for the Consensus v0.6 preview and warns not to select a prerelease through the default tag. This package targets stable Studionet, so it does not silently cross to the preview SDK/network. A temporary read-only package inspection confirmed the RC contains both `studionet` and `studioDevnet`, but no dependency was changed.

`genvm-lint` reports that a newer py-genlayer runner exists. The installed runner nevertheless passed lint, semantic validation, schema extraction and all 25 Direct Mode tests on these exact bytes. Deployment must still confirm Studio accepts these exact source bytes before submission; failure invalidates approval and requires correction/re-review.

## Bounded Studio deployment and E2E plan

1. Reconfirm Studio is on stable Studionet and selected public deployer is exactly `0x15872d1887b8ff7322F2aa7c3c535f1F00dbb452` with sufficient GEN.
2. Load the exact allowlisted `contracts/main.py`; verify Studio schema shows zero constructor parameters and the expected 14-method ABI before deployment.
3. Submit exactly one deployment. Persist the transaction hash immediately; never redeploy merely to measure or because a return/readback is ambiguous.
4. Reconcile that hash to finality, require semantic execution success, then read back the deployed schema/code/address. Record all observable Studio RPC-log actions under the locked `OBSERVABLE_ACTION_LEDGER` mode; make no physical-request-count claim.
5. Exercise the minimum lifecycle: create; identical nonce replay; conflicting nonce rejection; replace and lock graph; responder-role enforcement; save and freeze replies; acyclic closure evaluation; cycle short-circuit; malformed/disagreement no-write; accepted UNKNOWN then cooldown/retry bounds; immutable history/list/nonce reads.
6. For every write, preserve one hash, prove semantic success/failure as applicable, and perform the exact authoritative readback. Do not run writes concurrently and do not resubmit automatically.
7. Bind the deployed contract address into the frontend only after exact code/schema parity. Live frontend/Vercel evidence remains later-gate work.

## RPC measurement boundary

`docs/RPC-BUDGET.md` records a PRE_E2E capability probe at `2026-09-07T03:34:19+07:00`. Studio exposed a dedicated RPC log filter and hash/method search before any Studio action. Mode is locked to `OBSERVABLE_ACTION_LEDGER`; `STUDIO_FIRST_ACTION_AT` and `STUDIO_E2E_STARTED_AT` remain `NOT_STARTED`, and `STUDIO_REPLAY_FOR_MEASUREMENT` is `NO`. Frontend physical-network evidence remains `INCOMPLETE` until exact-revision Vercel E2E, which is not required at PRE_DEPLOY.

## Known limits and explicit non-claims

- No Studio deployment, transaction, live receipt, deployed address or authoritative live readback exists yet.
- GitHub target `ptc123456/argument-dependency-closure-ledger` and Vercel target `shingg/argument-dependency-closure-ledger` are user-confirmed; nothing has been pushed or deployed publicly.
- The production bundle warning (~751 kB minified JS) is caused primarily by the GenLayer SDK and is not a correctness failure; no speculative code-splitting dependency was added.
- PRE_DEPLOY approval, if granted, authorizes only progression to the separately controlled Studio action. It is not POST_DEPLOY_TEST or release approval.

## Reviewer verdict requirement

Return exactly one literal verdict: `VERDICT: ANONYMOUS REVIEW APPROVED - PRE_DEPLOY`, `VERDICT: ANONYMOUS REVIEW CHANGES REQUIRED - PRE_DEPLOY`, or `VERDICT: ANONYMOUS REVIEW REJECTED - PRE_DEPLOY`, with exact findings and verification criteria.
