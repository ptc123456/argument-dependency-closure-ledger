export const TRANSACTION_PHASES = [
  "IDLE", "WAITING_FOR_WALLET", "SUBMITTED", "WAITING_FOR_FINALITY", "VERIFYING_EXECUTION",
  "VERIFYING_READBACK", "SUCCESS", "REJECTED", "FAILED", "RECONCILIATION_REQUIRED"
] as const;

export type TransactionPhase = typeof TRANSACTION_PHASES[number];
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export const transactionStatusProps = (phase: TransactionPhase) => ({
  role: phase === "FAILED" ? "alert" : "status",
  "aria-live": "polite" as const,
  "data-transaction-phase": phase
});
