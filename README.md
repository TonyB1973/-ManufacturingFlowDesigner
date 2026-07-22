# Manufacturing Flow Designer

Manufacturing Flow Designer is a professional engineering PWA for modelling manufacturing process flow, physical factory resources, resource allocation, and future standard-work and simulation workflows.

## Sprint 2.8 scope

Sprint 2.8 adds Factory Layout measurement, associative dimensions, coordinate markers, text notes, and leaders. **Measure** (`M`) is session-only and reports aligned distance, horizontal/vertical components, angle, and endpoint coordinates; it never dirties or saves the project. Persistent tools create Horizontal (`H`), Vertical (`V`), and Aligned (`D`) dimensions, Coordinate markers (`Shift+C`), Notes (`N`), and Leaders (`L`). Shift constrains measurement or adds orthogonal leader elbows, Alt bypasses snapping, Escape cancels, and **Create Dimension from Measurement** promotes a completed measurement through normal command history.

Annotation anchors are typed references to free points, resources, boundaries, walls, areas, aisles, and Factory Routes. Attached annotations resolve against current geometry and therefore follow later movement, resize, rotation, or route editing; free anchors stay at authored world coordinates. Deleting a referenced entity removes dependent annotations in the same reversible action, including annotations attached to routes cascaded by resource or area deletion. Locked annotations reject geometry/property edits and direct deletion while still allowing visibility and unlock changes.

Dimensions render with extension lines, arrowheads, upright screen-readable text, unit conversion, precision overrides, prefixes/suffixes, and short-span arrow handling. Coordinate, Notes, Dimensions, and General layers can be toggled without disabling validation. Project Explorer, Inspector, fit commands, marquee selection, Copy/Cut/Paste/Duplicate, Undo/Redo, navigable validation issues, and the demonstration project all include annotations while preserving strict Process Flow / Factory Layout separation.

The `.mflow` schema is `1.4.0` and application version is `0.6.0`. Migration from `1.3.0` adds an empty `factoryAnnotations` collection and explicit unit/annotation settings without modifying prior authored geometry, routes, process data, IDs, or viewport states.

## Sprint 2.7 scope

Sprint 2.7 adds first-class Factory Routes for walking and physical material movement. Use **Route** or `T` in Factory Layout, select Walking, Material, Forklift, AGV, Tugger, or General, then choose resource/area perimeter anchors or free floor positions. Click to author orthogonal waypoints, `Enter` completes, `Backspace` removes the latest point, and `Escape` cancels without history. Resource and area endpoints follow later movement, resize, and rotation; free endpoints remain fixed world positions.

Routes are distinct from Process Connections and exist only in Factory Layout. They support Forward, Reverse, and Two Way direction, named notes, visibility, locking, enabled state, nominal speed, derived distance and estimated travel time, selection/marquee, Project Explorer navigation, Inspector editing, Fit Routes/Fit All, route/label/arrow layers, context actions, keyboard reversal, and pointer waypoint/endpoint editing. Moving an endpoint away detaches it to a free point; dropping near an eligible resource or area attaches it again.

Validation reports broken references, invalid or self-intersecting geometry, boundary escape, wall and active-resource obstruction, clearance warnings, area-policy conflicts, and aisle compatibility/coverage. Aisles remain independent reserved corridors: routes may snap to and be checked against them without becoming aisle data. Validation remains active when a display layer is hidden and appears as navigable textual issues in the Inspector.

Factory Route edits are reversible and retain stable `FRT-####` IDs through Undo/Redo. Clipboard operations assign fresh IDs, offset free geometry, and remap endpoints when copied resources or areas receive new IDs. Deleting a resource or area removes attached routes in the same reversible action; resource deletion still clears only affected operation assignments and never changes Process Connections.

The `.mflow` schema is `1.3.0` and the application version is `0.5.0`. Migration from `1.2.0` adds an empty `factoryRoutes` collection while preserving factory structure, resources, clearances, operations, process connections, metadata, settings, IDs, and independent workspace viewports.

