import { loadTypeScriptModule as loadModule } from './load-typescript-module.mjs';

const load = (path) => loadModule(path, import.meta.url);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const close = (left, right) => Math.abs(left - right) < 1e-9;

const { StandardWorkStore } = await load('../src/services/StandardWorkStore.ts');
const { StandardWorkOperatorStore } = await load('../src/services/standardWork/StandardWorkOperatorStore.ts');
const { StandardWorkHandoverStore } = await load('../src/services/standardWork/StandardWorkHandoverStore.ts');
const { StandardWorkSelectionStore } = await load('../src/services/standardWork/StandardWorkSelectionStore.ts');
const { StandardWorkChartScheduler } = await load('../src/services/standardWork/StandardWorkChartScheduler.ts');
const { validateHandoverGraph } = await load('../src/services/standardWork/StandardWorkDependencyGraph.ts');
const { validateStandardWork } = await load('../src/services/standardWork/StandardWorkValidationService.ts');
const { StandardWorkCommandFactory } = await load('../src/services/history/StandardWorkCommandFactory.ts');
const { StandardWorkOperatorCommandFactory } = await load('../src/services/history/StandardWorkOperatorCommandFactory.ts');
const { StandardWorkHandoverCommandFactory } = await load('../src/services/history/StandardWorkHandoverCommandFactory.ts');
const { CommandFactory } = await load('../src/services/history/CommandFactory.ts');
const { CommandHistoryService } = await load('../src/services/history/CommandHistoryService.ts');
const { OperationStore } = await load('../src/services/OperationStore.ts');
const { ResourceStore } = await load('../src/services/ResourceStore.ts');
const { ConnectionStore } = await load('../src/services/ConnectionStore.ts');
const { SelectionStore } = await load('../src/services/SelectionStore.ts');
const { OperationIdGenerator } = await load('../src/utilities/OperationIdGenerator.ts');
const { ResourceIdGenerator } = await load('../src/utilities/ResourceIdGenerator.ts');
const { ConnectionIdGenerator } = await load('../src/utilities/ConnectionIdGenerator.ts');
const { StandardWorkStudyIdGenerator, StandardWorkEntryIdGenerator, StandardWorkOperatorIdGenerator, StandardWorkHandoverIdGenerator } = await load('../src/utilities/StandardWorkIdGenerator.ts');
const { OPERATION_TEMPLATES } = await load('../src/core/constants/operationTemplates.ts');
const { RESOURCE_TEMPLATES } = await load('../src/core/constants/resourceTemplates.ts');

const canvasSelection = new SelectionStore();
const operations = new OperationStore(OPERATION_TEMPLATES, new OperationIdGenerator(), canvasSelection);
const resources = new ResourceStore(RESOURCE_TEMPLATES, new ResourceIdGenerator(), canvasSelection);
const connections = new ConnectionStore(new ConnectionIdGenerator(), (id) => operations.getOperation(id), () => ({ points: [], status: 'clear' }), canvasSelection);
const standardWork = new StandardWorkStore(new StandardWorkStudyIdGenerator(), new StandardWorkEntryIdGenerator(), (id) => Boolean(operations.getOperation(id)));
const operators = new StandardWorkOperatorStore(new StandardWorkOperatorIdGenerator(), (id) => Boolean(standardWork.getStudy(id)), (id) => Boolean(resources.getResource(id)));
standardWork.setOperatorResolver((id) => operators.getOperator(id)?.studyId ?? null);
const handovers = new StandardWorkHandoverStore(new StandardWorkHandoverIdGenerator(), (id) => standardWork.getEntry(id), (studyId) => standardWork.getEntries(studyId));
const standardWorkSelection = new StandardWorkSelectionStore();
const emptyRoutes = { getRoutesForResource: () => [], deleteAttachedToResource: () => undefined, restoreRoute: () => true };
const emptyAnnotations = { getAttached: () => [], deleteAnnotation: () => true, restoreAnnotation: () => true };
const project = { getMetadata: () => ({ id: 'PRJ-OPERATORS' }), getSettings: () => ({ standardWork: { timeFormat: 'seconds', chart: {} } }), applyMetadata: () => true, applySettings: () => true };
const context = { resources, operations, connections, structure: {}, routes: emptyRoutes, annotations: emptyAnnotations, standardWork, standardWorkOperators: operators, standardWorkHandovers: handovers, standardWorkSelection, project, selection: canvasSelection };
const history = new CommandHistoryService(context, 500);
const studyCommands = new StandardWorkCommandFactory(history, context);
const operatorCommands = new StandardWorkOperatorCommandFactory(history, context);
const handoverCommands = new StandardWorkHandoverCommandFactory(history, context);
const commands = new CommandFactory(history, context);

