import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SaveFileService } from '../../../services/save-file.service';

@Component({
  selector: 'app-file-loader',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './file-loader.component.html',
  styleUrl: './file-loader.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FileLoaderComponent {
  private readonly saveService = inject(SaveFileService);

  readonly sampleDataLoaded = output<void>();
  readonly save = this.saveService.save;
  readonly fileLabel = this.saveService.fileLabel;
  readonly error = this.saveService.error;

  readonly dataDirLabel = signal<string>('');
  readonly dataDirStatus = signal<string | null>(null);
  readonly importItems = signal<boolean>(true);
  readonly importWeapons = signal<boolean>(true);
  readonly importArmors = signal<boolean>(true);
  readonly importSkills = signal<boolean>(true);
  readonly importSystem = signal<boolean>(true);

  readonly hasSave = computed(() => Boolean(this.save()));

  async onSaveFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    await this.saveService.loadSaveFile(file);
    target.value = '';
  }

  async onSaveJsonSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    await this.saveService.loadJsonSave(file);
    target.value = '';
  }

  async onItemsSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    await this.saveService.loadItemsMetadata(file);
    target.value = '';
  }

  async onWeaponsSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    await this.saveService.loadWeaponsMetadata(file);
    target.value = '';
  }

  async onArmorsSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    await this.saveService.loadArmorsMetadata(file);
    target.value = '';
  }

  async onSystemSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    await this.saveService.loadSystemMetadata(file);
    target.value = '';
  }

  async onDataDirSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const allFiles = input.files ? Array.from(input.files) : [];
    if (!allFiles.length) return;

    const allowed = new Set(['items.json', 'weapons.json', 'armors.json', 'skills.json', 'system.json']);
    const files = allFiles.filter(f => allowed.has(f.name.toLowerCase()));
    const ignoredCount = allFiles.length - files.length;

    const root = files[0].webkitRelativePath?.split('/')[0] ?? '';
    this.dataDirLabel.set(root || 'www/data');
    this.dataDirStatus.set(null);

    const lookup = (fileName: string) => files.find(f => f.name.toLowerCase() === fileName.toLowerCase());
    const missing: string[] = [];

    try {
      if (this.importItems()) {
        const file = lookup('Items.json');
        file ? await this.saveService.loadItemsMetadata(file) : missing.push('Items.json');
      }
      if (this.importWeapons()) {
        const file = lookup('Weapons.json');
        file ? await this.saveService.loadWeaponsMetadata(file) : missing.push('Weapons.json');
      }
      if (this.importArmors()) {
        const file = lookup('Armors.json');
        file ? await this.saveService.loadArmorsMetadata(file) : missing.push('Armors.json');
      }
      if (this.importSkills()) {
        const file = lookup('Skills.json');
        file ? await this.saveService.loadSkillsMetadata(file) : missing.push('Skills.json');
      }
      if (this.importSystem()) {
        const file = lookup('System.json');
        file ? await this.saveService.loadSystemMetadata(file) : missing.push('System.json');
      }
    } finally {
      input.value = '';
    }

    if (missing.length) {
      this.dataDirStatus.set(`Missing: ${missing.join(', ')}`);
    } else if (files.length === 0) {
      this.dataDirStatus.set('No expected JSON files found in selection');
    } else {
      const ignoredInfo = ignoredCount > 0 ? ` (ignored ${ignoredCount} other files)` : '';
      this.dataDirStatus.set(`Imported from folder${ignoredInfo}`);
    }
  }

  async loadSampleData() {
    this.dataDirLabel.set('Sample data');
    this.dataDirStatus.set(null);

    const errors: string[] = [];
    const tasks: {
      enabled: boolean;
      path: string;
      name: string;
      loader: (file: File) => Promise<void>;
    }[] = [
      { enabled: this.importItems(), path: 'sample-data/Items.json', name: 'Items.json', loader: f => this.saveService.loadItemsMetadata(f) },
      { enabled: this.importWeapons(), path: 'sample-data/Weapons.json', name: 'Weapons.json', loader: f => this.saveService.loadWeaponsMetadata(f) },
      { enabled: this.importArmors(), path: 'sample-data/Armors.json', name: 'Armors.json', loader: f => this.saveService.loadArmorsMetadata(f) },
      { enabled: this.importSkills(), path: 'sample-data/Skills.json', name: 'Skills.json', loader: f => this.saveService.loadSkillsMetadata(f) },
      { enabled: this.importSystem(), path: 'sample-data/System.json', name: 'System.json', loader: f => this.saveService.loadSystemMetadata(f) }
    ];

    for (const task of tasks) {
      if (!task.enabled) continue;
      try {
        const file = await this.fetchSampleFile(task.path, task.name);
        await task.loader(file);
      } catch (err: any) {
        errors.push(`${task.name}: ${err?.message ?? 'failed to load sample file'}`);
      }
    }

    try {
      const sampleSave = await this.fetchSampleFile('sample-data/file2.json', 'file2.json');
      await this.saveService.loadJsonSave(sampleSave);
    } catch (err: any) {
      errors.push(`file2.json: ${err?.message ?? 'failed to load sample save'}`);
    }

    if (errors.length) {
      this.dataDirStatus.set(`Sample data loaded with issues: ${errors.join('; ')}`);
    } else {
      this.dataDirStatus.set('Loaded sample save and metadata');
    }

    this.sampleDataLoaded.emit();
  }

  clearData() {
    this.saveService.clearAll();
    this.dataDirLabel.set('');
    this.dataDirStatus.set(null);
    this.importItems.set(true);
    this.importWeapons.set(true);
    this.importArmors.set(true);
    this.importSkills.set(true);
    this.importSystem.set(true);
  }

  downloadSave() {
    const payload = this.saveService.downloadUpdatedSave();
    if (!payload) return;
    this.triggerDownload(payload.blob, payload.filename);
  }

  downloadRawJson() {
    const payload = this.saveService.downloadRawJson();
    if (!payload) return;
    this.triggerDownload(payload.blob, payload.filename);
  }

  private triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private async fetchSampleFile(path: string, name: string): Promise<File> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} when fetching ${name}`);
    }
    const blob = await response.blob();
    return new File([blob], name, { type: 'application/json' });
  }
}
