'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cart.store';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export default function CartPage() {
  const { isAuthenticated } = useAuthStore();
  const setCart = useCartStore((s) => s.setCart);
  const { items, subtotal, itemCount } = useCartStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: async () => {
      const res = await api.get('/cart');
      return res.data.data;
    },
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (data?.items) setCart(data.items);
  }, [data, setCart]);

  const removeMutation = useMutation({
    mutationFn: (productId: string) => api.delete(`/cart/items/${productId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
  });

  const showLocalCart = !isAuthenticated && items.length > 0;

  if (!isAuthenticated && items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Your cart is empty</p>
          <Link href="/shop"><Button>Continue Shopping</Button></Link>
          <p className="text-sm text-muted-foreground mt-4">
            <Link href="/login" className="text-primary hover:underline">Sign in</Link> to sync cart across devices
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 pb-16 px-4 md:px-8">
      <motion.div className="mx-auto max-w-4xl">
        <h1 className="font-display text-3xl font-bold mb-8">Your Cart ({itemCount})</h1>

        {showLocalCart && (
          <p className="text-sm text-muted-foreground mb-4">
            Guest cart — <Link href="/login" className="text-primary hover:underline">sign in</Link> to save permanently
          </p>
        )}

        {isLoading && isAuthenticated ? (
          <div className="space-y-4">{[1, 2].map((i) => <div key={i} className="glass-card h-24 animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <motion.div className="glass-card p-12 text-center">
            <p className="text-muted-foreground mb-4">Your cart is empty</p>
            <Link href="/shop"><Button>Continue Shopping</Button></Link>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-4">
              {items.map((item) => (
                <div key={item.product._id} className="glass-card p-4 flex gap-4">
                  <div className="relative h-20 w-20 rounded-lg overflow-hidden flex-shrink-0">
                    <Image src={item.product.images[0]?.url || '/placeholder.jpg'} alt={item.product.name} fill className="object-cover" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{item.product.name}</h3>
                    <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                    <p className="font-semibold mt-1">{formatPrice(item.price * item.quantity)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (isAuthenticated) removeMutation.mutate(item.product._id);
                      else useCartStore.getState().setCart(
                        items.filter((i) => i.product._id !== item.product._id)
                      );
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="glass-card p-6 h-fit">
              <h2 className="font-semibold mb-4">Order Summary</h2>
              <div className="flex justify-between mb-2"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
              <motion.div className="flex justify-between mb-2 text-sm text-muted-foreground"><span>Shipping</span><span>{subtotal > 100 ? 'Free' : '$9.99'}</span></motion.div>
              <div className="border-t border-white/10 my-4 pt-4 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatPrice(subtotal + (subtotal > 100 ? 0 : 9.99))}</span>
              </div>
              <Link href="/checkout" className="block mt-4">
                <Button className="w-full">Proceed to Checkout</Button>
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
