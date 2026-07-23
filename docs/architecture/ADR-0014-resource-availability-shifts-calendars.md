# ADR-0014: Resource availability, shifts, and calendars

## Status

Accepted for Sprint 3.3.

## Context

Standard Work planning can derive takt from manually entered scheduled time, breaks, downtime, and demand, but it has no reusable representation of when operators and physical resources are planned to be available. Calendar support must add date-aware capacity without copying operation timing, confusing Process Flow with Factory Layout, or turning nominal analysis into an authoritative scheduler.

## Decision

`ShiftDefinition`, `ShiftBreak`, `AvailabilityCalendar`, and `CalendarException` remain separate persistent concepts. A shift stores local wall-clock start and end minutes; an end at or before its start means overnight. Its duration is derived. Breaks belong to one shift and store a shift-start offset, duration, reduction flag, and notes. They must fit inside the shift and must not overlap. Resolved wall-clock break times are derived.

An availability calendar stores an ordered stable-shift-ID list for each Monday-through-Sunday weekday. A date exception replaces, rather than adjusts, the normal day: `closed` supplies no shifts and `replaceShifts` supplies its own stable ID list. Exception dates are plain validated Gregorian `YYYY-MM-DD` values. Date-only arithmetic is independent of local timezone and UTC timestamps.

Calendar evaluation resolves each assigned date to absolute minute intervals. It counts the complete shift beginning on an assigned date, including an overnight portion after midnight. Scheduled and reducing-break intervals are independently unioned; reducing breaks are clipped to scheduled intervals and subtracted once. This prevents double-counting overlapping shifts, breaks, and adjacent overnight work. Evaluations are derived, revision-cached, bounded to 3,653 inclusive dates, and excluded from persistence.

Availability is a fourth non-CAD workspace with separate transient selection. It never renders Process Connections or Factory Routes. Workspace switching cancels incomplete canvas interactions while preserving Process Flow and Factory Layout viewport states and Standard Work state.

The project may name one default calendar. `StandardWorkOperator` and physical `ResourceInstance` may store an explicit calendar ID; null inherits the project default, and a missing effective calendar is not interpreted as unrestricted availability. Resource assignment does not affect Factory Layout geometry, operation cycle time, resource capacity, or Standard Work entry duration.

`StandardWorkPlanningParameters` retains its manual scheduled and break values and adds `manual` or `calendar` mode, an optional planning calendar ID, and date-only period boundaries. Calendar mode derives scheduled seconds and reducing-break seconds, then subtracts the existing editable planned downtime. Switching modes never overwrites manual values. Takt and chart-based nominal capacity use the resolved planning total, while entity coverage is reported separately and does not alter the Standard Work schedule or cycle span.

Included operators and resources used by enabled Standard Work entries are evaluated across the same planning period. Coverage reports net seconds, ratio, and shortfall against the planning calendar. It is diagnostic only: it does not multiply time by operation count, automatically rebalance work, or claim authoritative availability-constrained throughput.

Persistent availability changes use reversible application commands. Compound shift/calendar duplication and reference-cleaning deletion preserve or remap stable `SHF`, `SHB`, `CAL`, and `CEX` IDs as appropriate. Derived calculations, validation, preview dates, selection, scroll, and hover create no history or dirty state.

`.mflow` schema `1.9.0` persists availability collections, the project default, explicit assignments, and planning-mode fields. The explicit `1.8.0 -> 1.9.0` migration creates empty collections, null assignments/defaults, and manual planning mode with null calendar dates. It preserves every prior manual planning value and does not invent availability or produce coverage warnings solely because a legacy study remains in manual mode.

## Consequences

- Availability changes immediately recalculate calendar-mode planning and takt without changing operation or entry durations.
- Overlapping calendar shifts remain valid multi-crew inputs but produce warnings and are never double-counted.
- Missing IDs and invalid persistent date, break, or planning structures reject a candidate before the active project is replaced.
- The native TypeScript models and pure services remain suitable for a future WPF implementation.
- Scenario variants, absence records, skills, automatic allocation, availability-constrained scheduling, simulation, and stochastic downtime remain deferred.
