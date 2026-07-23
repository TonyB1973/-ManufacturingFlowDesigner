import type {
  PersistedOperationInstance,
  PersistedProcessConnection,
  PersistedResourceInstance,
  PersistedWorkspaces,
} from '../project/ProjectDocument';
import type { FactoryLayoutBoundary } from '../factory/FactoryLayoutBoundary';
import type { FactoryWall } from '../factory/FactoryWall';
import type { FactoryArea } from '../factory/FactoryArea';
import type { FactoryAisle } from '../factory/FactoryAisle';
import type { FactoryRoute } from '../factory/FactoryRoute';
import type { FactoryAnnotation } from '../factory/FactoryAnnotation';
import type { StandardWorkEntry, StandardWorkStudy } from '../standardWork/StandardWork';
import type { StandardWorkOperator } from '../standardWork/StandardWorkOperator';
import type { StandardWorkHandover } from '../standardWork/StandardWorkHandover';
import type { StandardWorkPlanningParameters } from '../standardWork/StandardWorkPlanning';

export interface ManufacturingScenarioState {
  readonly resources: readonly PersistedResourceInstance[];
  readonly operations: readonly PersistedOperationInstance[];
  readonly connections: readonly PersistedProcessConnection[];
  readonly layoutBoundaries: readonly FactoryLayoutBoundary[];
  readonly walls: readonly FactoryWall[];
  readonly areas: readonly FactoryArea[];
  readonly aisles: readonly FactoryAisle[];
  readonly factoryRoutes: readonly FactoryRoute[];
  readonly factoryAnnotations: readonly FactoryAnnotation[];
  readonly standardWorkStudies: readonly StandardWorkStudy[];
  readonly standardWorkEntries: readonly StandardWorkEntry[];
  readonly standardWorkOperators: readonly StandardWorkOperator[];
  readonly standardWorkHandovers: readonly StandardWorkHandover[];
  readonly standardWorkPlanning: readonly StandardWorkPlanningParameters[];
  readonly workspaces: PersistedWorkspaces;
}

export interface ManufacturingScenario {
  readonly id: string;
  name: string;
  description: string;
  isBaseline: boolean;
  locked: boolean;
  readonly createdUtc: string;
  modifiedUtc: string;
  readonly sourceScenarioId: string | null;
  state: ManufacturingScenarioState;
}

export interface ScenarioSummary {
  readonly id: string;
  readonly name: string;
  readonly isBaseline: boolean;
  readonly locked: boolean;
  readonly active: boolean;
  readonly sourceScenarioId: string | null;
  readonly sourceAvailable: boolean;
  readonly createdUtc: string;
  readonly modifiedUtc: string;
  readonly resourceCount: number;
  readonly operationCount: number;
  readonly standardWorkStudyCount: number;
  readonly operatorCount: number;
  readonly revision: number;
  readonly errors: number;
  readonly warnings: number;
}
