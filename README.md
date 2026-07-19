# Manufacturing Flow Designer

Manufacturing Flow Designer is a professional engineering application for modelling manufacturing processes, factory layouts, standard work, resource allocation, and future simulation and digital-twin workflows.

## Sprint 1.3 scope

Sprint 1.3 introduces the first genuine manufacturing resource system while preserving the responsive application shell and infinite SVG engineering canvas from Sprints 1.1 and 1.2.

It provides typed reusable templates, a searchable and filterable resource library, world-coordinate placement, single-resource selection and movement, engineering SVG visuals, validated properties, locking, visibility, deletion, status reporting, and optional grid snapping.

## Technology

- Vite and strict TypeScript
- Native semantic HTML and CSS
- Native SVG and Pointer Events
- Framework-free observable state services
- No UI framework, state library, icon package, or canvas library

## Prerequisites and setup

Install a current Node.js LTS release, then run:

```shell
npm install
npm run dev
```

Open the local address shown by Vite. In PowerShell environments that block `npm.ps1`, use `npm.cmd` in place of `npm`.

## Resource library

The left Resource Library contains 13 starter templates grouped into Machines, Manual Process, Quality, People, Material Handling, Documentation, and General categories.

- Search matches names, descriptions, resource types, and tags.
- The category selector limits the visible groups.
- **Favourites** shows only starred templates.
- The star on each card toggles that template's favourite state.
- Category groups can be collapsed independently.
- Drag a card onto the canvas to place it.
- Focus a card and press `Enter` or `Space` to place it at the canvas centre.

## Placement and selection

- Dropping uses the exact world point beneath the pointer as the resource centre.
- Click a resource to select it.
- Drag a resource to move it without changing the pointer-to-resource offset.
- Click empty canvas space or use **Clear** to clear selection.
- **Delete** or the `Delete`/`Backspace` key removes the selected unlocked resource.
- Locked resources remain selectable but cannot be moved or deleted.
- Hidden resources remain in the model and can be restored from Properties while selected.

Resource interactions take priority over background canvas interactions. Middle-button drag and Space-drag continue to pan the viewport.

## Properties

The right Properties inspector edits the selected resource without rebuilding the application shell:

- Resource name
- Read-only resource type
- World X and Y position
- Width and height with a minimum of 40 world units
- Locked state
- Visible state

Coordinates and sizes display three decimal places. Invalid, empty, non-finite, or undersized values are rejected without corrupting resource state. The Selection Summary reports resource and template IDs, name, type, position, size, and lock state.

## Grid snapping

Snap to Grid is enabled by default and uses a 20-world-unit base interval.

- Use the **Snap** toolbar toggle to enable or disable snapping.
- The status bar reports `Snap: On` or `Snap: Off`.
- Hold `Alt` while placing or moving to temporarily bypass snapping.
- Snapping affects resource centres in world coordinates and never affects viewport pan.

## Canvas navigation

- Wheel or trackpad scroll: cursor-centred zoom
- Middle-button drag: pan
- Hold `Space` and primary-button drag: temporary pan
- **Pan**: persistent primary-button pan mode
- `+` / `-`: zoom in or out
- `0`: reset to 100%
- `F`: fit origin when the canvas has focus
- **Grid**, **Origin**, and **Canvas Focus** retain their Sprint 1.2 behaviour

Keyboard canvas shortcuts are ignored while typing in inputs and editable controls. `Escape` cancels an active resource or canvas interaction.

## Architecture

- `models/resources` defines reusable templates and placed world-coordinate instances.
- `ResourceStore` owns templates, instances, selection, validation, and focused subscriptions.
- `ResourceIdGenerator` isolates stable human-readable IDs.
- `SnapService` owns world-space snapping independently of rendering.
- `ResourceLibrary` owns filtering, favourites, drag feedback, and keyboard placement.
- `ResourceRenderer` updates persistent SVG nodes in the existing `canvas-objects` layer.
- `ResourceInteractionController` owns selection, movement, pointer offset, cancellation, and deletion.
- `RightSidebar` binds validated property controls to the shared store.

## Development commands

```shell
npm run typecheck
npm run test:coordinates
npm run test:resources
npm run build
npm run preview
```

## Current limitations

Sprint 1.3 intentionally has no process operations, connections, routing, multi-selection, rotation, custom-resource editor, image uploads, persistence, undo/redo, factory-layout dimensions, Standard Work, simulation, analytics, or offline service worker.

## Planned Sprint 1.4

Sprint 1.4 will introduce operations and process-flow modelling. Connections are not part of Sprint 1.3.

Development for this sprint is performed on `feature/sprint-1.3-resource-library`.

