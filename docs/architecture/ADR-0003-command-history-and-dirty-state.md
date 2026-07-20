# ADR-0003: Command history and dirty-state checkpoints

- Status: Accepted
- Date: 2026-07-20

## Context

Manufacturing Flow Designer needs reliable multi-step Undo and Redo across project metadata, physical resources, operations, assignments, and process connections. History must cooperate with `.mflow` persistence without retaining complete project documents, DOM/SVG objects, browser events, file handles, or derived route data.

## Decision

Persistent user edits use explicit reversible application commands executed against a domain-only `CommandExecutionContext`. Commands carry an ID, meaningful description, timestamp, affected entity IDs, and workspace context where applicable. Commands retain only the before/after values or plain serialisable entity snapshots needed for their own reversal. History is not serialized into `.mflow` files and is not part of the shared schema.

`CommandHistoryService` maintains one bounded linear sequence and a current position, presenting it as Undo and Redo stacks. Executing after Undo discards the Redo branch. The default maximum is 200 entries; the oldest entries are released when the limit is exceeded. An absolute position offset preserves checkpoint comparison when old entries are trimmed. If a new edit discards a Redo branch containing the saved checkpoint, that checkpoint becomes unreachable and the project remains dirty until the next successful save.

Transactions execute child commands in order and commit as one `CompositeCommand`. Undo runs children in reverse order and Redo in original order. Cancelling rolls back executed children. Nested transactions are rejected. If a transaction child fails, already executed children are rolled back and no history entry is added.

Resource and operation drags retain their existing live model/render updates for responsiveness. The interaction records the original position, then commits exactly one Move command on pointer release when the final position differs. Escape, pointer cancellation, lost capture, workspace changes, New/Open, Undo, and Redo cancel the active gesture and restore its original position without a history entry. Properties inputs commit on valid change or Enter; unchanged and invalid values create no command. Conservative command merging is deliberately deferred because field changes already commit once and unreliable merging would obscure engineering intent.

Selection remains transient. Undo that restores a deleted entity selects that entity where natural; deletion clears a selection that would otherwise point to missing state. Selection is never an independent command. Pan, zoom, workspace switching, Canvas Focus, grid/origin/snap view state, validation, status messages, route recalculation, and file operations remain outside command history. Both viewport states continue to persist in `.mflow`, but view navigation does not affect Undo or dirty state.

Dirty state is derived from a saved-history checkpoint when history is attached. New and Open replace domain state without commands, clear both Undo and Redo, and establish a clean checkpoint. Save and Save As establish a checkpoint only after the existing file service reports successful write/download initiation. Save As preserves history. Saving while Redo entries exist marks the current position clean and leaves those Redo entries available; Redo then moves away from the checkpoint and makes the project dirty.

Normal UI mutation paths use `CommandFactory`. Store replacement during New/Open, live drag previews, validation notifications, route recalculation, selection synchronization, and viewport persistence remain controlled direct paths. Store APIs are retained as domain primitives and for automated tests, future non-UI integrations, and deserialization; callers that represent user edits must use commands.

## Consequences

- Delete Resource restores the same resource ID and affected assignments as one action.
- Delete Operation restores the same operation and attached connection IDs/anchors as one action.
- Connection creation, deletion, and reversal recalculate derived routes after Execute, Undo, and Redo.
- History memory is bounded and contains no browser or presentation objects.
- The command boundary and plain model snapshots can be reproduced in a future WPF client even though this sprint implements only the PWA.
- Collaborative/branching/persistent history, autosave, recovery, macros, copy/paste, and multi-selection remain future work.
