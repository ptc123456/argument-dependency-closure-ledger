# FRONTEND DESIGN RATIONALE

## Product-derived direction

Argument Dependency Closure Ledger is a public decision workbench, not a generic analytics dashboard. Its central object is a directed argument graph moving through an explicit two-party freeze-and-evaluate sequence. The presentation should therefore organize the page around one continuous case workflow and an inspectable ledger, rather than a marketing hero followed by interchangeable feature cards.

- Purpose: make closure of a bounded argument graph legible without claiming truth.
- Actors: graph owner, distinct responder, and any public evaluator/reader.
- Journey: define and freeze graph; submit and freeze direct replies; evaluate closure; inspect immutable revisions and reconcile any pending transaction.
- Data: case ID, phase, revision, outcome, graph, direct replies, result labels, immutable history, and transaction journal.
- Contract states: the active phase determines both the next valid action and whose wallet is authorized. Phase/outcome/revision must remain the strongest operational signals.

## Locked information architecture

Use a single-page **Workbench** macrostructure with a compact public orientation band, a three-stage workflow rail, one active case workspace, an immutable evidence/history area, and a persistent recovery journal. Public Docs/How it works belongs in the same page after the live workbench so a first-time judge can move from explanation to action without changing routes.

Navigation is local and task-oriented: Understand, Build graph, Respond, Evaluate, Verify. It must not imply nonexistent routes. The contract/network selector and wallet action remain globally visible because they determine whether public reads or signed writes are available.

## Visual direction

Genre: modern-minimal institutional workbench with the precision of a technical record and the restraint of a public archive. Use a graph-derived brand mark: distinct nodes connected toward a visibly closed root boundary. The mark must communicate dependency and closure without a shield, scales-of-justice cliché, blockchain cube, sparkles, or generic AI motif.

The surface should feel document-led and consequential: strong typographic hierarchy, asymmetric workbench spans, hairline rules, mostly quiet neutral surfaces, and one restrained signal color for active/verified states. Function carries the page; no photography or decorative dashboard charts are appropriate. Motion should be limited to real pending-state rotation and small transform/opacity feedback, with reduced-motion support.

## Component language

- Phase/outcome/revision: one coherent status cluster, not a field of unrelated pills.
- Workflow: an ordinal rail because the product sequence is genuinely ordered; inactive steps remain explanatory rather than pretending to be navigation.
- Actions: explicit verb + object labels derived from the current phase and role.
- Inputs: editor-like graph/reply surfaces with persistent labels and clear validation space.
- Record/history: dense but readable archival panels, using mono only for identifiers/JSON.
- Recovery: a durable transaction strip with public lifecycle terms, visible hash, and one reconciliation action; never an optimistic success toast.
- Wallet: a real chooser/dialog showing only detected supported providers, never static unavailable tiles.

## Rejected presentation patterns

- Generic SaaS hero → three feature cards → CTA: hides the actual ledger workflow.
- Equal-card dashboard grid: falsely gives every datum/action the same importance.
- Fake charts or closure percentages: would fabricate evidence and imply scoring not present in the contract.
- Neon blockchain gradients, glowing cubes, network globes, AI sparkles: generic and unrelated to the bounded argument mechanism.
- Chat transcript metaphor: replies target objection IDs rather than a conversational timeline.
- Courtroom imagery or truth-verdict language: the product evaluates closure, not truth or legal merit.
- Persistent sidebar/admin console: suggests privileged administration and wastes the single-workflow canvas.
- Excessive pills, animation, glass blur, and decorative code-window chrome: reduce institutional clarity and judge readability.

## Review criteria

The final presentation must make purpose, trust boundary, actor responsibilities, current state, next action, transaction lifecycle, immutable verification, and recovery understandable without Task history. It must preserve all existing behavior and RPC limits, use no external assets or dependencies, remain keyboard-accessible, show visible focus, support reduced motion, and have no horizontal overflow at 320, 375, 390, 414, 768, or desktop widths.
