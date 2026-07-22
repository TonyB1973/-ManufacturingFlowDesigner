# ADR-0006: Factory footprints, rotation, clearance, and overlap analysis

- Status: Accepted
- Date: 2026-07-21

## Context

Factory Layout resources need physical engineering geometry without leaking factory concepts into Process Flow. The previous resource card stored an ambiguous `height`, displayed rotation but had no complete rotation interaction, and could not represent access, maintenance, safety, loading, or operating clearance.

## Decision

Resource Instances use `worldX` and `worldY` as the centre of a rectangular physical footprint expressed by `width` and `depth`. Rotation is clockwise in screen/world coordinates, stored in degrees normalized to `[0, 360)`. Operations retain their independent card `height` and never receive resource clearance or rotation controls.

Each Resource Instance owns a deeply cloned clearance record with `enabled`, four non-negative side distances, category, and note. Clearance is authored in the resource's local coordinate system and rotates with the physical footprint. It is not added to physical area and may be hidden as transient view state without changing the model.

Pure geometry functions calculate rotated corners, asymmetric clearance polygons, AABBs, and separating-axis polygon intersection. AABB checks provide a broad phase before SAT. A tolerance requires positive penetration, so touching edges are not overlaps. Validation evaluates each visible unordered resource pair once. Active physical footprint overlap is an error; clearance-to-footprint and clearance-to-clearance are warnings. Hidden resources are excluded and inactive resources do not cause a hard footprint error.

Rotation and clearance mutations flow through reversible commands. Pointer rotation previews through the store and commits one history entry; Escape and interaction cancellation restore the original angle without history. Locking prevents position, footprint, rotation, and clearance changes. On-canvas resize is limited to zero rotation until a local-coordinate resize gesture can be guaranteed; Properties remains valid for arbitrary rotation.

Factory Layout Fit View includes enabled clearance. Explicit Fit Layout and Fit Including Clearance commands provide deterministic alternatives. Process Flow rendering, connections, fit behaviour, selection, and viewport remain separated.

Schema `1.1.0` explicitly migrates schema `1.0.0`: resource `height` becomes `depth`, resource-template `defaultHeight` becomes `defaultDepth`, missing rotation becomes zero and is normalized, and clearance defaults are added. Operation `height`, stable IDs, positions, assignments, connections, metadata, settings, and both workspace viewports are preserved. Migration completes before validation and project replacement, so the loaded project establishes a clean checkpoint.

## Consequences

Factory engineering geometry is testable without SVG or browser state, clearance cannot be confused with the physical footprint, and validation can evolve toward more footprint shapes. The current rectangle API is deliberately isolated so polygonal equipment may be added later. Arbitrary-angle canvas resizing remains deferred; the Properties panel is the supported path for those footprint changes.
