import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useCartStore } from '@/store/cart.store';

export async function logoutUser() {
  try {
    await api.post('/auth/logout');
  } catch {
    /* clear client state even if API fails */
  }
  useAuthStore.getState().logout();
  useCartStore.getState().clearCart();
}
