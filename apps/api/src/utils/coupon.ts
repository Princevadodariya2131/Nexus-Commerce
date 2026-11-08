/** Pure money rules for coupons, kept free of I/O so they can be unit-tested. */

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface DiscountRule {
  type: string;
  value: unknown;
  maxDiscount?: unknown;
}

/**
 * Discount for a subtotal. Never negative and never larger than the subtotal, so a coupon can not
 * turn an order total negative (a fixed $500 coupon on a $25 cart discounts $25, not $500).
 */
export function calculateDiscount(subtotal: number, rule: DiscountRule): number {
  const value = Number(rule.value);
  if (!Number.isFinite(value) || value <= 0 || !(subtotal > 0)) return 0;

  let discount: number;
  if (rule.type === 'percentage') {
    discount = (subtotal * Math.min(value, 100)) / 100;
    if (rule.maxDiscount !== null && rule.maxDiscount !== undefined) {
      const cap = Number(rule.maxDiscount);
      if (Number.isFinite(cap) && cap >= 0) discount = Math.min(discount, cap);
    }
  } else {
    discount = value;
  }
  return round2(Math.min(discount, subtotal));
}

/** True when the customer has already used the coupon the maximum number of times. */
export function isPerUserLimitReached(timesUsed: number, perUserLimit: number | null | undefined): boolean {
  return perUserLimit !== null && perUserLimit !== undefined && perUserLimit > 0 && timesUsed >= perUserLimit;
}
