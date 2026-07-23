# ADR-0013: Standard Work takt, capacity, and work balance

## Status

Accepted for Sprint 3.2.

## Context

Standard Work already owns study-specific entries, explicit operators, parallel operator cursors, automatic-resource lanes, and zero-duration handover dependencies. Planning analysis now needs to compare that authored work with demand without duplicating operation timing, interpreting dependency idle as labour, or presenting a deterministic chart calculation as simulated throughput.

## Decision

Each `StandardWorkStudy` owns exactly one persistent `StandardWorkPlanningParameters` record keyed by study ID. It stores a planning-period name, scheduled production seconds, planned break seconds, planned downtime seconds, required output, active state, and notes. Net available production time is:

`scheduledProductionTimeSeconds - plannedBreakTimeSeconds - plannedDowntimeSeconds`

Takt time is derived and is never editable or persisted:

`netAvailableProductionSeconds / requiredOutputUnits`

Planning inputs are elapsed durations, not dates or local-clock values. New studies receive an editable eight-hour default with analysis inactive. When analysis is inactive its inputs remain saved, the Combination Chart remains usable, and operational over-takt and capacity warnings are suppressed. Structural planning errors remain reportable.

Operator occupied work is Manual + Walking + Waiting. Productive work is Manual + Walking. Automatic duration, dependency idle, and unallocated lane gaps are excluded. Dependency idle and operator sequence end remain separate derived measures. The Yamazumi category-stack view therefore contains Manual, Walking, and Waiting segments, with dependency idle as an optional distinct segment; Automatic time may appear only in secondary information.

For valid active takt, each operator reports occupied minus takt, occupied divided by takt, workload percentage, spare time, and overload time. Relevant operators are active operators plus inactive operators that own enabled entries. Work-balance efficiency against takt is total included occupied work divided by included operator count times takt. Balance loss is the non-negative difference from 100 percent. The theoretical minimum operator count is `ceil(totalOperatorOccupiedSeconds / taktTimeSeconds)` and is explicitly a mathematical lower bound, not an optimisation recommendation.

The highest occupied workload is labelled **Highest assigned operator workload**, not the complete factory bottleneck. Ties resolve by occupied time descending, operator display order ascending, then stable SWO ID.

Chart cycle span remains the maximum of overall operator end and latest Automatic completion. Its delta and ratio are compared with takt. Chart-based nominal capacity is:

`netAvailableProductionSeconds / chartCycleSpanSeconds`

It is a deterministic estimate based on the authored Standard Work chart. It is not simulated output, does not sum Automatic durations, and is not authoritative physical-resource capacity. Capacity status uses unrounded decimal values with a small numerical tolerance.

Planning structure and numeric limits are validated independently of rendering. Invalid persistent values are structural errors. Over-takt workload, lane completion, cycle span, nominal shortfall, preliminary automatic overlap, and operator-count results are operational warnings or information and never file-corruption errors.

Planning edits and persistent display-setting changes use reversible commands and saved-history checkpoints. Takt, net time, workload ratios, capacity, balance metrics, Yamazumi geometry, diagnostics, selection, zoom, and scroll are derived or transient and create no history.

`.mflow` schema `1.8.0` persists planning inputs, active state, notes, and typed takt/work-balance display settings. The explicit `1.7.0 -> 1.8.0` migration creates one inactive default planning record per existing study while preserving every study, operator, entry, assignment, handover, timing value, ID, chart setting, and workspace viewport. The domain services and plain typed models remain suitable for future WPF use.

## Consequences

- Takt and work balance react immediately to current operation timings, entry occurrences, assignments, and handovers without copying duration data.
- A planning change never changes `OperationInstance.cycleTimeSeconds`; entry duration remains cycle time times occurrences.
- Spare time is descriptive capacity to takt and is not automatically labelled waste or converted into Waiting work.
- Shift definitions, calendars, exceptions, and availability-aware planning are deferred to Sprint 3.3.
- Authoritative resource-capacity and double-booking validation are deferred to Sprint 3.6.
- Scenario management, stochastic behaviour, simulation, and authoritative throughput remain deferred.
