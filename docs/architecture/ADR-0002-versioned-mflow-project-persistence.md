# ADR-0002: Versioned `.mflow` project persistence

- Status: Accepted
- Date: 2026-07-20

## Context

Manufacturing Flow Designer projects must move safely between browser sessions and, eventually, the PWA and WPF applications. A project contains user-authored domain data and independent workspace viewports, but also contains transient UI state and derived route geometry that should not become file-format commitments.

Browser file capabilities differ. Chromium-based installed PWAs may provide the File System Access and File Handling APIs, while other browsers provide only file inputs and downloads.

## Decision

Projects use human-readable JSON files with the `.mflow` extension and MIME type `application/vnd.manufacturing-flow-designer+json`. Every document identifies the `ManufacturingFlowDesigner` format, a semantic schema version, and the application version that wrote it. Schema `1.0.0` persists metadata, resource and operation templates, physical resources, operations, process connections, both workspace viewports, the active workspace, and project settings.

Stable IDs are authoritative and survive round trips. Resource Templates remain reusable definitions, while Resource Instances remain independent physical Factory Layout assets. Operations store only a physical Resource Instance ID or `null`; connections store only operation endpoint IDs. Positions, sizes, rotation, anchors, and workspace viewports use world coordinates rather than screen pixels. These rules keep the document suitable for a future WPF implementation that shares the same domain data without browser or SVG state.

Selection, gestures, tool modes, validation output, file handles, and connection `routePoints`/`routeStatus` are excluded. Routes are deterministic caches and are rebuilt once after operations and connections load.

Opening follows candidate-first replacement: read with a size limit, parse JSON, reject dangerous structure, migrate through registered schema steps, validate structure and all domain references, build a complete candidate, and only then replace the active stores. A failure leaves the active project unchanged. Loading clears selection, restores both viewports, rebuilds routes, advances stable ID generators, and emits reset notifications after the model is coherent.

New and Open guard dirty projects with an accessible Cancel/Discard dialog. Closing or navigating away uses the browser `beforeunload` safeguard. Save updates `modifiedUtc` and marks the project clean only after the file write or fallback download is initiated successfully.

The File System Access API is preferred when available so Save can reuse an authorized handle. A hidden file input and Blob download provide the portable fallback. The PWA manifest declares `.mflow` file handling, and the launch queue is consumed when the browser supports it.

Schema migration is an explicit ordered registry. Unknown schemas are rejected, and newer major versions produce a clear compatibility error. File size, collection counts, nesting depth, and object-key safety checks bound untrusted input.

## Consequences

- Schema changes require a migration step and documentation; silently changing schema `1.0.0` is prohibited.
- Domain IDs and references must remain stable across save/open.
- Browser download fallback cannot provide silent overwrite semantics; subsequent Save may download another file.
- Route algorithm changes may alter a route after open without changing the authored connection.
- Automatic recovery, cloud sync, and undo/redo remain separate future concerns.
