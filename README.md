# Argument Dependency Closure Ledger

Public GenLayer intelligent-contract workbench for a bounded two-party argument graph. The contract validates graph structure and reply schemas, records immutable revisions, uses GenLayer consensus to classify direct replies, and derives structural closure without claiming factual truth.

## Public deployment

- Network: GenLayer Studio Devnet (chain `61997`, RPC `https://studio-dev.genlayer.com/api`)
- Contract: `0xc62882afF2aF406E93E7EDC242d0c78B0f215fD3`
- Runtime: `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`
- Frontend configuration: copy `frontend/.env.example` to `frontend/.env`.

## Local development

```powershell
cd frontend
npm ci
npm test
npm run build
```

The frontend uses the official `genlayer-js 2.0.0-rc.1` `studioDevnet` chain and requires an injected MetaMask, OKX Wallet, or Rabby provider for writes.

## Contract

The deployable source is [`contracts/main.py`](contracts/main.py). The public ABI snapshot is [`contract-schema.json`](contract-schema.json). The frontend is under [`frontend/`](frontend/).

## Safety model

Writes are single-submission operations. The frontend retains a transaction journal and only exposes success after finalization, semantic execution success, and authoritative readback. A timeout is reconciled by transaction hash; it is never blindly resubmitted.
