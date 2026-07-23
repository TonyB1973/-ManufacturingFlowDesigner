import type { ManufacturingScenario, ManufacturingScenarioState } from '../../models/scenarios/ManufacturingScenario';
import { cloneFactoryAnnotation } from '../../models/factory/FactoryAnnotation';
import { cloneFactoryRoute } from '../../models/factory/FactoryRoute';

export class ScenarioCloneService {
  public cloneState(source: ManufacturingScenarioState): ManufacturingScenarioState {
    return {
      resources: source.resources.map((item) => ({ ...item, clearance: { ...item.clearance } })),
      operations: source.operations.map((item) => ({ ...item })),
      connections: source.connections.map((item) => ({ ...item, sourceAnchor: { ...item.sourceAnchor }, targetAnchor: { ...item.targetAnchor } })),
      layoutBoundaries: source.layoutBoundaries.map((item) => ({ ...item, points: item.points.map((point) => ({ ...point })) })),
      walls: source.walls.map((item) => ({ ...item, start: { ...item.start }, end: { ...item.end } })),
      areas: source.areas.map((item) => ({ ...item })),
      aisles: source.aisles.map((item) => ({ ...item, points: item.points.map((point) => ({ ...point })) })),
      factoryRoutes: source.factoryRoutes.map(cloneFactoryRoute),
      factoryAnnotations: source.factoryAnnotations.map(cloneFactoryAnnotation),
      standardWorkStudies: source.standardWorkStudies.map((item) => ({ ...item })),
      standardWorkEntries: source.standardWorkEntries.map((item) => ({ ...item })),
      standardWorkOperators: source.standardWorkOperators.map((item) => ({ ...item })),
      standardWorkHandovers: source.standardWorkHandovers.map((item) => ({ ...item })),
      standardWorkPlanning: source.standardWorkPlanning.map((item) => ({ ...item })),
      workspaces: {
        active: source.workspaces.active,
        processFlow: { ...source.workspaces.processFlow },
        factoryLayout: { ...source.workspaces.factoryLayout },
      },
    };
  }

  public cloneScenario(source: ManufacturingScenario): ManufacturingScenario {
    return { ...source, state: this.cloneState(source.state) };
  }
}
