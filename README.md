# Manufacturing Flow Designer

Manufacturing Flow Designer is a professional engineering PWA for modelling manufacturing process flow, physical factory resources, resource allocation, and future standard-work and simulation workflows.

## Sprint 2.3 scope

Sprint 2.3 adds workspace-aware multi-selection, marquee selection, group movement, and an internal application clipboard for Copy, Cut, Paste, and Duplicate. These actions integrate with Sprint 2.2 command history and preserve the Process Flow / Factory Layout separation introduced earlier.

## Multi-selection and clipboard

Click selects one item. `Ctrl`/`Meta`+click toggles an item and `Shift`+click adds it. Drag empty canvas with Select active to marquee-select visible objects; hold a modifier to add or `Alt` to subtract. Factory Layout selection contains only physical resources. Process Flow selection contains operations and process connections. Switching workspace clears the transient selection.

Dragging any selected unlocked resource or operation moves the unlocked selected group. The item under the pointer is the snap reference, `Alt` temporarily bypasses snap, and the entire move is one Undo step. Locked items remain selectable and copyable but do not move or delete.

The Edit ribbon, multi-selection inspector, and keyboard provide `Ctrl`/`Meta`+`C`, `X`, `V`, `D`, and `A`. The application clipboard is internal to the current session. Resource paste creates new stable IDs and distinguishable names. Process Flow paste gives operations new IDs and appended sequences, preserves valid physical-resource assignments, and remaps only internal copied connections to the new operation IDs. Paste is rejected in the other workspace. Repeated paste uses cumulative offsets; Duplicate uses the same rules without replacing clipboard contents.

Cut, Paste, Duplicate, group move, and multi-delete are atomic reversible commands. Redo restores the same IDs allocated by the original action. Multi-resource deletion asks once and reports affected assignments; deleting resources clears those assignments without changing process links. Deleting operations still removes attached links. Clipboard and selection are not written to `.mflow`, so schema `1.0.0` is unchanged.

## Undo, Redo, and command history

Undoable actions include project metadata and engineering settings; adding, duplicating, deleting, moving, resizing, renaming, activating, showing, locking, rotating, and changing capacity for physical resources; adding, deleting, moving, resizing, renaming, sequencing, timing, assigning, showing, locking, and editing operations; and creating, deleting, reversing, labeling, typing, showing, and locking process connections.

Meaningful descriptions identify the action and affected item. Undo and Redo buttons disable immediately when unavailable and expose the next description in their tooltip. Supported shortcuts are `Ctrl+Z` for Undo, `Ctrl+Y` or `Ctrl+Shift+Z` for Redo, and the equivalent `Meta+Z`/`Meta+Shift+Z` combinations. Native editing Undo is never intercepted inside inputs, text areas, selects, or contenteditable controls.

Deleting an assigned physical resource is one compound action that restores the same resource ID and all previous operation assignments on Undo. Deleting an operation similarly includes every attached process connection and restores original IDs and anchors. Transactions execute atomically, Undo children in reverse order, and Redo them in original order.

Live resource and operation dragging remains responsive but commits only one Move history entry on pointer release. Escape, pointer cancellation, lost capture, workspace switching, project replacement, Undo, and Redo cancel incomplete interactions safely. Invalid or unchanged Properties values create no entry.

History is limited to 200 entries and is intentionally excluded from `.mflow` files. Selection, validation, derived routing, pan, zoom, Canvas Focus, workspace switching, and temporary display controls are not undoable. Both workspace viewports still persist as project data, but ordinary view navigation remains outside history.

Successful Save or Save As records the current history position as the clean checkpoint without clearing Undo or Redo. Returning exactly to that position with Undo clears the dirty marker; Redo away from it restores the marker. New and Open clear all previous-project history and start clean. A cancelled or failed save does not move the checkpoint.

## Technology

- Vite 6 and strict TypeScript
- Native semantic HTML, CSS, SVG, Pointer Events, and accessible `<dialog>` controls
- Framework-free observable state services
- File System Access and File Handling APIs where supported, with portable file-input/download fallbacks
- No UI framework, state library, icon package, canvas library, or persistence dependency

## Setup

Install a current Node.js LTS release, then run:

```shell
npm install
npm run dev
```

Open the local address shown by Vite. In PowerShell environments that block `npm.ps1`, use `npm.cmd`.

## Project files

Manufacturing Flow Designer project files use:

- extension: `.mflow`
- media type: `application/vnd.manufacturing-flow-designer+json`
- format identifier: `ManufacturingFlowDesigner`
- current schema: `1.0.0`
- current application version: `0.2.0`

The JSON document persists project metadata, reusable resource and operation templates, physical Factory Layout resources, Process Flow operations and connections, both independent viewport states, the active workspace, and engineering settings. Arrays are written in stable ID order to make files readable and source-control friendly.

Initial safety ceilings are 20 MB per file, 2,000 templates of each kind, 10,000 resources, 10,000 operations, 20,000 connections, 30 nested levels, and 200,000 inspected JSON values. They are defensive limits rather than expected working sizes.

