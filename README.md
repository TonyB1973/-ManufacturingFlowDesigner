# Manufacturing Flow Designer

Manufacturing Flow Designer is a professional engineering application for modelling manufacturing processes, factory layouts, standard work, resource allocation, and future simulation workflows.

## Sprint 1.4.1 scope

Sprint 1.4.1 separates process modelling from physical factory layout. Process Flow contains manufacturing operations; Factory Layout contains independently identified physical resource instances. Each workspace preserves its own viewport state.

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

- **Process Flow** is for operations, sequencing, assignment, validation, and future process connections. Physical resource cards cannot be placed or rendered there.
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

## Selection and safety

Selection is explicitly one resource, one operation, or none. Selecting either object type clears the other. `Delete`/`Backspace` and the toolbar Delete command act only on that typed selection. Locked objects remain selectable but cannot move or be deleted; `Escape` cancels active movement. Middle-button drag and Space-drag continue to pan the canvas, and `Alt` bypasses snapping during placement or movement.

Deleting an assigned physical resource requires an accessible confirmation stating how many operations will become Unassigned. Locked resources cannot be deleted.

## Validation and health

Deterministic validation reports:

- invalid operation fields, template assignments, missing or invalid physical IDs, invalid layouts, template references, dimensions, and capacity as errors;
- unassigned operations, inactive assignments, duplicate sequences, hidden operations, and assigned inactive resources as warnings.

The title bar, right Validation Summary, operation cards, and status bar reflect current project health. Notes are optional and never generate noise.

## Architecture

- `models/operations` defines reusable operation templates and placed operation instances.
- `OperationStore` owns operation instances, validated mutations, deterministic sequence ordering, and normalization.
- `SelectionStore` is the single typed selection authority shared by resource and operation stores.
- `WorkspaceStore` owns active-workspace identity and independent viewport state.
- `ResourceTemplate` defines reusable defaults; `ResourceInstance` defines physical Factory Layout identity.
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
npm run test:workspaces
npm run build
```

## Current limitations

This sprint has one default Factory Layout and no walls, dimensions, resource groups, concurrency allocation, simulation, persistence, undo/redo, or scenario comparison. Rotation is stored and editable numerically but has no direct manipulation tool.

## Planned Sprint 1.5

Sprint 1.5 will introduce directed process connections, dynamic operation ports, and orthogonal routing exclusively in Process Flow. Future scenario testing will preserve a baseline Factory Layout.

Development for this sprint is performed on `feature/sprint-1.4.1-workspace-separation`.
