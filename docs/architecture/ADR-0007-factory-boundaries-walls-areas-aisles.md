# ADR-0007: Factory boundaries, walls, areas, and aisles

- Status: Accepted
- Date: 2026-07-22

## Context

Factory Layout needs authored building and circulation structure in addition to physical Resource Instances. A boundary defines usable floor extent, walls represent physical obstructions, named areas communicate manufacturing intent and resource-placement policy, and aisles reserve pedestrian or material movement corridors. These concepts must not leak into Process Flow operations or process connections.

## Decision

Boundary, wall, area, and aisle are separate typed entities owned by `FactoryStructureStore` and scoped to a Factory Layout ID. Each family has its own stable ID sequence. A layout has at most one active boundary. Boundary and aisle paths are orthogonal; wall centre-lines are horizontal or vertical; areas are finite rectangular zones. Pure geometry functions validate, simplify, measure, contain, and intersect these shapes independently of SVG and browser state.

Factory structure is drawn and rendered only in Factory Layout. Its explicit layer order is boundary, areas, aisles, walls, then physical resources. Layer visibility is transient and does not disable validation. Drawing controllers convert pointers through the shared viewport transform, apply optional grid snap, keep previews transient, cancel safely, and commit a completed entity through one reversible command. Replacement of the single boundary is also one command.

Areas carry an explicit `Allowed`, `Warning`, or `Prohibited` Resource Instance placement policy. Validation derives boundary escape, wall collision, clearance-to-wall, policy overlap, and aisle obstruction issues. Persisted shapes never contain cached validation results. Project Explorer and the Inspector use the typed selection model to navigate and edit structure without reclassifying a structure entity as a resource.

Schema `1.2.0` adds `layoutBoundaries`, `walls`, `areas`, and `aisles`. Migration from `1.1.0` creates empty collections and preserves all existing resources, clearances, operations, connections, metadata, settings, stable IDs, and independent workspace viewports. Selection, drawing previews, layer visibility, validation results, and renderer caches remain transient.

## Consequences

Factory structure can evolve independently from equipment and Process Flow, and its engineering rules are testable without the UI. A single authoritative store provides deterministic serialization and stable-ID restoration. Walking and material-flow routes remain a separate planned concern for Sprint 2.7 and are not represented by aisles or process connections.
