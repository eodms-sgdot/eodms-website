import type { NaplOrderSelection } from '../services/NaplOrderService';

export interface NaplCartEntry {
  id: string;
  itemId: string;
  label: string;
  quantity: number;
  options: NaplOrderSelection;
}

const STORAGE_KEY = 'napl-order-cart-v1';

export function loadNaplCart(): NaplCartEntry[] {
  try {
    const entries: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(entries)) return [];
    const ids = new Set<string>();
    return entries.filter((entry): entry is NaplCartEntry => {
      if (!entry || typeof entry !== 'object'
        || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id)
        || typeof entry.itemId !== 'string' || !entry.itemId || typeof entry.label !== 'string'
        || !entry.options || typeof entry.options.media_type !== 'string'
        || (entry.options.file_format !== undefined && typeof entry.options.file_format !== 'string')
        || (entry.options.flight_line_index_map !== undefined
          && entry.options.flight_line_index_map !== 'PDF' && entry.options.flight_line_index_map !== 'Paper')
        || (entry.quantity !== undefined && (!Number.isInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 2147483647))
        || (entry.options.image_resolution !== undefined && !Number.isFinite(entry.options.image_resolution))) return false;
      ids.add(entry.id);
      return true;
    }).slice(0, 100).map(entry => ({ ...entry, quantity: entry.quantity ?? 1 }));
  } catch {
    return [];
  }
}

export function saveNaplCart(entries: NaplCartEntry[]): void {
  if (entries.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  else localStorage.removeItem(STORAGE_KEY);
}