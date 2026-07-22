import type { LinearDimensionAnnotation } from '../../models/factory/FactoryAnnotation';
import type { ProjectSettings } from '../../models/project/ProjectDocument';
import { formatLength } from '../units/LengthUnitService';

export function formatDimension(value: number, annotation: LinearDimensionAnnotation, settings: ProjectSettings): string {
  return formatLength(value, { modelUnit: settings.units.modelLengthUnit, displayUnit: settings.units.displayLengthUnit, precision: annotation.precisionOverride ?? settings.units.displayPrecision, showTrailingZeros: settings.units.showTrailingZeros, showUnit: annotation.showUnit, prefix: annotation.prefix, suffix: annotation.suffix, textOverride: annotation.textOverride });
}
