import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SaveFileService } from '../../../../services/save-file.service';

interface ActorMasteryRow {
  skillId: number;
  name: string;
  level: number;
  uses: number;
  max: number;
}

interface ActorMasteryViewModel {
  id: number;
  actorIndex: number;
  name: string;
  mastery: ActorMasteryRow[];
}

@Component({
  selector: 'app-wormskull-mastery-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mastery-panel.component.html',
  styleUrl: './mastery-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MasteryPanelComponent {
  private readonly saveService = inject(SaveFileService);

  readonly masteryModalActorId = signal<number | null>(null);
  readonly masteryAllLevel = signal<number | null>(null);
  readonly masteryAllUses = signal<number | null>(null);
  readonly masteryAllThreshold = signal<number | null>(null);
  readonly masteryGlobalLevel = signal<number | null>(null);
  readonly masteryGlobalUses = signal<number | null>(null);
  readonly masteryGlobalThreshold = signal<number | null>(null);
  readonly masteryGlobalDefaultsVersion = signal<number>(0);

  readonly actors = computed<ActorMasteryViewModel[]>(() => {
    const skillMeta = this.saveService.skillNames();
    const raw = this.saveService.save()?.actors?._data?.['@a'] ?? [];

    return raw
      .map((actor, index) => {
        if (!actor) return null;
        const levels = actor._skillMasteryLevels ?? {};
        const uses = actor._skillMasteryUses ?? {};
        const maxes = actor._skillMasteryUsageMax ?? {};
        const masteryIds = new Set(
          [...Object.keys(levels), ...Object.keys(uses), ...Object.keys(maxes)]
            .map(Number)
            .filter(id => Number.isFinite(id) && id > 0)
        );

        const mastery: ActorMasteryRow[] = Array.from(masteryIds)
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
          actorIndex: index,
          name: actor._name,
          mastery
        };
      })
      .filter((a): a is ActorMasteryViewModel => Boolean(a));
  });

  readonly globalMasteryDefaults = computed(() => {
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

  updateMastery(actorId: number, skillId: number, type: 'level' | 'uses' | 'max', value: number | string) {
    const actorIndex = this.findActorIndex(actorId);
    if (actorIndex === -1) return;
    const numeric = Math.max(0, Math.round(Number(value)));
    const fieldMap = {
      level: '_skillMasteryLevels',
      uses: '_skillMasteryUses',
      max: '_skillMasteryUsageMax'
    } as const;
    const path = ['actors', '_data', '@a', actorIndex, fieldMap[type], skillId];
    this.saveService.updateByPath(path, numeric);
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

  modalActor(): ActorMasteryViewModel | null {
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

  toNumber(value: unknown): number {
    return Number(value);
  }

  private findActorIndex(actorId: number): number {
    const list = this.saveService.save()?.actors?._data?.['@a'] ?? [];
    return list.findIndex(a => a?._actorId === actorId);
  }
}
