import axios from 'axios';
import { api } from '@/lib/api';
import {
  DEMO_PRODUCTS,
  getDemoFeatured,
  getDemoProductBySlug,
  getDemoProducts,
  type DemoProduct,
} from '@/lib/demo-products';

export type Product = DemoProduct;

export function isApiAvailable() {
  return typeof window !== 'undefined' && !sessionStorage.getItem('nexus_api_offline');
}

function markApiOffline() {
  if (typeof window !== 'undefined') sessionStorage.setItem('nexus_api_offline', '1');
}

function markApiOnline() {
  if (typeof window !== 'undefined') sessionStorage.removeItem('nexus_api_offline');
}

async function tryApi<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    const result = await fn();
    markApiOnline();
    return result;
  } catch (err) {
    if (axios.isAxiosError(err) && !err.response) markApiOffline();
    return fallback();
  }
}

export async function fetchFeaturedProducts(): Promise<Product[]> {
  return tryApi(
    async () => {
      const res = await api.get('/products/featured');
      return res.data.data as Product[];
    },
    () => getDemoFeatured()
  );
}

export async function fetchProducts(params: {
  page?: string;
  sort?: string;
  search?: string;
  category?: string;
  limit?: number;
}): Promise<{ products: Product[]; meta: { total: number; totalPages: number } }> {
  return tryApi(
    async () => {
      const res = await api.get('/products', {
        params: {
          page: params.page,
          sort: params.sort,
          search: params.search || undefined,
          category: params.category || undefined,
          limit: params.limit ?? 12,
        },
      });
      return {
        products: res.data.data as Product[],
        meta: res.data.meta ?? { total: 0, totalPages: 1 },
      };
    },
    () => {
      let products = getDemoProducts(params.search, params.sort);
      if (params.category) {
        products = products.filter((p) => p.category?.slug === params.category);
      }
      return { products, meta: { total: products.length, totalPages: 1 } };
    }
  );
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  return tryApi(
    async () => {
      const res = await api.get(`/products/${slug}`);
      return res.data.data as Product;
    },
    () => getDemoProductBySlug(slug)
  );
}

export async function fetchRelatedProducts(productId: number): Promise<Product[]> {
  return tryApi(
    async () => {
      const res = await api.get('/products/recommendations', { params: { productId } });
      return (res.data.data ?? []).slice(0, 4) as Product[];
    },
    () => DEMO_PRODUCTS.filter((p) => p.id !== productId).slice(0, 4)
  );
}
