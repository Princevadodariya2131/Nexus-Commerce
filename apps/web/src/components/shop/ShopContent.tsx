'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { fetchProducts } from '@/lib/products';
import { staggerContainer } from '@/lib/motion/variants';
import { ProductCard } from '@/components/shop/ProductCard';

export function ShopContent() {
  const searchParams = useSearchParams();
  const page = searchParams.get('page') || '1';
  const sort = searchParams.get('sort') || 'newest';
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, sort, search, category],
    queryFn: () => fetchProducts({ page, sort, search, category: category || undefined, limit: 12 }),
  });

  return (
    <div className="min-h-screen pt-28 pb-16 px-4 md:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-4xl font-bold md:text-6xl mb-4">Shop</h1>
          {search ? (
            <p className="text-muted-foreground mb-8">
              Results for <span className="text-foreground font-medium">&quot;{search}&quot;</span>
              {data?.products && (
                <span className="ml-2">({data.products.length} items)</span>
              )}
            </p>
          ) : category ? (
            <p className="text-muted-foreground mb-8 capitalize">
              Collection: <span className="text-foreground font-medium">{category.replace(/-/g, ' ')}</span>
              {data?.products && <span className="ml-2">({data.products.length} items)</span>}
            </p>
          ) : (
            <p className="text-muted-foreground mb-8">Discover our curated collection</p>
          )}
        </motion.div>

        <div className="flex flex-wrap gap-2 mb-8">
          {['newest', 'popular', 'price-asc', 'price-desc', 'rating'].map((s) => (
            <Link
              key={s}
              href={`/shop?sort=${s}${search ? `&search=${search}` : ''}${category ? `&category=${category}` : ''}`}
              className={`glass rounded-full px-4 py-2 text-sm transition-colors ${
                sort === s ? 'bg-primary text-primary-foreground' : 'hover:bg-white/10'
              }`}
            >
              {s.replace('-', ' ')}
            </Link>
          ))}
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="glass-card aspect-[3/4] animate-pulse" />
              ))
            : data?.products && data.products.length > 0
              ? data.products.map((product) => (
                  <ProductCard key={product._id || product.slug} product={product} />
                ))
              : (
                <p className="col-span-full text-center text-muted-foreground py-16">
                  No products found{search ? ` for "${search}"` : ''}.{' '}
                  <Link href="/shop" className="text-primary hover:underline">Clear search</Link>
                </p>
              )}
        </motion.div>
      </div>
    </div>
  );
}
