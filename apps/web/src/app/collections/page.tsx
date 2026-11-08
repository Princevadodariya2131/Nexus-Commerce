'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  Layers,
  Shirt,
  Home,
  Watch,
  Grid3X3,
} from 'lucide-react';
import { fetchCollections, type Collection } from '@/lib/collections';
import { fetchProducts } from '@/lib/products';
import { ProductCard } from '@/components/shop/ProductCard';
import { Button } from '@/components/ui/button';
import { blurReveal, fadeUp, staggerContainer, luxuryScale } from '@/lib/motion/variants';

const ICONS: Record<string, typeof Layers> = {
  electronics: Watch,
  fashion: Shirt,
  'home-living': Home,
  accessories: Grid3X3,
};

const curatedHighlights = [
  {
    title: 'New arrivals',
    desc: 'Fresh drops added weekly from independent makers and global brands.',
    href: '/shop?sort=newest',
    gradient: 'from-violet-600/30 to-transparent',
  },
  {
    title: 'Best sellers',
    desc: 'Community favorites with thousands of five-star reviews.',
    href: '/shop?sort=popular',
    gradient: 'from-emerald-600/20 to-transparent',
  },
  {
    title: 'Top rated',
    desc: 'Only the highest-rated pieces in our entire catalog.',
    href: '/shop?sort=rating',
    gradient: 'from-amber-600/20 to-transparent',
  },
];

function CollectionCard({ collection, index }: { collection: Collection; index: number }) {
  const Icon = ICONS[collection.slug] ?? Layers;
  const isLarge = index === 0;
  const spanClass = isLarge
    ? 'col-span-12 md:col-span-8 md:row-span-2'
    : index < 3
      ? 'col-span-12 md:col-span-4'
      : 'col-span-12';

  return (
    <motion.div variants={luxuryScale} className={spanClass}>
      <Link
        href={`/shop?category=${collection.slug}`}
        className={`group block glass-card overflow-hidden h-full min-h-[280px] ${isLarge ? 'min-h-[420px]' : ''}`}
      >
        <div className="relative h-full min-h-[inherit]">
          {collection.image && (
            <Image
              src={collection.image}
              alt={collection.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes={isLarge ? '(max-width: 768px) 100vw, 66vw' : '(max-width: 768px) 100vw, 33vw'}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/30 backdrop-blur-sm">
                <Icon className="h-5 w-5 text-primary" />
              </span>
              {collection.productCount != null && (
                <span className="text-xs glass rounded-full px-3 py-1 text-muted-foreground">
                  {collection.productCount} products
                </span>
              )}
            </div>
            <h3 className={`font-display font-bold ${isLarge ? 'text-3xl md:text-4xl' : 'text-2xl'}`}>
              {collection.name}
            </h3>
            {collection.description && (
              <p className={`text-muted-foreground mt-2 line-clamp-2 ${isLarge ? 'max-w-lg text-base' : 'text-sm'}`}>
                {collection.description}
              </p>
            )}
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              Shop collection <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function CollectionsPage() {
  const { data: collections, isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
  });

  const featuredSlug = collections?.[0]?.slug;
  const { data: previewProducts } = useQuery({
    queryKey: ['collection-preview', featuredSlug],
    queryFn: () => fetchProducts({ category: featuredSlug, limit: 4, sort: 'popular' }),
    enabled: !!featuredSlug,
  });

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute top-20 right-0 h-[500px] w-[500px] rounded-full bg-primary/15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-96 w-96 rounded-full bg-violet-900/20 blur-[100px]" />

      {/* Hero */}
      <section className="relative pt-32 pb-16 px-4 md:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-7xl text-center"
        >
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-6">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">Curated for you</span>
          </motion.div>
          <motion.h1 variants={blurReveal} className="font-display text-5xl font-bold md:text-7xl lg:text-8xl">
            Our <span className="gradient-text">collections</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore handpicked categories — each one a world of premium products, thoughtfully
            organized so you find exactly what inspires you.
          </motion.p>
        </motion.div>
      </section>

      {/* Collection grid */}
      <section className="py-12 px-4 md:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10"
          >
            <p className="text-sm text-primary font-medium mb-2">Browse by category</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Shop collections</h2>
          </motion.div>

          {isLoading ? (
            <div className="grid grid-cols-12 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={`glass-card animate-pulse col-span-12 ${i === 0 ? 'md:col-span-8 min-h-[420px]' : 'sm:col-span-6 md:col-span-4 min-h-[280px]'}`}
                />
              ))}
            </div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              className="grid grid-cols-12 gap-4 auto-rows-fr"
            >
              {collections?.map((col, i) => (
                <CollectionCard key={col.slug} collection={col} index={i} />
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* Curated highlights */}
      <section className="py-20 px-4 md:px-8 border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-sm text-primary font-medium mb-2">Editor&apos;s picks</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Curated highlights</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {curatedHighlights.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -6 }}
              >
                <Link
                  href={item.href}
                  className={`block glass-card p-8 h-full relative overflow-hidden group hover:border-primary/30 transition-colors`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} pointer-events-none`} />
                  <div className="relative z-10">
                    <h3 className="font-display text-xl font-bold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    <span className="mt-6 inline-flex items-center gap-2 text-sm text-primary font-medium">
                      Explore <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured collection preview */}
      {collections && collections[0] && (
        <section className="py-24 px-4 md:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10"
            >
              <div>
                <p className="text-sm text-primary font-medium mb-2">Featured</p>
                <h2 className="font-display text-3xl md:text-4xl font-bold">
                  From {collections[0].name}
                </h2>
                <p className="text-muted-foreground mt-2 max-w-lg">{collections[0].description}</p>
              </div>
              <Link href={`/shop?category=${collections[0].slug}`}>
                <Button variant="secondary" className="gap-2">
                  View all <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
            >
              {previewProducts?.products?.length
                ? previewProducts.products.map((p) => <ProductCard key={p._id || p.slug} product={p} />)
                : Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="glass-card aspect-square animate-pulse" />
                  ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-24 px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mx-auto max-w-4xl glass-card p-12 md:p-16 text-center relative overflow-hidden gradient-border"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10">
            <Layers className="h-10 w-10 text-primary mx-auto mb-4" />
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Can&apos;t choose a collection?
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              Browse the full catalog with filters for price, rating, and newest arrivals.
            </p>
            <Link href="/shop">
              <Button size="lg" className="gap-2">
                Shop everything <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
