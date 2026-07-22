export const STANDARD_WORK_REVEAL_EVENT = 'mfd:standard-work-reveal';
export const STANDARD_WORK_ADD_OPERATION_EVENT = 'mfd:standard-work-add-operation';
export const STANDARD_WORK_SHOW_OPERATION_EVENT = 'mfd:standard-work-show-operation';
import type { StandardWorkSelectionKind } from '../../services/standardWork/StandardWorkSelectionStore';

export const revealStandardWork = (kind: StandardWorkSelectionKind, id: string): void => { document.dispatchEvent(new CustomEvent(STANDARD_WORK_REVEAL_EVENT, { detail: { kind, id } })); };
export const requestAddOperationToStandardWork = (operationId: string): void => { document.dispatchEvent(new CustomEvent(STANDARD_WORK_ADD_OPERATION_EVENT, { detail: operationId })); };
export const requestShowOperationInStandardWork = (operationId: string): void => { document.dispatchEvent(new CustomEvent(STANDARD_WORK_SHOW_OPERATION_EVENT, { detail: operationId })); };
