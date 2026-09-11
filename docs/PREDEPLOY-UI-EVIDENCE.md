# PRE_DEPLOY UI Evidence

OBSERVED_AT: 2026-09-11T19:55:00+07:00
OBSERVATION_MODE: Read-only DOM inspection through the Codex in-app Browser

## Studio account selection

- URL: `https://studio.genlayer.com/contracts`
- Selected account shown in the Studio account control: `0x15872d1887b8ff7322F2aa7c3c535f1F00dbb452`
- Selected account balance shown by Studio: `1,000,000 GEN`
- Other visible accounts were not selected: `0xd34095A654030130dCe3348A040FaA1ED14d9978` (`10 GEN`) and `0x169E25DA9EfCF9D0E916b53c0a3510Ef64bAE5E3` (`0 GEN`).
- Selection proof: the collapsed header control displayed `0x15...b452`; opening the account control displayed the full first address and balance as the active header account. No account was created, switched, funded, or otherwise mutated during this check.
- Deployment remains `NOT_STARTED`; there is no deployment hash, contract address, signature, or write claim in this evidence.

## Local frontend render check

- URL: `http://127.0.0.1:5173/`
- The production UI rendered the three-stage sequence, neutral graph/reply editors, contract input, wallet chooser trigger, transaction status region, and durable journal without console-visible failure.
- Landing remained disconnected and made no write. The browser check did not impersonate a wallet or claim a live contract journey.
- The executable integration regression `frontend/tests/flow.spec.ts` verifies the complete phase/action route and renders the real response action component to prove that `RESPONSE_DRAFT` exposes both `put_replies` and `freeze_replies`.
