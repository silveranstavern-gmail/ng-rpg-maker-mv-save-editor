import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActorListComponent } from '../../components/generic/actor-list/actor-list.component';
import { EconomyPanelComponent } from '../../components/generic/economy-panel/economy-panel.component';
import { FileLoaderComponent } from '../../components/generic/file-loader/file-loader.component';
import { InventoryRow, InventoryTableComponent } from '../../components/generic/inventory-table/inventory-table.component';
import { RawEditorComponent } from '../../components/generic/raw-editor/raw-editor.component';
import { VariablePanelComponent } from '../../components/generic/variable-panel/variable-panel.component';
import { MasteryPanelComponent } from '../../components/games/wormskull/mastery-panel/mastery-panel.component';
import { GameId, GAMES } from '../../config/game-registry';
import { SaveFileService } from '../../services/save-file.service';

@Component({
  selector: 'app-save-editor',
  standalone: true,
  imports: [
    FileLoaderComponent,
    EconomyPanelComponent,
    VariablePanelComponent,
    ActorListComponent,
    InventoryTableComponent,
    RawEditorComponent,
    MasteryPanelComponent
  ],
  templateUrl: './save-editor.component.html',
  styleUrl: './save-editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SaveEditorComponent {
  private readonly saveService = inject(SaveFileService);

  readonly save = this.saveService.save;
  readonly games = GAMES;
  readonly selectedGame = signal<GameId>('generic');

  readonly itemSearch = signal<string>('');
  readonly weaponSearch = signal<string>('');
  readonly armorSearch = signal<string>('');

  readonly items = computed<InventoryRow[]>(() => {
    const meta = this.saveService.metadata();
    return this.saveService.items().map(item => ({
      ...item,
      name: meta[item.id]
    }));
  });

  readonly weapons = computed<InventoryRow[]>(() => {
    const meta = this.saveService.weaponNames();
    return this.saveService.weapons().map(w => ({ ...w, name: meta[w.id] }));
  });

  readonly armors = computed<InventoryRow[]>(() => {
    const meta = this.saveService.armorNames();
    return this.saveService.armors().map(a => ({ ...a, name: meta[a.id] }));
  });

  onGameChange(event: Event) {
    const target = event.target as HTMLSelectElement | null;
    const value = target?.value as GameId | undefined;
    if (value) {
      this.selectedGame.set(value);
    }
  }

  onSampleDataLoaded() {
    this.selectedGame.set('wormskull');
  }
}
