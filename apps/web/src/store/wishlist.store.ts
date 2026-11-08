import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DemoProduct } from '@/lib/demo-products';

interface WishlistState {
  items: DemoProduct[];
  add: (product: DemoProduct) => void;
  remove: (productId: number) => void;
  toggle: (product: DemoProduct) => void;
  has: (productId: number) => boolean;
  setItems: (items: DemoProduct[]) => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (product) =>
        set((s) =>
          s.items.some((i) => i.id === product.id) ? s : { items: [...s.items, product] }
        ),
      remove: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== productId) })),
      toggle: (product) => {
        if (get().has(product.id)) get().remove(product.id);
        else get().add(product);
      },
      has: (productId) => get().items.some((i) => i.id === productId),
      setItems: (items) => set({ items }),
    }),
    { name: 'nexus-wishlist' }
  )
);
