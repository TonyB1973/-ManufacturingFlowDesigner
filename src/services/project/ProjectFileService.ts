import { PROJECT_FILE_EXTENSION, PROJECT_MIME_TYPE } from '../../models/project/ProjectDocument';

export const MAX_PROJECT_FILE_BYTES = 20 * 1024 * 1024;

export interface ProjectFileHandle {
  readonly name: string;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void>; abort?(): Promise<void> }>;
}
interface OpenableProjectFileHandle extends ProjectFileHandle { getFile(): Promise<File>; }
interface BrowserFileEnvironment extends Window {
  showOpenFilePicker?: (options: unknown) => Promise<readonly OpenableProjectFileHandle[]>;
  showSaveFilePicker?: (options: unknown) => Promise<ProjectFileHandle>;
  launchQueue?: { setConsumer(consumer: (params: { files?: readonly OpenableProjectFileHandle[] }) => void): void };
}

export interface OpenedProjectFile { readonly text: string; readonly name: string; readonly handle: ProjectFileHandle | null; }
export interface SavedProjectFile { readonly name: string; readonly handle: ProjectFileHandle | null; readonly fallbackDownload: boolean; }

export class ProjectFileService {
  public constructor(private readonly browser: BrowserFileEnvironment = window as BrowserFileEnvironment) {}

  public async open(): Promise<OpenedProjectFile | null> {
    if (this.browser.showOpenFilePicker) {
      try {
        const [handle] = await this.browser.showOpenFilePicker({ multiple: false, types: [fileType()] });
        if (!handle) return null;
        const file = await handle.getFile();
        return { text: await this.read(file), name: file.name, handle };
      } catch (error) { if (isAbort(error)) return null; throw error; }
    }
    return this.openWithInput();
  }

  public registerLaunchConsumer(consumer: (file: OpenedProjectFile) => void, onError: (error: unknown) => void): void {
    this.browser.launchQueue?.setConsumer((params) => {
      const handle = params.files?.[0]; if (!handle) return;
      void handle.getFile().then(async (file) => consumer({ text: await this.read(file), name: file.name, handle })).catch(onError);
    });
  }

  public async save(text: string, suggestedName: string, currentHandle: ProjectFileHandle | null, saveAs: boolean): Promise<SavedProjectFile | null> {
    const name = safeFileName(suggestedName);
    let handle = saveAs ? null : currentHandle;
    if (!handle && this.browser.showSaveFilePicker) {
      try { handle = await this.browser.showSaveFilePicker({ suggestedName: name, types: [fileType()] }); }
      catch (error) { if (isAbort(error)) return null; throw error; }
    }
    if (handle) {
      const writable = await handle.createWritable();
      try { await writable.write(text); await writable.close(); }
      catch (error) { await writable.abort?.(); throw error; }
      return { name: handle.name || name, handle, fallbackDownload: false };
    }
    const blob = new Blob([text], { type: PROJECT_MIME_TYPE });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.hidden = true; document.body.append(anchor);
    window.setTimeout(() => { anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 0); }, 0);
    return { name, handle: null, fallbackDownload: true };
  }

  private async openWithInput(): Promise<OpenedProjectFile | null> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input'); input.type = 'file'; input.accept = `${PROJECT_FILE_EXTENSION},${PROJECT_MIME_TYPE},application/json`; input.hidden = true;
      const finish = (): void => input.remove();
      input.addEventListener('cancel', () => { finish(); resolve(null); }, { once: true });
      input.addEventListener('change', () => {
        const file = input.files?.[0]; finish();
        if (!file) { resolve(null); return; }
        this.read(file).then((text) => resolve({ text, name: file.name, handle: null }), reject);
      }, { once: true });
      document.body.append(input); input.click();
    });
  }

  private async read(file: File): Promise<string> {
    if (file.size > MAX_PROJECT_FILE_BYTES) throw new Error(`Project files may not exceed ${Math.round(MAX_PROJECT_FILE_BYTES / 1024 / 1024)} MB.`);
    return file.text();
  }
}

export function safeFileName(name: string): string {
  const withoutExtension = name.trim().replace(/\.mflow$/i, '').replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' ').trim();
  const safe = (withoutExtension || 'Untitled Project').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 120).replace(/[. -]+$/g, '') || 'Untitled-Project';
  return `${safe}${PROJECT_FILE_EXTENSION}`;
}
function fileType(): unknown { return { description: 'Manufacturing Flow Designer project', accept: { [PROJECT_MIME_TYPE]: [PROJECT_FILE_EXTENSION] } }; }
function isAbort(error: unknown): boolean { return error instanceof DOMException && error.name === 'AbortError'; }
