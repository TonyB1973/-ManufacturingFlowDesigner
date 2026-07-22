# ADR-0009: Factory measurement, dimensions, and annotations

- Status: Accepted
- Date: 2026-07-22

## Context

Factory Layout needs engineering measurement and communication without conflating physical geometry, Process Flow links, or transient pointer feedback. Measurements must be useful without changing a project, while dimensions and callouts must persist, follow referenced objects, survive save/open, and participate in history and deletion safely. Display-unit changes must not rescale the factory model.

## Decision

Temporary measurement is a session-only Factory Layout controller. It resolves the same typed snap targets used by persistent annotation tools and derives aligned distance, horizontal and vertical components, angle, and endpoint coordinates. Its gesture, preview, result, and layer state are excluded from `.mflow` and command history.

`FactoryAnnotation` is a discriminated persistent union owned by `FactoryAnnotationStore`, with stable `ANN-####` IDs. Linear dimensions, coordinate markers, text, and leaders own only authored presentation data and typed anchors. Anchors may be free world points or references to resource, boundary, wall, area, aisle, and Factory Route features. `AnnotationAnchorResolver` derives current coordinates from domain stores; movement, resizing, rotation, and route editing therefore update attached annotation geometry without rewriting annotation data.

Persistent annotation mutations use reversible commands. Clipboard operations allocate fresh annotation IDs, offset free geometry, remap copied entity references, and retain still-valid uncopied references. Deleting any referenced entity cascades dependent annotations within the same history action. A locked annotation rejects direct geometry/property edits and direct deletion, but visibility and unlock remain available; dependency ownership may still delete it when its referenced entity is deleted.

Model and display length units are separate project settings. Geometry remains in the model unit. `LengthUnitService` performs deterministic `mm`, `m`, `in`, and `ft` conversion and formatting with explicit precision and trailing-zero policy. Individual dimensions may override precision or displayed text without changing the calculated geometry.

Annotations exist only in Factory Layout. Their SVG, interaction previews, selection handles, layer visibility, validation results, and resolved anchor coordinates are transient or derived. Schema `1.4.0` adds `factoryAnnotations` plus explicit unit and annotation defaults. Migration from `1.3.0` supplies empty annotations and default settings while preserving every prior resource, structure entity, route, operation, process connection, identifier, and viewport.

## Consequences

Engineering documentation can grow independently of Process Flow and physical-model ownership. Associative references avoid stale copied coordinates, while free anchors remain useful for incomplete layouts. Deletion is intentionally cascading and reversible to prevent broken references. Future angular, radial, tolerance, datum, and multi-layout capabilities can extend the annotation union and resolver without changing Process Connections or Factory Routes.
