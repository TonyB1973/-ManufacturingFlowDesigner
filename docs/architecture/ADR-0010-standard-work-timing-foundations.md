# ADR-0010: Standard Work timing foundations

## Status

Accepted for Sprint 2.9.

## Context

Manufacturing Flow Designer needs persistent Standard Work studies before it can draw meaningful combination charts or perform balance analysis. Process Flow already owns operation identity, sequence, cycle time, timing classification, and physical-resource assignment. Copying those values into an analysis workspace would create conflicting authorities and broken update behaviour.

## Decision

Standard Work is the third principal workspace and is rendered as an engineering study list, ordered table, and properties/summary view. It does not reuse the Process Flow or Factory Layout CAD canvas. Standard Work selection contains only stable study or entry IDs, remains transient, and cannot enter either canvas selection. Switching away from a canvas cancels incomplete connection, drawing, measurement, edit, drag, and resize gestures while each CAD workspace retains its own viewport.

`StandardWorkStudy` is persistent project metadata with stable `SW-####` identity. `StandardWorkEntry` is a persistent ordered membership record with stable `SWE-####` identity, a study ID, an `OperationInstance` ID, positive-integer occurrences, enabled state, and study-specific notes. Entries do not persist operation names, types, resources, cycle times, timing categories, effective durations, totals, percentages, validation, or selection.

The referenced operation remains authoritative. Each operation owns exactly one finite, non-negative `cycleTimeSeconds` and one recognised timing category: Manual, Automatic, Walking, or Waiting. Entry effective duration is derived as `operation.cycleTimeSeconds × entry.occurrences`. Enabled durations are summed by category and reported as the **Sum of included operation durations**. It is not called true cycle time, takt time, operator cycle, machine cycle, or throughput time because Sprint 2.9 has no overlap, resource scheduling, or concurrency model.

An operation appears at most once in a study; occurrences represent repetition. Every study owns an independent deterministic order. Populate reads current Process Flow operations sorted by sequence then ID, preserves existing entries and order, and appends missing operations in one undoable action. Later Process Flow sequence edits do not reorder studies.

Study creation, duplication, deletion, metadata, entry membership, occurrences, enabled state, notes, ordering, and persistent time-display settings use reversible commands. Redo reuses allocated IDs. Derived recalculation and selection do not create commands or dirty state. Deleting an operation removes attached Process Connections and every referencing Standard Work entry in the same transaction; Undo restores exact IDs, order, and references. Physical resource deletion remains assignment cleanup only.

Schema `1.5.0` adds `standardWorkStudies`, `standardWorkEntries`, and `settings.standardWork.timeFormat`. The explicit `1.4.0 → 1.5.0` migration supplies empty collections and Seconds formatting, and maps legacy timing labels deterministically into the four Standard Work categories. Candidate files are fully shape-, limit-, uniqueness-, and reference-validated before coordinated replacement. Derived summaries are excluded from persistence.

## Consequences

Operation rename, timing, category, and assignment changes update every referencing study immediately without entry mutations. Study ordering and Process Flow sequencing can evolve independently. Project health can report broken references, duplicates, invalid occurrences, zero duration, disabled entries, and unassigned operations using deterministic domain services rather than DOM state.

The Standard Work Combination Chart is deferred to Sprint 3.0. Operator lanes are deferred to Sprint 3.1, and takt/balance analysis to Sprint 3.2. The plain typed records, stable IDs, command semantics, and versioned JSON remain suitable for a future WPF implementation.
