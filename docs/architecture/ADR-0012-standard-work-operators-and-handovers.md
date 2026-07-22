# ADR-0012: Standard Work operators and handovers

## Status

Accepted for Sprint 3.1.

## Context

The Sprint 3.0 Combination Chart used one implicit operator cursor. Real standard work needs named study participants, parallel human timelines, explicit work allocation, and cross-operator release constraints without duplicating Process Flow timing or confusing a study participant with a physical Factory Layout resource.

## Decision

Each `StandardWorkStudy` owns one or more persistent `StandardWorkOperator` records identified by stable `SWO` IDs. An operator owns a name, role, lane order, active state, notes, and an optional stable link to a physical `ResourceInstance`; the link is informational and never copies resource data. Creating a study creates `Operator 1` in the same reversible command. The active operator with the lowest `displayOrder`, then lowest stable ID, is the deterministic primary operator for newly added entries.

Every `StandardWorkEntry` references exactly one operator in its study through `assignedOperatorId`. The assignment expresses who performs, launches, or owns that entry. `OperationInstance.assignedResourceId` independently identifies the physical manufacturing resource. `OperationInstance.cycleTimeSeconds × occurrences` remains the only effective duration; operators, entries, handovers, chart blocks, and workload summaries contain no editable duration copy.

Scheduling uses one cursor per operator. Enabled entries are processed by study order and stable entry ID, but that order is deterministic evaluation order rather than a global serial timeline. Manual, Walking, and Waiting work begins at the later of its operator cursor and inbound handover release, then advances only that cursor. Automatic work begins at the same earliest start, records its launch operator, appears on its assigned physical-resource lane, and advances no operator cursor. This permits parallel operator work while retaining deterministic results.

Derived workload per operator reports Manual, Walking, Waiting, occupied, productive, dependency-idle, sequence-end, entry-count, Automatic-launch count and launched duration, and occupied share of chart span. Automatic duration is excluded from operator occupied time. Overall operator end is the maximum cursor, and chart cycle span is the maximum of overall operator end and latest Automatic completion—not the sum of lane durations.

`StandardWorkHandover` is a persistent, stable `SWH` zero-duration dependency between two entries in one study. It stores no transfer time. A valid handover is unique, non-self-referential, forward in study order, and acyclic. A target begins no earlier than the maximum end of its enabled inbound sources. A resulting gap is derived dependency idle, never a fabricated Waiting block. Real walking, waiting, transfer, or communication work must be represented by an explicit operation. Same-operator handovers remain valid data and receive a redundancy warning.

Deleting an operator with assigned entries requires another operator in the study; one compound command reassigns entries and deletes the operator while preserving handovers. The final operator cannot be deleted. Deleting a physical linked resource clears only the operator link. Deleting an entry or referenced operation removes attached handovers in the same reversible action. Study duplication allocates new SW, SWO, SWE, and SWH IDs and remaps operator assignments and handover endpoints while retaining operation and physical-resource references.

Operator records, entry assignments, handovers, and display settings are persisted in `.mflow` schema `1.7.0`. Schedules, cursors, workloads, dependency idle, handover paths, chart geometry, selection, zoom, and scroll remain derived or transient. The explicit `1.6.0 → 1.7.0` migration creates one deterministic `Operator 1` per existing study, assigns all legacy entries to it, and creates no handovers, preserving Sprint 3.0 timing.

The domain models, indexed stores, dependency graph, command factories, scheduler, workload service, SVG renderer, Properties UI, validation, and persistence mapping remain separate. Their plain typed contracts are compatible with a future WPF implementation.

## Consequences

- Operator lanes can run in parallel without changing global study order or Process Flow sequence.
- Reassignment can change chart start times, including an Automatic launch, without changing operation timing or physical-resource assignment.
- Operator active state is descriptive in Sprint 3.1; inactive assigned work is scheduled with a warning.
- Takt time, capacity, and work-balance analysis are deferred to Sprint 3.2.
- Availability calendars, shifts, breaks, and absence are deferred to Sprint 3.3.
- Authoritative physical-resource capacity and double-booking validation are deferred to Sprint 3.6.
