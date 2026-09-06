<!-- GENLAYER-GATE-VERSION: pointer-v1 -->
<!-- GENLAYER-GATE-PROTOCOL: 1 -->
# GenLayer Child Project Pointer

Action routing: `E:\Genlayer\governance\stage-actions.json` → `GOVERNANCE.ACTION_PREFLIGHT` in `E:\Genlayer\brain\Action Preflight Protocol.md`. Before the next important action, run `E:\Genlayer\scripts\invoke-genlayer-preflight.ps1` in Read, Issue and Check modes. A missing/stale receipt or RULE_REFRESH_REQUIRED marker blocks that action. Record current Task ID, workflow and action; retain valid unrelated test evidence.

This directory is one independent GenLayer Task. This private local file defines no duplicated governance.

Context recovery and action cards: follow `GOVERNANCE.ACTION_PREFLIGHT` → Action card and recoverable Task state. Use preflight `Resume` after context loss, `SaveState` at meaningful boundaries, then Read/Issue/Check for the next new action. Do not reconstruct reviewer, Claude iteration, release target or pending-transaction facts by guessing.

Before substantive work:

1. Read `E:\Genlayer\AGENTS.md`.
2. Read `E:\Genlayer\governance\START-HERE.md`.
3. Identify this project, category and current stage.
4. Load only the sections routed for that stage and return the `GENLAYER RULE READ RECEIPT`.

For any GenLayer-connected frontend, `FRONTEND.RPC_BUDGET` and `docs/RPC-BUDGET.md` are hard gates before frontend code. When Studio deployment/E2E is routed, `STUDIO.RPC_BUDGET` is a separate hard gate; run and record the Studio measurement capability probe and lock its evidence mode before opening Studio. Never merge or substitute Studio and frontend matrices/evidence.

For any wallet-enabled frontend, route `FRONTEND.WALLET_SELECTOR` and reusable frontend sections 1-3 before implementation. Use one canonical wallet-session state machine/store for discovery, selection, connection, account/chain events, write-client binding and every wallet-facing UI selector. On failure, route `OPERATIONS.SMART_REPAIR`; never blind-retry or automatically resubmit a transaction.

Every Claude redesign uses manual user handoff: give the user one complete copy-ready prompt in a single code block and wait for the user to return Claude's result. Never invoke Claude through CLI, API, gateway, MCP, subagent, background process or any discovered tool/session; capability is not authorization and there is no direct-channel exception.

Current official GenLayer online documentation is the highest technical authority. Do not import another Task's identity, source, deployment or evidence. Keep this file and other local AI/governance artifacts ignored and outside the public repository.
