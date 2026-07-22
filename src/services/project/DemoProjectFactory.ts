import { OPERATION_TEMPLATES } from '../../core/constants/operationTemplates';
import { RESOURCE_TEMPLATES } from '../../core/constants/resourceTemplates';
import {
  APPLICATION_VERSION,
  DEFAULT_PROJECT_SETTINGS,
  PROJECT_FORMAT,
  PROJECT_SCHEMA_VERSION,
  type PersistedOperationInstance,
  type PersistedResourceInstance,
  type ProjectDocument,
} from '../../models/project/ProjectDocument';
import { DEFAULT_FACTORY_LAYOUT_ID } from '../../models/workspace/Workspace';

const clearance = (enabled = false) => ({
  enabled,
  left: enabled ? 30 : 0,
  right: enabled ? 30 : 0,
  top: enabled ? 30 : 0,
  bottom: enabled ? 30 : 0,
  category: 'operational' as const,
  note: enabled ? 'Demonstration operating clearance.' : '',
});

function resource(
  id: string,
  templateId: string,
  name: string,
  worldX: number,
  worldY: number,
  withClearance = false,
): PersistedResourceInstance {
  const template = RESOURCE_TEMPLATES.find((item) => item.id === templateId);
  if (!template) throw new Error(`Demo resource template ${templateId} is missing.`);
  return {
    id,
    templateId,
    name,
    resourceType: template.resourceType,
    layoutId: DEFAULT_FACTORY_LAYOUT_ID,
    worldX,
    worldY,
    width: template.defaultWidth,
    depth: template.defaultDepth,
    rotationDegrees: 0,
    clearance: clearance(withClearance),
    active: true,
    visible: true,
    locked: false,
    capacity: 1,
  };
}

function operation(
  id: string,
  templateId: string,
  name: string,
  sequence: number,
  assignedResourceId: string,
  worldX: number,
  worldY: number,
): PersistedOperationInstance {
  const template = OPERATION_TEMPLATES.find((item) => item.id === templateId);
  if (!template) throw new Error(`Demo operation template ${templateId} is missing.`);
  return {
    id,
    templateId,
    name,
    operationType: template.operationType,
    timingCategory: template.timingCategory,
    cycleTimeSeconds: template.defaultCycleTimeSeconds,
    sequence,
    assignedResourceId,
    notes: `Demonstration step assigned to ${assignedResourceId}.`,
    worldX,
    worldY,
    width: 190,
    height: 100,
    locked: false,
    visible: true,
  };
}

