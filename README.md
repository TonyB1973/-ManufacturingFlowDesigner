# Manufacturing Flow Designer

Manufacturing Flow Designer is a professional engineering PWA for modelling manufacturing process flow, physical factory resources, resource allocation, and future standard-work and simulation workflows.

## Sprint 3.2 scope

Sprint 3.2 adds study-specific production planning and demand analysis to Standard Work. Planning Settings store the period name, scheduled production seconds, planned break seconds, planned downtime seconds, required output, active state, and notes. Net available production time is scheduled time minus breaks and downtime; **takt time** is the derived net time divided by required output. Takt is never independently editable, and `OperationInstance.cycleTimeSeconds × occurrences` remains the only entry-duration calculation.

Valid active planning adds a patterned, labelled takt line to the Combination Chart, optional beyond-takt shading, **Fit Chart and Takt**, and **Centre on Takt**. Chart cycle span is compared with takt without changing the existing multi-operator schedule. Disabling analysis preserves the planning inputs while suppressing operational over-takt and nominal-shortfall warnings.

The new **Work Balance** view provides one keyboard-selectable Yamazumi-style bar per relevant operator, a fixed-header numeric table, and Category Stack, Occupied Work, and Productive Work display modes. Category Stack separates Manual, Walking, and Waiting. Operator occupied work is Manual + Walking + Waiting; productive work excludes Waiting. Automatic time is excluded from operator bars and occupied content. Dependency idle is optional and visually separate, so a handover may extend lane completion without being misclassified as labour or an explicit Waiting operation.

Per-operator analysis reports workload percentage, spare time, overload, lane completion versus takt, entry count, and Automatic launched time. Summary analysis reports included operators, total occupied work, available operator capacity at takt, workload spread, highest assigned operator workload, and **work-balance efficiency against takt** (`total occupied / (included operators × takt)`). The theoretical minimum operator count is `ceil(total occupied / takt)` and is a mathematical lower bound, not an automatic staffing recommendation.

**Chart-based nominal capacity** is net available production time divided by current chart cycle span. It reports decimal and whole-unit capacity plus demand surplus or shortfall, but it is not simulated output and does not include variability, queueing, unentered downtime, availability calendars, or authoritative physical-resource capacity. Automatic durations are not added together because they may overlap.

Planning edits, analysis activation, takt visibility, Yamazumi mode/density/value choices, dependency-idle display, and capacity-summary visibility use normal Undo/Redo and saved checkpoints. Selection, hover, fit, calculation, chart geometry, and scrolling remain transient. Project Explorer and Properties expose planning inputs and derived analysis, and active analysis warnings contribute to project health.

`.mflow` schema `1.8.0` and application version `1.0.0` persist one planning record per study and validated display settings. The explicit `1.7.0 → 1.8.0` migration creates inactive Shift defaults (28,800 scheduled seconds, zero breaks/downtime, one required unit) without altering existing studies, operators, assignments, handovers, timing, IDs, or viewports. Derived takt, capacity, balance, diagnostics, and Yamazumi geometry are never persisted.

Current limitations intentionally exclude shift-pattern records, working calendars, absence and availability, skills, automatic balancing or staffing recommendations, final machine-capacity validation, scenarios, simulation, stochastic downtime, and export. Sprint 3.3 is planned to add **resource availability, shifts and calendars**, including shift definitions, planned breaks, working calendars, operator and physical-resource availability, calendar exceptions, and availability-aware planning inputs.

## Sprint 3.1 scope

Sprint 3.1 makes Standard Work operators explicit study participants. Every new study creates a persistent **Operator 1** with a stable `SWO` ID, and every entry references one operator in the same study. The active operator with the lowest display order, then stable ID, is the default for newly added or populated entries. Operators support names, roles, active state, notes, ordering, duplication, and an optional live link to a physical Resource Instance without copying physical-resource data.

The Combination Chart now uses one cursor and one lane per operator. Manual, Walking, and Waiting entries advance only their assigned operator, so different operators can work in parallel even though entries retain deterministic global study order. Automatic work starts from its assigned operator's cursor, records that launch operator, remains on the lane selected by the operation's independent `assignedResourceId`, and does not advance an operator cursor. `OperationInstance.cycleTimeSeconds × occurrences` remains the only duration calculation.

