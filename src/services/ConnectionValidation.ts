import type { ProcessConnection, WorldPoint } from '../models/connections/ProcessConnection';
import type { OperationInstance } from '../models/operations/OperationInstance';
import { anchorWorldPosition, isValidAnchor } from './ConnectionAnchors';

export type ProcessIssueSeverity = 'error' | 'warning';
export interface ProcessValidationIssue { readonly severity: ProcessIssueSeverity; readonly code: string; readonly message: string; readonly connectionId?: string; readonly operationId?: string; }
export interface ProcessTopology { readonly startOperationIds: readonly string[]; readonly endOperationIds: readonly string[]; readonly hasCycle: boolean; readonly sectionCount: number; }
export interface ProcessValidationSummary { readonly issues: readonly ProcessValidationIssue[]; readonly errors: number; readonly warnings: number; readonly healthy: boolean; readonly topology: ProcessTopology; }

export function validateProcessConnections(operations: readonly OperationInstance[], connections: readonly ProcessConnection[]): ProcessValidationSummary {
  const operationMap = new Map(operations.map((operation) => [operation.id, operation])); const issues: ProcessValidationIssue[] = []; const standardPairs = new Map<string, number>();
  for (const connection of connections) {
    const source = operationMap.get(connection.sourceOperationId); const target = operationMap.get(connection.targetOperationId);
    if (!source) issues.push(error('missing-source', 'Missing source operation.', connection.id));
    if (!target) issues.push(error('missing-target', 'Missing target operation.', connection.id));
    if (connection.sourceOperationId === connection.targetOperationId) issues.push(error('self-connection', 'Source and target operations are identical.', connection.id));
    if (connection.connectionType === 'Standard') { const key = `${connection.sourceOperationId}\u0000${connection.targetOperationId}`; standardPairs.set(key, (standardPairs.get(key) ?? 0) + 1); }
    if (!isValidAnchor(connection.sourceAnchor) || !isValidAnchor(connection.targetAnchor)) issues.push(error('invalid-anchor', 'Connection anchor is invalid.', connection.id));
    if (connection.routePoints.length < 2 || connection.routePoints.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) issues.push(error('invalid-route', 'Connection route is empty or invalid.', connection.id));
    else if (source && target && (!near(connection.routePoints[0], anchorWorldPosition(source, connection.sourceAnchor)) || !near(connection.routePoints[connection.routePoints.length - 1], anchorWorldPosition(target, connection.targetAnchor)))) issues.push(error('route-endpoint', 'Route endpoint does not match its operation anchor.', connection.id));
    if (connection.routeStatus === 'fallback') issues.push(warning('fallback-route', 'Connection uses fallback routing.', connection.id));
    if (source && target && target.sequence < source.sequence) issues.push(warning('backward-flow', 'Connection flows backward in sequence.', connection.id));
  }
  for (const [key, count] of standardPairs) if (count > 1) { const [source, target] = key.split('\u0000'); connections.filter((connection) => connection.connectionType === 'Standard' && connection.sourceOperationId === source && connection.targetOperationId === target).forEach((connection) => issues.push(error('duplicate-standard', 'Duplicate Standard connection.', connection.id))); }
  const topology = analyseProcessTopology(operations, connections);
  if (connections.length) {
    const incoming = counts(connections, 'targetOperationId'); const outgoing = counts(connections, 'sourceOperationId'); const ordered = [...operations].sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id)); const firstId = ordered[0]?.id; const lastId = ordered[ordered.length - 1]?.id;
    operations.forEach((operation) => {
      if (!incoming.get(operation.id) && operation.id !== firstId) issues.push(warning('no-incoming', 'Operation has no incoming connection.', undefined, operation.id));
      if (!outgoing.get(operation.id) && operation.id !== lastId) issues.push(warning('no-outgoing', 'Operation has no outgoing connection.', undefined, operation.id));
      if (!incoming.get(operation.id) && !outgoing.get(operation.id)) issues.push(warning('isolated-operation', 'Operation is isolated from the connected process.', undefined, operation.id));
    });
    if (topology.startOperationIds.length > 1) issues.push(warning('multiple-starts', 'Process has multiple start candidates.'));
    if (topology.endOperationIds.length > 1) issues.push(warning('multiple-ends', 'Process has multiple end candidates.'));
    if (topology.sectionCount > 1) issues.push(warning('disconnected-sections', 'Process contains disconnected sections.'));
    if (topology.hasCycle) issues.push(warning('directed-cycle', 'Process contains a directed cycle.'));
  }
  const errors = issues.filter((issue) => issue.severity === 'error').length; const warnings = issues.length - errors;
  return { issues, errors, warnings, healthy: errors === 0 && warnings === 0, topology };
}

export function analyseProcessTopology(operations: readonly OperationInstance[], connections: readonly ProcessConnection[]): ProcessTopology {
  const ids = operations.map((operation) => operation.id); const incoming = counts(connections, 'targetOperationId'); const outgoing = counts(connections, 'sourceOperationId');
  const starts = ids.filter((id) => !incoming.get(id)); const ends = ids.filter((id) => !outgoing.get(id)); const adjacency = new Map(ids.map((id) => [id, [] as string[]]));
  connections.forEach((connection) => { if (adjacency.has(connection.sourceOperationId) && adjacency.has(connection.targetOperationId)) { adjacency.get(connection.sourceOperationId)?.push(connection.targetOperationId); adjacency.get(connection.targetOperationId)?.push(connection.sourceOperationId); } });
  let sections = 0; const visited = new Set<string>(); for (const id of ids) if (!visited.has(id)) { sections += 1; const stack = [id]; while (stack.length) { const current = stack.pop(); if (!current || visited.has(current)) continue; visited.add(current); adjacency.get(current)?.forEach((next) => stack.push(next)); } }
  return { startOperationIds: starts, endOperationIds: ends, hasCycle: detectDirectedCycle(ids, connections), sectionCount: sections };
}

export function detectDirectedCycle(operationIds: readonly string[], connections: readonly ProcessConnection[]): boolean {
  const adjacency = new Map(operationIds.map((id) => [id, [] as string[]])); connections.forEach((connection) => adjacency.get(connection.sourceOperationId)?.push(connection.targetOperationId));
  const state = new Map<string, number>(); const visit = (id: string): boolean => { const current = state.get(id) ?? 0; if (current === 1) return true; if (current === 2) return false; state.set(id, 1); if (adjacency.get(id)?.some(visit)) return true; state.set(id, 2); return false; };
  return operationIds.some(visit);
}
function counts(connections: readonly ProcessConnection[], key: 'sourceOperationId' | 'targetOperationId'): Map<string, number> { const result = new Map<string, number>(); connections.forEach((connection) => result.set(connection[key], (result.get(connection[key]) ?? 0) + 1)); return result; }
function near(left: WorldPoint, right: WorldPoint): boolean { return Math.abs(left.x - right.x) < 1e-6 && Math.abs(left.y - right.y) < 1e-6; }
function error(code: string, message: string, connectionId?: string): ProcessValidationIssue { return { severity: 'error', code, message, connectionId }; }
function warning(code: string, message: string, connectionId?: string, operationId?: string): ProcessValidationIssue { return { severity: 'warning', code, message, connectionId, operationId }; }
