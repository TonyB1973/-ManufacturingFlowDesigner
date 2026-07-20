# Manufacturing Flow Designer

Manufacturing Flow Designer is a professional engineering PWA for modelling manufacturing process flow, physical factory resources, resource allocation, and future standard-work and simulation workflows.

## Sprint 2.1 scope

Sprint 2.1 introduces safe local project persistence with the versioned, human-readable `.mflow` format. New, Open, Save, and Save As are available from the File ribbon. The UI reports the project name and dirty state in the title bar and Project Explorer, and selecting the project root exposes editable project properties.

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

There is no autosave or recovery file in Sprint 2.1. Save intentionally remains an explicit engineering action.

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
- Domain stores remain the runtime authorities for resources, operations, connections, selection, and workspace viewports.

See [ADR-0001](docs/architecture/ADR-0001-process-flow-factory-layout-resources.md) for workspace/resource separation and [ADR-0002](docs/architecture/ADR-0002-versioned-mflow-project-persistence.md) for persistence decisions.

## Current limitations and next sprint

The candidate-based router is not a general maze solver, reverse-direction links can overlap, one default Factory Layout is available, and there is no autosave/recovery, cloud sync, scenario comparison, custom-template editor, walls/dimensions, multi-selection, concurrency simulation, or WPF implementation yet. Browser download fallback cannot overwrite an existing file silently.

Sprint 2.2 is planned to add undo and redo as a separate command-history architecture, including clear policy for project replacement and dirty-state interaction.

Development for this sprint is performed on `feature/sprint-2.1-project-persistence`.
