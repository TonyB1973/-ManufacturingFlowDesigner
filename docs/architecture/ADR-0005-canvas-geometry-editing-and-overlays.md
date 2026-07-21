# ADR-0005: Canvas geometry editing and transient overlays

## Status

Accepted for Sprint 2.4.

## Context

Manufacturing Flow Designer needs accurate alignment, distribution, sizing, nudging, guide snapping, and pointer resizing without weakening workspace separation or the command-history guarantees established in earlier ADRs. Process Flow selections can contain operations and connections, while Factory Layout selections contain physical resources. Locked and hidden objects require different treatment, and temporary editing visuals must never enter `.mflow` data.

## Decision

Geometry editing is split into focused layers:

- `GeometrySelectionService` projects the typed selection into visible geometric nodes for the active workspace. Operations are eligible only in Process Flow and Resource Instances only in Factory Layout. Connections and inactive-workspace objects are ignored. Locked nodes remain available for selection bounds but are excluded from modifications.
- `GeometryBounds` defines the shared centre-based coordinate interpretation of left, right, top, bottom, and centres. Increasing world Y moves visually downward.
- `ArrangementService` performs pure, deterministic alignment, centre distribution, equal-gap distribution, and primary-object sizing calculations. Explicit arrangement results are exact and are not grid-snapped afterward.
- `ResizeGeometry` performs pure edge and corner resize calculations with destination minimums and optional original-aspect preservation.
- `GeometryCommandFactory` records complete before/after geometry for all affected objects as one reversible command. Operation edits batch a derived connection-route recalculation after the model update.
- `AlignmentGuideService` performs pure guide matching. The controller caches visible, non-selected active-workspace candidate bounds at gesture start and converts a seven-pixel tolerance to world units at the current zoom.
- `SelectionOverlayRenderer` owns transient aggregate bounds and eight resize handles in the interaction layer. `ResizeInteractionController` owns pointer capture, live updates, cancellation, snapping, and the final history command.

The snap priority for drag and resize gestures is an object-alignment guide within tolerance, then the project grid. Holding Alt bypasses both. Guides may still be displayed when normal snap is disabled, but they do not alter geometry. Shift on a corner resize preserves the original aspect ratio while keeping the opposite corner fixed. Side handles do not apply aspect preservation.

Arrow-key nudges move all unlocked eligible nodes by one world unit, ten with Shift, or the configured base grid interval with Ctrl/Command. Visual up subtracts Y. Each handled nudge is a reversible command; editable controls retain native arrow-key behaviour.

Alignment and match-size commands require two unlocked eligible nodes. Distribution and equal-gap commands require three. Equal-gap commands stop without mutation if the fixed endpoint span cannot contain non-negative gaps. Match commands use the primary eligible node as their size reference; edge and centre alignment use the aggregate bounds named by the command.

Selection bounds, resize handles, guide lines, candidate caches, pointer state, and Arrange UI state are transient. They are excluded from project persistence, dirty tracking, and domain models.

## Consequences

- Process connections may remain selected but are never directly transformed; their routes are derived again after operation geometry changes.
- Explicit geometry actions preserve exact equality and generate at most one history entry.
- Disabled or unchanged actions generate no history entry and do not dirty the project.
- Locked selected nodes are reported as skipped, hidden objects are excluded, and inactive-workspace objects cannot participate.
- The `.mflow` schema remains `1.0.0` because only existing position and dimension fields change.
- Rotation handles, centre resize, permanent groups, rulers, dimensions, walls, manual waypoints, and persistent guides remain outside Sprint 2.4.

## Alternatives considered

Embedding calculations in canvas event handlers was rejected because it would make mathematical behaviour difficult to test and couple domain edits to SVG. Persisting guide or selection-overlay state was rejected because it is transient presentation state. Applying grid snapping after Arrange commands was rejected because it can destroy the equality the user explicitly requested.
