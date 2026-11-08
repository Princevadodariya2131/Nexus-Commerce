import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DemoProduct } from '@/lib/demo-products';

export interface CartItem {
  product: {
    _id: string;
    id?: number;
    name: string;
    slug: string;
    price: number;
    images: { url: string; isPrimary?: boolean }[];
  };
  quantity: number;
  price: number;
  variant?: string;
}

interface CartState {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  setCart: (items: CartItem[]) => void;
  addLocalItem: (product: DemoProduct, quantity?: number, variant?: string) => void;
  clearCart: () => void;
}

const calcTotals = (items: CartItem[]) => ({
  itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
  subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
});

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      itemCount: 0,
      subtotal: 0,
      setCart: (items) => set({ items, ...calcTotals(items) }),
      addLocalItem: (product, quantity = 1, variant) => {
        const items = [...get().items];
        const idx = items.findIndex(
          (i) =>
            (i.product.id === product.id || i.product._id === product._id) &&
            (i.variant ?? '') === (variant ?? '')
        );
        if (idx >= 0) {
          items[idx] = { ...items[idx], quantity: items[idx].quantity + quantity };
        } else {
          items.push({
            product: {
              _id: product._id,
              id: product.id,
              name: product.name,
              slug: product.slug,
              price: product.price,
              images: product.images,
            },
            quantity,
            price: product.price,
            variant,
          });
        }
        set({ items, ...calcTotals(items) });
      },
      clearCart: () => set({ items: [], itemCount: 0, subtotal: 0 }),
    }),
    {
      name: 'nexus-cart',
      partialize: (s) => ({ items: s.items }),
      onRehydrateStorage: () => (state) => {
        if (state?.items?.length) {
          const totals = calcTotals(state.items);
          state.itemCount = totals.itemCount;
          state.subtotal = totals.subtotal;
        }
      },
    }
  )
);
