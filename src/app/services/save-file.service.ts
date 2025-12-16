import { Injectable, Signal, afterNextRender, computed, signal } from '@angular/core';
import { compressToBase64, decompressFromBase64 } from './lz-string';

export interface PartySection {
  _gold?: number;
  _steps?: number;
  _items?: Record<string, number>;
  _weapons?: Record<string, number>;
  _armors?: Record<string, number>;
  _actors?: { '@a': number[] };
}

export interface ActorEntry {
  _actorId: number;
  _name: string;
  _level: number;
  _hp: number;
  _mp: number;
  _tp?: number;
  _exp?: Record<string, number>;
  _classId?: number;
  _profile?: string;
  _paramPlus?: { '@a'?: number[] };
  _skillMasteryLevels?: Record<string, number>;
  _skillMasteryUses?: Record<string, number>;
  _skillMasteryUsageMax?: Record<string, number>;
  [key: string]: any;
}

export interface RpgSave {
  party?: PartySection;
  actors?: {
    _data?: { '@a': (ActorEntry | null)[] };
  };
  variables?: {
    _data?: { '@a': (number | null)[] };
  };
  [key: string]: any;
}

interface ItemRow {
  id: number;
  quantity: number;
  name?: string;
}

export interface RememberedFiles {
  save?: string;
  items?: string;
  weapons?: string;
  armors?: string;
  skills?: string;
  system?: string;
}

@Injectable({ providedIn: 'root' })
export class SaveFileService {
  private readonly saveData = signal<RpgSave | null>(null);
  private readonly fileName = signal<string | null>(null);
  private readonly lastError = signal<string | null>(null);
  private readonly itemMetadata = signal<Record<number, string>>({});
  private readonly weaponMetadata = signal<Record<number, string>>({});
  private readonly armorMetadata = signal<Record<number, string>>({});
  private readonly skillMetadata = signal<Record<number, string>>({});
  private readonly variableMetadata = signal<Record<number, string>>({});
  private readonly remembered = signal<RememberedFiles>({});

  constructor() {
    afterNextRender(() => {
      this.remembered.set(this.loadRemembered());
    });
  }

  public readonly partyGold = computed(() => this.saveData()?.party?._gold ?? 0);
  public readonly steps = computed(() => this.saveData()?.party?._steps ?? 0);
  public readonly save = computed(() => this.saveData());

  public readonly items: Signal<ItemRow[]> = computed(() => {
    const rawItems = this.saveData()?.party?._items ?? {};
    const meta = this.itemMetadata();
    const allIds = new Set<number>();

    Object.entries(rawItems).forEach(([id]) => {
      const numericId = Number(id);
      if (!Number.isNaN(numericId)) allIds.add(numericId);
    });

    Object.entries(meta).forEach(([id, name]) => {
      const numericId = Number(id);
      if (!Number.isNaN(numericId) && name) allIds.add(numericId);
    });

    return Array.from(allIds)
      .sort((a, b) => a - b)
      .map(id => ({
        id,
        quantity: rawItems[id] ?? 0,
        name: meta[id]
      }));
  });

  public readonly weapons: Signal<ItemRow[]> = computed(() => {
    const raw = this.saveData()?.party?._weapons ?? {};
    return Object.entries(raw)
      .filter(([id]) => !Number.isNaN(Number(id)))
      .map(([id, qty]) => ({ id: Number(id), quantity: qty ?? 0 }))
      .sort((a, b) => a.id - b.id);
  });

  public readonly armors: Signal<ItemRow[]> = computed(() => {
    const raw = this.saveData()?.party?._armors ?? {};
    return Object.entries(raw)
      .filter(([id]) => !Number.isNaN(Number(id)))
      .map(([id, qty]) => ({ id: Number(id), quantity: qty ?? 0 }))
      .sort((a, b) => a.id - b.id);
  });

  public readonly variables: Signal<ItemRow[]> = computed(() => {
    const arr = this.saveData()?.variables?._data?.['@a'] ?? [];
    return arr
      .map((value, idx) => ({ id: idx, quantity: value ?? 0 }))
      .filter(v => v.id > 0);
  });

  public readonly actors: Signal<ActorEntry[]> = computed(() => {
    const arr = this.saveData()?.actors?._data?.['@a'] ?? [];
    return arr.filter((a): a is ActorEntry => Boolean(a));
  });

  public readonly metadata = computed(() => this.itemMetadata());
  public readonly weaponNames = computed(() => this.weaponMetadata());
  public readonly armorNames = computed(() => this.armorMetadata());
  public readonly skillNames = computed(() => this.skillMetadata());
  public readonly variableNames = computed(() => this.variableMetadata());
  public readonly fileLabel = computed(() => this.fileName());
  public readonly error = computed(() => this.lastError());
  public readonly rememberedFiles = computed(() => this.remembered());
  public readonly prettyJson = computed(() => (this.saveData() ? JSON.stringify(this.saveData(), null, 2) : ''));