Each lane presents readable operator identity, role, active/inactive state, dependency idle, launch markers, and workload totals. Workload separates Manual, Walking, Waiting, occupied and productive time, dependency idle, sequence end, entry count, and Automatic launched time. Automatic time is excluded from occupied time. Chart cycle span is still the maximum overall operator end or latest Automatic end, never the sum of parallel lanes.

Persistent `StandardWorkHandover` records use stable `SWH` IDs to express zero-duration, forward-only dependencies between entries. The target starts after the latest enabled inbound source completes, and any resulting gap is shown as **dependency idle**, not as a fabricated Waiting operation. Real transfer, communication, walking, or waiting work must be modelled explicitly. Self, backward, cross-study, duplicate, and cyclic handovers are rejected; a handover that becomes same-operator is preserved with a warning.

The workspace provides operator creation, duplication, editing, ordering, entry assignment from the table or chart, keyboard-accessible assignment menus, handover creation/deletion, Project Explorer selection, and Properties editing. Chart blocks can be dragged vertically to another operator lane; Escape cancels an incomplete reassignment, and horizontal start-time dragging remains unavailable. Deleting an assigned operator requires a same-study replacement and reassigns entries atomically. Deleting an entry or operation removes attached handovers; deleting a linked physical resource clears only the operator link. Undo/Redo restores exact IDs, assignments, ordering, links, and handovers.

Study duplication allocates new SW, SWO, SWE, and SWH IDs, remaps entry assignments and handover endpoints, and retains references to existing Process Flow operations and physical resources. `.mflow` schema `1.7.0` and application version `0.9.0` persist operators, assignments, handovers, and expanded chart settings. The explicit `1.6.0 → 1.7.0` migration creates one Operator 1 per legacy study, assigns every existing entry to it, and preserves the Sprint 3.0 single-operator schedule. Calculated schedules, cursors, workloads, idle totals, paths, geometry, selection, scroll, and zoom remain excluded.

Current limitations intentionally exclude takt calculations, workload recommendations, Yamazumi charts, availability calendars, shifts, breaks, skills, automatic allocation, route-derived walking time, simulation, and authoritative resource-capacity validation. Sprint 3.2 is planned to add **takt time, capacity, and work-balance analysis**: available production time, required demand, takt calculation and chart line, operator workload comparison, Yamazumi-style visualisation, over/under-takt indicators, balance metrics, and bottleneck identification.

## Sprint 3.0 scope

Sprint 3.0 adds a professional **Standard Work Combination Chart** beside the existing Entry Table, with Entry Table, Combination Chart, and responsive Split View modes. It calculates one deterministic operator timeline from current study order and current Process Flow operation data; chart start/end values, resource lanes, summaries, diagnostics, zoom, and SVG geometry remain derived rather than saved.

The operator cursor starts at zero. Manual, Walking, and explicit Waiting entries start at the cursor and advance it. Automatic entries start at the current cursor on an automatic-resource lane and do not advance it, allowing following operator work to overlap the machine cycle. Machine loading, starting, checking, and unloading must be modelled as separate Manual operations—Automatic entries contain no invented operator launch time.

Automatic lanes use stable physical Resource Instance IDs and resolve live resource names. An Automatic operation without an assignment appears in **Unassigned Automatic**. Hidden Factory Layout resources still have lanes; inactive and missing resources receive diagnostics. Same-resource overlaps are stacked so no block disappears and are labelled as potential overlap only: authoritative resource-capacity and double-booking validation remains planned for Sprint 3.6.

**Chart cycle span** is the later of operator sequence end and latest Automatic completion. **Automatic overrun** is the positive Automatic tail after the operator sequence ends; it is not called operator waiting unless a Waiting operation explicitly exists. The summary separately reports Manual, Walking, Waiting, Automatic total, operator occupied/productive time, overlap count, zero-time count, validation, and chart span. Automatic total is a sum of block durations and may differ from the span because Automatic blocks can overlap.

The time axis supports automatic engineering intervals, validated fixed intervals, minor subdivisions, Seconds/mm:ss/hh:mm:ss formatting, 25%–800% practical zoom, Ctrl/Cmd+wheel zoom, Shift+wheel horizontal pan, Fit Chart, Reset Zoom, Home/End, and capped grid density. Blocks use category-specific colour plus border/pattern treatment, accessible descriptions, focus, safe label suppression, minimum hit targets, zero-time markers, tooltips, and timing details.