export function createDemoProject(now = new Date().toISOString()): ProjectDocument {
  const resources: ProjectDocument['resources'] = [
    resource('RES-0001', 'TPL-CNC-002', 'Saw and Turning Cell', 100, 140, true),
    resource('RES-0002', 'TPL-CNC-001', 'CNC Machining Cell', 400, 140, true),
    resource('RES-0003', 'TPL-MAN-001', 'Assembly Cell', 700, 140),
    resource('RES-0004', 'TPL-QUA-001', 'Final Inspection', 1000, 140),
    resource('RES-0005', 'TPL-MAN-002', 'Packing and Dispatch', 1000, 500),
    resource('RES-0006', 'TPL-HAN-002', 'Finished Goods Buffer', 700, 500),
  ];
  const operations: ProjectDocument['operations'] = [
    operation('operation-0001', 'op-cut', 'Cut stock', 10, 'RES-0001', 0, 80),
    operation('operation-0002', 'op-machine', 'Machine features', 20, 'RES-0002', 260, 80),
    operation('operation-0003', 'op-assemble', 'Assemble product', 30, 'RES-0003', 520, 80),
    operation('operation-0004', 'op-inspect', 'Inspect product', 40, 'RES-0004', 520, 280),
    operation('operation-0005', 'op-pack', 'Pack for dispatch', 50, 'RES-0005', 260, 280),
  ];
  const connection = (id: string, sourceOperationId: string, targetOperationId: string, sourceSide: 'right' | 'bottom' | 'left' = 'right', targetSide: 'left' | 'top' | 'right' = 'left') => ({
    id,
    sourceOperationId,
    targetOperationId,
    sourceAnchor: { side: sourceSide, offset: 0.5 },
    targetAnchor: { side: targetSide, offset: 0.5 },
    label: '',
    connectionType: 'Standard' as const,
    visible: true,
    locked: false,
  });
  const routeEndpoint = (resourceId: string, anchorSide: 'bottom' | 'top' | 'left' | 'right') => ({
    kind: 'resource' as const,
    resourceId,
    anchorSide,
    anchorOffset: 0.5,
  });

  return {
    format: PROJECT_FORMAT,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    applicationVersion: APPLICATION_VERSION,
    project: {
      id: 'PROJECT-DEMO-001',
      name: 'Manufacturing Flow Demonstration',
      description: 'A known-clean example for demonstrating and regression-testing Process Flow and Factory Layout features.',
      author: 'Manufacturing Flow Designer',
      company: 'Demonstration',
      createdUtc: now,
      modifiedUtc: now,
    },
    resourceTemplates: RESOURCE_TEMPLATES,
    operationTemplates: OPERATION_TEMPLATES,
    resources,
    operations,
    connections: [
      connection('CON-0001', 'operation-0001', 'operation-0002'),
      connection('CON-0002', 'operation-0002', 'operation-0003'),
      connection('CON-0003', 'operation-0003', 'operation-0004', 'bottom', 'top'),
      connection('CON-0004', 'operation-0004', 'operation-0005', 'left', 'right'),
    ],
    layoutBoundaries: [{
      id: 'BND-0001',
      layoutId: DEFAULT_FACTORY_LAYOUT_ID,
      name: 'Demo Factory Boundary',
      points: [{ x: -150, y: -100 }, { x: 1250, y: -100 }, { x: 1250, y: 700 }, { x: -150, y: 700 }],
      visible: true,
      locked: true,
      fillVisible: true,
      note: 'Demonstration factory envelope.',
    }],
    walls: [{
      id: 'WALL-0001',
      layoutId: DEFAULT_FACTORY_LAYOUT_ID,
      start: { x: -50, y: 650 },
      end: { x: 1150, y: 650 },
      thickness: 20,
      name: 'South partition',
      wallType: 'Partition',
      visible: true,
      locked: false,
      note: 'Example internal wall.',
    }],
    areas: [
      { id: 'AREA-0001', layoutId: DEFAULT_FACTORY_LAYOUT_ID, name: 'Production', areaType: 'Department', worldX: 550, worldY: 140, width: 1200, depth: 260, rotationDegrees: 0, visible: true, locked: false, fillVisible: true, note: 'Primary production department.', resourcePlacementPolicy: 'Allowed' },
      { id: 'AREA-0002', layoutId: DEFAULT_FACTORY_LAYOUT_ID, name: 'Logistics', areaType: 'Storage', worldX: 850, worldY: 500, width: 500, depth: 220, rotationDegrees: 0, visible: true, locked: false, fillVisible: true, note: 'Finished goods and dispatch area.', resourcePlacementPolicy: 'Allowed' },
    ],
    aisles: [{
      id: 'AISLE-0001',
      layoutId: DEFAULT_FACTORY_LAYOUT_ID,
      name: 'Main shared aisle',
      points: [{ x: 100, y: 300 }, { x: 1000, y: 300 }, { x: 1000, y: 420 }],
      width: 80,
      aisleType: 'Shared',
      direction: 'Two Way',
      visible: true,
      locked: false,
      note: 'Shared material and pedestrian travel corridor.',
    }],
    factoryRoutes: [
      { id: 'FRT-0001', layoutId: DEFAULT_FACTORY_LAYOUT_ID, name: 'Turning to machining', routeType: 'Material', direction: 'Forward', source: routeEndpoint('RES-0001', 'bottom'), target: routeEndpoint('RES-0002', 'bottom'), waypoints: [{ x: 100, y: 300 }, { x: 400, y: 300 }], visible: true, locked: false, enabled: true, nominalSpeed: 1.2, note: 'Material transfer after turning.' },
      { id: 'FRT-0002', layoutId: DEFAULT_FACTORY_LAYOUT_ID, name: 'Machining to assembly', routeType: 'Material', direction: 'Forward', source: routeEndpoint('RES-0002', 'bottom'), target: routeEndpoint('RES-0003', 'bottom'), waypoints: [{ x: 400, y: 300 }, { x: 700, y: 300 }], visible: true, locked: false, enabled: true, nominalSpeed: 1.2, note: 'Material transfer to assembly.' },
      { id: 'FRT-0003', layoutId: DEFAULT_FACTORY_LAYOUT_ID, name: 'Assembly to inspection', routeType: 'Material', direction: 'Forward', source: routeEndpoint('RES-0003', 'bottom'), target: routeEndpoint('RES-0004', 'bottom'), waypoints: [{ x: 700, y: 300 }, { x: 1000, y: 300 }], visible: true, locked: false, enabled: true, nominalSpeed: 1.2, note: 'Material transfer to final inspection.' },
      { id: 'FRT-0004', layoutId: DEFAULT_FACTORY_LAYOUT_ID, name: 'Inspection to packing', routeType: 'Material', direction: 'Forward', source: routeEndpoint('RES-0004', 'bottom'), target: routeEndpoint('RES-0005', 'top'), waypoints: [{ x: 1000, y: 300 }, { x: 1000, y: 420 }], visible: true, locked: false, enabled: true, nominalSpeed: 1.2, note: 'Approved product transfer to packing.' },
      { id: 'FRT-0005', layoutId: DEFAULT_FACTORY_LAYOUT_ID, name: 'Packing operator walk', routeType: 'Walking', direction: 'Two Way', source: routeEndpoint('RES-0005', 'left'), target: routeEndpoint('RES-0006', 'right'), waypoints: [], visible: true, locked: false, enabled: true, nominalSpeed: 1.4, note: 'Operator movement between packing and finished goods.' },
    ],
    factoryAnnotations: [
      { id: 'ANN-0001', annotationType: 'linearDimension', layoutId: DEFAULT_FACTORY_LAYOUT_ID, dimensionKind: 'Horizontal', startAnchor: { kind: 'boundary', boundaryId: 'BND-0001', feature: 'vertex', index: 0 }, endAnchor: { kind: 'boundary', boundaryId: 'BND-0001', feature: 'vertex', index: 1 }, offset: -70, textPosition: 0.5, prefix: '', suffix: '', textOverride: '', showUnit: true, precisionOverride: null, visible: true, locked: false, layer: 'Dimensions', note: 'Overall factory width.', createdUtc: now },
      { id: 'ANN-0002', annotationType: 'linearDimension', layoutId: DEFAULT_FACTORY_LAYOUT_ID, dimensionKind: 'Vertical', startAnchor: { kind: 'boundary', boundaryId: 'BND-0001', feature: 'vertex', index: 1 }, endAnchor: { kind: 'boundary', boundaryId: 'BND-0001', feature: 'vertex', index: 2 }, offset: -70, textPosition: 0.5, prefix: '', suffix: '', textOverride: '', showUnit: true, precisionOverride: null, visible: true, locked: false, layer: 'Dimensions', note: 'Overall factory depth.', createdUtc: now },
      { id: 'ANN-0003', annotationType: 'coordinate', layoutId: DEFAULT_FACTORY_LAYOUT_ID, anchor: { kind: 'resource', resourceId: 'RES-0002', feature: 'centre' }, showX: true, showY: true, labelOffset: { x: 30, y: -30 }, prefix: '', suffix: '', precisionOverride: null, visible: true, locked: false, layer: 'Coordinates', note: 'Machining cell centre datum.', createdUtc: now },
      { id: 'ANN-0004', annotationType: 'text', layoutId: DEFAULT_FACTORY_LAYOUT_ID, worldPosition: { x: 550, y: -40 }, text: 'DEMO FACTORY LAYOUT', textSize: 18, textAlign: 'centre', rotationDegrees: 0, backgroundEnabled: true, borderEnabled: false, visible: true, locked: false, layer: 'Notes', note: 'Demo title.', createdUtc: now },
      { id: 'ANN-0005', annotationType: 'leader', layoutId: DEFAULT_FACTORY_LAYOUT_ID, anchor: { kind: 'resource', resourceId: 'RES-0004', feature: 'centre' }, elbowPoints: [{ x: 1120, y: 80 }], textPosition: { x: 1180, y: 40 }, text: 'Final quality gate', textSize: 16, arrowStyle: 'filled', visible: true, locked: false, layer: 'Notes', note: 'Example resource callout.', createdUtc: now },
    ],
    standardWorkStudies: [{ id: 'SW-0001', name: 'Demo Product Standard Work', description: 'Reference study for testing live Process Flow timing.', productOrProcessName: 'Demo Product', revision: 'A', active: true, notes: 'Durations resolve from the referenced operations.', createdUtc: now, modifiedUtc: now }],
    standardWorkEntries: operations.map((item, index) => ({ id: `SWE-${String(index + 1).padStart(4, '0')}`, studyId: 'SW-0001', operationId: item.id, order: (index + 1) * 10, occurrences: 1, enabled: true, notes: '' })),
    workspaces: {
      active: 'processFlow',
      processFlow: { panX: 55, panY: 100, zoom: 0.5, gridVisible: true, originVisible: true, snapEnabled: true },
      factoryLayout: { panX: 50, panY: 90, zoom: 0.28, gridVisible: true, originVisible: true, snapEnabled: true },
    },
    settings: { ...DEFAULT_PROJECT_SETTINGS, units: { ...DEFAULT_PROJECT_SETTINGS.units }, standardWork: { ...DEFAULT_PROJECT_SETTINGS.standardWork } },
  };
}
