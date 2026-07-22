import type { TimingCategory } from '../operations/OperationTemplate';

export type StandardWorkChartDiagnosticSeverity = 'error' | 'warning' | 'information';

export interface StandardWorkChartDiagnostic {
  readonly severity: StandardWorkChartDiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly entryId?: string;
  readonly operationId?: string;
  readonly resourceId?: string;
  readonly operatorId?: string;
  readonly handoverId?: string;
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
  readonly assignedOperatorId: string;
  readonly operatorId: string;
  readonly launchOperatorId: string;
  readonly dependencyReleaseSeconds: number;
  readonly dependencyIdleSeconds: number;
  readonly enabled: true;
  readonly stackIndex: number;
  readonly overlapsSameResource: boolean;
}

export interface StandardWorkOperatorWorkload {
  readonly operatorId: string;
  readonly manualSeconds: number;
  readonly walkingSeconds: number;
  readonly waitingSeconds: number;
  readonly automaticLaunchCount: number;
  readonly automaticLaunchedSeconds: number;
  readonly occupiedSeconds: number;
  readonly productiveSeconds: number;
  readonly dependencyIdleSeconds: number;
  readonly entryCount: number;
  readonly endSeconds: number;
  readonly occupiedShareOfChartSpan: number;
}

export interface StandardWorkChartOperatorLane {
  readonly id: string;
  readonly operatorId: string;
  readonly name: string;
  readonly role: string;
  readonly active: boolean;
  readonly linkedResourceId: string | null;
  readonly blocks: readonly StandardWorkChartBlock[];
  readonly workload: StandardWorkOperatorWorkload;
}

export interface StandardWorkChartHandoverLink {
  readonly id: string;
  readonly handoverId: string;
  readonly fromEntryId: string;
  readonly toEntryId: string;
  readonly enabled: boolean;
  readonly sameOperator: boolean;
  readonly fromOperatorId: string;
  readonly toOperatorId: string;
  readonly releaseSeconds: number;
  readonly fromTime: number;
  readonly toTime: number;
  readonly validationState: 'valid' | 'warning' | 'disabled';
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
  readonly operatorLanes: readonly StandardWorkChartOperatorLane[];
  readonly handoverLinks: readonly StandardWorkChartHandoverLink[];
  readonly operatorCursors: Readonly<Record<string, number>>;
  readonly operatorSummaries: readonly StandardWorkOperatorWorkload[];
  readonly automaticBlocks: readonly StandardWorkChartBlock[];
  readonly resourceLanes: readonly StandardWorkChartResourceLane[];
  readonly disabledEntryIds: readonly string[];
  readonly operatorEndSeconds: number;
  readonly overallOperatorEndSeconds: number;
  readonly latestAutomaticEndSeconds: number;
  readonly chartCycleSpanSeconds: number;
  readonly automaticOverrunSeconds: number;
  readonly dependencyIdleSeconds: number;
  readonly summary: StandardWorkChartSummary;
  readonly diagnostics: readonly StandardWorkChartDiagnostic[];
}
