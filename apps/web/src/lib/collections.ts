import axios from 'axios';
import { api } from '@/lib/api';
import { DEMO_PRODUCTS } from '@/lib/demo-products';

export interface Collection {
  id: number;
  _id?: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  productCount?: number;
}

const DEMO_COLLECTIONS: Collection[] = [
  {
    id: 1,
    name: 'Electronics',
    slug: 'electronics',
    description: 'Cutting-edge tech — headphones, watches, monitors, and smart home gear.',
    image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
    productCount: DEMO_PRODUCTS.filter((p) => p.category?.slug === 'electronics').length,
  },
  {
    id: 2,
    name: 'Fashion',
    slug: 'fashion',
    description: 'Timeless style — apparel and footwear crafted for everyday elegance.',
    image: 'https://images.unsplash.com/photo-1483985988354-763728e3685b?w=800',
    productCount: DEMO_PRODUCTS.filter((p) => p.category?.slug === 'fashion').length,
  },
  {
    id: 3,
    name: 'Home & Living',
    slug: 'home-living',
    description: 'Elevate your space with decor, lighting, and artisan home essentials.',
    image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800',
    productCount: DEMO_PRODUCTS.filter((p) => p.category?.slug === 'home-living').length,
  },
  {
    id: 4,
    name: 'Accessories',
    slug: 'accessories',
    description: 'The finishing touches — bags, bottles, and everyday carry essentials.',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800',
    productCount: DEMO_PRODUCTS.filter((p) => p.category?.slug === 'accessories').length,
  },
];

const COLLECTION_IMAGES: Record<string, string> = {
  electronics: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
  fashion: 'https://images.unsplash.com/photo-1483985988354-763728e3685b?w=800',
  'home-living': 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800',
  accessories: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800',
};

const COLLECTION_DESCRIPTIONS: Record<string, string> = {
  electronics: 'Cutting-edge tech — headphones, watches, monitors, and smart home gear.',
  fashion: 'Timeless style — apparel and footwear crafted for everyday elegance.',
  'home-living': 'Elevate your space with decor, lighting, and artisan home essentials.',
  accessories: 'The finishing touches — bags, bottles, and everyday carry essentials.',
};

function enrichCollection(cat: Collection, productCount?: number): Collection {
  return {
    ...cat,
    _id: String(cat.id),
    image: cat.image || COLLECTION_IMAGES[cat.slug],
    description: cat.description || COLLECTION_DESCRIPTIONS[cat.slug],
    productCount: productCount ?? cat.productCount,
  };
}

export async function fetchCollections(): Promise<Collection[]> {
  try {
    const res = await api.get('/products/categories');
    const categories = (res.data.data ?? []) as Collection[];
    return categories.map((c) => enrichCollection(c));
  } catch (err) {
    if (axios.isAxiosError(err) && !err.response) {
      return DEMO_COLLECTIONS;
    }
    return DEMO_COLLECTIONS;
  }
}

export function getDemoCollections() {
  return DEMO_COLLECTIONS;
}
