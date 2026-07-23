import { element } from '../../ui/dom';
import type { ScenarioSummary } from '../../models/scenarios/ManufacturingScenario';

export interface TitleBarController { readonly element: HTMLElement; setHealth(errors: number, warnings: number): void; setProject(name: string, dirty: boolean, fileName: string | null): void; setScenarios(values: readonly ScenarioSummary[], activeId: string): void; }

export function createTitleBar(onScenarioChange: (id: string) => void = () => {}): TitleBarController {
  const bar = element('header', 'titlebar'); const identity = element('div', 'titlebar__identity');
  const mark = element('span', 'app-mark', 'M'); mark.setAttribute('aria-hidden', 'true'); identity.append(mark, element('strong', 'titlebar__title', 'Manufacturing Flow Designer'));
  const project = element('div', 'titlebar__project'); const projectName = element('span', '', 'Untitled Project'); project.append(element('span', 'eyebrow', 'CURRENT PROJECT'), projectName);
  const scenario = element('label', 'titlebar__scenario'); scenario.append(element('span', 'eyebrow', 'ACTIVE SCENARIO')); const scenarioSelect = element('select'); scenarioSelect.setAttribute('aria-label', 'Active manufacturing scenario'); scenarioSelect.addEventListener('change', () => onScenarioChange(scenarioSelect.value)); scenario.append(scenarioSelect);
  const health = element('div', 'health health--healthy'); health.setAttribute('role', 'status'); const healthText = element('span', '', 'Project healthy'); health.append(element('span', 'health__dot'), healthText);
  const actions = element('div', 'window-actions'); ['—', '□', '×'].forEach((symbol) => { const item = element('span', '', symbol); item.setAttribute('aria-hidden', 'true'); actions.append(item); });
  bar.append(identity, project, scenario, health, actions);
  let projectTitle = 'Untitled Project'; let dirtyState = false; let fileTitle = ''; let scenarioTitle = 'Baseline';
  const updateDocumentTitle = (): void => { document.title = `Manufacturing Flow Designer — ${scenarioTitle} · ${projectTitle}${dirtyState ? ' *' : ''}${fileTitle}`; };
  return { element: bar, setProject: (name, dirty, fileName) => { const file = fileName ? ` [${fileName}]` : ''; projectTitle = name; dirtyState = dirty; fileTitle = file; projectName.textContent = `${name}${dirty ? ' *' : ''}${file}`; updateDocumentTitle(); }, setScenarios: (values, activeId) => {
    scenarioSelect.replaceChildren(); for (const value of values) { const option = element('option'); option.value = value.id; option.textContent = `${value.name} (${value.id})${value.isBaseline ? ' · Baseline' : ''}${value.locked ? ' · Locked' : ''}${value.errors ? ` · ${value.errors} errors` : value.warnings ? ` · ${value.warnings} warnings` : ' · Healthy'}${value.active ? ' · Active' : ''}`; scenarioSelect.append(option); } scenarioSelect.value = activeId; scenarioTitle = values.find((item) => item.id === activeId)?.name ?? activeId; updateDocumentTitle();
  }, setHealth: (errors, warnings) => {
    health.classList.toggle('health--healthy', errors === 0 && warnings === 0); health.classList.toggle('health--warning', errors === 0 && warnings > 0); health.classList.toggle('health--error', errors > 0);
    healthText.textContent = errors ? `${errors} project error${errors === 1 ? '' : 's'}` : warnings ? `${warnings} project warning${warnings === 1 ? '' : 's'}` : 'Project healthy';
  } };
}