  async loadSaveFile(file: File) {
    try {
      const raw = (await file.text()).trim();
      let jsonString = decompressFromBase64(raw);

      // If the user drags in a plain JSON export instead of a compressed save,
      // fall back to direct parsing.
      if (!jsonString && raw.startsWith('{')) {
        jsonString = raw;
      }

      if (!jsonString) {
        throw new Error('Could not decompress the file. Is this a valid .rpgsave?');
      }

      const parsed: RpgSave = JSON.parse(jsonString);
      this.saveData.set(parsed);
      this.fileName.set(file.name);
      this.rememberFile('save', file.name);
      this.lastError.set(null);
    } catch (err: any) {
      this.lastError.set(err?.message ?? 'Unable to load save file');
      this.saveData.set(null);
    }
  }

  async loadJsonSave(file: File) {
    try {
      const raw = await file.text();
      const parsed: RpgSave = JSON.parse(raw);
      this.saveData.set(parsed);
      this.fileName.set(file.name);
      this.rememberFile('save', file.name);
      this.lastError.set(null);
    } catch (err: any) {
      this.lastError.set(err?.message ?? 'Unable to load JSON save');
      this.saveData.set(null);
    }
  }

  async loadItemsMetadata(file: File) {
    this.itemMetadata.set(await this.readNameMap(file, 'Items'));
    this.rememberFile('items', file.name);
  }

  async loadWeaponsMetadata(file: File) {
    this.weaponMetadata.set(await this.readNameMap(file, 'Weapons'));
    this.rememberFile('weapons', file.name);
  }

  async loadArmorsMetadata(file: File) {
    this.armorMetadata.set(await this.readNameMap(file, 'Armors'));
    this.rememberFile('armors', file.name);
  }

  async loadSkillsMetadata(file: File) {
    this.skillMetadata.set(await this.readNameMap(file, 'Skills'));
    this.rememberFile('skills', file.name);
  }