const study = studyCommands.createStudy('Two-person cell');
assert(study?.id === 'SW-0001', 'Study creation uses a stable SW ID');
const operatorOne = operators.getPrimary(study.id);
assert(operatorOne?.id === 'SWO-0001' && operatorOne.name === 'Operator 1' && operatorOne.displayOrder === 10, 'Study and default operator are created transactionally');
assert(history.undo() && !standardWork.getStudy(study.id) && operators.getCount() === 0, 'Undo removes the study and default operator together');
assert(history.redo() && standardWork.getStudy(study.id) && operators.getOperator('SWO-0001'), 'Redo restores the same study and operator IDs');

const operatorTwo = operatorCommands.create(study.id);
assert(operatorTwo?.id === 'SWO-0002', 'New Operator allocates a stable SWO ID');
assert(operatorCommands.update(operatorTwo.id, { role: 'Material and inspection', active: false }) && operators.getOperator(operatorTwo.id).role === 'Material and inspection', 'Operator role and active state are editable');
assert(operatorCommands.update(operatorTwo.id, { active: true }), 'An operator can be reactivated');
const copy = operatorCommands.duplicate(operatorTwo.id);
assert(copy?.id === 'SWO-0003' && copy.name.endsWith('Copy') && copy.role === operators.getOperator(operatorTwo.id).role, 'Duplicate Operator copies metadata without reusing identity');
assert(operatorCommands.moveToTop(copy.id) && operators.getOperators(study.id)[0].id === copy.id, 'Operator ordering changes lane order through one command');
assert(history.undo() && operators.getOperators(study.id)[0].id === operatorOne.id, 'Operator reorder undo restores prior display order');
assert(operatorCommands.delete(copy.id) && !operators.getOperator(copy.id), 'An unused operator can be deleted');
assert(!operatorCommands.delete(operatorOne.id, operatorTwo.id) || operators.getCount(study.id) > 0, 'Operator commands never delete the final operator');
if (!operators.getOperator(operatorOne.id)) history.undo();

const createOperation = (templateId, timingCategory, seconds, sequence) => {
  const value = operations.addOperation(templateId, sequence * 100, 0);
  assert(value, `Operation ${sequence} is created`);
  assert(operations.updateOperation(value.id, { timingCategory, cycleTimeSeconds: seconds, sequence }), `Operation ${sequence} timing is configured`);
  return value;
};
const manualOne = createOperation('op-cut', 'manual', 20, 10);
const manualTwo = createOperation('op-weld', 'manual', 15, 20);
const manualThree = createOperation('op-assemble', 'manual', 10, 30);
const walking = createOperation('op-move', 'walking', 5, 40);
const automatic = createOperation('op-machine', 'automatic', 30, 50);
const waiting = createOperation('op-store', 'waiting', 5, 60);
const machine = resources.addResource(RESOURCE_TEMPLATES[0].id, 0, 0);
assert(machine && operations.updateOperation(automatic.id, { assignedResourceId: machine.id }), 'Automatic work references a physical resource independently');

const added = [manualOne, manualTwo, manualThree, walking, automatic, waiting].map((operation) => studyCommands.addOperation(study.id, operation.id).entry);
assert(added.every(Boolean) && added.every((entry) => entry.assignedOperatorId === operatorOne.id), 'New entries use the deterministic primary operator');
assert(operatorCommands.assignEntry(added[1].id, operatorTwo.id) && operatorCommands.assignEntry(added[3].id, operatorTwo.id) && operatorCommands.assignEntry(added[5].id, operatorTwo.id), 'Entries can be reassigned to another operator in the same study');
const otherStudy = studyCommands.createStudy('Other study'); const otherOperator = operators.getPrimary(otherStudy.id);
assert(!operatorCommands.assignEntry(added[0].id, otherOperator.id) && standardWork.getEntry(added[0].id).assignedOperatorId === operatorOne.id, 'Cross-study operator assignment is rejected');
studyCommands.deleteStudy(otherStudy.id);

