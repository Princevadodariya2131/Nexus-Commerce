'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Package,
  Truck,
  Mail,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils';
import { getLastOrder, type LastOrderSnapshot } from '@/lib/last-order';
import { SuccessConfetti } from '@/components/order/SuccessConfetti';
import { blurReveal, fadeUp, staggerContainer } from '@/lib/motion/variants';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200';

const steps = [
  { icon: CheckCircle2, label: 'Order confirmed', done: true },
  { icon: Package, label: 'Processing', done: false },
  { icon: Truck, label: 'On the way', done: false },
  { icon: Mail, label: 'Delivered', done: false },
];

export default function OrderSuccessPage() {
  const [order, setOrder] = useState<LastOrderSnapshot | null>(null);

  useEffect(() => {
    setOrder(getLastOrder());
  }, []);

  return (
    <div className="min-h-screen pt-28 pb-20 px-4 md:px-8 relative overflow-hidden">
      <SuccessConfetti />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-primary/20 blur-[120px]" />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="mx-auto max-w-3xl relative z-10"
      >
        {/* Hero */}
        <motion.div variants={blurReveal} className="text-center mb-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
            className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/40"
          >
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <p className="text-sm text-primary font-medium mb-2 flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4" /> Thank you for your purchase
            </p>
            <h1 className="font-display text-4xl font-bold md:text-5xl mb-3">
              Order Placed Successfully!
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              We&apos;ve received your order and will send you a confirmation email shortly.
            </p>
            {order?.orderNumber && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-4 inline-block glass rounded-full px-5 py-2 text-sm font-mono"
              >
                Order <span className="text-primary font-semibold">#{order.orderNumber}</span>
              </motion.p>
            )}
          </motion.div>
        </motion.div>

        {/* Timeline */}
        <motion.div variants={fadeUp} className="glass-card p-6 mb-8">
          <h2 className="font-semibold mb-6 text-center">What happens next</h2>
          <div className="flex justify-between gap-2 relative">
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-white/10" />
            <motion.div
              className="absolute top-5 left-0 h-0.5 bg-primary"
              initial={{ width: 0 }}
              animate={{ width: '25%' }}
              transition={{ delay: 0.6, duration: 0.8 }}
            />
            {steps.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="flex flex-col items-center gap-2 relative z-10 flex-1"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                    step.done
                      ? 'bg-primary border-primary text-white'
                      : 'bg-background border-white/20 text-muted-foreground'
                  }`}
                >
                  <step.icon className="h-4 w-4" />
                </div>
                <span className="text-[10px] sm:text-xs text-center text-muted-foreground leading-tight">
                  {step.label}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Order items */}
        {order && order.items.length > 0 && (
          <motion.div variants={fadeUp} className="glass-card p-6 mb-8 space-y-4">
            <h2 className="font-semibold">Your items</h2>
            {order.items.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.08 }}
                className="flex gap-4 items-center"
              >
                <div className="relative h-16 w-16 rounded-xl overflow-hidden flex-shrink-0">
                  <Image
                    src={item.image || PLACEHOLDER}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                </div>
                <p className="font-semibold">{formatPrice(item.price * item.quantity)}</p>
              </motion.div>
            ))}
            <div className="border-t border-white/10 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>{order.shipping === 0 ? 'Free' : formatPrice(order.shipping)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span>
                <span>{formatPrice(order.tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2">
                <span>Total paid</span>
                <span className="text-primary">{formatPrice(order.total)}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* CTAs */}
        <motion.div
          variants={fadeUp}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Link href="/shop">
            <Button variant="secondary" className="w-full sm:w-auto gap-2">
              Continue Shopping <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/account">
            <Button className="w-full sm:w-auto">View My Orders</Button>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
