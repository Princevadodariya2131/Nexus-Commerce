export interface LastOrderSnapshot {
  orderNumber: string;
  total: number;
  subtotal: number;
  shipping: number;
  tax: number;
  items: { name: string; quantity: number; price: number; image?: string | null }[];
  placedAt: string;
}

const KEY = 'nexus_last_order';

export function saveLastOrder(order: LastOrderSnapshot) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify(order));
}

export function getLastOrder(): LastOrderSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LastOrderSnapshot) : null;
  } catch {
    return null;
  }
}

export function clearLastOrder() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(KEY);
}