const scheduler = new StandardWorkChartScheduler(operations, resources, operators, handovers);
let schedule = scheduler.calculate(study, standardWork.getEntries(study.id));
const block = (entry) => [...schedule.operatorBlocks, ...schedule.automaticBlocks].find((item) => item.entryId === entry.id);
assert(block(added[0]).startSeconds === 0 && block(added[0]).endSeconds === 20 && block(added[1]).startSeconds === 0 && block(added[1]).endSeconds === 15, 'Different operators begin independent Manual work at zero');
assert(block(added[2]).startSeconds === 20 && block(added[3]).startSeconds === 15 && block(added[5]).startSeconds === 20, 'Manual, Walking, and Waiting advance only their assigned operator cursor');
assert(block(added[4]).startSeconds === 30 && block(added[4]).endSeconds === 60 && schedule.operatorCursors[operatorOne.id] === 30, 'Automatic work launches from its operator cursor without advancing it');
assert(schedule.overallOperatorEndSeconds === 30 && schedule.latestAutomaticEndSeconds === 60 && schedule.chartCycleSpanSeconds === 60, 'Cycle span is the maximum operator or automatic end, never the sum of lanes');
const oneSummary = schedule.operatorSummaries.find((item) => item.operatorId === operatorOne.id);
const twoSummary = schedule.operatorSummaries.find((item) => item.operatorId === operatorTwo.id);
assert(oneSummary.manualSeconds === 30 && oneSummary.automaticLaunchedSeconds === 30 && oneSummary.occupiedSeconds === 30 && close(oneSummary.occupiedShareOfChartSpan, .5), 'Operator workload separates occupied work from launched Automatic time');
assert(twoSummary.walkingSeconds === 5 && twoSummary.waitingSeconds === 5 && twoSummary.entryCount === 3, 'Walking, Waiting, and entry totals remain explicit per operator');
assert(!('durationSeconds' in operators.getOperator(operatorOne.id)) && !('cycleTimeSeconds' in standardWork.getEntry(added[0].id)), 'Operators and entries contain no copied operation duration');

const handover = handoverCommands.create(added[0].id, added[1].id);
assert(handover?.id === 'SWH-0001', 'A valid forward handover receives a stable SWH ID');
schedule = scheduler.calculate(study, standardWork.getEntries(study.id));
assert(block(added[1]).startSeconds === 20 && block(added[1]).endSeconds === 35 && block(added[3]).startSeconds === 35 && schedule.dependencyIdleSeconds === 20, 'A handover delays the receiving cursor and records dependency idle without fabricating Waiting work');
const automaticHandover = handoverCommands.create(added[4].id, added[5].id);
assert(automaticHandover && scheduler.calculate(study, standardWork.getEntries(study.id)).operatorBlocks.find((item) => item.entryId === added[5].id).startSeconds === 60, 'Automatic completion may release a later operator entry');
assert(!handoverCommands.create(added[0].id, added[0].id) && !handoverCommands.create(added[1].id, added[0].id) && !handoverCommands.create(added[0].id, added[1].id), 'Self, backward, and duplicate handovers are rejected');
const graphErrors = validateHandoverGraph(standardWork.getEntries(study.id), [{ id: 'SWH-9001', studyId: study.id, fromEntryId: added[0].id, toEntryId: added[1].id, enabled: true, note: '' }, { id: 'SWH-9002', studyId: study.id, fromEntryId: added[1].id, toEntryId: added[0].id, enabled: true, note: '' }]);
assert(graphErrors.some((issue) => issue.code === 'backward') && graphErrors.some((issue) => issue.code === 'cycle'), 'Dependency validation deterministically rejects backward edges and cycles');
assert(handoverCommands.update(handover.id, { enabled: false }) && scheduler.calculate(study, standardWork.getEntries(study.id)).operatorBlocks.find((item) => item.entryId === added[1].id).startSeconds === 0, 'Disabled handovers are persisted but ignored by scheduling');
assert(history.undo() && handovers.getHandover(handover.id).enabled, 'Undo restores handover enabled state');

