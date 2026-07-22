import { reportStatus } from '../../core/events/uiEvents';
import type { ProjectDialogsController } from '../../components/project/ProjectDialogs';
import { deserializeProject } from './ProjectDeserializer';
import { ProjectFileService, type ProjectFileHandle } from './ProjectFileService';
import { serializeProject } from './ProjectSerializer';
import type { ProjectSessionService } from './ProjectSessionService';
import { createDemoProject } from './DemoProjectFactory';

export interface ProjectFileCommands { newProject(): Promise<void>; open(): Promise<void>; save(): Promise<boolean>; saveAs(): Promise<boolean>; loadDemo(): Promise<void>; }

export class ProjectFileController implements ProjectFileCommands {
  private handle: ProjectFileHandle | null = null;
  private busy = false;
  private readonly beforeUnload = (event: BeforeUnloadEvent): void => { if (!this.session.isDirty()) return; event.preventDefault(); event.returnValue = ''; };
  public constructor(private readonly session: ProjectSessionService, private readonly files: ProjectFileService, private readonly dialogs: ProjectDialogsController, private readonly setBusy: (busy: boolean) => void, private readonly beforeReplace: () => void = () => {}) {
    window.addEventListener('beforeunload', this.beforeUnload);
    files.registerLaunchConsumer((opened) => { void this.acceptOpenedFile(opened); }, (error) => { void this.run(async () => { throw error; }, 'Project could not be opened'); });
  }
  public async newProject(): Promise<void> { await this.run(async () => { if (!await this.allowReplace('create a new project')) { reportStatus('New project cancelled'); return; } this.beforeReplace(); this.handle = null; this.session.newProject(); reportStatus('New project created'); }, 'New project could not be created'); }
  public async loadDemo(): Promise<void> { await this.run(async () => { if (!await this.allowReplace('load the demonstration project')) { reportStatus('Demo load cancelled'); return; } this.beforeReplace(); this.handle = null; this.session.openProject(createDemoProject(), 'Manufacturing Flow Demonstration.mflow'); reportStatus('Demonstration project loaded'); }, 'Demonstration project could not be loaded'); }
  public async open(): Promise<void> {
    await this.run(async () => {
      if (!await this.allowReplace('open another project')) { reportStatus('Open cancelled'); return; }
      reportStatus('Opening project…');
      const opened = await this.files.open(); if (!opened) { reportStatus('Open cancelled'); return; }
      this.loadCandidate(opened);
    }, 'Project could not be opened');
  }
  public async save(): Promise<boolean> { return this.write(false); }
  public async saveAs(): Promise<boolean> { return this.write(true); }
  public dispose(): void { window.removeEventListener('beforeunload', this.beforeUnload); }
  private async allowReplace(action: string): Promise<boolean> { return !this.session.isDirty() || this.dialogs.confirmDiscard(action); }
  private async acceptOpenedFile(opened: NonNullable<Awaited<ReturnType<ProjectFileService['open']>>>): Promise<void> { await this.run(async () => { if (!await this.allowReplace('open the launched project')) { reportStatus('Open cancelled'); return; } this.loadCandidate(opened); }, 'Project could not be opened'); }
  private loadCandidate(opened: NonNullable<Awaited<ReturnType<ProjectFileService['open']>>>): void { const candidate = deserializeProject(opened.text); this.beforeReplace(); this.session.openProject(candidate.document, opened.name); this.handle = opened.handle; reportStatus(candidate.migratedFrom ? `Project opened and migrated from schema ${candidate.migratedFrom}` : `Project opened: ${opened.name}`); }
  private async write(saveAs: boolean): Promise<boolean> {
    let successful = false;
    await this.run(async () => {
      reportStatus('Saving project…');
      const state = this.session.getState(); const savedAt = new Date().toISOString();
      const result = serializeProject({ metadata: state.metadata, settings: state.settings, resources: this.session.resources, operations: this.session.operations, connections: this.session.connections, structure: this.session.structure, routes: this.session.routes, annotations: this.session.annotations, standardWork: this.session.standardWork, workspaces: this.session.workspaces }, savedAt);
      const suggested = saveAs ? state.metadata.name : state.fileName ?? state.metadata.name;
      const saved = await this.files.save(result.text, suggested, this.handle, saveAs);
      if (!saved) { reportStatus('Save cancelled'); return; }
      this.handle = saved.handle; this.session.markSaved(result.document.project, saved.name); successful = true;
      reportStatus(saved.fallbackDownload ? `Project downloaded: ${saved.name}` : `Project saved: ${saved.name}`);
    }, 'Project could not be saved');
    return successful;
  }
  private async run(action: () => Promise<void>, errorTitle: string): Promise<void> {
    if (this.busy) return; this.busy = true; this.setBusy(true);
    try { await action(); } catch (error) { reportStatus(errorTitle); await this.dialogs.showError(errorTitle, error instanceof Error ? error.message : String(error)); }
    finally { this.busy = false; this.setBusy(false); }
  }
}
