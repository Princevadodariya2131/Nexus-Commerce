'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { fetchFeaturedProducts } from '@/lib/products';
import { staggerContainer } from '@/lib/motion/variants';
import { ProductCard } from '@/components/shop/ProductCard';

export function FeaturedProducts() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['featured-products'],
    queryFn: fetchFeaturedProducts,
  });

  return (
    <section className="py-24 px-4 md:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mx-auto max-w-7xl"
      >
        <div className="mb-12 flex items-end justify-between">
          <div>
            <p className="text-sm text-primary font-medium mb-2">Curated Selection</p>
            <h2 className="font-display text-3xl font-bold md:text-5xl">Featured Products</h2>
          </div>
          <Link href="/shop" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-cursor="pointer">
            View all →
          </Link>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="glass-card aspect-[3/4] animate-pulse" />
              ))
            : data && data.length > 0
              ? data.map((product) => <ProductCard key={product._id || product.slug} product={product} />)
              : (
                <p className="col-span-full text-center text-muted-foreground py-12">
                  {isError ? 'Could not load products.' : 'No featured products yet.'}{' '}
                  <Link href="/shop" className="text-primary hover:underline">Browse shop</Link>
                </p>
              )}
        </motion.div>
      </motion.div>
    </section>
  );
}
