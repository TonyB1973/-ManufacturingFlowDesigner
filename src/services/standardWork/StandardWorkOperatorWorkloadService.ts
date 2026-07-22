import type { StandardWorkChartBlock, StandardWorkOperatorWorkload } from '../../models/standardWork/StandardWorkChartModels';

export function calculateOperatorWorkload(operatorId: string, blocks: readonly StandardWorkChartBlock[], automaticBlocks: readonly StandardWorkChartBlock[], endSeconds: number, chartSpanSeconds = endSeconds): StandardWorkOperatorWorkload {
  const own = blocks.filter((block) => block.assignedOperatorId === operatorId);
  const sum = (category: StandardWorkChartBlock['timingCategory']): number => own.filter((block) => block.timingCategory === category).reduce((total, block) => total + block.durationSeconds, 0);
  const manualSeconds = sum('manual');
  const walkingSeconds = sum('walking');
  const waitingSeconds = sum('waiting');
  const launched = automaticBlocks.filter((block) => block.launchOperatorId === operatorId);
  const occupiedSeconds = manualSeconds + walkingSeconds + waitingSeconds;
  return {
    operatorId,
    manualSeconds,
    walkingSeconds,
    waitingSeconds,
    automaticLaunchCount: launched.length,
    automaticLaunchedSeconds: launched.reduce((total, block) => total + block.durationSeconds, 0),
    occupiedSeconds,
    productiveSeconds: manualSeconds + walkingSeconds,
    dependencyIdleSeconds: own.reduce((total, block) => total + block.dependencyIdleSeconds, 0),
    entryCount: own.length + launched.length,
    endSeconds,
    occupiedShareOfChartSpan: chartSpanSeconds > 0 ? occupiedSeconds / chartSpanSeconds : 0,
  };
}
