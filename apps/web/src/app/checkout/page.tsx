'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import { CreditCard, Truck, Lock, ArrowLeft } from 'lucide-react';
import { api, getApiError } from '@/lib/api';
import { formatPrice, toNumber } from '@/lib/utils';
import { useCartStore } from '@/store/cart.store';
import { useAuthStore } from '@/store/auth.store';
import { saveLastOrder } from '@/lib/last-order';
import { Button } from '@/components/ui/button';
import { blurReveal, fadeUp } from '@/lib/motion/variants';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200';

export default function CheckoutPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const { items, subtotal, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    street: '',
    city: '',
    state: '',
    country: 'United States',
    zipCode: '',
    phone: '',
    paymentMethod: 'cod',
  });

  const shipping = subtotal > 100 ? 0 : 9.99;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login?redirect=/checkout');
      return;
    }
    if (items.length === 0) {
      router.replace('/cart');
    }
  }, [isAuthenticated, items.length, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/orders', {
        shippingAddress: {
          street: form.street,
          city: form.city,
          state: form.state,
          country: form.country,
          zipCode: form.zipCode,
          phone: form.phone,
        },
        paymentMethod: form.paymentMethod,
      });

      const order = res.data.data;
      saveLastOrder({
        orderNumber: order.orderNumber,
        total: toNumber(order.total),
        subtotal: toNumber(order.subtotal),
        shipping: toNumber(order.shipping),
        tax: toNumber(order.tax),
        placedAt: new Date().toISOString(),
        items: (order.items ?? []).map((item: { name: string; quantity: number; price: unknown; image?: string }) => ({
          name: item.name,
          quantity: item.quantity,
          price: toNumber(item.price),
          image: item.image,
        })),
      });

      clearCart();
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      router.push('/order-success');
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated || items.length === 0) {
    return (
      <div className="min-h-screen pt-28 flex items-center justify-center">
        <div className="glass-card p-8 animate-pulse w-full max-w-md h-64" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 pb-16 px-4 md:px-8">
      <motion.div
        variants={blurReveal}
        initial="hidden"
        animate="visible"
        className="mx-auto max-w-5xl"
      >
        <Link
          href="/cart"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to cart
        </Link>

        <h1 className="font-display text-4xl font-bold mb-2">Checkout</h1>
        <p className="text-muted-foreground mb-10 flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" /> Secure checkout · {items.length} item(s)
        </p>

        <form onSubmit={handlePlaceOrder} className="grid lg:grid-cols-5 gap-10">
          <motion.div variants={fadeUp} className="lg:col-span-3 space-y-6">
            <div className="glass-card p-6 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" /> Shipping address
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <input
                  name="street"
                  placeholder="Street address"
                  required
                  value={form.street}
                  onChange={handleChange}
                  className="sm:col-span-2 w-full glass rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  name="city"
                  placeholder="City"
                  required
                  value={form.city}
                  onChange={handleChange}
                  className="w-full glass rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  name="state"
                  placeholder="State"
                  required
                  value={form.state}
                  onChange={handleChange}
                  className="w-full glass rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  name="zipCode"
                  placeholder="ZIP code"
                  required
                  value={form.zipCode}
                  onChange={handleChange}
                  className="w-full glass rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  name="country"
                  placeholder="Country"
                  required
                  value={form.country}
                  onChange={handleChange}
                  className="w-full glass rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  name="phone"
                  placeholder="Phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full glass rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="glass-card p-6 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" /> Payment
              </h2>
              <select
                name="paymentMethod"
                value={form.paymentMethod}
                onChange={handleChange}
                aria-label="Payment method"
                className="w-full glass rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-primary bg-transparent"
              >
                <option value="cod">Cash on Delivery</option>
                <option value="stripe">Card (Stripe)</option>
                <option value="razorpay">Razorpay</option>
              </select>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="lg:col-span-2">
            <div className="glass-card p-6 sticky top-28 space-y-4">
              <h2 className="font-semibold">Order summary</h2>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.product._id} className="flex gap-3">
                    <div className="relative h-14 w-14 rounded-lg overflow-hidden flex-shrink-0">
                      <Image
                        src={item.product.images[0]?.url || PLACEHOLDER}
                        alt={item.product.name}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">× {item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold">
                      {formatPrice(toNumber(item.price) * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/10 pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{shipping === 0 ? 'Free' : formatPrice(shipping)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatPrice(tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(total)}</span>
                </div>
              </div>
              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3">{error}</p>
              )}
              <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                {loading ? 'Placing order...' : 'Place Order'}
              </Button>
            </div>
          </motion.div>
        </form>
      </motion.div>
    </div>
  );
}