assert(operatorCommands.assignEntry(added[1].id, operatorOne.id), 'Entry assignment is undoable');
schedule = scheduler.calculate(study, standardWork.getEntries(study.id));
assert(schedule.diagnostics.some((issue) => issue.code === 'same-operator-handover'), 'A same-operator handover is preserved with a warning');
assert(history.undo() && standardWork.getEntry(added[1].id).assignedOperatorId === operatorTwo.id, 'Undo restores the original entry assignment');
assert(history.redo() && standardWork.getEntry(added[1].id).assignedOperatorId === operatorOne.id, 'Redo reapplies the same operator assignment');
history.undo();

assert(operatorCommands.delete(operatorTwo.id, operatorOne.id), 'Deleting an assigned operator requires and accepts a same-study replacement');
assert(!operators.getOperator(operatorTwo.id) && standardWork.getEntries(study.id).every((entry) => entry.assignedOperatorId === operatorOne.id), 'Operator deletion reassigns every affected entry atomically');
assert(history.undo() && operators.getOperator(operatorTwo.id) && standardWork.getEntry(added[1].id).assignedOperatorId === operatorTwo.id, 'Undo restores the deleted SWO ID and original assignments');
assert(history.redo() && !operators.getOperator(operatorTwo.id), 'Redo reuses the same deletion and replacement identities');
history.undo();

const duplicateStudy = studyCommands.duplicateStudy(study.id);
const duplicateOperators = operators.getOperators(duplicateStudy.id); const duplicateEntries = standardWork.getEntries(duplicateStudy.id); const duplicateHandovers = handovers.getHandovers(duplicateStudy.id);
assert(duplicateStudy && duplicateOperators.every((item) => !operators.getOperators(study.id).some((source) => source.id === item.id)) && duplicateEntries.every((item) => item.assignedOperatorId.startsWith('SWO-')), 'Study duplication allocates new study, operator, and entry IDs with remapped assignments');
assert(duplicateHandovers.length === handovers.getHandovers(study.id).length && duplicateHandovers.every((item) => duplicateEntries.some((entry) => entry.id === item.fromEntryId) && duplicateEntries.some((entry) => entry.id === item.toEntryId)), 'Study duplication remaps handover entry references without duplicating operations');
assert(history.undo() && !standardWork.getStudy(duplicateStudy.id), 'Study duplication undo removes all duplicated records');
assert(history.redo() && standardWork.getStudy(duplicateStudy.id) && operators.getOperators(duplicateStudy.id)[0].id === duplicateOperators[0].id, 'Study duplication redo restores the exact allocated IDs');

const attachedBefore = handovers.getAttached(added[0].id).map((item) => item.id);
assert(studyCommands.removeEntry(added[0].id) && attachedBefore.every((id) => !handovers.getHandover(id)), 'Entry deletion removes attached handovers in the same command');
assert(history.undo() && standardWork.getEntry(added[0].id) && attachedBefore.every((id) => handovers.getHandover(id)), 'Entry deletion undo restores the entry and exact handover IDs');

assert(operatorCommands.update(operatorOne.id, { linkedResourceId: machine.id }) && operators.getOperator(operatorOne.id).linkedResourceId === machine.id, 'An operator may link to a physical resource by stable ID');
assert(commands.deleteResource(machine.id) === 'deleted' && operators.getOperator(operatorOne.id).linkedResourceId === null, 'Physical-resource deletion clears the informational operator link without deleting the operator');
assert(history.undo() && resources.getResource(machine.id) && operators.getOperator(operatorOne.id).linkedResourceId === machine.id, 'Resource deletion undo restores both the resource and operator link');

const validation = validateStandardWork(standardWork.getStudies(), standardWork.getEntries(), operations, operators.getOperators(), handovers.getHandovers(), resources);
assert(validation.errors === 0 && validation.issues.every((issue) => issue.code !== 'missing-operator'), 'The complete operator and handover graph passes project validation');

connections.dispose(); operations.dispose(); resources.dispose();
console.log('Standard Work operator, allocation, workload, handover, deletion, duplication, and history checks passed.');
