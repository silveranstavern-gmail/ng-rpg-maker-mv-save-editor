import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SaveFileService } from '../../services/save-file.service';

interface ActorMasteryViewModel {
  skillId: number;
  name: string;
  level: number;
  uses: number;
  max: number;
}

interface ActorViewModel {
  id: number;
  name: string;
  level: number;
  hp: number;
  mp: number;
  tp: number;
  classId: number;
  exp: number;
  expMap: Record<string, number>;
  paramPlus: number[];
  mastery: ActorMasteryViewModel[];
}

interface ItemViewModel {
  id: number;
  quantity: number;
  name?: string;
}

interface VariableViewModel {
  id: number;
  value: number;
  name?: string;
}

type JsonKey = string | number;

interface JsonNode {
  key: string;
  path: JsonKey[];
  value: any;
  isPrimitive: boolean;
  isArray: boolean;
  children: JsonNode[];
}

@Component({
  selector: 'app-save-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './save-editor.component.html',
  styleUrl: './save-editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SaveEditorComponent {
  protected readonly saveService = inject(SaveFileService);

  readonly save = this.saveService.save;
  readonly fileLabel = this.saveService.fileLabel;
  readonly error = this.saveService.error;
  readonly steps = this.saveService.steps;

  // Form helpers
  newItemId = signal<number | null>(null);
  newItemQuantity = signal<number>(1);
  newWeaponId = signal<number>(0);
  newWeaponQuantity = signal<number>(1);
  newArmorId = signal<number>(0);
  newArmorQuantity = signal<number>(1);
  itemSearch = signal<string>('');
  weaponSearch = signal<string>('');
  armorSearch = signal<string>('');
  importItems = signal<boolean>(true);
  importWeapons = signal<boolean>(true);
  importArmors = signal<boolean>(true);
  importSkills = signal<boolean>(true);
  importSystem = signal<boolean>(true);
  dataDirLabel = signal<string>('');
  dataDirStatus = signal<string | null>(null);
  showRaw = signal<boolean>(false);
  isRawOpen = signal<boolean>(false);
  isEconomyOpen = signal<boolean>(true);
  isItemsOpen = signal<boolean>(false);
  isWeaponsOpen = signal<boolean>(false);
  isArmorsOpen = signal<boolean>(false);
  isVariablesOpen = signal<boolean>(false);
  isActorsOpen = signal<boolean>(false);
  editingPath = signal<string | null>(null);
  editingValue = signal<string>('');
  masteryModalActorId = signal<number | null>(null);
  masteryAllLevel = signal<number | null>(null);
  masteryAllUses = signal<number | null>(null);
  masteryAllThreshold = signal<number | null>(null);
  masteryGlobalLevel = signal<number | null>(null);
  masteryGlobalUses = signal<number | null>(null);
  masteryGlobalThreshold = signal<number | null>(null);
  masteryGlobalDefaultsVersion = signal<number>(0);

  items = computed<ItemViewModel[]>(() => {
    const meta = this.saveService.metadata();
    return this.saveService.items().map(item => ({
      ...item,
      name: meta[item.id]
    }));
  });

  weapons = computed<ItemViewModel[]>(() => {
    const meta = this.saveService.weaponNames();
    return this.saveService.weapons().map(w => ({ ...w, name: meta[w.id] }));
  });

  armors = computed<ItemViewModel[]>(() => {
    const meta = this.saveService.armorNames();
    return this.saveService.armors().map(a => ({ ...a, name: meta[a.id] }));
  });

  filteredItems = computed<ItemViewModel[]>(() => {
    const term = this.itemSearch().toLowerCase().trim();
    const list = this.items();
    if (!term) return list;
    return list.filter(item => {
      const nameMatch = item.name?.toLowerCase().includes(term);
      const idMatch = item.id.toString().includes(term);
      return Boolean(nameMatch || idMatch);
    });
  });

  filteredWeapons = computed<ItemViewModel[]>(() => {
    const term = this.weaponSearch().toLowerCase().trim();
    const list = this.weapons();
    if (!term) return list;
    return list.filter(weapon => {
      const nameMatch = weapon.name?.toLowerCase().includes(term);
      const idMatch = weapon.id.toString().includes(term);
      return Boolean(nameMatch || idMatch);
    });
  });

  filteredArmors = computed<ItemViewModel[]>(() => {
    const term = this.armorSearch().toLowerCase().trim();
    const list = this.armors();
    if (!term) return list;
    return list.filter(armor => {
      const nameMatch = armor.name?.toLowerCase().includes(term);
      const idMatch = armor.id.toString().includes(term);
      return Boolean(nameMatch || idMatch);
    });
  });

  variables = computed<VariableViewModel[]>(() => {
    const meta = this.saveService.variableNames();
    return this.saveService.variables().map(v => ({ id: v.id, value: v.quantity, name: meta[v.id] }));
  });

  rawRoot = computed<JsonNode | null>(() => {
    const value = this.save();
    if (!value) return null;
    return this.createNode('(root)', value, [], true);
  });

  actors = computed<ActorViewModel[]>(() => {
    const skillMeta = this.saveService.skillNames();
    return this.saveService.actors().map(actor => {
      const expMap = actor._exp ?? {};
      const currentClassId = actor._classId ?? Number(Object.keys(expMap)[0] ?? 0);
      const exp = currentClassId ? expMap[currentClassId] ?? 0 : 0;
      const paramPlus = actor._paramPlus?.['@a'] ?? new Array(8).fill(0);

      const levels = actor._skillMasteryLevels ?? {};
      const uses = actor._skillMasteryUses ?? {};
      const maxes = actor._skillMasteryUsageMax ?? {};
      const masteryIds = new Set(
        [...Object.keys(levels), ...Object.keys(uses), ...Object.keys(maxes)]
          .map(Number)
          .filter(id => Number.isFinite(id) && id > 0)
      );

      const mastery: ActorMasteryViewModel[] = Array.from(masteryIds)
        .map(skillId => ({
          skillId,
          name: skillMeta[skillId] || `Skill ${skillId}`,
          level: levels[skillId] ?? 0,
          uses: uses[skillId] ?? 0,
          max: maxes[skillId] ?? 0
        }))
        .sort((a, b) => a.skillId - b.skillId);

      return {
        id: actor._actorId,
        name: actor._name,
        level: actor._level,
        hp: actor._hp,
        mp: actor._mp,
        tp: actor._tp ?? 0,
        classId: currentClassId,
        exp,
        expMap,
        paramPlus,
        mastery
      };
    });
  });

  globalMasteryDefaults = computed(() => {
    // Bump the dependency to allow manual refresh via button
    this.masteryGlobalDefaultsVersion();
    let level = 0;
    let uses = 0;
    let threshold = 0;
    this.actors().forEach(actor => {
      actor.mastery.forEach(skill => {
        if (Number.isFinite(skill.level)) level = Math.max(level, skill.level);
        if (Number.isFinite(skill.uses)) uses = Math.max(uses, skill.uses);
        if (Number.isFinite(skill.max)) threshold = Math.max(threshold, skill.max);
      });
    });
    return { level, uses, threshold };
  });

  async onSaveFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    await this.saveService.loadSaveFile(file);
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

  addItem() {
    const idRaw = this.newItemId();
    const id = idRaw == null ? NaN : Number(idRaw);
    const qty = Number(this.newItemQuantity());
    if (id <= 0 || Number.isNaN(id)) return;
    this.saveService.updateItem(id, qty);
    this.newItemQuantity.set(1);
  }

  updateItemQuantity(id: number, value: number | string) {
    this.saveService.updateItem(id, Number(value));
  }

  addWeapon() {
    const id = Number(this.newWeaponId());
    const qty = Number(this.newWeaponQuantity());
    if (id <= 0 || Number.isNaN(id)) return;
    this.saveService.updateWeapon(id, qty);
    this.newWeaponQuantity.set(1);
  }

  updateWeaponQuantity(id: number, value: number | string) {
    this.saveService.updateWeapon(id, Number(value));
  }

  addArmor() {
    const id = Number(this.newArmorId());
    const qty = Number(this.newArmorQuantity());
    if (id <= 0 || Number.isNaN(id)) return;
    this.saveService.updateArmor(id, qty);
    this.newArmorQuantity.set(1);
  }

  updateArmorQuantity(id: number, value: number | string) {
    this.saveService.updateArmor(id, Number(value));
  }

  updateVariable(id: number, value: number | string) {
    this.saveService.updateVariable(id, Number(value));
  }

  updateGold(value: number | string) {
    this.saveService.updateGold(Number(value));
  }

  updateActorField(actorId: number, key: keyof ActorViewModel, value: number | string) {
    const numericValue = Number(value);
    if (key === 'exp') {
      const actor = this.actors().find(a => a.id === actorId);
      if (actor) {
        this.saveService.updateActorExp(actorId, actor.classId, numericValue);
      }
      return;
    }
    const patch: any = {};
    if (key === 'level') patch._level = numericValue;
    if (key === 'hp') patch._hp = numericValue;
    if (key === 'mp') patch._mp = numericValue;
    if (key === 'tp') patch._tp = numericValue;
    this.saveService.updateActor(actorId, patch);
  }

  updateActorParam(actorId: number, index: number, value: number | string) {
    this.saveService.updateActorParam(actorId, index, Number(value));
  }

  updateMastery(actorId: number, skillId: number, type: 'level' | 'uses' | 'max', value: number | string) {
    const fieldMap = {
      level: '_skillMasteryLevels',
      uses: '_skillMasteryUses',
      max: '_skillMasteryUsageMax'
    } as const;

    this.saveService.updateActorMastery(actorId, skillId, fieldMap[type], Number(value));
  }

  openMastery(actorId: number) {
    this.masteryModalActorId.set(actorId);
  }

  closeMastery() {
    this.masteryModalActorId.set(null);
    this.masteryAllLevel.set(null);
    this.masteryAllUses.set(null);
    this.masteryAllThreshold.set(null);
  }

  modalActor(): ActorViewModel | null {
    const id = this.masteryModalActorId();
    if (id == null) return null;
    return this.actors().find(a => a.id === id) ?? null;
  }

  applyMasteryAll() {
    const actor = this.modalActor();
    if (!actor) return;
    const level = this.masteryAllLevel();
    const uses = this.masteryAllUses();
    const threshold = this.masteryAllThreshold();
    actor.mastery.forEach(skill => {
      if (level != null) this.updateMastery(actor.id, skill.skillId, 'level', level);
      if (uses != null) this.updateMastery(actor.id, skill.skillId, 'uses', uses);
      if (threshold != null) this.updateMastery(actor.id, skill.skillId, 'max', threshold);
    });
  }

  applyGlobalMastery() {
    const defaults = this.globalMasteryDefaults();
    const levelInput = this.masteryGlobalLevel();
    const usesInput = this.masteryGlobalUses();
    const thresholdInput = this.masteryGlobalThreshold();

    const level = Number.isFinite(levelInput ?? NaN) ? Number(levelInput) : defaults.level;
    const uses = Number.isFinite(usesInput ?? NaN) ? Number(usesInput) : defaults.uses;
    const threshold = Number.isFinite(thresholdInput ?? NaN) ? Number(thresholdInput) : defaults.threshold;

    const actors = this.actors();
    if (!actors.length) return;

    actors.forEach(actor => {
      actor.mastery.forEach(skill => {
        this.updateMastery(actor.id, skill.skillId, 'level', level);
        this.updateMastery(actor.id, skill.skillId, 'uses', uses);
        this.updateMastery(actor.id, skill.skillId, 'max', threshold);
      });
    });
  }

  refreshGlobalDefaults() {
    this.masteryGlobalDefaultsVersion.update(v => v + 1);
    this.masteryGlobalLevel.set(null);
    this.masteryGlobalUses.set(null);
    this.masteryGlobalThreshold.set(null);
  }

  async onSaveJsonSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    await this.saveService.loadJsonSave(file);
    target.value = '';
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

  triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  startEdit(node: JsonNode) {
    if (!node.isPrimitive) return;
    this.editingPath.set(this.pathKey(node.path));
    this.editingValue.set(this.stringifyValue(node.value));
  }

  commitEdit(node: JsonNode) {
    if (!this.isEditing(node)) return;
    const parsed = this.parseValue(this.editingValue());
    this.saveService.updateByPath(node.path, parsed);
    this.editingPath.set(null);
    this.editingValue.set('');
  }

  cancelEdit() {
    this.editingPath.set(null);
    this.editingValue.set('');
  }

  protected toNumber(value: unknown): number {
    return Number(value);
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

    const lookup = (fileName: string) =>
      files.find(f => f.name.toLowerCase() === fileName.toLowerCase());

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
  }

  clearData() {
    this.saveService.clearAll();
    this.dataDirLabel.set('');
    this.dataDirStatus.set(null);
    this.newItemId.set(null);
    this.newItemQuantity.set(1);
    this.newWeaponId.set(0);
    this.newWeaponQuantity.set(1);
    this.newArmorId.set(0);
    this.newArmorQuantity.set(1);
    this.itemSearch.set('');
    this.weaponSearch.set('');
    this.armorSearch.set('');
    this.showRaw.set(false);
    this.isRawOpen.set(false);
    this.isEconomyOpen.set(true);
    this.isItemsOpen.set(false);
    this.isWeaponsOpen.set(false);
    this.isArmorsOpen.set(false);
    this.isVariablesOpen.set(false);
    this.isActorsOpen.set(false);
    this.editingPath.set(null);
    this.editingValue.set('');
    this.masteryModalActorId.set(null);
    this.masteryAllLevel.set(null);
    this.masteryAllUses.set(null);
    this.masteryAllThreshold.set(null);
    this.masteryGlobalLevel.set(null);
    this.masteryGlobalUses.set(null);
    this.masteryGlobalThreshold.set(null);
  }

  isEditing(node: JsonNode): boolean {
    return this.editingPath() === this.pathKey(node.path);
  }

  formatValue(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  }

  stringifyValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  trackNode(node: JsonNode): string {
    return `${this.pathKey(node.path)}|${node.key}`;
  }

  private async fetchSampleFile(path: string, name: string): Promise<File> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} when fetching ${name}`);
    }
    const blob = await response.blob();
    return new File([blob], name, { type: 'application/json' });
  }

  private pathKey(path: JsonKey[]): string {
    return path.map(p => p.toString()).join('.') || '(root)';
  }

  private parseValue(raw: string): any {
    const trimmed = raw.trim();
    if (trimmed === '') return '';
    if (trimmed === 'null') return null;
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (!Number.isNaN(Number(trimmed)) && trimmed !== '') return Number(trimmed);
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // fall through
      }
    }
    return raw;
  }

  private createNode(key: JsonKey | string, value: any, path: JsonKey[], skipPath = false): JsonNode {
    const displayKey = key?.toString?.() ?? '(root)';
    const nextPath = skipPath ? path : [...path, key as JsonKey];
    const isArray = Array.isArray(value);
    const isObject = value !== null && typeof value === 'object';
    if (isObject) {
      const children = isArray
        ? (value as any[]).map((child, idx) => this.createNode(idx, child, nextPath))
        : Object.keys(value as Record<string, any>).map(k =>
            this.createNode(k, (value as Record<string, any>)[k], nextPath)
          );
      return {
        key: displayKey,
        path: nextPath,
        value,
        isPrimitive: false,
        isArray,
        children
      };
    }

    return {
      key: displayKey,
      path: nextPath,
      value,
      isPrimitive: true,
      isArray: false,
      children: []
    };
  }
}
