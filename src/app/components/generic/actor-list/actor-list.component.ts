import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SaveFileService } from '../../../services/save-file.service';

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
}

@Component({
  selector: 'app-actor-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './actor-list.component.html',
  styleUrl: './actor-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActorListComponent {
  private readonly saveService = inject(SaveFileService);

  readonly isOpen = signal<boolean>(false);

  readonly actors = computed<ActorViewModel[]>(() => {
    return this.saveService.actors().map(actor => {
      const expMap = actor._exp ?? {};
      const currentClassId = actor._classId ?? Number(Object.keys(expMap)[0] ?? 0);
      const exp = currentClassId ? expMap[currentClassId] ?? 0 : 0;
      const paramPlus = actor._paramPlus?.['@a'] ?? new Array(8).fill(0);

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
        paramPlus
      };
    });
  });

  updateActorField(actorId: number, key: keyof ActorViewModel, value: number | string) {
    const numericValue = Number(value);
    if (key === 'exp') {
      const actor = this.actors().find(a => a.id === actorId);
      if (actor) {
        this.saveService.updateActorExp(actorId, actor.classId, numericValue);
      }
      return;
    }
    const patch: Record<string, number> = {};
    if (key === 'level') patch['_level'] = numericValue;
    if (key === 'hp') patch['_hp'] = numericValue;
    if (key === 'mp') patch['_mp'] = numericValue;
    if (key === 'tp') patch['_tp'] = numericValue;
    this.saveService.updateActor(actorId, patch);
  }

  updateActorParam(actorId: number, index: number, value: number | string) {
    this.saveService.updateActorParam(actorId, index, Number(value));
  }
}
