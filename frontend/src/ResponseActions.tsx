type Props = { phase?: string; canWrite: boolean; onWrite: (method: string) => void };

export function ResponseActions({ phase, canWrite, onWrite }: Props) {
  return (
    <div className="editor-actions">
      <button className="btn btn-primary" onClick={() => onWrite("put_replies")} disabled={!canWrite}>
        Save response draft
      </button>
      {phase === "RESPONSE_DRAFT" && (
        <button className="btn btn-secondary" onClick={() => onWrite("freeze_replies")} disabled={!canWrite}>
          Freeze replies
        </button>
      )}
    </div>
  );
}
