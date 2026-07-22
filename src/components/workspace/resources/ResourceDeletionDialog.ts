import type { OperationStore } from '../../../services/OperationStore';
import type { ResourceStore } from '../../../services/ResourceStore';
import { actionButton, element } from '../../../ui/dom';
import type { CommandFactory } from '../../../services/history/CommandFactory';
import type { FactoryRouteStore } from '../../../services/FactoryRouteStore';
import type { FactoryAnnotationStore } from '../../../services/FactoryAnnotationStore';

export interface ResourceDeletionDialogController { readonly element: HTMLDialogElement; request(resourceId: string): void; dispose(): void; }

export function createResourceDeletionDialog(resources: ResourceStore, operations: OperationStore, routes: FactoryRouteStore, annotations: FactoryAnnotationStore, commands: CommandFactory, onStatus: (message: string) => void): ResourceDeletionDialogController {
  const dialog = element('dialog', 'confirmation-dialog'); const title = element('h3', '', 'Delete physical resource?'); title.id = 'resource-delete-title'; dialog.setAttribute('aria-labelledby', title.id); const message = element('p'); const actions = element('div', 'confirmation-dialog__actions'); const cancel = actionButton('Cancel'); const confirm = actionButton('Delete and Unassign', 'command-button command-button--primary'); actions.append(cancel, confirm); dialog.append(title, message, actions); let pendingId: string | null = null;
  const consequences = (resourceId: string): { readonly operations: number; readonly routes: number; readonly annotations: number } => {
    const attachedRoutes = routes.getRoutesForResource(resourceId);
    const attachedAnnotations = new Set([...annotations.getAttached('resource', resourceId), ...attachedRoutes.flatMap((route) => annotations.getAttached('factoryRoute', route.id))].map((item) => item.id));
    return { operations: operations.getAssignmentCount(resourceId), routes: attachedRoutes.length, annotations: attachedAnnotations.size };
  };
  cancel.addEventListener('click', () => dialog.close());
  confirm.addEventListener('click', () => {
    if (!pendingId) return; const resource = resources.getResource(pendingId); if (!resource) { dialog.close(); return; } const impact = consequences(resource.id); const result = commands.deleteResource(resource.id);
    if (result === 'deleted') onStatus(`Resource deleted; ${impact.operations} operation${impact.operations === 1 ? '' : 's'} unassigned, ${impact.routes} route${impact.routes === 1 ? '' : 's'} and ${impact.annotations} annotation${impact.annotations === 1 ? '' : 's'} removed`); else onStatus(result === 'locked' ? 'Resource is locked' : 'Resource not found'); pendingId = null; dialog.close();
  });
  return { element: dialog, request: (resourceId) => { const resource = resources.getResource(resourceId); if (!resource) return; if (resource.locked) { onStatus('Resource is locked'); return; } pendingId = resourceId; const impact = consequences(resourceId); message.textContent = `${resource.id} — ${resource.name} is assigned to ${impact.operations} operation${impact.operations === 1 ? '' : 's'}, is an endpoint of ${impact.routes} factory route${impact.routes === 1 ? '' : 's'}, and has ${impact.annotations} dependent annotation${impact.annotations === 1 ? '' : 's'}. Deleting it will unassign affected operations and remove those routes and annotations.`; dialog.showModal(); }, dispose: () => dialog.remove() };
}