Selection, active gestures, tool state, validation output, browser file handles, connection route points, and route status are deliberately excluded. Connection geometry is derived and recalculated once after a complete project has loaded.

Open parses, migrates, and validates a complete candidate before changing the current project. It checks format/schema compatibility, bounded file and collection sizes, finite geometry, unique IDs, template references, physical-resource assignments, connection endpoints, anchors, duplicate Standard links, workspace state, and unsafe object structure. An invalid file shows an actionable error and leaves the active project untouched. Unknown and newer incompatible schemas are rejected; future older formats require registered migration steps.

New and Open display an accessible Cancel/Discard prompt when unsaved changes exist. Closing or navigating away also invokes the browser safeguard. Save updates `modifiedUtc` and clears dirty state only after a successful write or download. Browsers with the File System Access API can reuse a selected file handle; other browsers download a new `.mflow` file and use a standard file picker for Open. Installed supporting PWAs can be registered as `.mflow` file handlers.

There is no autosave or recovery file in Sprint 2.2. Save intentionally remains an explicit engineering action.

## Workspaces and domain model

- **Process Flow** contains operations and directed process connections. Only operations expose connection ports.
- **Factory Layout** contains independently identified physical Resource Instances. It never renders process links or exposes connection tools.
- Resource Templates are reusable definitions and are never directly assignable.
- Operations reference only stable physical resource IDs. Deleting a resource clears affected assignments without changing process connections.
- Deleting an operation removes its attached process connections.
- Process Flow and Factory Layout retain independent pan, zoom, grid, origin, and snap state, including across save/open.

Connection routes are deterministic horizontal/vertical paths around visible operations. Physical Factory Layout resources never participate in Process Flow routing. Locked, hidden, inactive, assignment, capacity, timing, notes, positions, dimensions, rotations, visibility, connection types, labels, anchors, and stable IDs all round-trip through `.mflow`.

## Typical persistence test

1. Place and edit operations in Process Flow, including an operation with no physical assignment.
2. Create one or more directed connections and edit their type or label.
3. Place and edit physical resources in Factory Layout, then assign an active physical resource to an operation.
4. Change each workspace viewport independently and edit Project Properties from the Explorer root.
5. Use **File → Save As** and choose or download a `.mflow` file.
6. Make another persistent edit and confirm the dirty marker appears; ordinary selection must not create it.
7. Use **File → New**, test both Cancel and Discard in the unsaved-changes dialog, then open the saved file.
8. Confirm metadata, IDs, references, geometry, visibility/lock state, both viewports, active workspace, and connections are restored. Routes may be geometrically rebuilt because they are derived.
9. Try opening malformed JSON or a file with a missing reference and confirm the current project remains unchanged.

## Development commands

```shell
npm run typecheck
npm test
npm run test:coordinates
npm run test:resources
npm run test:operations
npm run test:connections
npm run test:workspaces
npm run test:persistence
npm run test:history
npm run test:editing
npm run build
git diff --check
```

## Architecture

- `models/project/ProjectDocument.ts` is the typed schema contract and format constants.
- `ProjectSchemaValidator` applies structural, safety, and referential-integrity checks.
- `ProjectMigrationService` owns explicit ordered schema migrations.
- `ProjectSerializer` produces deterministic plain JSON and excludes transient/derived state.
- `ProjectSessionService` owns metadata, settings, dirty state, coordinated replacement, and stable-ID continuation.
- `ProjectFileService` isolates browser file capabilities and fallbacks.
- `ProjectFileController` coordinates user commands, unsaved guards, save completion, launch files, and error reporting.
- `CommandHistoryService` owns bounded linear history, transactions, Undo/Redo state, and saved checkpoints.
- `CommandFactory` creates focused reversible commands for normal persistent model edits.
- `HistoryController` coordinates ribbon/keyboard actions, interaction cancellation, and status feedback.
- Domain stores remain the runtime authorities for resources, operations, connections, selection, and workspace viewports.

See [ADR-0001](docs/architecture/ADR-0001-process-flow-factory-layout-resources.md) for workspace/resource separation, [ADR-0002](docs/architecture/ADR-0002-versioned-mflow-project-persistence.md) for persistence decisions, [ADR-0003](docs/architecture/ADR-0003-command-history-and-dirty-state.md) for command history and dirty checkpoints, and [ADR-0004](docs/architecture/ADR-0004-workspace-multiselection-and-application-clipboard.md) for multi-selection and clipboard rules.

## Current limitations

The candidate-based router is not a general maze solver, reverse-direction links can overlap, one default Factory Layout is available, and there is no persistent/collaborative history, autosave/recovery, cloud sync, scenario comparison, custom-template editor, walls/dimensions, concurrency simulation, or WPF history implementation yet. Browser download fallback cannot overwrite an existing file silently.

Clipboard contents are session-only and cannot be exchanged with external applications. Multi-selection supports the current single Factory Layout and does not yet provide alignment, distribution, grouping, or cross-workspace conversion tools.

Sprint 2.4 is planned to add alignment, distribution, sizing, and advanced canvas editing tools.

Development for this sprint is performed on `feature/sprint-2.3-multiselect-clipboard`.
