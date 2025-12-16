import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal, type Signal, type WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SaveFileService } from '../../../services/save-file.service';

export interface InventoryRow {
  id: number;
  quantity: number;
  name?: string;
}

type InventoryKind = 'items' | 'weapons' | 'armors';

@Component({
  selector: 'app-inventory-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory-table.component.html',
  styleUrl: './inventory-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryTableComponent {
  private readonly saveService = inject(SaveFileService);

  readonly title = input.required<string>();
  readonly data = input.required<Signal<InventoryRow[]>>();
  readonly search = input<WritableSignal<string> | null>(null);
  readonly kind = input<InventoryKind>('items');
  readonly isOpen = signal<boolean>(false);

  readonly newId = signal<number | null>(null);
  readonly newQuantity = signal<number>(1);
  readonly internalSearch = signal<string>('');

  readonly searchTerm = computed(() => this.search()?.() ?? this.internalSearch());

  readonly filteredRows = computed<InventoryRow[]>(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const list = this.data()();
    if (!term) return list;
    return list.filter(entry => {
      const nameMatch = entry.name?.toLowerCase().includes(term);
      const idMatch = entry.id.toString().includes(term);
      return Boolean(nameMatch || idMatch);
    });
  });

  addItem() {
    const idRaw = this.newId();
    const id = idRaw == null ? NaN : Number(idRaw);
    const qty = Number(this.newQuantity());
    if (id <= 0 || Number.isNaN(id)) return;
    this.updateQuantity(id, qty);
    this.newQuantity.set(1);
  }

  updateQuantity(id: number, value: number | string) {
    const qty = Math.max(0, Math.round(Number(value)));
    const type = this.kind();
    if (type === 'items') this.saveService.updateItem(id, qty);
    if (type === 'weapons') this.saveService.updateWeapon(id, qty);
    if (type === 'armors') this.saveService.updateArmor(id, qty);
  }

  updateSearch(term: string) {
    const target = this.search();
    if (target) {
      target.set((term || '').toString());
    } else {
      this.internalSearch.set((term || '').toString());
    }
  }

  protected toNumber(value: unknown): number {
    return Number(value);
  }
}
