import type { ResourceInstance } from '../models/resources/ResourceInstance';
import type { ResourceTemplate } from '../models/resources/ResourceTemplate';
import { DEFAULT_FACTORY_LAYOUT_ID } from '../models/workspace/Workspace';
import { validateFactoryLayout } from './FactoryLayoutValidation';

export interface ResourceValidationIssue { readonly resourceId: string; readonly relatedResourceIds?: readonly string[]; readonly severity: 'error' | 'warning'; readonly code: string; readonly message: string; }
export interface ResourceValidationSummary { readonly issues: readonly ResourceValidationIssue[]; readonly errors: number; readonly warnings: number; readonly healthy: boolean; }

export function isValidPhysicalResourceId(id: string): boolean { return /^RES-\d{4,}$/.test(id); }
export function validateResources(resources: readonly ResourceInstance[], templates: readonly ResourceTemplate[], assignmentCount: (id: string) => number): ResourceValidationSummary {
  const templateIds = new Set(templates.map((template) => template.id)); const issues: ResourceValidationIssue[] = [];
  for (const resource of resources) {
    if (!isValidPhysicalResourceId(resource.id)) issues.push(issue(resource.id, 'error', 'invalid-id', 'Physical resource ID is invalid.'));
    if (!templateIds.has(resource.templateId)) issues.push(issue(resource.id, 'error', 'missing-template', 'Resource template reference is missing.'));
    if (!Number.isFinite(resource.width) || !Number.isFinite(resource.depth) || resource.width <= 0 || resource.depth <= 0) issues.push(issue(resource.id, 'error', 'invalid-dimensions', 'Resource footprint dimensions are invalid.'));
    if (!Number.isInteger(resource.capacity) || resource.capacity < 1) issues.push(issue(resource.id, 'error', 'invalid-capacity', 'Capacity must be a positive integer.'));
    if (resource.layoutId !== DEFAULT_FACTORY_LAYOUT_ID) issues.push(issue(resource.id, 'error', 'invalid-layout', 'Resource is outside the default Factory Layout.'));
    if (!resource.name.trim()) issues.push(issue(resource.id, 'warning', 'empty-name', 'Resource name is empty.'));
    if (!resource.active && assignmentCount(resource.id) > 0) issues.push(issue(resource.id, 'warning', 'inactive-assigned', 'Inactive resource is still assigned to operations.'));
  }
  for (const layoutIssue of validateFactoryLayout(resources).issues) {
    issues.push({ ...issue(layoutIssue.resourceIds[0], layoutIssue.severity, layoutIssue.type, layoutIssue.message), relatedResourceIds: layoutIssue.resourceIds });
  }
  const errors = issues.filter((entry) => entry.severity === 'error').length; const warnings = issues.length - errors;
  return { issues, errors, warnings, healthy: errors === 0 && warnings === 0 };
}
function issue(resourceId: string, severity: 'error' | 'warning', code: string, message: string): ResourceValidationIssue { return { resourceId, severity, code, message }; }
