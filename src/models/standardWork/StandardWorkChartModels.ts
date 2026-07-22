import type { TimingCategory } from '../operations/OperationTemplate';

export type StandardWorkChartDiagnosticSeverity = 'error' | 'warning' | 'information';

export interface StandardWorkChartDiagnostic {
  readonly severity: StandardWorkChartDiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly entryId?: string;
  readonly operationId?: string;
  readonly resourceId?: string;
}

export interface StandardWorkChartBlock {
  readonly entryId: string;
  readonly operationId: string;
  readonly timingCategory: TimingCategory;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly durationSeconds: number;
  readonly laneId: string;
  readonly order: number;
  readonly occurrences: number;
  readonly assignedResourceId: string | null;
  readonly enabled: true;
  readonly stackIndex: number;
  readonly overlapsSameResource: boolean;
}

export interface StandardWorkChartResourceLane {
  readonly id: string;
  readonly assignedResourceId: string | null;
  readonly label: string;
  readonly resourceActive: boolean | null;
  readonly blocks: readonly StandardWorkChartBlock[];
  readonly stackCount: number;
}

export interface StandardWorkChartSummary {
  readonly enabledEntryCount: number;
  readonly manualSeconds: number;
  readonly walkingSeconds: number;
  readonly waitingSeconds: number;
  readonly automaticSeconds: number;
  readonly operatorOccupiedSeconds: number;
  readonly operatorProductiveSeconds: number;
  readonly operatorEndSeconds: number;
  readonly latestAutomaticEndSeconds: number;
  readonly automaticOverrunSeconds: number;
  readonly chartCycleSpanSeconds: number;
  readonly automaticLaneCount: number;
  readonly potentialOverlapCount: number;
  readonly zeroTimeEntryCount: number;
  readonly errorCount: number;
  readonly warningCount: number;
}

export interface StandardWorkChartSchedule {
  readonly studyId: string;
  readonly operatorBlocks: readonly StandardWorkChartBlock[];
  readonly automaticBlocks: readonly StandardWorkChartBlock[];
  readonly resourceLanes: readonly StandardWorkChartResourceLane[];
  readonly disabledEntryIds: readonly string[];
  readonly operatorEndSeconds: number;
  readonly latestAutomaticEndSeconds: number;
  readonly chartCycleSpanSeconds: number;
  readonly automaticOverrunSeconds: number;
  readonly summary: StandardWorkChartSummary;
  readonly diagnostics: readonly StandardWorkChartDiagnostic[];
}
