# Manufacturing Flow Designer

Manufacturing Flow Designer is a professional engineering application for modelling manufacturing processes, factory layouts, standard work, resource allocation, and future simulation workflows.

## Sprint 1.5 scope

Sprint 1.5 adds directed process connections between manufacturing operations. Connections are typed domain objects with explicit operation anchors, deterministic orthogonal routing, obstacle avoidance, validation, selection, editing, and lifecycle handling. Resources, operations, and connections share a single typed selection model while remaining separate domain concerns.

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

## Connection workflow

- Choose **Connect** on the canvas toolbar, ribbon, or press `C`.
- Click or drag from an operation. Ports appear on all four card edges; clicking near an edge uses that port, while clicking the card centre automatically chooses suitable facing ports.
- Finish on a different operation to create a directed connection. Self-connections and duplicate Standard connections are rejected.
- The router creates deterministic horizontal and vertical segments, avoids inflated operation and resource bounds when possible, and marks a safe fallback route when no clear candidate is available.
- Click the line or its larger invisible hit target to select it. Edit type, label, lock, and visibility in Properties, or use **Reverse Direction**.
- Choose **Delete Link** and click a connection, press `Delete`/`Backspace` while it is selected, or use the right-click context menu.
- The connection context menu also selects the source or target operation. `Escape` cancels a connection preview, closes the context menu, or returns to Select.

Selected connections show their route, endpoints, anchors, route length, bend count, and validation state. The Process Flow explorer lists connections in deterministic ID order and reveals them on the canvas.

## Selection and safety

Selection is explicitly one resource, one operation, one connection, or none. Selecting any object type clears the others. `Delete`/`Backspace` and the toolbar Delete command act only on that typed selection. Locked objects remain selectable but cannot move, be deleted, or be reversed; `Escape` cancels active movement or connection creation. Middle-button drag and Space-drag continue to pan the canvas, and `Alt` bypasses snapping during placement or movement.

Deleting a resource safely clears assignments from affected operations. Invalid numeric edits, empty names, non-positive cycle times, non-positive/non-integer sequences, and undersized cards are rejected without corrupting state.

## Validation and health

Deterministic validation reports:

- invalid names, sequences, cycle times, broken assignments, missing connection endpoints, invalid anchors, self-connections, duplicate Standard connections, and invalid routes as errors;
- unassigned resources, duplicate sequences, hidden operations, fallback routes, backward sequence flow, isolated operations, multiple starts or ends, disconnected process groups, and directed cycles as warnings.

The title bar, right Validation Summary, operation cards, and status bar reflect current project health. Notes are optional and never generate noise.

## Architecture

- `models/operations` defines reusable operation templates and placed operation instances.
- `OperationStore` owns operation instances, validated mutations, deterministic sequence ordering, and normalization.
- `SelectionStore` is the single typed selection authority shared by resource and operation stores.
- `OperationValidation` is a pure deterministic validation service.
- `ConnectionStore` owns connection instances, route recalculation, validated mutations, and operation-deletion cleanup.
- `ConnectionAnchors` converts normalized card-edge anchors to world coordinates.
- `OrthogonalRouter` produces deterministic obstacle-aware routes and explicit fallbacks.
- `ConnectionValidation` performs connection and whole-process topology checks.
- `OperationLibrary` and `ProjectExplorer` provide placement and ordered process navigation.
- `OperationRenderer` owns persistent SVG nodes in the dedicated `canvas-operations` layer.
- `ConnectionRenderer` owns persistent SVG paths, arrowheads, hit targets, labels, warnings, and selected anchors in the connection layer.
- `ConnectionInteractionController` owns connect previews, dynamic ports, line selection, Delete Link, keyboard commands, and the context menu.
- `OperationInteractionController` owns pointer movement and cancellation without coupling domain state to SVG.
- `RightSidebar` binds properties for resources, operations, and connections.

## Development commands

```shell
npm run typecheck
npm run test:coordinates
npm run test:resources
npm run test:operations
npm run test:connections
npm run build
```

## Current limitations

Sprint 1.5 uses a deterministic candidate-based router rather than a general maze solver. Overlapping reverse-direction connections can share the same route. Connections attach only to operation card edges and cannot be edited by dragging individual bends. The application still has no simulation, persistence, undo/redo, multi-selection, rotation, custom-template editor, image uploads, or offline service worker.

## Planned Sprint 2.1

Sprint 2.1 will introduce project persistence and the versioned `.mflow` file format, including safe serialization of resources, operations, connections, canvas state, and project metadata.

Development for this sprint is performed on `feature/sprint-1.5-process-connections`.
