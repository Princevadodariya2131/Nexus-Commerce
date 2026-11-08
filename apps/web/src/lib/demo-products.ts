/** Fallback catalog when the API is unavailable (offline demo mode). */
export interface DemoProduct {
  _id: string;
  id: number;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;
  images: { url: string; isPrimary?: boolean }[];
  rating: number;
  reviewCount: number;
  stock: number;
  brand?: string;
  sku: string;
  soldCount: number;
  tags?: string[];
  category?: { name: string; slug: string };
  isFeatured?: boolean;
}

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    _id: '1',
    id: 1,
    name: 'Nexus Pro Wireless Headphones',
    slug: 'nexus-pro-wireless-headphones',
    description:
      'Premium noise-cancelling wireless headphones with 40-hour battery life and studio-quality sound.',
    shortDescription: 'Premium ANC headphones with 40h battery.',
    price: 349.99,
    compareAtPrice: 449.99,
    images: [{ url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800', isPrimary: true }],
    rating: 4.8,
    reviewCount: 234,
    stock: 150,
    brand: 'Nexus',
    sku: 'NX-HP-001',
    soldCount: 1200,
    tags: ['audio', 'wireless'],
    category: { name: 'Electronics', slug: 'electronics' },
    isFeatured: true,
  },
  {
    _id: '2',
    id: 2,
    name: 'Aurora Smart Watch Ultra',
    slug: 'aurora-smart-watch-ultra',
    description: 'Titanium case smartwatch with health tracking, GPS, and week-long battery.',
    shortDescription: 'Premium smartwatch with health tracking.',
    price: 799.99,
    compareAtPrice: 999.99,
    images: [{ url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800', isPrimary: true }],
    rating: 4.9,
    reviewCount: 512,
    stock: 80,
    brand: 'Aurora',
    sku: 'NX-SW-002',
    soldCount: 890,
    category: { name: 'Electronics', slug: 'electronics' },
    isFeatured: true,
  },
  {
    _id: '3',
    id: 3,
    name: 'Minimalist Leather Jacket',
    slug: 'minimalist-leather-jacket',
    description: 'Handcrafted Italian leather jacket with modern slim fit.',
    price: 589.99,
    images: [{ url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800', isPrimary: true }],
    rating: 4.7,
    reviewCount: 89,
    stock: 45,
    brand: 'Nexus Atelier',
    sku: 'NX-FA-003',
    soldCount: 340,
    category: { name: 'Fashion', slug: 'fashion' },
    isFeatured: true,
  },
  {
    _id: '4',
    id: 4,
    name: 'Ceramic Artisan Vase Set',
    slug: 'ceramic-artisan-vase-set',
    description: 'Set of three hand-thrown ceramic vases in earthy tones.',
    price: 129.99,
    images: [{ url: 'https://images.unsplash.com/photo-1578500494190-abc6c9335b71?w=800', isPrimary: true }],
    rating: 4.6,
    reviewCount: 67,
    stock: 200,
    brand: 'Artisan Co',
    sku: 'NX-HL-004',
    soldCount: 520,
    category: { name: 'Home & Living', slug: 'home-living' },
    isFeatured: true,
  },
  {
    _id: '5',
    id: 5,
    name: 'Urban Runner Sneakers',
    slug: 'urban-runner-sneakers',
    description: 'Lightweight performance sneakers with breathable mesh upper.',
    price: 159.99,
    compareAtPrice: 199.99,
    images: [{ url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800', isPrimary: true }],
    rating: 4.5,
    reviewCount: 178,
    stock: 120,
    brand: 'Nexus Sport',
    sku: 'NX-FA-005',
    soldCount: 640,
    category: { name: 'Fashion', slug: 'fashion' },
    isFeatured: true,
  },
  {
    _id: '6',
    id: 6,
    name: 'Wireless Noise-Cancelling Earbuds',
    slug: 'wireless-noise-cancelling-earbuds',
    description: 'Compact true wireless earbuds with active noise cancellation.',
    price: 129.99,
    images: [{ url: 'https://images.unsplash.com/photo-1590658268037-6bf3fdadc0a0?w=800', isPrimary: true }],
    rating: 4.4,
    reviewCount: 412,
    stock: 300,
    brand: 'Nexus',
    sku: 'NX-HP-006',
    soldCount: 2100,
    category: { name: 'Electronics', slug: 'electronics' },
    isFeatured: true,
  },
  {
    _id: '7',
    id: 7,
    name: 'Scandinavian Desk Lamp',
    slug: 'scandinavian-desk-lamp',
    description: 'Minimal LED desk lamp with adjustable warmth and brightness.',
    price: 89.99,
    images: [{ url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800', isPrimary: true }],
    rating: 4.7,
    reviewCount: 93,
    stock: 85,
    brand: 'Lumina',
    sku: 'NX-HL-007',
    soldCount: 410,
    category: { name: 'Home & Living', slug: 'home-living' },
    isFeatured: true,
  },
  {
    _id: '8',
    id: 8,
    name: 'Premium Canvas Backpack',
    slug: 'premium-canvas-backpack',
    description: 'Water-resistant canvas backpack with padded laptop compartment.',
    price: 79.99,
    compareAtPrice: 99.99,
    images: [{ url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800', isPrimary: true }],
    rating: 4.6,
    reviewCount: 256,
    stock: 175,
    brand: 'Nexus',
    sku: 'NX-AC-008',
    soldCount: 980,
    category: { name: 'Accessories', slug: 'accessories' },
    isFeatured: true,
  },
];

export function getDemoFeatured() {
  return DEMO_PRODUCTS.filter((p) => p.isFeatured).slice(0, 8);
}

export function getDemoProducts(search?: string, sort = 'newest') {
  let list = [...DEMO_PRODUCTS];
  if (search?.trim()) {
    const q = search.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.category?.name.toLowerCase().includes(q)
    );
  }
  switch (sort) {
    case 'price-asc':
      list.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      list.sort((a, b) => b.price - a.price);
      break;
    case 'rating':
      list.sort((a, b) => b.rating - a.rating);
      break;
    case 'popular':
      list.sort((a, b) => b.soldCount - a.soldCount);
      break;
    default:
      break;
  }
  return list;
}

export function getDemoProductBySlug(slug: string) {
  return DEMO_PRODUCTS.find((p) => p.slug === slug) ?? null;
}
