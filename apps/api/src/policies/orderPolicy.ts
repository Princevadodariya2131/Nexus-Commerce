/**
 * Pure authorization rules for order status changes.
 * Kept free of I/O so the rules can be unit-tested without a database.
 */
export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

/**
 * Statuses a vendor may set. 'refunded' is excluded because it has financial
 * consequences and stays an administrator decision.
 */
export const VENDOR_SETTABLE_STATUSES: readonly OrderStatusValue[] = [
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

export type VendorOrderDecision =
  /** every item in the order belongs to this vendor */
  | 'allowed'
  /** the order has no items from this vendor (treated as "not found" to avoid leaking existence) */
  | 'not_found'
  /** the order mixes this vendor's items with other vendors' items; admin only */
  | 'mixed_order';

/**
 * An order has a single status shared by all of its items, so a vendor may only
 * change it when the whole order belongs to that vendor.
 */
export function decideVendorOrderAccess(
  vendorId: number,
  items: ReadonlyArray<{ vendorId: number | null }>
): VendorOrderDecision {
  const mine = items.filter((item) => item.vendorId === vendorId).length;
  if (mine === 0) return 'not_found';
  return mine === items.length ? 'allowed' : 'mixed_order';
}

/** Statuses from which a cancellation puts the goods back on the shelf (nothing has shipped yet). */
const RESTOCK_FROM: readonly OrderStatusValue[] = ['pending', 'confirmed', 'processing'];

export function shouldRestockOnTransition(previous: string, next: string): boolean {
  return next === 'cancelled' && (RESTOCK_FROM as readonly string[]).includes(previous);
}

/**
 * A cancelled or refunded order must not be resurrected (a vendor could otherwise "ship" an order whose
 * stock was already released). The only allowed move out of a terminal state is cancelled -> refunded,
 * by an administrator, to record a refund of an already-paid cancelled order.
 */
export function isTransitionAllowed(previous: string, next: string, isAdmin: boolean): boolean {
  if (previous === next) return true;
  if (previous === 'refunded') return false;
  if (previous === 'cancelled') return isAdmin && next === 'refunded';
  return true;
}
