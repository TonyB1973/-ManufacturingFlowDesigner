# ADR-0008: Factory walking and material routes

- Status: Accepted
- Date: 2026-07-22

## Context

Factory Layout needs authored walking and material-movement paths between physical resources, manufacturing areas, and free floor positions. These paths describe physical travel, not manufacturing precedence. Reusing `ProcessConnection` would couple the independent workspaces, expose process ports on physical resources, and make deletion and persistence semantics ambiguous. Aisles also cannot represent routes: an aisle is reserved infrastructure, while a route is a directed use of the layout that may follow, enter, or leave an aisle.

## Decision

`FactoryRoute` is a first-class Factory Layout entity owned by `FactoryRouteStore`, with stable `FRT-####` IDs and route types Walking, Material, Forklift, AGV, Tugger, and General. It has an explicit direction, typed source and target endpoints, authored orthogonal waypoints, visibility, lock and enabled state, optional nominal speed, and an engineering note. Endpoints are discriminated values attached to a Resource Instance perimeter, attached to an Area perimeter, or fixed at a free world coordinate. Resource and area endpoints retain anchor side and normalized offset so they follow later movement, resize, and rotation.

Factory routes render, select, draw, edit, validate, fit, and appear in Project Explorer and the Inspector only in Factory Layout. Process Flow never renders them and `ProcessConnection` remains operation-to-operation only. Route geometry and validation are pure services outside SVG. Distance and estimated travel time are derived. Validation reports invalid or broken geometry, boundary escape, wall/resource obstruction, clearance conflicts, area policy, and aisle compatibility without persisting derived results.

Route creation and every persistent edit are reversible commands. Copy, Cut, Paste, Duplicate, deletion, and endpoint-entity deletion preserve reference integrity: copied resources or areas remap copied route endpoints to their new IDs; otherwise a still-valid existing reference is retained; free endpoints and waypoints receive the paste offset. Deleting a resource or area removes its attached routes in the same history action. Locked routes reject direct geometry edits and direct deletion, but cannot prevent deletion of the entity that owns an attached endpoint.

Schema `1.3.0` adds `factoryRoutes`. Migration from `1.2.0` creates an empty collection and preserves all existing factory structure, resources, process objects, metadata, settings, stable IDs, and both workspace viewports. Selection, drawing state, edit handles, route layer preferences, validation results, distance, time, and resolved endpoint coordinates remain transient or derived.

## Consequences

Physical movement analysis can evolve independently of manufacturing precedence and rendering. Typed endpoint ownership makes resource and area movement deterministic, while free endpoints support incomplete real-world layouts. Aisles can guide and validate routes without owning them. Sprint 2.8 may add measurement, dimensions, and engineering annotation without changing the route/process separation.
