'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  ShoppingBag,
  Heart,
  Package,
  LogOut,
  Settings,
  Mail,
  Shield,
  Sparkles,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatPrice, formatDate, toNumber } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useCartStore } from '@/store/cart.store';
import { useWishlistStore } from '@/store/wishlist.store';
import { logoutUser } from '@/lib/auth-actions';
import { Button } from '@/components/ui/button';
import { blurReveal, fadeUp, staggerContainer } from '@/lib/motion/variants';

interface Order {
  id: number;
  orderNumber: string;
  total: number;
  status: string;
  createdAt: string;
  items?: { name: string; quantity: number }[];
}

const tabs = [
  { id: 'overview', label: 'Overview', icon: Sparkles },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user } = useAuthStore();
  const itemCount = useCartStore((s) => s.itemCount);
  const wishlistCount = useWishlistStore((s) => s.items.length);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login?redirect=/account');
  }, [isAuthenticated, router]);

  useEffect(() => {
    const tab = searchParams.get('tab') as TabId | null;
    if (tab && tabs.some((t) => t.id === tab)) setActiveTab(tab);
  }, [searchParams]);

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn: async () => {
      const res = await api.get('/orders/my', { params: { limit: 10 } });
      return res.data.data as Order[];
    },
    enabled: isAuthenticated,
  });

  const handleLogout = async () => {
    setLoggingOut(true);
    await logoutUser();
    router.push('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen pt-28 px-4">
        <div className="mx-auto max-w-4xl h-96 glass-card animate-pulse rounded-2xl" />
      </div>
    );
  }

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
  const memberSince = new Date().getFullYear();

  return (
    <div className="min-h-screen pt-28 pb-20 px-4 md:px-8">
      <div className="pointer-events-none absolute top-32 right-0 h-72 w-72 rounded-full bg-primary/15 blur-[100px]" />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="mx-auto max-w-5xl relative z-10"
      >
        {/* Profile hero */}
        <motion.div variants={blurReveal} className="glass-card p-8 md:p-10 mb-8 gradient-border overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
          <div className="relative flex flex-col md:flex-row md:items-center gap-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/25 text-3xl font-bold text-primary border border-primary/30 shadow-lg shadow-primary/20"
            >
              {initials}
            </motion.div>
            <div className="flex-1">
              <p className="text-sm text-primary font-medium mb-1">Welcome back</p>
              <h1 className="font-display text-3xl md:text-4xl font-bold">
                {user.firstName} {user.lastName}
              </h1>
              <p className="text-muted-foreground mt-1 flex items-center gap-2">
                <Mail className="h-4 w-4" /> {user.email}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs glass rounded-full px-3 py-1 capitalize flex items-center gap-1">
                  <Shield className="h-3 w-3" /> {user.role.replace('_', ' ')}
                </span>
                <span className="text-xs glass rounded-full px-3 py-1 text-muted-foreground">
                  Member since {memberSince}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              className="gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? 'Signing out...' : 'Log out'}
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Cart items', value: itemCount, icon: ShoppingBag, href: '/cart', color: 'text-blue-400' },
            { label: 'Wishlist', value: wishlistCount, icon: Heart, href: '/wishlist', color: 'text-pink-400' },
            { label: 'Orders', value: orders?.length ?? 0, icon: Package, href: '#orders', color: 'text-emerald-400' },
            { label: 'Account', value: 'Active', icon: User, href: '/account', color: 'text-primary' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
            >
              <Link
                href={stat.href}
                onClick={stat.href === '#orders' ? (e) => { e.preventDefault(); setActiveTab('orders'); } : undefined}
                className="glass-card p-5 block hover:bg-white/5 transition-all group"
              >
                <stat.icon className={`h-5 w-5 mb-3 ${stat.color}`} />
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  {stat.label}
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* Tabs */}
        <motion.div variants={fadeUp} className="flex gap-1 glass rounded-2xl p-1 w-fit mb-8 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="grid md:grid-cols-2 gap-6"
            >
              <div className="glass-card p-6 space-y-4">
                <h2 className="font-semibold text-lg">Quick actions</h2>
                {[
                  { href: '/shop', label: 'Browse products', desc: 'Discover new arrivals', icon: Sparkles },
                  { href: '/cart', label: 'View cart', desc: `${itemCount} items waiting`, icon: ShoppingBag },
                  { href: '/wishlist', label: 'My wishlist', desc: `${wishlistCount} saved items`, icon: Heart },
                ].map((action, i) => (
                  <motion.div
                    key={action.href}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Link
                      href={action.href}
                      className="flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors group"
                    >
                      <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
                        <action.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{action.label}</p>
                        <p className="text-sm text-muted-foreground">{action.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </motion.div>
                ))}
              </div>
              <div className="glass-card p-6">
                <h2 className="font-semibold text-lg mb-4">Recent activity</h2>
                {orders && orders.length > 0 ? (
                  <div className="space-y-3">
                    {orders.slice(0, 3).map((order) => (
                      <div key={order.id} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                        <div>
                          <p className="font-mono text-sm text-primary">#{order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(order.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatPrice(toNumber(order.total))}</p>
                          <p className="text-xs capitalize text-muted-foreground">{order.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No orders yet. Start shopping!</p>
                )}
                <Link href="/shop" className="inline-block mt-4">
                  <Button size="sm">Shop now</Button>
                </Link>
              </div>
            </motion.div>
          )}

          {activeTab === 'orders' && (
            <motion.div
              key="orders"
              id="orders"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              {ordersLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="glass-card h-24 animate-pulse" />
                ))
              ) : orders && orders.length > 0 ? (
                orders.map((order, i) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="glass-card p-6 flex flex-wrap justify-between gap-4 items-center"
                  >
                    <div>
                      <p className="font-mono font-semibold text-primary">#{order.orderNumber}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDate(order.createdAt)} · {order.items?.length ?? 0} item(s)
                      </p>
                      <span className="inline-block mt-2 text-xs glass rounded-full px-3 py-1 capitalize">
                        {order.status}
                      </span>
                    </div>
                    <p className="font-display text-2xl font-bold">{formatPrice(toNumber(order.total))}</p>
                  </motion.div>
                ))
              ) : (
                <div className="glass-card p-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">You haven&apos;t placed any orders yet</p>
                  <Link href="/shop"><Button>Start Shopping</Button></Link>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="glass-card p-8 max-w-xl space-y-6"
            >
              <h2 className="font-semibold text-lg">Account settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">First name</label>
                  <p className="font-medium mt-1">{user.firstName}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Last name</label>
                  <p className="font-medium mt-1">{user.lastName}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Email</label>
                  <p className="font-medium mt-1">{user.email}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Profile editing will be available in a future update.
              </p>
              <Button
                variant="destructive"
                className="gap-2"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                <LogOut className="h-4 w-4" />
                {loggingOut ? 'Signing out...' : 'Log out of account'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
