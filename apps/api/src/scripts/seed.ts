import { config } from '../config'; // loads .env before Prisma connects
import { prisma } from '../lib/prisma';
import { hashPassword } from '../utils/password';
import { ROLES } from '@nexus/shared';

const LOCAL_DB_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]', 'mysql'];

const seed = async () => {
  // ---------------------------------------------------------------------------
  // Safety guards. This script DELETES ALL DATA in every table before seeding.
  // Locally (XAMPP / docker-compose) it behaves exactly as before. Against any
  // non-local database, or in production, it refuses to run unless explicitly
  // allowed, and it will not fall back to publicly known default passwords.
  // ---------------------------------------------------------------------------
  let dbHost = '';
  try {
    dbHost = new URL(config.db.url).hostname;
  } catch {
    /* unparseable URL: treated as non-local below */
  }
  const isRemote = config.isProd || !LOCAL_DB_HOSTS.includes(dbHost);

  if (isRemote && process.env.ALLOW_DESTRUCTIVE_SEED !== 'true') {
    console.error(
      'Refusing to seed: this script deletes ALL data and the target database is not local ' +
        `(host "${dbHost || 'unknown'}", NODE_ENV=${config.env}). ` +
        'Set ALLOW_DESTRUCTIVE_SEED=true only if you really intend to wipe and re-seed this database.'
    );
    process.exit(1);
  }

  const adminPlain = process.env.SEED_ADMIN_PASSWORD || (isRemote ? '' : 'Admin@123456');
  const customerPlain = process.env.SEED_CUSTOMER_PASSWORD || (isRemote ? '' : 'Customer@123');
  if (!adminPlain || !customerPlain) {
    console.error(
      'Refusing to seed a non-local database with default passwords. ' +
        'Set SEED_ADMIN_PASSWORD and SEED_CUSTOMER_PASSWORD (strong, unique values) and retry.'
    );
    process.exit(1);
  }

  console.log('Seeding MySQL database...');

  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.review.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();

  const adminPass = await hashPassword(adminPlain);
  const customerPass = await hashPassword(customerPlain);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@nexuscommerce.io',
      password: adminPass,
      firstName: 'System',
      lastName: 'Admin',
      role: ROLES.SUPER_ADMIN,
      isEmailVerified: true,
    },
  });

  const customer = await prisma.user.create({
    data: {
      email: 'customer@demo.com',
      password: customerPass,
      firstName: 'Alex',
      lastName: 'Morgan',
      role: ROLES.CUSTOMER,
      isEmailVerified: true,
    },
  });

  const categories = await Promise.all([
    prisma.category.create({ data: { name: 'Electronics', slug: 'electronics', sortOrder: 1 } }),
    prisma.category.create({ data: { name: 'Fashion', slug: 'fashion', sortOrder: 2 } }),
    prisma.category.create({ data: { name: 'Home & Living', slug: 'home-living', sortOrder: 3 } }),
    prisma.category.create({ data: { name: 'Accessories', slug: 'accessories', sortOrder: 4 } }),
  ]);

  await prisma.product.createMany({
    data: [
      {
        name: 'Nexus Pro Wireless Headphones',
        slug: 'nexus-pro-wireless-headphones',
        description: 'Premium noise-cancelling wireless headphones with 40-hour battery life.',
        sku: 'NX-HP-001',
        price: 349.99,
        compareAtPrice: 449.99,
        categoryId: categories[0].id,
        brand: 'Nexus',
        tags: ['audio', 'wireless', 'premium'],
        stock: 150,
        isFeatured: true,
        images: [{ url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800', isPrimary: true }],
        rating: 4.8,
        reviewCount: 234,
        soldCount: 1200,
      },
      {
        name: 'Aurora Smart Watch Ultra',
        slug: 'aurora-smart-watch-ultra',
        description: 'Titanium case smartwatch with health tracking.',
        sku: 'NX-SW-002',
        price: 799.99,
        compareAtPrice: 999.99,
        categoryId: categories[0].id,
        brand: 'Aurora',
        tags: ['wearable', 'smart'],
        stock: 80,
        isFeatured: true,
        images: [{ url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800', isPrimary: true }],
        rating: 4.9,
        reviewCount: 512,
        soldCount: 890,
      },
      {
        name: 'Minimalist Leather Jacket',
        slug: 'minimalist-leather-jacket',
        description: 'Handcrafted Italian leather jacket.',
        sku: 'NX-FA-003',
        price: 589.99,
        categoryId: categories[1].id,
        brand: 'Nexus Atelier',
        stock: 45,
        isFeatured: true,
        images: [{ url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800', isPrimary: true }],
        rating: 4.7,
        reviewCount: 89,
        soldCount: 340,
      },
      {
        name: 'Ceramic Artisan Vase Set',
        slug: 'ceramic-artisan-vase-set',
        description: 'Set of three hand-thrown ceramic vases.',
        sku: 'NX-HL-004',
        price: 129.99,
        categoryId: categories[2].id,
        brand: 'Artisan Co',
        stock: 200,
        isFeatured: true,
        images: [{ url: 'https://images.unsplash.com/photo-1578500494190-abc6c9335b71?w=800', isPrimary: true }],
        rating: 4.6,
        reviewCount: 67,
        soldCount: 520,
      },
      {
        name: 'Urban Runner Sneakers',
        slug: 'urban-runner-sneakers',
        description: 'Lightweight performance sneakers with breathable mesh upper.',
        shortDescription: 'All-day comfort for city and gym.',
        sku: 'NX-FA-005',
        price: 159.99,
        compareAtPrice: 199.99,
        categoryId: categories[1].id,
        brand: 'Nexus Sport',
        tags: ['shoes', 'sport'],
        stock: 120,
        isFeatured: true,
        images: [{ url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800', isPrimary: true }],
        rating: 4.5,
        reviewCount: 178,
        soldCount: 640,
      },
      {
        name: 'Wireless Noise-Cancelling Earbuds',
        slug: 'wireless-noise-cancelling-earbuds',
        description: 'Compact true wireless earbuds with active noise cancellation.',
        sku: 'NX-HP-006',
        price: 129.99,
        categoryId: categories[0].id,
        brand: 'Nexus',
        stock: 300,
        isFeatured: true,
        images: [{ url: 'https://images.unsplash.com/photo-1590658268037-6bf3fdadc0a0?w=800', isPrimary: true }],
        rating: 4.4,
        reviewCount: 412,
        soldCount: 2100,
      },
      {
        name: 'Scandinavian Desk Lamp',
        slug: 'scandinavian-desk-lamp',
        description: 'Minimal LED desk lamp with adjustable warmth and brightness.',
        sku: 'NX-HL-007',
        price: 89.99,
        categoryId: categories[2].id,
        brand: 'Lumina',
        stock: 85,
        isFeatured: true,
        images: [{ url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800', isPrimary: true }],
        rating: 4.7,
        reviewCount: 93,
        soldCount: 410,
      },
      {
        name: 'Premium Canvas Backpack',
        slug: 'premium-canvas-backpack',
        description: 'Water-resistant canvas backpack with laptop compartment.',
        sku: 'NX-AC-008',
        price: 79.99,
        compareAtPrice: 99.99,
        categoryId: categories[3].id,
        brand: 'Nexus',
        stock: 175,
        isFeatured: true,
        images: [{ url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800', isPrimary: true }],
        rating: 4.6,
        reviewCount: 256,
        soldCount: 980,
      },
      {
        name: '4K Ultra HD Monitor 27"',
        slug: '4k-ultra-hd-monitor-27',
        description: '27-inch 4K IPS monitor with HDR10 and USB-C hub.',
        sku: 'NX-EL-009',
        price: 449.99,
        compareAtPrice: 549.99,
        categoryId: categories[0].id,
        brand: 'VisionPro',
        stock: 60,
        isFeatured: true,
        images: [{ url: 'https://images.unsplash.com/photo-1527443224754-9f9a86abe3e0?w=800', isPrimary: true }],
        rating: 4.8,
        reviewCount: 145,
        soldCount: 320,
      },
      {
        name: 'Organic Cotton T-Shirt Pack',
        slug: 'organic-cotton-tshirt-pack',
        description: 'Pack of 3 soft organic cotton tees in neutral tones.',
        sku: 'NX-FA-010',
        price: 49.99,
        categoryId: categories[1].id,
        brand: 'Nexus Basics',
        stock: 400,
        images: [{ url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800', isPrimary: true }],
        rating: 4.3,
        reviewCount: 88,
        soldCount: 1500,
      },
      {
        name: 'Stainless Steel Water Bottle',
        slug: 'stainless-steel-water-bottle',
        description: 'Insulated 32oz bottle keeps drinks cold 24h or hot 12h.',
        sku: 'NX-AC-011',
        price: 34.99,
        categoryId: categories[3].id,
        brand: 'HydroNexus',
        stock: 500,
        images: [{ url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800', isPrimary: true }],
        rating: 4.9,
        reviewCount: 620,
        soldCount: 3200,
      },
      {
        name: 'Smart Home Hub Pro',
        slug: 'smart-home-hub-pro',
        description: 'Central hub to control lights, locks, and sensors from one app.',
        sku: 'NX-EL-012',
        price: 199.99,
        categoryId: categories[0].id,
        brand: 'Nexus Home',
        stock: 95,
        images: [{ url: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=800', isPrimary: true }],
        rating: 4.5,
        reviewCount: 72,
        soldCount: 280,
      },
    ],
  });

  await prisma.coupon.create({
    data: {
      code: 'WELCOME20',
      description: '20% off your first order',
      type: 'percentage',
      value: 20,
      maxDiscount: 100,
      usageLimit: 1000,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.banner.create({
    data: {
      title: 'The Future of Commerce',
      subtitle: 'Discover premium products curated by AI',
      image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1920',
      position: 'hero',
      sortOrder: 1,
    },
  });

  console.log('Seed completed!');
  console.log(
    process.env.SEED_ADMIN_PASSWORD
      ? 'Admin: admin@nexuscommerce.io (password taken from SEED_ADMIN_PASSWORD)'
      : 'Admin: admin@nexuscommerce.io / Admin@123456 (local development default)'
  );
  console.log(
    process.env.SEED_CUSTOMER_PASSWORD
      ? 'Customer: customer@demo.com (password taken from SEED_CUSTOMER_PASSWORD)'
      : 'Customer: customer@demo.com / Customer@123 (local development default)'
  );
  console.log(`Admin ID: ${admin.id}, Customer ID: ${customer.id}`);
};

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
