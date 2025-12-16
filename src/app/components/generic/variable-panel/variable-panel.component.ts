import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SaveFileService } from '../../../services/save-file.service';

interface VariableRow {
  id: number;
  value: number;
  name?: string;
}

@Component({
  selector: 'app-variable-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './variable-panel.component.html',
  styleUrl: './variable-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VariablePanelComponent {
  private readonly saveService = inject(SaveFileService);

  readonly isOpen = signal<boolean>(false);

  readonly variables = computed<VariableRow[]>(() => {
    const meta = this.saveService.variableNames();
    return this.saveService.variables().map(v => ({ id: v.id, value: v.quantity, name: meta[v.id] }));
  });

  updateVariable(id: number, value: number | string) {
    this.saveService.updateVariable(id, Number(value));
  }
}