  async loadSystemMetadata(file: File) {
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.variables)) {
        const map: Record<number, string> = {};
        parsed.variables.forEach((v: string | null, idx: number) => {
          if (v) map[idx] = v;
        });
        this.variableMetadata.set(map);
      } else {
        this.lastError.set('System.json did not contain variables');
      }
      this.rememberFile('system', file.name);
    } catch (err) {
      this.lastError.set('Failed to read System.json metadata');
    }
  }

  private async readNameMap(file: File, label: string): Promise<Record<number, string>> {
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const map: Record<number, string> = {};
      if (Array.isArray(parsed)) {
        parsed.forEach((entry, idx) => {
          if (entry && entry.name) {
            map[idx] = entry.name;
          }
        });
      }
      return map;
    } catch {
      this.lastError.set(`Failed to read ${label}.json metadata`);
      return {};
    }
  }

  private rememberFile(key: 'save' | 'items' | 'weapons' | 'armors' | 'skills' | 'system', name: string) {
    const next = { ...this.remembered(), [key]: name };
    this.remembered.set(next);
    this.persistRemembered(next);
  }

  private loadRemembered(): RememberedFiles {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    try {
      const raw = window.localStorage.getItem('rpgsave-editor-recent-files');
      return raw ? (JSON.parse(raw) as RememberedFiles) : {};
    } catch {
      return {};
    }
  }

  private persistRemembered(data: RememberedFiles) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem('rpgsave-editor-recent-files', JSON.stringify(data));
    } catch {
      // ignore persistence errors
    }
  }

  updateGold(value: number) {
    this.saveData.update(current => {
      if (!current?.party) return current;
      const updated = structuredClone(current);
      const party = updated.party ?? (updated.party = {});
      party._gold = Math.max(0, Math.round(value));
      return updated;
    });
  }

  updateItem(id: number, quantity: number) {
    this.saveData.update(current => {
      if (!current?.party) return current;
      const updated = structuredClone(current);
      const party = updated.party ?? (updated.party = {});
      const items = party._items ?? {};
      if (quantity <= 0) {
        delete items[id];
      } else {
        items[id] = Math.round(quantity);
      }
      party._items = items;
      return updated;
    });
  }

  updateWeapon(id: number, quantity: number) {
    this.saveData.update(current => {
      if (!current?.party) return current;
      const updated = structuredClone(current);
      const party = updated.party ?? (updated.party = {});
      const store = party._weapons ?? {};
      if (quantity <= 0) {
        delete store[id];
      } else {
        store[id] = Math.round(quantity);
      }
      party._weapons = store;
      return updated;
    });
  }

  updateArmor(id: number, quantity: number) {
    this.saveData.update(current => {
      if (!current?.party) return current;
      const updated = structuredClone(current);
      const party = updated.party ?? (updated.party = {});
      const store = party._armors ?? {};
      if (quantity <= 0) {
        delete store[id];
      } else {
        store[id] = Math.round(quantity);
      }
      party._armors = store;
      return updated;
    });
  }

  updateVariable(id: number, value: number) {
    this.saveData.update(current => {
      if (!current?.variables?._data?.['@a']) return current;
      const updated = structuredClone(current);
      const arr = updated.variables!._data!['@a']!;
      arr[id] = Math.round(value);
      return updated;
    });
  }

  updateActor(actorId: number, patch: Partial<ActorEntry>) {
    this.saveData.update(current => {
      if (!current?.actors?._data?.['@a']) return current;
      const updated = structuredClone(current);
      const list = updated.actors!._data!['@a']!;
      const index = list.findIndex(a => a?._actorId === actorId);
      if (index === -1 || !list[index]) return current;
      list[index] = { ...list[index]!, ...patch };
      return updated;
    });
  }

  updateActorExp(actorId: number, classId: number, expValue: number) {
    this.saveData.update(current => {
      if (!current?.actors?._data?.['@a']) return current;
      const updated = structuredClone(current);
      const list = updated.actors!._data!['@a']!;
      const index = list.findIndex(a => a?._actorId === actorId);
      if (index === -1 || !list[index]) return current;
      const actor = list[index]!;
      const expMap = actor._exp ?? {};
      expMap[classId] = Math.max(0, Math.round(expValue));
      actor._exp = expMap;
      list[index] = actor;
      return updated;
    });
  }

  updateActorParam(actorId: number, index: number, value: number) {
    this.saveData.update(current => {
      if (!current?.actors?._data?.['@a']) return current;
      const updated = structuredClone(current);
      const list = updated.actors!._data!['@a']!;
      const targetIdx = list.findIndex(a => a?._actorId === actorId);
      if (targetIdx === -1 || !list[targetIdx]) return current;
      const actor = list[targetIdx]!;
      const paramArray = Array.isArray(actor._paramPlus?.['@a'])
        ? [...actor._paramPlus!['@a']!]
        : new Array(8).fill(0);
      paramArray[index] = Math.round(value);
      actor._paramPlus = { '@a': paramArray };
      list[targetIdx] = actor;
      return updated;
    });
  }

  updateActorMastery(
    actorId: number,
    skillId: number,
    field: '_skillMasteryLevels' | '_skillMasteryUses' | '_skillMasteryUsageMax',
    value: number
  ) {
    if (!Number.isFinite(skillId) || skillId <= 0) return;
    this.saveData.update(current => {
      if (!current?.actors?._data?.['@a']) return current;
      const updated = structuredClone(current);
      const list = updated.actors!._data!['@a']!;
      const index = list.findIndex(a => a?._actorId === actorId);

      if (index === -1 || !list[index]) return current;

      const actor = list[index]!;
      const dict = actor[field] ?? {};
      dict[skillId] = Math.max(0, Math.round(value));
      actor[field] = dict;

      list[index] = actor;
      return updated;
    });
  }

  updateByPath(path: (string | number)[], value: unknown) {
    this.saveData.update(current => {
      if (!current) return current;
      const updated: any = structuredClone(current);
      let cursor: any = updated;
      for (let i = 0; i < path.length - 1; i += 1) {
        const key = path[i];
        if (cursor[key] === undefined) {
          const nextKey = path[i + 1];
          cursor[key] = typeof nextKey === 'number' ? [] : {};
        }
        cursor = cursor[key];
      }
      const lastKey = path[path.length - 1];
      cursor[lastKey] = value;
      return updated;
    });
  }

  downloadUpdatedSave(): { blob: Blob; filename: string } | null {
    const payload = this.saveData();
    if (!payload) return null;
    const json = JSON.stringify(payload);
    const compressed = compressToBase64(json);
    const blob = new Blob([compressed], { type: 'application/octet-stream' });
    const base = this.fileName() ?? 'save.rpgsave';
    const sanitized = base.replace(/\.[^.]+$/, '');
    const filename = base.endsWith('.rpgsave') ? base : `${sanitized}.rpgsave`;
    return { blob, filename };
  }

  downloadRawJson(): { blob: Blob; filename: string } | null {
    const payload = this.saveData();
    if (!payload) return null;
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const base = this.fileName() ?? 'save.rpgsave';
    const sanitized = base.replace(/\.rpgsave$/i, '').replace(/\.[^.]+$/, '');
    const filename = `${sanitized || 'save'}.json`;
    return { blob, filename };
  }

  clearAll() {
    this.saveData.set(null);
    this.fileName.set(null);
    this.lastError.set(null);
    this.itemMetadata.set({});
    this.weaponMetadata.set({});
    this.armorMetadata.set({});
    this.skillMetadata.set({});
    this.variableMetadata.set({});
  }
}
