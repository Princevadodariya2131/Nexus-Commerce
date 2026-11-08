'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Package, ShoppingCart, DollarSign, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function VendorDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['vendor-dashboard'],
    queryFn: async () => {
      const res = await api.get('/vendor/dashboard');
      return res.data.data;
    },
    retry: false,
  });

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20 px-4">
        <div className="glass-card p-8 max-w-md text-center">
          <h1 className="font-display text-2xl font-bold mb-4">Become a Vendor</h1>
          <p className="text-muted-foreground mb-6">Set up your vendor profile to start selling on Nexus Commerce.</p>
          <Link href="/vendor/onboard">
            <Button>Start Onboarding</Button>
          </Link>
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const vendor = data?.vendor;

  return (
    <div className="min-h-screen pt-28 pb-16 px-4 md:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold">{vendor?.businessName || 'Vendor Dashboard'}</h1>
          <p className="text-muted-foreground mt-1">Status: <span className="capitalize text-primary">{vendor?.status}</span></p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
          {[
            { label: 'Products', value: stats?.products, icon: Package },
            { label: 'Orders', value: stats?.orders, icon: ShoppingCart },
            { label: 'Revenue', value: formatPrice(stats?.revenue || 0), icon: DollarSign },
            { label: 'Rating', value: `${vendor?.rating || 0} ★`, icon: Star },
          ].map((s) => (
            <div key={s.label} className="glass-card p-6">
              <s.icon className="h-5 w-5 text-primary mb-3" />
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold">{isLoading ? '...' : s.value}</p>
            </div>
          ))}
        </div>

        <motion.div className="mt-8 flex gap-4">
          <Link href="/vendor/products"><Button>Manage Products</Button></Link>
          <Link href="/vendor/orders"><Button variant="outline">View Orders</Button></Link>
        </motion.div>
      </div>
    </div>
  );
}
