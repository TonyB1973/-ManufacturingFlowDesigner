# ADR-0015: Scenario management and baseline comparison

## Status

Accepted for Sprint 3.4.

## Context

Engineers need to explore manufacturing alternatives without overwriting the current design or duplicating shared reference libraries. Process Flow, Factory Layout, Standard Work, and availability assignments already form one connected authored model with stable IDs, reversible commands, validation, and separate viewports. Scenario support must preserve those guarantees, keep comparisons explainable, and migrate existing projects without inventing alternatives.

## Decision

Every project contains at least one `ManufacturingScenario`, exactly one baseline designation, and one valid `activeScenarioId`. Scenario IDs use stable `SCN-####` values. A scenario owns physical Resource Instances, Operations, Process Connections, Factory Layout boundaries/walls/areas/aisles/routes/annotations, Standard Work studies/operators/entries/handovers/planning, scenario-specific availability assignments, and the Process Flow and Factory Layout viewport states.

Project metadata, engineering settings, Resource Templates, Operation Templates, Shift Definitions, Shift Breaks, Availability Calendars, and Calendar Exceptions remain shared. Shared records are stored once at project level and referenced by stable ID from scenario-owned state. Deleting a shared calendar reports use across every scenario and atomically clears or replaces its project default and all scenario-owned assignments.

New from Baseline and Duplicate Current deep-clone all scenario-owned state while preserving entity IDs. Preserved IDs are intentional: identity is scoped by scenario and enables deterministic comparison. Entities authored later use that scenario's local ID-generator position, so independent scenarios may validly allocate the same entity ID. `sourceScenarioId` records historical lineage and remains informative if the source is later deleted.

Scenario activation is navigation, not an edit. Before switching, the active store graph is snapshotted into its scenario. The target graph replaces the live stores in dependency-safe order, ID generators resume after the target's IDs, derived routes recalculate, invalid selections clear, and the target viewports restore. Activation does not add history or dirty state. Switching from title bar, Project Explorer, or the Scenarios workspace cancels incomplete interactions first.

Scenario management commands create, duplicate, rename, describe, lock/unlock, set the baseline, and delete. They use the whole-project reversible command history and restore exact scenario IDs and state on Undo/Redo. The baseline designation is metadata only: changing it never copies or overwrites state. The current baseline cannot be deleted.

Scenario-owned Process Flow, Factory Layout, and Standard Work commands are wrapped with their authoring scenario ID. Undo or Redo activates that scenario before replay. The central history boundary rejects new scenario-owned commands when the active scenario is locked, while shared-library and scenario-management commands remain available. Undo/Redo can still restore commands that predate locking.

Comparison is derived by `(entity type, stable entity ID)`. It reports added, removed, and modified entities plus changed field names using numeric tolerance. Engineering metric deltas include entity counts, total operation cycle time, nominal resource footprint, routes, Standard Work participation, operator-occupied work, and availability assignments. Results are revision-cached and invalidated by scenario changes. Comparison rows can locate an entity in the baseline or alternative's owning workspace. Comparison output, revisions, selection, health summaries, and cache state are never persisted.

Validation checks the scenario collection and every scenario's references before replacing the active project. Project health also includes inactive-scenario issues. A locked scenario is not exempt from validation.

`.mflow` schema `2.0.0` stores shared project libraries once, then `activeScenarioId` and the scenario collection. It removes the former top-level scenario-owned collections. The explicit `1.9.0 -> 2.0.0` migration creates one unlocked baseline containing every former top-level scenario-owned record and both viewports, preserves existing stable IDs and authored values, and invents no alternative.

## Consequences

- Alternatives can diverge safely while shared template and availability edits remain consistent.
- Stable IDs make comparison explainable but are unique only within an entity type and scenario, not globally across all scenarios.
- Activating a scenario can replace most live stores, so store replacement order, selection clearing, ID reset, and derived-cache invalidation are architectural responsibilities.
- Whole-project Undo/Redo may visibly switch the active scenario to preserve command meaning.
- Shared-library impact analysis must inspect inactive scenarios before deletion.
- Scenario merge/rebase, cross-scenario entity copying, optimisation, simulation, and authoritative resource-concurrency scheduling remain deferred.
