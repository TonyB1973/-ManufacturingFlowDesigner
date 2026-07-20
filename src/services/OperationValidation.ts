import type { OperationInstance } from '../models/operations/OperationInstance';

export type ValidationSeverity = 'error' | 'warning';

export interface OperationValidationIssue {
  readonly operationId: string;
  readonly severity: ValidationSeverity;
  readonly code: string;
  readonly message: string;
}

export interface OperationValidationSummary {
  readonly issues: readonly OperationValidationIssue[];
  readonly errors: number;
  readonly warnings: number;
  readonly healthy: boolean;
}

export function validateOperations(
  operations: readonly OperationInstance[],
  resourceExists: (resourceId: string) => boolean,
): OperationValidationSummary {
  const issues: OperationValidationIssue[] = [];
  const sequenceCounts = new Map<number, number>();
  for (const operation of operations) {
    sequenceCounts.set(operation.sequence, (sequenceCounts.get(operation.sequence) ?? 0) + 1);
    if (operation.name.trim().length === 0) issues.push(issue(operation.id, 'error', 'empty-name', 'Operation name is required.'));
    if (!Number.isInteger(operation.sequence) || operation.sequence <= 0) issues.push(issue(operation.id, 'error', 'invalid-sequence', 'Sequence must be a positive integer.'));
    if (!Number.isFinite(operation.cycleTimeSeconds) || operation.cycleTimeSeconds <= 0) issues.push(issue(operation.id, 'error', 'invalid-cycle-time', 'Cycle time must be greater than zero.'));
    if (!operation.assignedResourceId) issues.push(issue(operation.id, 'warning', 'unassigned-resource', 'No resource is assigned.'));
    else if (!resourceExists(operation.assignedResourceId)) issues.push(issue(operation.id, 'error', 'missing-resource', 'Assigned resource no longer exists.'));
    if (!operation.visible) issues.push(issue(operation.id, 'warning', 'hidden-operation', 'Operation is hidden from the canvas.'));
  }
  for (const operation of operations) {
    if ((sequenceCounts.get(operation.sequence) ?? 0) > 1) issues.push(issue(operation.id, 'warning', 'duplicate-sequence', `Sequence ${operation.sequence} is duplicated.`));
  }
  const errors = issues.filter((entry) => entry.severity === 'error').length;
  const warnings = issues.length - errors;
  return { issues, errors, warnings, healthy: errors === 0 && warnings === 0 };
}

function issue(operationId: string, severity: ValidationSeverity, code: string, message: string): OperationValidationIssue {
  return { operationId, severity, code, message };
}
