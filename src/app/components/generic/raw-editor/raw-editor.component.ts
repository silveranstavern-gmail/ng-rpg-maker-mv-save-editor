import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SaveFileService } from '../../../services/save-file.service';

export type JsonKey = string | number;

export interface JsonNode {
  key: string;
  path: JsonKey[];
  value: any;
  isPrimitive: boolean;
  isArray: boolean;
  children: JsonNode[];
}

@Component({
  selector: 'app-raw-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './raw-editor.component.html',
  styleUrl: './raw-editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RawEditorComponent {
  private readonly saveService = inject(SaveFileService);

  readonly save = this.saveService.save;
  readonly showRaw = signal<boolean>(false);
  readonly isOpen = signal<boolean>(false);
  readonly editingPath = signal<string | null>(null);
  readonly editingValue = signal<string>('');

  readonly rawRoot = computed<JsonNode | null>(() => {
    const value = this.save();
    if (!value) return null;
    return this.createNode('(root)', value, [], true);
  });

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

  downloadRawJson() {
    const payload = this.saveService.downloadRawJson();
    if (!payload) return;
    const url = URL.createObjectURL(payload.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = payload.filename;
    link.click();
    URL.revokeObjectURL(url);
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
