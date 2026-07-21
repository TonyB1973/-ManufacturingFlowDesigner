# ADR-0004: Workspace multi-selection and application clipboard

- Status: Accepted
- Date: 2026-07-21

## Context

Manufacturing Flow Designer needs multi-object editing, copy, cut, paste, and duplication without weakening the Process Flow and Factory Layout boundary. The feature must preserve graph topology, stable identity, command-history guarantees, project dirty state, and compatibility with the future WPF implementation. Browser clipboard formats and DOM/SVG clones would couple the domain operation to one presentation technology and are unsuitable for engineering project data.

## Decision

Selection is a typed transient state containing a workspace ID, an ordered set of resource, operation, or connection references, and one primary reference. Factory Layout accepts only resource references. Process Flow accepts operation and connection references. Changing workspace clears the set and cancels active gestures. Selection is never serialized and never creates a history entry or dirty state.

Marquee selection converts its screen rectangle through the current viewport transform and tests visible entity geometry in world coordinates. Operations and resources use axis-aligned bounds; process connections use polyline-segment intersection. Locked entities remain selectable. Ctrl/Meta toggles, Shift adds, and Alt marquee subtracts. Dragging a selected unlocked item moves every selected unlocked peer of the same workspace kind, uses the primary item as the snap reference, and commits one reversible group-move command. Gesture cancellation restores every original position.

The application clipboard is a session-memory service holding plain snapshots, source workspace, copied bounds, timestamp, and cumulative paste count. It contains no DOM, SVG, event, file-handle, history, or derived route-cache objects. Factory Layout copy captures selected resources. Process Flow copy captures selected operations and only connections for which both endpoint operations are copied; standalone and boundary-crossing connection selections are omitted. Defensive limits are 5,000 resources, 10,000 operations, and 20,000 connections.

Paste is allowed only in the clipboard's source workspace. Each invocation applies a cumulative 20-world-unit offset and current grid snap, allocates fresh resource, operation, and connection IDs, gives resource copies distinguishable names, assigns operation sequences after the existing maximum in steps of ten, preserves only currently valid resource assignments, and remaps every copied connection to the new operation IDs. Paste is one reversible command; its snapshots are allocated before execution so Redo restores the same new IDs. Duplicate uses the same capture and insertion rules without replacing the application clipboard.

Cut captures first and mutates the clipboard only after any resource-deletion confirmation succeeds. Multi-delete skips locked entities, confirms physical-resource deletion once with affected-assignment counts, clears only assignments belonging to deleted resources, and removes connections attached to deleted operations. These operations are single compound history entries. Selection and clipboard remain outside `.mflow`, so schema `1.0.0` does not change.

## Consequences

- Multi-selection and clipboard state disappear on application restart and are never shared through project files.
- Process graph copies cannot create references to original operations or accidentally copy external links.
- Undo and Redo treat group move, paste, duplicate, cut, and multi-delete atomically and retain stable IDs on Redo.
- Locked objects may participate in selection and copy but are skipped by movement and deletion.
- The plain snapshot and typed-reference contracts can be reproduced in a WPF client without browser clipboard or rendering dependencies.
- Cross-workspace paste is intentionally rejected rather than converting operations to resources or resources to operations.
