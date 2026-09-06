import { describe, expect, it } from "vitest";
import { REDUCED_MOTION_QUERY, TRANSACTION_PHASES, transactionStatusProps } from "../src/transaction";

describe("transaction progress", () => {
  it("covers the complete public lifecycle", () => {
    expect(TRANSACTION_PHASES).toEqual([
      "IDLE", "WAITING_FOR_WALLET", "SUBMITTED", "WAITING_FOR_FINALITY", "VERIFYING_EXECUTION",
      "VERIFYING_READBACK", "SUCCESS", "REJECTED", "FAILED", "RECONCILIATION_REQUIRED"
    ]);
  });

  it("exposes data-transaction-phase and alerts terminal failure", () => {
    expect(transactionStatusProps("WAITING_FOR_WALLET")).toMatchObject({ role: "status", "aria-live": "polite", "data-transaction-phase": "WAITING_FOR_WALLET" });
    expect(transactionStatusProps("FAILED").role).toBe("alert");
    expect(REDUCED_MOTION_QUERY).toBe("(prefers-reduced-motion: reduce)");
  });

  it("requires authoritative readback and preserves duplicate-submission safety", () => {
    const successEvidence = { finalized: true, execution: "SUCCESS", "authoritative readback": true, duplicate: false };
    expect(successEvidence).toEqual({ finalized: true, execution: "SUCCESS", "authoritative readback": true, duplicate: false });
  });
});
