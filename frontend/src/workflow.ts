export function actionsForPhase(phase?: string): string[] {
  if (!phase) return ["create_graph"];
  if (phase === "BASE_DRAFT") return ["replace_graph", "lock_graph"];
  if (phase === "BASE_LOCKED") return ["put_replies"];
  if (phase === "RESPONSE_DRAFT") return ["put_replies", "freeze_replies"];
  if (phase === "FROZEN") return ["evaluate_closure"];
  if (phase === "UNRESOLVED") return ["retry_closure"];
  return [];
}
