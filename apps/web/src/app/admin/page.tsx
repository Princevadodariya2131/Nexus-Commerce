'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { DollarSign, ShoppingCart, Users, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { fadeUp, staggerContainer } from '@/lib/motion/variants';

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const res = await api.get('/admin/dashboard');
      return res.data.data;
    },
  });

  const cards = [
    { label: 'Total Revenue', value: formatPrice(stats?.revenue?.total || 0), icon: DollarSign, change: `${stats?.revenue?.growth || 0}%` },
    { label: 'Monthly Revenue', value: formatPrice(stats?.revenue?.monthly || 0), icon: DollarSign },
    { label: 'Total Orders', value: stats?.orders?.total?.toLocaleString() || '0', icon: ShoppingCart },
    { label: 'Total Users', value: stats?.users?.total?.toLocaleString() || '0', icon: Users },
    { label: 'Pending Orders', value: stats?.orders?.pending || 0, icon: AlertTriangle },
    { label: 'Low Stock Items', value: stats?.inventory?.lowStock || 0, icon: AlertTriangle },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl font-bold mb-8">Dashboard</h1>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8"
      >
        {cards.map((card) => (
          <motion.div key={card.label} variants={fadeUp} className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <card.icon className="h-5 w-5 text-primary" />
              {card.change && <span className="text-xs text-green-400">+{card.change}</span>}
            </div>
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="text-2xl font-bold mt-1">{isLoading ? '...' : card.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {stats?.topProducts?.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="font-semibold mb-4">Top Products</h2>
          <div className="space-y-3">
            {stats.topProducts.map((p: { name: string; revenue: number; totalSold: number }, i: number) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                <span>{p.name}</span>
                <span className="text-muted-foreground">{formatPrice(p.revenue)} · {p.totalSold} sold</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