## Sprint 2.6 scope

Sprint 2.6 adds authored factory structure to the Factory Layout workspace. Use **Draw Boundary** (or `B`) to drag a rectangular floor boundary, or choose the orthogonal boundary mode for a multi-segment outline completed with `Enter`; replacing the single existing boundary requires confirmation. **Draw Wall** (`W`) creates horizontal or vertical physical barriers with editable thickness. **Draw Area** (`A`) creates named engineering zones such as Department, Work Cell, Restricted, Hazard, and Controlled areas, with explicit Allowed, Warning, or Prohibited resource-placement policies. **Draw Aisle** (`I`) creates orthogonal pedestrian, material, forklift, shared, emergency, or general corridors with editable width and direction. `Escape` cancels drawing and `Backspace` removes the latest temporary path point.

Boundary, Areas, Aisles, Walls, and Resources render in a deliberate engineering layer order and can be shown or hidden independently without disabling their validation. Project Explorer groups every structural family, while Properties edits names, notes, visibility, locks, dimensions, types, policies, endpoints, and path coordinates. Fit Boundary frames the floor outline and Fit All includes visible factory structure and physical resources. Factory structure is never rendered or selected in Process Flow.

Validation reports entities outside the boundary, resource and clearance intersections with walls, resource-policy violations in areas, and resources, walls, or prohibited areas obstructing aisles. Emergency-aisle obstruction and prohibited placement are errors; advisory clearances and ordinary aisle obstruction are warnings. The Inspector presents a navigable textual issue list as well as floor area, structure counts, wall length, aisle length, and type summaries, so warnings do not rely on colour or small canvas icons.

Every completed create, replacement, property edit, or deletion is reversible and keeps stable IDs through Undo/Redo. Drawing previews, selections, layer switches, and validation results remain transient. The `.mflow` schema is `1.2.0`; opening a `1.1.0` project explicitly adds empty structure collections while preserving resources, clearances, operations, connections, metadata, settings, IDs, and both workspace viewports.

## Sprint 2.5 scope

Sprint 2.5 turns Factory Layout resources into engineering footprints. Every Resource Instance has centre-based `worldX`/`worldY` coordinates, physical width and depth, normalized rotation, and an independently owned optional clearance envelope with left, right, top, and bottom distances, category, and note.

Select one unlocked Factory Layout resource to use the pointer rotation handle. Rotation snaps to 5° by default, 15° with `Shift`, and is free with `Alt`; Escape restores the starting angle without adding history. The `[` and `]` shortcuts rotate by 5°, `Shift` changes the step to 15°, and `Ctrl`/`Command` changes it to 90°. Properties and the Resources ribbon also provide exact values, ±90°, reset, equal clearance, clear, and common presets. Locked resources cannot move, resize, rotate, or change clearance. For reliability, on-canvas resize handles are available at 0°; Properties can resize a resource at any rotation.

Clearance envelopes render behind physical footprints and can be hidden without changing project data. Fit View includes enabled clearance in Factory Layout; Fit Layout uses physical footprints only, while Fit Including Clearance is explicit. Rotated footprints use polygon geometry with AABB broad-phase filtering. Positive physical penetration between visible active resources is an error; touching edges are allowed. Clearance-to-footprint and clearance-to-clearance intersections are separate warnings. Hidden resources are excluded, and inactive resources do not create hard footprint errors.

The Inspector, validation list, canvas markers, accessible descriptions, Project Explorer, and selection summaries expose footprint dimensions, rotation, clearance, related resources, layout extents, active footprint area, and overlap counts. Process Flow operations and connections retain their previous model and never expose these Factory Layout tools.

The `.mflow` schema is `1.1.0`. Opening schema `1.0.0` explicitly migrates resource `height` to `depth`, preserves operation `height`, supplies missing rotation and clearance defaults, and leaves identifiers, positions, assignments, connections, and independent workspace viewports intact. Migrated projects open clean.

