# ADR-0011: Standard Work Combination Chart

## Status

Accepted for Sprint 3.0.

## Context

Standard Work studies contain ordered references to Process Flow operations, but a useful engineering chart needs deterministic start/end timing, operator occupancy, concurrent automatic processing, and physical-resource lanes. These values change whenever the referenced operation timing, category, assignment, entry occurrences, enabled state, or study order changes. Persisting calculated chart geometry or timing would create a second authority and stale project data.

## Decision

Sprint 3.0 implements one derived single-operator Standard Work Combination Chart. `OperationInstance.cycleTimeSeconds` remains the only authoritative operation duration. Effective entry duration remains `cycleTimeSeconds × occurrences`; entries, chart blocks, schedules, lanes, and chart settings do not copy an editable duration.

Enabled entries are processed by study order with stable ID as the secondary key. The operator cursor starts at zero. Manual, Walking, and Waiting entries start at the cursor, occupy the operator lane, and advance the cursor by their effective duration. An Automatic entry starts at the current cursor, appears on an automatic-resource lane, and does not advance the cursor. Manual machine loading, starting, checking, and unloading must therefore be represented as separate Manual operations; no hidden launch time is invented inside Automatic operations.

Automatic lanes use the assigned physical `ResourceInstance` ID as their stable identity and resolve the current resource name dynamically. Unassigned Automatic entries use a distinct Unassigned Automatic lane. Hidden Factory Layout resources still resolve because resource visibility is canvas view state. Automatic blocks that overlap on one resource lane are stacked and reported as potential overlap. This is preliminary chart information, not authoritative capacity or double-booking validation; that analysis is deferred to Sprint 3.6.

The operator sequence end is the end of the final operator-occupying block. The latest automatic completion is the greatest Automatic end time. **Chart cycle span** is the maximum of these values. **Automatic overrun** is the positive amount by which latest automatic completion exceeds operator sequence end. It is informational and is never described as operator waiting unless an explicit Waiting operation exists.

`StandardWorkChartScheduler` returns a UI-independent schedule containing blocks, resource lanes, summaries, and deterministic diagnostics. Grid selection and scale calculations are separate from scheduling. SVG rendering and pointer/keyboard interaction are presentation concerns. Recalculation mutates no project record, creates no history, and does not mark the project dirty.

Persistent project Standard Work settings now contain validated chart-display defaults, including interval mode, grid subdivisions, labels, launch markers, automatic/disabled visibility, and lane density. These changes use reversible project-setting commands. Session zoom, pan, selection, hover, tooltip, and view switching remain transient.

Schema `1.6.0` adds the chart settings. The explicit `1.5.0 → 1.6.0` migration supplies sensible defaults while preserving every existing authored entity, reference, stable ID, setting, and workspace viewport. Calculated block start/end values, lanes, cycle span, overrun, diagnostics, SVG geometry, scroll, and selection are excluded from `.mflow`.

## Consequences

- Operation time/category, resource assignment/name/state, entry occurrences/enabled state, and entry order immediately rebuild the active chart from current stores.
- Manual, Walking, and Waiting time contributes to operator occupancy; Automatic time does not.
- Automatic total is a sum of block durations and may differ from chart cycle span because Automatic blocks can overlap.
- Zero-duration entries remain selectable markers and never receive fabricated duration.
- Chart selection synchronizes with the entry table and Project Explorer without history or dirty state.
- The plain schedule and settings types remain suitable for a future WPF renderer.
- Multiple operators, assignments, handovers, and separate operator lanes are deferred to Sprint 3.1.
- Takt and work-balance analysis are deferred to Sprint 3.2.
- Resource-capacity and double-booking validation are deferred to Sprint 3.6.
