# ADR-0001: Separate Process Flow from Factory Layout resources

- Status: Accepted
- Date: 2026-07-20

## Decision

Manufacturing Flow Designer treats Resource Templates, physical Resource Instances, and Manufacturing Operations as separate concepts.

Resource Templates are reusable defaults and are never assignable. Resource Instances are physical or allocated assets in the default Factory Layout. Operations exist in Process Flow and store only an assigned physical resource ID.

Process Flow renders operations and future process connections. Factory Layout renders physical Resource Instances. Each workspace owns independent pan, zoom, grid, origin, and snap state.

A physical resource may support multiple sequential operations. Repeated assignment is not a double-booking error because simultaneous allocation cannot be determined without timing. Simulation and Standard Work will later detect simultaneous over-allocation above physical capacity.

Factory capacity for ordinary machinery is normally increased by adding another independently identified Resource Instance. Numeric capacity remains available for future grouped resources but does not represent several physical machines.

Future scenario comparison will preserve a baseline Factory Layout and apply scenario-specific changes without changing these identities.

## Consequences

- Deleting an assigned physical resource must explicitly unassign affected operations.
- Inactive resources remain visible to existing assignments but cannot receive new assignments.
- Resource instance names may change without changing template names or stable IDs.
- Project persistence must serialize both workspaces and their viewport states independently.
