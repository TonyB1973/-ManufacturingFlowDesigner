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