## Sprint 2.4 scope

Sprint 2.4 adds professional canvas geometry editing to the workspace-aware multi-selection foundation. The Arrange ribbon and eligible multi-selection menus provide left, horizontal-centre, right, top, vertical-centre, and bottom alignment; horizontal and vertical centre distribution; equal horizontal and vertical gaps; and Match Width, Match Height, and Match Size.

Alignment uses the eligible unlocked selection's aggregate edge or centre. Distribution keeps deterministic endpoint objects fixed. Equal-gap commands account for each object's dimensions and stop without changing the project when non-negative gaps cannot fit. Match commands use the primary eligible node as their dimension reference. Results remain mathematically exact and are not snapped to the grid afterward.

Select mode shows aggregate bounds for two or more visible geometric nodes and eight resize handles for one unlocked node. Handles keep stable screen-space targets through pan and zoom. Side and corner resizing respects object minimums and snaps the moving edge; hold `Alt` to bypass snapping or `Shift` on a corner to preserve the original aspect ratio and opposite corner. Escape restores the original geometry without a history entry.

Arrow keys nudge unlocked selected objects by one world unit, `Shift`+Arrow by ten, and `Ctrl`/`Command`+Arrow by the configured base grid interval. Visual up subtracts world Y. Editable fields retain native arrow-key behaviour.

Dragging and resizing cache active-workspace guide candidates and show temporary left, centre, right, top, centre, and bottom alignment guides within a seven-screen-pixel tolerance. When Snap is enabled, guide snap has priority over grid snap; `Alt` disables both. Guides, handles, bounds, and gesture state are transient and are not saved.

Process Flow geometry commands affect operations only; selected connections remain unchanged and reroute automatically when their operations move or resize. Factory Layout commands affect physical Resource Instances only. Hidden objects are excluded. Locked objects remain selectable and appear in aggregate bounds but are skipped with status feedback. Every successful arrange, size, nudge, or resize action is one reversible history command with exact Undo/Redo geometry; unavailable, unchanged, or cancelled actions do not dirty the project. The `.mflow` schema remains `1.0.0`.

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

### Demonstration project

Use **File → Load Demo** to replace the current project with a known-clean, editable manufacturing example. The demo contains an assigned five-step Process Flow and a corresponding Factory Layout with six resources, a boundary, production and logistics areas, a shared aisle, material routes, a walking route, and representative dimensions, coordinate, note, and leader annotations. Unsaved work receives the same discard confirmation used by New and Open. The demo is also exercised by `npm run test:demo` so it can remain a stable demonstration and regression baseline as later sprints add features.

## Project files

Manufacturing Flow Designer project files use:

- extension: `.mflow`
- media type: `application/vnd.manufacturing-flow-designer+json`
- format identifier: `ManufacturingFlowDesigner`
- current schema: `1.4.0`
- current application version: `0.6.0`

The JSON document persists project metadata, reusable resource and operation templates, physical Factory Layout resources, boundaries, walls, areas, aisles, Factory Routes, Factory Annotations, Process Flow operations and connections, both independent viewport states, the active workspace, and engineering settings. Arrays are written in stable ID order to make files readable and source-control friendly.

Initial safety ceilings are 20 MB per file, 2,000 templates of each kind, 10,000 resources, 10,000 operations, 20,000 connections, 10,000 Factory Annotations, 10 boundaries, 50,000 walls, 20,000 areas, 20,000 aisles, 30 nested levels, and bounded structural, route, and leader vertex counts. They are defensive limits rather than expected working sizes.

