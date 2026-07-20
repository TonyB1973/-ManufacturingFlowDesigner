# Manufacturing Flow Designer

Manufacturing Flow Designer is a professional engineering application for modelling manufacturing processes, factory layouts, standard work, resource allocation, and future simulation workflows.

## Sprint 1.5 scope

Sprint 1.5 adds directed process connections between manufacturing operations on top of the workspace-separation architecture. Process Flow contains operations and connections; Factory Layout contains independently identified physical resource instances. Connections are typed domain objects with explicit operation anchors, deterministic orthogonal routing, validation, selection, editing, and lifecycle handling. Each workspace preserves its own viewport state.

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

## Workspaces

- **Process Flow** is for operations, sequencing, assignment, validation, and directed process connections. Physical resource cards cannot be placed or rendered there.
- **Factory Layout** is for machines, workstations, inspection equipment, operators, buffers, and other physical resources. Operations cannot be placed or rendered there.
- Use the accessible tabs above the canvas or Project Explorer to switch without reloading. Pan, zoom, grid, origin, and snap settings remain independent.

## Resource Templates and physical instances

Resource Templates provide reusable defaults. Dropping a template into Factory Layout creates a physical Resource Instance with a stable `RES-` ID, layout position, dimensions, active state, and capacity. Templates are never directly assignable.

Duplicate Resource creates a separately identified instance at an offset position. Editing the duplicate does not edit the original or its template. For ordinary machinery, add another physical instance instead of treating capacity 2 as two machines.

## Operation workflow

- Search or filter the 12 starter operations across manufacturing, quality, material-flow, finishing, logistics, support, storage, and planning categories.
- Drag an operation card to the canvas, focus it and press `Enter`/`Space`, or use ribbon **Add Operation**.
- Click or keyboard-focus a placed operation to select it; drag to move it in world coordinates.
- Assign only active physical Factory Layout resources. Hidden and locked resources remain assignable; inactive and deleted resources do not.
- Multiple sequential operations may use the same resource. Simultaneous capacity validation is deferred until timing and simulation exist.
- **Locate in Factory Layout** switches workspaces and reveals the assigned physical resource.
- Use Process Flow in Project Explorer to inspect sequence order and reveal an operation on the canvas.
- Use **Normalize Sequence** and confirm to renumber operations at intervals of 10.

Operation cards show sequence, cycle time, type, timing classification, resource assignment, lock state, and a validation marker. Full names remain available through the SVG tooltip and accessible label when visible text is fitted.

## Connection workflow

- Choose **Connect** on the canvas toolbar, ribbon, or press `C`.
- Click or drag from an operation. Ports appear on all four card edges; clicking near an edge uses that port, while clicking the card centre automatically chooses suitable facing ports.
- Finish on a different operation to create a directed connection. Self-connections and duplicate Standard connections are rejected.
- The router creates deterministic horizontal and vertical segments, avoids inflated operation bounds when possible, and marks a safe fallback route when no clear candidate is available. Factory Layout resources do not affect Process Flow routing.
- Click the line or its larger invisible hit target to select it. Edit type, label, lock, and visibility in Properties, or use **Reverse Direction**.
- Choose **Delete Link** and click a connection, press `Delete`/`Backspace` while it is selected, or use the right-click context menu.
- The connection context menu also selects the source or target operation. `Escape` cancels a connection preview, closes the context menu, or returns to Select.

Selected connections show their route, endpoints, anchors, route length, bend count, and validation state. The Process Flow explorer lists connections in deterministic ID order and reveals them on the canvas.

## Selection and safety

Selection is explicitly one resource, one operation, one connection, or none. Selecting any object type clears the others. `Delete`/`Backspace` and the toolbar Delete command act only on that typed selection. Locked objects remain selectable but cannot move, be deleted, or be reversed; `Escape` cancels active movement or connection creation. Middle-button drag and Space-drag continue to pan the canvas, and `Alt` bypasses snapping during placement or movement.

Deleting an assigned physical resource requires an accessible confirmation stating how many operations will become Unassigned. Locked resources cannot be deleted.

## Validation and health

Deterministic validation reports:

- invalid operation fields, template assignments, missing or invalid physical IDs, invalid layouts, resource template references, dimensions, capacity, connection endpoints, anchors, self-connections, duplicate Standard connections, and invalid routes as errors;
- unassigned operations, inactive assignments, duplicate sequences, hidden operations, fallback routes, backward sequence flow, isolated operations, multiple starts or ends, disconnected process groups, and directed cycles as warnings.

The title bar, right Validation Summary, operation cards, and status bar reflect current project health. Notes are optional and never generate noise.

## Architecture

- `models/operations` defines reusable operation templates and placed operation instances.
- `OperationStore` owns operation instances, validated mutations, deterministic sequence ordering, and normalization.
- `SelectionStore` is the single typed selection authority shared by resource and operation stores.
- `WorkspaceStore` owns active-workspace identity and independent viewport state.
- `ResourceTemplate` defines reusable defaults; `ResourceInstance` defines physical Factory Layout identity.
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
npm run test:workspaces
npm run build
```

## Current limitations

Sprint 1.5 uses a deterministic candidate-based router rather than a general maze solver. Overlapping reverse-direction connections can share the same route. Connections attach only to operation card edges and cannot be edited by dragging individual bends. There is one default Factory Layout and no walls, dimensions, resource groups, concurrency allocation, simulation, persistence, undo/redo, scenario comparison, multi-selection, custom-template editor, image uploads, or offline service worker. Resource rotation is stored and editable numerically but has no direct manipulation tool.

## Planned Sprint 2.1

Sprint 2.1 will introduce project persistence and the versioned `.mflow` file format, including safe serialization of resources, operations, connections, canvas state, and project metadata.

Development for this sprint is performed on `feature/sprint-1.5-process-connections`.
