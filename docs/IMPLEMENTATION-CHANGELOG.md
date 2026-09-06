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
