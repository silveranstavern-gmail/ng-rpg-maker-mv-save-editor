import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SaveFileService } from '../../../services/save-file.service';

@Component({
  selector: 'app-economy-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './economy-panel.component.html',
  styleUrl: './economy-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EconomyPanelComponent {
  private readonly saveService = inject(SaveFileService);

  readonly gold = this.saveService.partyGold;
  readonly steps = this.saveService.steps;
  readonly isOpen = signal<boolean>(true);

  updateGold(value: number | string) {
    this.saveService.updateGold(Number(value));
  }
}
