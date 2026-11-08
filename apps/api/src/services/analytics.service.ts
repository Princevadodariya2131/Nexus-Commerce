import { prisma } from '../lib/prisma';
import { serialize } from '../utils/serialize';

export const analyticsService = {
  async getDashboardStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      paidOrders,
      monthlyPaid,
      lastMonthPaid,
      totalOrders,
      monthlyOrders,
      totalUsers,
      monthlyUsers,
      pendingOrders,
      lowStockProducts,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { paymentStatus: 'paid' },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { paymentStatus: 'paid', createdAt: { gte: startOfMonth } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: {
          paymentStatus: 'paid',
          createdAt: { gte: startOfLastMonth, lt: startOfMonth },
        },
        _sum: { total: true },
      }),
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.user.count({ where: { role: 'customer' } }),
      prisma.user.count({ where: { role: 'customer', createdAt: { gte: startOfMonth } } }),
      prisma.order.count({ where: { status: 'pending' } }),
      prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM products WHERE stock <= low_stock_threshold AND is_active = 1`,
    ]);

    const currentRevenue = Number(monthlyPaid._sum.total || 0);
    const previousRevenue = Number(lastMonthPaid._sum.total || 0);
    const revenueGrowth =
      previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    const topProductsRaw = await prisma.$queryRaw<
      { name: string; revenue: number; totalSold: number }[]
    >`
      SELECT oi.name, SUM(oi.price * oi.quantity) as revenue, SUM(oi.quantity) as totalSold
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      WHERE o.payment_status = 'paid'
      GROUP BY oi.product_id, oi.name
      ORDER BY revenue DESC
      LIMIT 5
    `;

    return serialize({
      revenue: {
        total: Number(paidOrders._sum.total || 0),
        monthly: currentRevenue,
        growth: Math.round(revenueGrowth * 100) / 100,
      },
      orders: {
        total: totalOrders,
        monthly: monthlyOrders,
        pending: pendingOrders,
      },
      users: { total: totalUsers, monthly: monthlyUsers },
      inventory: { lowStock: Number(lowStockProducts[0]?.count || 0) },
      topProducts: topProductsRaw,
    });
  },

  async getRevenueChart(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const rows = await prisma.$queryRaw<{ date: string; revenue: number; orders: number }[]>`
      SELECT DATE(created_at) as date, SUM(total) as revenue, COUNT(*) as orders
      FROM orders
      WHERE payment_status = 'paid' AND created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    return serialize(rows);
  },
};
