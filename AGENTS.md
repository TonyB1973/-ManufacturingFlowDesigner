# Manufacturing Flow Designer project rules

1. The application name is Manufacturing Flow Designer.
2. Never add references to NCMT unless explicitly instructed.
3. The PWA technology is Vite, TypeScript, native HTML, native CSS, and SVG.
4. Do not introduce a UI framework without explicit approval.
5. Use strict TypeScript.
6. Keep source files focused and maintainable.
7. Avoid monolithic classes and files.
8. Do not silently change the `.mflow` format once introduced.
9. The PWA and WPF versions must eventually share compatible behaviour and project data.
10. Do not claim a feature is complete unless it is implemented and tested.
11. Run the relevant checks before reporting completion.
12. Do not push or merge without explicit permission.
13. Preserve existing documentation.
14. Use the professional dark engineering visual style.
15. New functionality must not break existing working features.
16. Use accessible labels and keyboard-aware controls.
17. Record important architecture decisions in future ADR documents.
18. Keep future simulation logic separate from presentation code.
19. Keep future rendering logic separate from the manufacturing domain model.
20. Avoid unnecessary external packages.
21. Resource Templates are reusable definitions; Resource Instances are physical Factory Layout assets.
22. Operations exist in Process Flow and may reference only physical Factory Layout resource IDs.
23. Multiple sequential operations may share one physical resource; concurrency validation is deferred until timing or simulation exists.
24. Increase ordinary machinery capacity by adding physical Resource Instances rather than treating a numeric capacity as multiple machines.
25. Keep Process Flow and Factory Layout rendering, placement, selection, and viewport state separated.
26. Treat `.mflow` files as untrusted input: migrate and fully validate a candidate before replacing active project state.
27. Keep schema versions explicit; add documented migrations instead of silently changing an existing schema.
28. Persist authored domain data and both workspace viewports, but exclude transient selection, gestures, file handles, and derived route caches.
29. Mark a project clean only after a successful open, save, or Save As result; selection and validation updates do not make a project dirty.
30. Route normal persistent user edits through explicit reversible application commands; commands must not retain DOM, SVG, browser-event, dialog, or file-handle objects.
31. Keep command history transient and out of `.mflow` files. Validation, derived routes, selection, workspace switching, pan, zoom, and temporary view state are not history entries.
32. New and Open clear history and establish a clean checkpoint. Successful Save and Save As move the saved-history checkpoint without clearing history.
33. Commit a completed resource or operation drag as at most one Move command; cancellation restores the original state and creates no entry.
34. Keep multi-selection typed, workspace-specific, transient, and separate from persisted domain objects; one item is the primary selection for detailed editing.
35. Keep the application clipboard in memory and store only plain model snapshots. Copying Process Flow operations includes only connections whose two endpoints are copied.
36. Paste and Duplicate must allocate fresh stable IDs, remap copied connection endpoints, select inserted items, and execute as one reversible command with stable IDs on Redo.
37. Group moves and multi-delete are compound history actions. Locked items are not moved or deleted, and resource deletion continues to clear only affected assignments.
38. Canvas geometry commands operate only on visible geometric nodes in the active workspace: operations in Process Flow and physical Resource Instances in Factory Layout; process connections are never transformed directly.
39. Keep geometry calculations, transient SVG overlays, pointer interactions, and reversible model commands separate. Selection bounds, resize handles, guide caches, and gesture state are never persisted or added to history.
40. Explicit alignment, distribution, equal-gap, and sizing results are mathematically exact and must not receive a second grid-snap pass. During pointer gestures, alignment-guide snap has priority over grid snap, and Alt bypasses both.
41. Locked selected objects may contribute to displayed selection bounds but are skipped by geometry mutations. Hidden and inactive-workspace objects are never eligible.
42. Factory Layout resource `worldX` and `worldY` are the centre of its physical footprint; use `width` and `depth` for physical dimensions and reserve operation `height` for Process Flow cards.
43. Normalize persisted resource rotation to `[0, 360)`. Rotation, clearance, and footprint edits are Factory Layout-only, respect locks, and are reversible commands; cancelled gestures restore without history.
44. Clearance belongs to each Resource Instance, rotates with its footprint, is deeply cloned, and remains distinct from the physical footprint in validation and summaries.
45. Derive footprint and clearance overlap with rotated-polygon geometry, AABB broad phase, positive-penetration tolerance, and one result per unordered pair. Hidden resources are excluded and inactive footprint overlap is not a hard error.
46. Factory boundaries, walls, areas, and aisles are authored Factory Layout entities; they must never render or become selectable in Process Flow.
47. Keep one valid orthogonal boundary per Factory Layout. Treat boundary replacement as one reversible transaction and reject diagonal, degenerate, or self-intersecting geometry.
48. Keep walls, areas, and aisles separate from Resource Instances. Resource placement policy belongs to areas, while wall and aisle obstruction is derived validation rather than persisted state.
49. Route persistent factory-structure changes through reversible commands with stable typed IDs; transient drawing previews, layer visibility, and selections remain outside project persistence.
50. Schema `1.2.0` owns the factory-structure collections and explicitly migrates `1.1.0` projects by adding empty collections without changing resources, clearances, operations, connections, or viewports.
51. Factory Routes are authored Factory Layout entities and must remain separate from Process Connections; they never render, select, or expose tools in Process Flow.
52. Factory Route endpoints are typed resource, area, or free endpoints. Attached endpoints store a perimeter side and normalized offset and follow the referenced entity's move, resize, and rotation.
53. Keep Factory Route waypoints orthogonal and persist authored endpoints and waypoints only. Resolved endpoint coordinates, distance, travel time, validation, drawing previews, ports, edit handles, and route-layer visibility are derived or transient.
54. Route creation, geometry/property edits, reversal, deletion, paste, and duplication must be reversible commands with stable `FRT` IDs. Locked routes reject direct geometry edits and direct deletion.
55. Copying Factory Layout entities remaps route endpoints when their referenced resource or area is copied, preserves valid uncopied references, offsets free endpoints and waypoints, and inserts the complete selection as one history action.
56. Deleting a Resource Instance or Area removes every attached Factory Route in the same reversible action. Resource deletion still clears operation assignments and never changes Process Connections.
57. Route validation may use boundaries, walls, resources, clearances, areas, and aisles, but derived issues and summaries must not be stored in `.mflow`.
58. Schema `1.3.0` owns `factoryRoutes` and explicitly migrates `1.2.0` projects by adding an empty collection without changing existing authored data or workspace viewports.
59. Factory measurements are transient Factory Layout interactions; persistent dimensions, coordinates, text, and leaders are typed `FactoryAnnotation` entities and must never render or select in Process Flow.
60. Annotation anchors reference free world points or stable Factory Layout entity IDs and geometric features. Resolve attached coordinates from current model geometry; do not persist resolved coordinates or derived measurement values.
61. Annotation creation, editing, deletion, clipboard insertion, and dependency cascades are reversible. Deleting a referenced entity removes dependent annotations atomically, including annotations attached to routes deleted by the same action.
62. Keep model length units separate from display units. Conversion and formatting are pure domain services; drawing geometry remains in the model unit and unit changes never rescale authored geometry.
63. Schema `1.4.0` owns `factoryAnnotations` and unit/annotation settings and explicitly migrates `1.3.0` projects without changing prior authored data or workspace viewports.
64. Standard Work is a separate non-CAD workspace with its own transient typed selection; it references Process Flow `OperationInstance` IDs and never owns copied operation or physical-resource data.
65. Keep one authoritative non-negative `cycleTimeSeconds` and one Manual, Automatic, Walking, or Waiting `timingCategory` on each operation. Standard Work entry durations are derived from operation time and occurrences and are never persisted.
66. A study contains an operation at most once, uses occurrences for repetition, and owns an independently ordered entry list that does not mutate or silently follow Process Flow sequence after initial population.
67. Deleting an operation atomically deletes attached Process Connections and affected Standard Work entries; Undo restores exact operation, connection, SW/SWE IDs, references, and entry order. Resource deletion still clears assignments without deleting Standard Work entries.
68. Schema `1.5.0` owns Standard Work studies, entries, and display settings and explicitly migrates `1.4.0` projects without changing existing authored project data or canvas viewports.
69. Standard Work charts are derived single-operator schedules: Manual, Walking, and Waiting advance the operator cursor; Automatic starts at the cursor on a resource lane and does not advance it.
70. Chart cycle span is the maximum of operator sequence end and latest Automatic completion. Automatic overrun is the positive Automatic tail and is not operator waiting without an explicit Waiting operation.
71. Keep `OperationInstance.cycleTimeSeconds` authoritative. Never persist chart block times, calculated lanes, span, overrun, diagnostics, SVG geometry, chart selection, zoom, or scroll.
72. Automatic lanes use physical Resource Instance IDs, resolve names dynamically, and retain an Unassigned Automatic lane. Same-resource overlap is preliminary chart information until authoritative capacity validation in Sprint 3.6.
73. Schema `1.6.0` owns validated persistent Standard Work chart-display settings and explicitly migrates `1.5.0`; chart settings are undoable, while calculation, selection, zoom, pan, and Fit Chart are not history actions.
74. Standard Work operators are study-specific participants with stable `SWO` IDs; entry assignments reference an operator in the same study, while an optional physical-resource link remains informational and stores no copied resource data.
75. Every study has at least one operator. Study creation includes `Operator 1` atomically, and the active operator with lowest display order then stable ID is the deterministic default for new entries.
76. Multi-operator scheduling uses one cursor per operator. Manual, Walking, and Waiting advance only the assigned cursor; Automatic starts from its assigned operator cursor, records that launch operator, and advances no operator cursor.
77. Standard Work handovers are stable `SWH` zero-duration forward dependencies. Dependency idle is derived and distinct from explicit Waiting; model real transfer or waiting work as an operation.
78. Operator deletion with assigned entries requires same-study reassignment and preserves handovers. Entry and operation deletion cascade attached handovers; physical-resource deletion clears only operator links and operation assignments.
79. Schema `1.7.0` owns operators, entry assignments, handovers, and their chart settings. Operator cursors, workloads, schedules, dependency idle, and handover geometry remain derived and excluded from persistence.

