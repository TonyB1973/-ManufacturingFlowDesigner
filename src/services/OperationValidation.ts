import type { OperationInstance } from '../models/operations/OperationInstance';
import type { ResourceInstance } from '../models/resources/ResourceInstance';
import { DEFAULT_FACTORY_LAYOUT_ID } from '../models/workspace/Workspace';
import { isValidPhysicalResourceId } from './ResourceValidation';

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
  getResource: (resourceId: string) => ResourceInstance | undefined,
  isTemplateId: (resourceId: string) => boolean = () => false,
): OperationValidationSummary {
  const issues: OperationValidationIssue[] = [];
  const sequenceCounts = new Map<number, number>();
  for (const operation of operations) {
    sequenceCounts.set(operation.sequence, (sequenceCounts.get(operation.sequence) ?? 0) + 1);
    if (operation.name.trim().length === 0) issues.push(issue(operation.id, 'error', 'empty-name', 'Operation name is required.'));
    if (!Number.isInteger(operation.sequence) || operation.sequence <= 0) issues.push(issue(operation.id, 'error', 'invalid-sequence', 'Sequence must be a positive integer.'));
    if (!Number.isFinite(operation.cycleTimeSeconds) || operation.cycleTimeSeconds <= 0) issues.push(issue(operation.id, 'error', 'invalid-cycle-time', 'Cycle time must be greater than zero.'));
    if (!operation.assignedResourceId) issues.push(issue(operation.id, 'warning', 'unassigned-resource', 'No resource is assigned.'));
    else if (!isValidPhysicalResourceId(operation.assignedResourceId)) issues.push(issue(operation.id, 'error', isTemplateId(operation.assignedResourceId) ? 'template-assignment' : 'invalid-resource-id', isTemplateId(operation.assignedResourceId) ? 'A Resource Template cannot be assigned to an operation.' : 'Assigned physical resource ID is invalid.'));
    else { const resource = getResource(operation.assignedResourceId); if (!resource) issues.push(issue(operation.id, 'error', 'missing-resource', 'Assigned physical resource no longer exists.')); else if (resource.layoutId !== DEFAULT_FACTORY_LAYOUT_ID) issues.push(issue(operation.id, 'error', 'resource-outside-layout', 'Assigned resource is outside Factory Layout.')); else if (!resource.active) issues.push(issue(operation.id, 'warning', 'inactive-resource', 'Assigned physical resource is inactive.')); }
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