Selection, active gestures, tool state, validation output, browser file handles, process-connection route points, resolved Factory Route endpoints, distance, and travel time are deliberately excluded. Process-connection geometry is derived and recalculated once after a complete project has loaded.

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
npm run test:canvas
npm run test:factory
npm run test:structure
npm run test:routes
npm run test:annotations
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
- `GeometrySelectionService` filters the typed selection into active-workspace geometric nodes.
- `ArrangementService`, `GeometryBounds`, and `ResizeGeometry` contain deterministic, testable geometry calculations.
- `GeometryCommandFactory` commits complete multi-object geometry changes as one reversible action.
- `AlignmentGuideService`, `AlignmentGuideController`, `SelectionOverlayRenderer`, and `ResizeInteractionController` isolate transient canvas guidance and pointer interaction from the domain model.
- `FactoryFootprintGeometry` owns rotated corners, AABBs, point rotation, clearance envelopes, and SAT intersection; `FactoryLayoutValidation` derives engineering issues and summaries from resource state.
- `FactoryStructureGeometry`, `FactoryStructureStore`, and `FactoryStructureValidation` own orthogonal structural geometry, stable entities, collisions, placement policy, and summaries without depending on SVG.
- `FactoryRouteStore`, `FactoryRouteGeometry`, and `FactoryRouteValidation` own typed physical routes, derived orthogonal geometry, metrics, and engineering checks independently of Process Connections and SVG.
- `FactoryAnnotationStore`, `AnnotationAnchorResolver`, `LinearDimensionGeometry`, and `LengthUnitService` own persistent annotations, associative geometry, deterministic measurement, and unit formatting independently of SVG.
- Domain stores remain the runtime authorities for resources, operations, connections, factory structure, factory routes, factory annotations, selection, and workspace viewports.

See [ADR-0001](docs/architecture/ADR-0001-process-flow-factory-layout-resources.md) for workspace/resource separation, [ADR-0002](docs/architecture/ADR-0002-versioned-mflow-project-persistence.md) for persistence decisions, [ADR-0003](docs/architecture/ADR-0003-command-history-and-dirty-state.md) for command history and dirty checkpoints, [ADR-0004](docs/architecture/ADR-0004-workspace-multiselection-and-application-clipboard.md) for multi-selection and clipboard rules, [ADR-0005](docs/architecture/ADR-0005-canvas-geometry-editing-and-overlays.md) for geometry editing and transient overlay decisions, [ADR-0006](docs/architecture/ADR-0006-factory-footprints-rotation-clearance.md) for physical footprints, rotation, clearance, and overlap analysis, [ADR-0007](docs/architecture/ADR-0007-factory-boundaries-walls-areas-aisles.md) for factory structure and policy validation, [ADR-0008](docs/architecture/ADR-0008-factory-walking-material-routes.md) for Factory Route identity, endpoints, lifecycle, and workspace separation, and [ADR-0009](docs/architecture/ADR-0009-factory-measurement-dimensions-annotations.md) for measurement, associative anchors, annotations, and units.

## Current limitations

The candidate-based router is not a general maze solver, reverse-direction links can overlap, one default Factory Layout is available, and there is no persistent/collaborative history, autosave/recovery, cloud sync, scenario comparison, custom-template editor, angular/radial dimensioning, concurrency simulation, or WPF history implementation yet. Browser download fallback cannot overwrite an existing file silently.

Clipboard contents are session-only and cannot be exchanged with external applications. Multi-selection supports the current single Factory Layout. Nudge command coalescing, symmetric centre resize, keyboard resize, arbitrary-angle on-canvas resize, permanent grouping, rulers, manual waypoints, and cross-workspace conversion are not implemented.

Route travel-time estimates are nominal geometric calculations, not simulation. Annotation anchor editing is currently provided through typed creation, property editing, clipboard remapping, and referenced-entity geometry changes rather than a full CAD constraint solver.

## Planned Sprint 2.9

Sprint 2.9 is planned to introduce the Standard Work data model and timing foundations. Standard Work is intentionally outside Sprint 2.8.

Development for this sprint is performed on `feature/sprint-2.8-layout-dimensions-annotations`.