Selecting a block selects the matching entry, table row, Properties view, and Project Explorer row. Table and Explorer selection reveal the chart block. Context actions locate the referenced operation in Process Flow or assigned resource in Factory Layout while Standard Work retains its chart state. Selection, hover, zoom, pan, Fit Chart, and view switching do not create history or dirty state.

Chart Settings persist interval mode, grid and label choices, launch markers, lane IDs, automatic/disabled-entry visibility, and lane density. They use normal Undo/Redo and saved checkpoints. The `.mflow` schema is `1.6.0` and application version is `0.8.0`; explicit `1.5.0 → 1.6.0` migration adds validated chart defaults without changing studies, entries, operations, resources, factory data, IDs, or viewports. Calculated blocks, lanes, span, overrun, diagnostics, selection, scroll, and zoom are never persisted.

Keyboard chart controls include Left/Right block navigation, Home/End scroll, Plus/Minus zoom, `0` Fit Chart, Enter focus/details, Delete removal through existing Standard Work behaviour, and normal Undo/Redo shortcuts. Editable controls retain native keyboard behaviour.

Current chart scope is intentionally one operator. Multiple operators, entry operator assignment, separate operator timelines, handovers, and workload totals are planned for Sprint 3.1. Takt and balance analysis remain planned for Sprint 3.2.

## Sprint 2.9 scope

Sprint 2.9 introduces **Standard Work** as a third principal workspace beside Process Flow and Factory Layout. It uses a professional study/list/table layout rather than either CAD canvas, keeps a separate transient selection, and preserves the independent Process Flow and Factory Layout viewports while workspace changes safely cancel incomplete canvas gestures.

Persistent `StandardWorkStudy` records own study metadata, revision, active state, notes, and stable `SW-####` identity. Ordered `StandardWorkEntry` records own only stable `SWE-####` identity, study and operation references, order, occurrences, enabled state, and study-specific notes. An entry deliberately does not copy an operation name, resource assignment, cycle time, or timing category: each display resolves its `operationId` against the live Process Flow operation store.

Each operation has one authoritative non-negative `cycleTimeSeconds` and one timing category—Manual, Automatic, Walking, or Waiting. Effective entry duration is derived as operation cycle time × positive-integer occurrences. Disabled entries remain visible and saved but leave all totals. The workspace shows Manual, Automatic, Walking, and Waiting category totals and percentages, plus the accurately named **Sum of included operation durations**; overlap, scheduling, takt, and true operator or machine cycles are not inferred.

Create, duplicate, rename, activate, and delete studies; add an available operation; or **Populate from Process Flow**, which appends missing operations by current operation sequence and ID. Study order is then independently user-controlled with drag reorder, Move Up/Down/Top/Bottom, and keyboard commands. One operation may occur once per study; use the occurrences multiplier for repetition. A duplicate add reveals the existing entry without changing history or dirty state.

Study and entry edits, populate, ordering, occurrence and enabled changes, display-format settings, and operation timing changes use normal Undo/Redo. Deleting a referenced operation reports and atomically removes its attached Process Connections and every affected Standard Work entry; Undo restores exact IDs, references, and order. Deleting a physical resource continues only to clear operation assignments and therefore does not delete study entries.

Keyboard controls include `Insert` to add the selected available operation, `Delete` to remove the selected entry or confirmed study, `Ctrl`/`Cmd+D` to duplicate a study, `Alt+Up/Down` to reorder, `Ctrl`/`Cmd+Home/End` to move to an end, and `Escape` to clear Standard Work selection. Normal Undo/Redo shortcuts continue to apply and editable controls retain native key handling.

Sprint 2.9 introduced `.mflow` schema `1.5.0` and application version `0.7.0`. Schema `1.4.0` migrates explicitly to empty Standard Work collections, a Seconds display setting, and the new timing-category vocabulary while preserving metadata, physical resources, factory engineering data, operations, connections, assignments, IDs, units, and workspace state. Derived durations, summaries, percentages, validation, selection, and table scroll are never persisted.

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
- current schema: `1.8.0`
- current application version: `1.0.0`

