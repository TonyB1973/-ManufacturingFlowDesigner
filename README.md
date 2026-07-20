# Manufacturing Flow Designer

Manufacturing Flow Designer is a professional engineering application for modelling manufacturing processes, factory layouts, standard work, resource allocation, and future simulation workflows.

## Sprint 1.4 scope

Sprint 1.4 adds the first process-modelling foundation: typed manufacturing operations, deterministic sequencing, resource assignment, cycle times, process validation, and a dedicated SVG operation layer. Operations are separate domain objects from physical resources and share a single typed selection model.

## Technology

- Vite and strict TypeScript
- Native semantic HTML, CSS, SVG, and Pointer Events
- Framework-free observable state services
- No UI framework, state library, icon package, or canvas library

## Setup

Install a current Node.js LTS release, then run:

```shell
npm install
npm run dev
```

Open the local address shown by Vite. In PowerShell environments that block `npm.ps1`, use `npm.cmd`.

## Operation workflow

- Switch the left library between **Resources** and **Operations**.
- Search or filter the 12 starter operations across manufacturing, quality, material-flow, finishing, logistics, support, storage, and planning categories.
- Drag an operation card to the canvas, focus it and press `Enter`/`Space`, or use ribbon **Add Operation**.
- Click or keyboard-focus a placed operation to select it; drag to move it in world coordinates.
- Edit its name, type, timing category, cycle time, sequence, assigned resource, notes, position, size, lock, and visibility in Properties.
- Use Process Flow in Project Explorer to inspect sequence order and reveal an operation on the canvas.
- Use **Normalize Sequence** and confirm to renumber operations at intervals of 10.

Operation cards show sequence, cycle time, type, timing classification, resource assignment, lock state, and a validation marker. Full names remain available through the SVG tooltip and accessible label when visible text is fitted.

## Selection and safety

Selection is explicitly one resource, one operation, or none. Selecting either object type clears the other. `Delete`/`Backspace` and the toolbar Delete command act only on that typed selection. Locked objects remain selectable but cannot move or be deleted; `Escape` cancels active movement. Middle-button drag and Space-drag continue to pan the canvas, and `Alt` bypasses snapping during placement or movement.

Deleting a resource safely clears assignments from affected operations. Invalid numeric edits, empty names, non-positive cycle times, non-positive/non-integer sequences, and undersized cards are rejected without corrupting state.

## Validation and health

Deterministic validation reports:

- invalid names, sequences, cycle times, or broken assignments as errors;
- unassigned resources, duplicate sequences, and hidden operations as warnings.

The title bar, right Validation Summary, operation cards, and status bar reflect current project health. Notes are optional and never generate noise.

## Architecture

- `models/operations` defines reusable operation templates and placed operation instances.
- `OperationStore` owns operation instances, validated mutations, deterministic sequence ordering, and normalization.
- `SelectionStore` is the single typed selection authority shared by resource and operation stores.
- `OperationValidation` is a pure deterministic validation service.
- `OperationLibrary` and `ProjectExplorer` provide placement and ordered process navigation.
- `OperationRenderer` owns persistent SVG nodes in the dedicated `canvas-operations` layer.
- `OperationInteractionController` owns pointer movement and cancellation without coupling domain state to SVG.
- `RightSidebar` binds properties for either selected object type.

## Development commands

```shell
npm run typecheck
npm run test:coordinates
npm run test:resources
npm run test:operations
npm run build
```

## Current limitations

Sprint 1.4 intentionally has no connections, ports, routing, arrows, simulation, persistence, undo/redo, multi-selection, rotation, custom-template editor, image uploads, or offline service worker.

## Planned Sprint 1.5

Sprint 1.5 will introduce explicit operation ports, directed connections, and connection routing. Those concerns remain separate from the Sprint 1.4 operation and resource domain models.

Development for this sprint is performed on `feature/sprint-1.4-operations`.