The JSON document persists project metadata, reusable resource and operation templates, physical Factory Layout resources, boundaries, walls, areas, aisles, Factory Routes, Factory Annotations, Process Flow operations and connections, Standard Work studies, operators, entries, handovers and study planning inputs, both independent viewport states, the active workspace, and engineering settings. Arrays are written in stable ID order to make files readable and source-control friendly.

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
npm run test:standard-work
npm run test:standard-work-chart
npm run test:standard-work-operators
npm run test:standard-work-balance
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
- `StandardWorkStore`, `StandardWorkOperationResolver`, `StandardWorkCalculationService`, `StandardWorkValidationService`, and `StandardWorkCommandFactory` keep persistent study data, live operation resolution, derived timing, validation, and history separate from the workspace DOM.
- `StandardWorkOperatorStore`, `StandardWorkHandoverStore`, and their command factories own study participants, allocation, dependencies, and reversible lifecycle separately from the workspace DOM.
- `StandardWorkChartScheduler` owns deterministic per-operator scheduling and automatic-resource lanes; `StandardWorkOperatorWorkloadService` owns derived workload totals; `StandardWorkChartScale` owns engineering intervals and fit calculations; the chart renderer owns SVG only.
- `StandardWorkPlanningStore`, `StandardWorkTaktService`, `StandardWorkCapacityService`, `StandardWorkBalanceService`, and `StandardWorkAnalysisValidation` keep persisted planning, derived calculations, and diagnostics independent of DOM/SVG rendering.
- Domain stores remain the runtime authorities for resources, operations, connections, factory structure, factory routes, factory annotations, Standard Work studies/entries, selection, and workspace viewports.

See [ADR-0001](docs/architecture/ADR-0001-process-flow-factory-layout-resources.md) for workspace/resource separation, [ADR-0002](docs/architecture/ADR-0002-versioned-mflow-project-persistence.md) for persistence decisions, [ADR-0003](docs/architecture/ADR-0003-command-history-and-dirty-state.md) for command history and dirty checkpoints, [ADR-0004](docs/architecture/ADR-0004-workspace-multiselection-and-application-clipboard.md) for multi-selection and clipboard rules, [ADR-0005](docs/architecture/ADR-0005-canvas-geometry-editing-and-overlays.md) for geometry editing and transient overlay decisions, [ADR-0006](docs/architecture/ADR-0006-factory-footprints-rotation-clearance.md) for physical footprints, rotation, clearance, and overlap analysis, [ADR-0007](docs/architecture/ADR-0007-factory-boundaries-walls-areas-aisles.md) for factory structure and policy validation, [ADR-0008](docs/architecture/ADR-0008-factory-walking-material-routes.md) for Factory Route identity, endpoints, lifecycle, and workspace separation, [ADR-0009](docs/architecture/ADR-0009-factory-measurement-dimensions-annotations.md) for annotations and units, [ADR-0010](docs/architecture/ADR-0010-standard-work-timing-foundations.md) for Standard Work references, timing, ordering, lifecycle, and persistence, [ADR-0011](docs/architecture/ADR-0011-standard-work-combination-chart.md) for chart scheduling, resource lanes, derived data, and settings persistence, [ADR-0012](docs/architecture/ADR-0012-standard-work-operators-and-handovers.md) for study operators, assignments, parallel cursors, handovers, workload, and schema 1.7.0, and [ADR-0013](docs/architecture/ADR-0013-standard-work-takt-capacity-balance.md) for planning inputs, derived takt, balance, nominal capacity, validation, and schema 1.8.0.

## Current limitations

The candidate-based router is not a general maze solver, reverse-direction links can overlap, one default Factory Layout is available, and there is no persistent/collaborative history, autosave/recovery, cloud sync, scenario comparison, custom-template editor, angular/radial dimensioning, concurrency simulation, or WPF history implementation yet. Browser download fallback cannot overwrite an existing file silently.

Clipboard contents are session-only and cannot be exchanged with external applications. Multi-selection supports the current single Factory Layout. Nudge command coalescing, symmetric centre resize, keyboard resize, arbitrary-angle on-canvas resize, permanent grouping, rulers, manual waypoints, and cross-workspace conversion are not implemented.

Route travel-time estimates are nominal geometric calculations, not simulation. Annotation anchor editing is currently provided through typed creation, property editing, clipboard remapping, and referenced-entity geometry changes rather than a full CAD constraint solver.

## Planned Sprint 3.3

Sprint 3.3 is planned to add **resource availability, shifts and calendars**, including shift definitions, planned breaks, working calendars, operator availability, physical-resource availability, calendar exceptions, and availability-aware planning inputs.

Development for Sprint 3.2 is performed on `feature/sprint-3.2-takt-work-balance`.
